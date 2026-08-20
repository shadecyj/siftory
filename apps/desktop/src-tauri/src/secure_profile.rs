//! Windows-only Live runtime profile handling.
//!
//! This module deliberately keeps provider credentials on the Rust side of
//! the Tauri boundary.  The external Next.js workspace is never given a
//! command that can read, write, or enumerate secret values.

use std::{
  process::Command,
  sync::{Mutex, MutexGuard},
  time::Duration,
};

use keyring::{Entry, Error as KeyringError};
use reqwest::{blocking::Client, StatusCode};
use serde::{Deserialize, Serialize};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use url::Url;
use zeroize::{Zeroize, Zeroizing};

const PROFILE_SCHEMA_VERSION: u8 = 1;
const PROFILE_SERVICE: &str = "com.searchos.desktop.runtime.v1";
const STAGED_PROFILE_ACCOUNT: &str = "staged-live-profile";
const ACTIVE_PROFILE_ACCOUNT: &str = "active-live-profile";
const MAX_SECRET_BYTES: usize = 1_024;
const MAX_PROFILE_BYTES: usize = 2_400;
const VERIFICATION_TIMEOUT: Duration = Duration::from_secs(12);
const TAVILY_VERIFICATION_URL: &str = "https://api.tavily.com/search";
const BRAVE_VERIFICATION_URL: &str = "https://api.search.brave.com/res/v1/web/search";
const DEEPSEEK_DEFAULT_BASE_URL: &str = "https://api.deepseek.com/";
const OPENAI_DEFAULT_BASE_URL: &str = "https://api.openai.com/v1/";

pub type CommandResult<T> = Result<T, PublicCommandError>;

/// The only error shape that crosses the native IPC boundary.  It is
/// intentionally code-only: neither provider bodies nor secure-store errors
/// are suitable for a renderer process or a log file.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCommandError {
  pub code: &'static str,
}

impl PublicCommandError {
  pub const fn new(code: &'static str) -> Self {
    Self { code }
  }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SearchProvider {
  Tavily,
  Brave,
}

impl SearchProvider {
  pub(crate) const fn as_env(self) -> &'static str {
    match self {
      Self::Tavily => "tavily",
      Self::Brave => "brave",
    }
  }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ModelProvider {
  Deepseek,
  Openai,
}

impl ModelProvider {
  pub(crate) const fn as_env(self) -> &'static str {
    match self {
      Self::Deepseek => "deepseek",
      Self::Openai => "openai",
    }
  }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ValidationState {
  #[serde(rename = "NOT_CONFIGURED")]
  NotConfigured,
  #[serde(rename = "SAVED_UNVERIFIED")]
  SavedUnverified,
  #[serde(rename = "TESTING")]
  Testing,
  #[serde(rename = "VERIFIED")]
  Verified,
  #[serde(rename = "FAILED")]
  Failed,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum LifecycleState {
  #[serde(rename = "ACTIVE")]
  Active,
  #[serde(rename = "RESTART_REQUIRED")]
  RestartRequired,
  #[serde(rename = "RESTARTING")]
  Restarting,
  #[serde(rename = "ROLLBACK")]
  Rollback,
  #[serde(rename = "REPLAY_FALLBACK")]
  ReplayFallback,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum RuntimeMode {
  #[serde(rename = "replay")]
  Replay,
  #[serde(rename = "live")]
  Live,
}

/// Runtime information that is safe for the credential panel to display.
#[derive(Debug, Clone, Copy)]
pub struct RuntimeSnapshot {
  pub mode: RuntimeMode,
  pub lifecycle: LifecycleState,
  pub active_run_count: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LiveProfileInput {
  pub search_provider: SearchProvider,
  pub model_provider: ModelProvider,
  pub model: String,
  pub model_base_url: Option<String>,
  pub search_api_key: String,
  pub model_api_key: String,
}

impl Drop for LiveProfileInput {
  fn drop(&mut self) {
    // Command inputs are transient, but they can take an early error path
    // before `StoredLiveProfile` owns the values. Wipe all user-provided
    // strings on drop; provider/model enums carry no secret material.
    self.model.zeroize();
    if let Some(base_url) = self.model_base_url.as_mut() {
      base_url.zeroize();
    }
    self.search_api_key.zeroize();
    self.model_api_key.zeroize();
  }
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClearScope {
  Staged,
  Active,
  All,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeProfileStatus {
  pub runtime_mode: RuntimeMode,
  pub search_provider: Option<SearchProvider>,
  pub model_provider: Option<ModelProvider>,
  pub model: Option<String>,
  pub model_base_url: Option<String>,
  pub search_key_configured: bool,
  pub model_key_configured: bool,
  pub validation_state: ValidationState,
  pub lifecycle_state: LifecycleState,
  pub restart_required: bool,
  pub active_run_count: u32,
  pub last_validated_at: Option<String>,
  pub public_failure_code: Option<&'static str>,
  pub revision: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialPanelStatus {
  pub runtime: RuntimeProfileStatus,
  pub staged_profile_present: bool,
  pub active_profile_present: bool,
  pub active_revision: Option<u64>,
  pub secure_storage_available: bool,
}

/// A profile is serialized only into a Windows Generic Credential blob.  It is
/// never written to app data, a JSON file, PGlite, a Tauri Store, or a log.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct StoredLiveProfile {
  schema_version: u8,
  revision: u64,
  search_provider: SearchProvider,
  model_provider: ModelProvider,
  model: String,
  model_base_url: Option<String>,
  validation_state: ValidationState,
  last_validated_at: Option<String>,
  public_failure_code: Option<String>,
  search_api_key: String,
  model_api_key: String,
}

impl Drop for StoredLiveProfile {
  fn drop(&mut self) {
    self.search_api_key.zeroize();
    self.model_api_key.zeroize();
  }
}

impl StoredLiveProfile {
  pub(crate) fn revision(&self) -> u64 {
    self.revision
  }

  pub(crate) fn is_verified(&self) -> bool {
    self.validation_state == ValidationState::Verified
  }

  pub(crate) fn apply_to_sidecar(&self, command: &mut Command) {
    command
      .env("SEARCH_PROVIDER", self.search_provider.as_env())
      .env("MODEL_PROVIDER", self.model_provider.as_env())
      .env("SEARCHOS_DESKTOP_PROFILE_CONFIGURED", "1")
      .env("SEARCHOS_DESKTOP_PROFILE_REVISION", self.revision.to_string())
      .env("SEARCHOS_DESKTOP_VALIDATION_STATE", validation_state_name(self.validation_state));

    if let Some(validated_at) = &self.last_validated_at {
      command.env("SEARCHOS_DESKTOP_LAST_VALIDATED_AT", validated_at);
    }

    match self.search_provider {
      SearchProvider::Tavily => {
        command.env("TAVILY_API_KEY", &self.search_api_key);
      }
      SearchProvider::Brave => {
        command.env("BRAVE_SEARCH_API_KEY", &self.search_api_key);
      }
    };

    match self.model_provider {
      ModelProvider::Deepseek => {
        command
          .env("DEEPSEEK_API_KEY", &self.model_api_key)
          .env("DEEPSEEK_MODEL", &self.model);
        if let Some(base_url) = &self.model_base_url {
          command.env("DEEPSEEK_BASE_URL", base_url);
        }
      }
      ModelProvider::Openai => {
        command
          .env("OPENAI_API_KEY", &self.model_api_key)
          .env("OPENAI_MODEL", &self.model);
      }
    };
  }

  fn from_input(mut input: LiveProfileInput, revision: u64) -> CommandResult<Self> {
    let search_api_key = normalize_api_key(std::mem::take(&mut input.search_api_key))?;
    let model_api_key = normalize_api_key(std::mem::take(&mut input.model_api_key))?;
    let model = normalize_model(std::mem::take(&mut input.model))?;
    let model_base_url = normalize_model_base_url(input.model_provider, input.model_base_url.take())?;

    Ok(Self {
      schema_version: PROFILE_SCHEMA_VERSION,
      revision,
      search_provider: input.search_provider,
      model_provider: input.model_provider,
      model,
      model_base_url,
      validation_state: ValidationState::SavedUnverified,
      last_validated_at: None,
      public_failure_code: None,
      search_api_key,
      model_api_key,
    })
  }

  fn validate_persisted(&self) -> CommandResult<()> {
    if self.schema_version != PROFILE_SCHEMA_VERSION || self.revision == 0 {
      return Err(PublicCommandError::new("PROFILE_INVALID"));
    }
    if !valid_model_identifier(&self.model)
      || !valid_api_key(&self.search_api_key)
      || !valid_api_key(&self.model_api_key)
    {
      return Err(PublicCommandError::new("PROFILE_INVALID"));
    }
    let _ = normalize_model_base_url(self.model_provider, self.model_base_url.clone())?;
    Ok(())
  }

  fn metadata(&self) -> ProfileMetadata {
    ProfileMetadata {
      search_provider: self.search_provider,
      model_provider: self.model_provider,
      model: self.model.clone(),
      model_base_url: self.model_base_url.clone(),
      validation_state: self.validation_state,
      last_validated_at: self.last_validated_at.clone(),
      public_failure_code: self.public_failure_code.as_deref().and_then(known_failure_code),
      revision: self.revision,
    }
  }
}

#[derive(Debug)]
struct ProfileMetadata {
  search_provider: SearchProvider,
  model_provider: ModelProvider,
  model: String,
  model_base_url: Option<String>,
  validation_state: ValidationState,
  last_validated_at: Option<String>,
  public_failure_code: Option<&'static str>,
  revision: u64,
}

#[derive(Clone, Copy)]
pub(crate) enum ProfileSlot {
  Staged,
  Active,
}

impl ProfileSlot {
  fn account(self) -> &'static str {
    match self {
      Self::Staged => STAGED_PROFILE_ACCOUNT,
      Self::Active => ACTIVE_PROFILE_ACCOUNT,
    }
  }
}

/// Serializes all Windows Credential Manager access.  Windows does not
/// guarantee ordered writes to the same credential across threads.
pub struct SecureRuntimeProfiles(Mutex<()>);

impl SecureRuntimeProfiles {
  pub fn new() -> Self {
    Self(Mutex::new(()))
  }

  pub(crate) fn lock(&self) -> CommandResult<MutexGuard<'_, ()>> {
    self.0.lock().map_err(|_| PublicCommandError::new("PROFILE_STORAGE_UNAVAILABLE"))
  }

  pub fn panel_status(&self, snapshot: RuntimeSnapshot) -> CredentialPanelStatus {
    let Ok(_guard) = self.lock() else {
      return unavailable_panel_status(snapshot);
    };
    panel_status_from_profiles(snapshot, ProfileStore::load(ProfileSlot::Staged), ProfileStore::load(ProfileSlot::Active))
  }
}

pub(crate) struct ProfileStore;

impl ProfileStore {
  pub(crate) fn save_staged(input: LiveProfileInput) -> CommandResult<StoredLiveProfile> {
    let staged_revision = Self::recoverable_revision(ProfileSlot::Staged)?;
    let active_revision = Self::recoverable_revision(ProfileSlot::Active)?;
    let revision = staged_revision.max(active_revision).saturating_add(1).max(1);
    let profile = StoredLiveProfile::from_input(input, revision)?;
    Self::save(ProfileSlot::Staged, &profile)?;
    Ok(profile)
  }

  /// A malformed or obsolete Credential Manager blob cannot be safely used
  /// for rollback, but it must not permanently lock the owner out of the
  /// credential panel. Remove only that unreadable slot; backend failures
  /// remain visible errors instead of being silently discarded.
  pub(crate) fn load_or_discard_invalid(slot: ProfileSlot) -> CommandResult<Option<StoredLiveProfile>> {
    match Self::load(slot) {
      Ok(profile) => Ok(profile),
      Err(error) if is_discardable_profile_error(&error) => {
        Self::clear(slot)?;
        Ok(None)
      }
      Err(error) => Err(error),
    }
  }

  fn recoverable_revision(slot: ProfileSlot) -> CommandResult<u64> {
    Ok(Self::load_or_discard_invalid(slot)?.map(|profile| profile.revision()).unwrap_or(0))
  }

  pub(crate) fn load(slot: ProfileSlot) -> CommandResult<Option<StoredLiveProfile>> {
    let entry = credential_entry(slot)?;
    match entry.get_secret() {
      Ok(secret) => {
        let secret = Zeroizing::new(secret);
        let profile = serde_json::from_slice::<StoredLiveProfile>(&secret)
          .map_err(|_| PublicCommandError::new("PROFILE_INVALID"))?;
        profile.validate_persisted()?;
        Ok(Some(profile))
      }
      Err(KeyringError::NoEntry) => Ok(None),
      Err(_) => Err(PublicCommandError::new("PROFILE_STORAGE_UNAVAILABLE")),
    }
  }

  pub(crate) fn save(slot: ProfileSlot, profile: &StoredLiveProfile) -> CommandResult<()> {
    profile.validate_persisted()?;
    let serialized = serde_json::to_vec(profile).map_err(|_| PublicCommandError::new("PROFILE_STORAGE_UNAVAILABLE"))?;
    let serialized = Zeroizing::new(serialized);
    if serialized.len() > MAX_PROFILE_BYTES {
      return Err(PublicCommandError::new("PROFILE_TOO_LARGE"));
    }
    credential_entry(slot)?
      .set_secret(&serialized)
      .map_err(|_| PublicCommandError::new("PROFILE_STORAGE_UNAVAILABLE"))
  }

  pub(crate) fn clear(slot: ProfileSlot) -> CommandResult<()> {
    match credential_entry(slot)?.delete_credential() {
      Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
      Err(_) => Err(PublicCommandError::new("PROFILE_STORAGE_UNAVAILABLE")),
    }
  }
}

pub(crate) fn verify_staged_profile() -> CommandResult<StoredLiveProfile> {
  let mut profile = ProfileStore::load(ProfileSlot::Staged)?
    .ok_or_else(|| PublicCommandError::new("PROFILE_NOT_SAVED"))?;
  match verify_profile(&profile) {
    Ok(()) => {
      profile.validation_state = ValidationState::Verified;
      profile.last_validated_at = Some(now_rfc3339());
      profile.public_failure_code = None;
    }
    Err(code) => {
      profile.validation_state = ValidationState::Failed;
      profile.last_validated_at = Some(now_rfc3339());
      profile.public_failure_code = Some(code.to_string());
    }
  }
  ProfileStore::save(ProfileSlot::Staged, &profile)?;
  Ok(profile)
}

pub(crate) fn sidecar_active_run_count(port: u16) -> CommandResult<u32> {
  #[derive(Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct SidecarProfile {
    active_run_count: u32,
  }

  #[derive(Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct SidecarStatus {
    profile: SidecarProfile,
  }

  let client = Client::builder()
    .connect_timeout(Duration::from_secs(2))
    .timeout(Duration::from_secs(3))
    .build()
    .map_err(|_| PublicCommandError::new("LOCAL_RUNTIME_UNAVAILABLE"))?;
  let response = client
    .get(format!("http://127.0.0.1:{port}/api/settings/runtime-status"))
    .send()
    .map_err(|_| PublicCommandError::new("LOCAL_RUNTIME_UNAVAILABLE"))?;
  if !response.status().is_success() {
    return Err(PublicCommandError::new("LOCAL_RUNTIME_UNAVAILABLE"));
  }
  response
    .json::<SidecarStatus>()
    .map(|status| status.profile.active_run_count)
    .map_err(|_| PublicCommandError::new("LOCAL_RUNTIME_UNAVAILABLE"))
}

fn credential_entry(slot: ProfileSlot) -> CommandResult<Entry> {
  Entry::new(PROFILE_SERVICE, slot.account()).map_err(|_| PublicCommandError::new("PROFILE_STORAGE_UNAVAILABLE"))
}

fn is_discardable_profile_error(error: &PublicCommandError) -> bool {
  error.code == "PROFILE_INVALID"
}

fn panel_status_from_profiles(
  snapshot: RuntimeSnapshot,
  staged: CommandResult<Option<StoredLiveProfile>>,
  active: CommandResult<Option<StoredLiveProfile>>,
) -> CredentialPanelStatus {
  let (Ok(staged), Ok(active)) = (staged, active) else {
    return unavailable_panel_status(snapshot);
  };

  let staged_present = staged.is_some();
  let active_present = active.is_some();
  let active_revision = active.as_ref().map(StoredLiveProfile::revision);
  let metadata = staged.as_ref().or(active.as_ref()).map(StoredLiveProfile::metadata);
  let staged_is_ready = staged.as_ref().is_some_and(StoredLiveProfile::is_verified);
  let restart_required = staged_is_ready && staged.as_ref().map(StoredLiveProfile::revision) != active_revision;
  let lifecycle_state = if restart_required {
    LifecycleState::RestartRequired
  } else {
    snapshot.lifecycle
  };

  let runtime = if let Some(metadata) = metadata {
    RuntimeProfileStatus {
      runtime_mode: snapshot.mode,
      search_provider: Some(metadata.search_provider),
      model_provider: Some(metadata.model_provider),
      model: Some(metadata.model),
      model_base_url: metadata.model_base_url,
      search_key_configured: true,
      model_key_configured: true,
      validation_state: metadata.validation_state,
      lifecycle_state,
      restart_required,
      active_run_count: snapshot.active_run_count,
      last_validated_at: metadata.last_validated_at,
      public_failure_code: metadata.public_failure_code,
      revision: metadata.revision,
    }
  } else {
    RuntimeProfileStatus {
      runtime_mode: snapshot.mode,
      search_provider: None,
      model_provider: None,
      model: None,
      model_base_url: None,
      search_key_configured: false,
      model_key_configured: false,
      validation_state: ValidationState::NotConfigured,
      lifecycle_state: snapshot.lifecycle,
      restart_required: false,
      active_run_count: snapshot.active_run_count,
      last_validated_at: None,
      public_failure_code: None,
      revision: 0,
    }
  };

  CredentialPanelStatus {
    runtime,
    staged_profile_present: staged_present,
    active_profile_present: active_present,
    active_revision,
    secure_storage_available: true,
  }
}

fn unavailable_panel_status(snapshot: RuntimeSnapshot) -> CredentialPanelStatus {
  CredentialPanelStatus {
    runtime: RuntimeProfileStatus {
      runtime_mode: snapshot.mode,
      search_provider: None,
      model_provider: None,
      model: None,
      model_base_url: None,
      search_key_configured: false,
      model_key_configured: false,
      validation_state: ValidationState::Failed,
      lifecycle_state: snapshot.lifecycle,
      restart_required: false,
      active_run_count: snapshot.active_run_count,
      last_validated_at: None,
      public_failure_code: Some("PROFILE_STORAGE_UNAVAILABLE"),
      revision: 0,
    },
    staged_profile_present: false,
    active_profile_present: false,
    active_revision: None,
    secure_storage_available: false,
  }
}

fn normalize_api_key(mut value: String) -> CommandResult<String> {
  let normalized = value.trim().to_owned();
  value.zeroize();
  if !valid_api_key(&normalized) {
    let mut normalized = normalized;
    normalized.zeroize();
    return Err(PublicCommandError::new("PROFILE_INVALID"));
  }
  Ok(normalized)
}

fn valid_api_key(value: &str) -> bool {
  !value.is_empty()
    && value.len() <= MAX_SECRET_BYTES
    && !value.chars().any(|character| character.is_control())
}

fn normalize_model(mut value: String) -> CommandResult<String> {
  let normalized = value.trim().to_owned();
  value.zeroize();
  if !valid_model_identifier(&normalized) {
    return Err(PublicCommandError::new("PROFILE_INVALID"));
  }
  Ok(normalized)
}

fn valid_model_identifier(value: &str) -> bool {
  !value.is_empty()
    && value.len() <= 128
    && value.chars().all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | ':' | '/' | '-'))
}

fn normalize_model_base_url(provider: ModelProvider, candidate: Option<String>) -> CommandResult<Option<String>> {
  let default = match provider {
    ModelProvider::Deepseek => DEEPSEEK_DEFAULT_BASE_URL,
    ModelProvider::Openai => OPENAI_DEFAULT_BASE_URL,
  };
  let raw = candidate.unwrap_or_else(|| default.to_owned());
  let mut parsed = Url::parse(raw.trim()).map_err(|_| PublicCommandError::new("PROFILE_INVALID"))?;
  if parsed.scheme() != "https" || parsed.username() != "" || parsed.password().is_some() || parsed.query().is_some() || parsed.fragment().is_some() {
    return Err(PublicCommandError::new("PROFILE_INVALID"));
  }

  let allowed_host = match provider {
    ModelProvider::Deepseek => "api.deepseek.com",
    ModelProvider::Openai => "api.openai.com",
  };
  if !parsed.host_str().is_some_and(|host| host.eq_ignore_ascii_case(allowed_host))
    || parsed.port_or_known_default() != Some(443)
  {
    return Err(PublicCommandError::new("PROFILE_INVALID"));
  }

  match provider {
    ModelProvider::Deepseek => {
      if !matches!(parsed.path(), "" | "/" | "/v1" | "/v1/") {
        return Err(PublicCommandError::new("PROFILE_INVALID"));
      }
      parsed.set_path(if parsed.path().starts_with("/v1") { "/v1/" } else { "/" });
      Ok(Some(parsed.to_string()))
    }
    // OpenAI's V0.1 desktop profile intentionally uses the canonical first
    // party endpoint; arbitrary custom base URLs would be a credential
    // exfiltration surface and are out of scope for this release.
    ModelProvider::Openai => {
      if !matches!(parsed.path(), "" | "/" | "/v1" | "/v1/") {
        return Err(PublicCommandError::new("PROFILE_INVALID"));
      }
      Ok(None)
    }
  }
}

fn now_rfc3339() -> String {
  OffsetDateTime::now_utc().format(&Rfc3339).expect("RFC3339 formatting is available")
}

fn verify_profile(profile: &StoredLiveProfile) -> Result<(), &'static str> {
  let client = Client::builder()
    .connect_timeout(Duration::from_secs(5))
    .timeout(VERIFICATION_TIMEOUT)
    .build()
    .map_err(|_| "NETWORK_UNAVAILABLE")?;
  verify_model_provider(profile, &client)?;
  verify_search_provider(profile, &client)
}

fn verify_model_provider(profile: &StoredLiveProfile, client: &Client) -> Result<(), &'static str> {
  let url = match profile.model_provider {
    ModelProvider::Deepseek => profile.model_base_url.as_deref().unwrap_or(DEEPSEEK_DEFAULT_BASE_URL),
    ModelProvider::Openai => OPENAI_DEFAULT_BASE_URL,
  };
  let url = Url::parse(url)
    .and_then(|base| base.join("models"))
    .map_err(|_| "PROFILE_INVALID")?;
  classify_provider_response(client.get(url).bearer_auth(&profile.model_api_key).send())
}

fn verify_search_provider(profile: &StoredLiveProfile, client: &Client) -> Result<(), &'static str> {
  match profile.search_provider {
    SearchProvider::Tavily => {
      #[derive(Serialize)]
      struct TavilyProbe<'a> {
        api_key: &'a str,
        query: &'static str,
        max_results: u8,
        search_depth: &'static str,
      }
      let body = TavilyProbe {
        api_key: &profile.search_api_key,
    query: "Siftory API configuration verification",
        max_results: 1,
        search_depth: "basic",
      };
      classify_provider_response(client.post(TAVILY_VERIFICATION_URL).json(&body).send())
    }
    SearchProvider::Brave => classify_provider_response(
      client
        .get(BRAVE_VERIFICATION_URL)
    .query(&[("q", "Siftory API configuration verification"), ("count", "1")])
        .header("X-Subscription-Token", &profile.search_api_key)
        .send(),
    ),
  }
}

fn classify_provider_response(response: Result<reqwest::blocking::Response, reqwest::Error>) -> Result<(), &'static str> {
  match response {
    Ok(response) if response.status().is_success() => Ok(()),
    Ok(response) if matches!(response.status(), StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN) => Err("AUTHENTICATION_FAILED"),
    Ok(response) if response.status() == StatusCode::TOO_MANY_REQUESTS => Err("RATE_LIMITED"),
    Ok(_) => Err("PROVIDER_UNAVAILABLE"),
    Err(error) if error.is_timeout() || error.is_connect() => Err("NETWORK_UNAVAILABLE"),
    Err(_) => Err("PROVIDER_UNAVAILABLE"),
  }
}

fn validation_state_name(state: ValidationState) -> &'static str {
  match state {
    ValidationState::NotConfigured => "NOT_CONFIGURED",
    ValidationState::SavedUnverified => "SAVED_UNVERIFIED",
    ValidationState::Testing => "TESTING",
    ValidationState::Verified => "VERIFIED",
    ValidationState::Failed => "FAILED",
  }
}

fn known_failure_code(code: &str) -> Option<&'static str> {
  match code {
    "PROFILE_INVALID" => Some("PROFILE_INVALID"),
    "NETWORK_UNAVAILABLE" => Some("NETWORK_UNAVAILABLE"),
    "AUTHENTICATION_FAILED" => Some("AUTHENTICATION_FAILED"),
    "RATE_LIMITED" => Some("RATE_LIMITED"),
    "PROVIDER_UNAVAILABLE" => Some("PROVIDER_UNAVAILABLE"),
    _ => None,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn valid_input() -> LiveProfileInput {
    LiveProfileInput {
      search_provider: SearchProvider::Tavily,
      model_provider: ModelProvider::Deepseek,
      model: "deepseek-chat".to_owned(),
      model_base_url: Some("https://api.deepseek.com/v1".to_owned()),
      search_api_key: "search-sentinel-not-for-output".to_owned(),
      model_api_key: "model-sentinel-not-for-output".to_owned(),
    }
  }

  #[test]
  fn profile_status_never_serializes_credentials() {
    let profile = StoredLiveProfile::from_input(valid_input(), 1).expect("profile");
    let metadata = profile.metadata();
    let status = RuntimeProfileStatus {
      runtime_mode: RuntimeMode::Replay,
      search_provider: Some(metadata.search_provider),
      model_provider: Some(metadata.model_provider),
      model: Some(metadata.model),
      model_base_url: metadata.model_base_url,
      search_key_configured: true,
      model_key_configured: true,
      validation_state: metadata.validation_state,
      lifecycle_state: LifecycleState::ReplayFallback,
      restart_required: false,
      active_run_count: 0,
      last_validated_at: metadata.last_validated_at,
      public_failure_code: metadata.public_failure_code,
      revision: metadata.revision,
    };
    let rendered = serde_json::to_string(&status).expect("status json");
    assert!(!rendered.contains("search-sentinel-not-for-output"));
    assert!(!rendered.contains("model-sentinel-not-for-output"));
    assert!(!rendered.contains("apiKey"));
  }

  #[test]
  fn profile_rejects_untrusted_model_base_url() {
    let mut input = valid_input();
    input.model_base_url = Some("https://example.invalid/v1".to_owned());
    let result = StoredLiveProfile::from_input(input, 1);
    assert!(matches!(result, Err(PublicCommandError { code: "PROFILE_INVALID" })));
  }

  #[test]
  fn profile_rejects_control_characters_in_credentials() {
    let mut input = valid_input();
    input.search_api_key = "key\nnot-an-environment-value".to_owned();
    let result = StoredLiveProfile::from_input(input, 1);
    assert!(matches!(result, Err(PublicCommandError { code: "PROFILE_INVALID" })));
  }

  #[test]
  fn only_invalid_profiles_are_discardable_for_recovery() {
    assert!(is_discardable_profile_error(&PublicCommandError::new("PROFILE_INVALID")));
    assert!(!is_discardable_profile_error(&PublicCommandError::new("PROFILE_STORAGE_UNAVAILABLE")));
  }

  #[test]
  #[ignore = "requires an explicit Windows Credential Manager round-trip; creates and removes a dedicated smoke entry"]
  fn windows_credential_manager_smoke_round_trips_and_cleans_up() {
    let service = format!("com.searchos.desktop.smoke.{}", std::process::id());
    let account = "credential-manager-round-trip";
    let expected = b"searchos-credential-store-smoke";
    let entry = Entry::new(&service, account).map_err(|_| ()).expect("create dedicated Credential Manager entry");
    let _ = entry.delete_credential();

    let outcome = (|| -> Result<(), String> {
      entry
        .set_secret(expected)
        .map_err(|error| format!("set_secret failed: {error}"))?;
      let recovered = Zeroizing::new(
        entry
          .get_secret()
          .map_err(|error| format!("get_secret failed: {error}"))?,
      );
      if recovered.as_slice() != expected {
        return Err("retrieved test marker did not match".to_owned());
      }
      Ok(())
    })();

    let cleanup = entry
      .delete_credential()
      .map_err(|error| format!("delete_credential failed: {error}"));
    assert!(outcome.is_ok(), "Credential Manager could not complete a private round-trip: {}", outcome.unwrap_err());
    assert!(cleanup.is_ok(), "Credential Manager smoke entry could not be removed: {}", cleanup.unwrap_err());
  }
}

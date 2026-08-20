mod secure_profile;

use std::{
  fs::{self, OpenOptions},
  io::{self, ErrorKind, Read, Write},
  net::{SocketAddr, TcpListener, TcpStream},
  path::PathBuf,
  process::{Child, Command, Stdio},
  sync::Mutex,
  thread,
  time::Duration,
};

use secure_profile::{
  sidecar_active_run_count, verify_staged_profile, ClearScope, CommandResult, CredentialPanelStatus,
  LifecycleState, ProfileSlot, ProfileStore, PublicCommandError, RuntimeMode, RuntimeSnapshot,
  SecureRuntimeProfiles, StoredLiveProfile,
};
use tauri::{
  path::BaseDirectory,
  Manager, RunEvent, State, WebviewUrl, WebviewWindowBuilder,
};

const CREDENTIALS_WINDOW_LABEL: &str = "credentials";
// The sidecar is launched with an empty environment, then receives only the
// Windows process variables Node needs to run locally. Never widen this list
// with service credentials, proxy settings, database URLs, or generic parent
// environment pass-through.
const SIDECAR_ENV_ALLOWLIST: &[&str] = &[
  "SystemRoot",
  "WINDIR",
  "TEMP",
  "TMP",
  "LOCALAPPDATA",
  "APPDATA",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "ComSpec",
  "PATHEXT",
  "Path",
];

struct RunningRuntime {
  port: u16,
  child: Child,
  mode: RuntimeMode,
}

struct RuntimeSlot {
  process: Option<RunningRuntime>,
  lifecycle: LifecycleState,
}

struct LocalRuntime(Mutex<RuntimeSlot>);

impl LocalRuntime {
  fn new() -> Self {
    Self(Mutex::new(RuntimeSlot {
      process: None,
      lifecycle: LifecycleState::ReplayFallback,
    }))
  }
}

fn normalize_runtime_path(path: PathBuf) -> PathBuf {
  #[cfg(windows)]
  {
    let rendered = path.to_string_lossy();
    if let Some(without_verbatim_prefix) = rendered.strip_prefix("\\\\?\\") {
      return PathBuf::from(without_verbatim_prefix);
    }
  }
  path
}

fn allocate_loopback_port() -> io::Result<u16> {
  let listener = TcpListener::bind(("127.0.0.1", 0))?;
  let port = listener.local_addr()?.port();
  drop(listener);
  Ok(port)
}

fn server_responded(port: u16) -> bool {
  let address = SocketAddr::from(([127, 0, 0, 1], port));
  let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(120)) else {
    return false;
  };
  let _ = stream.set_read_timeout(Some(Duration::from_millis(180)));
  let _ = stream.write_all(b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
  let mut response = [0_u8; 32];
  matches!(stream.read(&mut response), Ok(size) if size > 0 && response.starts_with(b"HTTP/1.1"))
}

fn wait_for_server(port: u16) -> io::Result<()> {
  for _ in 0..70 {
    if server_responded(port) {
      return Ok(());
    }
    thread::sleep(Duration::from_millis(120));
  }
  Err(io::Error::new(ErrorKind::TimedOut, "Siftory local runtime did not become ready"))
}

fn resource_path(app: &tauri::AppHandle, relative: &str) -> tauri::Result<PathBuf> {
  Ok(normalize_runtime_path(app.path().resolve(relative, BaseDirectory::Resource)?))
}

/// Only lifecycle records are written to disk. The Node sidecar's stdout and
/// stderr are intentionally discarded so provider failures cannot accidentally
/// persist request headers or request bodies containing a credential.
fn append_runtime_lifecycle_log(app: &tauri::AppHandle, message: &str) {
  let Ok(app_data_dir) = app.path().app_local_data_dir() else {
    return;
  };
  if fs::create_dir_all(&app_data_dir).is_err() {
    return;
  }
  let Ok(mut runtime_log) = OpenOptions::new()
    .create(true)
    .append(true)
    .open(app_data_dir.join("desktop-runtime.log"))
  else {
    return;
  };
  let _ = writeln!(runtime_log, "{message}");
}

fn establish_sidecar_environment(command: &mut Command) {
  // `Command` inherits every parent variable by default. A blocklist of known
  // provider variables misses unrelated secrets such as CI, cloud, proxy, or
  // database credentials, so start empty and copy a small OS-only allowlist.
  command.env_clear();
  for variable in SIDECAR_ENV_ALLOWLIST {
    if let Some(value) = std::env::var_os(variable) {
      command.env(variable, value);
    }
  }
}

fn start_local_runtime(app: &tauri::AppHandle, profile: Option<StoredLiveProfile>) -> tauri::Result<RunningRuntime> {
  let port = allocate_loopback_port()?;
  let node = resource_path(app, "runtime/node.exe")?;
  let server = resource_path(app, "runtime/app/apps/web/server.js")?;
  let migrations = resource_path(app, "runtime/migrations")?;
  let app_data_dir = app.path().app_local_data_dir()?;
  let database_dir = app_data_dir.join("pglite");
  fs::create_dir_all(&database_dir).map_err(|error| {
    io::Error::new(error.kind(), "Unable to create Siftory local data directory")
  })?;

  let mode = if profile.is_some() { RuntimeMode::Live } else { RuntimeMode::Replay };
  let server_dir = server.parent().ok_or_else(|| io::Error::new(ErrorKind::NotFound, "Siftory server directory is missing"))?;
  let mut command = Command::new(&node);
  establish_sidecar_environment(&mut command);
  command
    .arg(&server)
    .current_dir(server_dir)
    .env("HOSTNAME", "127.0.0.1")
    .env("PORT", port.to_string())
    .env("SEARCHOS_RUNTIME_MODE", if mode == RuntimeMode::Live { "live" } else { "replay" })
    .env("SEARCHOS_PGLITE_DATA_DIR", &database_dir)
    .env("SEARCHOS_MIGRATIONS_DIR", &migrations)
    .env("SEARCHOS_DESKTOP", "1")
    .env("SEARCHOS_DESKTOP_PROFILE_CONFIGURED", if profile.is_some() { "1" } else { "0" })
    .stdout(Stdio::null())
    .stderr(Stdio::null());

  if let Some(profile) = profile.as_ref() {
    profile.apply_to_sidecar(&mut command);
  }

  let mut child = command
    .spawn()
    .map_err(|error| io::Error::new(error.kind(), "Unable to start the bundled Siftory local runtime"))?;

  if let Err(error) = wait_for_server(port) {
    let _ = child.kill();
    let _ = child.wait();
    return Err(error.into());
  }

  append_runtime_lifecycle_log(app, match mode {
    RuntimeMode::Live => "Siftory desktop runtime started in Live mode.",
    RuntimeMode::Replay => "Siftory desktop runtime started in Replay mode.",
  });
  Ok(RunningRuntime { port, child, mode })
}

fn stop_running_runtime(mut running: RunningRuntime) {
  let _ = running.child.kill();
  let _ = running.child.wait();
}

fn stop_local_runtime(app: &tauri::AppHandle) {
  let Some(state) = app.try_state::<LocalRuntime>() else {
    return;
  };
  if let Ok(mut slot) = state.0.lock() {
    if let Some(running) = slot.process.take() {
      stop_running_runtime(running);
    }
  };
}

fn workspace_suffix(app: &tauri::AppHandle) -> String {
  let Some(window) = app.get_webview_window("main") else {
    return "/".to_owned();
  };
  let Ok(current) = window.url() else {
    return "/".to_owned();
  };
  if current.host_str() != Some("127.0.0.1") {
    return "/".to_owned();
  }
  let mut suffix = current.path().to_owned();
  if suffix.is_empty() {
    suffix.push('/');
  }
  if let Some(query) = current.query() {
    suffix.push('?');
    suffix.push_str(query);
  }
  suffix
}

fn local_workspace_url(port: u16, suffix: &str) -> tauri::Result<url::Url> {
  url::Url::parse(&format!("http://127.0.0.1:{port}{suffix}"))
    .map_err(|error| io::Error::new(ErrorKind::InvalidInput, error).into())
}

fn open_main_window(app: &tauri::AppHandle, port: u16) -> tauri::Result<()> {
  let url = local_workspace_url(port, "/")?;
  WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
    .title("Siftory")
    .inner_size(1440.0, 920.0)
    .min_inner_size(1040.0, 680.0)
    .center()
    .build()?;
  Ok(())
}

fn navigate_main_window(app: &tauri::AppHandle, port: u16, suffix: &str) -> tauri::Result<()> {
  let window = app.get_webview_window("main")
    .ok_or_else(|| io::Error::new(ErrorKind::NotFound, "Siftory workspace window is missing"))?;
  window.navigate(local_workspace_url(port, suffix)?)
}

fn runtime_snapshot(runtime: &LocalRuntime) -> RuntimeSnapshot {
  let Ok(slot) = runtime.0.lock() else {
    return RuntimeSnapshot {
      mode: RuntimeMode::Replay,
      lifecycle: LifecycleState::ReplayFallback,
      active_run_count: 0,
    };
  };
  if let Some(running) = slot.process.as_ref() {
    RuntimeSnapshot {
      mode: running.mode,
      lifecycle: slot.lifecycle,
      active_run_count: 0,
    }
  } else {
    RuntimeSnapshot {
      mode: RuntimeMode::Replay,
      lifecycle: slot.lifecycle,
      active_run_count: 0,
    }
  }
}

fn running_port(runtime: &LocalRuntime) -> CommandResult<u16> {
  let slot = runtime.0.lock().map_err(|_| PublicCommandError::new("LOCAL_RUNTIME_UNAVAILABLE"))?;
  slot.process.as_ref().map(|running| running.port).ok_or_else(|| PublicCommandError::new("LOCAL_RUNTIME_UNAVAILABLE"))
}

fn checked_active_run_count(runtime: &LocalRuntime) -> CommandResult<u32> {
  sidecar_active_run_count(running_port(runtime)?)
}

/// Stops the old sidecar, launches the candidate, health-checks it and only
/// then navigates the workspace to the new loopback port. Its caller owns the
/// credential-store transaction and performs the old-profile rollback if this
/// function fails.
fn restart_local_runtime(
  app: &tauri::AppHandle,
  runtime: &LocalRuntime,
  profile: Option<StoredLiveProfile>,
) -> CommandResult<()> {
  let suffix = workspace_suffix(app);
  let mut slot = runtime.0.lock().map_err(|_| PublicCommandError::new("RUNTIME_RESTART_FAILED"))?;
  if let Some(running) = slot.process.take() {
    stop_running_runtime(running);
  }
  slot.lifecycle = LifecycleState::Restarting;

  let mut candidate = match start_local_runtime(app, profile) {
    Ok(candidate) => candidate,
    Err(_) => {
      slot.lifecycle = LifecycleState::Rollback;
      append_runtime_lifecycle_log(app, "Siftory desktop runtime candidate failed its health check.");
      return Err(PublicCommandError::new("RUNTIME_RESTART_FAILED"));
    }
  };

  if navigate_main_window(app, candidate.port, &suffix).is_err() {
    let _ = candidate.child.kill();
    let _ = candidate.child.wait();
    slot.lifecycle = LifecycleState::Rollback;
    append_runtime_lifecycle_log(app, "Siftory desktop runtime navigation failed; candidate was stopped.");
    return Err(PublicCommandError::new("RUNTIME_RESTART_FAILED"));
  }

  slot.lifecycle = if candidate.mode == RuntimeMode::Live {
    LifecycleState::Active
  } else {
    LifecycleState::ReplayFallback
  };
  slot.process = Some(candidate);
  append_runtime_lifecycle_log(app, "Siftory desktop runtime restart completed.");
  Ok(())
}

fn panel_status(profiles: &SecureRuntimeProfiles, runtime: &LocalRuntime) -> CredentialPanelStatus {
  let mut snapshot = runtime_snapshot(runtime);
  if let Ok(active_run_count) = checked_active_run_count(runtime) {
    snapshot.active_run_count = active_run_count;
  }
  profiles.panel_status(snapshot)
}

#[tauri::command]
fn get_live_profile_status(
  profiles: State<'_, SecureRuntimeProfiles>,
  runtime: State<'_, LocalRuntime>,
) -> CredentialPanelStatus {
  panel_status(&profiles, &runtime)
}

#[tauri::command]
fn save_live_profile(
  profile: secure_profile::LiveProfileInput,
  profiles: State<'_, SecureRuntimeProfiles>,
  runtime: State<'_, LocalRuntime>,
) -> CommandResult<CredentialPanelStatus> {
  {
    let _guard = profiles.lock()?;
    let _ = ProfileStore::save_staged(profile)?;
  }
  Ok(panel_status(&profiles, &runtime))
}

#[tauri::command]
fn test_live_profile(
  profiles: State<'_, SecureRuntimeProfiles>,
  runtime: State<'_, LocalRuntime>,
) -> CommandResult<CredentialPanelStatus> {
  {
    let _guard = profiles.lock()?;
    let _ = verify_staged_profile()?;
  }
  Ok(panel_status(&profiles, &runtime))
}

#[tauri::command]
fn activate_live_profile(
  app: tauri::AppHandle,
  profiles: State<'_, SecureRuntimeProfiles>,
  runtime: State<'_, LocalRuntime>,
) -> CommandResult<CredentialPanelStatus> {
  let active_run_count = checked_active_run_count(&runtime)?;
  if active_run_count > 0 {
    return Err(PublicCommandError::new("ACTIVE_SEARCH_IN_PROGRESS"));
  }

  {
    let _guard = profiles.lock()?;
    let staged = ProfileStore::load(ProfileSlot::Staged)?
      .ok_or_else(|| PublicCommandError::new("PROFILE_NOT_SAVED"))?;
    if !staged.is_verified() {
      return Err(PublicCommandError::new("PROFILE_NOT_VERIFIED"));
    }
    let previous_active = ProfileStore::load_or_discard_invalid(ProfileSlot::Active)?;

    // Promote first, then restart. If anything fails below, restore both the
    // secure-store entry and the previous sidecar before returning an error.
    ProfileStore::save(ProfileSlot::Active, &staged)?;
    if restart_local_runtime(&app, &runtime, Some(staged)).is_err() {
      let storage_restored = match previous_active.as_ref() {
        Some(profile) => ProfileStore::save(ProfileSlot::Active, profile).is_ok(),
        None => ProfileStore::clear(ProfileSlot::Active).is_ok(),
      };
      let runtime_restored = restart_local_runtime(&app, &runtime, previous_active).is_ok();
      append_runtime_lifecycle_log(
        &app,
        if storage_restored && runtime_restored {
          "Siftory Live profile restart failed and the previous runtime was restored."
        } else {
          "Siftory Live profile restart failed; automatic rollback was incomplete."
        },
      );
      return Err(PublicCommandError::new("RUNTIME_RESTART_FAILED"));
    }
  }

  Ok(panel_status(&profiles, &runtime))
}

#[tauri::command]
fn clear_live_profile(
  scope: ClearScope,
  app: tauri::AppHandle,
  profiles: State<'_, SecureRuntimeProfiles>,
  runtime: State<'_, LocalRuntime>,
) -> CommandResult<CredentialPanelStatus> {
  if matches!(scope, ClearScope::Active | ClearScope::All) {
    let active_run_count = checked_active_run_count(&runtime)?;
    if active_run_count > 0 {
      return Err(PublicCommandError::new("ACTIVE_SEARCH_IN_PROGRESS"));
    }
  }

  {
    let _guard = profiles.lock()?;
    match scope {
      ClearScope::Staged => ProfileStore::clear(ProfileSlot::Staged)?,
      ClearScope::Active | ClearScope::All => {
        let previous_active = ProfileStore::load_or_discard_invalid(ProfileSlot::Active)?;
        let previous_staged = if matches!(scope, ClearScope::All) {
          ProfileStore::load_or_discard_invalid(ProfileSlot::Staged)?
        } else {
          None
        };
        ProfileStore::clear(ProfileSlot::Active)?;
        if matches!(scope, ClearScope::All) {
          ProfileStore::clear(ProfileSlot::Staged)?;
        }

        if restart_local_runtime(&app, &runtime, None).is_err() {
          if let Some(profile) = previous_active.as_ref() {
            let _ = ProfileStore::save(ProfileSlot::Active, profile);
          }
          if let Some(profile) = previous_staged.as_ref() {
            let _ = ProfileStore::save(ProfileSlot::Staged, profile);
          }
          let _ = restart_local_runtime(&app, &runtime, previous_active);
          append_runtime_lifecycle_log(&app, "Siftory credential clearing failed; previous runtime rollback was attempted.");
          return Err(PublicCommandError::new("RUNTIME_RESTART_FAILED"));
        }
      }
    }
  }

  Ok(panel_status(&profiles, &runtime))
}

/// This is intentionally the only credential-adjacent command available to
/// the loopback workspace. It has no input and returns no profile data or
/// credential material; it merely focuses the separately sandboxed panel.
///
/// Window construction must never happen inline in a synchronous invoke
/// handler. On Windows, an external WebView invoke can arrive on the native
/// event-loop path while `WebviewWindowBuilder::build` waits for that same
/// event loop, freezing the main workspace. Run the blocking construction on
/// Tauri's dedicated blocking pool instead: the builder can then dispatch to
/// the event loop while the invoke itself remains asynchronous and responsive.
#[tauri::command]
async fn open_credentials_panel(app: tauri::AppHandle) -> CommandResult<()> {
  tauri::async_runtime::spawn_blocking(move || {
    open_credentials_window(&app)
      .map_err(|_| PublicCommandError::new("CREDENTIALS_PANEL_UNAVAILABLE"))
  })
  .await
  .map_err(|_| PublicCommandError::new("CREDENTIALS_PANEL_UNAVAILABLE"))?
}

fn open_credentials_window(app: &tauri::AppHandle) -> tauri::Result<()> {
  if let Some(window) = app.get_webview_window(CREDENTIALS_WINDOW_LABEL) {
    window.show()?;
    window.set_focus()?;
    return Ok(());
  }
  WebviewWindowBuilder::new(app, CREDENTIALS_WINDOW_LABEL, WebviewUrl::App("credentials.html".into()))
    .title("Siftory — API Credentials")
    .inner_size(780.0, 760.0)
    .min_inner_size(640.0, 640.0)
    .resizable(true)
    .devtools(false)
    .content_protected(true)
    .center()
    .build()?;
  Ok(())
}

fn initial_active_profile(app: &tauri::AppHandle) -> Option<StoredLiveProfile> {
  let profiles = app.state::<SecureRuntimeProfiles>();
  let Ok(_guard) = profiles.lock() else {
    return None;
  };
  ProfileStore::load(ProfileSlot::Active)
    .ok()
    .flatten()
    .filter(StoredLiveProfile::is_verified)
}

fn main() {
  tauri::Builder::default()
    .manage(LocalRuntime::new())
    .manage(SecureRuntimeProfiles::new())
    .invoke_handler(tauri::generate_handler![
      get_live_profile_status,
      save_live_profile,
      test_live_profile,
      activate_live_profile,
      clear_live_profile,
      open_credentials_panel,
    ])
    .setup(|app| {
      let app_handle = app.handle().clone();
      let running = start_local_runtime(&app_handle, initial_active_profile(&app_handle))?;
      if std::env::var_os("SEARCHOS_DESKTOP_SMOKE").is_some() {
        stop_running_runtime(running);
        app_handle.exit(0);
        return Ok(());
      }
      let initial_port = running.port;
      {
        let runtime = app.state::<LocalRuntime>();
        let mut slot = runtime.0.lock().expect("desktop runtime state lock");
        slot.lifecycle = if running.mode == RuntimeMode::Live {
          LifecycleState::Active
        } else {
          LifecycleState::ReplayFallback
        };
        slot.process = Some(running);
      }
      open_main_window(&app_handle, initial_port)?;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building Siftory desktop application")
    .run(|app, event| {
      if matches!(event, RunEvent::ExitRequested { .. }) {
        stop_local_runtime(app);
      }
    });
}

#[cfg(test)]
mod sidecar_environment_tests {
  use super::SIDECAR_ENV_ALLOWLIST;

  #[test]
  fn sidecar_allowlist_cannot_inherit_service_secrets() {
    for secret_name in [
      "TAVILY_API_KEY",
      "BRAVE_SEARCH_API_KEY",
      "DEEPSEEK_API_KEY",
      "OPENAI_API_KEY",
      "DATABASE_URL",
      "GITHUB_TOKEN",
      "AWS_SECRET_ACCESS_KEY",
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "NODE_OPTIONS",
    ] {
      assert!(
        !SIDECAR_ENV_ALLOWLIST.contains(&secret_name),
        "secret-like variable unexpectedly inherited: {secret_name}"
      );
    }
  }
}

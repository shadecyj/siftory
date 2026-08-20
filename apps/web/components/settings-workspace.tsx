"use client";

import {
  RuntimeProfileStatusResponseSchema,
  type RuntimeProfileStatus,
  type RuntimeProfileStatusResponse,
  type RuntimeValidationState,
  type RuntimeLifecycleState
} from "@searchos/contracts";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { invokeCredentialPanel } from "../lib/credential-panel";
import { type Locale } from "../lib/i18n/locale";
import { useLocale } from "../lib/i18n/locale-provider";
import { type MessageKey } from "../lib/i18n/translate";
import styles from "./settings-workspace.module.css";

type LoadState = "loading" | "ready" | "failed";
type CopyState = "idle" | "copied" | "failed";
type CredentialPanelState = "idle" | "opening" | "opened" | "failed";

type TauriBridge = {
  core?: {
    invoke?: (command: string) => Promise<unknown>;
  };
};

const environmentTemplate = [
  "SEARCHOS_RUNTIME_MODE=live",
  "SEARCH_PROVIDER=tavily",
  "TAVILY_API_KEY=",
  "MODEL_PROVIDER=deepseek",
  "DEEPSEEK_API_KEY=",
  "DEEPSEEK_MODEL=deepseek-chat"
].join("\n");

const validationKeys: Record<RuntimeValidationState, MessageKey> = {
  NOT_CONFIGURED: "settings.status.notConfigured",
  SAVED_UNVERIFIED: "settings.status.savedUnverified",
  TESTING: "settings.status.testing",
  VERIFIED: "settings.status.verified",
  FAILED: "settings.status.failed"
};

const lifecycleKeys: Record<RuntimeLifecycleState, MessageKey> = {
  ACTIVE: "settings.status.active",
  RESTART_REQUIRED: "settings.status.restartRequired",
  RESTARTING: "settings.status.restarting",
  ROLLBACK: "settings.status.rollback",
  REPLAY_FALLBACK: "settings.status.replayFallback"
};

export function SettingsWorkspace() {
  const { locale, setLocale, t, formatDateTime } = useLocale();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [status, setStatus] = useState<RuntimeProfileStatus | null>(null);
  const [configurationSurface, setConfigurationSurface] = useState<RuntimeProfileStatusResponse["configurationSurface"] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [credentialPanelState, setCredentialPanelState] = useState<CredentialPanelState>("idle");

  useEffect(() => {
    const controller = new AbortController();
    setLoadState("loading");
    void fetch("/api/settings/runtime-status", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error("RUNTIME_STATUS_UNAVAILABLE");
        const parsed = RuntimeProfileStatusResponseSchema.safeParse(payload);
        if (!parsed.success) throw new Error("RUNTIME_STATUS_INVALID");
        if (!controller.signal.aborted) {
          setStatus(parsed.data.profile);
          setConfigurationSurface(parsed.data.configurationSurface);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus(null);
          setConfigurationSurface(null);
          setLoadState("failed");
        }
      });
    return () => controller.abort();
  }, [reloadKey]);

  const missingRequirements = useMemo(() => {
    if (!status) return [];
    const missing: MessageKey[] = [];
    if (!status.searchProvider) missing.push("settings.missing.searchProvider");
    if (!status.searchKeyConfigured) missing.push("settings.missing.searchKey");
    if (!status.modelProvider) missing.push("settings.missing.modelProvider");
    if (!status.modelKeyConfigured) missing.push("settings.missing.modelKey");
    if (!status.model) missing.push("settings.missing.model");
    return missing;
  }, [status]);

  async function copyEnvironmentTemplate() {
    try {
      await navigator.clipboard.writeText(environmentTemplate);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  async function openCredentialPanel() {
    setCredentialPanelState("opening");
    try {
      const nativeBridge = (window as typeof window & { __TAURI__?: TauriBridge }).__TAURI__;
      if (typeof nativeBridge?.core?.invoke !== "function") throw new Error("NATIVE_PANEL_UNAVAILABLE");
      await invokeCredentialPanel(() => nativeBridge.core!.invoke!("open_credentials_panel"));
      setCredentialPanelState("opened");
    } catch {
      setCredentialPanelState("failed");
    }
  }

  return (
    <section className={styles.workspace} aria-labelledby="settings-title">
      <header className={`${styles.header} page-toolbar`}>
        <div>
          <p className="eyebrow">{t("settings.eyebrow")}</p>
          <h1 className="page-title" id="settings-title">{t("settings.title")}</h1>
          <p className={styles.description}>{t("settings.description")}</p>
        </div>
        <div className={styles.headerControls}>
          <EnvironmentState status={status} configurationSurface={configurationSurface} loadState={loadState} />
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.primaryColumn}>
          <SettingsSection
            eyebrow={t("settings.appearance.eyebrow")}
            title={t("settings.appearance.title")}
            description={t("settings.appearance.description")}
          >
            <div className={styles.preferenceGrid}>
              <div>
                <label className={styles.fieldLabel} htmlFor="settings-language">{t("settings.language.label")}</label>
                <p className={styles.fieldHelp}>{t("settings.language.help")}</p>
              </div>
              <select
                className={styles.select}
                id="settings-language"
                value={locale}
                onChange={(event) => { void setLocale(event.target.value as Locale); }}
              >
                <option value="zh-CN">{t("settings.language.zhCN")}</option>
                <option value="en-US">{t("settings.language.enUS")}</option>
              </select>
            </div>
            <div className={styles.themeNote}>
              <span className="status-dot" aria-hidden="true" />
              <span>{t("settings.appearance.themeHint")}</span>
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow={t("settings.runtime.eyebrow")}
            title={t("settings.runtime.title")}
            description={t("settings.runtime.description")}
          >
            {loadState === "loading" ? <LoadingRows count={3} /> : loadState === "failed" ? (
              <StatusFailure onRetry={() => setReloadKey((value) => value + 1)} />
            ) : status ? (
              <>
                <div className={styles.runtimeSummary}>
                  <div>
                    <span className={styles.metricLabel}>{t("settings.runtime.mode")}</span>
                    <strong>{status.runtimeMode === "live" ? t("settings.runtime.live") : t("settings.runtime.replay")}</strong>
                  </div>
                  <StatusPill state={status.lifecycleState} label={t(lifecycleKeys[status.lifecycleState])} />
                  <StatusPill state={status.validationState} label={t(validationKeys[status.validationState])} />
                </div>
                <div className={styles.environmentNotice} role="note">
                  <span className={styles.noticeMark} aria-hidden="true">i</span>
                  <div>
                    <strong>{configurationSurface === "desktop" ? t("settings.environment.desktopManaged") : t("settings.environment.managedTitle")}</strong>
                    <p>{configurationSurface === "desktop" ? t("settings.environment.desktopSurfaceGuidance") : t("settings.environment.sourceRunGuidance")}</p>
                  </div>
                </div>
                {configurationSurface === "desktop" ? (
                  <CredentialPanelAction state={credentialPanelState} onOpen={openCredentialPanel} />
                ) : null}
                {status.activeRunCount > 0 ? (
                  <p className={styles.activeRunNotice}>{t("settings.runtime.activeRuns", { count: status.activeRunCount })}</p>
                ) : null}
              </>
            ) : null}
          </SettingsSection>

          <SettingsSection
            eyebrow={t("settings.searchProvider.eyebrow")}
            title={t("settings.searchProvider.title")}
            description={t("settings.searchProvider.description")}
          >
            {loadState === "loading" ? <LoadingRows count={2} /> : loadState === "failed" ? (
              <StatusFailure onRetry={() => setReloadKey((value) => value + 1)} />
            ) : status ? (
              <ProviderDetails
                provider={status.searchProvider}
                credentialConfigured={status.searchKeyConfigured}
                providerLabel={t("settings.searchProvider.provider")}
                credentialLabel={t("settings.searchProvider.credential")}
                t={t}
              />
            ) : null}
          </SettingsSection>

          <SettingsSection
            eyebrow={t("settings.modelProvider.eyebrow")}
            title={t("settings.modelProvider.title")}
            description={t("settings.modelProvider.description")}
          >
            {loadState === "loading" ? <LoadingRows count={3} /> : loadState === "failed" ? (
              <StatusFailure onRetry={() => setReloadKey((value) => value + 1)} />
            ) : status ? (
              <div className={styles.readonlyList}>
                <ReadonlyField label={t("settings.modelProvider.provider")} value={providerName(status.modelProvider, t)} />
                <ReadonlyField label={t("settings.modelProvider.model")} value={status.model ?? t("settings.value.notConfigured")} mono />
                <ReadonlyField label={t("settings.modelProvider.baseUrl")} value={status.modelBaseUrl ?? t("settings.value.providerDefault")} mono />
                <ReadonlyField
                  label={t("settings.modelProvider.credential")}
                  value={status.modelKeyConfigured ? t("settings.value.configured") : t("settings.value.notConfigured")}
                  state={status.modelKeyConfigured ? "positive" : "caution"}
                />
              </div>
            ) : null}
          </SettingsSection>

          <SettingsSection
            eyebrow={t("settings.security.eyebrow")}
            title={t("settings.security.title")}
            description={t("settings.security.description")}
          >
            <div className={styles.securityGrid}>
              <div className={styles.securityItem}>
                <span className={styles.securityIndex}>01</span>
                <div><strong>{t("settings.security.webBoundaryTitle")}</strong><p>{t("settings.security.webBoundaryCopy")}</p></div>
              </div>
              <div className={styles.securityItem}>
                <span className={styles.securityIndex}>02</span>
                <div><strong>{t("settings.security.desktopBoundaryTitle")}</strong><p>{t("settings.security.desktopBoundaryCopy")}</p></div>
              </div>
              <div className={styles.securityItem}>
                <span className={styles.securityIndex}>03</span>
                <div><strong>{t("settings.security.dataTitle")}</strong><p>{t("settings.security.dataCopy")}</p></div>
              </div>
            </div>
            <div className={styles.connectionNotice} role="note">
              <span className={styles.noticeMark} aria-hidden="true">!</span>
              <div><strong>{t("settings.security.connectionTestsTitle")}</strong><p>{t("settings.security.connectionTestsCopy")}</p></div>
            </div>
          </SettingsSection>
        </div>

        <aside className={styles.inspector} aria-label={t("settings.inspector.label")}>
          <div className={styles.inspectorHeader}>
            <span>{t("settings.inspector.title")}</span>
            <span className={styles.inspectorMeta}>{configurationSurface === "desktop" ? "DESKTOP" : "WEB"}</span>
          </div>
          {configurationSurface === "desktop" ? (
            <div className={styles.inspectorBody}>
              <p className={styles.inspectorKicker}>{t("settings.environment.desktopKicker")}</p>
              <h2>{t("settings.environment.desktopTitle")}</h2>
              <p>{t("settings.environment.desktopGuidance")}</p>
              <p className={styles.inspectorSafety}>{t("settings.environment.desktopInspectorGuidance")}</p>
            </div>
          ) : (
            <div className={styles.inspectorBody}>
              <p className={styles.inspectorKicker}>{t("settings.environment.setupKicker")}</p>
              <h2>{t("settings.environment.setupTitle")}</h2>
              <p>{t("settings.environment.setupCopy")}</p>
              <code className={styles.pathCode}>.env.local</code>
              <button className={styles.copyButton} type="button" onClick={() => { void copyEnvironmentTemplate(); }}>
                {copyState === "copied" ? t("settings.environment.copied") : t("settings.environment.copyTemplate")}
              </button>
              {copyState === "failed" ? <p className={styles.copyFailure} role="status">{t("settings.environment.copyFailed")}</p> : null}
            </div>
          )}
          {status && missingRequirements.length > 0 ? (
            <div className={styles.requirements}>
              <p className={styles.inspectorKicker}>{t("settings.requirements.title")}</p>
              <ul>{missingRequirements.map((key) => <li key={key}>{t(key)}</li>)}</ul>
            </div>
          ) : null}
          {configurationSurface !== "desktop" ? <div className={styles.desktopPanel}>
            <p className={styles.inspectorKicker}>{t("settings.environment.desktopKicker")}</p>
            <strong>{t("settings.environment.desktopTitle")}</strong>
            <p>{t("settings.environment.desktopGuidance")}</p>
            <span>{t("settings.environment.desktopMenu")}</span>
          </div> : null}
          {status?.lastValidatedAt ? (
            <p className={styles.validationMeta}>{t("settings.runtime.lastValidated", { time: formatDateTime(status.lastValidatedAt) })}</p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function SettingsSection({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <section className={styles.section}>
    <header className={styles.sectionHeader}>
      <p className="section-kicker">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
    <div className={styles.sectionBody}>{children}</div>
  </section>;
}

function EnvironmentState({ status, configurationSurface, loadState }: { status: RuntimeProfileStatus | null; configurationSurface: RuntimeProfileStatusResponse["configurationSurface"] | null; loadState: LoadState }) {
  const { t } = useLocale();
  if (loadState === "loading") return <div className={styles.headerState} aria-live="polite"><span className="status-dot" />{t("settings.status.loading")}</div>;
  if (loadState === "failed") return <div className={`${styles.headerState} ${styles.isFailed}`}><span className="status-dot" />{t("settings.status.unavailable")}</div>;
  if (!status) return null;
  return <div className={styles.headerState}><span className="status-dot" />{t(configurationSurface === "desktop" ? "settings.environment.desktopManaged" : "settings.environment.managed")}</div>;
}

function CredentialPanelAction({ state, onOpen }: { state: CredentialPanelState; onOpen: () => void }) {
  const { t } = useLocale();
  const message = state === "opened" ? t("settings.environment.credentialsOpened") : state === "failed" ? t("settings.environment.credentialsOpenFailed") : null;

  return <div className={styles.credentialLaunch} aria-live="polite">
    <div>
      <p className={styles.credentialLaunchKicker}>{t("settings.environment.desktopKicker")}</p>
      <strong>{t("settings.environment.openCredentialsTitle")}</strong>
      <p>{t("settings.environment.openCredentialsCopy")}</p>
    </div>
    <div className={styles.credentialLaunchAction}>
      <button type="button" onClick={() => { void onOpen(); }} disabled={state === "opening"}>
        {state === "opening" ? t("settings.environment.openingCredentials") : state === "failed" ? t("settings.environment.retryCredentials") : t("settings.environment.openCredentials")}
      </button>
      {state === "opening" ? <span role="status">{t("settings.environment.openingCredentialsHint")}</span> : null}
      {message ? <span className={state === "failed" ? styles.isFailed : undefined} role="status">{message}</span> : null}
    </div>
  </div>;
}

function ProviderDetails({ provider, credentialConfigured, providerLabel, credentialLabel, t }: {
  provider: RuntimeProfileStatus["searchProvider"];
  credentialConfigured: boolean;
  providerLabel: string;
  credentialLabel: string;
  t: ReturnType<typeof useLocale>["t"];
}) {
  return <div className={styles.readonlyList}>
    <ReadonlyField label={providerLabel} value={providerName(provider, t)} />
    <ReadonlyField
      label={credentialLabel}
      value={credentialConfigured ? t("settings.value.configured") : t("settings.value.notConfigured")}
      state={credentialConfigured ? "positive" : "caution"}
    />
  </div>;
}

function ReadonlyField({ label, value, mono = false, state }: { label: string; value: string; mono?: boolean; state?: "positive" | "caution" }) {
  return <div className={styles.readonlyField}>
    <span>{label}</span>
    <strong className={`${mono ? styles.mono : ""} ${state ? styles[`is${capitalize(state)}`] : ""}`}>{value}</strong>
  </div>;
}

function StatusPill({ state, label }: { state: RuntimeValidationState | RuntimeLifecycleState; label: string }) {
  const tone = state === "FAILED" ? "danger" : state === "NOT_CONFIGURED" || state === "REPLAY_FALLBACK" || state === "RESTART_REQUIRED" ? "caution" : state === "SAVED_UNVERIFIED" || state === "TESTING" || state === "RESTARTING" ? "active" : "positive";
  return <span className={`${styles.statusPill} ${styles[`is${capitalize(tone)}`]}`}><span aria-hidden="true" />{label}</span>;
}

function StatusFailure({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  return <div className={styles.loadFailure} role="status">
    <p>{t("settings.status.unavailable")}</p>
    <button type="button" onClick={onRetry}>{t("settings.status.retry")}</button>
  </div>;
}

function LoadingRows({ count }: { count: number }) {
  const { t } = useLocale();
  return <div className={styles.loadingRows} aria-live="polite" aria-label={t("settings.status.loading")}>
    {Array.from({ length: count }, (_, index) => <span key={index} />)}
  </div>;
}

function providerName(provider: RuntimeProfileStatus["searchProvider"] | RuntimeProfileStatus["modelProvider"], t: ReturnType<typeof useLocale>["t"]): string {
  if (provider === "tavily") return "Tavily";
  if (provider === "brave") return "Brave Search";
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "openai") return "OpenAI";
  return t("settings.value.notConfigured");
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

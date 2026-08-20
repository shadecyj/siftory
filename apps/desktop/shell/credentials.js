(() => {
  "use strict";

  const localeStorageKey = "searchos:credentials-locale";
  const dictionaries = {
    "zh-CN": {
      eyebrow: "DESKTOP SECURITY",
      title: "配置 Live API 凭据",
      lede: "凭据仅保存到 Windows Credential Manager，不会显示在 Siftory 工作区或日志中。",
      runtimeStatus: "RUNTIME STATUS",
      profileStatus: "PROFILE STATUS",
      activeSearches: "ACTIVE SEARCHES",
      securityNotice: "输入框只用于本次保存，不会回填。保存后请先显式测试连接；测试可能使用 Provider 配额或产生少量费用。",
      stepOne: "01 · SEARCH",
      searchProvider: "搜索 Provider",
      provider: "Provider",
      searchKey: "Search API Key",
      stepTwo: "02 · MODEL",
      modelProvider: "模型 Provider",
      model: "Model",
      baseUrl: "Base URL",
      baseUrlHint: "仅允许 DeepSeek 官方 HTTPS 端点。",
      modelKey: "Model API Key",
      save: "安全保存候选配置",
      test: "测试连接",
      apply: "应用并重启 Runtime",
      maintenanceEyebrow: "RECOVERY",
      maintenanceTitle: "恢复与清除",
      maintenanceCopy: "清除活动配置会先切回 Replay。若有搜索正在运行，清除和应用操作会被阻止。",
      clearCandidate: "清除候选配置",
      clearAll: "清除全部凭据并切回 Replay",
      replay: "Replay（本地示例）",
      live: "Live（已启用）",
      notConfigured: "未配置",
      saved: "已保存，待验证",
      verified: "已验证，可应用",
      failed: "验证失败",
      testing: "正在测试连接",
      restartRequired: "等待应用并重启",
      active: "运行中",
      runningSearches: "{count} 个运行中的搜索",
      noActiveSearches: "无运行中的搜索",
      savedMessage: "候选配置已安全保存。输入框已清空；请显式测试连接。",
      verifiedMessage: "连接已验证。现在可以应用配置并重启本地 Runtime。",
      failedMessage: "验证未通过。请检查 Provider、模型或 API Key 后重新保存。",
      appliedMessage: "Live Runtime 已重启并生效。主工作区正在重新连接。",
      clearedCandidateMessage: "候选配置已清除。",
      clearedAllMessage: "凭据已清除，Runtime 已安全切回 Replay。",
      confirmClearAll: "这会删除 Windows Credential Manager 中的 Siftory API 凭据，并将 Runtime 切回 Replay。确定继续吗？",
      unavailable: "无法读取本地安全状态。请重启桌面应用后重试。",
      error_PROFILE_INVALID: "配置格式无效。请使用支持的 Provider、模型和官方 HTTPS 端点。",
      error_PROFILE_NOT_SAVED: "请先保存候选配置。",
      error_PROFILE_NOT_VERIFIED: "请先通过连接测试，再应用配置。",
      error_PROFILE_STORAGE_UNAVAILABLE: "Windows Credential Manager 当前不可用。",
      error_PROFILE_TOO_LARGE: "凭据或配置超过系统安全存储上限。",
      error_NETWORK_UNAVAILABLE: "网络不可用，或 Provider 暂时无法连接。",
      error_AUTHENTICATION_FAILED: "Provider 拒绝了凭据。请检查 API Key。",
      error_RATE_LIMITED: "Provider 当前限流，请稍后再试。",
      error_PROVIDER_UNAVAILABLE: "Provider 未能完成验证，请稍后再试。",
      error_LOCAL_RUNTIME_UNAVAILABLE: "本地 Runtime 状态不可用。为避免中断搜索，操作已取消。",
      error_ACTIVE_SEARCH_IN_PROGRESS: "当前有搜索正在运行。请等待完成或在主工作区取消后重试。",
      error_RUNTIME_RESTART_FAILED: "Runtime 重启失败；系统已尝试恢复先前配置。",
      error_default: "操作未完成。请重试；凭据不会显示在错误信息中。"
    },
    "en-US": {
      eyebrow: "DESKTOP SECURITY",
      title: "Configure Live API credentials",
      lede: "Credentials live only in Windows Credential Manager and are never shown in the Siftory workspace or logs.",
      runtimeStatus: "RUNTIME STATUS",
      profileStatus: "PROFILE STATUS",
      activeSearches: "ACTIVE SEARCHES",
      securityNotice: "Inputs are used only for this save and are never refilled. Save first, then explicitly test the connection; tests can use provider quota or incur a small charge.",
      stepOne: "01 · SEARCH",
      searchProvider: "Search provider",
      provider: "Provider",
      searchKey: "Search API key",
      stepTwo: "02 · MODEL",
      modelProvider: "Model provider",
      model: "Model",
      baseUrl: "Base URL",
      baseUrlHint: "Only the official DeepSeek HTTPS endpoint is accepted.",
      modelKey: "Model API key",
      save: "Securely save candidate",
      test: "Test connection",
      apply: "Apply and restart runtime",
      maintenanceEyebrow: "RECOVERY",
      maintenanceTitle: "Recovery and clearing",
      maintenanceCopy: "Clearing the active profile returns to Replay first. Apply and clear are blocked while a search is running.",
      clearCandidate: "Clear candidate",
      clearAll: "Clear all credentials and return to Replay",
      replay: "Replay (local sample)",
      live: "Live (enabled)",
      notConfigured: "Not configured",
      saved: "Saved, not verified",
      verified: "Verified, ready to apply",
      failed: "Verification failed",
      testing: "Testing connection",
      restartRequired: "Waiting to apply and restart",
      active: "Active",
      runningSearches: "{count} active searches",
      noActiveSearches: "No active searches",
      savedMessage: "Candidate saved securely. Inputs were cleared; explicitly test the connection next.",
      verifiedMessage: "Connection verified. You can now apply the profile and restart the local runtime.",
      failedMessage: "Verification did not pass. Check the provider, model, or API key, then save again.",
      appliedMessage: "The Live runtime restarted successfully. The workspace is reconnecting.",
      clearedCandidateMessage: "Candidate profile cleared.",
      clearedAllMessage: "Credentials cleared; the runtime returned safely to Replay.",
      confirmClearAll: "This deletes Siftory API credentials from Windows Credential Manager and returns the runtime to Replay. Continue?",
      unavailable: "The local security status is unavailable. Restart the desktop app and try again.",
      error_PROFILE_INVALID: "The configuration is invalid. Use a supported provider, model, and official HTTPS endpoint.",
      error_PROFILE_NOT_SAVED: "Save a candidate profile first.",
      error_PROFILE_NOT_VERIFIED: "Test the connection successfully before applying the profile.",
      error_PROFILE_STORAGE_UNAVAILABLE: "Windows Credential Manager is currently unavailable.",
      error_PROFILE_TOO_LARGE: "The credential or profile exceeds the system secure-storage limit.",
      error_NETWORK_UNAVAILABLE: "The network or provider is currently unavailable.",
      error_AUTHENTICATION_FAILED: "The provider rejected the credential. Check the API key.",
      error_RATE_LIMITED: "The provider is rate limited. Try again later.",
      error_PROVIDER_UNAVAILABLE: "The provider could not finish verification. Try again later.",
      error_LOCAL_RUNTIME_UNAVAILABLE: "The local runtime status is unavailable. The action was stopped to avoid interrupting a search.",
      error_ACTIVE_SEARCH_IN_PROGRESS: "A search is running. Wait for it to finish or cancel it in the workspace, then try again.",
      error_RUNTIME_RESTART_FAILED: "The runtime restart failed; Siftory attempted to restore the previous profile.",
      error_default: "The action did not complete. Try again; credentials are never included in errors."
    }
  };

  const elements = {
    form: document.getElementById("profile-form"),
    localeToggle: document.getElementById("locale-toggle"),
    searchProvider: document.getElementById("search-provider"),
    modelProvider: document.getElementById("model-provider"),
    model: document.getElementById("model"),
    baseUrlField: document.getElementById("base-url-field"),
    baseUrl: document.getElementById("model-base-url"),
    searchKey: document.getElementById("search-api-key"),
    modelKey: document.getElementById("model-api-key"),
    save: document.getElementById("save-button"),
    test: document.getElementById("test-button"),
    apply: document.getElementById("apply-button"),
    clearStaged: document.getElementById("clear-staged-button"),
    clearAll: document.getElementById("clear-all-button"),
    runtime: document.getElementById("runtime-value"),
    profile: document.getElementById("profile-value"),
    activeRuns: document.getElementById("active-runs-value"),
    message: document.getElementById("operation-message")
  };

  let locale = localStorage.getItem(localeStorageKey) || (navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US");
  let busy = false;
  let latestStatus = null;

  function t(key, variables = {}) {
    const source = dictionaries[locale] || dictionaries["zh-CN"];
    return (source[key] || dictionaries["en-US"][key] || key).replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? ""));
  }

  function setMessage(value, isError = false) {
    elements.message.textContent = value || "";
    elements.message.style.color = isError ? "var(--danger)" : "var(--text-secondary)";
  }

  function updateLocalizedCopy() {
    document.documentElement.lang = locale;
    document.title = locale === "zh-CN" ? "Siftory — API 凭据" : "Siftory — API Credentials";
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    elements.localeToggle.textContent = locale === "zh-CN" ? "EN" : "中文";
    syncStatusView();
  }

  function validationLabel(state) {
    const labels = {
      NOT_CONFIGURED: "notConfigured",
      SAVED_UNVERIFIED: "saved",
      TESTING: "testing",
      VERIFIED: "verified",
      FAILED: "failed"
    };
    return t(labels[state] || "notConfigured");
  }

  function syncStatusView() {
    if (!latestStatus) {
      elements.runtime.textContent = "—";
      elements.profile.textContent = "—";
      elements.activeRuns.textContent = "—";
      return;
    }
    const runtime = latestStatus.runtime;
    elements.runtime.textContent = runtime.runtimeMode === "live" ? t("live") : t("replay");
    elements.profile.textContent = runtime.restartRequired ? t("restartRequired") : validationLabel(runtime.validationState);
    elements.activeRuns.textContent = runtime.activeRunCount > 0
      ? t("runningSearches", { count: runtime.activeRunCount })
      : t("noActiveSearches");
    elements.test.disabled = busy || !latestStatus.stagedProfilePresent;
    elements.apply.disabled = busy || runtime.validationState !== "VERIFIED" || !runtime.restartRequired;
    elements.clearStaged.disabled = busy || !latestStatus.stagedProfilePresent;
    elements.clearAll.disabled = busy || (!latestStatus.stagedProfilePresent && !latestStatus.activeProfilePresent);
  }

  function setBusy(next) {
    busy = next;
    [elements.save, elements.test, elements.apply, elements.clearStaged, elements.clearAll, elements.localeToggle].forEach((button) => {
      button.disabled = next;
    });
    syncStatusView();
  }

  function errorCode(error) {
    if (error && typeof error === "object" && typeof error.code === "string") return error.code;
    if (typeof error === "string") {
      try {
        const parsed = JSON.parse(error);
        if (parsed && typeof parsed.code === "string") return parsed.code;
      } catch {
        const matched = error.match(/(?:code["']?\s*[:=]\s*["']?)([A-Z_]+)/);
        if (matched) return matched[1];
      }
    }
    return "default";
  }

  function errorMessage(error) {
    const key = `error_${errorCode(error)}`;
    const source = dictionaries[locale] || dictionaries["zh-CN"];
    return source[key] || dictionaries["en-US"][key] || t("error_default");
  }

  async function invoke(command, payload) {
    const invokeNative = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
    if (typeof invokeNative !== "function") throw { code: "PROFILE_STORAGE_UNAVAILABLE" };
    return invokeNative(command, payload);
  }

  async function refreshStatus() {
    try {
      latestStatus = await invoke("get_live_profile_status");
      syncStatusView();
      if (!latestStatus.secureStorageAvailable) setMessage(t("unavailable"), true);
    } catch (error) {
      setMessage(errorMessage(error), true);
    }
  }

  function syncModelProviderFields() {
    const isDeepSeek = elements.modelProvider.value === "deepseek";
    elements.baseUrlField.hidden = !isDeepSeek;
    elements.baseUrl.disabled = !isDeepSeek;
    if (isDeepSeek) {
      if (!elements.model.value || elements.model.value.startsWith("gpt-")) elements.model.value = "deepseek-chat";
      if (!elements.baseUrl.value) elements.baseUrl.value = "https://api.deepseek.com/";
    }
    if (!isDeepSeek) {
      elements.baseUrl.value = "";
      if (!elements.model.value || elements.model.value.startsWith("deepseek-")) elements.model.value = "gpt-4.1-mini";
    }
  }

  function profileInput() {
    return {
      searchProvider: elements.searchProvider.value,
      modelProvider: elements.modelProvider.value,
      model: elements.model.value,
      modelBaseUrl: elements.modelProvider.value === "deepseek" ? elements.baseUrl.value : null,
      searchApiKey: elements.searchKey.value,
      modelApiKey: elements.modelKey.value
    };
  }

  async function perform(operation) {
    setBusy(true);
    setMessage("");
    try {
      const status = await operation();
      if (status) latestStatus = status;
      syncStatusView();
      return true;
    } catch (error) {
      setMessage(errorMessage(error), true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;
    const completed = await perform(() => invoke("save_live_profile", { profile: profileInput() }));
    if (completed) {
      elements.searchKey.value = "";
      elements.modelKey.value = "";
      setMessage(t("savedMessage"));
    }
  });

  elements.test.addEventListener("click", async () => {
    const completed = await perform(() => invoke("test_live_profile"));
    if (!completed || !latestStatus) return;
    setMessage(latestStatus.runtime.validationState === "VERIFIED" ? t("verifiedMessage") : t("failedMessage"), latestStatus.runtime.validationState !== "VERIFIED");
  });

  elements.apply.addEventListener("click", async () => {
    const completed = await perform(() => invoke("activate_live_profile"));
    if (completed) setMessage(t("appliedMessage"));
  });

  elements.clearStaged.addEventListener("click", async () => {
    const completed = await perform(() => invoke("clear_live_profile", { scope: "staged" }));
    if (completed) setMessage(t("clearedCandidateMessage"));
  });

  elements.clearAll.addEventListener("click", async () => {
    if (!window.confirm(t("confirmClearAll"))) return;
    const completed = await perform(() => invoke("clear_live_profile", { scope: "all" }));
    if (completed) setMessage(t("clearedAllMessage"));
  });

  elements.modelProvider.addEventListener("change", syncModelProviderFields);
  elements.localeToggle.addEventListener("click", () => {
    locale = locale === "zh-CN" ? "en-US" : "zh-CN";
    localStorage.setItem(localeStorageKey, locale);
    updateLocalizedCopy();
  });
  window.addEventListener("beforeunload", () => {
    elements.searchKey.value = "";
    elements.modelKey.value = "";
  });

  updateLocalizedCopy();
  syncModelProviderFields();
  void refreshStatus();
})();

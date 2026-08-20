import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "apps", "web");
const appPort = 4311;
const devtoolsPort = 9333;
const baseUrl = `http://127.0.0.1:${appPort}`;
const fixtureTaskId = "00000000-0000-7000-8000-000000000002";
const smokeDataDir = await mkdtemp(path.join(tmpdir(), "searchos-r2-db-"));
const captureDir = process.env.SEARCHOS_CAPTURE_DIR ? path.resolve(process.env.SEARCHOS_CAPTURE_DIR) : null;
const mutationHeaders = { "X-SearchOS-Request": "1" };

async function main() {
  const server = spawn(
    process.execPath,
    [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(appPort)],
    {
      cwd: appDir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DATABASE_URL: "",
        SEARCHOS_PGLITE_DATA_DIR: smokeDataDir,
        SEARCHOS_APP_PREFERENCES_PATH: path.join(smokeDataDir, "preferences.json"),
        SEARCHOS_RUNTIME_MODE: "replay"
      }
    }
  );
  let serverLog = "";
  server.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });
  let browser;
  let profileDir;

  try {
  await waitForHttp(`${baseUrl}/`);
  await assertHttpRoutes();
  const apiSmoke = await assertRound2Api();

  const edgePath = findEdge();
  if (!edgePath) {
    console.log("PASS: HTTP smoke completed. Browser interaction skipped because Edge was not found.");
    process.exitCode = 0;
  } else {
    profileDir = await mkdtemp(path.join(tmpdir(), "searchos-r2-smoke-"));
    browser = spawn(edgePath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      `--remote-debugging-port=${devtoolsPort}`,
      `--user-data-dir=${profileDir}`,
      "about:blank"
    ], { windowsHide: true, stdio: "ignore" });

    const target = await waitForDevtoolsTarget();
    const cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");

      await navigate(cdp, `${baseUrl}/`);
      await waitForEvaluate(cdp, `document.querySelector('.app-sidebar .runtime-badge')?.textContent?.includes('Replay') === true`, "Home did not disclose the Replay runtime");
      await assertEvaluate(cdp, `(() => {
        localStorage.clear();
        return true;
      })()`, "Home storage could not be reset");
      await assertEvaluate(cdp, `(() => {
        const input = document.querySelector('.search-input');
        const english = [...document.querySelectorAll('.locale-switcher button')].find((button) => button.textContent?.trim() === 'EN');
        if (!(input instanceof HTMLTextAreaElement) || !(english instanceof HTMLButtonElement)) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(input, 'draft survives language switching');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        english.click();
        return true;
      })()`, "language switching draft setup failed");
      await waitForEvaluate(cdp, `document.documentElement.lang === 'en-US' && document.querySelector('.search-input')?.value === 'draft survives language switching' && document.body.innerText.includes('What would you like to verify today?')`, "English switch did not preserve the current draft", 100);
      await assertEvaluate(cdp, `(() => {
        const chinese = [...document.querySelectorAll('.locale-switcher button')].find((button) => button.textContent?.trim() === '中');
        if (!(chinese instanceof HTMLButtonElement)) return false;
        chinese.click();
        return true;
      })()`, "Chinese language switch control was unavailable");
      await waitForEvaluate(cdp, `document.documentElement.lang === 'zh-CN' && document.querySelector('.search-input')?.value === 'draft survives language switching' && document.body.innerText.includes('今天想查清什么？')`, "Chinese switch did not preserve the current draft", 100);
      await waitForEvaluate(cdp, `(() => {
        const example = document.querySelector('.example-button');
        const submit = document.querySelector('.search-submit');
        if (!(example instanceof HTMLButtonElement) || !(submit instanceof HTMLButtonElement)) return false;
        example.click();
        return !submit.disabled;
      })()`, "Home golden question did not become submittable");
      await captureViewport(cdp, "home");
      await assertEvaluate(cdp, `(() => {
        const submit = document.querySelector('.search-submit');
        if (!(submit instanceof HTMLButtonElement) || submit.disabled) return false;
        submit.click();
        return true;
      })()`, "Home golden question could not be submitted");
      await waitForEvaluate(cdp, `location.pathname.startsWith('/search/') && new URLSearchParams(location.search).has('run')`, "Home did not navigate to a runtime Search Workspace");
      await waitForEvaluate(cdp, `document.querySelector('.confidence-level')?.textContent?.includes('高可信') === true`, "completed result did not render", 80);
      await assertEvaluate(cdp, `document.querySelectorAll('.confidence-signal').length === 4`, "confidence dimensions were not explainable");
      await assertEvaluate(cdp, `[...document.querySelectorAll('.confidence-signal')].some((item) => item.textContent.includes('权威性 · 第一方'))`, "confidence authority dimension was missing");
      await assertEvaluate(cdp, `document.body.innerText.includes('来源数量本身不等于可信度')`, "confidence did not disclose its deterministic interpretation");
      await assertEvaluate(cdp, `document.querySelector('.answer-heading')?.textContent?.includes('综合回答') === true && (document.querySelector('.answer-text')?.textContent?.trim().length ?? 0) > 25`, "grounded AI synthesis was too thin");
      await assertEvaluate(cdp, `document.querySelectorAll('.source-card').length >= 1 && [...document.querySelectorAll('.source-card')].every((card) => card.querySelector('.trust-badge'))`, "source cards did not expose contextual trust");
      await assertEvaluate(cdp, `document.querySelector('.source-context-note')?.textContent?.includes('不是对网站的永久评分') === true`, "source trust context was not disclosed");
      await assertEvaluate(cdp, `document.body.innerText.includes('Replay / 示例数据')`, "Replay runtime was not disclosed");
      await assertEvaluate(cdp, `document.querySelector('.selected-claim')?.textContent?.includes('del data[key]') === true`, "first Claim was not linked to the evidence inspector");
      await assertEvaluate(cdp, `(async () => {
        const claims = document.querySelectorAll('.claim-card summary');
        if (claims.length < 2) return false;
        claims[1].dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        claims[1].click();
        await new Promise((resolve) => setTimeout(resolve, 50));
        return document.querySelector('.selected-claim')?.textContent?.includes('pop') === true;
      })()`, "keyboard Claim selection did not update the evidence inspector");
      await assertEvaluate(cdp, `(() => {
        const english = [...document.querySelectorAll('.locale-switcher button')].find((button) => button.textContent?.trim() === 'EN');
        if (!(english instanceof HTMLButtonElement)) return false;
        english.click();
        return true;
      })()`, "could not switch the completed workspace to English");
      await waitForEvaluate(cdp, `document.documentElement.lang === 'en-US' && document.querySelector('.selected-claim')?.textContent?.includes('pop') === true && document.body.innerText.includes('Evidence inspector')`, "English UI switch changed selected evidence or did not render");
      await assertEvaluate(cdp, `(() => {
        const chinese = [...document.querySelectorAll('.locale-switcher button')].find((button) => button.textContent?.trim() === '中');
        if (!(chinese instanceof HTMLButtonElement)) return false;
        chinese.click();
        return true;
      })()`, "could not restore the completed workspace to Chinese");
      await waitForEvaluate(cdp, `document.documentElement.lang === 'zh-CN' && document.querySelector('.selected-claim')?.textContent?.includes('pop') === true`, "restoring Chinese changed the selected evidence");
      await assertEvaluate(cdp, `(() => {
        const sourcesTab = [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === '来源');
        if (!(sourcesTab instanceof HTMLButtonElement)) return false;
        sourcesTab.click();
        return true;
      })()`, "evidence inspector source tab was not interactive");
      await delay(120);
      await assertEvaluate(cdp, `document.querySelectorAll('.inspector-source-list a').length > 0`, "evidence inspector did not render sources");
      await assertEvaluate(cdp, `document.querySelector('.inspector-source-list')?.getAttribute('data-query-count') === '1'`, "source inspector did not expose query processing state");
      await assertEvaluate(cdp, `(() => {
        const source = document.querySelector('.inspector-source-row button');
        if (!(source instanceof HTMLButtonElement)) return false;
        source.click();
        return true;
      })()`, "source selection did not highlight linked Claims");
      await delay(80);
      await assertEvaluate(cdp, `document.querySelector('.claim-card.is-source-linked') !== null`, "source selection did not highlight linked Claims");
      await assertEvaluate(cdp, `document.querySelector('.source-link')?.textContent?.includes('打开') === true`, "external source action was not explicitly labeled");
      await assertViewportMatrix(cdp);
      await assertPreferenceMatrix(cdp);
      await assertEvaluate(cdp, `(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })); return true; })()`, "save keyboard shortcut could not be dispatched");
      await delay(350);
      await assertEvaluate(cdp, `document.querySelector('.save-button')?.textContent?.includes('已保存') === true`, "Save keyboard action did not return to the UI");

      await navigate(cdp, `${baseUrl}/library`);
      await delay(350);
      await assertEvaluate(cdp, `document.body.innerText.includes('删除 Python 字典键')`, "saved runtime Note did not appear in API Library");
      await navigate(cdp, `${baseUrl}/notes/${apiSmoke.saved.bundle.savedNote.id}`);
      await delay(350);
      await assertEvaluate(cdp, `document.querySelector('#note-category')?.value === 'TECHNOLOGY'`, "suggested category was not visible on the Search Note");
      await assertEvaluate(cdp, `(() => { const button = document.querySelector('.favorite-control'); if (!(button instanceof HTMLButtonElement)) return false; button.click(); return true; })()`, "favorite control was not interactive");
      await waitForEvaluate(cdp, `document.querySelector('.favorite-control')?.getAttribute('aria-pressed') === 'true'`, "favorite state was not confirmed by the server");
      await assertEvaluate(cdp, `(() => {
        const select = document.querySelector('#note-category');
        if (!(select instanceof HTMLSelectElement)) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        setter?.call(select, 'LIFE');
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })()`, "category selector was not interactive");
      await waitForEvaluate(cdp, `document.querySelector('#note-category')?.value === 'LIFE' && document.body.innerText.includes('分类已更新')`, "category update was not confirmed by the server");
      await captureViewport(cdp, "note-detail");
      await assertEvaluate(cdp, `(() => {
        const area = document.querySelector('#my-notes');
        if (!(area instanceof HTMLTextAreaElement)) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(area, 'Round 2 API smoke note');
        area.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('.personal-notes-editor button')?.click();
        return true;
      })()`, "My Notes API editor was not interactive");
      await delay(350);
      const noteResponse = await fetch(`${baseUrl}/api/notes/${apiSmoke.saved.bundle.savedNote.id}`);
      const notePayload = await noteResponse.json();
      if (notePayload.bundle?.savedNote?.myNotes !== "Round 2 API smoke note") throw new Error("My Notes API did not persist.");
      if (notePayload.bundle?.savedNote?.isFavorite !== true || notePayload.bundle?.savedNote?.category !== "LIFE") throw new Error("Favorite or category API did not persist.");

      await navigate(cdp, `${baseUrl}/library`);
      await delay(350);
      await assertEvaluate(cdp, `(() => { const button = [...document.querySelectorAll('.library-nav button')].find((item) => item.textContent.includes('收藏')); if (!(button instanceof HTMLButtonElement)) return false; button.click(); return true; })()`, "Favorites filter was not interactive");
      await assertEvaluate(cdp, `document.querySelector('.note-row')?.textContent?.includes('删除 Python 字典键') === true`, "favorite Note was missing from the Favorites filter");
      await assertEvaluate(cdp, `(() => { const button = [...document.querySelectorAll('.library-nav button')].find((item) => item.textContent.includes('生活')); if (!(button instanceof HTMLButtonElement)) return false; button.click(); return true; })()`, "category filter was not interactive");
      await assertEvaluate(cdp, `document.querySelector('.note-row')?.textContent?.includes('删除 Python 字典键') === true`, "categorized Note was missing from the category filter");
      await captureViewport(cdp, "library");
      await assertEvaluate(cdp, `(() => { const row = document.querySelector('.note-row'); if (!(row instanceof HTMLAnchorElement)) return false; row.click(); return true; })()`, "filtered Note could not be reopened");
      await waitForEvaluate(cdp, `location.pathname.startsWith('/notes/') && document.querySelector('.source-link')?.textContent?.includes('打开来源') === true`, "reopened Note lost its evidence and source chain");

      await navigate(cdp, `${baseUrl}/search/${apiSmoke.failed.taskId}?run=${apiSmoke.failed.runId}&q=${encodeURIComponent('另一个 Replay 问题')}`);
      await delay(450);
      await assertEvaluate(cdp, `document.body.innerText.includes('这次搜索没有完成') && document.body.innerText.includes('所需的服务尚未配置')`, "failed runtime recovery UI did not render");
      await assertEvaluate(cdp, `document.querySelector('.retained-summary')?.textContent?.includes('events') === true`, "failed runtime did not disclose retained objects");

      await navigate(cdp, `${baseUrl}/search/${fixtureTaskId}?state=insufficient`);
      await waitForEvaluate(cdp, `document.querySelectorAll('.stage-progress li').length === 4 && document.querySelector('.stage-progress li.is-current') !== null`, "search waiting state did not expose stage progress");
      await captureViewport(cdp, "search-progress");
      await delay(2_400);
      await assertEvaluate(cdp, `document.querySelector('.confidence-level')?.textContent?.includes('证据不足') === true`, "Insufficient state did not come from its structured fixture");
      await assertEvaluate(cdp, `document.body.innerText.includes('缩小问题') && document.body.innerText.includes('待验证问题')`, "Insufficient state did not provide a concrete recovery path");

      await navigate(cdp, `${baseUrl}/search/${fixtureTaskId}?state=partial`);
      await delay(2_400);
      await assertEvaluate(cdp, `document.querySelector('.notice.is-partial')?.textContent?.includes('部分完成') === true`, "Partial state did not preserve its verified result and limitation");

      await navigate(cdp, `${baseUrl}/`);
      await waitForEvaluate(cdp, `document.querySelector('.search-input') !== null && document.querySelector('.locale-switcher button') !== null`, "home controls did not hydrate before the English search");
      await delay(200);
      await assertEvaluate(cdp, `(() => {
        const english = [...document.querySelectorAll('.locale-switcher button')].find((button) => button.textContent?.trim() === 'EN');
        if (!(english instanceof HTMLButtonElement)) return false;
        english.click();
        return true;
      })()`, "could not start an English Replay search");
      await waitForEvaluate(cdp, `document.documentElement.lang === 'en-US'`, "English language preference did not apply on Home");
      await waitForEvaluate(cdp, `document.body.innerText.includes('What would you like to verify today?')`, "English home did not render");
      await assertEvaluate(cdp, `(() => {
        const example = document.querySelector('.example-button');
        if (!(example instanceof HTMLButtonElement)) return false;
        example.click();
        return true;
      })()`, "English Replay example could not be selected");
      await waitForEvaluate(cdp, `document.querySelector('.search-input')?.value === 'How do I delete a dict key in Python?' && document.querySelector('.search-submit') instanceof HTMLButtonElement && !document.querySelector('.search-submit').disabled`, "English Replay example did not become submittable");
      await assertEvaluate(cdp, `(() => {
        const submit = document.querySelector('.search-submit');
        if (!(submit instanceof HTMLButtonElement) || submit.disabled) return false;
        submit.click();
        return true;
      })()`, "English Replay example could not be submitted");
      await waitForEvaluate(cdp, `location.pathname.startsWith('/search/') && document.querySelector('.confidence-level')?.textContent?.includes('High confidence') === true`, "English Replay result did not render", 80);
      await assertEvaluate(cdp, `document.documentElement.lang === 'en-US' && document.querySelector('.question-title')?.textContent?.includes('How do I delete a dict key in Python?') === true && document.querySelector('.answer-heading')?.textContent?.includes('Synthesized answer') === true && document.querySelector('.claim-statement')?.textContent?.includes('del data[key]') === true`, "English result did not retain outputLocale presentation");
      await navigate(cdp, `${baseUrl}/settings`);
      await waitForEvaluate(cdp, `document.documentElement.lang === 'en-US' && document.querySelector('h1')?.textContent?.includes('Settings') === true`, "English preference did not persist across navigation");
      await assertEvaluate(cdp, `document.querySelectorAll('input[type="password"]').length === 0 && document.body.innerText.includes('The browser version never saves API keys.')`, "Web Settings exposed a credential form or omitted its security boundary");
      await captureViewport(cdp, "settings-en");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await delay(100);
      await assertEvaluate(cdp, `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1`, "narrow Settings viewport overflowed");
      await captureViewport(cdp, "settings-en-narrow");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

      console.log("PASS: zh/en language persistence + Search → Save → Favorite → Category → Filter → Reopen + evidence, Settings, and recovery browser flow.");
    } finally {
      cdp.close();
    }
  }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    if (serverLog) console.error(serverLog);
    process.exitCode = 1;
  } finally {
    if (browser) await terminate(browser);
    await terminate(server);
    if (profileDir) await removeTempDirectory(profileDir);
    await removeTempDirectory(smokeDataDir);
  }
}

async function assertHttpRoutes() {
  const routes = [
    ["/", "今天想查清什么？"],
    [`/search/${fixtureTaskId}?state=complete`, "Python 怎么删除 dict key"],
    ["/library", "资料库"]
  ];
  for (const [route, marker] of routes) {
    const response = await fetch(`${baseUrl}${route}`);
    const html = await response.text();
    if (!response.ok || !html.includes(marker)) throw new Error(`HTTP smoke failed for ${route}`);
  }
}

async function assertRound2Api() {
  const create = async (question) => {
    const response = await fetch(`${baseUrl}/api/search-tasks`, {
      method: "POST", headers: { ...mutationHeaders, "content-type": "application/json" },
      body: JSON.stringify({ question, requestedMode: "AUTO" })
    });
    const payload = await response.json();
    if (response.status !== 202) throw new Error(`Create Search API failed: ${JSON.stringify(payload)}`);
    return payload;
  };
  const waitForTerminal = async (created) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/search-runs/${created.runId}`);
      const snapshot = await response.json();
      if (["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(snapshot.status)) return snapshot;
      await delay(100);
    }
    throw new Error("Runtime API did not reach a terminal state.");
  };

  const created = await create("Python 怎么删除 dict key？");
  const completed = await waitForTerminal(created);
  if (completed.status !== "COMPLETED" || completed.bundle?.result?.overallConfidence !== "HIGH") throw new Error(`Runtime API result invalid: ${JSON.stringify(completed)}`);
  if (!completed.bundle.evidence.every((item) => item.locator?.blockId)) throw new Error("Runtime API returned Evidence without a block locator.");
  const saveResponse = await fetch(`${baseUrl}/api/search-runs/${created.runId}/save`, { method: "POST", headers: mutationHeaders });
  const saved = await saveResponse.json();
  if (!saveResponse.ok || !saved.bundle?.savedNote?.isSaved) throw new Error("Runtime Save API failed.");
  if (saved.bundle.savedNote.category !== "TECHNOLOGY" || saved.bundle.savedNote.isFavorite !== false) throw new Error("Runtime Save did not persist its deterministic suggested category.");
  const invalidCategory = await fetch(`${baseUrl}/api/notes/${saved.bundle.savedNote.id}`, { method: "PATCH", headers: { ...mutationHeaders, "content-type": "application/json" }, body: JSON.stringify({ category: "CUSTOM" }) });
  if (invalidCategory.status !== 400) throw new Error("Note API accepted an unknown category.");
  const durableSnapshotResponse = await fetch(`${baseUrl}/api/search-runs/${created.runId}`, { headers: { connection: "close" } });
  const durableSnapshot = await durableSnapshotResponse.json();
  if (durableSnapshot.bundle?.savedNote?.isSaved !== true) throw new Error("Durable runtime checkpoint did not retain Save state.");

  const failedCreated = await create("另一个 Replay 问题");
  const failedSnapshot = await waitForTerminal(failedCreated);
  if (failedSnapshot.status !== "FAILED" || failedSnapshot.error?.code !== "PROVIDER_NOT_CONFIGURED") throw new Error("Replay boundary failure was not explicit.");
  const retryResponse = await fetch(`${baseUrl}/api/search-runs/${failedCreated.runId}/retry`, {
    method: "POST", headers: { ...mutationHeaders, "content-type": "application/json" },
    body: JSON.stringify({ question: "Python 怎么删除 dict key？", requestedMode: "QUICK" })
  });
  const retried = await retryResponse.json();
  if (retryResponse.status !== 202 || retried.runId === failedCreated.runId || retried.taskId !== failedCreated.taskId) throw new Error("Retry did not create a child Run in the same SearchTask.");
  const retriedSnapshot = await waitForTerminal(retried);
  if (retriedSnapshot.status !== "COMPLETED" || retriedSnapshot.bundle?.run?.parentRunId !== failedCreated.runId || retriedSnapshot.bundle?.run?.trigger !== "RETRY") throw new Error("Retry lineage was not preserved in the completed bundle.");
  const cancelCreated = await create("Python 怎么删除 dict key？");
  await delay(40);
  const cancelResponse = await fetch(`${baseUrl}/api/search-runs/${cancelCreated.runId}/cancel`, { method: "POST", headers: mutationHeaders });
  if (!cancelResponse.ok) throw new Error("Cancel API rejected the request.");
  const cancelled = await waitForTerminal(cancelCreated);
  if (cancelled.status !== "CANCELLED" || !cancelled.events.some((event) => event.eventType === "CANCEL_REQUESTED") || !cancelled.events.some((event) => event.eventType === "RUN_CANCELLED")) throw new Error("Cancel did not stop the run with auditable events.");
  return { created, completed, saved, failed: failedCreated, cancelled };
}

function findEdge() {
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
      ]
    : [];
  return candidates.find(existsSync);
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Production server did not start at ${url}`);
}

async function waitForDevtoolsTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${devtoolsPort}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await delay(100);
  }
  throw new Error("Edge DevTools endpoint did not become ready.");
}

async function navigate(cdp, url) {
  const loaded = cdp.waitFor("Page.loadEventFired");
  await cdp.send("Page.navigate", { url });
  await loaded;
}

async function assertEvaluate(cdp, expression, message) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result?.result?.value !== true) throw new Error(`Browser smoke failed: ${message}`);
}

async function waitForEvaluate(cdp, expression, message, attempts = 40) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result?.result?.value === true) return;
    await delay(100);
  }
  const diagnostics = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify({ lang: document.documentElement.lang, input: document.querySelector('.search-input')?.value ?? null, text: document.body.innerText.slice(0, 500) })`,
    returnByValue: true
  });
  throw new Error(`Browser smoke failed: ${message}; state=${diagnostics?.result?.value ?? "unavailable"}`);
}

async function assertViewportMatrix(cdp) {
  for (const [width, height, label] of [[2560, 1350, "wide"], [1280, 800, "desktop"], [820, 1024, "tablet"], [390, 844, "narrow"]]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await delay(80);
    await captureViewport(cdp, label);
    if (width <= 820) {
      await assertEvaluate(cdp, `(() => {
        const toggle = document.querySelector('.mobile-inspector-toggle');
        if (!(toggle instanceof HTMLButtonElement)) return false;
        toggle.click();
        return true;
      })()`, `${label} inspector sheet could not be opened`);
      await delay(80);
      await assertEvaluate(cdp, `(() => {
        const root = document.documentElement;
        const inspector = document.querySelector('.evidence-inspector');
        return root.scrollWidth <= root.clientWidth + 1 && inspector && getComputedStyle(inspector).position === 'fixed' && getComputedStyle(inspector).display !== 'none';
      })()`, `${label} inspector sheet layout was invalid`);
      await captureViewport(cdp, `${label}-inspector`);
      await assertEvaluate(cdp, `(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true; })()`, `${label} inspector Escape close could not be dispatched`);
      await delay(80);
      await assertEvaluate(cdp, `document.querySelector('.evidence-inspector') === null`, `${label} inspector sheet did not close with Escape`);
    } else {
      await assertEvaluate(cdp, `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && document.querySelector('.evidence-inspector') !== null`, `${label} viewport overflowed or inspector was missing`);
      if (label === "wide") await assertEvaluate(cdp, `(() => {
        const answer = document.querySelector('.answer-block');
        const source = document.querySelector('.source-card');
        return answer?.getBoundingClientRect().width >= 1100 && source?.getBoundingClientRect().width >= 460;
      })()`, "wide result proportions did not use the available workspace");
    }
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await assertEvaluate(cdp, `(() => {
    if (document.querySelector('.evidence-inspector')) return true;
    const toggle = document.querySelector('.desktop-inspector-toggle');
    if (!(toggle instanceof HTMLButtonElement)) return false;
    toggle.click();
    return true;
  })()`, "desktop inspector could not be restored after responsive checks");
  await delay(80);
}

async function captureViewport(cdp, label) {
  if (!captureDir) return;
  await mkdir(captureDir, { recursive: true });
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(path.join(captureDir, `${label}.png`), Buffer.from(screenshot.data, "base64"));
}

async function assertPreferenceMatrix(cdp) {
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }, { name: "prefers-contrast", value: "more" }] });
  await assertEvaluate(cdp, `(() => {
    const body = getComputedStyle(document.body);
    return matchMedia('(prefers-reduced-motion: reduce)').matches && matchMedia('(prefers-contrast: more)').matches && body.color !== body.backgroundColor;
  })()`, "reduced motion or increased contrast preferences were not honored");
  await waitForEvaluate(cdp, `(() => {
    const button = document.querySelector('.theme-toggle');
    if (!(button instanceof HTMLButtonElement)) return false;
    if (document.documentElement.dataset.theme !== 'dark') button.click();
    return document.documentElement.dataset.theme === 'dark';
  })()`, "dark theme toggle did not apply");
  await assertEvaluate(cdp, `(() => { const body = getComputedStyle(document.body); return body.color !== body.backgroundColor; })()`, "dark theme text contrast collapsed");
  await cdp.send("Emulation.setEmulatedMedia", { features: [] });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeTempDirectory(directory) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      const retryable = error && typeof error === "object" && ["EBUSY", "EPERM", "ENOTEMPTY"].includes(error.code);
      if (!retryable) throw error;
      await delay(100 + attempt * 50);
    }
  }
  console.warn("WARN: Windows still holds a temporary browser profile lock; cleanup was deferred to the OS.");
}

class CdpClient {
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    return new CdpClient(socket);
  }

  constructor(socket) {
    this.socket = socket;
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const listeners = this.events.get(message.method) ?? [];
      this.events.delete(message.method);
      listeners.forEach((resolve) => resolve(message.params));
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  waitFor(method) {
    return new Promise((resolve) => {
      const listeners = this.events.get(method) ?? [];
      listeners.push(resolve);
      this.events.set(method, listeners);
    });
  }

  close() {
    this.socket.close();
  }
}

async function terminate(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  if (process.platform === "win32" && child.pid) {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
    await Promise.race([new Promise((resolve) => killer.once("exit", resolve)), delay(5_000)]);
  } else {
    child.kill("SIGTERM");
  }
  await Promise.race([exited, delay(5_000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

await main();

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.RUN_LIVE_ACCEPTANCE !== "1") {
  console.log("IR4 Live acceptance skipped. Set RUN_LIVE_ACCEPTANCE=1 to use configured providers.");
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "apps", "web");
const fileEnv = readEnvFile(path.join(root, ".env"));
const dataDir = await mkdtemp(path.join(tmpdir(), "searchos-ir4-live-"));
const port = 4314;
const baseUrl = `http://127.0.0.1:${port}`;
const question = process.env.LIVE_ACCEPTANCE_QUERY ?? fileEnv.LIVE_SMOKE_QUERY ?? "HTTP 304 和 200 响应有什么区别？";
const replayQuestion = "Python 怎么删除 dict key？";
const mutationHeaders = { "X-SearchOS-Request": "1" };
let server;
let serverLog = "";
const startedAt = Date.now();

try {
  if (question.trim() === replayQuestion) throw new Error("IR4 Live acceptance question must not be the Replay fixture.");
  server = startServer();
  await waitForHttp();
  const runtime = await fetchJson(`${baseUrl}/api/runtime`, {}, "Runtime disclosure");
  if (runtime.runtimeMode !== "live") throw new Error("IR4 acceptance server did not disclose Live mode.");

  const created = await fetchJson(`${baseUrl}/api/search-tasks`, {
    method: "POST", headers: { ...mutationHeaders, "content-type": "application/json" },
    body: JSON.stringify({ question, requestedMode: "QUICK" })
  }, "Create Search", 202);
  const snapshot = await waitForTerminal(created.runId);
  validateBundle(snapshot);

  const saveResponse = await fetchJson(`${baseUrl}/api/search-runs/${created.runId}/save`, { method: "POST", headers: mutationHeaders }, "Save Search Note");
  const noteId = saveResponse.bundle?.savedNote?.id;
  const suggestedCategory = saveResponse.bundle?.savedNote?.category;
  if (!noteId || !suggestedCategory) throw new Error("Live Save did not return a categorized Search Note.");

  const organized = await fetchJson(`${baseUrl}/api/notes/${noteId}`, {
    method: "PATCH", headers: { ...mutationHeaders, "content-type": "application/json" },
    body: JSON.stringify({ isFavorite: true, category: "LEARNING_RESEARCH", myNotes: "IR4 final Live acceptance" })
  }, "Organize Search Note");
  if (!organized.bundle?.savedNote?.isFavorite || organized.bundle.savedNote.category !== "LEARNING_RESEARCH") throw new Error("Live Note favorite/category update failed.");

  const savedAgain = await fetchJson(`${baseUrl}/api/search-runs/${created.runId}/save`, { method: "POST", headers: mutationHeaders }, "Idempotent Save");
  if (savedAgain.bundle?.savedNote?.category !== "LEARNING_RESEARCH") throw new Error("Idempotent Save overwrote the user-selected category.");

  await terminate(server);
  server = startServer();
  await waitForHttp();
  const reopened = await fetchJson(`${baseUrl}/api/notes/${noteId}`, { cache: "no-store" }, "Reopen Search Note");
  const library = await fetchJson(`${baseUrl}/api/notes`, { cache: "no-store" }, "Reload Library");
  if (!reopened.bundle?.savedNote?.isFavorite || reopened.bundle.savedNote.category !== "LEARNING_RESEARCH" || reopened.bundle.savedNote.myNotes !== "IR4 final Live acceptance") throw new Error("Live Note organization did not survive restart.");
  if (!reopened.bundle?.evidence?.length || !reopened.bundle?.sources?.length || !library.notes?.some((note) => note.id === noteId && note.isFavorite && note.category === "LEARNING_RESEARCH")) throw new Error("Reopened Live Note lost its evidence chain or Library entry.");

  const bundle = snapshot.bundle;
  const record = {
    date: new Date().toISOString(),
    searchProvider: runtime.searchProvider,
    modelProvider: runtime.modelProvider,
    model: runtime.modelProvider === "DeepSeek" ? (fileEnv.DEEPSEEK_MODEL || "configured") : (fileEnv.OPENAI_MODEL || "configured"),
    question,
    terminalState: snapshot.status,
    claims: bundle.claims.length,
    evidence: bundle.evidence.length,
    sources: bundle.sources.length,
    primarySources: bundle.sources.filter((source) => source.isOfficial).length,
    confidence: bundle.result.overallConfidence,
    sourceHosts: [...new Set(bundle.sources.map((source) => new URL(source.canonicalUrl).hostname))],
    sourceUrlsValidated: true,
    exactAnchors: true,
    trustGuards: true,
    suggestedCategory,
    finalCategory: "LEARNING_RESEARCH",
    favorite: true,
    restartReopen: true,
    durationSeconds: Math.round((Date.now() - startedAt) / 1000)
  };
  console.log(`IR4_LIVE_ACCEPTANCE=${JSON.stringify(record)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (serverLog) console.error(serverLog.slice(-4_000));
  process.exitCode = 1;
} finally {
  if (server) await terminate(server);
  await rm(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

function startServer() {
  const child = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: appDir, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...fileEnv, ...process.env, DATABASE_URL: "", SEARCHOS_PGLITE_DATA_DIR: dataDir, SEARCHOS_RUNTIME_MODE: "live" }
  });
  child.stdout.on("data", (chunk) => { serverLog += chunk.toString(); });
  child.stderr.on("data", (chunk) => { serverLog += chunk.toString(); });
  return child;
}

async function waitForHttp() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(`${baseUrl}/api/runtime`, { cache: "no-store" })).ok) return; } catch {}
    await delay(150);
  }
  throw new Error("IR4 Live acceptance server did not start.");
}

async function waitForTerminal(runId) {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const snapshot = await fetchJson(`${baseUrl}/api/search-runs/${runId}`, { cache: "no-store" }, "Read Search Run");
    if (["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(snapshot.status)) {
      if (!["COMPLETED", "PARTIAL"].includes(snapshot.status)) throw new Error(`Live run ended as ${snapshot.status}: ${snapshot.error?.publicMessage ?? "unknown error"}`);
      return snapshot;
    }
    await delay(1_000);
  }
  throw new Error("IR4 Live run did not reach a terminal state.");
}

function validateBundle(snapshot) {
  const bundle = snapshot.bundle;
  if (!bundle?.claims?.length || !bundle.evidence?.length || !bundle.sources?.length) throw new Error("Live result is missing Claim → Evidence → Source objects.");
  const sourceIds = new Set(bundle.sources.map((source) => source.id));
  const snapshotIds = new Set(bundle.snapshots.filter((item) => sourceIds.has(item.sourceId) && ["PARSED", "PARTIAL"].includes(item.parseStatus)).map((item) => item.id));
  const evidenceIds = new Set(bundle.evidence.map((item) => item.id));
  const claimIds = new Set(bundle.claims.map((item) => item.id));
  if (!bundle.evidence.every((item) => item.locator?.blockId && snapshotIds.has(item.snapshotId))) throw new Error("Live Evidence lacks an exact parsed block anchor.");
  if (!bundle.claimEvidence.every((link) => claimIds.has(link.claimId) && evidenceIds.has(link.evidenceId))) throw new Error("Live result contains a dangling Claim → Evidence link.");
  for (const source of bundle.sources) {
    const hostname = new URL(source.canonicalUrl).hostname.toLowerCase().replace(/^www\./u, "");
    if (hostname !== source.domain.toLowerCase().replace(/^www\./u, "")) throw new Error(`Source domain does not match its URL: ${source.domain}`);
  }
  const trustByClaim = new Map(bundle.trustSummaries.map((summary) => [summary.claimId, summary.level]));
  const decisive = bundle.claims.filter((claim) => claim.importance === "DECISIVE");
  const relevant = decisive.length ? decisive : bundle.claims.filter((claim) => claim.importance === "KEY");
  const levels = relevant.map((claim) => trustByClaim.get(claim.id) ?? "INSUFFICIENT");
  if (bundle.result.overallConfidence === "HIGH" && levels.some((level) => level !== "HIGH")) throw new Error("Overall HIGH violated decisive Claim trust guards.");
  if (levels.includes("INSUFFICIENT") && bundle.result.overallConfidence !== "INSUFFICIENT") throw new Error("Insufficient decisive evidence was hidden by Overall Confidence.");
}

async function fetchJson(url, init, context, expectedStatus) {
  const response = await fetch(url, init);
  const body = await response.text();
  let payload;
  try { payload = JSON.parse(body); } catch { throw new Error(`${context} returned non-JSON HTTP ${response.status}.`); }
  if (!response.ok || (expectedStatus && response.status !== expectedStatus)) throw new Error(`${context} failed with HTTP ${response.status}: ${payload.error?.publicMessage ?? "unknown error"}`);
  return payload;
}

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/u).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match) return [];
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/u, "$2")]];
  }));
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function terminate(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([exited, delay(5_000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

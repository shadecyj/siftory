import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "apps", "web");
const dataDir = await mkdtemp(path.join(tmpdir(), "searchos-durable-smoke-"));
const port = 4312;
const baseUrl = `http://127.0.0.1:${port}`;
const goldenQuestion = "Python 怎么删除 dict key？";
const mutationHeaders = { "X-SearchOS-Request": "1" };
let server;

function startServer() {
  const child = spawn(
    process.execPath,
    [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: appDir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DATABASE_URL: "",
        SEARCHOS_PGLITE_DATA_DIR: dataDir,
        SEARCHOS_APP_PREFERENCES_PATH: path.join(dataDir, "preferences.json"),
        SEARCHOS_RUNTIME_MODE: "replay",
        SEARCHOS_STALE_RUN_MS: "1000"
      }
    }
  );
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk.toString(); });
  child.stderr.on("data", (chunk) => { log += chunk.toString(); });
  child.searchOsLog = () => log;
  return child;
}

async function createRun() {
  const response = await fetch(`${baseUrl}/api/search-tasks`, {
    method: "POST",
    headers: { ...mutationHeaders, "content-type": "application/json" },
    body: JSON.stringify({ question: goldenQuestion, requestedMode: "QUICK" })
  });
  const payload = await response.json();
  if (response.status !== 202) throw new Error(`Create failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function readRun(runId) {
  const response = await fetch(`${baseUrl}/api/search-runs/${runId}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Read failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function waitForTerminal(runId) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const snapshot = await readRun(runId);
    if (["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(snapshot.status)) return snapshot;
    await delay(100);
  }
  throw new Error("Run did not reach a terminal state.");
}

try {
  server = startServer();
  await waitForHttp();
  const interrupted = await createRun();
  let runningSnapshot;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    runningSnapshot = await readRun(interrupted.runId);
    if (runningSnapshot.status === "RUNNING" && runningSnapshot.events.length > 0) break;
    await delay(10);
  }
  if (runningSnapshot?.status !== "RUNNING") throw new Error("Could not capture a running checkpoint before restart.");
  await terminate(server);

  await delay(1_200);
  server = startServer();
  await waitForHttp();
  const recovered = await waitForTerminal(interrupted.runId);
  if (recovered.status !== "FAILED" || recovered.error?.code !== "PROCESS_INTERRUPTED") {
    throw new Error(`Stale run was not recovered as PROCESS_INTERRUPTED: ${JSON.stringify(recovered)}`);
  }
  if (!recovered.events.length || recovered.events.length < runningSnapshot.events.length) throw new Error("Recovered run lost its durable events.");

  const created = await createRun();
  const completed = await waitForTerminal(created.runId);
  if (completed.status !== "COMPLETED") throw new Error(`Durable completion failed: ${JSON.stringify(completed)}`);
  const saveResponse = await fetch(`${baseUrl}/api/search-runs/${created.runId}/save`, { method: "POST", headers: mutationHeaders });
  const saved = await saveResponse.json();
  if (!saveResponse.ok || !saved.bundle?.savedNote?.isSaved) throw new Error("Durable Save failed.");
  const noteId = saved.bundle.savedNote.id;
  const organizeResponse = await fetch(`${baseUrl}/api/notes/${noteId}`, {
    method: "PATCH", headers: { ...mutationHeaders, "content-type": "application/json" },
    body: JSON.stringify({ isFavorite: true, category: "LIFE", myNotes: "survives restart" })
  });
  const organized = await organizeResponse.json();
  if (!organizeResponse.ok || organized.bundle?.savedNote?.isFavorite !== true || organized.bundle?.savedNote?.category !== "LIFE") throw new Error("Durable Note organization failed.");
  await terminate(server);

  server = startServer();
  await waitForHttp();
  const afterRestart = await readRun(created.runId);
  if (afterRestart.bundle?.savedNote?.id !== noteId || afterRestart.bundle.savedNote.isSaved !== true || afterRestart.bundle.savedNote.isFavorite !== true || afterRestart.bundle.savedNote.category !== "LIFE" || afterRestart.bundle.savedNote.myNotes !== "survives restart") {
    throw new Error("Completed checkpoint did not survive a process restart.");
  }
  const libraryResponse = await fetch(`${baseUrl}/api/notes`, { cache: "no-store" });
  const library = await libraryResponse.json();
  if (!library.notes?.some((note) => note.id === noteId && note.isSaved && note.isFavorite && note.category === "LIFE" && note.myNotes === "survives restart")) throw new Error("Saved Note organization did not survive a process restart.");
  console.log("PASS: stale recovery + completed checkpoint + saved/favorite/category/My Notes survive process restarts.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (server?.searchOsLog) console.error(server.searchOsLog());
  process.exitCode = 1;
} finally {
  if (server) await terminate(server);
  await rm(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function waitForHttp() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error("Durable smoke server did not start.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminate(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([exited, delay(2_000)]);
}

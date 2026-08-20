const enabled = process.env.RUN_LIVE_SMOKE === "1";
if (!enabled) {
console.log("Live smoke skipped. Set RUN_LIVE_SMOKE=1 after starting Siftory in live mode.");
  process.exit(0);
}

const baseUrl = (process.env.LIVE_SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const question = process.env.LIVE_SMOKE_QUERY ?? "Python 怎么删除 dict key？";
const mutationHeaders = { "X-SearchOS-Request": "1" };
const createdResponse = await fetch(`${baseUrl}/api/search-tasks`, {
  method: "POST", headers: { ...mutationHeaders, "content-type": "application/json" },
  body: JSON.stringify({ question, requestedMode: "QUICK" })
});
const created = await createdResponse.json();
if (createdResponse.status !== 202) throw new Error(`Create Search failed: ${JSON.stringify(created)}`);
if (created.runtimeMode !== "live") throw new Error("Live smoke requires SEARCHOS_RUNTIME_MODE=live on the running server.");

let snapshot;
for (let attempt = 0; attempt < 120; attempt += 1) {
  const response = await fetch(`${baseUrl}/api/search-runs/${created.runId}`, { cache: "no-store" });
  snapshot = await response.json();
  if (["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(snapshot.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

if (!snapshot || !["COMPLETED", "PARTIAL"].includes(snapshot.status)) throw new Error(`Live run failed: ${JSON.stringify(snapshot)}`);
if (!snapshot.bundle?.claims?.length || !snapshot.bundle?.evidence?.length || !snapshot.bundle?.sources?.length) throw new Error("Live result is missing Claim → Evidence → Source objects.");
if (!snapshot.bundle.evidence.every((item) => item.locator?.blockId)) throw new Error("Live result contains Evidence without an exact block locator.");
console.log(JSON.stringify({ status: snapshot.status, provider: snapshot.provider, claims: snapshot.bundle.claims.length, evidence: snapshot.bundle.evidence.length, sources: snapshot.bundle.sources.length, confidence: snapshot.bundle.result.overallConfidence }));

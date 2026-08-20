const enabled = process.env.RUN_LIVE_MATRIX === "1";
if (!enabled) {
console.log("Live matrix skipped. Set RUN_LIVE_MATRIX=1 after starting Siftory in live mode.");
  process.exit(0);
}

const baseUrl = (process.env.LIVE_SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const mutationHeaders = { "X-SearchOS-Request": "1" };
const questions = [
  "Node.js 中 AbortController 如何取消 fetch 请求？",
  "HTTP 304 和 200 响应有什么区别？",
  "DeepSeek API 如何启用 JSON Output？"
];

async function jsonResponse(response, context) {
  const body = await response.text();
  if (!body) throw new Error(`${context} returned an empty HTTP ${response.status} response.`);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${context} returned non-JSON HTTP ${response.status}.`);
  }
}

async function runQuestion(question) {
  const createdResponse = await fetch(`${baseUrl}/api/search-tasks`, {
    method: "POST",
    headers: { ...mutationHeaders, "content-type": "application/json" },
    body: JSON.stringify({ question, requestedMode: "QUICK" })
  });
  const created = await jsonResponse(createdResponse, "Create Search");
  if (createdResponse.status !== 202) throw new Error(`Create Search failed: ${JSON.stringify(created)}`);
  if (created.runtimeMode !== "live") throw new Error("Live matrix requires SEARCHOS_RUNTIME_MODE=live.");

  let snapshot;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/search-runs/${created.runId}`, { cache: "no-store" });
    snapshot = await jsonResponse(response, "Read Search Run");
    if (["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(snapshot.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  if (!snapshot || !["COMPLETED", "PARTIAL"].includes(snapshot.status)) {
    throw new Error(`Live run failed: ${JSON.stringify(snapshot?.error ?? snapshot)}`);
  }

  const bundle = snapshot.bundle;
  if (!bundle?.claims?.length || !bundle.evidence?.length || !bundle.sources?.length) {
    throw new Error("Live result is missing Claim → Evidence → Source objects.");
  }
  if (!bundle.evidence.every((item) => item.locator?.blockId)) {
    throw new Error("Live result contains Evidence without an exact block locator.");
  }

  const claimIds = new Set(bundle.claims.map((claim) => claim.id));
  const evidenceIds = new Set(bundle.evidence.map((evidence) => evidence.id));
  if (!bundle.claimEvidence.every((link) => claimIds.has(link.claimId) && evidenceIds.has(link.evidenceId))) {
    throw new Error("Live result contains a dangling Claim → Evidence link.");
  }

  const hosts = [...new Set(bundle.sources.map((source) => new URL(source.canonicalUrl).hostname))];
  const trust = bundle.trustSummaries.reduce((counts, summary) => {
    counts[summary.level] = (counts[summary.level] ?? 0) + 1;
    return counts;
  }, {});

  return {
    question,
    status: snapshot.status,
    provider: snapshot.provider,
    claims: bundle.claims.length,
    evidence: bundle.evidence.length,
    sources: bundle.sources.length,
    primarySources: bundle.sources.filter((source) => source.isOfficial).length,
    confidence: bundle.result.overallConfidence,
    trust,
    hosts
  };
}

const results = [];
for (const question of questions) {
  const result = await runQuestion(question);
  results.push(result);
  console.log(JSON.stringify(result));
}

console.log(JSON.stringify({ matrix: "PASS", completed: results.length }));

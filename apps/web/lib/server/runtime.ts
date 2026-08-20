import { QuickAgentError, runQuickSearch } from "@searchos/agent";
import type { ApiErrorResponse, CreateSearchRequest, OutputLocale, RunEvent, RuntimeMode, RuntimeRunResponse, SearchBundle, UpdateSearchNoteRequest } from "@searchos/contracts";
import type { ModelGateway, RequestedMode, RunTrigger } from "@searchos/domain";
import type { ModelRequest } from "@searchos/domain";
import { DeepSeekModelGateway, ModelGatewayError, OpenAIModelGateway, ReplayModelGateway } from "@searchos/model-gateways";
import {
  appendDurableRunEvent, createDurableRun, findRunIdBySavedNote, listSavedNotes, listStaleDurableRuns,
  persistBundle, persistRuntimeArtifacts, readDurableRun, readDurableRunByTask, requestDurableRunCancellation,
  saveNoteFromRun, updateNoteFields, writeDurableRunCheckpoint, type DurableRunCheckpoint
} from "@searchos/persistence";
import { suggestCategory } from "@searchos/presentation";
import { BraveSearchProvider, ReplaySearchProvider, RetrievalError, SafeHttpContentFetcher, TavilySearchProvider } from "@searchos/retrieval";
import { database } from "./database";
import { LiveRuntimeConfigurationError, liveConfigurationPublicMessage, parseLiveRuntimeConfig } from "./live-config";

const replayQuestions: Record<OutputLocale, string> = {
  "zh-CN": "Python 怎么删除 dict key？",
  "en-US": "How do I delete a dict key in Python?"
};
const replayHtml = `
  <title>Python Mapping Types — dict</title>
  <h2>del d[key]</h2>
  <p>Remove d[key] from d. Raises a KeyError if key is not in the map.</p>
  <h2>dict.pop</h2>
  <p>If key is in the dictionary, remove it and return its value, else return default.</p>
`;

export interface RuntimeRecord {
  readonly taskId: string;
  readonly runId: string;
  readonly question: string;
  readonly requestedMode: RequestedMode;
  readonly outputLocale: OutputLocale;
  readonly parentRunId: string | null;
  readonly trigger: RunTrigger;
  readonly runtimeMode: RuntimeMode;
  readonly controller: AbortController;
  provider: string;
  status: RuntimeRunResponse["status"];
  currentStage: RuntimeRunResponse["currentStage"];
  events: RunEvent[];
  bundle: SearchBundle | null;
  queries: RuntimeRunResponse["queries"];
  retrievalAttempts: RuntimeRunResponse["retrievalAttempts"];
  excludedSources: RuntimeRunResponse["excludedSources"];
  error: ApiErrorResponse["error"] | null;
}

function runtimeMode(): RuntimeMode { return process.env.SEARCHOS_RUNTIME_MODE === "live" ? "live" : "replay"; }

function replayGateway(outputLocale: OutputLocale): ModelGateway {
  const english = outputLocale === "en-US";
  return new ReplayModelGateway({
    "quick-intent": (request: ModelRequest<unknown>) => {
      const input = JSON.parse(request.input) as { question: string };
      const compare = /(?:对比|比较|区别|怎么选|\bvs\b)/i.test(input.question);
      const research = /(?:技术路线|研究现状|综述|系统梳理|有哪些路线)/i.test(input.question);
      return {
        normalizedQuestion: input.question,
        selectedMode: research ? "RESEARCH" : compare ? "COMPARE" : "QUICK",
        modeConfidence: 0.96,
        entities: ["Python", "dict", "key"],
        constraints: { runtime: "Python 3" },
        freshnessRequirement: "VERSIONED",
        ambiguityNotes: [],
        assumptions: [english ? "The question refers to Python 3's built-in dict." : "问题指 Python 3 内置 dict。"]
      };
    },
    "quick-plan": english
      ? {
          objective: "Verify the standard Python dict key deletion operations and their missing-key behavior.",
          steps: [{
            goal: "Query the Python documentation",
            queries: ["site:docs.python.org dict del pop key"],
            preferredSourceTypes: ["OFFICIAL_DOC"],
            completionCriteria: ["Find official evidence that directly describes deletion behavior"]
          }],
          stopConditions: ["The key conclusion has direct evidence"]
        }
      : {
          objective: "确认 Python 删除字典键的标准方式与缺失键行为。",
          steps: [{
            goal: "查询 Python 官方文档",
            queries: ["site:docs.python.org dict del pop key"],
            preferredSourceTypes: ["OFFICIAL_DOC"],
            completionCriteria: ["找到直接说明删除行为的官方证据"]
          }],
          stopConditions: ["关键结论得到直接证据"]
        },
    "quick-extract": (request: ModelRequest<unknown>) => {
      const input = JSON.parse(request.input) as { passages: Array<{ snapshotId: string; blockId: string; text: string }> };
      const del = input.passages.find((passage) => passage.text.startsWith("Remove d[key]"))!;
      const pop = input.passages.find((passage) => passage.text.startsWith("If key is in"))!;
      return {
        claims: english
          ? [
              {
                statement: "del data[key] removes the key directly; it raises KeyError when the key is absent.",
                normalizedStatement: "python dict del removes key and raises keyerror when missing",
                claimType: "PROCEDURE",
                importance: "DECISIVE",
                scope: { runtime: "Python 3" },
                evidence: [{
                  snapshotId: del.snapshotId,
                  blockId: del.blockId,
                  exactExcerpt: del.text,
                  paraphrase: "del removes the requested key and raises KeyError for a missing key.",
                  stance: "SUPPORTS",
                  relevance: "DIRECT"
                }]
              },
              {
                statement: "data.pop(key, default) removes the key and returns its value; default handles an absent key.",
                normalizedStatement: "python dict pop removes key returns value and default handles missing",
                claimType: "PROCEDURE",
                importance: "KEY",
                scope: { runtime: "Python 3" },
                evidence: [{
                  snapshotId: pop.snapshotId,
                  blockId: pop.blockId,
                  exactExcerpt: pop.text,
                  paraphrase: "pop removes and returns the key's value, returning default when the key is absent.",
                  stance: "SUPPORTS",
                  relevance: "DIRECT"
                }]
              }
            ]
          : [
              {
                statement: "使用 del data[key] 可直接删除键；键不存在时会抛出 KeyError。",
                normalizedStatement: "python dict del removes key and raises keyerror when missing",
                claimType: "PROCEDURE",
                importance: "DECISIVE",
                scope: { runtime: "Python 3" },
                evidence: [{
                  snapshotId: del.snapshotId,
                  blockId: del.blockId,
                  exactExcerpt: del.text,
                  paraphrase: "del 删除指定键，缺失键时抛出 KeyError。",
                  stance: "SUPPORTS",
                  relevance: "DIRECT"
                }]
              },
              {
                statement: "使用 data.pop(key, default) 可删除键并返回值，提供 default 可处理缺失键。",
                normalizedStatement: "python dict pop removes key returns value and default handles missing",
                claimType: "PROCEDURE",
                importance: "KEY",
                scope: { runtime: "Python 3" },
                evidence: [{
                  snapshotId: pop.snapshotId,
                  blockId: pop.blockId,
                  exactExcerpt: pop.text,
                  paraphrase: "pop 删除并返回值，缺失时返回 default。",
                  stance: "SUPPORTS",
                  relevance: "DIRECT"
                }]
              }
            ]
      };
    },
    "quick-synthesis": english
      ? {
          title: "Delete a Python dict key",
          summary: "Use del when the key is known to exist; use pop when you need its value or want a missing-key default.",
          answer: "Use del data[key] when the key is known to exist. Use data.pop(key, default) when you also need the removed value or want to safely handle a missing key.",
          bullets: [
            { text: "Direct deletion: del data[key]", claimIndexes: [0] },
            { text: "Safe deletion with a return value: data.pop(key, None)", claimIndexes: [1] }
          ],
          limitations: ["The result applies to Python 3's built-in dict."]
        }
      : {
          title: "删除 Python 字典键",
          summary: "已知键存在时用 del；需要返回值或安全处理缺失键时用 pop。",
          answer: "已知键存在时使用 del data[key]。需要同时取得被删除的值，或安全处理键不存在的情况时，使用 data.pop(key, default)。",
          bullets: [
            { text: "直接删除：del data[key]", claimIndexes: [0] },
            { text: "安全删除并返回值：data.pop(key, None)", claimIndexes: [1] }
          ],
          limitations: ["结论针对 Python 3 内置 dict。"]
        }
  });
}

function createDependencies(mode: RuntimeMode, outputLocale: OutputLocale) {
  if (mode === "replay") {
    return {
      modelGateway: replayGateway(outputLocale),
      searchProvider: new ReplaySearchProvider([{ url: "https://docs.python.org/3/library/stdtypes.html#mapping-types-dict", title: "Mapping Types — dict", snippet: "Python dict deletion", rank: 1, provider: "replay", language: "en" }]),
      contentFetcher: { fetch: async (_source: unknown, signal?: AbortSignal) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 220);
          signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
        });
        return { requestedUrl: "https://docs.python.org/3/library/stdtypes.html#mapping-types-dict", finalUrl: "https://docs.python.org/3/library/stdtypes.html#mapping-types-dict", statusCode: 200, contentType: "text/html", body: replayHtml, fetchedAt: new Date().toISOString(), redirectChain: [], truncated: false };
      } },
      provider: "replay"
    };
  }
  const config = parseLiveRuntimeConfig(process.env);
  const modelGateway = config.modelProvider === "deepseek"
    ? new DeepSeekModelGateway({ apiKey: config.modelApiKey, model: config.model, ...(config.modelBaseUrl ? { baseUrl: config.modelBaseUrl } : {}) })
    : new OpenAIModelGateway({ apiKey: config.modelApiKey, model: config.model });
  return {
    modelGateway,
    searchProvider: config.searchProvider === "tavily"
      ? new TavilySearchProvider(config.searchApiKey)
      : new BraveSearchProvider(config.searchApiKey),
    contentFetcher: new SafeHttpContentFetcher({ userAgent: process.env.SEARCHOS_FETCH_USER_AGENT ?? "Siftory/0.1" }),
    provider: `${config.searchProvider} + ${config.modelProvider}`
  };
}

function publicError(error: unknown, currentStage: RuntimeRecord["currentStage"], outputLocale: OutputLocale): ApiErrorResponse["error"] {
  if (error instanceof QuickAgentError) return { code: error.code, stage: currentStage, retryable: !["MODE_NOT_AVAILABLE", "QUERY_TOO_BROAD"].includes(error.code), publicMessage: error.message, retainedObjectCounts: {} };
  if (error instanceof RetrievalError) return { code: error.code, stage: currentStage, retryable: error.retryable, publicMessage: error.message, retainedObjectCounts: {} };
  if (error instanceof ModelGatewayError) return { code: error.code === "MODEL_ABORTED" ? "RUN_CANCELLED" : error.code, stage: currentStage, retryable: error.retryable, publicMessage: error.message, retainedObjectCounts: {} };
  if (error instanceof LiveRuntimeConfigurationError) return { code: "PROVIDER_NOT_CONFIGURED", stage: currentStage, retryable: false, publicMessage: liveConfigurationPublicMessage, retainedObjectCounts: {} };
  if (error instanceof DOMException && error.name === "AbortError") return { code: "RUN_CANCELLED", stage: currentStage, retryable: true, publicMessage: publicRuntimeMessage(outputLocale, "本次搜索已取消。", "This search was cancelled."), retainedObjectCounts: {} };
  return { code: "INTERNAL_PIPELINE_ERROR", stage: currentStage, retryable: true, publicMessage: publicRuntimeMessage(outputLocale, "搜索流程暂时无法完成，请重试。", "The search pipeline could not complete. Please try again."), retainedObjectCounts: {} };
}

function publicRuntimeMessage(outputLocale: OutputLocale, chinese: string, english: string): string {
  return outputLocale === "en-US" ? english : chinese;
}

function retainedObjectCounts(record: RuntimeRecord): Record<string, number> {
  const lastExtraction = [...record.events].reverse().find((event) => event.eventType === "EXTRACTION_COMPLETED");
  const numericPayload = (key: string) => {
    const value = lastExtraction?.payloadSummary[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return {
    events: record.events.length,
    queries: record.events.filter((event) => event.eventType === "QUERY_COMPLETED").length,
    sources: record.events.filter((event) => event.eventType === "SOURCE_FETCHED").length,
    claims: numericPayload("claimCount"),
    evidence: numericPayload("evidenceCount")
  };
}

const ownerId = "00000000-0000-7000-8000-000000000001";
const activeRecords = new Map<string, RuntimeRecord>();
const writeChains = new Map<string, Promise<void>>();
let recoveryPromise: Promise<void> | undefined;

/**
 * Deliberately exposes only the count needed to prevent a destructive
 * sidecar restart. Runtime records, requests and credentials stay private.
 */
export function getActiveRuntimeRunCount(): number {
  return [...activeRecords.values()].filter((record) => record.status === "QUEUED" || record.status === "RUNNING").length;
}

function checkpoint(record: RuntimeRecord): DurableRunCheckpoint {
  return { version: 1, question: record.question, requestedMode: record.requestedMode, parentRunId: record.parentRunId, trigger: record.trigger, response: serializeRuntimeRecord(record), updatedAt: new Date().toISOString() };
}

function queueCheckpoint(record: RuntimeRecord, event?: RunEvent): Promise<void> {
  const previous = writeChains.get(record.runId) ?? Promise.resolve();
  const next = previous.then(async () => {
    const db = await database();
    if (event) await appendDurableRunEvent(db, event);
    await writeDurableRunCheckpoint(db, checkpoint(record));
  });
  writeChains.set(record.runId, next.catch(() => undefined));
  return next;
}

function recordFromCheckpoint(stored: Awaited<ReturnType<typeof readDurableRun>>): RuntimeRecord | undefined {
  if (!stored) return undefined;
  const { response } = stored.checkpoint;
  return {
    taskId: response.taskId,
    runId: response.runId,
    question: stored.checkpoint.question,
    requestedMode: stored.checkpoint.requestedMode,
    outputLocale: response.outputLocale ?? "zh-CN",
    parentRunId: stored.checkpoint.parentRunId ?? null,
    trigger: stored.checkpoint.trigger ?? "INITIAL",
    runtimeMode: response.runtimeMode,
    controller: new AbortController(),
    provider: response.provider,
    status: response.status,
    currentStage: response.currentStage,
    events: [...response.events],
    bundle: response.bundle,
    queries: [...response.queries],
    retrievalAttempts: [...response.retrievalAttempts],
    excludedSources: [...response.excludedSources],
    error: response.error
  };
}

async function recoverStaleRuns(): Promise<void> {
  const db = await database();
  const staleMs = Number(process.env.SEARCHOS_STALE_RUN_MS ?? 15_000);
  const staleBefore = new Date(Date.now() - Math.max(1_000, staleMs)).toISOString();
  for (const stored of await listStaleDurableRuns(db, staleBefore)) {
    if (activeRecords.has(stored.runId)) continue;
    const record = recordFromCheckpoint(stored);
    if (!record || !["QUEUED", "RUNNING"].includes(record.status)) continue;
    const event: RunEvent = {
      id: crypto.randomUUID(), runId: record.runId, sequence: record.events.length + 1, eventType: "RUN_FAILED",
      fromState: record.currentStage, toState: "FAILED",
      summary: publicRuntimeMessage(record.outputLocale, "运行进程中断，已保留检查点，可创建新运行重试。", "The runtime process was interrupted. Its checkpoint was retained and you can create a new retry run."),
      payloadSummary: { errorCode: "PROCESS_INTERRUPTED" }, createdAt: new Date().toISOString()
    };
    record.events.push(event);
    record.status = "FAILED";
    record.currentStage = "FAILED";
    record.error = {
      code: "PROCESS_INTERRUPTED",
      stage: event.fromState,
      retryable: true,
      publicMessage: publicRuntimeMessage(record.outputLocale, "运行进程意外中断；已完成的事件和对象仍然保留，请重试。", "The runtime process was interrupted. Completed events and objects remain available; please retry."),
      retainedObjectCounts: { events: record.events.length, queries: record.queries.length }
    };
    await appendDurableRunEvent(db, event);
    await writeDurableRunCheckpoint(db, checkpoint(record));
  }
}

function ensureRecovery(): Promise<void> {
  recoveryPromise ??= recoverStaleRuns();
  return recoveryPromise;
}

export async function createRuntimeRecord(input: CreateSearchRequest, lineage: { taskId?: string; parentRunId?: string | null; trigger?: RunTrigger } = {}): Promise<RuntimeRecord> {
  const mode = runtimeMode();
  const taskId = lineage.taskId ?? crypto.randomUUID();
  const runId = crypto.randomUUID();
  const record: RuntimeRecord = {
    taskId, runId, question: input.question, requestedMode: input.requestedMode, outputLocale: input.outputLocale ?? "zh-CN", runtimeMode: mode,
    parentRunId: lineage.parentRunId ?? null, trigger: lineage.trigger ?? "INITIAL",
    controller: new AbortController(), provider: mode === "replay" ? "replay" : "pending", status: "QUEUED", currentStage: "CREATED",
    events: [], bundle: null, queries: [], retrievalAttempts: [], excludedSources: [], error: null
  };
  activeRecords.set(runId, record);
  await createDurableRun(await database(), { ownerId, checkpoint: checkpoint(record) });
  setTimeout(() => { void executeRecord(record); }, 0);
  return record;
}

async function executeRecord(record: RuntimeRecord): Promise<void> {
  record.status = "RUNNING";
  await queueCheckpoint(record);
  const heartbeat = setInterval(() => { void queueCheckpoint(record); }, 5_000);
  try {
    if (record.runtimeMode === "replay" && record.question.trim() !== replayQuestions[record.outputLocale]) {
      throw new Error("REPLAY_QUERY_NOT_AVAILABLE");
    }
    const dependencies = createDependencies(record.runtimeMode, record.outputLocale);
    record.provider = dependencies.provider;
    const result = await runQuickSearch({
      question: record.question, requestedMode: record.requestedMode, outputLocale: record.outputLocale,
      parentRunId: record.parentRunId, trigger: record.trigger,
      ids: { task: record.taskId, run: record.runId, owner: ownerId, note: crypto.randomUUID() },
      signal: record.controller.signal,
      onEvent: (event) => {
        record.events.push(event);
        record.currentStage = event.toState;
        void queueCheckpoint(record, event);
      }
    }, dependencies);
    record.bundle = result.bundle;
    record.queries = [...result.queries];
    record.retrievalAttempts = [...result.retrievalAttempts];
    record.excludedSources = [...result.excludedSources];
    record.status = result.bundle.run.state === "PARTIAL" ? "PARTIAL" : "COMPLETED";
    record.currentStage = result.bundle.run.currentStage;
    const db = await database();
    await persistBundle(db, result.bundle);
    await persistRuntimeArtifacts(db, { queries: result.queries, attempts: result.retrievalAttempts, documents: result.documents, excludedSources: result.excludedSources });
  } catch (error) {
    if (record.controller.signal.aborted) {
      record.error = {
        code: "RUN_CANCELLED",
        stage: record.currentStage,
        retryable: true,
        publicMessage: publicRuntimeMessage(record.outputLocale, "本次搜索已取消；已完成的活动记录仍然保留。", "This search was cancelled; completed activity remains available."),
        retainedObjectCounts: {}
      };
      record.events.push({ id: crypto.randomUUID(), runId: record.runId, sequence: record.events.length + 1, eventType: "RUN_CANCELLED", fromState: record.currentStage, toState: "CANCELLED", summary: publicRuntimeMessage(record.outputLocale, "搜索已按用户请求停止。", "The search was stopped at the user's request."), payloadSummary: {}, createdAt: new Date().toISOString() });
    } else if (error instanceof Error && error.message === "REPLAY_QUERY_NOT_AVAILABLE") {
      record.error = {
        code: "PROVIDER_NOT_CONFIGURED",
        stage: record.currentStage,
        retryable: false,
        publicMessage: publicRuntimeMessage(
          record.outputLocale,
          "Replay 模式只提供金丝雀示例。请使用示例问题，或配置 live Provider 后搜索任意 Quick 问题。",
          "Replay mode provides only its canary example. Use the example question or configure a live provider to search any Quick question."
        ),
        retainedObjectCounts: {}
      };
    } else {
      const mapped = publicError(error, record.currentStage, record.outputLocale);
      record.error = { ...mapped, retainedObjectCounts: retainedObjectCounts(record) };
    }
    record.error = { ...record.error, retainedObjectCounts: retainedObjectCounts(record) };
    record.status = record.error.code === "RUN_CANCELLED" || record.controller.signal.aborted ? "CANCELLED" : "FAILED";
    record.currentStage = record.status === "CANCELLED" ? "CANCELLED" : "FAILED";
    if (record.status === "FAILED") {
      record.events.push({ id: crypto.randomUUID(), runId: record.runId, sequence: record.events.length + 1, eventType: "RUN_FAILED", fromState: record.error.stage, toState: "FAILED", summary: record.error.publicMessage, payloadSummary: { errorCode: record.error.code }, createdAt: new Date().toISOString() });
    }
  } finally {
    clearInterval(heartbeat);
    const terminalEvent = record.events.at(-1);
    if (terminalEvent && ["RUN_CANCELLED", "RUN_FAILED"].includes(terminalEvent.eventType)) await queueCheckpoint(record, terminalEvent);
    else await queueCheckpoint(record);
    activeRecords.delete(record.runId);
  }
}

export async function getRuntimeRecord(runId: string): Promise<RuntimeRecord | undefined> {
  await ensureRecovery();
  return activeRecords.get(runId) ?? recordFromCheckpoint(await readDurableRun(await database(), runId));
}
export async function getTaskRecord(taskId: string): Promise<RuntimeRecord | undefined> {
  await ensureRecovery();
  return recordFromCheckpoint(await readDurableRunByTask(await database(), taskId));
}
export async function cancelRuntimeRecord(runId: string): Promise<RuntimeRecord | undefined> {
  const record = activeRecords.get(runId) ?? await getRuntimeRecord(runId);
  if (!record || record.status !== "RUNNING") return record;
  const event: RunEvent = { id: crypto.randomUUID(), runId: record.runId, sequence: record.events.length + 1, eventType: "CANCEL_REQUESTED", fromState: record.currentStage, toState: record.currentStage, summary: publicRuntimeMessage(record.outputLocale, "用户请求停止本次搜索。", "The user requested that this search stop."), payloadSummary: {}, createdAt: new Date().toISOString() };
  record.events.push(event);
  record.controller.abort();
  await requestDurableRunCancellation(await database(), runId, event.createdAt);
  await queueCheckpoint(record, event);
  return record;
}
export async function saveRuntimeNote(runId: string): Promise<RuntimeRecord | undefined> {
  const record = await getRuntimeRecord(runId);
  if (!record?.bundle) return record;
  const savedAt = new Date().toISOString();
  const category = suggestCategory(record.question, record.bundle.claims);
  const note = await saveNoteFromRun(await database(), record.bundle.savedNote.id, ownerId, savedAt, category);
  record.bundle = { ...record.bundle, savedNote: note };
  await queueCheckpoint(record);
  return record;
}
export async function listSavedRuntimeNotes() {
  return listSavedNotes(await database(), ownerId);
}
export async function getRuntimeRecordByNote(noteId: string): Promise<RuntimeRecord | undefined> {
  const runId = await findRunIdBySavedNote(await database(), noteId, ownerId);
  return runId ? getRuntimeRecord(runId) : undefined;
}
export async function updateRuntimeNote(noteId: string, patch: UpdateSearchNoteRequest): Promise<RuntimeRecord | undefined> {
  const record = await getRuntimeRecordByNote(noteId);
  if (!record?.bundle) return record;
  const note = await updateNoteFields(await database(), noteId, ownerId, patch, new Date().toISOString());
  record.bundle = { ...record.bundle, savedNote: note };
  await queueCheckpoint(record);
  return record;
}
export async function updateRuntimeMyNotes(noteId: string, myNotes: string): Promise<RuntimeRecord | undefined> {
  return updateRuntimeNote(noteId, { myNotes });
}
export function serializeRuntimeRecord(record: RuntimeRecord): RuntimeRunResponse {
  const failureActions = record.error?.retryable ? ["RETRY", "EDIT_QUERY"] as const : ["EDIT_QUERY"] as const;
  return {
    taskId: record.taskId, runId: record.runId, runtimeMode: record.runtimeMode, provider: record.provider, outputLocale: record.outputLocale,
    status: record.status, currentStage: record.currentStage, events: record.events, bundle: record.bundle,
    queries: record.queries, retrievalAttempts: record.retrievalAttempts, excludedSources: record.excludedSources,
    error: record.error, availableActions: record.status === "RUNNING" ? ["CANCEL"] : record.bundle ? ["SAVE", "RETRY", "EDIT_QUERY"] : [...failureActions]
  };
}

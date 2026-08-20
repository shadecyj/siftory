import { CreateSearchRequestSchema } from "@searchos/contracts";
import { createRuntimeRecord, getRuntimeRecord } from "../../../../../lib/server/runtime";
import { rejectUntrustedMutationRequest } from "../../../../../lib/server/request-security";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const rejected = rejectUntrustedMutationRequest(request);
  if (rejected) return rejected;
  const { runId } = await params;
  const previous = await getRuntimeRecord(runId);
  if (!previous) return Response.json({ error: { code: "NOT_FOUND", stage: null, retryable: false, publicMessage: "未找到可重试的搜索运行。", retainedObjectCounts: {} } }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const parsed = CreateSearchRequestSchema.parse({
    question: typeof body.question === "string" ? body.question : previous.question,
    requestedMode: typeof body.requestedMode === "string" ? body.requestedMode : previous.requestedMode,
    outputLocale: typeof body.outputLocale === "string" ? body.outputLocale : previous.outputLocale
  });
  const record = await createRuntimeRecord(parsed, { taskId: previous.taskId, parentRunId: previous.runId, trigger: "RETRY" });
  return Response.json({ taskId: record.taskId, runId: record.runId, selectedMode: "QUICK", runtimeMode: record.runtimeMode, outputLocale: record.outputLocale, eventsUrl: `/api/search-runs/${record.runId}/events` }, { status: 202 });
}

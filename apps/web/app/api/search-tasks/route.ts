import { CreateSearchRequestSchema } from "@searchos/contracts";
import { createRuntimeRecord } from "../../../lib/server/runtime";
import { rejectUntrustedMutationRequest } from "../../../lib/server/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rejected = rejectUntrustedMutationRequest(request);
  if (rejected) return rejected;
  const parsed = CreateSearchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "INVALID_REQUEST", stage: null, retryable: false, publicMessage: "请输入有效的搜索问题。", retainedObjectCounts: {} } }, { status: 400 });
  try {
    const record = await createRuntimeRecord(parsed.data);
    return Response.json({ taskId: record.taskId, runId: record.runId, selectedMode: "QUICK", runtimeMode: record.runtimeMode, outputLocale: record.outputLocale, eventsUrl: `/api/search-runs/${record.runId}/events` }, { status: 202 });
  } catch {
    return Response.json({ error: { code: "INTERNAL_PIPELINE_ERROR", stage: "CREATED", retryable: true, publicMessage: "搜索任务暂时无法启动，请重试。", retainedObjectCounts: {} } }, { status: 500 });
  }
}

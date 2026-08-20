import { cancelRuntimeRecord, serializeRuntimeRecord } from "../../../../../lib/server/runtime";
import { rejectUntrustedMutationRequest } from "../../../../../lib/server/request-security";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const rejected = rejectUntrustedMutationRequest(request);
  if (rejected) return rejected;
  const { runId } = await params;
  const record = await cancelRuntimeRecord(runId);
  if (!record) return Response.json({ error: { code: "NOT_FOUND", stage: null, retryable: false, publicMessage: "未找到该搜索运行。", retainedObjectCounts: {} } }, { status: 404 });
  return Response.json(serializeRuntimeRecord(record), { status: 202 });
}

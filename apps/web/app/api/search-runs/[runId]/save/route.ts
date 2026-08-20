import { saveRuntimeNote, serializeRuntimeRecord } from "../../../../../lib/server/runtime";
import { rejectUntrustedMutationRequest } from "../../../../../lib/server/request-security";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const rejected = rejectUntrustedMutationRequest(request);
  if (rejected) return rejected;
  const { runId } = await params;
  const record = await saveRuntimeNote(runId);
  if (!record?.bundle) return Response.json({ error: { code: "NOT_FOUND", stage: null, retryable: false, publicMessage: "当前没有可保存的搜索结果。", retainedObjectCounts: {} } }, { status: 404 });
  return Response.json(serializeRuntimeRecord(record));
}

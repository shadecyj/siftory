import { getRuntimeRecord, serializeRuntimeRecord } from "../../../../lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const record = await getRuntimeRecord(runId);
  if (!record) return Response.json({ error: { code: "NOT_FOUND", stage: null, retryable: false, publicMessage: "未找到该搜索运行。", retainedObjectCounts: {} } }, { status: 404 });
  return Response.json(serializeRuntimeRecord(record), { headers: { "cache-control": "no-store" } });
}

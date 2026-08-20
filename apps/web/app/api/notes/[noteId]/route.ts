import { UpdateSearchNoteRequestSchema } from "@searchos/contracts";
import { getRuntimeRecordByNote, updateRuntimeNote } from "../../../../lib/server/runtime";
import { rejectUntrustedMutationRequest } from "../../../../lib/server/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  const record = await getRuntimeRecordByNote(noteId);
  if (!record?.bundle) return Response.json({ error: { code: "NOT_FOUND", stage: null, retryable: false, publicMessage: "未找到该 Search Note。", retainedObjectCounts: {} } }, { status: 404 });
  return Response.json({ bundle: record.bundle }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const rejected = rejectUntrustedMutationRequest(request);
  if (rejected) return rejected;
  const { noteId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = UpdateSearchNoteRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_REQUEST", stage: null, retryable: false, publicMessage: "笔记更新内容无效，请检查分类、收藏或个人笔记。", retainedObjectCounts: {} } }, { status: 400 });
  const record = await updateRuntimeNote(noteId, parsed.data);
  if (!record?.bundle) return Response.json({ error: { code: "NOT_FOUND", stage: null, retryable: false, publicMessage: "未找到该 Search Note。", retainedObjectCounts: {} } }, { status: 404 });
  return Response.json({ bundle: record.bundle }, { headers: { "cache-control": "no-store" } });
}

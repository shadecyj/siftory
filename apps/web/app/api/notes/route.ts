import { listSavedRuntimeNotes } from "../../../lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ notes: await listSavedRuntimeNotes() }, { headers: { "cache-control": "no-store" } });
}

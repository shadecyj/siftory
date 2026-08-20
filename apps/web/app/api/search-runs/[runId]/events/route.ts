import { getRuntimeRecord } from "../../../../../lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!await getRuntimeRecord(runId)) return new Response("Not found", { status: 404 });
  const after = Number(new URL(request.url).searchParams.get("afterSequence") ?? request.headers.get("last-event-id") ?? 0);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let sequence = Number.isFinite(after) ? after : 0;
      let pushing = false;
      const push = async () => {
        if (pushing) return;
        pushing = true;
        const record = await getRuntimeRecord(runId);
        if (!record) { controller.close(); return; }
        for (const event of record.events.filter((item) => item.sequence > sequence)) {
          controller.enqueue(encoder.encode(`id: ${event.sequence}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`));
          sequence = event.sequence;
        }
        if (["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(record.status)) { clearInterval(timer); controller.close(); }
        pushing = false;
      };
      const timer = setInterval(() => { void push(); }, 250);
      void push();
      request.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try { controller.close(); } catch { /* The terminal event may have closed the stream first. */ }
      }, { once: true });
    }
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}

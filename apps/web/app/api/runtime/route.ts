import type { RuntimeMode } from "@searchos/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const runtimeMode: RuntimeMode = process.env.SEARCHOS_RUNTIME_MODE?.trim().toLowerCase() === "live" ? "live" : "replay";
  const searchProvider = runtimeMode === "live" && process.env.SEARCH_PROVIDER?.trim().toLowerCase() === "brave" ? "Brave" : runtimeMode === "live" ? "Tavily" : "Replay";
  const modelProvider = runtimeMode === "live" && process.env.MODEL_PROVIDER?.trim().toLowerCase() === "openai" ? "OpenAI" : runtimeMode === "live" ? "DeepSeek" : "Replay";
  return Response.json({ runtimeMode, searchProvider, modelProvider }, { headers: { "cache-control": "no-store" } });
}

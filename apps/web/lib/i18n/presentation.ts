import type { ApiErrorResponse, RunEvent, RunEventType } from "@searchos/contracts";
import type { RunState } from "@searchos/domain";
import type { Locale } from "./locale";
import { translate, type MessageKey } from "./translate";

export interface LocalizedProgressStage {
  readonly state: Extract<RunState, "UNDERSTANDING" | "RETRIEVING" | "EVALUATING" | "SYNTHESIZING">;
  readonly label: string;
  readonly copy: string;
}

const progressStageKeys = [
  ["UNDERSTANDING", "progress.understanding.label", "progress.understanding.copy"],
  ["RETRIEVING", "progress.retrieving.label", "progress.retrieving.copy"],
  ["EVALUATING", "progress.evaluating.label", "progress.evaluating.copy"],
  ["SYNTHESIZING", "progress.synthesizing.label", "progress.synthesizing.copy"]
] as const;

export function getProgressStages(locale: Locale): readonly LocalizedProgressStage[] {
  return progressStageKeys.map(([state, label, copy]) => ({ state, label: translate(locale, label), copy: translate(locale, copy) }));
}

export function formatRunState(locale: Locale, state: RunState): string {
  return translate(locale, `runState.${state}` as MessageKey);
}

export function formatRunStatus(locale: Locale, status: "QUEUED" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED"): string {
  return translate(locale, `run.status.${status}` as MessageKey);
}

export function formatApiError(locale: Locale, error: ApiErrorResponse["error"] | null | undefined, fallback: string): string {
  if (error?.code) return translate(locale, `error.${error.code}` as MessageKey);
  return fallback;
}

export function formatRunEvent(locale: Locale, event: Pick<RunEvent, "eventType" | "payloadSummary" | "summary">): { title: string; detail: string } {
  const eventType = event.eventType as RunEventType;
  const payload = event.payloadSummary;
  const query = getString(payload, "query") ?? getString(payload, "normalizedQuestion") ?? "…";
  const domain = getString(payload, "domain") ?? hostnameFromPayload(payload) ?? "…";
  const count = getNumber(payload, "candidateCount") ?? getNumber(payload, "count") ?? getNumber(payload, "evidenceCount") ?? getNumber(payload, "claimCount") ?? 0;
  const key = `event.${eventType}` as MessageKey;
  const known = isKnownEventKey(key);
  const detail = known
    ? translate(locale, key, { query, domain, count, round: getNumber(payload, "round") ?? 0 })
    : event.summary || translate(locale, "event.unknown");
  return { title: known ? formatEventName(locale, eventType) : eventType, detail };
}

function formatEventName(locale: Locale, eventType: RunEventType): string {
  const state = eventType.replace(/^RUN_/, "") as RunState;
  if (["UNDERSTANDING", "PLANNING", "RETRIEVING", "EXTRACTING", "EVALUATING", "GAP_CHECK", "SYNTHESIZING", "MATERIALIZING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"].includes(state)) return formatRunState(locale, state);
  return translate(locale, `event.${eventType}` as MessageKey);
}

function isKnownEventKey(key: MessageKey): boolean {
  return key.startsWith("event.") && key !== "event.unknown";
}

function getString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function hostnameFromPayload(payload: Record<string, unknown>): string | undefined {
  const url = getString(payload, "url");
  if (!url) return undefined;
  try { return new URL(url).hostname; }
  catch { return undefined; }
}

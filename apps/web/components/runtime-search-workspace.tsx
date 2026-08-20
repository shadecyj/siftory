"use client";

import type { RuntimeRunResponse } from "@searchos/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../lib/i18n/locale-provider";
import { formatApiError, formatRunEvent, formatRunState, formatRunStatus, getProgressStages } from "../lib/i18n/presentation";
import { searchOsMutationRequestHeaders } from "../lib/request-headers";
import { SearchResult, SearchStageProgress } from "./search-workspace";

const terminal = new Set(["COMPLETED", "PARTIAL", "FAILED", "CANCELLED"]);

export function RuntimeSearchWorkspace({ taskId, runId, question }: { taskId: string; runId: string; question: string }) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const [snapshot, setSnapshot] = useState<RuntimeRunResponse | null>(null);
  const [requestError, setRequestError] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const progressStages = useMemo(() => getProgressStages(locale), [locale]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      try {
        const response = await fetch(`/api/search-runs/${runId}`, { cache: "no-store" });
        const payload = await response.json() as RuntimeRunResponse | { error?: RuntimeRunResponse["error"] };
        if (!response.ok) throw new Error(formatApiError(locale, "error" in payload ? payload.error : null, t("run.statusUnavailable")));
        if (!active) return;
        const responsePayload = payload as RuntimeRunResponse;
        setSnapshot(responsePayload);
        if (!terminal.has(responsePayload.status)) timer = window.setTimeout(load, 350);
      } catch (error) {
        if (active) setRequestError(error instanceof Error ? error.message : t("run.statusUnavailable"));
      }
    };
    void load();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [locale, runId, t]);

  const snapshotStatus = snapshot?.status;
  useEffect(() => {
    if (snapshotStatus && terminal.has(snapshotStatus)) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [snapshotStatus]);

  const currentProgress = useMemo(() => {
    const index = progressStages.findIndex((stage) => stage.state === snapshot?.currentStage);
    if (index >= 0) return index;
    if (["PLANNING", "CREATED", "UNDERSTANDING"].includes(snapshot?.currentStage ?? "")) return 0;
    if (snapshot?.currentStage === "EXTRACTING") return 1;
    if (snapshot?.currentStage === "GAP_CHECK" || snapshot?.currentStage === "EVALUATING") return 2;
    return progressStages.length - 1;
  }, [progressStages, snapshot?.currentStage]);

  async function cancel() {
    setActionPending(true);
    await fetch(`/api/search-runs/${runId}/cancel`, { method: "POST", headers: searchOsMutationRequestHeaders });
    setActionPending(false);
  }

  async function retry() {
    setActionPending(true);
    const response = await fetch(`/api/search-runs/${runId}/retry`, {
      method: "POST",
      headers: { ...searchOsMutationRequestHeaders, "content-type": "application/json" },
      body: JSON.stringify({ question, outputLocale: locale })
    });
    const payload = await response.json() as { taskId?: string; runId?: string; error?: RuntimeRunResponse["error"] };
    if (response.ok && payload.taskId && payload.runId) router.push(`/search/${payload.taskId}?run=${payload.runId}&q=${encodeURIComponent(question)}`);
    else { setRequestError(formatApiError(locale, payload.error, t("run.retryFailed"))); setActionPending(false); }
  }

  async function save() {
    setActionPending(true);
    const response = await fetch(`/api/search-runs/${runId}/save`, { method: "POST", headers: searchOsMutationRequestHeaders });
    const payload = await response.json() as RuntimeRunResponse | { error?: RuntimeRunResponse["error"] };
    if (response.ok) setSnapshot(payload as RuntimeRunResponse);
    else setRequestError(formatApiError(locale, "error" in payload ? payload.error : null, t("run.saveFailed")));
    setActionPending(false);
  }

  const status = snapshot?.status ?? "QUEUED";
  const running = status === "QUEUED" || status === "RUNNING";
  const startedAt = snapshot?.events[0]?.createdAt;
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((clock - new Date(startedAt).getTime()) / 1_000)) : 0;
  const currentOperation = snapshot ? formatRunState(locale, snapshot.currentStage) : t("run.preparing");
  const finishedMessage = formatApiError(locale, snapshot?.error, t("run.finished"));
  return (
    <section className="workspace" data-task-id={taskId}>
      <header className="run-header">
        <div>
          <div className="run-breadcrumb"><Link href="/">{t("run.breadcrumbSearch")}</Link><span>/</span><span>{t("run.quickRun")}</span></div>
          <h1 className="question-title">{question}</h1>
          <p className="run-operation">{running ? t("run.operation", { operation: currentOperation }) : finishedMessage}</p>
        </div>
        <div className="run-controls">
          <div className="run-meta"><span>{t("run.autoQuick")} · {formatDuration(elapsedSeconds)}</span><span>{snapshot?.runtimeMode === "live" ? t("run.liveSearch") : t("run.replaySample")}</span></div>
          <span className={`run-status is-${status.toLowerCase()}`}><span className="status-dot" />{formatRunStatus(locale, status)}</span>
          {running && <button className="stop-button" type="button" disabled={actionPending} onClick={cancel}>{t("run.stop")}</button>}
        </div>
        <p className="sr-only" aria-live="polite">{formatRunStatus(locale, status)}。{running ? t("run.operation", { operation: currentOperation }) : finishedMessage}</p>
      </header>

      {requestError && <div className="notice is-insufficient"><strong>{t("run.requestFailed")}</strong>{requestError}</div>}
      {running && <RuntimeProgress snapshot={snapshot} current={currentProgress} elapsedSeconds={elapsedSeconds} />}
      {!running && snapshot?.bundle && <SearchResult bundle={snapshot.bundle} saved={snapshot.bundle.savedNote.isSaved} onSave={save} runtime={snapshot} />}
      {!running && snapshot && !snapshot.bundle && <RuntimeFailure snapshot={snapshot} pending={actionPending} onRetry={retry} />}
      {!snapshot && !requestError && <RuntimeProgress snapshot={null} current={0} elapsedSeconds={0} />}
    </section>
  );
}

function RuntimeProgress({ snapshot, current, elapsedSeconds }: { snapshot: RuntimeRunResponse | null; current: number; elapsedSeconds: number }) {
  const { locale, t } = useLocale();
  const stages = useMemo(() => getProgressStages(locale), [locale]);
  const active = stages[current] ?? stages[0]!;
  const events = snapshot?.events.slice(-10) ?? [];
  return (
    <div className="running-workspace" aria-live="polite">
      <section className="running-primary">
        <div className="running-indicator"><span className="activity-spinner" /><span>{t("progress.agentWorking")}</span></div>
        <h2 className="progress-title">{active.label}</h2>
        <p className="progress-copy">{events.length > 0 ? formatRunEvent(locale, events.at(-1)!).detail : active.copy}</p>
        <SearchStageProgress current={current} />
        <dl className="metadata-list runtime-metadata">
          <div><dt>{t("progress.runtimeMode")}</dt><dd>{snapshot?.runtimeMode ?? "replay"}</dd></div>
          <div><dt>{t("progress.provider")}</dt><dd>{snapshot?.provider ?? t("progress.preparing")}</dd></div>
          <div><dt>{t("progress.elapsed")}</dt><dd>{formatDuration(elapsedSeconds)}</dd></div>
          <div><dt>{t("progress.eventsRecorded")}</dt><dd>{snapshot?.events.length ?? 0}</dd></div>
        </dl>
        <p className="running-note">{t("progress.reviewableOnly")}</p>
      </section>
      <aside className="activity-inspector" aria-label={t("activity.aria")}>
        <div className="inspector-header"><span>{t("activity.title")}</span><span>{t("activity.events", { count: String(events.length).padStart(2, "0") })}</span></div>
        <div className="activity-list">
          {events.length === 0 ? <div className="activity-row is-current"><span className="activity-marker">●</span><div><strong>{formatRunStatus(locale, "QUEUED")}</strong><p>{t("progress.queued")}</p></div></div> : events.map((event) => {
            const localEvent = formatRunEvent(locale, event);
            return <div className="activity-row is-done" key={event.id}><span className="activity-marker">✓</span><div><strong>{localEvent.title}</strong><p>{localEvent.detail}</p></div></div>;
          })}
        </div>
      </aside>
    </div>
  );
}

function RuntimeFailure({ snapshot, pending, onRetry }: { snapshot: RuntimeRunResponse; pending: boolean; onRetry: () => void }) {
  const { locale, t } = useLocale();
  const cancelled = snapshot.status === "CANCELLED";
  const retained = Object.entries(snapshot.error?.retainedObjectCounts ?? {});
  const canRetry = snapshot.availableActions.includes("RETRY");
  return (
    <div className="running-workspace runtime-failure">
      <section className="running-primary">
        <p className="section-kicker">{cancelled ? formatRunStatus(locale, "CANCELLED") : snapshot.error?.code ?? formatRunStatus(locale, "FAILED")}</p>
        <h2 className="progress-title">{cancelled ? t("run.cancelled") : t("run.failed")}</h2>
        <p className="progress-copy">{formatApiError(locale, snapshot.error, t("run.safeStopped"))}</p>
        {retained.length > 0 && <div className="retained-summary" aria-label={t("run.retained")}>{retained.map(([label, count]) => <span key={label}><strong>{count}</strong>{label}</span>)}</div>}
        <div className="failure-actions">
          {canRetry && <button className="search-submit" type="button" disabled={pending} onClick={onRetry}>{t("run.retryNew")}</button>}
          <Link className="secondary-button" href="/">{t("run.editQuestion")}</Link>
        </div>
      </section>
      <aside className="activity-inspector">
        <div className="inspector-header"><span>{t("run.retainedActivity")}</span><span>{snapshot.events.length}</span></div>
        <div className="activity-list">{snapshot.events.slice(-8).map((event) => {
          const localEvent = formatRunEvent(locale, event);
          return <div className="activity-row is-done" key={event.id}><span className="activity-marker">✓</span><div><strong>{localEvent.title}</strong><p>{localEvent.detail}</p></div></div>;
        })}</div>
      </aside>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

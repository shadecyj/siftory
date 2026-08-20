"use client";

import type { RuntimeRunResponse, SearchBundle } from "@searchos/contracts";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../lib/i18n/locale-provider";
import { formatRunEvent, formatRunState, getProgressStages } from "../lib/i18n/presentation";
import { translate } from "../lib/i18n/translate";
import { noteCategoryLabel } from "../lib/note-categories";
import { localizeReplayBundle, localizeReplayQuestion } from "../lib/replay-presentation";
import { buildConfidenceSignals, buildSourceSupportSummaries, confidenceLabel, epistemicLabel, sortClaimsForDisplay, sourceDateLabel, sourceSupportLabel, sourceTypeLabel, trustExplanation } from "../lib/result-view";
import { isFixtureNoteSaved, saveFixtureNote } from "../lib/storage";

export function SearchWorkspace({ bundle, question }: { bundle: SearchBundle; question: string }) {
  const { locale, t } = useLocale();
  const stages = useMemo(() => getProgressStages(locale), [locale]);
  const displayQuestion = useMemo(() => localizeReplayQuestion(bundle, question, locale), [bundle, locale, question]);
  const [stage, setStage] = useState(0);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isFixtureNoteSaved());
    const timer = window.setInterval(() => {
      setStage((current) => {
        if (current >= stages.length - 1) {
          window.clearInterval(timer);
          window.setTimeout(() => setReady(true), 350);
          return current;
        }
        return current + 1;
      });
    }, 420);
    return () => window.clearInterval(timer);
  }, [stages.length]);

  function save() {
    saveFixtureNote();
    setSaved(true);
  }

  return (
    <section className="workspace">
      <header className="run-header">
        <div>
          <div className="run-breadcrumb"><Link href="/">{t("run.breadcrumbSearch")}</Link><span>/</span><span>{t("run.quickRun")}</span></div>
          <h1 className="question-title">{displayQuestion}</h1>
          <p className="run-operation">{ready ? t("result.fixtureComplete") : t("run.operation", { operation: stages[stage]?.copy ?? stages[0]!.copy })}</p>
        </div>
        <div className="run-controls">
          <div className="run-meta"><span>{t("run.autoQuick")}</span><span>{t("result.fixtureRun")}</span></div>
          <span className={`run-status ${ready ? "is-completed" : "is-running"}`}><span className="status-dot" />{ready ? t("result.completed") : t("result.running")}</span>
          {!ready && <button className="stop-button" type="button" disabled title={t("result.fixtureStopTitle")}>{t("run.stop")}</button>}
        </div>
      </header>

      {!ready ? <SearchProgress current={stage} /> : <SearchResult bundle={bundle} saved={saved} onSave={save} />}
    </section>
  );
}

function SearchProgress({ current }: { current: number }) {
  const { locale, t } = useLocale();
  const stages = useMemo(() => getProgressStages(locale), [locale]);
  const active = stages[current] ?? stages[0]!;
  return (
    <div className="running-workspace" aria-live="polite">
      <section className="running-primary">
        <div className="running-indicator"><span className="activity-spinner" /><span>{t("progress.agentWorking")}</span></div>
        <h2 className="progress-title">{active.label}</h2>
        <p className="progress-copy">{active.copy}</p>
        <SearchStageProgress current={current} />
        <p className="running-note">{t("progress.reviewableOnlyFixture")}</p>
      </section>
      <aside className="activity-inspector" aria-label={t("activity.fixtureAria")}>
        <div className="inspector-header"><span>{t("activity.title")}</span><span>00:0{current + 1}</span></div>
        <div className="activity-list">
        {stages.map((item, index) => (
          <div className={`activity-row ${index < current ? "is-done" : ""} ${index === current ? "is-current" : ""}`} key={item.label}>
            <span className="activity-marker">{index < current ? "✓" : index === current ? "●" : "○"}</span>
            <div><strong>{item.label}</strong><p>{index <= current ? item.copy : t("progress.waiting")}</p></div>
          </div>
        ))}
        </div>
      </aside>
    </div>
  );
}

export function SearchStageProgress({ current }: { current: number }) {
  const { locale, t } = useLocale();
  const stages = useMemo(() => getProgressStages(locale), [locale]);
  const boundedCurrent = Math.max(0, Math.min(current, stages.length - 1));
  const progress = stages.length > 1 ? boundedCurrent / (stages.length - 1) : 1;
  return (
    <div className="stage-progress" aria-label={t("progress.stageAria", { current: boundedCurrent + 1, total: stages.length })}>
      <div className="stage-progress-heading"><span>{t("progress.stage")}</span><strong>{boundedCurrent + 1} / {stages.length}</strong></div>
      <div className="stage-progress-rail" style={{ "--stage-progress": progress } as CSSProperties}>
        <span className="stage-progress-fill" aria-hidden="true" />
        <ol>
          {stages.map((item, index) => (
            <li className={index < boundedCurrent ? "is-done" : index === boundedCurrent ? "is-current" : ""} key={item.state}>
              <span className="stage-progress-dot" aria-hidden="true">{index < boundedCurrent ? "✓" : index + 1}</span>
              <strong>{item.label}</strong>
              <small>{index < boundedCurrent ? t("progress.done") : index === boundedCurrent ? t("progress.current") : t("progress.waiting")}</small>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function SearchResult({ bundle: sourceBundle, saved, onSave, runtime }: { bundle: SearchBundle; saved: boolean; onSave: () => void; runtime?: Pick<RuntimeRunResponse, "queries" | "retrievalAttempts" | "excludedSources" | "events"> }) {
  const { locale, t, formatDateTime, formatTime } = useLocale();
  const bundle = useMemo(() => localizeReplayBundle(sourceBundle, locale), [locale, sourceBundle]);
  const displayClaims = useMemo(() => sortClaimsForDisplay(bundle.claims), [bundle.claims]);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"overview" | "sources" | "activity">("overview");
  const [selectedClaimId, setSelectedClaimId] = useState(displayClaims[0]?.id ?? "");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const sourceById = useMemo(() => new Map(bundle.sources.map((source) => [source.id, source])), [bundle.sources]);
  const snapshotById = useMemo(() => new Map(bundle.snapshots.map((snapshot) => [snapshot.id, snapshot])), [bundle.snapshots]);
  const sourceBySnapshot = useMemo(() => new Map(bundle.snapshots.map((snapshot) => [snapshot.id, sourceById.get(snapshot.sourceId)])), [bundle.snapshots, sourceById]);
  const evidenceByClaim = useMemo(() => {
    const evidence = new Map(bundle.evidence.map((item) => [item.id, item]));
    const byClaim = new Map<string, NonNullable<ReturnType<typeof evidence.get>>[]>();
    for (const link of bundle.claimEvidence) {
      const item = evidence.get(link.evidenceId);
      if (!item) continue;
      byClaim.set(link.claimId, [...(byClaim.get(link.claimId) ?? []), item]);
    }
    return byClaim;
  }, [bundle.claimEvidence, bundle.evidence]);
  const claimIdsBySource = useMemo(() => {
    const evidence = new Map(bundle.evidence.map((item) => [item.id, item]));
    const bySource = new Map<string, Set<string>>();
    for (const link of bundle.claimEvidence) {
      const snapshotId = evidence.get(link.evidenceId)?.snapshotId;
      const sourceId = snapshotId ? snapshotById.get(snapshotId)?.sourceId : undefined;
      if (!sourceId) continue;
      const claimIds = bySource.get(sourceId) ?? new Set<string>();
      claimIds.add(link.claimId);
      bySource.set(sourceId, claimIds);
    }
    return bySource;
  }, [bundle.claimEvidence, bundle.evidence, snapshotById]);
  const trustByClaim = useMemo(() => new Map(bundle.trustSummaries.map((summary) => [summary.claimId, summary])), [bundle.trustSummaries]);
  const confidenceSignals = useMemo(() => buildConfidenceSignals(bundle, locale), [bundle, locale]);
  const sourceSupports = useMemo(() => buildSourceSupportSummaries(bundle), [bundle]);
  const sourceSupportById = useMemo(() => new Map(sourceSupports.map((summary) => [summary.sourceId, summary])), [sourceSupports]);
  const answer = bundle.result.answerSections[0]!;
  const paragraph = answer.nodes.find((node) => node.type === "PARAGRAPH");
  const list = answer.nodes.find((node) => node.type === "LIST");
  const isPartial = bundle.run.state === "PARTIAL";
  const isInsufficient = bundle.result.overallConfidence === "INSUFFICIENT";
  const hasMaterialConflict = bundle.conflicts.some((conflict) => conflict.severity === "MATERIAL" && conflict.status === "OPEN");
  const selectedClaim = displayClaims.find((claim) => claim.id === selectedClaimId) ?? displayClaims[0];
  const selectedEvidence = selectedClaim ? evidenceByClaim.get(selectedClaim.id) ?? [] : [];
  const selectedSource = sourceById.get(selectedSourceId);
  const selectedSourceClaims = selectedSourceId ? claimIdsBySource.get(selectedSourceId) ?? new Set<string>() : new Set<string>();
  const rulesetVersion = bundle.trustSummaries[0]?.rulesetVersion ?? "trust rules";

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (inspectorOpen || mobileInspectorOpen)) {
        setMobileInspectorOpen(false);
        setInspectorOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!saved) onSave();
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [inspectorOpen, mobileInspectorOpen, onSave, saved]);

  function selectClaim(claimId: string, openMobile = false) {
    setSelectedClaimId(claimId);
    setInspectorTab("overview");
    setInspectorOpen(true);
    if (openMobile && window.matchMedia("(max-width: 820px)").matches) setMobileInspectorOpen(true);
  }

  function selectSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    const firstClaimId = claimIdsBySource.get(sourceId)?.values().next().value;
    if (typeof firstClaimId === "string") setSelectedClaimId(firstClaimId);
  }

  function closeInspector() {
    setMobileInspectorOpen(false);
    setInspectorOpen(false);
  }

  return (
    <div className={`result-workbench ${inspectorOpen ? "" : "is-inspector-collapsed"} ${mobileInspectorOpen ? "is-mobile-inspector-open" : ""}`}>
      <div className="result-main">
        <div className="result-view-controls">
          <button className="inspector-toggle desktop-inspector-toggle" type="button" aria-expanded={inspectorOpen} aria-controls="evidence-inspector" onClick={() => setInspectorOpen((open) => !open)}>
            <span aria-hidden="true">{inspectorOpen ? "◫" : "◧"}</span>{inspectorOpen ? t("result.closeInspector") : t("result.openInspector")}
          </button>
          <button className="inspector-toggle mobile-inspector-toggle" type="button" aria-expanded={mobileInspectorOpen} aria-controls="evidence-inspector" onClick={() => { setInspectorOpen(true); setMobileInspectorOpen(true); }}>
            {t("result.viewEvidence")}
          </button>
        </div>

        {isPartial && !isInsufficient && <div className="notice is-partial"><strong>{t("result.partial")}</strong>{t("result.partialCopy", { reason: bundle.run.partialReason ?? "" })}</div>}
        {isInsufficient && <div className="notice is-insufficient"><strong>{t("result.insufficient")}</strong>{t("result.insufficientCopy", { reason: bundle.run.partialReason ?? "" })}</div>}
        {hasMaterialConflict && <div className="notice is-conflict"><strong>{t("result.conflict")}</strong>{t("result.conflictCopy")}</div>}

        <section className="answer-block" aria-labelledby="answer-heading">
          <div className="answer-heading-row">
            <div>
              <p className="section-kicker"><span className="epistemic-label is-fact">{t("result.synthesis")}</span>{t("result.synthesisCopy")}</p>
              <h2 className="answer-heading" id="answer-heading">{t("result.answer")}</h2>
            </div>
            <div className="answer-coverage" aria-label={t("inspector.coverage")}>
              <span><strong>{bundle.claims.length}</strong> {t("result.claims")}</span>
              <span><strong>{bundle.evidence.length}</strong> {t("result.evidence")}</span>
              <span><strong>{bundle.sources.length}</strong> {t("result.sites")}</span>
            </div>
          </div>
          <p className="answer-text">{paragraph?.type === "PARAGRAPH" ? paragraph.text : t("result.organized")}</p>
          {list?.type === "LIST" && <div className="answer-takeaways"><p>{t("result.keyTakeaways")}</p><ul className="answer-list">{list.items.map((item) => <li key={item.text}>{item.text}</li>)}</ul></div>}
          {bundle.result.limitations.length > 0 && <div className="answer-limitations"><strong>{t("result.limitations")}</strong><span>{bundle.result.limitations.join(locale === "zh-CN" ? "；" : "; ")}</span></div>}
        </section>

        <section className={`confidence-block is-${bundle.result.overallConfidence.toLowerCase()}`} aria-labelledby="confidence-heading">
          <div className="confidence-summary">
            <span className="confidence-icon" aria-hidden="true">{isInsufficient ? "!" : hasMaterialConflict ? "△" : "✓"}</span>
            <div>
              <p className="confidence-overline">{t("confidence.overline", { ruleset: rulesetVersion })}</p>
              <h2 className="confidence-level" id="confidence-heading">{confidenceLabel(bundle.result.overallConfidence, locale)}</h2>
            </div>
          </div>
          <div className="confidence-signal-grid">
            {confidenceSignals.map((signal) => <div className={`confidence-signal is-${signal.tone}`} key={signal.dimension}><span>{signal.label}</span><strong>{signal.detail}</strong></div>)}
          </div>
          <p className="confidence-note">{t("confidence.note")}</p>
        </section>

        <section className="evidence-section source-section" aria-labelledby="sources-heading">
          <div className="section-heading-row">
            <div><p className="section-kicker">{t("source.referenced")}</p><h2 className="section-title" id="sources-heading">{t("source.title")}</h2></div>
            <p className="source-section-count">{t("source.count", { sites: bundle.sources.length, evidence: bundle.evidence.length })}</p>
          </div>
          <p className="source-context-note">{t("source.context")}</p>
          <div className="source-matrix">
          {bundle.sources.map((source, index) => {
            const snapshot = bundle.snapshots.find((item) => item.sourceId === source.id);
            const support = sourceSupportById.get(source.id)!;
            return <article className={`source-card ${selectedSourceId === source.id ? "is-selected" : ""}`} key={source.id}>
              <div className="source-card-topline"><span className="source-index">{t("source.index", { index: String(index + 1).padStart(2, "0") })}</span><span className={`trust-badge is-${support.level.toLowerCase()}`}>{sourceSupportLabel(support.level, locale)}</span></div>
              <button className="source-card-select" type="button" onClick={() => { selectSource(source.id); setInspectorOpen(true); }}>
                <strong>{source.title}</strong><span>{source.domain}</span>
              </button>
              <div className="source-card-meta"><span>{sourceTypeLabel(source, locale)}</span><span>{source.isOfficial ? t("source.official") : t("source.public")}</span><span>{sourceDateLabel(source, locale)}</span></div>
              <dl className="source-support-grid">
                <div><dt>{t("result.claims")}</dt><dd>{support.claimCount}</dd></div>
                <div><dt>{t("result.evidence")}</dt><dd>{support.evidenceCount}</dd></div>
                <div><dt>{t("source.direct")}</dt><dd>{support.directEvidenceCount}</dd></div>
              </dl>
              <div className="source-signal-row">
                {support.primaryEvidenceCount > 0 && <span className="is-positive">{t("source.primaryEvidence")}</span>}
                {support.strongAuthorityCount > 0 && <span className="is-positive">{t("source.strongAuthority")}</span>}
                {support.currentEvidenceCount > 0 ? <span className="is-positive">{t("source.freshnessVerifiable")}</span> : <span>{t("source.freshnessUnknown")}</span>}
                {support.contradictingEvidenceCount > 0 && <span className="is-negative">{t("source.contradicting")}</span>}
              </div>
              <div className="source-card-footer"><span>{snapshot?.parseStatus ?? "UNKNOWN"} · {t("source.snapshotSaved")}</span><a className="source-link" href={source.canonicalUrl} target="_blank" rel="noreferrer">{t("source.openOriginal")}</a></div>
            </article>;
          })}
          </div>
        </section>

        <section className="evidence-section" aria-labelledby="claims-heading">
          <p className="section-kicker">{t("claim.traceability")}</p>
          <h2 className="section-title" id="claims-heading">{t("claim.key")}</h2>
          {displayClaims.map((claim, index) => {
            const trust = trustByClaim.get(claim.id);
            const epistemic = epistemicLabel(claim, trust, locale);
            const claimEvidence = evidenceByClaim.get(claim.id) ?? [];
            const linkedToSelectedSource = selectedSourceClaims.has(claim.id);
            return (
              <details className={`claim-card ${selectedClaimId === claim.id ? "is-selected" : ""} ${selectedSourceId && linkedToSelectedSource ? "is-source-linked" : ""} ${selectedSourceId && !linkedToSelectedSource ? "is-source-dimmed" : ""}`} key={claim.id} open={index === 0 ? true : undefined}>
                <summary onClick={() => selectClaim(claim.id, true)} onFocus={() => setSelectedClaimId(claim.id)}>
                  <span className="claim-number">C-{String(index + 1).padStart(2, "0")}</span>
                  <span className="claim-copy"><span className="claim-statement">{claim.statement}</span><span className="claim-labels"><em className={`epistemic-label is-${epistemic.kind}`}>{epistemic.label}</em><em>{claim.importance}</em><em>{t("claim.evidenceCount", { count: claimEvidence.length })}</em></span></span>
                  <span className={`trust-badge is-${trust?.level.toLowerCase() ?? "insufficient"}`}>{trust?.level ?? "INSUFFICIENT"}</span>
                </summary>
                <div className="claim-detail">
                  <p className="claim-explanation">{trustExplanation(trust, locale)}</p>
                  {claimEvidence.length > 0 ? claimEvidence.map((evidence) => {
                    const source = sourceBySnapshot.get(evidence.snapshotId);
                    const snapshot = snapshotById.get(evidence.snapshotId);
                    if (!source) return null;
                    return <article className="evidence-record" key={evidence.id}>
                      <blockquote className="evidence-quote">“{evidence.excerpt}”</blockquote>
                      <p className="evidence-paraphrase">{t("claim.evidenceExplanation", { text: evidence.paraphrase })}</p>
                      <div className="evidence-provenance"><span>{formatLocator(evidence.locator, locale)}</span><span>{t("date.snapshot", { date: snapshot?.fetchedAt ? formatDateTime(snapshot.fetchedAt) : t("date.unknown") })}</span></div>
                      <div className="source-line">
                        <div><div className="source-title">{source.title}</div><div className="source-meta">{sourceTypeLabel(source, locale)} · {source.domain} · {sourceDateLabel(source, locale)}</div></div>
                        <a className="source-link" href={source.canonicalUrl} target="_blank" rel="noreferrer">{t("source.openWebsite")}</a>
                      </div>
                    </article>;
                  }) : <div className="notice is-insufficient"><strong>{t("claim.openQuestion")}</strong>{t("claim.noEvidence")}</div>}
                </div>
              </details>
            );
          })}
        </section>

      </div>

      {mobileInspectorOpen && <button className="inspector-backdrop" type="button" aria-label={t("inspector.closeAria")} onClick={closeInspector} />}
      {inspectorOpen && <aside className="evidence-inspector" id="evidence-inspector" aria-label={t("inspector.aria")}>
        <div className="inspector-toolbar"><span>{t("inspector.title")}</span><button className="inspector-close" type="button" onClick={closeInspector}>{t("inspector.close")} <span aria-hidden="true">×</span></button></div>
        <div className="inspector-tabs" role="tablist" aria-label={t("inspector.tabsAria")}>
          <button className={inspectorTab === "overview" ? "is-active" : ""} type="button" role="tab" aria-selected={inspectorTab === "overview"} onClick={() => setInspectorTab("overview")}>{t("inspector.evidence")}</button>
          <button className={inspectorTab === "sources" ? "is-active" : ""} type="button" role="tab" aria-selected={inspectorTab === "sources"} onClick={() => setInspectorTab("sources")}>{t("inspector.sources")}</button>
          <button className={inspectorTab === "activity" ? "is-active" : ""} type="button" role="tab" aria-selected={inspectorTab === "activity"} onClick={() => setInspectorTab("activity")}>{t("inspector.activity")}</button>
        </div>

        {inspectorTab === "overview" && <div role="tabpanel">
          {selectedClaim && <div className="aside-section selected-claim" aria-live="polite">
            <p className="aside-title">{t("claim.selected")}</p>
            <div className="selected-claim-label"><span className={`epistemic-label is-${epistemicLabel(selectedClaim, trustByClaim.get(selectedClaim.id), locale).kind}`}>{epistemicLabel(selectedClaim, trustByClaim.get(selectedClaim.id), locale).label}</span><span>{selectedClaim.importance}</span></div>
            <strong>{selectedClaim.statement}</strong>
            {selectedEvidence.length > 0 ? selectedEvidence.map((item) => {
              const source = sourceBySnapshot.get(item.snapshotId);
              const snapshot = snapshotById.get(item.snapshotId);
              return <article className="inspector-evidence" key={item.id}>
                <blockquote>“{item.excerpt}”</blockquote>
                <dl><div><dt>{t("inspector.locator")}</dt><dd>{formatLocator(item.locator, locale)}</dd></div><div><dt>{t("inspector.snapshot")}</dt><dd>{snapshot?.fetchedAt ? formatDateTime(snapshot.fetchedAt) : t("date.unknown")}</dd></div></dl>
                {source && <div className="inspector-evidence-source"><strong>{source.title}</strong><span>{sourceTypeLabel(source, locale)} · {source.domain}</span><code>{source.canonicalUrl}</code><a href={source.canonicalUrl} target="_blank" rel="noreferrer">{t("source.openWebsite")}</a></div>}
              </article>;
            }) : <p className="inspector-empty">{t("claim.noDirectEvidence")}</p>}
          </div>}
          <div className="aside-section"><p className="aside-title">{t("inspector.runtime")}</p><dl className="metadata-list"><div><dt>{t("inspector.mode")}</dt><dd>Quick</dd></div><div><dt>{t("inspector.status")}</dt><dd>{formatRunState(locale, bundle.run.state)}</dd></div><div><dt>{t("inspector.stopReason")}</dt><dd>{bundle.run.stopReason}</dd></div><div><dt>{t("inspector.resultVersion")}</dt><dd>v1</dd></div></dl></div>
          <div className="aside-section"><p className="aside-title">{t("inspector.coverage")}</p><div className="coverage-grid"><div><strong>{bundle.claims.length}</strong><span>{t("result.claims")}</span></div><div><strong>{bundle.evidence.length}</strong><span>{t("result.evidence")}</span></div><div><strong>{bundle.sources.length}</strong><span>{t("result.sites")}</span></div></div></div>
          {bundle.conflicts.length > 0 && <div className="aside-section"><p className="aside-title">{t("inspector.conflicts")}</p><ul className="aside-list conflict-list">{bundle.conflicts.map((conflict) => <li key={conflict.id}><span>△</span>{conflict.summary}</li>)}</ul></div>}
          <div className="aside-section"><p className="aside-title">{t("inspector.plan")}</p><ul className="aside-list">{bundle.plan.steps.map((step) => <li key={step.id}><span>✓</span>{step.goal}</li>)}</ul></div>
        </div>}

        {inspectorTab === "sources" && <div className="inspector-source-list" role="tabpanel" data-query-count={runtime?.queries.length ?? 0} data-excluded-count={runtime?.excludedSources.length ?? 0}>
          <div className="source-pipeline-legend"><span>{t("inspector.discovered")}</span><b>→</b><span>{t("inspector.fetched")}</span><b>→</b><span>{t("inspector.parsed")}</span></div>
          {bundle.sources.map((source, index) => {
            const snapshot = bundle.snapshots.find((item) => item.sourceId === source.id);
            const linkedClaims = claimIdsBySource.get(source.id)?.size ?? 0;
            return <div className={`inspector-source-row ${selectedSourceId === source.id ? "is-selected" : ""}`} key={source.id}>
              <button type="button" onClick={() => selectSource(source.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{source.title}</strong><p><em className="source-state is-parsed">{snapshot?.parseStatus ?? "UNKNOWN"}</em> · {sourceTypeLabel(source, locale)} · {t("source.supportsClaims", { count: linkedClaims })}</p></div></button>
              <a href={source.canonicalUrl} target="_blank" rel="noreferrer">{t("source.openWebsite")}</a>
            </div>;
          })}
          {selectedSource && <div className="selected-source-detail"><p className="aside-title">{t("source.selected")}</p><strong>{selectedSource.title}</strong><span>{sourceTypeLabel(selectedSource, locale)} · {selectedSource.domain}</span><code>{selectedSource.canonicalUrl}</code><p>{sourceDateLabel(selectedSource, locale)} · {formatDateTime(selectedSource.accessedAt)}</p></div>}
          {runtime?.excludedSources.map((source) => <div className="excluded-source" key={source.id}><span>×</span><div><strong>{safeHostname(source.url, locale)}</strong><p><em className="source-state is-excluded">{source.stage} · {t("inspector.excluded")}</em></p><small>{source.publicSummary}</small></div></div>)}
          {runtime && <p className="source-summary">{t("source.queriesSummary", { queries: runtime.queries.length, sources: bundle.sources.length, excluded: runtime.excludedSources.length })}</p>}
        </div>}

        {inspectorTab === "activity" && <div className="activity-list" role="tabpanel">
          {(runtime?.events ?? bundle.events).slice(-16).map((event) => {
            const localEvent = formatRunEvent(locale, event);
            return <div className="activity-row is-done" key={event.id}><span className="activity-marker">✓</span><div><strong>{localEvent.title}</strong><p>{localEvent.detail}</p><time>{formatTime(event.createdAt)}</time></div></div>;
          })}
        </div>}
        <div className="aside-section inspector-save"><button className={`save-button ${saved ? "is-saved" : ""}`} type="button" aria-keyshortcuts="Control+S Meta+S" onClick={onSave}>{saved ? t("inspector.saved") : t("inspector.save")}</button>{saved && <><p className="save-category">{t("inspector.suggestedCategory", { category: noteCategoryLabel(bundle.savedNote.category, locale) })}<span>{t("inspector.editInNote")}</span></p><Link className="secondary-button" href={`/notes/${bundle.savedNote.id}`}>{t("inspector.openNote")}</Link></>}</div>
      </aside>}
    </div>
  );
}

function formatLocator(locator: Record<string, string | number | undefined>, locale: ReturnType<typeof useLocale>["locale"]): string {
  return [
    locator.heading ? tForLocale(locale, "locator.heading", { heading: locator.heading }) : undefined,
    locator.paragraph ? tForLocale(locale, "locator.paragraph", { paragraph: locator.paragraph }) : undefined,
    locator.page ? tForLocale(locale, "locator.page", { page: locator.page }) : undefined,
    locator.blockId ? tForLocale(locale, "locator.block", { block: locator.blockId }) : undefined
  ].filter(Boolean).join(" · ") || tForLocale(locale, "locator.unknown");
}

function safeHostname(value: string, locale: ReturnType<typeof useLocale>["locale"]): string {
  try { return new URL(value).hostname; }
  catch { return tForLocale(locale, "source.unrecognized"); }
}

function tForLocale(locale: ReturnType<typeof useLocale>["locale"], key: Parameters<ReturnType<typeof useLocale>["t"]>[0], variables?: Parameters<ReturnType<typeof useLocale>["t"]>[1]): string {
  return translate(locale, key, variables);
}

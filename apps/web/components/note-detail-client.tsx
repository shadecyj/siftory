"use client";

import type { NoteCategory, SearchBundle, UpdateSearchNoteRequest } from "@searchos/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/i18n/locale-provider";
import { getNoteCategoryOptions, noteCategoryLabel } from "../lib/note-categories";
import { searchOsMutationRequestHeaders } from "../lib/request-headers";
import { trustExplanation } from "../lib/result-view";

export function NoteDetailClient({ noteId }: { noteId: string }) {
  const { locale, t, formatDate } = useLocale();
  const [bundle, setBundle] = useState<SearchBundle | null>(null);
  const [notes, setNotes] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetch(`/api/notes/${noteId}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { bundle?: SearchBundle; error?: { publicMessage?: string } };
        if (!response.ok || !payload.bundle) throw new Error(payload.error?.publicMessage ?? t("note.readFailed"));
        setBundle(payload.bundle);
        setNotes(payload.bundle.savedNote.myNotes);
      })
      .catch((reason: unknown) => setLoadError(reason instanceof Error ? reason.message : t("note.readFailed")));
  }, [noteId, t]);

  async function updateNote(patch: UpdateSearchNoteRequest, successMessage: string) {
    if (pending) return;
    setPending(true);
    setActionError("");
    setStatus("");
    try {
      const response = await fetch(`/api/notes/${noteId}`, { method: "PATCH", headers: { ...searchOsMutationRequestHeaders, "content-type": "application/json" }, body: JSON.stringify(patch) });
      const payload = await response.json() as { bundle?: SearchBundle; error?: { publicMessage?: string } };
      if (!response.ok || !payload.bundle) throw new Error(payload.error?.publicMessage ?? t("note.updateFailed"));
      setBundle(payload.bundle);
      if (patch.myNotes !== undefined) setNotes(payload.bundle.savedNote.myNotes);
      setStatus(successMessage);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : t("note.updateFailed"));
    } finally {
      setPending(false);
    }
  }

  if (loadError) return <section className="note-detail"><div className="empty-state"><h1>{t("note.openFailed")}</h1><p className="muted">{loadError}</p><Link href="/library">{t("note.backLibrary")}</Link></div></section>;
  if (!bundle) return <section className="note-detail"><div className="empty-state"><p className="muted">{t("note.loading")}</p></div></section>;
  const trustByClaim = new Map(bundle.trustSummaries.map((summary) => [summary.claimId, summary]));
  const savedNote = bundle.savedNote;
  return (
    <section className="note-detail">
      <div className="note-hero">
        <div className="note-hero-meta"><p className="eyebrow">Search Note · {savedNote.mode}</p><span className="category-badge">{noteCategoryLabel(savedNote.category, locale)}</span><span className="trust-badge">{savedNote.overallConfidence} {t("note.confidence")}</span><span className="page-count">{formatDate(savedNote.searchDate)}</span></div>
        <h1 className="note-detail-title">{savedNote.title}</h1>
        <p className="note-detail-summary">{savedNote.summary}</p>
      </div>
      <div className="note-content">
        <div>
          <p className="section-kicker">{t("note.retainedClaims")}</p><h2 className="section-title">{t("claim.key")}</h2>
          {savedNote.claims.map((noteClaim, index) => {
            const evidenceLink = bundle.claimEvidence.find((link) => link.claimId === noteClaim.claimId);
            const evidence = bundle.evidence.find((item) => item.id === evidenceLink?.evidenceId);
            const snapshot = bundle.snapshots.find((item) => item.id === evidence?.snapshotId);
            const source = bundle.sources.find((item) => item.id === snapshot?.sourceId);
            return (
              <details className="claim-card" key={noteClaim.claimId} open>
                <summary><span className="claim-number">C-{String(index + 1).padStart(2, "0")}</span><span className="claim-statement">{noteClaim.statementSnapshot}</span><span className="trust-badge">{noteClaim.trustLevelSnapshot}</span></summary>
                <div className="claim-detail">
                  <p className="claim-explanation">{trustExplanation(trustByClaim.get(noteClaim.claimId), locale)}</p>
                  {evidence && <blockquote className="evidence-quote">“{evidence.excerpt}”</blockquote>}
                  {source && <div className="source-line"><div><div className="source-title">{source.title}</div><div className="source-meta">{source.publisher} · {source.domain} · {evidence?.locator.blockId}</div></div><a className="source-link" href={source.canonicalUrl} target="_blank" rel="noreferrer">{t("source.open")}</a></div>}
                </div>
              </details>
            );
          })}
        </div>
        <aside className="my-notes">
          <div className="inspector-toolbar note-inspector-toolbar"><span>{t("note.inspector")}</span><span className="epistemic-label is-personal">{t("note.personalNotEvidence")}</span></div>
          <div className="note-inspector-body">
            <section className="note-organization" aria-labelledby="note-organization-title">
              <div className="organization-heading"><div><span className="section-kicker">{t("note.organization")}</span><h2 id="note-organization-title">{t("note.organization")}</h2></div><button className={savedNote.isFavorite ? "favorite-control is-active" : "favorite-control"} type="button" disabled={pending} aria-pressed={savedNote.isFavorite} onClick={() => void updateNote({ isFavorite: !savedNote.isFavorite }, savedNote.isFavorite ? t("note.favoriteRemoved") : t("note.favoriteAdded"))}>{savedNote.isFavorite ? `★ ${t("note.favorited")}` : `☆ ${t("note.favorite")}`}</button></div>
              <label htmlFor="note-category">{t("note.categoryLabel")}</label>
              <select id="note-category" value={savedNote.category} disabled={pending} onChange={(event) => void updateNote({ category: event.target.value as NoteCategory }, t("note.categoryUpdated"))}>
                {getNoteCategoryOptions(locale).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <p>{t("note.categoryCopy")}</p>
            </section>
            <div className="personal-notes-editor">
              <label htmlFor="my-notes">{t("note.myNotes")}</label><p>{t("note.myNotesCopy")}</p>
              <textarea id="my-notes" value={notes} maxLength={20_000} onChange={(event) => { setNotes(event.target.value); setStatus(""); }} />
              <button type="button" disabled={pending} onClick={() => void updateNote({ myNotes: notes }, t("note.saved"))}>{pending ? t("note.saving") : t("note.save")}</button>
            </div>
            <p className={actionError ? "note-action-status is-error" : "note-action-status"} role="status" aria-live="polite">{actionError || status}</p>
            <dl className="metadata-list note-metadata"><div><dt>{t("note.type")}</dt><dd>Search Note</dd></div><div><dt>{t("note.category")}</dt><dd>{noteCategoryLabel(savedNote.category, locale)}</dd></div><div><dt>{t("note.searchMode")}</dt><dd>{savedNote.mode}</dd></div><div><dt>{t("note.confidence")}</dt><dd>{savedNote.overallConfidence}</dd></div><div><dt>{t("result.claims")}</dt><dd>{savedNote.claims.length}</dd></div></dl>
            <div className="export-note">{t("note.exportFuture")}</div>
          </div>
        </aside>
      </div>
    </section>
  );
}

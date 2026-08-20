"use client";

import type { NoteCategory, SearchNoteView } from "@searchos/contracts";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../lib/i18n/locale-provider";
import { getNoteCategoryOptions, noteCategoryLabel } from "../lib/note-categories";

type LibraryFilter = "ALL" | "FAVORITES" | NoteCategory;

export function LibraryClient() {
  const { locale, t, formatDate } = useLocale();
  const [notes, setNotes] = useState<SearchNoteView[] | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>("ALL");
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/notes", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { notes?: SearchNoteView[]; error?: { publicMessage?: string } };
        if (!response.ok) throw new Error(payload.error?.publicMessage ?? t("library.readFailed"));
        setNotes(payload.notes ?? []);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : t("library.readFailed")));
  }, [t]);

  const visibleNotes = useMemo(() => {
    if (!notes) return [];
    if (filter === "ALL") return notes;
    if (filter === "FAVORITES") return notes.filter((note) => note.isFavorite);
    return notes.filter((note) => note.category === filter);
  }, [filter, notes]);
  const favoriteCount = notes?.filter((note) => note.isFavorite).length ?? 0;

  return (
    <section className="library">
      <div className="page-heading">
        <div><p className="eyebrow">{t("library.eyebrow")}</p><h1 className="page-title">{t("library.title")}</h1><p className="page-description">{t("library.description")}</p></div>
        <div className="library-summary"><span className="status-dot" /><span>{notes?.length ? t("library.assets", { count: notes.length }) : t("library.waitingFirst")}</span><span className="page-count">{String(notes?.length ?? 0).padStart(2, "0")} NOTES</span></div>
      </div>
      <div className="library-grid">
        <aside className="library-nav" aria-label={t("library.filtersAria")}>
          <LibraryFilterButton active={filter === "ALL"} count={notes?.length ?? 0} label={t("library.allNotes")} onClick={() => setFilter("ALL")} />
          <LibraryFilterButton active={filter === "FAVORITES"} count={favoriteCount} label={t("library.favorites")} icon="★" onClick={() => setFilter("FAVORITES")} />
          <p className="library-nav-label">{t("library.categories")}</p>
          {getNoteCategoryOptions(locale).map((option) => <LibraryFilterButton active={filter === option.value} count={notes?.filter((note) => note.category === option.value).length ?? 0} key={option.value} label={option.label} onClick={() => setFilter(option.value)} />)}
        </aside>
        <div className="note-list">
          {error ? <div className="empty-state"><h2>{t("library.readFailed")}</h2><p className="muted">{error}</p></div> : notes === null ? (
            <div className="empty-state"><p className="muted">{t("library.loading")}</p></div>
          ) : visibleNotes.length > 0 ? visibleNotes.map((note) => (
            <Link className="note-row" href={`/notes/${note.id}`} aria-label={t("library.openNote", { title: note.title })} key={note.id}>
              <time className="note-date" dateTime={note.searchDate}>{formatDate(note.searchDate)}</time>
              <div><p className="note-object-type">{note.isFavorite ? `★ ${t("library.favorite")} · ` : ""}{noteCategoryLabel(note.category, locale)}</p><h2 className="note-title">{note.title}</h2><p className="note-summary">{note.summary}</p></div>
              <div className="note-meta"><span className={`trust-badge is-${note.overallConfidence.toLowerCase()}`}>{note.overallConfidence}</span><span className="mode-pill">{note.mode}</span></div>
            </Link>
          )) : notes.length === 0 ? (
            <div className="empty-state"><h2>{t("library.empty")}</h2><p className="muted">{t("library.emptyCopy")}</p><Link href="/">{t("library.start")}</Link></div>
          ) : (
            <div className="empty-state"><h2>{t("library.filteredEmpty")}</h2><p className="muted">{t("library.filteredEmptyCopy")}</p><button className="text-action" type="button" onClick={() => setFilter("ALL")}>{t("library.viewAll")}</button></div>
          )}
        </div>
      </div>
    </section>
  );
}

function LibraryFilterButton({ active, count, icon, label, onClick }: { active: boolean; count: number; icon?: string; label: string; onClick: () => void }) {
  return <button className={active ? "is-active" : ""} type="button" aria-pressed={active} onClick={onClick}><span>{icon ? `${icon} ` : ""}{label}</span><b>{count}</b></button>;
}

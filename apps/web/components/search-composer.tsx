"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useLocale } from "../lib/i18n/locale-provider";
import { searchOsMutationRequestHeaders } from "../lib/request-headers";

export function SearchComposer() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const goldenQuestion = locale === "en-US" ? "How do I delete a dict key in Python?" : "Python 怎么删除 dict key？";
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"AUTO" | "QUICK">("AUTO");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = question.trim();
    if (!value) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/search-tasks", {
        method: "POST",
        headers: { ...searchOsMutationRequestHeaders, "content-type": "application/json" },
        body: JSON.stringify({ question: value, requestedMode: mode, outputLocale: locale })
      });
      const payload = await response.json() as { taskId?: string; runId?: string; error?: { publicMessage?: string } };
      if (!response.ok || !payload.taskId || !payload.runId) throw new Error(payload.error?.publicMessage ?? t("composer.createFailed"));
      router.push(`/search/${payload.taskId}?run=${payload.runId}&q=${encodeURIComponent(value)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("composer.createFailedRetry"));
      setSubmitting(false);
    }
  }

  return (
    <form className="search-composer" onSubmit={submit}>
      <div className="composer-header">
        <div><span className="panel-label">{t("composer.query")}</span><span className="composer-state">{t("composer.ready")}</span></div>
        <span className="keyboard-hint">⌘ ↵</span>
      </div>
      <textarea
        className="search-input"
        value={question}
        onChange={(event) => { setQuestion(event.target.value); setMessage(""); }}
        placeholder={t("composer.placeholder")}
        aria-label={t("composer.questionAria")}
        maxLength={4000}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div className="composer-scope">
        <div>
          <span className="scope-label">{t("composer.mode")}</span>
          <div className="segmented-control" aria-label={t("composer.modeAria")}>
            <button className={mode === "AUTO" ? "is-active" : ""} type="button" onClick={() => setMode("AUTO")}>{t("composer.auto")}</button>
            <button className={mode === "QUICK" ? "is-active" : ""} type="button" onClick={() => setMode("QUICK")}>{t("composer.quick")}</button>
            <button type="button" disabled title={t("composer.futureRound")}>{t("composer.compare")}</button>
            <button type="button" disabled title={t("composer.futureRound")}>{t("composer.research")}</button>
          </div>
        </div>
        <div className="scope-summary" aria-label={t("composer.scopeAria")}>
          <span className="scope-label">{t("composer.scope")}</span>
          <span>Web</span><span>{t("composer.officialFirst")}</span><span>{t("composer.answerFollowsLanguage")}</span>
        </div>
      </div>
      <div className="composer-footer">
        <button className="example-button" type="button" onClick={() => setQuestion(goldenQuestion)}>
          {t("composer.useReplay", { question: goldenQuestion })}
        </button>
        <button className="search-submit" disabled={!question.trim() || submitting} type="submit">
          <span>{submitting ? t("composer.creating") : t("composer.start")}</span><span aria-hidden="true">→</span>
        </button>
      </div>
      {message && <p className="inline-message is-warning" role="status">{message}</p>}
    </form>
  );
}

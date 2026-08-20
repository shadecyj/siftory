"use client";

import type { ReactNode } from "react";
import { useLocale } from "../lib/i18n/locale-provider";

export function HomePageContent({ composer }: { composer: ReactNode }) {
  const { t } = useLocale();
  const steps = [
    ["01", "home.guideUnderstandTitle", "home.guideUnderstandCopy"],
    ["02", "home.guideRetrieveTitle", "home.guideRetrieveCopy"],
    ["03", "home.guideVerifyTitle", "home.guideVerifyCopy"],
    ["04", "home.guideKeepTitle", "home.guideKeepCopy"]
  ] as const;
  return (
    <section className="home-workbench">
      <header className="page-toolbar">
        <div><p className="eyebrow">{t("home.eyebrow")}</p><h1 className="page-title">{t("home.title")}</h1></div>
        <div className="toolbar-context"><span className="status-dot" />{t("home.evidenceFirst")}</div>
      </header>
      <div className="home-content">
        {composer}
        <aside className="search-guide" aria-label={t("home.guideAria")}>
          <p className="panel-label">{t("home.guideTitle")}</p>
          <ol className="guide-steps">
            {steps.map(([number, title, copy]) => <li key={number}><span>{number}</span><div><strong>{t(title)}</strong><p>{t(copy)}</p></div></li>)}
          </ol>
        </aside>
      </div>
    </section>
  );
}

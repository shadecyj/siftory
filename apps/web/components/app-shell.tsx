"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { productName } from "../lib/brand";
import { useLocale } from "../lib/i18n/locale-provider";

const fixtureTaskId = "00000000-0000-7000-8000-000000000002";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [runtime, setRuntime] = useState<{ runtimeMode: "replay" | "live"; searchProvider: string; modelProvider: string } | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("searchos:theme");
    const next = stored === "dark" || stored === "light"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/runtime", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("runtime unavailable");
        const payload = await response.json() as { runtimeMode: "replay" | "live"; searchProvider: string; modelProvider: string };
        if (active) setRuntime(payload);
      })
      .catch(() => { if (active) setRuntime(null); });
    return () => { active = false; };
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("searchos:theme", next);
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label={t("nav.primary")}>
        <div className="sidebar-top">
          <Link className="product-mark" href="/" aria-label={t("app.productHome")}>
            <span className="product-glyph" aria-hidden="true">S</span>
            <span>{productName}</span>
            <span className="version-mark">0.1</span>
          </Link>
          <Link className="new-search-button" href="/">
            <span aria-hidden="true">＋</span><span>{t("app.newSearch")}</span>
          </Link>
          <nav className="primary-nav">
            <Link className={pathname === "/" ? "is-active" : ""} href="/"><span aria-hidden="true">⌕</span><span>{t("nav.search")}</span></Link>
            <Link className={pathname.startsWith("/library") || pathname.startsWith("/notes") ? "is-active" : ""} href="/library"><span aria-hidden="true">▤</span><span>{t("nav.library")}</span></Link>
            <Link className={pathname.startsWith("/settings") ? "is-active" : ""} href="/settings"><span aria-hidden="true">⚙</span><span>{t("nav.settings")}</span></Link>
          </nav>
        </div>
        <div className="sidebar-history">
          <p className="nav-section-label">{t("nav.recentSearches")}</p>
          <Link className={pathname.startsWith("/search") ? "history-row is-current" : "history-row"} href={`/search/${fixtureTaskId}`}>
            <span className="history-title">{t("nav.fixtureTitle")}</span>
            <span className="history-meta">{t("nav.fixtureMeta")}</span>
          </Link>
        </div>
        <div className="sidebar-footer">
          <div className="locale-switcher" role="group" aria-label={t("locale.switcher")}>
            <button className={locale === "zh-CN" ? "is-active" : ""} type="button" onClick={() => setLocale("zh-CN")} aria-pressed={locale === "zh-CN"}>中</button>
            <button className={locale === "en-US" ? "is-active" : ""} type="button" onClick={() => setLocale("en-US")} aria-pressed={locale === "en-US"}>EN</button>
          </div>
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={t("theme.switchTo", { theme: theme === "light" ? t("theme.dark") : t("theme.light") })}>
            <span aria-hidden="true">{theme === "light" ? "◐" : "◑"}</span>
            <span>{theme === "light" ? t("theme.dark") : t("theme.light")}</span>
          </button>
          <RuntimeBadge runtime={runtime} t={t} />
        </div>
      </aside>
      <div className="app-stage">
        <header className="mobile-toolbar">
          <Link className="product-mark" href="/"><span className="product-glyph">S</span><span>{productName}</span></Link>
          <RuntimeBadge runtime={runtime} t={t} compact />
          <nav><Link href="/">{t("app.newSearch")}</Link><Link href="/library">{t("nav.library")}</Link><Link href="/settings">{t("nav.settings")}</Link></nav>
        </header>
        <main id="main-content" className="main-workspace">{children}</main>
      </div>
    </div>
  );
}

function RuntimeBadge({ runtime, t, compact = false }: { runtime: { runtimeMode: "replay" | "live"; searchProvider: string; modelProvider: string } | null; t: ReturnType<typeof useLocale>["t"]; compact?: boolean }) {
  const label = runtime?.runtimeMode === "live"
    ? t("runtime.live", { searchProvider: runtime.searchProvider, modelProvider: runtime.modelProvider })
    : runtime?.runtimeMode === "replay" ? t("runtime.replay") : t("runtime.checking");
  const compactLabel = runtime?.runtimeMode === "live" ? t("runtime.liveCompact") : runtime?.runtimeMode === "replay" ? t("runtime.replayCompact") : "…";
  return <div className={`runtime-badge ${compact ? "is-compact" : ""} ${runtime ? `is-${runtime.runtimeMode}` : "is-pending"}`}><span className="status-dot" /><span>{compact ? compactLabel : label}</span></div>;
}

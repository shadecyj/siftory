"use client";

import Link from "next/link";
import { useLocale } from "../lib/i18n/locale-provider";

export function NotFoundContent() {
  const { t } = useLocale();
  return <div className="empty-state"><p className="eyebrow">{t("notFound.eyebrow")}</p><h1 className="page-title">{t("notFound.title")}</h1><Link href="/library">{t("notFound.back")}</Link></div>;
}

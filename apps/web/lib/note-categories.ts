import type { NoteCategory } from "@searchos/contracts";
import type { Locale } from "./i18n/locale";
import { translate } from "./i18n/translate";

const categories = ["INBOX", "TECHNOLOGY", "AI_DATA", "PRODUCT_BUSINESS", "LEARNING_RESEARCH", "WORK", "LIFE", "OTHER"] as const satisfies readonly NoteCategory[];

export function getNoteCategoryOptions(locale: Locale): readonly { value: NoteCategory; label: string; shortLabel: string }[] {
  return categories.map((value) => ({
    value,
    label: noteCategoryLabel(value, locale),
    shortLabel: noteCategoryLabel(value, locale)
  }));
}

export function noteCategoryLabel(category: NoteCategory, locale: Locale): string {
  return translate(locale, `noteCategory.${category}` as never);
}

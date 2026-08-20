import { defaultLocale, type Locale } from "./locale";
import { messagesEnUS } from "./messages.en-US";
import { messagesZhCN } from "./messages.zh-CN";

export type MessageKey = keyof typeof messagesZhCN;
export type MessageVariables = Readonly<Record<string, string | number>>;

const messageCatalog: Record<Locale, Record<MessageKey, string>> = {
  "zh-CN": messagesZhCN,
  "en-US": messagesEnUS
};

export function translate(locale: Locale, key: MessageKey, variables: MessageVariables = {}): string {
  const template = messageCatalog[locale]?.[key] ?? messageCatalog[defaultLocale][key];
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (placeholder, variableName: string) => {
    const value = variables[variableName];
    return value === undefined ? placeholder : String(value);
  });
}

export function getMessages(locale: Locale): Readonly<Record<MessageKey, string>> {
  return messageCatalog[locale];
}

import { createContext, useContext } from "react";
import { en } from "./en";
import { tr, type Messages } from "./tr";

export type Lang = "tr" | "en";
export const MESSAGES: Record<Lang, Messages> = { tr, en };
export type { Messages };

/** "{ad}" yer tutucularını doldurur. */
export function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Tutarı dilin biçimiyle TL olarak yazar: 1.234,56 ₺ / ₺1,234.56 */
export function formatMoney(amount: number, m: Messages): string {
  return amount.toLocaleString(m.locale, { style: "currency", currency: "TRY" });
}

/** ISO tarihi dilin biçimiyle yazar. */
export function formatDate(iso: string, m: Messages): string {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString(m.locale, { timeZone: "UTC" });
}

export const I18nContext = createContext<{ m: Messages; lang: Lang; setLang: (l: Lang) => void }>({
  m: tr,
  lang: "tr",
  setLang: () => {},
});

export const useI18n = () => useContext(I18nContext);

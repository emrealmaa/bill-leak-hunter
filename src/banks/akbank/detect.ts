import { foldKey } from "../common/text";
import type { StatementLine } from "../types";

// Yalnızca bankanın SABİT ifadelerine bakılır; kişiye özel hiçbir alana bakılmaz.
const BRAND = ["AXESS", "AKBANK"];
const DOCUMENT = ["HESAP OZETI"];

/** Akbank kredi kartı hesap özeti mi? Hem marka hem belge türü ifadesi geçmeli. */
export function detectAkbank(lines: readonly StatementLine[]): boolean {
  let brand = false;
  let doc = false;
  for (const line of lines) {
    const key = foldKey(line.text);
    brand ||= BRAND.some((w) => new RegExp(`(?<![A-Z])${w}(?![A-Z])`).test(key));
    doc ||= DOCUMENT.some((w) => key.includes(w));
    if (brand && doc) return true;
  }
  return false;
}

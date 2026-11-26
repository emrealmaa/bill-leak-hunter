import type { PdfPage } from "../types";
import type { BankParser } from "./types";

// Kayıtlı ayrıştırıcılar. Henüz banka desteği yok (bkz. PROJE.md §11, Hafta 1).
export const parsers: BankParser[] = [];

// Ekstreyi tanıyan ilk ayrıştırıcıyı döndürür; tanınmazsa undefined.
export function detectBank(
  pages: PdfPage[],
  candidates: BankParser[] = parsers,
): BankParser | undefined {
  return candidates.find((p) => p.detect(pages));
}

import type { Transaction } from "../types";
import { decodeStatement, type RawStatement } from "./decodeStatement";
import { StatementError, type StatementErrorCode } from "./errors";
import { parsers } from "./registry";
import type { BankParser, ParseWarningReason } from "./types";

/**
 * Bir ekstrenin teşhis özeti. YALNIZCA SAYI ve sabit kod taşır; hiçbir metin,
 * tutar, tarih ya da açıklama içermez (PROJE.md §10). Gerçek ekstrede
 * doğrulama script'i ve geliştirici sayfası bunu yazdırır.
 */
export interface StatementCheck {
  pages: number;
  type3Glyphs: number;
  unknownGlyphs: number;
  bank?: string;
  error?: StatementErrorCode;
  transactions: number;
  kinds: Partial<Record<Transaction["kind"], number>>;
  installments: number;
  foreign: number;
  warnings: Partial<Record<ParseWarningReason, number>>;
  periodFound: boolean;
  /** Önceki borç + işlem toplamı = dönem borcu mu? */
  totalMatches: "evet" | "hayır" | "hesaplanamadı";
}

/** Glif tablosunu verilen tabloyla değiştirerek dener (etiketleme sürerken). */
export function withGlyphTable(
  candidates: readonly BankParser[],
  bankId: string,
  table: ReadonlyMap<string, string>,
): BankParser[] {
  return candidates.map((p) => (p.id === bankId ? { ...p, glyphTable: table } : p));
}

export function checkStatement(raw: RawStatement, candidates: readonly BankParser[] = parsers): StatementCheck {
  const type3Glyphs = (raw.glyphs ?? []).reduce((n, p) => n + p.filter((g) => g.hash !== null).length, 0);
  const base: StatementCheck = {
    pages: raw.pages.length,
    type3Glyphs,
    unknownGlyphs: type3Glyphs,
    transactions: 0,
    kinds: {},
    installments: 0,
    foreign: 0,
    warnings: {},
    periodFound: false,
    totalMatches: "hesaplanamadı",
  };
  let decoded;
  try {
    decoded = decodeStatement(raw, candidates);
  } catch (err) {
    if (err instanceof StatementError) return { ...base, error: err.code };
    throw err;
  }
  const result = decoded.parser.parse(decoded.lines);
  const out: StatementCheck = {
    ...base,
    unknownGlyphs: decoded.unknownGlyphs,
    bank: decoded.parser.id,
    transactions: result.transactions.length,
    periodFound: result.period !== undefined,
  };
  for (const t of result.transactions) {
    out.kinds[t.kind] = (out.kinds[t.kind] ?? 0) + 1;
    if (t.installment) out.installments++;
    if (t.originalAmount !== undefined) out.foreign++;
  }
  for (const w of result.warnings) out.warnings[w.reason] = (out.warnings[w.reason] ?? 0) + 1;
  if (result.transactions.length === 0) out.error = "no-transactions";

  const s = result.summary;
  if (s?.statementDebt !== undefined && s.previousDebt !== undefined) {
    const cents = (n: number) => Math.round(n * 100);
    const sum = result.transactions.reduce((n, t) => n + cents(t.amount), 0);
    out.totalMatches = cents(s.previousDebt) + sum === cents(s.statementDebt) ? "evet" : "hayır";
  }
  return out;
}

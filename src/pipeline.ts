import { analyze } from "./analysis";
import { decodeStatement, type RawStatement } from "./banks/decodeStatement";
import { StatementError } from "./banks/errors";
import { parsers } from "./banks/registry";
import type { BankParser } from "./banks/types";
import { normalizeTransactions } from "./normalize";
import type { AnalysisResult, ParseResult, Transaction } from "./types";

export interface StatementReport {
  bank: { id: string; displayName: string };
  period?: ParseResult["period"];
  transactions: Transaction[];
  warnings: ParseResult["warnings"];
  unknownGlyphs: number;
  analysis: AnalysisResult;
}

/**
 * Ekstreyi baştan sona işler: banka tanıma (gerekirse glif çözme) →
 * ayrıştırma → normalleştirme → analiz. Hiç işlem çıkmazsa
 * StatementError("no-transactions") verir.
 */
export function processStatement(raw: RawStatement, candidates: readonly BankParser[] = parsers): StatementReport {
  const decoded = decodeStatement(raw, candidates);
  const parsed = decoded.parser.parse(decoded.lines);
  if (parsed.transactions.length === 0) throw new StatementError("no-transactions");
  const transactions = normalizeTransactions(parsed.transactions);
  return {
    bank: { id: decoded.parser.id, displayName: decoded.parser.displayName },
    period: parsed.period,
    transactions,
    warnings: parsed.warnings,
    unknownGlyphs: decoded.unknownGlyphs,
    analysis: analyze(transactions),
  };
}

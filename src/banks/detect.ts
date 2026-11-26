import { StatementError } from "./errors";
import { parsers } from "./registry";
import type { BankParser, StatementLine } from "./types";

/** Ekstreyi tanıyan ilk ayrıştırıcıyı döndürür; tanınmazsa undefined. */
export function findParser(
  lines: StatementLine[],
  candidates: readonly BankParser[] = parsers,
): BankParser | undefined {
  return candidates.find((p) => p.detect(lines));
}

/** findParser gibi, ama hiçbiri tanımazsa "Bu bankayı henüz desteklemiyoruz" hatası verir. */
export function detectBank(lines: StatementLine[], candidates: readonly BankParser[] = parsers): BankParser {
  const parser = findParser(lines, candidates);
  if (!parser) throw new StatementError("unsupported-bank");
  return parser;
}

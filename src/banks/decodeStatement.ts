import { decodeGlyphs } from "../pdf/decode";
import type { PositionedGlyph } from "../pdf/glyphs";
import type { ReadonlyGlyphTable } from "../pdf/glyphTable";
import type { PdfPage } from "../types";
import { StatementError } from "./errors";
import { toStatementLines } from "./lines";
import { parsers } from "./registry";
import type { BankParser, StatementLine } from "./types";

/** PDF'ten okunmuş ham ekstre: pdf.js metni ve (varsa) konumlanmış glifler. */
export interface RawStatement {
  pages: PdfPage[];
  /** Sayfa başına glifler; Type3 fontlu ekstreleri çözmek için. */
  glyphs?: PositionedGlyph[][];
}

export interface DecodedStatement {
  parser: BankParser;
  lines: StatementLine[];
  /** Type3 (şekil hash'li) glif sayısı. */
  type3Glyphs: number;
  /** Tabloda karşılığı olmayan Type3 glif sayısı. */
  unknownGlyphs: number;
}

/**
 * Bilinmeyen Type3 glif oranı bunun üstündeyse metin okunamaz sayılır ve
 * "karakter tablosu eksik" hatası verilir.
 */
export const MISSING_TABLE_RATIO = 0.2;

/** Gliflerin en az bu kadarı Type3 ise metin Type3 fontla yazılmış sayılır. */
export const TYPE3_TEXT_RATIO = 0.5;

function countType3(glyphs: readonly PositionedGlyph[][], table?: ReadonlyGlyphTable) {
  let type3 = 0;
  let unknown = 0;
  for (const page of glyphs) {
    for (const g of page) {
      if (g.hash === null) continue;
      type3++;
      if (!table?.has(g.hash)) unknown++;
    }
  }
  return { type3, unknown };
}

function decodedPages(raw: RawStatement, table: ReadonlyGlyphTable): PdfPage[] {
  return raw.pages.map((p, i) => ({ ...p, items: decodeGlyphs(raw.glyphs?.[i] ?? [], table) }));
}

/**
 * Ekstrenin bankasını bulur ve metnini ayrıştırıcıya hazır satırlara çevirir.
 * 1. Önce pdf.js metniyle denenir (normal fontlu ekstreler).
 * 2. Tanınmazsa ve Type3 glif varsa, glif tablosu olan her ayrıştırıcı için
 *    metin o tabloyla çözülüp yeniden denenir.
 * Hiçbiri tanımazsa: Type3 metin okunamıyorsa "karakter tablosu eksik",
 * değilse "bu bankayı henüz desteklemiyoruz" hatası verilir.
 */
export function decodeStatement(raw: RawStatement, candidates: readonly BankParser[] = parsers): DecodedStatement {
  const glyphs = raw.glyphs ?? [];
  const plainLines = toStatementLines(raw.pages);
  const plain = candidates.find((p) => p.detect(plainLines));
  const { type3 } = countType3(glyphs);
  if (plain) return { parser: plain, lines: plainLines, type3Glyphs: type3, unknownGlyphs: 0 };

  // Type3 yalnızca logo gibi birkaç yerdeyse metin zaten pdf.js'ten okunur.
  const total = glyphs.reduce((n, p) => n + p.length, 0);
  if (type3 > 0 && type3 / total >= TYPE3_TEXT_RATIO) {
    let readable = false;
    for (const parser of candidates) {
      if (!parser.glyphTable) continue;
      const { unknown } = countType3(glyphs, parser.glyphTable);
      if (unknown / type3 > MISSING_TABLE_RATIO) continue;
      readable = true;
      const lines = toStatementLines(decodedPages(raw, parser.glyphTable));
      if (parser.detect(lines)) return { parser, lines, type3Glyphs: type3, unknownGlyphs: unknown };
    }
    if (!readable) throw new StatementError("missing-glyph-table");
  }
  throw new StatementError("unsupported-bank");
}

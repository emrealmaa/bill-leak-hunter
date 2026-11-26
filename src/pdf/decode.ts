import type { PdfTextItem } from "../types";
import type { PositionedGlyph } from "./glyphs";
import type { GlyphTable } from "./glyphTable";

export const UNKNOWN_CHAR = "�"; // "�" (bilerek; bozuk karakter değil)
/*
 * Eşiklerin birimi: (glifler arası yatay aralık) / (glif yüksekliği).
 * "Glif yüksekliği", PositionedGlyph.fontSize'dır; Type3 fontlarda fontun tipik
 * glif yüksekliğidir (glif sınırlarının medyanı). Teşhiste ölçülen oran da
 * budur: Akbank ekstrelerinde harf içi aralıklar 0–0.1, kelime araları 0.2 ve
 * üstü çıktı; 0.1–0.2 arası boştu. Bu yüzden boşluk eşiği 0.15.
 */
export const DEFAULT_SPACE_THRESHOLD = 0.15;
export const DEFAULT_COLUMN_GAP = 2;

export interface DecodeOptions {
  /** aralık / glif yüksekliği > spaceThreshold ise araya " " konur. */
  spaceThreshold?: number;
  /** aralık / glif yüksekliği > columnGap ise yeni bir metin parçası başlar (sütun arası). */
  columnGap?: number;
}

/** Bir glifin karakteri: Type3 ise tablodan, değilse pdf.js'in Unicode'u. */
export function glyphChar(g: PositionedGlyph, table: GlyphTable): string {
  if (g.hash === null) return g.unicode;
  return table.get(g.hash) ?? UNKNOWN_CHAR;
}

/** a'nın bitişi ile b'nin başlangıcı arasındaki yatay boşluk (aynı taban çizgisindeyse). */
export function gapBetween(a: PositionedGlyph, b: PositionedGlyph): number | null {
  const size = Math.max(a.fontSize, b.fontSize) || 1;
  if (Math.abs(a.y - b.y) > size * 0.2) return null; // farklı taban çizgisi
  return b.x - (a.x + a.advance);
}

/** a ile b arasına (soldan sağa sıralı) boşluk konmalı mı? */
export function needsSpace(a: PositionedGlyph, b: PositionedGlyph, spaceThreshold = DEFAULT_SPACE_THRESHOLD): boolean {
  const gap = gapBetween(a, b);
  return gap !== null && gap > spaceThreshold * (Math.max(a.fontSize, b.fontSize) || 1);
}

/**
 * Konumlanmış glifleri tabloyla çözülmüş metin parçalarına çevirir.
 * Glifler çizim sırasıyla gezilir; aynı taban çizgisinde ve yakın duran glifler
 * tek parça olur. Bilinmeyen glif "�" olur; tahmin yürütülmez (PROJE.md §8).
 */
export function decodeGlyphs(
  glyphs: readonly PositionedGlyph[],
  table: GlyphTable,
  { spaceThreshold = DEFAULT_SPACE_THRESHOLD, columnGap = DEFAULT_COLUMN_GAP }: DecodeOptions = {},
): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  let current: { item: PdfTextItem; last: PositionedGlyph } | null = null;

  for (const g of glyphs) {
    const ch = glyphChar(g, table);
    if (current) {
      const size = Math.max(current.last.fontSize, g.fontSize) || 1;
      const gap = gapBetween(current.last, g);
      // Aynı parçanın devamı: aynı taban çizgisi, geriye büyük sıçrama yok, sütun arası kadar uzak değil
      if (gap !== null && gap > -0.5 * size && gap <= columnGap * size) {
        if (gap > spaceThreshold * size) current.item.str += " ";
        current.item.str += ch;
        current.item.width = g.x + g.advance - current.item.x;
        current.item.height = Math.max(current.item.height, g.fontSize);
        current.last = g;
        continue;
      }
    }
    const item: PdfTextItem = { str: ch, x: g.x, y: g.y, width: g.advance, height: g.fontSize };
    items.push(item);
    current = { item, last: g };
  }
  return items;
}

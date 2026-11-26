import type { PdfTextItem } from "../types";

export interface TextLine {
  y: number; // satırın referans y değeri (en üstteki öğenin y'si)
  items: PdfTextItem[]; // soldan sağa sıralı
  text: string;
}

export interface GroupOptions {
  /** Aynı satır sayılmak için izin verilen en büyük y farkı (PDF birimi). */
  yTolerance?: number;
  /** Satırdaki öğeleri birleştirirken araya konacak metin. */
  joiner?: string;
}

export const DEFAULT_Y_TOLERANCE = 2;

/**
 * Metin parçalarını görsel satırlara gruplar.
 *
 * pdf.js'te y aşağıdan yukarıya arttığı için satırlar y'ye göre BÜYÜKTEN
 * KÜÇÜĞE sıralanır (sayfada yukarıdan aşağıya). Her satır, en üstteki öğesinin
 * y'sini referans alır ve referanstan en fazla `yTolerance` uzaktaki öğeleri
 * içerir. Böylece küçük kaymalar zincirlenip satırlar birbirine karışmaz.
 * Boş / yalnızca boşluk içeren parçalar atlanır.
 */
export function groupIntoLines(
  items: PdfTextItem[],
  { yTolerance = DEFAULT_Y_TOLERANCE, joiner = " " }: GroupOptions = {},
): TextLine[] {
  return groupByLine(
    items.filter((it) => it.str.trim() !== ""),
    yTolerance,
  ).map((line) => ({
    y: line.y,
    items: line.items,
    text: line.items.map((it) => it.str.trim()).join(joiner),
  }));
}

/**
 * Konumu olan herhangi bir öğeyi (metin parçası, glif) satırlara gruplar.
 * Kurallar groupIntoLines ile aynıdır.
 */
export function groupByLine<T extends { x: number; y: number }>(
  items: readonly T[],
  yTolerance: number = DEFAULT_Y_TOLERANCE,
): { y: number; items: T[] }[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; items: T[] }[] = [];
  for (const item of sorted) {
    const current = lines[lines.length - 1];
    if (current && Math.abs(current.y - item.y) <= yTolerance) {
      current.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

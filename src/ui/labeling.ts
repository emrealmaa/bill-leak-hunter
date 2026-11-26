/**
 * Etiketleme modunun saf mantığı (React'ten bağımsız, test edilebilir).
 *
 * Boşluk kuralı: Bu ekstrelerde boşluklar glif olarak çizilmez, yalnızca
 * glifler arası aralıktır. Bu yüzden kullanıcının yazdığı metindeki boşluklar
 * eşleştirmede SAYILMAZ; boşluksuz karakter sayısı glif sayısına eşit olmalıdır.
 */
import { DEFAULT_COLUMN_GAP, DEFAULT_SPACE_THRESHOLD, glyphChar, needsSpace } from "../pdf/decode";
import type { PositionedGlyph } from "../pdf/glyphs";
import type { GlyphTable } from "../pdf/glyphTable";
import { groupByLine } from "../pdf/lines";

/** Etiketlenecek bir satır parçası (sütun aralarında bölünmüş). */
export interface LabelLine {
  id: string;
  pageNumber: number;
  /** Soldan sağa sıralı, hepsi Type3 (hash'li) glifler. */
  glyphs: PositionedGlyph[];
  /** Kullanıcı uzayında kutu (y yukarı). */
  box: { x0: number; y0: number; x1: number; y1: number };
}

export function buildLabelLines(
  glyphsByPage: readonly (readonly PositionedGlyph[])[],
  { yTolerance, columnGap = DEFAULT_COLUMN_GAP }: { yTolerance: number; columnGap?: number },
): LabelLine[] {
  const out: LabelLine[] = [];
  glyphsByPage.forEach((pageGlyphs, pageIdx) => {
    const lines = groupByLine(
      pageGlyphs.filter((g) => g.hash !== null),
      yTolerance,
    );
    let n = 0;
    for (const line of lines) {
      let segment: PositionedGlyph[] = [];
      const flush = () => {
        if (segment.length === 0) return;
        // Kırpma kutusu: gliflerin gerçek çizim sınırlarının birleşimi
        // (büyük harfin üstü, İ'nin noktası, alt uzantılar dahil).
        out.push({
          id: `${pageIdx + 1}-${n++}`,
          pageNumber: pageIdx + 1,
          glyphs: segment,
          box: {
            x0: Math.min(...segment.map((g) => Math.min(g.box.x0, g.x))),
            x1: Math.max(...segment.map((g) => Math.max(g.box.x1, g.x + g.advance))),
            y0: Math.min(...segment.map((g) => g.box.y0)),
            y1: Math.max(...segment.map((g) => g.box.y1)),
          },
        });
        segment = [];
      };
      for (const g of line.items) {
        const prev = segment[segment.length - 1];
        // Birim: aralık / glif yüksekliği (bkz. decode.ts)
        if (prev && g.x - (prev.x + prev.advance) > columnGap * Math.max(prev.fontSize, g.fontSize)) flush();
        segment.push(g);
      }
      flush();
    }
  });
  return out;
}

/** Satırın glif düzeni: her glif "•", hesaplanan boşluklar " ". */
export function glyphPattern(line: LabelLine, spaceThreshold = DEFAULT_SPACE_THRESHOLD): string {
  return line.glyphs.map((g, i) => (i > 0 && needsSpace(line.glyphs[i - 1], g, spaceThreshold) ? " •" : "•")).join("");
}

/** Satırın tabloyla şu anki çözümü (bilinmeyen "�"). */
export function decodeLine(line: LabelLine, table: GlyphTable, spaceThreshold = DEFAULT_SPACE_THRESHOLD): string {
  return line.glyphs
    .map((g, i) => (i > 0 && needsSpace(line.glyphs[i - 1], g, spaceThreshold) ? " " : "") + glyphChar(g, table))
    .join("");
}

/** Yazılan metnin eşleştirmede kullanılan karakterleri (boşluklar hariç). */
export function typedChars(text: string): string[] {
  return [...text.normalize("NFC")].filter((c) => !/\s/u.test(c));
}

export interface Conflict {
  /** Satırdaki glif sırası (0'dan). */
  index: number;
  hash: string;
  existing: string;
  proposed: string;
}

export type LabelResult =
  | { ok: false; reason: "count"; glyphCount: number; charCount: number }
  | { ok: true; assignments: [hash: string, char: string][]; conflicts: Conflict[]; newCount: number };

/**
 * Yazılan metni satırın glifleriyle sırayla eşler.
 * Çakışma: hash tabloda (ya da aynı satırda daha önce) başka bir karaktere
 * eşlenmişse. Çakışmalar otomatik çözülmez; çağıran karar verir.
 */
export function labelLine(line: LabelLine, text: string, table: GlyphTable): LabelResult {
  const chars = typedChars(text);
  if (chars.length !== line.glyphs.length) {
    return { ok: false, reason: "count", glyphCount: line.glyphs.length, charCount: chars.length };
  }
  const assignments = new Map<string, string>();
  const conflicts: Conflict[] = [];
  let newCount = 0;
  line.glyphs.forEach((g, index) => {
    const hash = g.hash!;
    const proposed = chars[index];
    const existing = assignments.get(hash) ?? table.get(hash);
    if (existing !== undefined && existing !== proposed) {
      conflicts.push({ index, hash, existing, proposed });
      return;
    }
    if (existing === undefined) newCount++;
    assignments.set(hash, proposed);
  });
  return { ok: true, assignments: [...assignments], conflicts, newCount };
}

export function unlabeledCount(line: LabelLine, table: GlyphTable): number {
  return new Set(line.glyphs.map((g) => g.hash!).filter((h) => !table.has(h))).size;
}

/** Etiketsiz farklı glifi çok olan satır önce; eşitse sayfa sırası korunur. */
export function sortLinesForLabeling(lines: readonly LabelLine[], table: GlyphTable): LabelLine[] {
  return lines
    .map((line, order) => ({ line, order, unlabeled: unlabeledCount(line, table) }))
    .sort((a, b) => b.unlabeled - a.unlabeled || a.order - b.order)
    .map((x) => x.line);
}

/**
 * Glif dizisi birebir aynı olan satırları tek kartta toplar. Kartın ilk satırı
 * gösterilir; aynı hash'leri taşıdıkları için birini etiketlemek hepsini çözer.
 * Kartlar ilk görüldükleri sırayla döner.
 */
export interface LabelGroup {
  id: string;
  lines: LabelLine[];
}

export function groupIdenticalLines(lines: readonly LabelLine[]): LabelGroup[] {
  const byKey = new Map<string, LabelGroup>();
  for (const line of lines) {
    const key = line.glyphs.map((g) => g.hash).join(",");
    const group = byKey.get(key);
    if (group) group.lines.push(line);
    else byKey.set(key, { id: line.id, lines: [line] });
  }
  return [...byKey.values()];
}

/** Kartları, temsil ettikleri satırın etiketsiz glif sayısına göre sıralar. */
export function sortGroupsForLabeling(groups: readonly LabelGroup[], table: GlyphTable): LabelGroup[] {
  return groups
    .map((group, order) => ({ group, order, unlabeled: unlabeledCount(group.lines[0], table) }))
    .sort((a, b) => b.unlabeled - a.unlabeled || a.order - b.order)
    .map((x) => x.group);
}

export const DIGIT_PUNCT = [..."0123456789/.,()-"];

export interface Progress {
  totalShapes: number;
  labeledShapes: number;
  /** Rakam/işaret olarak etiketlenmiş şekil sayısı. */
  digitPunctShapes: number;
  /** DIGIT_PUNCT içinden en az bir şekle atanmış karakterler. */
  digitPunctSeen: string[];
}

export function progress(lines: readonly LabelLine[], table: GlyphTable): Progress {
  const hashes = new Set(lines.flatMap((l) => l.glyphs.map((g) => g.hash!)));
  let labeled = 0;
  let digitPunct = 0;
  const seen = new Set<string>();
  for (const h of hashes) {
    const ch = table.get(h);
    if (ch === undefined) continue;
    labeled++;
    if (DIGIT_PUNCT.includes(ch)) {
      digitPunct++;
      seen.add(ch);
    }
  }
  return {
    totalShapes: hashes.size,
    labeledShapes: labeled,
    digitPunctShapes: digitPunct,
    digitPunctSeen: DIGIT_PUNCT.filter((c) => seen.has(c)),
  };
}

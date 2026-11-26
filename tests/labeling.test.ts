import { describe, expect, it } from "vitest";
import type { PositionedGlyph } from "../src/pdf/glyphs";
import {
  buildLabelLines,
  decodeLine,
  glyphPattern,
  groupIdenticalLines,
  labelLine,
  progress,
  sortGroupsForLabeling,
  sortLinesForLabeling,
} from "../src/ui/labeling";

// Sahte hash'ler; gerçek veri değildir. fontSize 10, ilerleme 5.
const g = (hash: string | null, x: number, y = 700): PositionedGlyph => ({
  hash,
  unicode: "?",
  x,
  y,
  advance: 5,
  fontSize: 10,
  sizeSource: "font",
  box: { x0: x, y0: y - 3, x1: x + 5, y1: y + 10 },
});
const h = (n: number) => n.toString(16).padStart(16, "0");

describe("buildLabelLines", () => {
  it("glifleri satırlara ayırır, sütun aralarında böler, hash'siz glifleri atlar", () => {
    const lines = buildLabelLines(
      [
        [g(h(1), 100), g(h(2), 105), g(h(3), 300), g(null, 310), g(h(4), 100, 650)],
        [g(h(5), 50)],
      ],
      { yTolerance: 2 },
    );
    expect(lines.map((l) => [l.pageNumber, l.glyphs.map((x) => x.hash)])).toEqual([
      [1, [h(1), h(2)]],
      [1, [h(3)]],
      [1, [h(4)]],
      [2, [h(5)]],
    ]);
    expect(lines[0].box).toMatchObject({ x0: 100, x1: 110 });
  });

  it("kırpma kutusu gliflerin çizim sınırlarının birleşimidir (üst/alt uzantılar dahil)", () => {
    const tall = { ...g(h(1), 100), box: { x0: 100, y0: 699, x1: 105, y1: 717 } }; // ör. büyük İ
    const desc = { ...g(h(2), 105), box: { x0: 105, y0: 696, x1: 110, y1: 705 } }; // ör. alt uzantılı harf
    const [line] = buildLabelLines([[tall, desc]], { yTolerance: 2 });
    expect(line.box).toEqual({ x0: 100, y0: 696, x1: 110, y1: 717 });
  });
});

describe("labelLine", () => {
  const line = buildLabelLines([[g(h(1), 100), g(h(2), 105), g(h(1), 116)]], { yTolerance: 2 })[0];

  it("boşlukları saymadan glifleri sırayla eşler", () => {
    const r = labelLine(line, "a b a", new Map());
    expect(r).toEqual({ ok: true, assignments: [[h(1), "a"], [h(2), "b"]], conflicts: [], newCount: 2 });
  });

  it("glif ve karakter sayısı tutmazsa reddeder", () => {
    expect(labelLine(line, "ab", new Map())).toEqual({ ok: false, reason: "count", glyphCount: 3, charCount: 2 });
  });

  it("tablodaki farklı etiketi çakışma olarak bildirir", () => {
    const r = labelLine(line, "aba", new Map([[h(2), "c"]]));
    expect(r.ok && r.conflicts).toEqual([{ index: 1, hash: h(2), existing: "c", proposed: "b" }]);
  });

  it("aynı satırda aynı glife farklı karakter yazılırsa çakışma bildirir", () => {
    const r = labelLine(line, "abx", new Map());
    expect(r.ok && r.conflicts).toEqual([{ index: 2, hash: h(1), existing: "a", proposed: "x" }]);
  });
});

describe("görünüm yardımcıları", () => {
  const line = buildLabelLines([[g(h(1), 100), g(h(2), 105), g(h(3), 116)]], { yTolerance: 2 })[0];

  it("glif düzeninde hesaplanan boşluğu gösterir", () => {
    expect(glyphPattern(line)).toBe("•• •");
  });

  it("satırı tabloyla çözer, bilinmeyeni � yapar", () => {
    expect(decodeLine(line, new Map([[h(1), "1"], [h(3), "2"]]))).toBe("1� 2");
  });
});

describe("aynı satırları kartta toplama", () => {
  // Üç satır: 1. ve 3. aynı glif dizisi (konumları farklı), 2. farklı
  const lines = buildLabelLines(
    [
      [g(h(1), 100, 700), g(h(2), 105, 700), g(h(3), 100, 650), g(h(1), 50, 600), g(h(2), 55, 600)],
      [g(h(1), 10, 700), g(h(2), 15, 700)],
    ],
    { yTolerance: 2 },
  );

  it("birebir aynı glif dizili satırları (sayfalar arası da) tek kartta toplar", () => {
    const groups = groupIdenticalLines(lines);
    expect(groups.map((gr) => gr.lines.length)).toEqual([3, 1]);
    expect(groups[0].lines.map((l) => l.pageNumber)).toEqual([1, 1, 2]);
    expect(groups[0].id).toBe(lines[0].id);
  });

  it("kartı etiketlemek tablodaki ortak hash'leri doldurur; tüm satırlar çözülür", () => {
    const [group] = groupIdenticalLines(lines);
    const r = labelLine(group.lines[0], "ab", new Map());
    const table = new Map(r.ok ? r.assignments : []);
    expect(group.lines.map((l) => decodeLine(l, table))).toEqual(["ab", "ab", "ab"]);
  });

  it("kartları etiketsiz glif sayısına göre sıralar", () => {
    const groups = groupIdenticalLines(lines);
    expect(sortGroupsForLabeling(groups, new Map([[h(3), "x"]])).map((gr) => gr.lines.length)).toEqual([3, 1]);
    expect(sortGroupsForLabeling(groups, new Map([[h(1), "a"], [h(2), "b"]])).map((gr) => gr.lines.length)).toEqual([1, 3]);
  });
});

describe("sıralama ve ilerleme", () => {
  const lines = buildLabelLines(
    [[g(h(1), 100), g(h(9), 100, 600), g(h(2), 105, 600), g(h(3), 110, 600)]],
    { yTolerance: 2 },
  );
  const table = new Map([
    [h(1), "5"],
    [h(2), ","],
    [h(9), "a"],
  ]);

  it("etiketsiz glifi çok olan satırı öne alır", () => {
    expect(sortLinesForLabeling(lines, new Map()).map((l) => l.glyphs.length)).toEqual([3, 1]);
    // Etiketsiz glif sayısı eşitse sayfa sırası korunur
    expect(sortLinesForLabeling(lines, table).map((l) => l.glyphs.length)).toEqual([3, 1]);
  });

  it("toplam, etiketli ve rakam/işaret sayılarını verir", () => {
    expect(progress(lines, table)).toEqual({
      totalShapes: 4,
      labeledShapes: 3,
      digitPunctShapes: 2,
      digitPunctSeen: ["5", ","], // DIGIT_PUNCT sırasıyla
    });
  });
});

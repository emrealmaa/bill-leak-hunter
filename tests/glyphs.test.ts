import { describe, expect, it } from "vitest";
import {
  canonicalCharProc,
  dedupeGlyphs,
  hashCharProc,
  layoutGlyphs,
  resolveGlyphSizes,
  type3EmHeight,
  type FontInfo,
  type OperatorList,
  type OpsTable,
  type PositionedGlyph,
  type ShowTextGlyph,
} from "../src/pdf/glyphs";

// Sahte komut numaraları (pdf.js'inkilerle aynı olmak zorunda değil).
const OPS: OpsTable = {
  save: 10,
  restore: 11,
  transform: 12,
  beginText: 31,
  endText: 32,
  setCharSpacing: 33,
  setWordSpacing: 34,
  setHScale: 35,
  setLeading: 36,
  setFont: 37,
  setTextRise: 39,
  moveText: 40,
  setLeadingMoveText: 41,
  setTextMatrix: 42,
  nextLine: 43,
  showText: 44,
  setCharWidthAndBounds: 49,
  fill: 22,
  constructPath: 91,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
};
// Aynı komutlar, farklı numaralarla (pdf.js sürüm değişikliği gibi)
const OPS_SHIFTED: OpsTable = Object.fromEntries(Object.entries(OPS).map(([k, v]) => [k, v + 100]));

// Sahte bir glif çizimi: d1 + save + transform + constructPath + restore
function charProc(ops: OpsTable, path: number[], width = 500): OperatorList {
  return {
    fnArray: [ops.setCharWidthAndBounds, ops.save, ops.transform, ops.constructPath, ops.restore],
    argsArray: [
      [width, 0, 0, 0, 500, 700],
      null,
      [1, 0, 0, 1, 0, 0],
      [ops.fill, [new Float32Array(path)], new Float32Array([0, 0, 500, 700])],
      null,
    ],
  };
}

describe("hashCharProc", () => {
  it("aynı çizim aynı hash'i verir", async () => {
    const a = await hashCharProc(charProc(OPS, [0, 1, 100, 200]), OPS);
    const b = await hashCharProc(charProc(OPS, [0, 1, 100, 200]), OPS);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("farklı koordinatlar farklı hash verir", async () => {
    const a = await hashCharProc(charProc(OPS, [0, 1, 100, 200]), OPS);
    const b = await hashCharProc(charProc(OPS, [0, 1, 100, 201]), OPS);
    expect(a).not.toBe(b);
  });

  it("3. ondalıktan küçük kayan nokta farklarından etkilenmez", async () => {
    const a = await hashCharProc(charProc(OPS, [0, 1, 100.0001, 200]), OPS);
    const b = await hashCharProc(charProc(OPS, [0, 1, 99.9999, 200]), OPS);
    expect(a).toBe(b);
  });

  it("pdf.js komut numaraları değişse de aynı hash'i verir (adlar kullanılır)", async () => {
    const a = await hashCharProc(charProc(OPS, [0, 1, 100, 200]), OPS);
    const b = await hashCharProc(charProc(OPS_SHIFTED, [0, 1, 100, 200]), OPS_SHIFTED);
    expect(a).toBe(b);
  });

  it("typed array ile düz dizi aynı kanonik metni üretir; -0 ile 0 aynıdır", () => {
    const typed: OperatorList = { fnArray: [OPS.transform], argsArray: [new Float32Array([1, -0, 0, 1, 0, 0])] };
    const plain: OperatorList = { fnArray: [OPS.transform], argsArray: [[1, 0, 0, 1, 0, 0]] };
    expect(canonicalCharProc(typed, OPS)).toBe(canonicalCharProc(plain, OPS));
  });
});

// --- Konumlar ---

const glyph = (w: number, extra: Partial<ShowTextGlyph> = {}): ShowTextGlyph => ({
  width: w,
  unicode: "?",
  operatorListId: `g${w}`,
  ...extra,
});

function run(fnArray: number[], argsArray: unknown[]) {
  return layoutGlyphs(
    { fnArray, argsArray },
    {
      ops: OPS,
      getFont: () => ({ fontMatrix: [0.001, 0, 0, 0.001, 0, 0] }),
      hashOf: (_f, g) => g.operatorListId ?? null,
    },
  );
}

const close = (v: number) => expect.closeTo(v, 6);

describe("layoutGlyphs", () => {
  it("text matrix, glif genişliği ve TJ aralığıyla konum hesaplar", () => {
    const out = run(
      [OPS.beginText, OPS.setFont, OPS.setTextMatrix, OPS.showText],
      [null, ["F1", 10], [[1, 0, 0, 1, 100, 700]], [[glyph(500), glyph(600), -1000, glyph(500)]]],
    );
    // 500/1000*10 = 5; 600/1000*10 = 6; TJ -1000 → +10
    expect(out.map((g) => g.x)).toEqual([close(100), close(105), close(121)]);
    expect(out.every((g) => g.y === 700)).toBe(true);
    expect(out.map((g) => g.advance)).toEqual([close(5), close(6), close(5)]);
    expect(out[0].fontSize).toBeCloseTo(10);
    expect(out.map((g) => g.hash)).toEqual(["g500", "g600", "g500"]);
  });

  it("yatay ölçek, karakter ve kelime aralığını uygular", () => {
    const out = run(
      [OPS.setFont, OPS.setHScale, OPS.setCharSpacing, OPS.setWordSpacing, OPS.setTextMatrix, OPS.showText],
      [["F1", 10], [50], [1], [3], [[1, 0, 0, 1, 0, 0]], [[glyph(500), glyph(500, { isSpace: true }), glyph(500)]]],
    );
    // her glif: (5 + 1) * 0.5 = 3; boşluk glifi: (5 + 1 + 3) * 0.5 = 4.5
    expect(out.map((g) => g.x)).toEqual([close(0), close(3), close(7.5)]);
  });

  it("moveText ve ctm (transform) dönüşümünü uygular, save/restore durumu geri alır", () => {
    const out = run(
      [OPS.setFont, OPS.save, OPS.transform, OPS.beginText, OPS.moveText, OPS.showText, OPS.restore, OPS.beginText, OPS.moveText, OPS.showText],
      [["F1", 10], null, [2, 0, 0, 2, 10, 20], null, [5, 5], [[glyph(500)]], null, null, [5, 5], [[glyph(500)]]],
    );
    // 1. glif: ctm(2x, +10/+20) uygulanmış → (20, 30), boyut 20; 2. glif: ctm geri alınmış → (5, 5)
    expect(out[0]).toMatchObject({ x: close(20), y: close(30), fontSize: close(20), advance: close(10) });
    expect(out[1]).toMatchObject({ x: close(5), y: close(5), fontSize: close(10) });
  });

  it("Type3: glif kutusunu glif sınırlarından, etkin boyutu tipik glif yüksekliğinden hesaplar", () => {
    // Akbank'taki gibi: fontMatrix birim, fontSize 0.24, glif uzayı ~ nokta cinsinden
    const type3: FontInfo = {
      fontMatrix: [1, 0, 0, 1, 0, 0],
      glyphBounds: (id) => (id === "big" ? [0, -5, 30, 70] : undefined),
      emHeight: 22,
    };
    const out = layoutGlyphs(
      {
        fnArray: [OPS.setFont, OPS.setTextMatrix, OPS.showText],
        argsArray: [["T3", 0.24], [[1, 0, 0, 1, 100, 500]], [[{ width: 30, unicode: "?", operatorListId: "big" }]]],
      },
      { ops: OPS, getFont: () => type3, hashOf: () => "h" },
    );
    expect(out[0].fontSize).toBeCloseTo(22 * 0.24); // 5.28
    expect(out[0].advance).toBeCloseTo(30 * 0.24);
    expect(out[0].box.x0).toBeCloseTo(100);
    expect(out[0].box.x1).toBeCloseTo(100 + 7.2);
    expect(out[0].box.y0).toBeCloseTo(500 - 1.2); // taban çizgisinin altı
    expect(out[0].box.y1).toBeCloseTo(500 + 16.8); // taban çizgisinin üstü (ör. büyük harf)
    expect(out[0].sizeSource).toBe("font");
  });

  it("setLeadingMoveText ve nextLine ile satır atlar", () => {
    const out = run(
      [OPS.setFont, OPS.beginText, OPS.setLeadingMoveText, OPS.showText, OPS.nextLine, OPS.showText],
      [["F1", 10], null, [0, -12], [[glyph(500)]], null, [[glyph(500)]]],
    );
    expect(out.map((g) => g.y)).toEqual([close(-12), close(-24)]);
    expect(out.map((g) => g.x)).toEqual([close(0), close(0)]);
  });
});

describe("az glifli fontlarda etkin boyut", () => {
  it("yeterli glif varsa medyanı kullanır, yoksa FontBBox'ı geçici değer verip güvenilmez işaretler", () => {
    expect(type3EmHeight([20, 22, 24, 30, 18])).toEqual({ emHeight: 22, unreliable: false });
    // Yalnızca nokta/tire çizen font: 2 glif, yükseklik 1; FontBBox yüksekliği 6
    expect(type3EmHeight([1, 1], [-1, -2, 8, 4])).toEqual({ emHeight: 6, unreliable: true });
    // FontBBox da yoksa en büyük glif
    expect(type3EmHeight([1, 3])).toEqual({ emHeight: 3, unreliable: true });
  });

  const pg = (x: number, y: number, fontSize: number, sizeSource: PositionedGlyph["sizeSource"]): PositionedGlyph => ({
    hash: "h",
    unicode: "?",
    x,
    y,
    advance: 1,
    fontSize,
    sizeSource,
    box: { x0: x, y0: y, x1: x + 1, y1: y + 1 },
  });

  it("güvenilmez boyutu aynı satırdaki en yakın güvenilir giften alır", () => {
    const out = resolveGlyphSizes([
      pg(100, 500, 5, "font"),
      pg(300, 500, 8, "font"),
      pg(120, 500, 0.24, "bbox"), // nokta fontu, 100'deki glife yakın
    ]);
    expect(out[2]).toMatchObject({ fontSize: 5, sizeSource: "line" });
    expect(out[0]).toMatchObject({ fontSize: 5, sizeSource: "font" }); // güvenilirler değişmez
  });

  it("aynı satırda güvenilir glif yoksa sayfa medyanını kullanır", () => {
    const out = resolveGlyphSizes([pg(100, 500, 5, "font"), pg(100, 400, 7, "font"), pg(100, 300, 9, "font"), pg(50, 100, 1, "bbox")]);
    expect(out[3]).toMatchObject({ fontSize: 7, sizeSource: "page" });
  });

  it("aynı konumda (±0.5) tekrar çizilen aynı glifi tek sayar; yan yana aynı harfleri korur", () => {
    const a = { ...pg(100, 500, 5, "font"), hash: "a" };
    const out = dedupeGlyphs([
      a,
      { ...a, x: 100.3, y: 500.2 }, // kalın yazı taklidi → atılır
      { ...a, x: 101.9 }, // yan yana aynı dar harf (ör. "11") → kalır
      { ...a, hash: "b", x: 100.2 }, // aynı konumda FARKLI glif → kalır
      { ...pg(200, 500, 5, "font"), hash: null, unicode: "A" },
      { ...pg(200.4, 500, 5, "font"), hash: null, unicode: "A" }, // hash'siz tekrar → atılır
    ]);
    expect(out.map((g) => [g.hash, g.x])).toEqual([
      ["a", 100],
      ["a", 101.9],
      ["b", 100.2],
      [null, 200],
    ]);
  });

  it("sayfada hiç güvenilir glif yoksa geçici değeri korur", () => {
    const out = resolveGlyphSizes([pg(50, 100, 6, "bbox")]);
    expect(out[0]).toMatchObject({ fontSize: 6, sizeSource: "bbox" });
  });
});

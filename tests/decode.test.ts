import { describe, expect, it } from "vitest";
import { decodeGlyphs, needsSpace, UNKNOWN_CHAR } from "../src/pdf/decode";
import { GlyphTableError, parseGlyphTable, serializeGlyphTable } from "../src/pdf/glyphTable";
import { GLYPH_HASH_VERSION, type PositionedGlyph } from "../src/pdf/glyphs";

// Sahte hash'ler ve sahte metin; gerçek ekstre içeriği değildir.
const H = {
  O: "000000000000000a",
  R: "000000000000000b",
  N: "000000000000000c",
  one: "000000000000000d",
};
const table = new Map([
  [H.O, "O"],
  [H.R, "R"],
  [H.N, "N"],
  [H.one, "1"],
]);

// fontSize 10, her glif 5 birim ilerler
const g = (hash: string | null, x: number, y = 700, unicode = "?"): PositionedGlyph => ({
  hash,
  unicode,
  x,
  y,
  advance: 5,
  fontSize: 10,
  sizeSource: "font",
  box: { x0: x, y0: y - 3, x1: x + 5, y1: y + 10 },
});

describe("decodeGlyphs", () => {
  it("bilinen glifleri tabloyla çözer, bitişik glifleri tek parça yapar", () => {
    const items = decodeGlyphs([g(H.O, 100), g(H.R, 105), g(H.N, 110)], table);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ str: "ORN", x: 100, y: 700, width: 15 });
  });

  it("bilinmeyen glif � olur", () => {
    const items = decodeGlyphs([g(H.O, 100), g("ffffffffffffffff", 105)], table);
    expect(items[0].str).toBe(`O${UNKNOWN_CHAR}`);
  });

  it("Type3 olmayan glifte (hash yok) pdf.js'in Unicode'unu kullanır", () => {
    expect(decodeGlyphs([g(null, 100, 700, "A")], table)[0].str).toBe("A");
  });

  it("aralık / glif yüksekliği varsayılan 0.15'i aşarsa boşluk koyar", () => {
    // glif yüksekliği 10 → eşik 1.5 birim
    // O biter 105'te; R 106.4'te (oran 0.14) → boşluk yok; N 113.4'te (R biter 111.4, oran 0.2) → boşluk
    const items = decodeGlyphs([g(H.O, 100), g(H.R, 106.4), g(H.N, 113.4)], table);
    expect(items[0].str).toBe("OR N");
  });

  it("boşluk eşiği ayarlanabilir", () => {
    const glyphs = [g(H.O, 100), g(H.R, 108)]; // aralık 3 → oran 0.3
    expect(decodeGlyphs(glyphs, table, { spaceThreshold: 0.25 })[0].str).toBe("O R");
    expect(decodeGlyphs(glyphs, table, { spaceThreshold: 0.5 })[0].str).toBe("OR");
  });

  it("sütun arası kadar uzak ya da farklı satırdaki glifleri ayrı parça yapar", () => {
    const items = decodeGlyphs([g(H.O, 100), g(H.one, 300), g(H.N, 100, 680)], table);
    expect(items.map((i) => i.str)).toEqual(["O", "1", "N"]);
  });
});

describe("needsSpace", () => {
  it("farklı taban çizgisindeki gliflere boşluk koymaz", () => {
    expect(needsSpace(g(H.O, 100), g(H.R, 120, 650))).toBe(false);
  });
});

describe("glyphs.json", () => {
  it("yalnızca hashVersion ve sıralı glyphs alanlarını yazar, geri okunabilir", () => {
    const text = serializeGlyphTable(new Map([[H.R, "R"], [H.O, "O"]]));
    expect(JSON.parse(text)).toEqual({ hashVersion: GLYPH_HASH_VERSION, glyphs: { [H.O]: "O", [H.R]: "R" } });
    expect(Object.keys(JSON.parse(text).glyphs)).toEqual([H.O, H.R]);
    expect(parseGlyphTable(text)).toEqual(new Map([[H.O, "O"], [H.R, "R"]]));
  });

  it("hashVersion uyuşmazsa Türkçe hatayla reddeder", () => {
    const text = JSON.stringify({ hashVersion: GLYPH_HASH_VERSION + 1, glyphs: {} });
    expect(() => parseGlyphTable(text)).toThrow(GlyphTableError);
    expect(() => parseGlyphTable(text)).toThrow(/hash sürümü/);
  });

  it("beklenmeyen alanları, geçersiz hash'i ve çok karakterli değeri reddeder", () => {
    const v = GLYPH_HASH_VERSION;
    expect(() => parseGlyphTable(JSON.stringify({ hashVersion: v, glyphs: {}, lines: [] }))).toThrow(/beklenmeyen/);
    expect(() => parseGlyphTable(JSON.stringify({ hashVersion: v, glyphs: { xyz: "a" } }))).toThrow(/hash/);
    expect(() => parseGlyphTable(JSON.stringify({ hashVersion: v, glyphs: { [H.O]: "ab" } }))).toThrow(/tek bir karakter/);
    expect(() => parseGlyphTable("{bozuk")).toThrow(/JSON/);
  });

  it("Türkçe karakterleri tek karakter olarak kabul eder", () => {
    const text = JSON.stringify({ hashVersion: GLYPH_HASH_VERSION, glyphs: { [H.O]: "ğ", [H.R]: "İ" } });
    expect(parseGlyphTable(text).get(H.R)).toBe("İ");
  });
});

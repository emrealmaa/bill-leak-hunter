import { describe, expect, it } from "vitest";
import { decodeStatement } from "../src/banks/decodeStatement";
import { StatementError } from "../src/banks/errors";
import type { BankParser, StatementLine } from "../src/banks/types";
import { UNKNOWN_CHAR } from "../src/pdf/decode";
import type { PositionedGlyph } from "../src/pdf/glyphs";
import type { PdfPage } from "../src/types";

// Sahte hash'ler: her harf için uydurma 16 haneli onaltılık değer.
const hashOf = (ch: string) => ch.charCodeAt(0).toString(16).padStart(16, "0");

/** Metni, aynı satırda yan yana duran Type3 gliflere çevirir. */
function type3Line(text: string, y: number): PositionedGlyph[] {
  return [...text].map((ch, i): PositionedGlyph => ({
    hash: ch === " " ? null : hashOf(ch),
    unicode: "?",
    x: 100 + i * 5,
    y,
    advance: 5,
    fontSize: 10,
    sizeSource: "font",
    box: { x0: 100 + i * 5, y0: y - 3, x1: 105 + i * 5, y1: y + 10 },
  })).filter((g) => g.hash !== null);
}

const page = (items: PdfPage["items"] = []): PdfPage => ({ pageNumber: 1, width: 600, height: 800, items });

function parser(id: string, keyword: string, glyphTable?: ReadonlyMap<string, string>): BankParser {
  return {
    id,
    displayName: id,
    glyphTable,
    detect: (lines: StatementLine[]) => lines.some((l) => l.text.includes(keyword)),
    parse: () => ({ transactions: [], warnings: [] }),
  };
}

const fullTable = new Map([..."ORNEKBAZ"].map((c) => [hashOf(c), c]));

describe("decodeStatement", () => {
  it("normal fontlu ekstreyi pdf.js metniyle tanır", () => {
    const raw = { pages: [page([{ str: "NORMAL BANKA", x: 10, y: 700, width: 50, height: 10 }])] };
    const res = decodeStatement(raw, [parser("normal", "NORMAL BANKA")]);
    expect(res.parser.id).toBe("normal");
    expect(res.lines[0].text).toBe("NORMAL BANKA");
  });

  it("Type3 fontlu ekstreyi glif tablosuyla çözüp tanır", () => {
    const raw = { pages: [page()], glyphs: [type3Line("ORNEK BANKA", 700)] };
    const res = decodeStatement(raw, [parser("t3", "ORNEK BANKA", fullTable)]);
    expect(res.parser.id).toBe("t3");
    expect(res.lines[0].text).toBe("ORNEK BANKA");
    expect(res.type3Glyphs).toBe(10);
    expect(res.unknownGlyphs).toBe(0);
  });

  it("tablo boşsa 'karakter tablosu eksik' hatası verir", () => {
    const raw = { pages: [page()], glyphs: [type3Line("ORNEK BANKA", 700)] };
    const run = () => decodeStatement(raw, [parser("t3", "ORNEK BANKA", new Map())]);
    expect(run).toThrow(StatementError);
    expect(run).toThrow("Bu ekstrenin karakter tablosu eksik.");
  });

  it("hiçbir ayrıştırıcının tablosu yoksa da 'karakter tablosu eksik' der", () => {
    const raw = { pages: [page()], glyphs: [type3Line("ORNEK BANKA", 700)] };
    expect(() => decodeStatement(raw, [parser("normal", "X")])).toThrow("karakter tablosu eksik");
  });

  it("tablo büyük ölçüde doluysa çözer ve bilinmeyen glifleri sayar", () => {
    const partial = new Map([..."ORNEKBA"].map((c) => [hashOf(c), c])); // N ve K var, Z yok
    const raw = { pages: [page()], glyphs: [type3Line("ORNEK BANKA Z", 700)] };
    const res = decodeStatement(raw, [parser("t3", "ORNEK BANKA", partial)]);
    expect(res.unknownGlyphs).toBe(1);
    expect(res.lines[0].text).toContain(UNKNOWN_CHAR);
  });

  it("okunabilen ama tanınmayan ekstre için 'desteklemiyoruz' der", () => {
    const raw = { pages: [page()], glyphs: [type3Line("BAZ", 700)] };
    expect(() => decodeStatement(raw, [parser("t3", "ORNEK BANKA", fullTable)])).toThrow(
      "Bu bankayı henüz desteklemiyoruz.",
    );
  });

  it("Type3 sadece birkaç glifteyse (logo gibi) 'desteklemiyoruz' der", () => {
    const normalGlyphs: PositionedGlyph[] = type3Line("ABCDEFGHIJ", 600).map((g) => ({ ...g, hash: null }));
    const raw = {
      pages: [page([{ str: "BILINMEYEN BANKA", x: 10, y: 700, width: 50, height: 10 }])],
      glyphs: [[...type3Line("O", 700), ...normalGlyphs]],
    };
    expect(() => decodeStatement(raw, [parser("t3", "ORNEK BANKA", new Map())])).toThrow("desteklemiyoruz");
  });

  it("gerçek kayıt listesinde Akbank tablosu boşken Type3 ekstre 'karakter tablosu eksik' verir", () => {
    const raw = { pages: [page()], glyphs: [type3Line("HERHANGI METIN", 700)] };
    expect(() => decodeStatement(raw)).toThrow("karakter tablosu eksik");
  });
});

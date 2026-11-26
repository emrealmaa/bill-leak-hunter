import { describe, expect, it } from "vitest";
import { checkStatement } from "../src/banks/check";
import type { PdfPage } from "../src/types";
import { linesFromFixture } from "./helpers/fixtureLines";
import fixture from "./fixtures/akbank/ornek-ekstre.txt?raw";

/** Fixture satırlarını pdf.js'ten gelmiş gibi normal fontlu sayfalara çevirir. */
function pagesFromFixture(text: string): PdfPage[] {
  const pages = new Map<number, PdfPage>();
  for (const line of linesFromFixture(text)) {
    const page = pages.get(line.page) ?? { pageNumber: line.page, width: 700, height: 842, items: [] };
    for (const c of line.cells) page.items.push({ str: c.text, x: c.x, y: line.y, width: c.width, height: 8 });
    pages.set(line.page, page);
  }
  return [...pages.values()];
}

describe("checkStatement", () => {
  it("sentetik ekstrede yalnızca sayısal özet döndürür", () => {
    const r = checkStatement({ pages: pagesFromFixture(fixture) });
    expect(r).toEqual({
      pages: 2,
      type3Glyphs: 0,
      unknownGlyphs: 0,
      bank: "akbank",
      transactions: 13,
      kinds: { payment: 1, purchase: 7, refund: 1, fee: 1, tax: 2, interest: 1 },
      installments: 1,
      foreign: 1,
      warnings: {},
      periodFound: true,
      totalMatches: "evet",
    });
  });

  it("tanınmayan ekstrede hata kodunu döndürür", () => {
    const r = checkStatement({ pages: pagesFromFixture("RASTGELE METIN") });
    expect(r.error).toBe("unsupported-bank");
    expect(r.bank).toBeUndefined();
  });

  it("dönem borcu tutmuyorsa 'hayır' der", () => {
    const changed = fixture.replace("1,898.65", "1,898.66");
    expect(checkStatement({ pages: pagesFromFixture(changed) }).totalMatches).toBe("hayır");
  });
});

import { describe, expect, it } from "vitest";
import { checkStatement } from "../src/banks/check";
import { pagesFromFixture } from "./helpers/fixtureLines";
import fixture from "./fixtures/akbank/ornek-ekstre.txt?raw";

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

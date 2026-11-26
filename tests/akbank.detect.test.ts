import { describe, expect, it } from "vitest";
import { akbankParser } from "../src/banks/akbank";
import { detectAkbank } from "../src/banks/akbank/detect";
import { findParser } from "../src/banks/detect";
import { foldKey } from "../src/banks/common/text";
import { linesFromFixture } from "./helpers/fixtureLines";
import fixture from "./fixtures/akbank/ornek-ekstre.txt?raw";

describe("detectAkbank", () => {
  it("sentetik Akbank fixture'ını tanır", () => {
    const lines = linesFromFixture(fixture);
    expect(detectAkbank(lines)).toBe(true);
    expect(findParser(lines)?.id).toBe("akbank");
  });

  it("Türkçe karakterleri ASCII yazılmış başlığı da tanır", () => {
    expect(detectAkbank(linesFromFixture("AXESS\nKREDI KARTI HESAP OZETI"))).toBe(true);
  });

  it("rastgele metni tanımaz", () => {
    expect(detectAkbank(linesFromFixture("Lorem ipsum dolor\nsit amet 12,00"))).toBe(false);
    expect(detectAkbank([])).toBe(false);
  });

  it("başka bir bankanın ekstresinde geçen Akbank işlemini tanımaz", () => {
    const other = linesFromFixture("ORNEK BANKA EKSTRE\n14/10/2026  AKBANK ATM PARA CEKME  500,00");
    expect(detectAkbank(other)).toBe(false);
  });

  it("marka kelimesinin başka bir kelimenin parçası olmasını saymaz", () => {
    expect(detectAkbank(linesFromFixture("TAXESSO\nHesap Özeti"))).toBe(false);
  });

  it("glif tablosu bağlı ve geçerli", () => {
    expect(akbankParser.glyphTable).toBeInstanceOf(Map);
  });
});

describe("foldKey", () => {
  it("Türkçe büyük harf + ASCII katlama + boşluk sadeleştirme", () => {
    expect(foldKey("Hesap  Özeti")).toBe("HESAP OZETI");
    expect(foldKey("ışık İĞNE çöp")).toBe("ISIK IGNE COP");
    expect(foldKey(" istanbul ")).toBe("ISTANBUL");
  });
});

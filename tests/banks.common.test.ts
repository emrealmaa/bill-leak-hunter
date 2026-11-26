import { describe, expect, it } from "vitest";
import { findDates, parseDate } from "../src/banks/common/date";
import { looksLikeAmount, parseAmount } from "../src/banks/common/amount";
import { detectCurrency } from "../src/banks/common/currency";

describe("parseDate", () => {
  it("GG/AA/YYYY ve GG.AA.YYYY biçimlerini ISO'ya çevirir", () => {
    expect(parseDate("14/10/2026")).toBe("2026-10-14");
    expect(parseDate("01.02.2025")).toBe("2025-02-01");
    expect(parseDate(" 5/3/2026 ")).toBe("2026-03-05");
  });

  it("geçersiz tarihleri reddeder", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("29/02/2025")).toBeNull();
    expect(parseDate("00/01/2026")).toBeNull();
    expect(parseDate("12/13/2026")).toBeNull();
    expect(parseDate("14/10.2026")).toBeNull();
    expect(parseDate("14/10/26")).toBeNull();
    expect(parseDate("tarih")).toBeNull();
  });

  it("artık yılda 29 Şubat geçerlidir", () => {
    expect(parseDate("29/02/2028")).toBe("2028-02-29");
  });

  it("metindeki tarihleri bulur", () => {
    expect(findDates("Ekstre Dönemi 15/10/2026 - 14/11/2026")).toEqual(["2026-10-15", "2026-11-14"]);
    expect(findDates("no 115/10/20260")).toEqual([]);
  });
});

describe("parseAmount", () => {
  it("Türkçe biçim", () => {
    expect(parseAmount("1.234,56", "tr")).toBe(1234.56);
    expect(parseAmount("12,5", "tr")).toBe(12.5);
    expect(parseAmount("1.234.567,00", "tr")).toBe(1234567);
    expect(parseAmount("1234,56", "tr")).toBe(1234.56);
  });

  it("İngilizce biçim", () => {
    expect(parseAmount("1,234.56", "en")).toBe(1234.56);
    expect(parseAmount("0.99", "en")).toBe(0.99);
    expect(parseAmount("1,234", "en")).toBe(1234);
  });

  it("otomatik biçim", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
    expect(parseAmount("1,234.56")).toBe(1234.56);
    expect(parseAmount("12,50")).toBe(12.5);
    expect(parseAmount("12.50")).toBe(12.5);
    expect(parseAmount("1.234")).toBe(1234);
    expect(parseAmount("1,234")).toBe(1234);
    expect(parseAmount("250")).toBe(250);
  });

  it("negatif işaretleri", () => {
    expect(parseAmount("1,234.56 (-)", "en")).toBe(-1234.56);
    expect(parseAmount("1,234.56(-)", "en")).toBe(-1234.56);
    expect(parseAmount("-12,00", "tr")).toBe(-12);
    expect(parseAmount("12,00-", "tr")).toBe(-12);
    expect(parseAmount("+12,00", "tr")).toBe(12);
    expect(parseAmount("-12,00 (-)", "tr")).toBeNull();
  });

  it("para birimini yok sayar", () => {
    expect(parseAmount("1.234,56 TL", "tr")).toBe(1234.56);
    expect(parseAmount("₺12,00", "tr")).toBe(12);
    expect(parseAmount("9.99 $", "en")).toBe(9.99);
  });

  it("biçime uymayanları reddeder", () => {
    expect(parseAmount("1.234,56", "en")).toBeNull();
    expect(parseAmount("1,234.56", "tr")).toBeNull();
    expect(parseAmount("12,345", "tr")).toBeNull();
    expect(parseAmount("1.23.4,00", "tr")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("12/34")).toBeNull();
  });

  it("kayan nokta hatası üretmez", () => {
    expect(parseAmount("0,10", "tr")! + parseAmount("0,20", "tr")!).toBeCloseTo(0.3, 10);
    expect(parseAmount("1.000.000,01", "tr")).toBe(1000000.01);
  });

  it("looksLikeAmount ondalıksız sayıları ve tarihleri tutar saymaz", () => {
    expect(looksLikeAmount("1,234.56", "en")).toBe(true);
    expect(looksLikeAmount("12.00 (-)", "en")).toBe(true);
    expect(looksLikeAmount("3/6", "en")).toBe(false);
    expect(looksLikeAmount("14/10/2026", "en")).toBe(false);
    expect(looksLikeAmount("250", "en")).toBe(false);
  });
});

describe("detectCurrency", () => {
  it("bilinen para birimlerini tanır", () => {
    expect(detectCurrency("12,00 TL")).toBe("TRY");
    expect(detectCurrency("₺12")).toBe("TRY");
    expect(detectCurrency("9.99 $")).toBe("USD");
    expect(detectCurrency("9.99 usd")).toBe("USD");
    expect(detectCurrency("€5")).toBe("EUR");
    expect(detectCurrency("5 GBP")).toBe("GBP");
  });

  it("ilk geçeni döndürür, tanımazsa undefined", () => {
    expect(detectCurrency("10 $ = 340 TL")).toBe("USD");
    expect(detectCurrency("ATLAS MARKET")).toBeUndefined();
    expect(detectCurrency("12,00")).toBeUndefined();
  });
});

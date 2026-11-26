import { describe, expect, it } from "vitest";
import { normalizeDescription, normalizeTransactions } from "../src/normalize";
import type { Transaction } from "../src/types";

// Tüm açıklamalar uydurmadır.
const n = (s: string) => normalizeDescription(s);

describe("normalizeDescription — büyük harf", () => {
  it("Türkçe-duyarlı büyük harf: i → İ, ı → I", () => {
    expect(n("istanbul kitapçısı").normalized).toBe("İSTANBUL KİTAPÇISI");
    expect(n("ışık market").normalized).toBe("IŞIK MARKET");
    expect(n("Iğdır Çiçek").normalized).toBe("IĞDIR ÇİÇEK");
  });

  it("zaten büyük harfli ASCII metne dokunmaz", () => {
    expect(n("ORNEK KITAP").normalized).toBe("ORNEK KITAP");
  });

  it("fazla boşlukları teke indirir", () => {
    expect(n("  ORNEK    MARKET  ").normalized).toBe("ORNEK MARKET");
  });
});

describe("normalizeDescription — temizlik", () => {
  it("sondaki şehir ve ülke eklerini temizler", () => {
    expect(n("ORNEK MARKET ISTANBUL TR").normalized).toBe("ORNEK MARKET");
    expect(n("NETFLIX.COM LOS GATOS USA").normalized).toBe("NETFLIX.COM");
    expect(n("ornek kafe izmir tur").normalized).toBe("ORNEK KAFE");
    expect(n("ORNEK MARKET İSTANBUL").normalized).toBe("ORNEK MARKET");
  });

  it("şehir adı açıklamanın tamamıysa ya da ortadaysa dokunmaz", () => {
    expect(n("ISTANBUL").normalized).toBe("ISTANBUL");
    expect(n("ANKARA ORNEK SPOR").normalized).toBe("ANKARA ORNEK SPOR");
  });

  it("referans numaralarını temizler", () => {
    expect(n("SPOTIFY P1234ABCD").normalized).toBe("SPOTIFY");
    expect(n("ORNEK MARKET 12345678 ANKARA").normalized).toBe("ORNEK MARKET");
    expect(n("ORNEK SERVIS REF:AB12345").normalized).toBe("ORNEK SERVIS");
    expect(n("ORNEK SERVIS #9876").normalized).toBe("ORNEK SERVIS");
  });

  it("kısa sayıları ve marka parçalarını silmez", () => {
    expect(n("ORNEK 7-24 MARKET").normalized).toBe("ORNEK 7-24 MARKET");
    expect(n("A101 MAGAZA").normalized).toBe("A101 MAGAZA");
    expect(n("TV+ 2026").normalized).toBe("TV+ 2026");
  });

  it("döviz ekini temizler", () => {
    expect(n("SPOTIFY P1234ABCD (orijinal tutar 5.99 $)").normalized).toBe("SPOTIFY");
    expect(n("ORNEK APP (ORİJİNAL TUTAR 9,99 EUR) DUBLIN IE").normalized).toBe("ORNEK APP");
  });
});

describe("normalizeDescription — ödeme aracısı", () => {
  it("bilinen öneki ayrı alana alır", () => {
    expect(n("IYZICO*ORNEK KITAP")).toEqual({ normalized: "ORNEK KITAP", intermediary: "iyzico" });
    expect(n("iyzico * Ornek Kitap Istanbul")).toEqual({ normalized: "ORNEK KİTAP", intermediary: "iyzico" });
    expect(n("PAYTR*ORNEK DUKKAN")).toEqual({ normalized: "ORNEK DUKKAN", intermediary: "paytr" });
    expect(n("PAYPAL *ORNEKAPP")).toEqual({ normalized: "ORNEKAPP", intermediary: "paypal" });
    expect(n("GOOGLE *YOUTUBE PREMIUM")).toEqual({ normalized: "YOUTUBE PREMIUM", intermediary: "google" });
    expect(n("PADDLE.NET* ORNEKAPP")).toEqual({ normalized: "ORNEKAPP", intermediary: "paddle" });
  });

  it("bilinmeyen önekleri olduğu gibi bırakır", () => {
    expect(n("ABC*ORNEK")).toEqual({ normalized: "ABC*ORNEK" });
  });

  it("aracı yoksa alan hiç eklenmez", () => {
    expect(n("NETFLIX.COM")).toEqual({ normalized: "NETFLIX.COM" });
  });

  it("verilen aracı listesini kullanır", () => {
    const list = [{ id: "ornekpay", name: "Örnek Pay", prefixes: ["ORNEKPAY"], verified: false }];
    expect(n("IYZICO*X").intermediary).toBe("iyzico");
    expect(normalizeDescription("IYZICO*X", list)).toEqual({ normalized: "IYZICO*X" });
    expect(normalizeDescription("ORNEKPAY*X", list)).toEqual({ normalized: "X", intermediary: "ornekpay" });
  });
});

describe("normalizeDescription — kenar durumlar", () => {
  it("temizlik sonunda boş kalırsa büyük harfli özgün metni döner", () => {
    expect(n("12345678").normalized).toBe("12345678");
    expect(n("").normalized).toBe("");
  });
});

describe("normalizeTransactions", () => {
  it("normalized ve intermediary alanlarını doldurur, girdiyi değiştirmez", () => {
    const input: Transaction[] = [
      { date: "2026-10-01", rawDescription: "IYZICO*ORNEK KITAP", normalized: "", amount: 10, currency: "TRY", kind: "purchase" },
      { date: "2026-10-02", rawDescription: "netflix.com", normalized: "", amount: 20, currency: "TRY", kind: "purchase" },
    ];
    const out = normalizeTransactions(input);
    expect(out[0]).toMatchObject({ normalized: "ORNEK KITAP", intermediary: "iyzico" });
    // tr-TR büyük harf: küçük "i" → "İ". Katalog eşleştirmesi ASCII'ye katlanmış anahtarla yapılır.
    expect(out[1]).toMatchObject({ normalized: "NETFLİX.COM" });
    expect(out[1].intermediary).toBeUndefined();
    expect(input[0].normalized).toBe("");
  });
});

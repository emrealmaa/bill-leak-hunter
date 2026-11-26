import { describe, expect, it } from "vitest";
import { FEE_RULES, matchFee } from "../src/catalog/fees";
import { FORBIDDEN_FEE_PHRASES } from "../src/catalog/validate";
import { normalizeDescription } from "../src/normalize";

// Uydurma açıklamalar.
const fee = (raw: string, amount = 10) =>
  matchFee({ rawDescription: raw, normalized: normalizeDescription(raw).normalized, amount })?.id;

describe("ücret kuralları", () => {
  it("kart aidatı", () => {
    expect(fee("YILLIK KART ÜYELİK ÜCRETİ")).toBe("kart-aidati");
    expect(fee("KART AİDATI")).toBe("kart-aidati");
    expect(fee("Kart Üyelik Ücreti")).toBe("kart-aidati");
  });

  it("diğer ücretler", () => {
    expect(fee("HESAP İŞLETİM ÜCRETİ")).toBe("hesap-isletim-ucreti");
    expect(fee("NAKİT AVANS ÜCRETİ")).toBe("nakit-avans-ucreti");
    expect(fee("EKSTRE GÖNDERİM ÜCRETİ")).toBe("ekstre-ucreti");
    expect(fee("SMS BİLGİLENDİRME ÜCRETİ")).toBe("sms-ucreti");
    expect(fee("YURT DIŞI İŞLEM KOMİSYONU")).toBe("yurt-disi-islem-ucreti");
    expect(fee("EFT ÜCRETİ")).toBe("transfer-ucreti");
    expect(fee("GECİKME ÜCRETİ")).toBe("gecikme-ucreti");
  });

  it("vergiler", () => {
    expect(fee("KKDF")).toBe("kkdf");
    expect(fee("BSMV")).toBe("bsmv");
    expect(fee("KKDF TUTARI")).toBe("kkdf");
    expect(fee("DAMGA VERGİSİ")).toBe("damga-vergisi");
  });

  it("faizler; özel faiz türü genel 'faiz' kuralından önce gelir", () => {
    expect(fee("ALIŞVERİŞ FAİZİ")).toBe("alisveris-faizi");
    expect(fee("AKDİ FAİZ")).toBe("alisveris-faizi");
    expect(fee("GECİKME FAİZİ")).toBe("gecikme-faizi");
    expect(fee("NAKİT AVANS FAİZİ")).toBe("nakit-avans-faizi");
    expect(fee("KART FAİZİ")).toBe("faiz");
  });

  it("satıcı adlarında ve kampanyalarda yanlış eşleşme yok", () => {
    expect(fee("ORNEK MOBILYA FAİZSİZ TAKSİT")).toBeUndefined();
    expect(fee("ORNEK KARTONPIYER MARKET")).toBeUndefined();
    expect(fee("NETFLIX.COM")).toBeUndefined();
    expect(fee("UCRETSIZ KARGO ORNEK")).toBeUndefined();
  });

  it("ödeme ve iadeler ücret sayılmaz", () => {
    expect(fee("KART AİDATI İADESİ", -10)).toBeUndefined();
    expect(fee("KKDF", 0)).toBeUndefined();
  });
});

describe("ücret açıklamaları", () => {
  it("her kuralın sade bir açıklaması var, hukuki iddia/tavsiye yok", () => {
    expect(FEE_RULES.length).toBeGreaterThanOrEqual(10);
    for (const r of FEE_RULES) {
      expect(r.explanation.length).toBeGreaterThan(10);
      const text = r.explanation.toLocaleLowerCase("tr-TR");
      for (const phrase of FORBIDDEN_FEE_PHRASES) expect(text).not.toContain(phrase);
    }
  });
});

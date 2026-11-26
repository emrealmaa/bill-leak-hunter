import { describe, expect, it } from "vitest";
import { analyze, classifyGroup, similarAmounts } from "../src/analysis";
import { processStatement } from "../src/pipeline";
import { StatementError } from "../src/banks/errors";
import type { Merchant, Transaction } from "../src/types";
import { pagesFromFixture } from "./helpers/fixtureLines";
import fixture from "./fixtures/akbank/ornek-ekstre.txt?raw";

// Tüm işlemler uydurmadır.
const tx = (date: string, desc: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  date,
  rawDescription: desc,
  normalized: desc,
  amount,
  currency: "TRY",
  kind: "purchase",
  ...extra,
});

const sub: Merchant = {
  id: "ornek-sub",
  name: "Örnek Abonelik",
  category: "video",
  patterns: ["ORNEKSUB"],
  isSubscription: true,
  verified: false,
};

describe("similarAmounts", () => {
  it("±%15 içindeki tutarları benzer sayar", () => {
    expect(similarAmounts([100, 110, 95])).toBe(true);
    expect(similarAmounts([100, 120])).toBe(false);
    expect(similarAmounts([100])).toBe(true);
  });
});

describe("classifyGroup", () => {
  it("katalogda abonelik: tek işlem bile high", () => {
    const r = classifyGroup([tx("2026-10-01", "ORNEKSUB", 99.9)], sub)!;
    expect(r).toMatchObject({ confidence: "high", reason: "catalog-subscription", monthlyEstimate: 99.9, label: "Örnek Abonelik" });
  });

  it("aylık düzen: farklı aylarda, ±%15, 28–35 gün → medium", () => {
    const r = classifyGroup([tx("2026-08-05", "ORNEK SPOR", 300), tx("2026-09-04", "ORNEK SPOR", 310), tx("2026-10-05", "ORNEK SPOR", 300)])!;
    expect(r).toMatchObject({ confidence: "medium", reason: "monthly", label: "ORNEK SPOR" });
    expect(r.monthlyEstimate).toBeCloseTo(303.33, 2);
  });

  it("yıllık düzen → medium, aylık tahmin tutar/12", () => {
    const r = classifyGroup([tx("2025-10-10", "ORNEK ALAN ADI", 240), tx("2026-10-09", "ORNEK ALAN ADI", 250)])!;
    expect(r).toMatchObject({ confidence: "medium", reason: "yearly" });
    expect(r.monthlyEstimate).toBeCloseTo(20.42, 2);
  });

  it("benzer tutar ama düzensiz aralık → low", () => {
    const r = classifyGroup([tx("2026-08-01", "ORNEK KAFE", 50), tx("2026-08-20", "ORNEK KAFE", 52), tx("2026-10-02", "ORNEK KAFE", 50)])!;
    expect(r).toMatchObject({ confidence: "low", reason: "irregular" });
  });

  it("aynı ay içindeki işlemler, tek işlem ya da farklı tutarlar tekrar sayılmaz", () => {
    expect(classifyGroup([tx("2026-10-01", "ORNEK", 50), tx("2026-10-20", "ORNEK", 50)])).toBeUndefined();
    expect(classifyGroup([tx("2026-10-01", "ORNEK", 50)])).toBeUndefined();
    expect(classifyGroup([tx("2026-09-01", "ORNEK", 50), tx("2026-10-01", "ORNEK", 90)])).toBeUndefined();
  });
});

describe("analyze", () => {
  const deps = {
    matchMerchant: (t: Transaction) => (t.normalized === "ORNEKSUB" ? sub : t.normalized === "ORNEK MAGAZA" ? { ...sub, id: "magaza", name: "Mağaza", isSubscription: false } : undefined),
    matchFee: () => undefined,
  };

  it("ödemeleri ve iadeleri çıkarır", () => {
    const r = analyze(
      [tx("2026-10-01", "ODEME", -500, { kind: "payment" }), tx("2026-10-02", "ORNEK IADE", -20, { kind: "refund" })],
      deps,
    );
    expect(r.unknown).toEqual([]);
    expect(r.subscriptions).toEqual([]);
    expect(r.totals).toEqual({ monthlyRecurring: 0, fees: 0, unknownCount: 0 });
  });

  it("taksitleri ayrı gösterir ve kalanı hesaplar, abonelik saymaz", () => {
    const t = tx("2026-10-01", "ORNEKSUB", 500, { installment: { current: 2, total: 6 } });
    const r = analyze([t], deps);
    expect(r.installments).toEqual([{ transaction: t, remainingCount: 4, remainingAmount: 2000 }]);
    expect(r.subscriptions).toEqual([]);
  });

  it("ücretleri kurala ya da türe göre gruplar", () => {
    const rule = { id: "ornek-ucret", label: "Örnek ücret", kind: "fee" as const, patterns: ["X"], explanation: "Bilgi." };
    const r = analyze(
      [
        tx("2026-10-01", "ORNEK UCRET", 10),
        tx("2026-10-02", "ORNEK UCRET", 15),
        tx("2026-10-03", "KKDF", 2, { kind: "tax" }),
      ],
      { ...deps, matchFee: (t) => (t.normalized === "ORNEK UCRET" ? rule : undefined) },
    );
    expect(r.fees.map((f) => [f.rule?.id, f.kind, f.total])).toEqual([
      ["ornek-ucret", "fee", 25],
      [undefined, "tax", 2],
    ]);
    expect(r.totals.fees).toBe(27);
  });

  it("katalogda olmayan ve tekrar etmeyenleri 'bilinmiyor', katalogdakileri 'bilinen' sayar", () => {
    const r = analyze([tx("2026-10-01", "ORNEK DUKKAN", 40), tx("2026-10-02", "ORNEK MAGAZA", 60), tx("2026-10-03", "ORNEKSUB", 99)], deps);
    expect(r.unknown.map((t) => t.normalized)).toEqual(["ORNEK DUKKAN"]);
    expect(r.known.map((t) => t.normalized)).toEqual(["ORNEK MAGAZA"]);
    expect(r.subscriptions.map((s) => s.label)).toEqual(["Örnek Abonelik"]);
    expect(r.totals).toEqual({ monthlyRecurring: 99, fees: 0, unknownCount: 1 });
  });

  it("katalogda olmayan ama aylık tekrar eden satıcı abonelik (medium), düzensiz olan kontrol et (low)", () => {
    const r = analyze(
      [
        tx("2026-09-03", "ORNEK SPOR", 300),
        tx("2026-10-03", "ORNEK SPOR", 300),
        tx("2026-08-01", "ORNEK KAFE", 50),
        tx("2026-08-20", "ORNEK KAFE", 50),
        tx("2026-10-02", "ORNEK KAFE", 50),
      ],
      deps,
    );
    expect(r.subscriptions.map((s) => [s.label, s.confidence])).toEqual([["ORNEK SPOR", "medium"]]);
    expect(r.review.map((s) => [s.label, s.confidence])).toEqual([["ORNEK KAFE", "low"]]);
    expect(r.unknown).toEqual([]);
  });

  it("aynı satıcının farklı yazılışlarını Türkçe/ASCII farkına rağmen birleştirir", () => {
    const r = analyze([tx("2026-09-03", "ÖRNEK SPOR", 300), tx("2026-10-03", "ORNEK SPOR", 300)], deps);
    expect(r.subscriptions).toHaveLength(1);
  });
});

describe("processStatement (sentetik fixture ile uçtan uca)", () => {
  it("bankayı tanır, işlemleri normalleştirir ve analiz eder", () => {
    const r = processStatement({ pages: pagesFromFixture(fixture) });
    expect(r.bank.id).toBe("akbank");
    expect(r.transactions).toHaveLength(13);
    expect(r.transactions.find((t) => t.rawDescription.startsWith("IYZICO"))).toMatchObject({
      normalized: "ORNEK KITAP",
      intermediary: "iyzico",
    });
    const subs = r.analysis.subscriptions.map((s) => s.merchant?.id).sort();
    expect(subs).toEqual(["netflix", "spotify", "youtube"]);
    expect(r.analysis.fees.map((f) => f.rule?.id).sort()).toEqual(["alisveris-faizi", "bsmv", "kart-aidati", "kkdf"]);
    expect(r.analysis.installments).toHaveLength(1);
    expect(r.analysis.known.map((t) => t.normalized)).toEqual(["GETIR ORNEK"]);
    expect(r.analysis.unknown.map((t) => t.normalized)).toEqual(["ORNEK MARKET", "ORNEK KITAP"]);
    expect(r.analysis.totals.monthlyRecurring).toBeCloseTo(229.99 + 203.66 + 79.99, 2);
  });

  it("işlem yoksa 'işlem bulunamadı' hatası", () => {
    const run = () => processStatement({ pages: pagesFromFixture("AKBANK  Axess\nHesap Özeti") });
    expect(run).toThrow(StatementError);
    expect(run).toThrow("Ekstrede işlem bulunamadı.");
  });
});

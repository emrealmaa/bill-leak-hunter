import { describe, expect, it } from "vitest";
import { parseAkbank } from "../src/banks/akbank/parse";
import { UNKNOWN_CHAR } from "../src/pdf/decode";
import { linesFromFixture } from "./helpers/fixtureLines";
import fixture from "./fixtures/akbank/ornek-ekstre.txt?raw";

const HEADER =
  "İşlem Tarihi  Dönem İçi İşlemler                            Borç Tutarı (TL)    Kalan Borç / Taksit    Dönem İçi Chip-para";

describe("parseAkbank — sentetik fixture", () => {
  const result = parseAkbank(linesFromFixture(fixture));
  const tx = result.transactions;
  const byDesc = (s: string) => tx.find((t) => t.rawDescription.includes(s));

  it("bütün işlem satırlarını çıkarır, başlık/özet/alt başlık satırlarını yok sayar", () => {
    expect(tx).toHaveLength(13);
    expect(result.warnings).toEqual([]);
    expect(tx.some((t) => t.rawDescription.includes("Harcamaları"))).toBe(false);
  });

  it("dönem ve özet alanlarını okur", () => {
    expect(result.period).toEqual({ start: "2026-09-15", end: "2026-10-14" });
    expect(result.summary).toEqual({ previousDebt: 1000, statementDebt: 1898.65 });
  });

  it("işlem toplamı + önceki borç = dönem borcu", () => {
    const sum = tx.reduce((s, t) => s + t.amount, 0);
    expect(result.summary!.previousDebt! + sum).toBeCloseTo(result.summary!.statementDebt!, 2);
  });

  it("normal harcama", () => {
    expect(byDesc("ORNEK MARKET")).toEqual({
      date: "2026-09-17",
      rawDescription: "ORNEK MARKET ISTANBUL TR",
      normalized: "ORNEK MARKET ISTANBUL TR",
      amount: 125.5,
      currency: "TRY",
      kind: "purchase",
    });
  });

  it("chip-para sütunu borç tutarı sayılmaz", () => {
    expect(byDesc("ORNEK MARKET")!.amount).toBe(125.5);
  });

  it("ödeme: (-) son eki ve ödeme açıklaması", () => {
    expect(byDesc("ÖDEME")).toMatchObject({ date: "2026-09-16", amount: -1000, kind: "payment" });
  });

  it("iade: (-) son eki, ödeme açıklaması yok", () => {
    expect(byDesc("GIYIM")).toMatchObject({ amount: -150, kind: "refund" });
  });

  it("taksit: Kalan Borç / Taksit sütunundan", () => {
    expect(byDesc("ELEKTRONIK")).toMatchObject({
      rawDescription: "ORNEK ELEKTRONIK",
      amount: 500,
      installment: { current: 2, total: 6 },
      kind: "purchase",
    });
  });

  it("döviz: orijinal tutar ve para birimi", () => {
    expect(byDesc("SPOTIFY")).toMatchObject({ amount: 203.66, currency: "USD", originalAmount: 5.99 });
  });

  it("ücret, vergi ve faiz", () => {
    expect(byDesc("ÜYELİK")!.kind).toBe("fee");
    expect(byDesc("KKDF")!.kind).toBe("tax");
    expect(byDesc("BSMV")!.kind).toBe("tax");
    expect(byDesc("FAİZİ")!.kind).toBe("interest");
  });

  it("ödeme aracısı önekini açıklamada korur", () => {
    expect(byDesc("IYZICO")!.rawDescription).toBe("IYZICO*ORNEK KITAP");
  });

  it("ikinci sayfadaki işlemleri de okur", () => {
    expect(byDesc("GETIR")).toMatchObject({ date: "2026-10-05", amount: 310 });
    expect(byDesc("YOUTUBE")).toMatchObject({ amount: 79.99 });
  });
});

describe("parseAkbank — kenar durumlar (sentetik)", () => {
  const parse = (body: string) => parseAkbank(linesFromFixture(`${HEADER}\n${body}`));

  it("tutarı okunamayan işlem satırı uyarı olur, içerik değil yer yazılır", () => {
    const r = parse("01/10/2026    ORNEK DUKKAN                                            ABC");
    expect(r.transactions).toEqual([]);
    expect(r.warnings).toEqual([{ page: 1, line: 1, reason: "unreadable-amount" }]);
  });

  it("geçersiz tarihli satır uyarı olur", () => {
    const r = parse("32/13/2026    ORNEK DUKKAN                                             10.00");
    expect(r.warnings).toEqual([{ page: 1, line: 1, reason: "unreadable-date" }]);
  });

  it("çözülemeyen glif içeren satırlar 'unknown-glyph' uyarısı verir", () => {
    const r = parse(
      `0${UNKNOWN_CHAR}/10/2026    ORNEK DUKKAN                                             10.00\n` +
        `02/10/2026    ORNEK ${UNKNOWN_CHAR}UKKAN                                             10.00\n` +
        `03/10/2026    ORNEK DUKKAN                                             1${UNKNOWN_CHAR}.00`,
    );
    expect(r.warnings.map((w) => w.reason)).toEqual(["unknown-glyph", "unknown-glyph", "unknown-glyph"]);
    expect(r.transactions).toHaveLength(1);
  });

  it("ayrı hücreye düşmüş (-) işaretini tutara ekler", () => {
    const r = parse("01/10/2026    ORNEK IADE                                               10.00  (-)");
    expect(r.transactions[0]).toMatchObject({ amount: -10, kind: "refund" });
  });

  it("tarih ile açıklama aynı hücredeyse ayırır", () => {
    const r = parse("01/10/2026 ORNEK DUKKAN                                                10.00");
    expect(r.transactions[0]).toMatchObject({ date: "2026-10-01", rawDescription: "ORNEK DUKKAN", amount: 10 });
  });

  it("açıklamadaki taksit ifadesini tanır", () => {
    const r = parse("01/10/2026    ORNEK MOBILYA 3/9 TAKSIT                                 10.00");
    expect(r.transactions[0].installment).toEqual({ current: 3, total: 9 });
  });

  it("başlık hiç yoksa ilk tutarı borç sayar ve bir kez 'unknown-layout' uyarısı verir", () => {
    const r = parseAkbank(
      linesFromFixture("01/10/2026  ORNEK A  10.00  1.00\n02/10/2026  ORNEK B  20.00"),
    );
    expect(r.transactions.map((t) => t.amount)).toEqual([10, 20]);
    expect(r.warnings).toEqual([{ page: 1, line: 0, reason: "unknown-layout" }]);
  });

  it("başlık dışındaki tarihli olmayan satırları sessizce atlar", () => {
    const r = parse("AD SOYAD Harcamaları\nSayfa 1 / 2");
    expect(r.transactions).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

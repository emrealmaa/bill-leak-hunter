import { describe, expect, it } from "vitest";
import { MERCHANTS, matchMerchant } from "../src/catalog";
import { bestMatch, compilePatterns } from "../src/catalog/match";
import { validateCatalog, type CatalogFile } from "../src/catalog/validate";
import { normalizeDescription } from "../src/normalize";

const merchantFiles = import.meta.glob("../catalog/merchants/*.json", { eager: true, import: "default" });
const feeFiles = import.meta.glob("../catalog/fees/*.json", { eager: true, import: "default" });
const intermediaryFiles = import.meta.glob("../catalog/intermediaries.json", { eager: true, import: "default" });

const allFiles: CatalogFile[] = [
  ...Object.entries(merchantFiles).map(([path, data]) => ({ path, kind: "merchants" as const, data })),
  ...Object.entries(feeFiles).map(([path, data]) => ({ path, kind: "fees" as const, data })),
  ...Object.entries(intermediaryFiles).map(([path, data]) => ({ path, kind: "intermediaries" as const, data })),
];

describe("katalog dosyaları", () => {
  it("şemaya uyuyor", () => {
    expect(validateCatalog(allFiles)).toEqual([]);
  });

  it("50–100 satıcı içeriyor", () => {
    expect(MERCHANTS.length).toBeGreaterThanOrEqual(50);
    expect(MERCHANTS.length).toBeLessThanOrEqual(100);
  });

  it("iptal bağlantıları yalnızca https", () => {
    for (const m of MERCHANTS) if (m.cancelUrl) expect(m.cancelUrl).toMatch(/^https:\/\//);
  });
});

describe("validateCatalog", () => {
  const merchant = {
    id: "ornek",
    name: "Örnek",
    category: "video",
    patterns: ["\\bORNEK"],
    isSubscription: true,
    verified: false,
  };
  const run = (kind: CatalogFile["kind"], ...data: unknown[]) =>
    validateCatalog([{ path: "x.json", kind, data }]).map((i) => i.message);

  it("geçerli kaydı kabul eder", () => {
    expect(run("merchants", merchant)).toEqual([]);
  });

  it("eksik ve beklenmeyen alanları bulur", () => {
    const { verified: _v, ...missing } = merchant;
    expect(run("merchants", missing)).toContain("eksik alan: verified");
    expect(run("merchants", { ...merchant, color: "red" })).toContain("beklenmeyen alan: color");
  });

  it("kalıp kurallarını uygular", () => {
    expect(run("merchants", { ...merchant, patterns: ["(ORNEK"] })[0]).toMatch(/geçersiz regex/);
    expect(run("merchants", { ...merchant, patterns: ["\\bornek"] })[0]).toMatch(/büyük harf/);
    expect(run("merchants", { ...merchant, patterns: ["\\bÖRNEK"] })[0]).toMatch(/ASCII/);
    expect(run("merchants", { ...merchant, patterns: ["X?Y?"] })[0]).toMatch(/boş metinle/);
    expect(run("merchants", { ...merchant, patterns: [] })[0]).toMatch(/boş olmayan/);
  });

  it("kategori, id, url ve verified kurallarını uygular", () => {
    expect(run("merchants", { ...merchant, category: "kitap" })[0]).toMatch(/kategori/);
    expect(run("merchants", { ...merchant, id: "Örnek Id" })[0]).toMatch(/id/);
    expect(run("merchants", { ...merchant, cancelUrl: "http://ornek.invalid" })[0]).toMatch(/https/);
    expect(run("merchants", { ...merchant, verified: true })[0]).toMatch(/sources/);
    expect(run("merchants", { ...merchant, verified: true, sources: ["proje sahibinin ekstresinde doğrulandı"] })).toEqual(
      [],
    );
  });

  it("tekrar eden id'leri bulur", () => {
    expect(run("merchants", merchant, merchant)[0]).toMatch(/tekrar/);
  });

  it("ücret açıklamasında hukuki iddia/tavsiye ifadesini reddeder", () => {
    const fee = { id: "ornek-ucret", label: "Örnek", kind: "fee", patterns: ["\\bORNEK"], explanation: "Bilgi." };
    expect(run("fees", fee)).toEqual([]);
    expect(run("fees", { ...fee, explanation: "Bu ücreti geri alabilirsin." })[0]).toMatch(/hukuki/);
    expect(run("fees", { ...fee, kind: "ceza" })[0]).toMatch(/kind/);
  });

  it("ödeme aracısı öneklerini denetler", () => {
    const ok = { id: "ornekpay", name: "Örnek", prefixes: ["ORNEKPAY"], verified: false };
    expect(run("intermediaries", ok)).toEqual([]);
    expect(run("intermediaries", { ...ok, prefixes: ["ornekpay"] })[0]).toMatch(/prefixes/);
  });

  it("dizi olmayan dosyayı reddeder", () => {
    expect(validateCatalog([{ path: "x.json", kind: "merchants", data: {} }])[0].message).toMatch(/dizi/);
  });
});

describe("matchMerchant", () => {
  // Uydurma açıklamalar; gerçek ekstre satırı değildir.
  const match = (raw: string) => {
    const n = normalizeDescription(raw);
    return matchMerchant({ normalized: n.normalized, rawDescription: raw })?.id;
  };

  it("bilinen satıcıları bulur (Türkçe büyük harf ve ASCII farkına rağmen)", () => {
    expect(match("netflix.com")).toBe("netflix");
    expect(match("NETFLIX.COM LOS GATOS USA")).toBe("netflix");
    expect(match("GOOGLE *YOUTUBE PREMIUM")).toBe("youtube");
    expect(match("Türk Telekom Fatura")).toBe("turk-telekom");
    expect(match("yemeksepeti istanbul")).toBe("yemeksepeti");
    expect(match("SPOTIFY P1234ABCD")).toBe("spotify");
    expect(match("APPLE.COM/BILL")).toBe("apple");
    expect(match("IYZICO*EXXEN")).toBe("exxen");
  });

  it("en uzun eşleşmeyi seçer", () => {
    expect(match("AMAZON PRIME TR")).toBe("amazon-prime");
    expect(match("AMAZON.COM.TR")).toBe("amazon");
    expect(match("MICROSOFT*MICROSOFT 365")).toBe("microsoft-365");
    expect(match("MICROSOFT*STORE")).toBe("microsoft");
  });

  it("kelime parçalarından yanlış eşleşme üretmez", () => {
    expect(match("GETIRMEK ORNEK")).toBeUndefined();
    expect(match("SUBERBAN ORNEK")).toBeUndefined();
    expect(match("ORNEK MARKET")).toBeUndefined();
  });

  it("bestMatch eşitlikte listede önce geleni seçer", () => {
    const c = compilePatterns([
      { id: "a", patterns: ["AB"] },
      { id: "b", patterns: ["AB"] },
    ]);
    expect(bestMatch("XABX", c)?.id).toBe("a");
  });
});

import { describe, expect, it } from "vitest";
import { format, formatDate, formatMoney, MESSAGES } from "../src/i18n";

function keys(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("i18n", () => {
  it("İngilizce sözlük Türkçeyle aynı anahtarlara sahip", () => {
    expect(keys(MESSAGES.en).sort()).toEqual(keys(MESSAGES.tr).sort());
  });

  it("yer tutucuları doldurur, bilinmeyenleri bırakır", () => {
    expect(format("{count} işlem", { count: 3 })).toBe("3 işlem");
    expect(format("{a} {b}", { a: "x" })).toBe("x {b}");
  });

  it("tutar ve tarihi dile göre biçimler", () => {
    expect(formatMoney(1234.5, MESSAGES.tr)).toContain("1.234,50");
    expect(formatMoney(1234.5, MESSAGES.en)).toContain("1,234.50");
    expect(formatDate("2026-10-05", MESSAGES.tr)).toBe("05.10.2026");
    expect(formatDate("2026-10-05", MESSAGES.en)).toBe("10/5/2026");
  });
});

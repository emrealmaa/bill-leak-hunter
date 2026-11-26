import { describe, expect, it } from "vitest";
import { detectBank, findParser } from "../src/banks/detect";
import { StatementError } from "../src/banks/errors";
import { parsers } from "../src/banks/registry";
import { toStatementLines } from "../src/banks/lines";
import type { BankParser, StatementLine } from "../src/banks/types";
import { linesFromFixture } from "./helpers/fixtureLines";

function fakeParser(id: string, keyword: string, calls: string[] = []): BankParser {
  return {
    id,
    displayName: id,
    detect: (lines: StatementLine[]) => {
      calls.push(id);
      return lines.some((l) => l.text.includes(keyword));
    },
    parse: () => ({ transactions: [], warnings: [] }),
  };
}

describe("detectBank", () => {
  const lines = linesFromFixture("ORNEK BANKA  Hesap Ozeti\nBASKA SATIR");

  it("eşleşen ilk ayrıştırıcıyı sırayla dener ve döndürür", () => {
    const calls: string[] = [];
    const a = fakeParser("a", "YOK", calls);
    const b = fakeParser("b", "ORNEK BANKA", calls);
    const c = fakeParser("c", "Hesap", calls);
    expect(detectBank(lines, [a, b, c]).id).toBe("b");
    expect(calls).toEqual(["a", "b"]);
  });

  it("hiçbiri tanımazsa 'desteklemiyoruz' hatası verir", () => {
    const run = () => detectBank(lines, [fakeParser("a", "YOK")]);
    expect(run).toThrow(StatementError);
    expect(run).toThrow("Bu bankayı henüz desteklemiyoruz.");
    expect(findParser(lines, [])).toBeUndefined();
  });

  it("varsayılan liste kayıtlı ayrıştırıcıları kullanır", () => {
    expect(findParser(lines)).toBe(parsers.find((p) => p.detect(lines)));
  });
});

describe("toStatementLines", () => {
  it("sayfaları sırayla satırlara çevirir ve sıra numarası verir", () => {
    const lines = toStatementLines([
      {
        pageNumber: 1,
        width: 600,
        height: 800,
        items: [
          { str: "B", x: 50, y: 700, width: 10, height: 10 },
          { str: "A", x: 10, y: 700, width: 10, height: 10 },
          { str: "C", x: 10, y: 680, width: 10, height: 10 },
        ],
      },
      { pageNumber: 2, width: 600, height: 800, items: [{ str: " D ", x: 10, y: 700, width: 10, height: 10 }] },
    ]);
    expect(lines.map((l) => [l.page, l.index, l.text])).toEqual([
      [1, 0, "A B"],
      [1, 1, "C"],
      [2, 2, "D"],
    ]);
    expect(lines[0].cells.map((c) => c.x)).toEqual([10, 50]);
  });
});

describe("linesFromFixture (test yardımcısı)", () => {
  it("iki ve daha fazla boşlukla hücrelere böler, x'i karakter konumundan alır", () => {
    const [l] = linesFromFixture("14/10/2026  ORNEK MARKET  12.00");
    expect(l.cells.map((c) => c.text)).toEqual(["14/10/2026", "ORNEK MARKET", "12.00"]);
    expect(l.cells[1].x).toBe(12 * 5);
  });

  it("sayfa işaretini tanır", () => {
    const lines = linesFromFixture("a\n--- sayfa 2 ---\nb");
    expect(lines.map((l) => l.page)).toEqual([1, 2]);
  });
});

import { describe, expect, it } from "vitest";
import { BOM, buildCsv, csvCell } from "../src/export/csv";
import { MESSAGES } from "../src/i18n";
import { processStatement } from "../src/pipeline";
import { pagesFromFixture } from "./helpers/fixtureLines";
import fixture from "./fixtures/akbank/ornek-ekstre.txt?raw";

const report = processStatement({ pages: pagesFromFixture(fixture) });

describe("csvCell", () => {
  it("ayraç, tırnak ve satır sonu içeren hücreleri tırnaklar", () => {
    expect(csvCell("a;b", ";", ",")).toBe('"a;b"');
    expect(csvCell('a"b', ";", ",")).toBe('"a""b"');
    expect(csvCell("a\nb", ";", ",")).toBe('"a\nb"');
    expect(csvCell("düz", ";", ",")).toBe("düz");
    expect(csvCell(undefined, ";", ",")).toBe("");
  });

  it("tutarları iki ondalıkla ve dilin ondalık işaretiyle yazar", () => {
    expect(csvCell(1234.5, ";", ",")).toBe("1234,50");
    expect(csvCell(1234.5, ",", ".")).toBe("1234.50");
  });

  it("formül gibi başlayan metinleri etkisizleştirir", () => {
    expect(csvCell("=1+1", ";", ",")).toBe("'=1+1");
    expect(csvCell("+ORNEK", ";", ",")).toBe("'+ORNEK");
    expect(csvCell("@ORNEK", ";", ",")).toBe("'@ORNEK");
  });
});

describe("buildCsv", () => {
  const csv = buildCsv(report, MESSAGES.tr);
  const lines = csv.slice(BOM.length).trimEnd().split("\r\n");

  it("UTF-8 BOM ile başlar ve CRLF satır sonu kullanır", () => {
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("Türkçe başlık ve ';' ayracı kullanır", () => {
    expect(lines[0]).toBe(MESSAGES.tr.csv.headers.join(";"));
  });

  it("her bölümden satır içerir; ödeme ve iadeler yok", () => {
    const sections = lines.slice(1).map((l) => l.split(";")[0]);
    const s = MESSAGES.tr.csv.sections;
    expect(sections.filter((x) => x === s.subscription)).toHaveLength(3);
    expect(sections.filter((x) => x === s.fee)).toHaveLength(4);
    expect(sections.filter((x) => x === s.installment)).toHaveLength(1);
    expect(sections.filter((x) => x === s.unknown)).toHaveLength(2);
    expect(sections.filter((x) => x === s.known)).toHaveLength(1);
    expect(csv).not.toContain("ÖDEME");
    expect(lines).toHaveLength(1 + 3 + 4 + 1 + 2 + 1);
  });

  it("Türkçe karakterleri korur ve tutarı virgüllü yazar", () => {
    expect(csv).toContain("ÜCRETİ");
    expect(lines.find((l) => l.includes("NETFLIX"))).toContain(";229,99;");
  });

  it("İngilizcede ',' ayracı ve nokta ondalık kullanır", () => {
    const en = buildCsv(report, MESSAGES.en).slice(BOM.length).split("\r\n");
    expect(en[0]).toBe(MESSAGES.en.csv.headers.join(","));
    expect(en.find((l) => l.includes("NETFLIX"))).toContain(",229.99,");
  });
});

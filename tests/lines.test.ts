import { describe, expect, it } from "vitest";
import { groupIntoLines } from "../src/pdf/lines";
import type { PdfTextItem } from "../src/types";

// Sahte veri; gerçek ekstre içeriği değildir.
const item = (str: string, x: number, y: number): PdfTextItem => ({
  str,
  x,
  y,
  width: str.length * 5,
  height: 10,
});

describe("groupIntoLines", () => {
  it("satırları sayfada yukarıdan aşağıya (y büyükten küçüğe) sıralar", () => {
    const lines = groupIntoLines([
      item("alt", 10, 100),
      item("üst", 10, 700),
      item("orta", 10, 400),
    ]);
    expect(lines.map((l) => l.text)).toEqual(["üst", "orta", "alt"]);
  });

  it("satır içindeki parçaları soldan sağa sıralar", () => {
    const lines = groupIntoLines([
      item("100,00", 400, 500),
      item("01.10.2026", 20, 500),
      item("ORNEK MAGAZA", 120, 500),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("01.10.2026 ORNEK MAGAZA 100,00");
  });

  it("varsayılan ±2 tolerans içindeki y farklarını aynı satır sayar", () => {
    const lines = groupIntoLines([
      item("A", 10, 500),
      item("B", 50, 501),
      item("C", 90, 499.5),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("A B C");
  });

  it("tolerans dışındaki y farkını ayrı satır sayar", () => {
    const lines = groupIntoLines([item("A", 10, 500), item("B", 50, 502.5)]);
    expect(lines.map((l) => l.text)).toEqual(["B", "A"]);
  });

  it("tolerans parametresiyle ayarlanabilir", () => {
    const items = [item("A", 10, 500), item("B", 50, 503)];
    expect(groupIntoLines(items, { yTolerance: 2 })).toHaveLength(2);
    expect(groupIntoLines(items, { yTolerance: 4 })).toHaveLength(1);
    expect(groupIntoLines([item("A", 10, 500), item("B", 50, 500.1)], { yTolerance: 0 })).toHaveLength(2);
  });

  it("küçük kaymalar zincirlenip satırları birleştirmez", () => {
    // Her adım 1.5 birim; referans ilk öğe olduğu için 3. öğe yeni satır olmalı.
    const lines = groupIntoLines([item("A", 10, 500), item("B", 10, 498.5), item("C", 10, 497)]);
    expect(lines.map((l) => l.text)).toEqual(["A B", "C"]);
  });

  it("boş ve yalnızca boşluk olan parçaları atlar", () => {
    const lines = groupIntoLines([item("A", 10, 500), item("  ", 30, 500), item("", 40, 300)]);
    expect(lines.map((l) => l.text)).toEqual(["A"]);
  });
});

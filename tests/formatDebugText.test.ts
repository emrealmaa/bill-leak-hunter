import { describe, expect, it } from "vitest";
import { formatDebugText } from "../src/ui/formatDebugText";
import type { PdfPage, PdfTextItem } from "../src/types";

// Sahte veri; gerçek ekstre içeriği değildir.
const item = (str: string, x: number, y: number): PdfTextItem => ({
  str,
  x,
  y,
  width: str.length * 5,
  height: 10,
});

const pages: PdfPage[] = [
  {
    pageNumber: 1,
    width: 595,
    height: 842,
    items: [
      item("100,00", 400, 500),
      item("01.10.2026", 20, 500),
      item("ORNEK MAGAZA", 120, 501),
      item("BASLIK", 20, 800),
    ],
  },
  {
    pageNumber: 2,
    width: 595,
    height: 842,
    items: [item("SON", 20, 100)],
  },
];

describe("formatDebugText", () => {
  it("başlık, sayfa ayırıcıları ve ' | ' ile ayrılmış parçalar üretir", () => {
    expect(formatDebugText(pages, { yTolerance: 2, showPositions: false })).toBe(
      [
        "# yTolerance: 2",
        "--- sayfa 1 ---",
        "BASLIK",
        "01.10.2026 | ORNEK MAGAZA | 100,00",
        "--- sayfa 2 ---",
        "SON",
      ].join("\n"),
    );
  });

  it("x/y açıkken her parçanın yanına konumu ekler, aynı ayırıcıyı kullanır", () => {
    const text = formatDebugText(pages, { yTolerance: 2, showPositions: true });
    expect(text.split("\n")[3]).toBe(
      "01.10.2026 [x=20.0,y=500.0] | ORNEK MAGAZA [x=120.0,y=501.0] | 100,00 [x=400.0,y=500.0]",
    );
  });

  it("başlıkta verilen toleransı yazar ve gruplamada onu kullanır", () => {
    const text = formatDebugText(pages, { yTolerance: 0, showPositions: false });
    expect(text.split("\n")[0]).toBe("# yTolerance: 0");
    // Tolerans 0 iken y=501 olan parça ayrı satıra düşer.
    expect(text).toContain("\nORNEK MAGAZA\n01.10.2026 | 100,00\n");
  });
});

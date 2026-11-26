import { DEFAULT_Y_TOLERANCE, groupIntoLines } from "../pdf/lines";
import type { PdfPage } from "../types";
import type { StatementLine } from "./types";

/**
 * Sayfaları ayrıştırıcıların kullandığı satır listesine çevirir. Satırlar
 * sayfa sırasıyla, her sayfada yukarıdan aşağıya dizilir.
 */
export function toStatementLines(pages: readonly PdfPage[], yTolerance = DEFAULT_Y_TOLERANCE): StatementLine[] {
  const out: StatementLine[] = [];
  for (const page of pages) {
    for (const line of groupIntoLines(page.items, { yTolerance })) {
      const cells = line.items.map((it) => ({ text: it.str.trim(), x: it.x, width: it.width }));
      out.push({
        page: page.pageNumber,
        index: out.length,
        y: line.y,
        text: cells.map((c) => c.text).join(" "),
        cells,
      });
    }
  }
  return out;
}

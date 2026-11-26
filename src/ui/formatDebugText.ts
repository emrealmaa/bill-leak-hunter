import { groupIntoLines } from "../pdf/lines";
import type { PdfPage } from "../types";

export const DEBUG_SEPARATOR = " | ";

export interface DebugTextOptions {
  yTolerance: number;
  showPositions: boolean;
}

/**
 * Ham metni panoya kopyalanacak düz metne çevirir. Parçalar " | " ile
 * ayrılır; böylece pdf.js'in metni nereden böldüğü görülebilir.
 */
export function formatDebugText(
  pages: PdfPage[],
  { yTolerance, showPositions }: DebugTextOptions,
): string {
  const out = [`# yTolerance: ${yTolerance}`];
  for (const page of pages) {
    out.push(`--- sayfa ${page.pageNumber} ---`);
    for (const line of groupIntoLines(page.items, { yTolerance })) {
      out.push(
        line.items
          .map((it) =>
            showPositions
              ? `${it.str.trim()} [x=${it.x.toFixed(1)},y=${it.y.toFixed(1)}]`
              : it.str.trim(),
          )
          .join(DEBUG_SEPARATOR),
      );
    }
  }
  return out.join("\n");
}

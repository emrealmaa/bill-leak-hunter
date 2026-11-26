import type { StatementLine } from "../../src/banks/types";

/** Fixture'daki bir karakter sütununun PDF birimindeki genişliği. */
export const CHAR_WIDTH = 5;

/**
 * Sabit genişlikli fixture metnini StatementLine listesine çevirir.
 * - Hücreler en az iki boşlukla ayrılır; hücrenin x'i karakter konumundan gelir.
 *   Böylece sütun hizası, gerçek PDF'teki x konumlarını taklit eder.
 * - "--- sayfa N ---" satırı yeni sayfa başlatır.
 * - Boş satırlar ve "# " ile başlayan açıklama satırları atlanır.
 */
export function linesFromFixture(text: string): StatementLine[] {
  const out: StatementLine[] = [];
  let page = 1;
  let row = 0;
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const pageMark = /^--- sayfa (\d+) ---$/.exec(raw.trim());
    if (pageMark) {
      page = Number(pageMark[1]);
      row = 0;
      continue;
    }
    if (raw.trim() === "" || raw.startsWith("# ")) continue;
    const cells: StatementLine["cells"] = [];
    for (const m of raw.matchAll(/\S+(?: \S+)*/g)) {
      cells.push({ text: m[0], x: m.index * CHAR_WIDTH, width: m[0].length * CHAR_WIDTH });
    }
    out.push({
      page,
      index: out.length,
      y: 800 - row * 12,
      text: cells.map((c) => c.text).join(" "),
      cells,
    });
    row++;
  }
  return out;
}

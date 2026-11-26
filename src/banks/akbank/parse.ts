import { UNKNOWN_CHAR } from "../../pdf/decode";
import type { Transaction } from "../../types";
import { looksLikeAmount, parseAmount } from "../common/amount";
import { detectCurrency } from "../common/currency";
import { findDates, parseDate } from "../common/date";
import { foldKey } from "../common/text";
import type { ParseResult, ParseWarning, StatementLine, TextCell } from "../types";

/** Akbank tutarları İngilizce biçimdedir: 1,234.56; ödeme ve iadelerde "(-)" son eki. */
const FORMAT = "en";

type Column = "date" | "desc" | "debt" | "rest" | "chip";

// Başlık hücresi → sütun. Anahtarlar foldKey ile karşılaştırılır.
const HEADER_KEYS: [Column, RegExp][] = [
  ["date", /ISLEM TARIHI/],
  ["desc", /DONEM ICI ISLEMLER|ACIKLAMA/],
  ["debt", /BORC TUTARI|TUTAR/],
  ["rest", /KALAN BORC|TAKSIT/],
  ["chip", /CHIP/],
];

interface ColumnRange {
  column: Column;
  center: number;
}

const DATE_PREFIX_RE = /^(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+(.+)$/;
const LOOKS_LIKE_DATE_RE = /^\S{1,2}[./-]\S{1,2}[./-]\S{4}$/;
const NEG_MARK_RE = /^\(\s*-\s*\)$|^-$/;
const INSTALLMENT_CELL_RE = /^(\d{1,2})\s*\/\s*(\d{1,2})$/;
const INSTALLMENT_DESC_RES = [/(?<!\d)(\d{1,2})\s*\/\s*(\d{1,2})\s*TAKS/, /TAKSIT\w*\s*:?\s*(\d{1,2})\s*\/\s*(\d{1,2})(?!\d)/];
const ORIGINAL_RE = /\(\s*ORIJINAL TUTAR\w*\s*:?\s*([\d.,]+)\s*([^\s)]+)\s*\)/;
const PAYMENT_RE = /\b(ODEME|ODEMENIZ|TAHSILAT)\b/;
const TAX_RE = /\b(KKDF|BSMV|VERGI\w*)\b/;
const INTEREST_RE = /\bFAIZ\w*\b/;
const FEE_RE = /\b(UCRET\w*|AIDAT\w*|KOMISYON\w*|MASRAF\w*)\b/;

function headerColumns(line: StatementLine): ColumnRange[] | null {
  const key = foldKey(line.text);
  if (!key.includes("ISLEM TARIHI") || !/BORC TUTARI|TUTAR/.test(key)) return null;
  const out: ColumnRange[] = [];
  for (const cell of line.cells) {
    const ck = foldKey(cell.text);
    const hit = HEADER_KEYS.find(([, re]) => re.test(ck));
    if (hit && !out.some((c) => c.column === hit[0])) {
      out.push({ column: hit[0], center: cell.x + cell.width / 2 });
    }
  }
  const has = (c: Column) => out.some((r) => r.column === c);
  return has("date") && has("debt") ? out : null;
}

function nearestColumn(cell: TextCell, columns: readonly ColumnRange[]): Column {
  const center = cell.x + cell.width / 2;
  let best = columns[0];
  for (const c of columns) if (Math.abs(c.center - center) < Math.abs(best.center - center)) best = c;
  return best.column;
}

/** "(-)" ya da "-" ayrı hücreye düşmüşse önceki tutara ekler; tarih + açıklama bitişikse ayırır. */
function normalizeCells(cells: readonly TextCell[]): TextCell[] {
  const out: TextCell[] = [];
  cells.forEach((cell, i) => {
    const prev = out[out.length - 1];
    if (prev && NEG_MARK_RE.test(cell.text) && looksLikeAmount(prev.text, FORMAT)) {
      prev.text = `${prev.text} (-)`;
      prev.width = cell.x + cell.width - prev.x;
      return;
    }
    const m = i === 0 ? DATE_PREFIX_RE.exec(cell.text) : null;
    if (m) {
      const ratio = m[1].length / cell.text.length;
      out.push({ text: m[1], x: cell.x, width: cell.width * ratio });
      out.push({ text: m[2], x: cell.x + cell.width * ratio, width: cell.width * (1 - ratio) });
      return;
    }
    out.push({ ...cell });
  });
  return out;
}

function installmentOf(text: string): Transaction["installment"] {
  const m = INSTALLMENT_CELL_RE.exec(text.trim());
  if (!m) return undefined;
  const current = Number(m[1]);
  const total = Number(m[2]);
  return current >= 1 && total >= 2 && current <= total && total <= 60 ? { current, total } : undefined;
}

function kindOf(amount: number, key: string): Transaction["kind"] {
  if (amount < 0) return PAYMENT_RE.test(key) ? "payment" : "refund";
  if (TAX_RE.test(key)) return "tax";
  if (INTEREST_RE.test(key)) return "interest";
  if (FEE_RE.test(key)) return "fee";
  return "purchase";
}

function parseSummary(lines: readonly StatementLine[]): Pick<ParseResult, "period" | "summary"> {
  let period: ParseResult["period"];
  let cutoff: string | undefined;
  const summary: NonNullable<ParseResult["summary"]> = {};
  const firstAmount = (line: StatementLine) => {
    for (const c of line.cells) if (looksLikeAmount(c.text, FORMAT)) return parseAmount(c.text, FORMAT) ?? undefined;
    return undefined;
  };
  for (const line of lines) {
    const key = foldKey(line.text);
    if (!period && key.startsWith("EKSTRE DONEMI")) {
      const dates = findDates(line.text);
      if (dates.length >= 2) period = { start: dates[0], end: dates[1] };
    } else if (!cutoff && key.startsWith("HESAP KESIM TARIHI")) {
      cutoff = findDates(line.text)[0];
    } else if (summary.previousDebt === undefined && /^(ONCEKI|GECEN) DONEM BORCU/.test(key)) {
      summary.previousDebt = firstAmount(line);
    } else if (summary.statementDebt === undefined && key.startsWith("DONEM BORCU")) {
      summary.statementDebt = firstAmount(line);
    }
  }
  return { period, summary: Object.keys(summary).length > 0 ? summary : undefined };
}

/**
 * Akbank hesap özetinin satırlarını işlemlere çevirir.
 * - Başlık satırı ("İşlem Tarihi … Borç Tutarı …") sütunların x konumunu verir;
 *   her sayfada yeniden aranır.
 * - Tarihle başlayan satırlar işlemdir. Tutar hücreleri en yakın tutar sütununa,
 *   geri kalan metin açıklamaya gider.
 * - Başlık, özet ve "… Harcamaları" gibi alt başlıklar yok sayılır.
 * - Okunamayan işlem satırları uyarı olur (içerik değil, sayfa + satır + sebep).
 */
export function parseAkbank(lines: readonly StatementLine[]): ParseResult {
  const transactions: Transaction[] = [];
  const warnings: ParseWarning[] = [];
  let columns: ColumnRange[] | null = null;
  let layoutWarned = false;
  const warn = (line: StatementLine, reason: ParseWarning["reason"]) =>
    warnings.push({ page: line.page, line: line.index, reason });

  for (const line of lines) {
    const header = headerColumns(line);
    if (header) {
      columns = header;
      continue;
    }
    const cells = normalizeCells(line.cells);
    if (cells.length === 0) continue;
    const first = cells[0].text;
    const date = parseDate(first);
    if (!date) {
      if (columns && LOOKS_LIKE_DATE_RE.test(first) && cells.length > 1) {
        warn(line, first.includes(UNKNOWN_CHAR) ? "unknown-glyph" : "unreadable-date");
      }
      continue;
    }
    if (!columns && !layoutWarned) {
      warn(line, "unknown-layout");
      layoutWarned = true;
    }
    const amountCols = (columns ?? []).filter((c) => c.column !== "date" && c.column !== "desc");

    let debtText: string | undefined;
    let installment: Transaction["installment"];
    const desc: string[] = [];
    for (const cell of cells.slice(1)) {
      const inst = installmentOf(cell.text);
      if (inst) {
        installment ??= inst; // "3/6" hiçbir zaman borç tutarı değildir
        continue;
      }
      if (!looksLikeAmount(cell.text, FORMAT)) {
        desc.push(cell.text);
        continue;
      }
      // Başlık yoksa ilk tutar borç tutarı sayılır; kalan borç ve chip-para yok sayılır.
      const col = amountCols.length > 0 ? nearestColumn(cell, amountCols) : debtText === undefined ? "debt" : "other";
      if (col === "debt" && debtText === undefined) debtText = cell.text;
    }

    const rawDescription = desc.join(" ").replace(/\s+/g, " ").trim();
    const amount = debtText === undefined ? null : parseAmount(debtText, FORMAT);
    if (amount === null) {
      warn(line, line.text.includes(UNKNOWN_CHAR) ? "unknown-glyph" : "unreadable-amount");
      continue;
    }

    const key = foldKey(rawDescription);
    if (!installment) {
      for (const re of INSTALLMENT_DESC_RES) {
        const m = re.exec(key);
        const inst = m ? installmentOf(`${m[1]}/${m[2]}`) : undefined;
        if (inst) {
          installment = inst;
          break;
        }
      }
    }
    const tx: Transaction = {
      date,
      rawDescription,
      normalized: rawDescription.toLocaleUpperCase("tr-TR"),
      amount,
      currency: "TRY",
      kind: kindOf(amount, key),
    };
    const orig = ORIGINAL_RE.exec(key);
    if (orig) {
      const value = parseAmount(orig[1], "auto");
      const currency = detectCurrency(orig[2]);
      if (value !== null && currency) {
        tx.originalAmount = value;
        tx.currency = currency;
      }
    }
    if (installment) tx.installment = installment;
    if (rawDescription.includes(UNKNOWN_CHAR)) warn(line, "unknown-glyph");
    transactions.push(tx);
  }

  return { transactions, warnings, ...parseSummary(lines) };
}

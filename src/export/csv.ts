import { format, type Messages } from "../i18n";
import type { StatementReport } from "../pipeline";
import type { RecurringCharge, Transaction } from "../types";

/** Excel'in UTF-8'i tanıması için dosya başı işareti. */
export const BOM = "﻿";

type Cell = string | number | undefined;

/**
 * Dile göre ayraç: Türkçe Excel'de liste ayracı ";" ve ondalık işaret ",";
 * İngilizcede "," ve ".". Böylece tutarlar Excel'de sayı olarak açılır.
 */
function dialect(m: Messages) {
  const tr = m.locale.startsWith("tr");
  return { sep: tr ? ";" : ",", decimal: tr ? "," : "." };
}

/** Hücreyi CSV'ye uygun hale getirir. Formül gibi başlayan metinler etkisizleştirilir. */
export function csvCell(value: Cell, sep: string, decimal: string): string {
  if (value === undefined) return "";
  let s = typeof value === "number" ? value.toFixed(2).replace(".", decimal) : value;
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /["\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Sonuçları CSV metnine çevirir (BOM dahil). Ağ isteği yok; yalnızca metin üretir. */
export function buildCsv(report: StatementReport, m: Messages): string {
  const { sep, decimal } = dialect(m);
  const sec = m.csv.sections;
  const rows: Cell[][] = [];
  const category = (c: RecurringCharge) => m.category[c.merchant?.category ?? "unknown"];

  const charge = (section: string, c: RecurringCharge) => {
    const last = c.occurrences[c.occurrences.length - 1];
    rows.push([section, last.date, last.rawDescription, c.label, category(c), last.amount, c.monthlyEstimate, m.confidence[c.confidence], m.reason[c.reason]]);
  };
  const tx = (section: string, t: Transaction, name?: string, note?: string) =>
    rows.push([section, t.date, t.rawDescription, name, undefined, t.amount, undefined, undefined, note]);

  const a = report.analysis;
  a.subscriptions.forEach((c) => charge(sec.subscription, c));
  a.review.forEach((c) => charge(sec.review, c));
  for (const g of a.fees) {
    const name = g.rule?.label ?? m.results.fees.other[g.kind];
    g.transactions.forEach((t) => tx(sec.fee, t, name));
  }
  for (const it of a.installments) {
    const inst = it.transaction.installment!;
    const note = `${format(m.results.installments.progress, inst)}; ${format(m.results.installments.remaining, {
      count: it.remainingCount,
      amount: it.remainingAmount.toFixed(2).replace(".", decimal),
    })}`;
    tx(sec.installment, it.transaction, it.transaction.normalized, note);
  }
  a.unknown.forEach((t) => tx(sec.unknown, t));
  a.known.forEach((t) => tx(sec.known, t));

  const lines = [m.csv.headers, ...rows].map((r) => r.map((c) => csvCell(c, sep, decimal)).join(sep));
  return BOM + lines.join("\r\n") + "\r\n";
}

/** CSV'yi tarayıcıda dosya olarak indirir (Blob; sunucuya hiçbir şey gitmez). */
export function downloadCsv(text: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

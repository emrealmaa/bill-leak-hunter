import { useMemo } from "react";
import { withGlyphTable } from "../banks/check";
import { decodeStatement } from "../banks/decodeStatement";
import { StatementError } from "../banks/errors";
import { parsers } from "../banks/registry";
import type { PdfSession } from "../pdf/readPdf";
import type { GlyphTable } from "../pdf/glyphTable";

interface Props {
  session: PdfSession;
  /** Bellekteki (etiketlenmekte olan) tablo; boş değilse Akbank tablosunun yerine kullanılır. */
  table: GlyphTable;
}

const money = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// GEÇİCİ geliştirici görünümü: ayrıştırıcının çıkardığı işlemleri gözle kontrol etmek için.
export function ParsedTransactions({ session, table }: Props) {
  const outcome = useMemo(() => {
    const candidates = table.size > 0 ? withGlyphTable(parsers, "akbank", table) : parsers;
    try {
      const decoded = decodeStatement({ pages: session.pages, glyphs: session.glyphs }, candidates);
      return { decoded, result: decoded.parser.parse(decoded.lines) };
    } catch (err) {
      if (err instanceof StatementError) return { error: err.message };
      throw err;
    }
  }, [session, table]);

  if ("error" in outcome) return <p className="mt-6 rounded bg-amber-50 p-3 text-amber-800">{outcome.error}</p>;
  const { decoded, result } = outcome;
  const total = result.transactions.reduce((n, t) => n + Math.round(t.amount * 100), 0) / 100;

  return (
    <section className="mt-6 text-sm">
      <p className="text-slate-600">
        {decoded.parser.displayName} · {result.transactions.length} işlem · {result.warnings.length} uyarı ·
        çözülemeyen glif {decoded.unknownGlyphs}/{decoded.type3Glyphs}
        {result.period && ` · dönem ${result.period.start} – ${result.period.end}`}
      </p>
      <p className="text-slate-600">
        İşlem toplamı {money(total)} TL
        {result.summary?.previousDebt !== undefined && ` · önceki borç ${money(result.summary.previousDebt)}`}
        {result.summary?.statementDebt !== undefined && ` · dönem borcu ${money(result.summary.statementDebt)}`}
      </p>
      {result.warnings.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-amber-800">
          {result.warnings.map((w) => (
            <li key={`${w.page}-${w.line}-${w.reason}`}>
              Sayfa {w.page}, satır {w.line}: {w.reason}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-300 text-slate-500">
              <th className="py-1 pr-3">Tarih</th>
              <th className="py-1 pr-3">Açıklama</th>
              <th className="py-1 pr-3 text-right">Tutar (TL)</th>
              <th className="py-1 pr-3">Tür</th>
              <th className="py-1 pr-3">Taksit</th>
              <th className="py-1">Döviz</th>
            </tr>
          </thead>
          <tbody>
            {result.transactions.map((t, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-1 pr-3 whitespace-nowrap">{t.date}</td>
                <td className="py-1 pr-3">{t.rawDescription}</td>
                <td className="py-1 pr-3 text-right tabular-nums">{money(t.amount)}</td>
                <td className="py-1 pr-3">{t.kind}</td>
                <td className="py-1 pr-3">{t.installment ? `${t.installment.current}/${t.installment.total}` : ""}</td>
                <td className="py-1">{t.originalAmount !== undefined ? `${t.originalAmount} ${t.currency}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import type { ReactNode } from "react";
import { ADD_MERCHANT_URL } from "../config";
import { format, formatDate, formatMoney, useI18n, type Messages } from "../i18n";
import type { StatementReport } from "../pipeline";
import type { FeeGroup, RecurringCharge, Transaction } from "../types";

interface Props {
  report: StatementReport;
  onReset: () => void;
  onDownloadCsv?: () => void;
}

const CONFIDENCE_STYLE: Record<RecurringCharge["confidence"], string> = {
  high: "bg-emerald-100 text-emerald-900",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-slate-200 text-slate-800",
};

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      {intro && <p className="mt-1 text-sm text-slate-600">{intro}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{children}</p>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{value}</p>
    </div>
  );
}

function ChargeList({ charges, m }: { charges: RecurringCharge[]; m: Messages }) {
  const s = m.results.subscriptions;
  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {charges.map((c) => (
        <li key={`${c.merchant?.id ?? c.label}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
          <div className="min-w-0 flex-1 basis-56">
            <p className="font-medium text-slate-900">{c.label}</p>
            <p className="text-sm text-slate-600">
              {m.category[c.merchant?.category ?? "unknown"]} · {m.reason[c.reason]} ·{" "}
              {format(s.count, { count: c.occurrences.length })}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONFIDENCE_STYLE[c.confidence]}`}>
            <span className="sr-only">{s.confidence}: </span>
            {m.confidence[c.confidence]}
          </span>
          <p className="w-32 text-right font-semibold tabular-nums text-slate-900">
            <span className="sr-only">{s.monthly}: </span>
            {formatMoney(c.monthlyEstimate, m)}
          </p>
          {/* Sabit genişlik: iptal bağlantısı olmayan satırlarda da rozet ve tutar hizalı kalır. */}
          <div className="w-full text-sm sm:w-36">
            {c.merchant?.cancelUrl ? (
              <a
                href={c.merchant.cancelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
              >
                {s.cancelLink} ↗
              </a>
            ) : (
              c.merchant?.cancelNote && <span className="text-slate-600">{c.merchant.cancelNote}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function TransactionList({ items, m }: { items: Transaction[]; m: Messages }) {
  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm">
      {items.map((t, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5">
          <span className="w-24 shrink-0 tabular-nums text-slate-500">{formatDate(t.date, m)}</span>
          <span className="min-w-0 flex-1 break-words text-slate-800">{t.rawDescription}</span>
          <span className="tabular-nums font-medium text-slate-900">{formatMoney(t.amount, m)}</span>
        </li>
      ))}
    </ul>
  );
}

function feeLabel(g: FeeGroup, m: Messages): string {
  return g.rule?.label ?? m.results.fees.other[g.kind];
}

export function Results({ report, onReset, onDownloadCsv }: Props) {
  const { m } = useI18n();
  const r = m.results;
  const a = report.analysis;

  return (
    <article>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{r.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {report.bank.displayName}
            {report.period &&
              ` · ${format(r.period, { start: formatDate(report.period.start, m), end: formatDate(report.period.end, m) })}`}
            {` · ${format(r.transactionCount, { count: report.transactions.length })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onDownloadCsv && (
            <button
              type="button"
              onClick={onDownloadCsv}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {r.downloadCsv}
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            {r.newStatement}
          </button>
        </div>
      </header>

      {(report.warnings.length > 0 || report.unknownGlyphs > 0) && (
        <div className="mt-4 space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="note">
          {report.warnings.length > 0 && <p>{format(r.warnings, { count: report.warnings.length })}</p>}
          {report.unknownGlyphs > 0 && <p>{format(r.unknownGlyphs, { count: report.unknownGlyphs })}</p>}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label={r.cards.monthlyRecurring} value={formatMoney(a.totals.monthlyRecurring, m)} />
        <SummaryCard label={r.cards.fees} value={formatMoney(a.totals.fees, m)} />
        <SummaryCard label={r.cards.unknown} value={String(a.totals.unknownCount)} />
      </div>

      <Section title={r.subscriptions.title}>
        {a.subscriptions.length > 0 ? <ChargeList charges={a.subscriptions} m={m} /> : <Empty>{r.subscriptions.empty}</Empty>}
      </Section>

      {a.review.length > 0 && (
        <Section title={r.review.title} intro={r.review.intro}>
          <ChargeList charges={a.review} m={m} />
        </Section>
      )}

      <Section title={r.fees.title}>
        {a.fees.length > 0 ? (
          <ul className="space-y-3">
            {a.fees.map((g) => (
              <li key={g.rule?.id ?? g.kind} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {feeLabel(g, m)} <span className="text-sm font-normal text-slate-500">×{g.transactions.length}</span>
                  </p>
                  <p className="font-semibold tabular-nums text-slate-900">{formatMoney(g.total, m)}</p>
                </div>
                {g.rule && <p className="mt-1 text-sm text-slate-600">{g.rule.explanation}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{r.fees.empty}</Empty>
        )}
      </Section>

      <Section title={r.installments.title}>
        {a.installments.length > 0 ? (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {a.installments.map((it, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{it.transaction.normalized}</p>
                  <p className="text-sm text-slate-600">
                    {format(r.installments.progress, {
                      current: it.transaction.installment!.current,
                      total: it.transaction.installment!.total,
                    })}{" "}
                    ·{" "}
                    {format(r.installments.remaining, {
                      count: it.remainingCount,
                      amount: formatMoney(it.remainingAmount, m),
                    })}
                  </p>
                </div>
                <p className="font-semibold tabular-nums text-slate-900">{formatMoney(it.transaction.amount, m)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{r.installments.empty}</Empty>
        )}
      </Section>

      <Section title={r.unknown.title} intro={r.unknown.intro}>
        {a.unknown.length > 0 ? (
          <>
            <TransactionList items={a.unknown} m={m} />
            <a
              href={ADD_MERCHANT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
            >
              {r.unknown.contribute} ↗
            </a>
          </>
        ) : (
          <Empty>{r.unknown.empty}</Empty>
        )}
      </Section>

      {a.known.length > 0 && (
        <details className="mt-10">
          <summary className="cursor-pointer text-lg font-semibold text-slate-900">
            {r.known.title} ({a.known.length})
          </summary>
          <div className="mt-3">
            <TransactionList items={a.known} m={m} />
          </div>
        </details>
      )}
    </article>
  );
}

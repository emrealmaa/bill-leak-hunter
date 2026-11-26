import { foldKey } from "../banks/common/text";
import { matchMerchant } from "../catalog";
import { matchFee } from "../catalog/fees";
import type {
  AnalysisResult,
  FeeGroup,
  FeeRule,
  InstallmentItem,
  Merchant,
  RecurringCharge,
  Transaction,
} from "../types";

/** PROJE.md §8 eşikleri. */
export const AMOUNT_TOLERANCE = 0.15; // tutarlar birbirine ±%15 yakın
export const MONTHLY_DAYS: [number, number] = [28, 35];
export const YEARLY_DAYS: [number, number] = [335, 395];

export interface AnalysisDeps {
  matchMerchant: (tx: Transaction) => Merchant | undefined;
  matchFee: (tx: Transaction) => FeeRule | undefined;
}

const defaultDeps: AnalysisDeps = { matchMerchant, matchFee };

const cents = (n: number) => Math.round(n * 100);
const sum = (txs: readonly Transaction[]) => txs.reduce((n, t) => n + cents(t.amount), 0) / 100;
const month = (iso: string) => iso.slice(0, 7);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Tutarlar birbirine ±%15 yakın mı? (En büyük ile en küçük arasındaki fark, en büyüğün %15'i kadar.) */
export function similarAmounts(amounts: readonly number[], tolerance = AMOUNT_TOLERANCE): boolean {
  if (amounts.length === 0) return false;
  const max = Math.max(...amounts);
  const min = Math.min(...amounts);
  return min > 0 && max - min <= max * tolerance + 1e-9;
}

/** Tarihe göre sıralı işlemler arasındaki bütün aralıklar verilen gün aralığında mı? */
function intervalsWithin(sorted: readonly Transaction[], [min, max]: [number, number]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    const d = dayDiff(sorted[i - 1].date, sorted[i].date);
    if (d < min || d > max) return false;
  }
  return true;
}

/** Aylık tahmini tutar: toplam / farklı takvim ayı sayısı. Yıllıksa tutar / 12. */
function monthlyEstimate(txs: readonly Transaction[], yearly: boolean): number {
  if (yearly) return Math.round((cents(median(txs.map((t) => t.amount))) / 12)) / 100;
  const months = new Set(txs.map((t) => month(t.date))).size || 1;
  return Math.round(cents(sum(txs)) / months) / 100;
}

/**
 * Tekrar kuralları (PROJE.md §8):
 * - Katalogda abonelik → high (tek işlem yeterli)
 * - Farklı aylarda 2+ işlem, tutarlar ±%15, aralık 28–35 gün ya da ~1 yıl → medium
 * - Farklı aylarda 2+ işlem, tutarlar ±%15 ama düzensiz aralık → low ("kontrol et")
 */
export function classifyGroup(txs: readonly Transaction[], merchant?: Merchant): RecurringCharge | undefined {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const label = merchant?.name ?? sorted[0].normalized;
  const base = { merchant, label, occurrences: sorted };

  if (merchant?.isSubscription) {
    const yearly = sorted.length >= 2 && intervalsWithin(sorted, YEARLY_DAYS);
    return { ...base, confidence: "high", reason: "catalog-subscription", monthlyEstimate: monthlyEstimate(sorted, yearly) };
  }
  const months = new Set(sorted.map((t) => month(t.date)));
  if (sorted.length < 2 || months.size < 2 || !similarAmounts(sorted.map((t) => t.amount))) return undefined;
  if (intervalsWithin(sorted, MONTHLY_DAYS)) {
    return { ...base, confidence: "medium", reason: "monthly", monthlyEstimate: monthlyEstimate(sorted, false) };
  }
  if (intervalsWithin(sorted, YEARLY_DAYS)) {
    return { ...base, confidence: "medium", reason: "yearly", monthlyEstimate: monthlyEstimate(sorted, true) };
  }
  return { ...base, confidence: "low", reason: "irregular", monthlyEstimate: monthlyEstimate(sorted, false) };
}

/**
 * Normalleştirilmiş işlemleri analiz eder. Ödemeler ve iadeler çıkarılır;
 * taksitler ve ücretler ayrı bölümlere gider; katalogda olmayan ve tekrar
 * etmeyen harcamalar "bilinmiyor" sayılır (tahmin yok).
 */
export function analyze(transactions: readonly Transaction[], deps: AnalysisDeps = defaultDeps): AnalysisResult {
  const installments: InstallmentItem[] = [];
  const feeGroups = new Map<string, FeeGroup>();
  const groups = new Map<string, { merchant?: Merchant; txs: Transaction[] }>();

  for (const tx of transactions) {
    if (tx.kind === "payment" || tx.kind === "refund" || tx.amount <= 0) continue;

    if (tx.installment) {
      const remainingCount = tx.installment.total - tx.installment.current;
      installments.push({ transaction: tx, remainingCount, remainingAmount: (cents(tx.amount) * remainingCount) / 100 });
      continue;
    }

    const rule = deps.matchFee(tx);
    const feeKind = rule?.kind ?? (tx.kind === "fee" || tx.kind === "tax" || tx.kind === "interest" ? tx.kind : undefined);
    if (feeKind) {
      const key = rule ? `rule:${rule.id}` : `kind:${feeKind}`;
      const g = feeGroups.get(key) ?? { rule, kind: feeKind, transactions: [], total: 0 };
      g.transactions.push(tx);
      g.total = sum(g.transactions);
      feeGroups.set(key, g);
      continue;
    }

    const merchant = deps.matchMerchant(tx);
    const key = merchant ? `m:${merchant.id}` : `n:${foldKey(tx.normalized)}`;
    const g = groups.get(key) ?? { merchant, txs: [] };
    g.txs.push(tx);
    groups.set(key, g);
  }

  const subscriptions: RecurringCharge[] = [];
  const review: RecurringCharge[] = [];
  const unknown: Transaction[] = [];
  const known: Transaction[] = [];
  for (const { merchant, txs } of groups.values()) {
    const charge = classifyGroup(txs, merchant);
    if (charge?.confidence === "low") review.push(charge);
    else if (charge) subscriptions.push(charge);
    else (merchant ? known : unknown).push(...txs);
  }

  const byAmount = (a: RecurringCharge, b: RecurringCharge) => b.monthlyEstimate - a.monthlyEstimate;
  subscriptions.sort(byAmount);
  review.sort(byAmount);
  const fees = [...feeGroups.values()].sort((a, b) => b.total - a.total);
  const byDate = (a: Transaction, b: Transaction) => a.date.localeCompare(b.date);
  unknown.sort(byDate);
  known.sort(byDate);

  return {
    subscriptions,
    review,
    fees,
    installments,
    unknown,
    known,
    totals: {
      monthlyRecurring: subscriptions.reduce((n, s) => n + cents(s.monthlyEstimate), 0) / 100,
      fees: fees.reduce((n, f) => n + cents(f.total), 0) / 100,
      unknownCount: unknown.length,
    },
  };
}

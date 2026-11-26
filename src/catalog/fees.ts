import type { FeeRule, Transaction } from "../types";
import { compilePatterns, matchDescription, type Compiled } from "./match";

const feeFiles = import.meta.glob<FeeRule[]>("../../catalog/fees/*.json", { eager: true, import: "default" });

/** Bütün ücret / vergi / faiz kuralları, dosya adına göre sıralı. */
export const FEE_RULES: readonly FeeRule[] = Object.keys(feeFiles)
  .sort()
  .flatMap((k) => feeFiles[k]);

const compiledFees = compilePatterns(FEE_RULES);

/**
 * İşlemin ücret kuralı. Ödeme ve iadeler (negatif tutarlar) hiçbir zaman ücret
 * sayılmaz. Bulunamazsa undefined.
 */
export function matchFee(
  tx: Pick<Transaction, "normalized" | "rawDescription" | "amount">,
  rules: readonly Compiled<FeeRule>[] = compiledFees,
): FeeRule | undefined {
  if (tx.amount <= 0) return undefined;
  return matchDescription(tx, rules);
}

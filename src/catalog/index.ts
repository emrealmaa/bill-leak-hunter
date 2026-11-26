import type { Merchant, Transaction } from "../types";
import { compilePatterns, matchDescription, type Compiled } from "./match";

// Katalog dosyaları derleme anında pakete girer (ağ isteği yok, PROJE.md §10).
const merchantFiles = import.meta.glob<Merchant[]>("../../catalog/merchants/*.json", {
  eager: true,
  import: "default",
});

/** Bütün satıcı kayıtları, dosya adına göre sıralı. */
export const MERCHANTS: readonly Merchant[] = Object.keys(merchantFiles)
  .sort()
  .flatMap((k) => merchantFiles[k]);

const compiledMerchants = compilePatterns(MERCHANTS);

/** İşlemin katalogdaki satıcısı; bulunamazsa undefined (tahmin yok, PROJE.md §8). */
export function matchMerchant(
  tx: Pick<Transaction, "normalized" | "rawDescription">,
  catalog: readonly Compiled<Merchant>[] = compiledMerchants,
): Merchant | undefined {
  return matchDescription(tx, catalog);
}

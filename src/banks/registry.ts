import { akbankParser } from "./akbank";
import type { BankParser } from "./types";

/**
 * Kayıtlı banka ayrıştırıcıları. Yeni banka eklemek için ayrıştırıcıyı içe
 * aktarıp bu listeye tek satır eklemek yeterlidir. Sıra önemlidir: detect
 * sırayla denenir, ilk eşleşen kazanır.
 */
export const parsers: readonly BankParser[] = [akbankParser];

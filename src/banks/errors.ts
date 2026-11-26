export type StatementErrorCode =
  | "unsupported-bank" // hiçbir ayrıştırıcı ekstreyi tanımadı
  | "missing-glyph-table" // Type3 fontlu ekstre, karakter tablosu yok ya da yetersiz
  | "no-transactions"; // banka tanındı ama hiç işlem çıkmadı

const MESSAGES: Record<StatementErrorCode, string> = {
  "unsupported-bank": "Bu bankayı henüz desteklemiyoruz.",
  "missing-glyph-table": "Bu ekstrenin karakter tablosu eksik.",
  "no-transactions": "Ekstrede işlem bulunamadı.",
};

/** Ekstre işlenirken çıkan, kullanıcıya gösterilebilir hata. Mesaj içerik taşımaz. */
export class StatementError extends Error {
  readonly code: StatementErrorCode;
  constructor(code: StatementErrorCode) {
    super(MESSAGES[code]);
    this.name = "StatementError";
    this.code = code;
  }
}

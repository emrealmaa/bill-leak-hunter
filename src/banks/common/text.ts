const ASCII_FOLD: Record<string, string> = { Ç: "C", Ğ: "G", İ: "I", Ö: "O", Ş: "S", Ü: "U", Â: "A", Î: "I", Û: "U" };

/**
 * Karşılaştırma anahtarı: Türkçe-duyarlı büyük harf, Türkçe harfler ASCII'ye
 * katlanır, boşluklar teke iner. "Hesap Özeti" → "HESAP OZETI".
 * Ekstrelerde aynı ifade bazen "ÖZETİ", bazen "OZETI" yazıldığı için
 * sabit ifade aramaları bu anahtar üzerinden yapılır.
 */
export function foldKey(text: string): string {
  return text
    .normalize("NFC")
    .toLocaleUpperCase("tr-TR")
    .replace(/[ÇĞİÖŞÜÂÎÛ]/g, (c) => ASCII_FOLD[c])
    .replace(/\s+/g, " ")
    .trim();
}

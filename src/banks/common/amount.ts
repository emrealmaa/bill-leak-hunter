/**
 * Tutar biçimi:
 * - "tr": 1.234,56 (nokta binlik, virgül ondalık)
 * - "en": 1,234.56 (virgül binlik, nokta ondalık)
 * - "auto": iki ayraç varsa sondaki ondalıktır; tek ayraç varsa ardından
 *   1–2 rakam geliyorsa ondalık, tam 3 rakam geliyorsa binlik sayılır.
 *   Banka biçimi biliniyorsa "auto" yerine açık biçim verilmelidir.
 */
export type AmountFormat = "tr" | "en" | "auto";

// İşaret ve para birimi dışında izin verilen gövde: rakam, nokta, virgül, boşluk.
const BODY_RE = /^[\d.,\s]+$/;
// Sondaki negatif işaretleri: "(-)", "-", "CR" yok (bilinmeyen kısaltmalar uydurulmaz).
const NEG_SUFFIX_RE = /\s*(\(\s*-\s*\)|-)\s*$/;
const NEG_PREFIX_RE = /^\s*-\s*/;
const POS_PREFIX_RE = /^\s*\+\s*/;
// Başta ya da sonda duran para birimi ifadeleri; tutarın parçası sayılmaz.
const CURRENCY_RE = /^\s*(TL|TRY|USD|EUR|GBP|[₺$€£])\s*|\s*(TL|TRY|USD|EUR|GBP|[₺$€£])\s*$/gi;

function splitDecimal(body: string, format: AmountFormat): { int: string; frac: string } | null {
  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  let decimalSep: "." | "," | null;
  let thousandSep: "." | ",";

  if (format === "tr") [decimalSep, thousandSep] = [",", "."];
  else if (format === "en") [decimalSep, thousandSep] = [".", ","];
  else if (lastDot !== -1 && lastComma !== -1) {
    decimalSep = lastDot > lastComma ? "." : ",";
    thousandSep = decimalSep === "." ? "," : ".";
  } else if (lastDot === -1 && lastComma === -1) [decimalSep, thousandSep] = [null, ","];
  else {
    const sep = lastDot !== -1 ? "." : ",";
    const pos = Math.max(lastDot, lastComma);
    const after = body.length - pos - 1;
    const sepCount = body.split(sep).length - 1;
    if (sepCount === 1 && after >= 1 && after <= 2) [decimalSep, thousandSep] = [sep, sep === "." ? "," : "."];
    else [decimalSep, thousandSep] = [null, sep];
  }

  let int = body;
  let frac = "";
  if (decimalSep) {
    const pos = body.lastIndexOf(decimalSep);
    if (pos !== -1) {
      int = body.slice(0, pos);
      frac = body.slice(pos + 1);
    }
  }
  if (frac.includes(".") || frac.includes(",")) return null;
  if (frac.length > 2) return null;
  // Binlik ayraçlı kısım: gruplar 3 haneli olmalı.
  if (int.includes(thousandSep)) {
    const groups = int.split(thousandSep);
    if (groups[0].length < 1 || groups[0].length > 3 || groups.slice(1).some((g) => g.length !== 3)) return null;
    int = groups.join("");
  }
  if (int.includes(".") || int.includes(",")) return null;
  if (int === "" && frac === "") return null;
  return { int: int || "0", frac };
}

/**
 * Tutar metnini sayıya çevirir. "(-)" son eki ya da "-" öneki negatif yapar.
 * Para birimi ifadeleri (TL, $, € …) yok sayılır. Okunamazsa null.
 */
export function parseAmount(text: string, format: AmountFormat = "auto"): number | null {
  let s = text.replace(/ /g, " ").trim().replace(CURRENCY_RE, "").trim();
  let negative = false;
  if (NEG_SUFFIX_RE.test(s)) {
    negative = true;
    s = s.replace(NEG_SUFFIX_RE, "");
  }
  s = s.replace(CURRENCY_RE, "").trim();
  if (NEG_PREFIX_RE.test(s)) {
    if (negative) return null;
    negative = true;
    s = s.replace(NEG_PREFIX_RE, "");
  } else {
    s = s.replace(POS_PREFIX_RE, "");
  }
  s = s.replace(CURRENCY_RE, "").trim();
  if (!BODY_RE.test(s) || !/\d/.test(s)) return null;
  const body = s.replace(/\s+/g, "");
  const parts = splitDecimal(body, format);
  if (!parts) return null;
  const cents = Number(parts.int) * 100 + Number(parts.frac.padEnd(2, "0"));
  if (!Number.isFinite(cents)) return null;
  const value = cents / 100;
  return negative && value !== 0 ? -value : value;
}

/** Metin, biçime uyan bir tutar mı? (Tarih ya da taksit "3/6" gibi değerleri elemek için.) */
export function looksLikeAmount(text: string, format: AmountFormat = "auto"): boolean {
  const t = text.trim();
  if (!/\d[.,]\d{2}(?!\d)/.test(t)) return false; // ondalıklı olmayanlar tutar sayılmaz
  return parseAmount(t, format) !== null;
}

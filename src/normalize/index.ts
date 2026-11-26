import intermediaryData from "../../catalog/intermediaries.json" with { type: "json" };
import { foldKey } from "../banks/common/text";
import type { Transaction } from "../types";
import { CITY_SUFFIXES, COUNTRY_SUFFIXES, TWO_WORD_CITY_SUFFIXES } from "./places";

export interface Intermediary {
  id: string;
  name: string;
  /** "*" işaretinden önce gelen önek (foldKey biçiminde): "IYZICO" → "IYZICO*SATICI". */
  prefixes: string[];
  verified: boolean;
}

export const INTERMEDIARIES: readonly Intermediary[] = intermediaryData;

export interface NormalizedDescription {
  /** Temizlenmiş, Türkçe-duyarlı büyük harfli açıklama: "IYZICO*ORNEK KITAP ISTANBUL" → "ORNEK KITAP". */
  normalized: string;
  /** Ödeme aracısının kimliği (varsa). */
  intermediary?: string;
}

// "*" ile ayrılmış önek: "IYZICO*SATICI", "PAYPAL *SATICI", "PADDLE.NET* SATICI".
const PREFIX_RE = /^([\p{L}\d.]+)\s*\*\s*(.+)$/u;
// Döviz eki: "(ORİJİNAL TUTAR 5.99 $)"; Türkçe ve ASCII yazılışları.
const ORIGINAL_AMOUNT_RE = /\(\s*OR[İI]J[İI]NAL TUTAR[^)]*\)/gu;
// Referans ekleri: "REF:12345", "REF NO 12345", "#12345".
const REF_RE = /(?<![\p{L}\d])(REF(ERANS)?\s*(NO)?\s*[:.]?\s*|#\s*)[\p{L}\d-]*\d[\p{L}\d-]*/gu;

/** Referans numarası gibi duran kelime: 6+ rakam ya da en az 4 rakam içeren 6+ karakterlik harf-rakam karışımı. */
function isReferenceToken(token: string): boolean {
  const t = token.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
  if (/^\d{6,}$/.test(t)) return true;
  const digits = (t.match(/\d/g) ?? []).length;
  return t.length >= 6 && digits >= 4 && /\p{L}/u.test(t) && /^[\p{L}\d]+$/u.test(t);
}

function stripPlaceSuffixes(tokens: string[]): string[] {
  const out = [...tokens];
  for (;;) {
    if (out.length >= 3 && TWO_WORD_CITY_SUFFIXES.has(foldKey(out.slice(-2).join(" ")))) {
      out.splice(-2, 2);
      continue;
    }
    if (out.length < 2) break;
    const last = foldKey(out[out.length - 1]);
    if (COUNTRY_SUFFIXES.has(last) || CITY_SUFFIXES.has(last)) {
      out.pop();
      continue;
    }
    break;
  }
  return out;
}

/** Önekin bilinen bir ödeme aracısı olup olmadığına bakar. */
function findIntermediary(prefix: string, list: readonly Intermediary[]): Intermediary | undefined {
  const key = foldKey(prefix);
  return list.find((i) => i.prefixes.includes(key));
}

/**
 * Ekstre açıklamasını karşılaştırılabilir hale getirir (PROJE.md §8):
 * Türkçe-duyarlı büyük harf, fazla boşluk, döviz eki, referans numaraları,
 * sondaki şehir/ülke ekleri temizlenir; ödeme aracısı öneki ayrı alana alınır.
 * Temizlik sonunda hiçbir şey kalmazsa büyük harfli özgün metin döner.
 */
export function normalizeDescription(
  raw: string,
  intermediaries: readonly Intermediary[] = INTERMEDIARIES,
): NormalizedDescription {
  const upper = raw.normalize("NFC").toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();
  let text = upper.replace(ORIGINAL_AMOUNT_RE, " ").replace(REF_RE, " ");

  let intermediary: string | undefined;
  const m = PREFIX_RE.exec(text.trim());
  if (m) {
    const found = findIntermediary(m[1], intermediaries);
    if (found) {
      intermediary = found.id;
      text = m[2];
    }
  }

  let tokens = text.split(" ").filter((t) => t !== "" && !isReferenceToken(t));
  tokens = stripPlaceSuffixes(tokens);
  const normalized = tokens
    .join(" ")
    .replace(/[\s*,;:/-]+$/u, "")
    .replace(/^[\s*,;:/-]+/u, "")
    .trim();
  return { normalized: normalized || upper, ...(intermediary ? { intermediary } : {}) };
}

/** İşlemlerin normalized ve intermediary alanlarını doldurur (yeni nesneler döner). */
export function normalizeTransactions(
  transactions: readonly Transaction[],
  intermediaries: readonly Intermediary[] = INTERMEDIARIES,
): Transaction[] {
  return transactions.map((t) => {
    const n = normalizeDescription(t.rawDescription, intermediaries);
    const out: Transaction = { ...t, normalized: n.normalized };
    if (n.intermediary) out.intermediary = n.intermediary;
    else delete out.intermediary;
    return out;
  });
}

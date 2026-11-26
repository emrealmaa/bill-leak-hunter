/** Metnin tamamı GG/AA/YYYY ya da GG.AA.YYYY mi? (Ayraç olarak - de kabul edilir.) */
export const DATE_RE = /^(\d{1,2})([./-])(\d{1,2})\2(\d{4})$/;

/** Metin içinde geçen tarihler için (sınırlar rakam olmamalı). */
export const DATE_IN_TEXT_RE = /(?<!\d)(\d{1,2})([./-])(\d{1,2})\2(\d{4})(?!\d)/g;

function toIso(d: number, m: number, y: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > last) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "14/10/2026" ya da "14.10.2026" → "2026-10-14". Geçersizse null. */
export function parseDate(text: string): string | null {
  const m = DATE_RE.exec(text.trim());
  if (!m) return null;
  return toIso(Number(m[1]), Number(m[3]), Number(m[4]));
}

/** Metindeki bütün geçerli tarihleri sırasıyla ISO olarak döndürür. */
export function findDates(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(DATE_IN_TEXT_RE)) {
    const iso = toIso(Number(m[1]), Number(m[3]), Number(m[4]));
    if (iso) out.push(iso);
  }
  return out;
}

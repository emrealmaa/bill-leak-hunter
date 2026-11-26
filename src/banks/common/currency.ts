/** ISO 4217 kodu. Yalnızca bilinen birkaç para birimi tanınır; tahmin yok. */
export type CurrencyCode = "TRY" | "USD" | "EUR" | "GBP";

const SYMBOLS: [RegExp, CurrencyCode][] = [
  [/(?<![A-Z])(TL|TRY|YTL)(?![A-Z])|₺/, "TRY"],
  [/(?<![A-Z])USD(?![A-Z])|\$/, "USD"],
  [/(?<![A-Z])(EUR|EURO)(?![A-Z])|€/, "EUR"],
  [/(?<![A-Z])GBP(?![A-Z])|£/, "GBP"],
];

/** Metinde geçen ilk para birimini döndürür ("12,00 $" → "USD"). Bulunamazsa undefined. */
export function detectCurrency(text: string): CurrencyCode | undefined {
  const t = text.toLocaleUpperCase("tr-TR");
  let best: { pos: number; code: CurrencyCode } | undefined;
  for (const [re, code] of SYMBOLS) {
    const m = re.exec(t);
    if (m && (!best || m.index < best.pos)) best = { pos: m.index, code };
  }
  return best?.code;
}

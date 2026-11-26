import { foldKey } from "../banks/common/text";

export interface Compiled<T> {
  item: T;
  res: RegExp[];
}

/** Kalıpları bir kez derler. Kalıplar ASCII'ye katlanmış büyük harfli metne karşı çalışır. */
export function compilePatterns<T extends { patterns: readonly string[] }>(items: readonly T[]): Compiled<T>[] {
  return items.map((item) => ({ item, res: item.patterns.map((p) => new RegExp(p, "u")) }));
}

/**
 * Anahtar metinle eşleşen kayıtlar arasından EN UZUN eşleşmeyi seçer; böylece
 * "AMAZON PRIME", genel "AMAZON" kaydından, "MICROSOFT 365" de "MICROSOFT"tan
 * önce gelir. Eşitlikte listede önce gelen kazanır.
 */
export function bestMatch<T>(key: string, compiled: readonly Compiled<T>[]): T | undefined {
  let best: { item: T; len: number } | undefined;
  for (const { item, res } of compiled) {
    for (const re of res) {
      const m = re.exec(key);
      if (m && (!best || m[0].length > best.len)) best = { item, len: m[0].length };
    }
  }
  return best?.item;
}

/** Önce normalleştirilmiş açıklamada, bulunamazsa ham açıklamada arar. */
export function matchDescription<T>(
  tx: { normalized: string; rawDescription: string },
  compiled: readonly Compiled<T>[],
): T | undefined {
  return bestMatch(foldKey(tx.normalized), compiled) ?? bestMatch(foldKey(tx.rawDescription), compiled);
}

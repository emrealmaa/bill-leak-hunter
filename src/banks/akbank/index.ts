import { glyphTableFromData } from "../../pdf/glyphTable";
import type { BankParser } from "../types";
import { detectAkbank } from "./detect";
import glyphData from "./glyphs.json" with { type: "json" };
import { parseAkbank } from "./parse";

/**
 * Akbank (Axess) kredi kartı hesap özeti.
 * PDF'teki fontlar Type3 ve Unicode eşlemesi yok; metin glyphs.json ile
 * (şekil hash'i → karakter) çözülür. Tabloda kişisel veri yoktur.
 */
export const akbankParser: BankParser = {
  id: "akbank",
  displayName: "Akbank (Axess)",
  glyphTable: glyphTableFromData(glyphData),
  detect: detectAkbank,
  parse: parseAkbank,
};

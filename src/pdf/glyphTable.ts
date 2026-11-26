import { GLYPH_HASH_VERSION } from "./glyphs";

/**
 * Glif çözme tablosu: şekil hash'i → karakter.
 * Dosya biçimi: { "hashVersion": 1, "glyphs": { "<hash>": "<karakter>" } }
 * Dosyada başka HİÇBİR alan olmaz (satır metni, konum, tarih vb. yok).
 */
export type GlyphTable = Map<string, string>;

export class GlyphTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlyphTableError";
  }
}

const HASH_RE = /^[0-9a-f]{16}$/;

/** Tek bir karakter mi (tek Unicode kod noktası, NFC)? */
export function isSingleChar(s: string): boolean {
  return [...s.normalize("NFC")].length === 1 && s.trim() !== "";
}

export function serializeGlyphTable(table: GlyphTable): string {
  const glyphs = Object.fromEntries([...table].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return JSON.stringify({ hashVersion: GLYPH_HASH_VERSION, glyphs }, null, 2) + "\n";
}

export function parseGlyphTable(text: string): GlyphTable {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new GlyphTableError("Dosya geçerli bir JSON değil.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new GlyphTableError("Dosya biçimi tanınmadı.");
  }
  const obj = data as Record<string, unknown>;
  const extra = Object.keys(obj).filter((k) => k !== "hashVersion" && k !== "glyphs");
  if (extra.length > 0) {
    throw new GlyphTableError("Dosyada beklenmeyen alanlar var; yalnızca hashVersion ve glyphs olmalı.");
  }
  if (obj.hashVersion !== GLYPH_HASH_VERSION) {
    throw new GlyphTableError(
      `Tablonun hash sürümü (${String(obj.hashVersion)}) bu uygulamanınkiyle (${GLYPH_HASH_VERSION}) uyuşmuyor. ` +
        "Tablo farklı bir hash algoritmasıyla hazırlanmış; kullanılamaz.",
    );
  }
  const glyphs = obj.glyphs;
  if (!glyphs || typeof glyphs !== "object" || Array.isArray(glyphs)) {
    throw new GlyphTableError("glyphs alanı bir nesne olmalı.");
  }
  const table: GlyphTable = new Map();
  for (const [hash, ch] of Object.entries(glyphs as Record<string, unknown>)) {
    if (!HASH_RE.test(hash)) throw new GlyphTableError("Tabloda geçersiz bir hash var.");
    if (typeof ch !== "string" || !isSingleChar(ch)) {
      throw new GlyphTableError("Tablodaki her değer tek bir karakter olmalı.");
    }
    table.set(hash, ch.normalize("NFC"));
  }
  return table;
}

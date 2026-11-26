/**
 * Teşhis script'i: gerçek Akbank ekstrelerinde tanıma + ayrıştırmayı çalıştırır.
 *
 *   npm run akbank-check -- <a.pdf> [<b.pdf> …]
 *   npm run akbank-check -- --table private/glyphs.json <a.pdf> …   # taslak tabloyla
 *
 * GİZLİLİK (PROJE.md §10): YALNIZCA SAYI ve evet/hayır yazdırılır. Dosya adı,
 * metin, tutar, tarih, açıklama ya da hash yazdırılmaz. Hata mesajları da
 * içerik taşıyabileceği için yalnızca sabit kodlar basılır.
 *
 * src/ modülleri uzantısız import kullandığı için Vite'ın modül çalıştırıcısıyla
 * (runnerImport) yüklenir; ek paket gerekmez.
 */
import { readFile } from "node:fs/promises";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { runnerImport } from "vite";

// src/ tiplerini burada yeniden tanımlıyoruz: scripts/ NodeNext ile derlenir,
// src/ ise bundler çözümlemesiyle; ikisini aynı programa katmamak için.
interface StatementCheck {
  pages: number;
  type3Glyphs: number;
  unknownGlyphs: number;
  bank?: string;
  error?: string;
  transactions: number;
  kinds: Record<string, number>;
  installments: number;
  foreign: number;
  warnings: Record<string, number>;
  periodFound: boolean;
  totalMatches: string;
}
interface CheckModule {
  checkStatement(raw: unknown, candidates?: unknown): StatementCheck;
  withGlyphTable(candidates: unknown, bankId: string, table: unknown): unknown;
}
interface RegistryModule {
  parsers: unknown;
}
interface GlyphModule {
  extractPageGlyphs(page: unknown, ops: unknown, cache?: Map<string, string>): Promise<unknown[]>;
}
interface TableModule {
  glyphTableFromData(data: unknown): Map<string, string>;
}

function fail(msg: string): never {
  console.error(`Hata: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const tableIdx = args.indexOf("--table");
const tablePath = tableIdx === -1 ? undefined : args[tableIdx + 1];
if (tableIdx !== -1 && !tablePath) fail("--table için bir dosya yolu verin");
const files = args.filter((_, i) => tableIdx === -1 || (i !== tableIdx && i !== tableIdx + 1));
if (files.length === 0) fail("en az bir PDF verin");

// logLevel: Vite'ın kendi çıktısı (dosya yolları vb.) basılmasın.
const load = async <T>(id: string) => (await runnerImport<T>(id, { logLevel: "silent" })).module;
const check = await load<CheckModule>("/src/banks/check.ts");
const registry = await load<RegistryModule>("/src/banks/registry.ts");
const glyphMod = await load<GlyphModule>("/src/pdf/glyphs.ts");
let candidates = registry.parsers;
if (tablePath) {
  const tableMod = await load<TableModule>("/src/pdf/glyphTable.ts");
  let text: string;
  try {
    text = await readFile(tablePath, "utf8");
  } catch (err) {
    fail(
      (err as NodeJS.ErrnoException).code === "ENOENT"
        ? "--table ile verilen glif tablosu bulunamadı. Önce `npm run dev` → #debug → Etiketleme modu → " +
            "\"glyphs.json indir\" ile tabloyu private/glyphs.json olarak kaydedin."
        : "--table ile verilen glif tablosu okunamadı.",
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    fail("glif tablosu geçerli bir JSON değil.");
  }
  let table: Map<string, string>;
  try {
    table = tableMod.glyphTableFromData(data);
  } catch (err) {
    // GlyphTableError mesajları içerik taşımaz (yalnızca biçim/sürüm bilgisi).
    fail(`glif tablosu geçersiz: ${err instanceof Error && err.name === "GlyphTableError" ? err.message : "biçim tanınmadı."}`);
  }
  console.log(`Taslak tablo: ${table.size} glif`);
  candidates = check.withGlyphTable(candidates, "akbank", table);
}

async function readRaw(path: string) {
  const data = new Uint8Array(await readFile(path));
  const task = getDocument({ data, fontExtraProperties: true, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  const pages = [];
  const glyphs = [];
  const cache = new Map<string, string>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => "str" in it)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, height: it.height }));
    pages.push({ pageNumber: n, width: viewport.width, height: viewport.height, items });
    glyphs.push(await glyphMod.extractPageGlyphs(page, OPS, cache));
  }
  await task.destroy();
  return { pages, glyphs };
}

const pct = (part: number, whole: number) => (whole === 0 ? "-" : `%${((100 * part) / whole).toFixed(1)}`);
const counts = (rec: Record<string, number>) =>
  Object.keys(rec).length === 0 ? "yok" : Object.entries(rec).map(([k, v]) => `${k}=${v}`).join(", ");

let n = 0;
for (const file of files) {
  n++;
  let raw;
  try {
    raw = await readRaw(file);
  } catch {
    console.log(`Ekstre ${n}: PDF okunamadı`);
    continue;
  }
  const r = check.checkStatement(raw, candidates);
  console.log(`Ekstre ${n}:`);
  console.log(`  sayfa: ${r.pages}`);
  console.log(
    `  Type3 glif: ${r.type3Glyphs}, çözülemeyen: ${r.unknownGlyphs} (çözülen ${pct(r.type3Glyphs - r.unknownGlyphs, r.type3Glyphs)})`,
  );
  console.log(`  banka: ${r.bank ?? "tanınmadı"}${r.error ? `, hata: ${r.error}` : ""}`);
  if (!r.bank) continue;
  console.log(`  işlem: ${r.transactions} (${counts(r.kinds)}), taksitli: ${r.installments}, dövizli: ${r.foreign}`);
  console.log(`  uyarı: ${counts(r.warnings)}`);
  console.log(`  dönem bulundu: ${r.periodFound ? "evet" : "hayır"}`);
  console.log(`  toplam dönem borcuyla tutuyor: ${r.totalMatches}`);
}

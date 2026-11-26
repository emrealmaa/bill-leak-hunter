/**
 * Derlenmiş dosyalardaki (dist/) http:// ve https:// adreslerini listeler.
 * "Ağ isteği yok" denetimi için: her adresin neden orada olduğu açıklanmalı
 * (kullanıcının tıklayacağı bağlantı, kütüphane içi sabit/yorum vb.).
 *
 *   npm run build && npm run scan-urls
 *
 * Bilinen ve açıklanmış adresler ALLOWED listesindedir; listede olmayan bir
 * adres çıkarsa script hata koduyla biter.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const URL_RE = /https?:\/\/[^\s"'`)<>\\]+/g;

/**
 * Açıklanmış adres önekleri. Bunlar uygulama tarafından kendiliğinden
 * İSTENMEZ: ya kullanıcının tıklayacağı bağlantılardır ya da kütüphanelerin
 * hata mesajı / XML ad alanı gibi sabit metinleridir.
 */
const ALLOWED: [prefix: string, reason: string][] = [
  ["https://github.com/emrealmaa/bill-leak-hunter", "kaynak kod ve katkı bağlantısı (tıklanırsa açılır)"],
  ["https://www.netflix.com/", "katalog: resmi iptal sayfası (tıklanırsa açılır)"],
  ["https://www.youtube.com/", "katalog: resmi iptal sayfası (tıklanırsa açılır)"],
  ["https://account.microsoft.com/", "katalog: resmi hesap sayfası (tıklanırsa açılır)"],
  ["https://account.adobe.com/", "katalog: resmi hesap sayfası (tıklanırsa açılır)"],
  ["https://github.com/settings/billing", "katalog: resmi faturalama sayfası (tıklanırsa açılır)"],
  ["https://json-schema.org/", "katalog şemasının $schema alanı (sabit metin)"],
  ["https://react.dev/", "React hata mesajlarındaki dokümantasyon bağlantısı (sabit metin)"],
  ["http://www.w3.org/", "XML/SVG ad alanı sabitleri (istek değil)"],
  ["https://github.com/mozilla/pdf.js", "pdf.js hata mesajı / yorum (sabit metin)"],
  ["https://bugzilla.mozilla.org/", "pdf.js yorumu (sabit metin)"],
  ["http://ns.adobe.com/", "pdf.js XMP ad alanı sabiti (istek değil)"],
  ["http://purl.org/", "pdf.js XMP ad alanı sabiti (istek değil)"],
  ["http://www.xfa.org/schema/", "pdf.js XFA form ad alanı sabitleri (istek değil)"],
  ["http://www.apache.org/licenses/", "pdf.js lisans yorumu (sabit metin)"],
  ["https://tailwindcss.com", "Tailwind CSS banner yorumu (sabit metin)"],
  ["http://example.com", "pdf.js: göreli adresi ayrıştırmak için taban adres (new URL(x, taban); istek değil)"],
  ["https://foo.bar", "pdf.js: göreli adresi ayrıştırmak için taban adres (new URL(x, taban); istek değil)"],
  ["http://${e}", "pdf.js: PDF içindeki bağlantıya protokol ekleme şablonu (istek değil)"],
];

async function files(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (/\.(js|mjs|css|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

let list: string[];
try {
  list = await files(dist);
} catch {
  console.error("dist/ bulunamadı; önce npm run build çalıştırın.");
  process.exit(1);
}

const found = new Map<string, Set<string>>();
for (const f of list) {
  const text = await readFile(f, "utf8");
  for (const m of text.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,;]+$/, "");
    const set = found.get(url) ?? new Set<string>();
    set.add(relative(root, f).replaceAll("\\", "/"));
    found.set(url, set);
  }
}

let unknown = 0;
for (const [url, where] of [...found].sort(([a], [b]) => a.localeCompare(b))) {
  const reason = ALLOWED.find(([p]) => url.startsWith(p))?.[1];
  if (!reason) unknown++;
  console.log(`${reason ? "  " : "? "}${url}  [${[...where].join(", ")}]${reason ? `  — ${reason}` : "  — AÇIKLANMADI"}`);
}
console.log(`${found.size} farklı adres, ${unknown} açıklanmamış.`);
if (unknown > 0) process.exitCode = 1;

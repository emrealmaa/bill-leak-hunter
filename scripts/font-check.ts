/**
 * Teşhis script'i: iki PDF'teki fontları, karakter kodlarını ve Type3 glif
 * şekillerini karşılaştırır.
 *
 *   node scripts/font-check.ts <a.pdf> <b.pdf>               # 1. sayfa, ayrıntılı
 *   node scripts/font-check.ts --all-pages <a.pdf> <b.pdf>   # tüm sayfalar, şekil sayımı
 *
 * GİZLİLİK (PROJE.md §10): Çıktıda hiçbir metin içeriği, Unicode karakteri,
 * ham kod değeri, hash veya dosya adı yazdırılmaz. Yalnızca sayılar, font
 * adları ve evet/hayır sonuçları yazılır. Bozuk metin de çözülebilir olduğu
 * için kişisel veri sayılır.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const POS_TOLERANCE = 1;
const SUBSET_PREFIX = /^[A-Z]{6}\+/;
const OPS_NAME = new Map<number, string>(Object.entries(OPS).map(([k, v]) => [v as number, k]));
const PAINT_OPS = new Set([
  "fill", "eoFill", "stroke", "fillStroke", "eoFillStroke", "closeStroke", "closeFillStroke",
  "closeEOFillStroke", "constructPath", "paintImageMaskXObject", "paintImageXObject",
  "paintInlineImageXObject", "paintImageMaskXObjectGroup", "paintSolidColorImageMask", "shadingFill",
]);

// pdf.js'in iç nesneleri (fontExtraProperties ile gelen alanlar) için gevşek tipler.
interface CharProcOps {
  fnArray: number[];
  argsArray: unknown[];
}
interface FontObj {
  name?: string;
  type?: string;
  subtype?: string;
  composite?: boolean;
  charProcOperatorList?: Map<string, CharProcOps>;
}
interface RawGlyph {
  originalCharCode: number;
  unicode: string;
  width: number;
  operatorListId: string;
}
interface Glyph {
  font: string;
  fontIdx: number;
  code: number;
  unicode: string;
  width: number;
  shape: string | null;
}
interface Item {
  str: string;
  x: number;
  y: number;
}
interface FontInfo {
  name: string;
  base: string;
  type: string;
  subtype: string;
  composite: string;
}
interface Analysis {
  items: Item[];
  glyphs: Glyph[];
  fonts: Map<string, FontInfo>;
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function load(path: string) {
  let buf: Buffer;
  try {
    buf = await readFile(path);
  } catch {
    fail("Dosya okunamadı.");
  }
  return getDocument({
    data: new Uint8Array(buf),
    fontExtraProperties: true, // glif başına ham kod + font tipi + Type3 çizimleri için
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
}

function shapeHash(ops: CharProcOps): string {
  const names = Array.from(ops.fnArray, (f) => OPS_NAME.get(f) ?? String(f));
  const json = JSON.stringify({ f: names, a: ops.argsArray }, (_k, v) =>
    ArrayBuffer.isView(v) ? Array.from(v as unknown as ArrayLike<number>) : v,
  );
  return createHash("sha1").update(json).digest("hex");
}

/** Operatör listesindeki showText gliflerini, o anki fontla birlikte gezer. */
function forEachGlyph(
  opList: { fnArray: number[]; argsArray: unknown[][] },
  cb: (font: string, g: RawGlyph) => void,
) {
  let font = "";
  const stack: string[] = [];
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === OPS.save) stack.push(font);
    else if (fn === OPS.restore) font = stack.pop() ?? font;
    else if (fn === OPS.setFont) font = args[0] as string;
    else if (fn === OPS.showText) {
      for (const g of args[0] as unknown[]) {
        if (g && typeof g === "object" && "unicode" in g) cb(font, g as RawGlyph);
      }
    }
  }
}

async function analyzeFirstPage(path: string): Promise<Analysis> {
  const task = await load(path);
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);

    const text = await page.getTextContent();
    const items: Item[] = [];
    const itemFonts = new Set<string>();
    for (const it of text.items) {
      if (!("str" in it)) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
      itemFonts.add(it.fontName);
    }

    const opList = await page.getOperatorList();
    const raw: { font: string; g: RawGlyph }[] = [];
    forEachGlyph(opList, (font, g) => raw.push({ font, g }));

    const loadedNames = [...new Set([...raw.map((r) => r.font), ...itemFonts])].filter(Boolean).sort();
    const fontIdx = new Map(loadedNames.map((ln, i) => [ln, i]));
    const fontObjs = new Map<string, FontObj | null>();
    const fonts = new Map<string, FontInfo>();
    for (const ln of loadedNames) {
      let f: FontObj | null = null;
      try {
        f = page.commonObjs.get(ln) as FontObj;
      } catch {
        // font nesnesi yoksa bilinmiyor
      }
      fontObjs.set(ln, f);
      const name = f?.name ?? "(bilinmiyor)";
      fonts.set(ln, {
        name,
        base: name.replace(SUBSET_PREFIX, ""),
        type: f?.type ?? "?",
        subtype: f?.subtype ?? "-",
        composite: String(f?.composite ?? "?"),
      });
    }

    const glyphs: Glyph[] = raw.map(({ font, g }) => {
      const ops = fontObjs.get(font)?.charProcOperatorList?.get(g.operatorListId);
      return {
        font,
        fontIdx: fontIdx.get(font) ?? -1,
        code: g.originalCharCode,
        unicode: g.unicode,
        width: g.width,
        shape: ops ? shapeHash(ops) : null,
      };
    });

    return { items, glyphs, fonts };
  } catch {
    fail("PDF işlenemedi (şifreli ya da bozuk olabilir).");
  } finally {
    await task.destroy();
  }
}

async function allPageShapes(path: string) {
  const task = await load(path);
  try {
    const doc = await task.promise;
    const shapes = new Set<string>();
    const blankShapes = new Set<string>();
    const opUse = new Map<string, number>(); // charProc komut adı -> kaç farklı şekilde geçiyor
    let glyphCount = 0;
    let blankGlyphs = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const opList = await page.getOperatorList();
      forEachGlyph(opList, (font, g) => {
        glyphCount++;
        const f = page.commonObjs.get(font) as FontObj | undefined;
        const ops = f?.charProcOperatorList?.get(g.operatorListId);
        if (!ops) return;
        const names = Array.from(ops.fnArray, (x) => OPS_NAME.get(x) ?? String(x));
        const h = shapeHash(ops);
        if (!names.some((nm) => PAINT_OPS.has(nm))) {
          blankGlyphs++;
          blankShapes.add(h);
        }
        if (!shapes.has(h)) {
          shapes.add(h);
          for (const nm of new Set(names)) opUse.set(nm, (opUse.get(nm) ?? 0) + 1);
        }
      });
      page.cleanup();
    }
    return { pages: doc.numPages, shapes, blankShapes, opUse, glyphCount, blankGlyphs };
  } catch {
    fail("PDF işlenemedi (şifreli ya da bozuk olabilir).");
  } finally {
    await task.destroy();
  }
}

// --- Yardımcılar ---

const yesNo = (b: boolean) => (b ? "evet" : "hayır");
const setKey = (s: Set<unknown>) => [...s].map(String).sort().join("\u0000");

function addTo<K, V>(m: Map<K, Set<V>>, k: K, v: V) {
  let s = m.get(k);
  if (!s) m.set(k, (s = new Set()));
  s.add(v);
}

function matchByPosition(aItems: Item[], bItems: Item[]) {
  const used = new Set<number>();
  let same = 0;
  let diff = 0;
  for (const a of aItems) {
    let best = -1;
    let bestDist = Infinity;
    for (let j = 0; j < bItems.length; j++) {
      if (used.has(j)) continue;
      const dx = Math.abs(a.x - bItems[j].x);
      const dy = Math.abs(a.y - bItems[j].y);
      if (dx <= POS_TOLERANCE && dy <= POS_TOLERANCE && dx + dy < bestDist) {
        best = j;
        bestDist = dx + dy;
      }
    }
    if (best >= 0) {
      used.add(best);
      if (a.str === bItems[best].str) same++;
      else diff++;
    }
  }
  return { matched: same + diff, same, diff, unmatchedA: aItems.length - same - diff, unmatchedB: bItems.length - used.size };
}

interface FontMaps {
  codeToUni: Map<number, Set<string>>;
  uniToCode: Map<string, Set<number>>;
  codeToWidth: Map<number, Set<number>>;
  glyphCount: number;
}

// Type3 fontların adı olmadığından anahtar, fontun belge içindeki sırasıdır.
function buildMaps(r: Analysis) {
  const byFont = new Map<string, FontMaps>();
  for (const g of r.glyphs) {
    const key = `font #${g.fontIdx}`;
    let m = byFont.get(key);
    if (!m) byFont.set(key, (m = { codeToUni: new Map(), uniToCode: new Map(), codeToWidth: new Map(), glyphCount: 0 }));
    m.glyphCount++;
    addTo(m.codeToUni, g.code, g.unicode);
    addTo(m.uniToCode, g.unicode, g.code);
    addTo(m.codeToWidth, g.code, g.width);
  }
  return byFont;
}

// Unicode çıktısının kaba sınıflandırması (yalnızca sayılar).
function classify(unicodes: Iterable<string>) {
  const c = { bos: 0, kontrol: 0, ozelAlan: 0, asciiHarfRakam: 0, turkceHarf: 0, noktalamaBosluk: 0, diger: 0 };
  for (const u of unicodes) {
    if (!u) {
      c.bos++;
      continue;
    }
    for (const ch of u) {
      const cp = ch.codePointAt(0)!;
      if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) c.kontrol++;
      else if (cp >= 0xe000 && cp <= 0xf8ff) c.ozelAlan++;
      else if (/[A-Za-z0-9]/.test(ch)) c.asciiHarfRakam++;
      else if (/[çğıöşüÇĞİÖŞÜ]/.test(ch)) c.turkceHarf++;
      else if (/[\s.,:;\-/()%*+'"!?&]/.test(ch)) c.noktalamaBosluk++;
      else c.diger++;
    }
  }
  return c;
}

function shapeMaps(r: Analysis) {
  const keyToShape = new Map<string, Set<string>>(); // "font#kod" -> şekiller
  const shapeToKey = new Map<string, Set<string>>();
  const shapeToCode = new Map<string, Set<number>>();
  let missing = 0;
  for (const g of r.glyphs) {
    if (!g.shape) {
      missing++;
      continue;
    }
    const key = `${g.fontIdx}#${g.code}`;
    addTo(keyToShape, key, g.shape);
    addTo(shapeToKey, g.shape, key);
    addTo(shapeToCode, g.shape, g.code);
  }
  return { keyToShape, shapeToKey, shapeToCode, missing };
}

// --- Ana akış ---

const args = process.argv.slice(2);
const allPages = args.includes("--all-pages");
const [pathA, pathB] = args.filter((a) => a !== "--all-pages");
if (!pathA || !pathB) fail("Kullanım: node scripts/font-check.ts [--all-pages] <a.pdf> <b.pdf>");

if (allPages) {
  const RA = await allPageShapes(pathA);
  const RB = await allPageShapes(pathB);
  const union = new Set([...RA.shapes, ...RB.shapes]);
  const common = [...RA.shapes].filter((h) => RB.shapes.has(h)).length;
  console.log("=== Tüm sayfalar: farklı şekil sayısı ===");
  for (const [l, r] of [["A", RA], ["B", RB]] as const) {
    console.log(`PDF ${l}: ${r.pages} sayfa, ${r.glyphCount} glif, ${r.shapes.size} farklı şekil (boş çizimli: ${r.blankShapes.size} şekil / ${r.blankGlyphs} glif)`);
  }
  console.log(`A ∪ B: ${union.size} farklı şekil · ortak: ${common} · yalnız A: ${RA.shapes.size - common} · yalnız B: ${RB.shapes.size - common}`);
  const ops = new Map<string, number>();
  for (const r of [RA, RB]) for (const [k, v] of r.opUse) ops.set(k, (ops.get(k) ?? 0) + v);
  console.log(`charProc içinde geçen komutlar (adı: kaç şekilde): ${[...ops].map(([k, v]) => `${k}:${v}`).join(", ")}`);
  process.exit(0);
}

const A = await analyzeFirstPage(pathA);
const B = await analyzeFirstPage(pathB);

console.log("=== 1) Parça sayıları (sayfa 1) ===");
console.log(`PDF A: ${A.items.length} metin parçası, ${A.glyphs.length} glif`);
console.log(`PDF B: ${B.items.length} metin parçası, ${B.glyphs.length} glif`);

console.log(`\n=== 2) Konuma göre eşleşme (±${POS_TOLERANCE} birim) ===`);
const m = matchByPosition(A.items, B.items);
console.log(`Eşleşen parça: ${m.matched}`);
console.log(`  metni birebir aynı: ${m.same}`);
console.log(`  metni farklı:       ${m.diff}`);
console.log(`Eşleşmeyen: A'da ${m.unmatchedA}, B'de ${m.unmatchedB}`);

console.log("\n=== 3) Fontlar ===");
for (const [label, r] of [["A", A], ["B", B]] as const) {
  console.log(`PDF ${label}:`);
  for (const f of r.fonts.values()) {
    console.log(`  ${f.name}  tip=${f.type} alt=${f.subtype} composite=${f.composite}`);
  }
}
const names = (r: Analysis) => new Set([...r.fonts.values()].map((f) => f.name));
const bases = (r: Analysis) => new Set([...r.fonts.values()].map((f) => f.base));
console.log(`Font adları subset öneki DAHİL aynı mı: ${yesNo(setKey(names(A)) === setKey(names(B)))}`);
console.log(`Font adları subset öneki HARİÇ aynı mı: ${yesNo(setKey(bases(A)) === setKey(bases(B)))}`);

const mapsA = buildMaps(A);
const mapsB = buildMaps(B);

console.log("\n=== 4) Font başına farklı ham kod sayısı ===");
for (const [label, maps] of [["A", mapsA], ["B", mapsB]] as const) {
  for (const [key, mm] of maps) {
    console.log(`PDF ${label}  ${key}: ${mm.codeToUni.size} farklı kod, ${mm.uniToCode.size} farklı Unicode, ${mm.glyphCount} glif`);
  }
}

console.log("\n=== 5) Kod ↔ Unicode tutarlılığı (font bazında) ===");
for (const [label, maps] of [["A", mapsA], ["B", mapsB]] as const) {
  for (const [key, mm] of maps) {
    const multiUni = [...mm.codeToUni.values()].filter((s) => s.size > 1).length;
    const multiCode = [...mm.uniToCode.values()].filter((s) => s.size > 1).length;
    const identity = [...mm.codeToUni].filter(([code, s]) => s.size === 1 && [...s][0] === String.fromCharCode(code)).length;
    console.log(`PDF ${label}  ${key}:`);
    console.log(`  aynı PDF içinde birden çok Unicode'a giden kod: ${multiUni}`);
    console.log(`  aynı PDF içinde birden çok koda giden Unicode: ${multiCode}`);
    console.log(`  Unicode'u ham kodun kendisi olan kod: ${identity} / ${mm.codeToUni.size}`);
    console.log(`  farklı Unicode değerlerinin sınıfı: ${JSON.stringify(classify(mm.uniToCode.keys()))}`);
  }
}

for (const key of [...mapsA.keys()].filter((k) => mapsB.has(k))) {
  const a = mapsA.get(key)!;
  const b = mapsB.get(key)!;
  const commonCodes = [...a.codeToUni.keys()].filter((c) => b.codeToUni.has(c));
  const codeDiffUni = commonCodes.filter((c) => setKey(a.codeToUni.get(c)!) !== setKey(b.codeToUni.get(c)!)).length;
  const codeDiffWidth = commonCodes.filter((c) => setKey(a.codeToWidth.get(c)!) !== setKey(b.codeToWidth.get(c)!)).length;
  const commonUnis = [...a.uniToCode.keys()].filter((u) => b.uniToCode.has(u));
  const uniDiffCode = commonUnis.filter((u) => setKey(a.uniToCode.get(u)!) !== setKey(b.uniToCode.get(u)!)).length;
  console.log(`\nA ↔ B  ${key}:`);
  console.log(`  ortak ham kod: ${commonCodes.length} (yalnız A: ${a.codeToUni.size - commonCodes.length}, yalnız B: ${b.codeToUni.size - commonCodes.length})`);
  console.log(`  aynı ham kod iki ayda FARKLI Unicode'a gidiyor: ${codeDiffUni}`);
  console.log(`  aynı ham kod iki ayda FARKLI glif genişliğinde: ${codeDiffWidth}`);
  console.log(`  ortak Unicode: ${commonUnis.length}`);
  console.log(`  aynı Unicode iki ayda FARKLI ham koda gidiyor: ${uniDiffCode}`);
}

console.log("\n=== 6) Glif ŞEKLİ tutarlılığı (Type3 çizim komutlarının parmak izi) ===");
const sA = shapeMaps(A);
const sB = shapeMaps(B);
for (const [label, s] of [["A", sA], ["B", sB]] as const) {
  const multiShape = [...s.keyToShape.values()].filter((x) => x.size > 1).length;
  const multiCode = [...s.shapeToCode.values()].filter((x) => x.size > 1).length;
  console.log(`PDF ${label}: ${s.shapeToKey.size} farklı şekil, şekli okunamayan glif: ${s.missing}`);
  console.log(`  aynı font+kod birden çok şekil çiziyor: ${multiShape}`);
  console.log(`  aynı şekil birden çok ham kodla çiziliyor (fontlar arası): ${multiCode}`);
}
const commonKeys = [...sA.keyToShape.keys()].filter((k) => sB.keyToShape.has(k));
const diffKeys = commonKeys.filter((k) => setKey(sA.keyToShape.get(k)!) !== setKey(sB.keyToShape.get(k)!));
const commonShapes = [...sA.shapeToCode.keys()].filter((h) => sB.shapeToCode.has(h));
const diffShapes = commonShapes.filter((h) => setKey(sA.shapeToCode.get(h)!) !== setKey(sB.shapeToCode.get(h)!));

const countByFont = (keys: string[]) => {
  const c = new Map<string, number>();
  for (const k of keys) c.set(`font #${k.split("#")[0]}`, (c.get(`font #${k.split("#")[0]}`) ?? 0) + 1);
  return [...c].map(([f, n]) => `${f}=${n}`).join(", ") || "-";
};
console.log(`A ↔ B: ortak font+kod çifti: ${commonKeys.length}`);
console.log(`  aynı font+kod iki ayda FARKLI şekil çiziyor: ${diffKeys.length}`);
console.log(`  font bazında dağılım: ${countByFont(diffKeys)}`);
console.log(`A ↔ B: ortak şekil: ${commonShapes.length} (yalnız A: ${sA.shapeToCode.size - commonShapes.length}, yalnız B: ${sB.shapeToCode.size - commonShapes.length})`);
console.log(`  aynı şekil iki ayda FARKLI ham koda gidiyor: ${diffShapes.length}`);
console.log(`  font bazında dağılım (A'daki fonta göre): ${countByFont(diffShapes.flatMap((h) => [...sA.shapeToKey.get(h)!]))}`);

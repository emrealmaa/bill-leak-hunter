/**
 * Type3 glifleri için kararlı şekil hash'i ve glif konumları.
 *
 * Bazı banka ekstrelerinde (ör. Akbank Axess) fontlar Type3'tür ve harflerin
 * Unicode karşılığı PDF'te yazılı değildir. Her glif, PDF içinde küçük bir
 * çizim (charProc) olarak tanımlıdır. Aynı çizim her ay aynıdır; ham karakter
 * kodu ise değişebilir. Bu yüzden glifi çizim komutlarından üretilen bir hash
 * ile tanırız ve elle hazırlanan bir tabloyla (hash → karakter) çözeriz.
 *
 * Bu modül pdf.js'i içe aktarmaz: pdf.js'in komut numaraları (OPS) parametre
 * olarak verilir. Böylece tarayıcıda, Node'da ve testlerde aynı kod çalışır.
 */

/** Hash algoritması değişirse artırılır; eski tablolar geçersiz olur. */
export const GLYPH_HASH_VERSION = 1;

/** pdf.js operatör listesi (sayfa ya da Type3 charProc). */
export interface OperatorList {
  fnArray: ArrayLike<number>;
  argsArray: ArrayLike<unknown>;
}

/** pdf.js OPS nesnesi: komut adı → numara. */
export type OpsTable = Readonly<Record<string, number>>;

const DECIMALS = 1000; // sayılar 3 ondalığa yuvarlanır

function normalize(value: unknown): unknown {
  if (typeof value === "number") {
    const r = Math.round(value * DECIMALS) / DECIMALS;
    return Object.is(r, -0) ? 0 : r;
  }
  if (value === null || value === undefined) return null;
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>, normalize);
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, normalize(obj[k])]),
    );
  }
  return value;
}

/**
 * charProc çizim komutlarının kanonik metni. Komutlar pdf.js numarasıyla değil
 * ADIYLA yazılır (numaralar sürümden sürüme değişebilir). constructPath'in ilk
 * argümanı da bir komut numarası olduğundan o da ada çevrilir.
 */
export function canonicalCharProc(ops: OperatorList, opsTable: OpsTable): string {
  const names = new Map<number, string>(Object.entries(opsTable).map(([k, v]) => [v, k]));
  const nameOf = (fn: number) => names.get(fn) ?? `op${fn}`;
  const out: unknown[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const name = nameOf(ops.fnArray[i]);
    let args = (ops.argsArray[i] as unknown[] | null) ?? [];
    if (name === "constructPath" && typeof args[0] === "number") {
      args = [nameOf(args[0]), ...args.slice(1)];
    }
    out.push([name, normalize(args)]);
  }
  return JSON.stringify(out);
}

/** Şekil hash'i: kanonik metnin SHA-256'sının ilk 16 hex karakteri. */
export async function hashCharProc(ops: OperatorList, opsTable: OpsTable): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalCharProc(ops, opsTable));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Glif konumları ---

/** Kullanıcı uzayında (PDF birimi, y yukarı doğru) konumlanmış bir glif. */
export interface PositionedGlyph {
  /** Type3 şekil hash'i; Type3 olmayan ya da çizimi bulunamayan glif için null. */
  hash: string | null;
  /** pdf.js'in verdiği Unicode (Type3'te genellikle anlamsızdır). */
  unicode: string;
  x: number;
  y: number;
  /** Bir sonraki glife kadar yatay ilerleme (kullanıcı uzayında). */
  advance: number;
  /**
   * Etkin yazı boyutu (kullanıcı uzayında). Type3 fontlarda fontun TİPİK GLİF
   * YÜKSEKLİĞİDİR (glif sınırlarının medyanı); normal fontlarda em boyutudur.
   * Boşluk ve sütun eşikleri bu değere oranla hesaplanır.
   */
  fontSize: number;
  /** Etkin boyutun nereden geldiği (bkz. resolveGlyphSizes). */
  sizeSource: SizeSource;
  /** Glifin çizim sınırları (kullanıcı uzayında, y yukarı). */
  box: Box;
}

/**
 * "font": fontun kendi glif yükseklikleri · "line": aynı satırdaki en yakın glif
 * "page": sayfadaki güvenilir boyutların medyanı · "bbox": FontBBox (son çare)
 */
export type SizeSource = "font" | "line" | "page" | "bbox";

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Glif hakkında pdf.js'in showText argümanında verdiği alanlar. */
export interface ShowTextGlyph {
  width: number;
  unicode: string;
  isSpace?: boolean;
  operatorListId?: string;
}

export interface FontInfo {
  fontMatrix?: ArrayLike<number>;
  /** Type3: glif uzayındaki sınırlar [llx, lly, urx, ury] (setCharWidthAndBounds). */
  glyphBounds?: (operatorListId: string) => ArrayLike<number> | undefined;
  /**
   * Glif uzayında tipik glif yüksekliği. Verilmezse 1 / fontMatrix[3]
   * (normal fontlarda em) kullanılır.
   */
  emHeight?: number;
  /**
   * true ise emHeight güvenilir değildir (fontta çok az glif var); boyut
   * resolveGlyphSizes ile komşu gliflerden alınır.
   */
  emHeightUnreliable?: boolean;
}

/** Bir fontun tipik glif yüksekliği güvenilir sayılması için gereken en az glif sayısı. */
export const MIN_GLYPHS_FOR_SIZE = 5;

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const DEFAULT_FONT_MATRIX: Matrix = [0.001, 0, 0, 0.001, 0, 0];

/** outer(inner(p)) dönüşümünü veren matris. */
function concat(outer: Matrix, inner: Matrix): Matrix {
  const [a, b, c, d, e, f] = outer;
  const [A, B, C, D, E, F] = inner;
  return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
}

const apply = (m: Matrix, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];
const vectorLength = (m: Matrix, x: number, y: number) => Math.hypot(m[0] * x + m[2] * y, m[1] * x + m[3] * y);
const toMatrix = (v: ArrayLike<number>): Matrix => [v[0], v[1], v[2], v[3], v[4], v[5]];

interface TextState {
  ctm: Matrix;
  textMatrix: Matrix;
  x: number;
  y: number;
  lineX: number;
  lineY: number;
  charSpacing: number;
  wordSpacing: number;
  hScale: number;
  leading: number;
  rise: number;
  font: string | null;
  fontSize: number;
  fontDirection: number;
  fontMatrix: Matrix;
}

export interface LayoutOptions {
  ops: OpsTable;
  getFont: (name: string) => FontInfo | undefined;
  /** Bir glifin şekil hash'i (önceden hesaplanmış); yoksa null. */
  hashOf: (fontName: string, glyph: ShowTextGlyph) => string | null;
}

/**
 * Sayfa operatör listesindeki metin durumunu izleyerek her glifin konumunu
 * hesaplar. pdf.js'in canvas çiziciyle (CanvasGraphics.showType3Text) aynı
 * kuralları izler; yalnızca yatay metin desteklenir.
 */
export function layoutGlyphs(opList: OperatorList, { ops, getFont, hashOf }: LayoutOptions): PositionedGlyph[] {
  let s: TextState = {
    ctm: IDENTITY,
    textMatrix: IDENTITY,
    x: 0,
    y: 0,
    lineX: 0,
    lineY: 0,
    charSpacing: 0,
    wordSpacing: 0,
    hScale: 1,
    leading: 0,
    rise: 0,
    font: null,
    fontSize: 0,
    fontDirection: 1,
    fontMatrix: DEFAULT_FONT_MATRIX,
  };
  const stack: TextState[] = [];
  const out: PositionedGlyph[] = [];

  const moveText = (x: number, y: number) => {
    s.lineX += x;
    s.lineY += y;
    s.x = s.lineX;
    s.y = s.lineY;
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = (opList.argsArray[i] as unknown[] | null) ?? [];

    switch (fn) {
      case ops.save:
        stack.push({ ...s });
        break;
      case ops.restore:
        s = stack.pop() ?? s;
        break;
      case ops.transform:
        s.ctm = concat(s.ctm, toMatrix(args as number[]));
        break;
      case ops.paintFormXObjectBegin:
        stack.push({ ...s });
        if (Array.isArray(args[0]) || ArrayBuffer.isView(args[0])) {
          s.ctm = concat(s.ctm, toMatrix(args[0] as ArrayLike<number>));
        }
        break;
      case ops.paintFormXObjectEnd:
        s = stack.pop() ?? s;
        break;
      case ops.beginText:
        s.textMatrix = IDENTITY;
        s.x = s.lineX = 0;
        s.y = s.lineY = 0;
        break;
      case ops.setTextMatrix:
        s.textMatrix = toMatrix(args[0] as ArrayLike<number>);
        s.x = s.lineX = 0;
        s.y = s.lineY = 0;
        break;
      case ops.moveText:
        moveText(args[0] as number, args[1] as number);
        break;
      case ops.setLeadingMoveText:
        s.leading = args[1] as number;
        moveText(args[0] as number, args[1] as number);
        break;
      case ops.nextLine:
        moveText(0, s.leading);
        break;
      case ops.setLeading:
        s.leading = -(args[0] as number);
        break;
      case ops.setCharSpacing:
        s.charSpacing = args[0] as number;
        break;
      case ops.setWordSpacing:
        s.wordSpacing = args[0] as number;
        break;
      case ops.setHScale:
        s.hScale = (args[0] as number) / 100;
        break;
      case ops.setTextRise:
        s.rise = args[0] as number;
        break;
      case ops.setFont: {
        const name = args[0] as string;
        let size = args[1] as number;
        s.fontDirection = size < 0 ? -1 : 1;
        if (size < 0) size = -size;
        s.font = name;
        s.fontSize = size;
        const fm = getFont(name)?.fontMatrix;
        s.fontMatrix = fm ? toMatrix(fm) : DEFAULT_FONT_MATRIX;
        break;
      }
      case ops.showText: {
        if (!s.font || s.fontSize === 0) break;
        const glyphs = (args[0] as unknown[]) ?? [];
        const hScale = s.hScale * s.fontDirection;
        const fm = s.fontMatrix;
        const info = getFont(s.font);
        // Metin uzayından kullanıcı uzayına: ctm × textMatrix
        const toUser = concat(s.ctm, s.textMatrix);
        // Glif uzayındaki tipik yükseklik → kullanıcı uzayındaki etkin boyut
        const emGlyph = info?.emHeight ?? 1 / (Math.abs(fm[3]) || 1);
        const sizeInUser = vectorLength(toUser, 0, s.fontSize * Math.abs(fm[3]) * emGlyph);
        const sizeSource: SizeSource = info?.emHeightUnreliable ? "bbox" : "font";
        for (const g of glyphs) {
          if (typeof g === "number") {
            s.x += ((-g * s.fontSize) / 1000) * hScale;
            continue;
          }
          const glyph = g as ShowTextGlyph;
          const spacing = (glyph.isSpace ? s.wordSpacing : 0) + s.charSpacing;
          const width = glyph.width * fm[0] * s.fontSize + spacing * s.fontDirection;
          const [ux, uy] = apply(toUser, s.x, s.y + s.rise);

          // Glif sınırları: glif uzayı → fontMatrix → fontSize/hScale → metin konumu → kullanıcı uzayı
          // (pdf.js showType3Text ile aynı sıra)
          const b =
            (glyph.operatorListId !== undefined ? info?.glyphBounds?.(glyph.operatorListId) : undefined) ??
            [0, -0.25 * emGlyph, glyph.width, 0.95 * emGlyph];
          const corners = [
            [b[0], b[1]],
            [b[2], b[1]],
            [b[0], b[3]],
            [b[2], b[3]],
          ].map(([gx, gy]) => {
            const [tx, ty] = apply(fm, gx, gy);
            return apply(toUser, s.x + tx * s.fontSize * hScale, s.y + s.rise + ty * s.fontSize * s.fontDirection);
          });
          const xs = corners.map((c) => c[0]);
          const ys = corners.map((c) => c[1]);

          out.push({
            hash: hashOf(s.font, glyph),
            unicode: glyph.unicode,
            x: ux,
            y: uy,
            advance: vectorLength(toUser, width * hScale, 0),
            fontSize: sizeInUser,
            sizeSource,
            box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
          });
          s.x += width * hScale;
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Az glifli fontlarda (ör. yalnızca nokta ya da tire çizen) glif yükseklik
 * medyanı anlamsız derecede küçük çıkar ve eşikleri bozar. FontBBox da çözüm
 * değildir: subset Type3 fontlarda FontBBox yalnızca kullanılan gliflerin
 * birleşimidir, yani o da küçüktür. Bu yüzden böyle gliflerin boyutu:
 *   1) aynı taban çizgisindeki en yakın güvenilir glifin boyutundan ("line"),
 *   2) yoksa sayfadaki güvenilir boyutların medyanından ("page") alınır,
 *   3) o da yoksa FontBBox'tan gelen geçici değer kalır ("bbox").
 */
export function resolveGlyphSizes(glyphs: PositionedGlyph[]): PositionedGlyph[] {
  const reliable = glyphs.filter((g) => g.sizeSource === "font");
  if (reliable.length === 0) return glyphs;
  const pageMedian = median(reliable.map((g) => g.fontSize));
  return glyphs.map((g) => {
    if (g.sizeSource === "font") return g;
    let best: PositionedGlyph | undefined;
    let bestDx = Infinity;
    for (const r of reliable) {
      if (Math.abs(r.y - g.y) > 0.3 * r.fontSize) continue; // aynı taban çizgisi değil
      const dx = Math.abs(r.x - g.x);
      if (dx < bestDx) {
        best = r;
        bestDx = dx;
      }
    }
    return best
      ? { ...g, fontSize: best.fontSize, sizeSource: "line" }
      : { ...g, fontSize: pageMedian, sizeSource: "page" };
  });
}

/**
 * Bir Type3 fontun glif sınırlarından tipik glif yüksekliğini çıkarır.
 * Yüksekliği sıfırdan büyük en az MIN_GLYPHS_FOR_SIZE glif varsa medyan
 * güvenilirdir; değilse FontBBox yüksekliği (yoksa en büyük glif) geçici
 * değer olarak verilir ve güvenilmez işaretlenir.
 */
export function type3EmHeight(
  heights: readonly number[],
  fontBBox?: ArrayLike<number>,
): { emHeight: number | undefined; unreliable: boolean } {
  const positive = heights.filter((h) => h > 0);
  if (positive.length >= MIN_GLYPHS_FOR_SIZE) return { emHeight: median(positive), unreliable: false };
  const bboxHeight = fontBBox ? fontBBox[3] - fontBBox[1] : 0;
  const fallback = bboxHeight > 0 ? bboxHeight : positive.length ? Math.max(...positive) : undefined;
  return { emHeight: fallback, unreliable: true };
}

/** Aynı glifin "aynı konumda" sayılması için en büyük x/y farkı (PDF birimi). */
export const DUPLICATE_TOLERANCE = 0.5;

/**
 * Aynı glifin aynı konuma tekrar çizildiği durumları (kalın yazı taklidi,
 * gölge vb.) tek glife indirir. Aynı glif: aynı şekil hash'i; hash yoksa aynı
 * Unicode. İlk çizilen tutulur. Yan yana duran aynı harfler (ör. "11")
 * etkilenmez, çünkü aralarında en az bir glif genişliği vardır.
 */
export function dedupeGlyphs(
  glyphs: readonly PositionedGlyph[],
  tolerance: number = DUPLICATE_TOLERANCE,
): PositionedGlyph[] {
  const kept = new Map<string, PositionedGlyph[]>();
  const out: PositionedGlyph[] = [];
  for (const g of glyphs) {
    const key = g.hash ?? `u:${g.unicode}`;
    const same = kept.get(key);
    if (same?.some((k) => Math.abs(k.x - g.x) <= tolerance && Math.abs(k.y - g.y) <= tolerance)) continue;
    if (same) same.push(g);
    else kept.set(key, [g]);
    out.push(g);
  }
  return out;
}

// --- pdf.js sayfasına bağlantı ---

/** pdf.js PDFPageProxy'nin burada kullanılan kısmı. */
export interface GlyphSourcePage {
  getOperatorList(): Promise<OperatorList>;
  commonObjs: { get(name: string): unknown };
}

interface Type3FontObject {
  fontMatrix?: ArrayLike<number>;
  bbox?: ArrayLike<number>;
  isType3Font?: boolean;
  charProcOperatorList?: Map<string, OperatorList>;
}

/**
 * Bir sayfanın gliflerini konum ve şekil hash'iyle çıkarır.
 * Belge `fontExtraProperties: true` ile açılmış olmalıdır.
 * `cache`, aynı belgenin sayfaları arasında hash'leri paylaşmak içindir.
 */
export async function extractPageGlyphs(
  page: GlyphSourcePage,
  ops: OpsTable,
  cache: Map<string, string> = new Map(),
): Promise<PositionedGlyph[]> {
  const opList = await page.getOperatorList();
  const fontNames = new Set<string>();
  for (let i = 0; i < opList.fnArray.length; i++) {
    if (opList.fnArray[i] === ops.setFont) fontNames.add((opList.argsArray[i] as [string])[0]);
  }

  const fonts = new Map<string, FontInfo>();
  for (const name of fontNames) {
    let font: Type3FontObject | undefined;
    try {
      font = page.commonObjs.get(name) as Type3FontObject;
    } catch {
      font = undefined;
    }
    if (!font?.isType3Font || !font.charProcOperatorList) {
      fonts.set(name, { fontMatrix: font?.fontMatrix });
      continue;
    }
    const bounds = new Map<string, ArrayLike<number>>();
    for (const [id, procOps] of font.charProcOperatorList) {
      const key = `${name}\u0000${id}`;
      if (!cache.has(key)) cache.set(key, await hashCharProc(procOps, ops));
      // setCharWidthAndBounds (d1): [wx, wy, llx, lly, urx, ury]
      const d1 = Array.from(procOps.fnArray).indexOf(ops.setCharWidthAndBounds);
      const a = d1 >= 0 ? (procOps.argsArray[d1] as ArrayLike<number>) : undefined;
      if (a) bounds.set(id, [a[2], a[3], a[4], a[5]]);
    }
    const { emHeight, unreliable } = type3EmHeight(
      [...bounds.values()].map((b) => b[3] - b[1]),
      font.bbox,
    );
    fonts.set(name, {
      fontMatrix: font.fontMatrix,
      glyphBounds: (id) => bounds.get(id),
      emHeight,
      emHeightUnreliable: unreliable,
    });
  }

  const glyphs = layoutGlyphs(opList, {
    ops,
    getFont: (name) => fonts.get(name),
    hashOf: (fontName, g) =>
      g.operatorListId !== undefined ? (cache.get(`${fontName}\u0000${g.operatorListId}`) ?? null) : null,
  });
  // Tekrar çizimleri at (hem etiketleme hem çözme bu listeyi kullanır).
  return resolveGlyphSizes(dedupeGlyphs(glyphs));
}

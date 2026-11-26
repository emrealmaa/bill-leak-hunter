// catalog/schema.json ile aynı kuralları uygulayan bağımlılıksız doğrulayıcı.
// Hem `npm run validate-catalog` script'i hem testler kullanır.
// NOT: Bu dosya hiçbir şey import etmez; böylece Node script'i onu doğrudan yükleyebilir.

export type CatalogKind = "merchants" | "fees" | "intermediaries";

export interface CatalogFile {
  path: string; // repo köküne göre göreli yol (yalnızca mesajlarda)
  kind: CatalogKind;
  data: unknown;
}

export interface CatalogIssue {
  path: string;
  id?: string;
  message: string;
}

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CATEGORIES = new Set([
  "video", "music", "gaming", "software", "cloud", "telecom", "fitness", "news", "food-delivery", "transport", "other",
]);
const FEE_KINDS = new Set(["fee", "tax", "interest"]);
const PREFIX_RE = /^[A-Z0-9.]+$/;

const FIELDS: Record<CatalogKind, { required: string[]; optional: string[] }> = {
  merchants: {
    required: ["id", "name", "category", "patterns", "isSubscription", "verified"],
    optional: ["cancelUrl", "cancelNote", "sources"],
  },
  fees: { required: ["id", "label", "kind", "patterns", "explanation"], optional: [] },
  intermediaries: { required: ["id", "name", "prefixes", "verified"], optional: [] },
};

/**
 * Ücret açıklamalarında kullanılmayacak ifadeler (PROJE.md §8: hukuki iddia ya
 * da tavsiye yok). foldKey'siz, küçük harfle aranır.
 */
export const FORBIDDEN_FEE_PHRASES = [
  "geri al", "geri iste", "iade al", "iadesini iste", "haksız", "yasa dışı", "yasadışı", "kanunsuz",
  "dava", "tazminat", "şikayet et", "itiraz et", "ödememelisin", "ödemek zorunda değil", "hakkın",
];

const isStr = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function checkPatterns(v: unknown, push: (m: string) => void) {
  if (!Array.isArray(v) || v.length === 0) return push("patterns boş olmayan bir dizi olmalı");
  for (const p of v) {
    if (typeof p !== "string" || p.length < 2) {
      push("her kalıp en az 2 karakterlik metin olmalı");
      continue;
    }
    try {
      new RegExp(p, "u");
    } catch {
      push(`geçersiz regex: ${p}`);
      continue;
    }
    // Kaçış dizileri (\b, \s, \d …) hariç küçük harf olmamalı.
    if (/[a-z]/.test(p.replace(/\\./g, ""))) push(`kalıp büyük harfle yazılmalı: ${p}`);
    if (/[ÇĞİÖŞÜçğıöşü]/.test(p)) push(`kalıpta Türkçe harf yerine ASCII kullanın (Ö → O, İ → I): ${p}`);
    if (new RegExp(p, "u").test("")) push(`kalıp boş metinle eşleşiyor: ${p}`);
  }
}

function checkEntry(kind: CatalogKind, e: Record<string, unknown>, push: (m: string) => void) {
  const { required, optional } = FIELDS[kind];
  for (const k of required) if (!(k in e)) push(`eksik alan: ${k}`);
  for (const k of Object.keys(e)) if (!required.includes(k) && !optional.includes(k)) push(`beklenmeyen alan: ${k}`);
  if ("id" in e && !(typeof e.id === "string" && ID_RE.test(e.id))) push("id küçük harf, rakam ve tire olmalı");

  if (kind === "merchants") {
    if ("name" in e && !isStr(e.name)) push("name boş olamaz");
    if ("category" in e && !CATEGORIES.has(e.category as string)) push(`geçersiz kategori: ${String(e.category)}`);
    if ("patterns" in e) checkPatterns(e.patterns, push);
    if ("isSubscription" in e && typeof e.isSubscription !== "boolean") push("isSubscription true/false olmalı");
    if ("verified" in e && typeof e.verified !== "boolean") push("verified true/false olmalı");
    if ("cancelUrl" in e && !(typeof e.cancelUrl === "string" && /^https:\/\/[^\s]+$/.test(e.cancelUrl))) {
      push("cancelUrl https:// ile başlayan bir adres olmalı");
    }
    if ("cancelNote" in e && !isStr(e.cancelNote)) push("cancelNote boş olamaz");
    if ("sources" in e && !(Array.isArray(e.sources) && e.sources.every(isStr))) push("sources metin dizisi olmalı");
    if (e.verified === true && !(Array.isArray(e.sources) && e.sources.length > 0)) {
      push("verified: true olan kayıtta sources olmalı");
    }
  } else if (kind === "fees") {
    if ("label" in e && !isStr(e.label)) push("label boş olamaz");
    if ("kind" in e && !FEE_KINDS.has(e.kind as string)) push(`geçersiz kind: ${String(e.kind)}`);
    if ("patterns" in e) checkPatterns(e.patterns, push);
    if ("explanation" in e) {
      if (!isStr(e.explanation)) push("explanation boş olamaz");
      else {
        const text = e.explanation.toLocaleLowerCase("tr-TR");
        for (const phrase of FORBIDDEN_FEE_PHRASES) {
          if (text.includes(phrase)) push(`açıklamada hukuki iddia/tavsiye ifadesi var: "${phrase}"`);
        }
      }
    }
  } else {
    if ("name" in e && !isStr(e.name)) push("name boş olamaz");
    if ("verified" in e && typeof e.verified !== "boolean") push("verified true/false olmalı");
    if ("prefixes" in e) {
      const p = e.prefixes;
      if (!Array.isArray(p) || p.length === 0 || !p.every((x) => typeof x === "string" && PREFIX_RE.test(x))) {
        push("prefixes büyük harf ASCII öneklerden oluşan boş olmayan bir dizi olmalı");
      }
    }
  }
}

/** Bütün katalog dosyalarını doğrular. id'ler aynı türde dosyalar arasında benzersiz olmalı. */
export function validateCatalog(files: readonly CatalogFile[]): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const seen: Record<CatalogKind, Map<string, string>> = {
    merchants: new Map(),
    fees: new Map(),
    intermediaries: new Map(),
  };
  for (const file of files) {
    if (!Array.isArray(file.data)) {
      issues.push({ path: file.path, message: "dosya bir JSON dizisi olmalı" });
      continue;
    }
    file.data.forEach((entry, i) => {
      const id = entry && typeof entry === "object" && typeof (entry as { id?: unknown }).id === "string"
        ? (entry as { id: string }).id
        : `#${i}`;
      const push = (message: string) => issues.push({ path: file.path, id, message });
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return push("kayıt bir nesne olmalı");
      checkEntry(file.kind, entry as Record<string, unknown>, push);
      const prev = seen[file.kind].get(id);
      if (prev) push(`id tekrar ediyor (ilk: ${prev})`);
      else seen[file.kind].set(id, file.path);
    });
  }
  return issues;
}

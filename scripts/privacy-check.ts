/**
 * Gizlilik kontrolü (docs/YOL_HARITASI.md §3.2). Her push'tan önce zorunlu.
 *
 *   npm run privacy-check               # takip edilen + git'e eklenmeye aday dosyalar
 *   npm run privacy-check -- --history  # ayrıca tüm git geçmişi ve commit mesajları
 *   npm run privacy-check -- --history --ref main  # geçmişi sadece bu ref için tara
 *
 * Kontroller:
 *   [1] .pdf ya da private/ altında dosya              → sorun
 *   [2] private/blocklist.txt ifadeleri                 → sorun
 *   [3] 10+ haneli rakam dizisi                          → uyarı (elle incelenir)
 *   [4] Mutlak Windows kullanıcı yolu (<sürücü>:\Users\) → sorun
 *
 * GİZLİLİK: Blocklist ifadeleri ve eşleşen içerik hiçbir koşulda yazdırılmaz.
 * Yalnızca dosya yolu, kısa commit hash'i, satır numarası ve sayı yazılır.
 * İfadeler git'e hiç verilmez: eşleştirme bu süreçte sabit metin araması
 * olarak yapılır (git grep -F karşılığı, regex derlenmez). git'in hata çıktısı
 * deseni ya da içeriği tekrar edebileceği için stderr hiç basılmaz.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BLOCKLIST = "private/blocklist.txt";
const MIN_ENTRY_LENGTH = 3;
const LONG_DIGITS = /[0-9]{10,}/;
const ABS_WIN_USER_PATH = /[A-Z]:[\\/]+Users[\\/]/i;
const LONG_DIGITS_EXCLUDE = new Set(["package-lock.json", "src/banks/akbank/glyphs.json"]);

/** Kullanıcıya gösterilebilir hata: mesajı hiçbir zaman içerik ya da desen taşımaz. */
class CheckError extends Error {}

function git(args: string[], cwd: string): Buffer {
  try {
    return execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 1 << 30,
    });
  } catch {
    throw new CheckError(`git ${args[0]} başarısız oldu`);
  }
}

/** Büyük/küçük harf ve Türkçe i/İ/ı/I farkını yok sayan katlama (fazla eşleşmeye razıyız). */
function fold(s: string): string {
  return s.normalize("NFC").toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/\u0307/g, "");
}

function countOccurrences(text: string, needle: string): number {
  let n = 0;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) n++;
  return n;
}

type Matcher = (foldedText: string) => number;

function loadBlocklist(root: string): Matcher[] {
  const path = join(root, BLOCKLIST);
  if (!existsSync(path)) throw new CheckError(`${BLOCKLIST} bulunamadı, push yapılamaz`);
  const entries = readFileSync(path, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));
  if (entries.length === 0) throw new CheckError("blocklist boş, push yapılamaz");
  const tooShort = entries.filter((e) => [...e].length < MIN_ENTRY_LENGTH).length;
  if (tooShort > 0) {
    throw new CheckError(
      `blocklist'te ${MIN_ENTRY_LENGTH} karakterden kısa ${tooShort} satır var (her yerde eşleşir); uzatın ya da silin`,
    );
  }
  return entries.map((entry): Matcher => {
    if (/^[0-9]+$/.test(entry)) {
      // Yalnızca rakam: öncesinde ve sonrasında rakam olmamalı. Girdi sadece rakam
      // olduğu için regex'e güvenle konabilir.
      const re = new RegExp(`(?<![0-9])${entry}(?![0-9])`, "g");
      return (t) => t.match(re)?.length ?? 0;
    }
    const needle = fold(entry);
    return (t) => countOccurrences(t, needle);
  });
}

function blockMatches(matchers: Matcher[], text: string): number {
  const t = fold(text);
  let n = 0;
  for (const m of matchers) n += m(t);
  return n;
}

function isForbiddenPath(p: string): boolean {
  return /\.pdf$/i.test(p) || p.startsWith("private/");
}

function splitZ(buf: Buffer): string[] {
  return buf.toString("utf8").split("\0").filter((s) => s !== "");
}

interface Report {
  forbidden: string[];
  blocked: string[];
  longDigits: string[];
  absPaths: string[];
}

function main(): number {
  const args = process.argv.slice(2);
  const history = args.includes("--history");
  const refIndex = args.indexOf("--ref");
  const ref = refIndex === -1 ? undefined : args[refIndex + 1];
  if (refIndex !== -1 && (!ref || ref.startsWith("-"))) throw new CheckError("--ref için bir branch adı verin");
  const root = git(["rev-parse", "--show-toplevel"], process.cwd()).toString("utf8").trim();
  const matchers = loadBlocklist(root);

  // Yolun kendisi yasaklı ifade içeriyorsa ekrana basılmaz.
  const hiddenPaths = new Map<string, string>();
  const show = (p: string): string => {
    if (blockMatches(matchers, p) === 0) return p;
    let label = hiddenPaths.get(p);
    if (!label) {
      label = `<gizli yol ${hiddenPaths.size + 1}>`;
      hiddenPaths.set(p, label);
    }
    return label;
  };

  const r: Report = { forbidden: [], blocked: [], longDigits: [], absPaths: [] };

  // --- Çalışma alanı: takip edilen + takip edilmeyen ama ignore edilmeyen dosyalar ---
  const files = [...new Set(splitZ(git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], root)))];
  let scanned = 0;
  for (const file of files) {
    if (isForbiddenPath(file)) r.forbidden.push(show(file));
    const pathHits = blockMatches(matchers, file);
    if (pathHits > 0) r.blocked.push(`${show(file)}: dosya yolunda eşleşme`);

    const abs = join(root, file);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    scanned++;
    const text = readFileSync(abs).toString("utf8");

    const hits = blockMatches(matchers, text);
    if (hits > 0) r.blocked.push(`${show(file)}: ${hits} eşleşme`);

    const lines = text.split("\n");
    if (!LONG_DIGITS_EXCLUDE.has(file)) {
      const nums = lines.flatMap((l, i) => (LONG_DIGITS.test(l) ? [i + 1] : []));
      if (nums.length > 0) r.longDigits.push(`${show(file)}: satır ${nums.join(", ")}`);
    }
    const absCount = lines.filter((l) => ABS_WIN_USER_PATH.test(l)).length;
    if (absCount > 0) r.absPaths.push(`${show(file)}: ${absCount} satır`);
  }

  // --- Geçmiş: tüm commit'lerdeki dosyalar ve commit mesajları ---
  let revCount = 0;
  let blobCount = 0;
  if (history) {
    const revs = git(["rev-list", ref ?? "--all", "--"], root).toString("utf8").split("\n").filter(Boolean);
    revCount = revs.length;
    const short = (rev: string) => rev.slice(0, 7);
    const blobs = new Map<string, { paths: Set<string>; revs: Set<string> }>();

    for (const rev of revs) {
      for (const entry of splitZ(git(["ls-tree", "-r", "-z", "--full-tree", rev], root))) {
        const tab = entry.indexOf("\t");
        const [, type, oid] = entry.slice(0, tab).split(" ");
        const path = entry.slice(tab + 1);
        if (type !== "blob") continue;
        if (isForbiddenPath(path)) r.forbidden.push(`${short(rev)} ${show(path)}`);
        const b = blobs.get(oid) ?? { paths: new Set<string>(), revs: new Set<string>() };
        b.paths.add(path);
        b.revs.add(short(rev));
        blobs.set(oid, b);
      }

      const msg = git(["log", "-1", "--format=%B", rev], root).toString("utf8");
      const msgHits = blockMatches(matchers, msg);
      if (msgHits > 0) r.blocked.push(`${short(rev)} commit mesajı: ${msgHits} eşleşme`);
      if (ABS_WIN_USER_PATH.test(msg)) r.absPaths.push(`${short(rev)} commit mesajı`);
    }

    blobCount = blobs.size;
    for (const [oid, b] of blobs) {
      const where = () => {
        const rs = [...b.revs];
        const revText = rs.length > 3 ? `${rs.slice(0, 3).join(",")}+${rs.length - 3}` : rs.join(",");
        return `${revText} ${[...b.paths].map(show).join(" | ")}`;
      };
      for (const p of b.paths) {
        if (blockMatches(matchers, p) > 0) r.blocked.push(`${where()}: dosya yolunda eşleşme`);
      }
      const text = git(["cat-file", "blob", oid], root).toString("utf8");
      const hits = blockMatches(matchers, text);
      if (hits > 0) r.blocked.push(`${where()}: ${hits} eşleşme`);
      const absCount = text.split("\n").filter((l) => ABS_WIN_USER_PATH.test(l)).length;
      if (absCount > 0) r.absPaths.push(`${where()}: ${absCount} satır`);
    }
  }

  // --- Rapor ---
  const scope = history
    ? `çalışma alanı ${scanned} dosya + geçmiş ${revCount} commit / ${blobCount} dosya sürümü`
    : `çalışma alanı ${scanned} dosya`;
  console.log(`Gizlilik kontrolü (${scope}, blocklist ${matchers.length} ifade)`);
  const section = (title: string, items: string[], okText: string, badText: string) => {
    console.log(`[${title}] ${items.length === 0 ? okText : `${badText}: ${items.length}`}`);
    for (const it of items) console.log(`     ${it}`);
  };
  section("1 PDF / private/", r.forbidden, "temiz", "SORUN");
  section("2 Blocklist", r.blocked, "temiz", "SORUN");
  section("3 Uzun rakam (incele)", r.longDigits, "temiz", "UYARI");
  section("4 Mutlak yol", r.absPaths, "temiz", "SORUN");

  const failed = r.forbidden.length + r.blocked.length + r.absPaths.length > 0;
  if (failed) {
    console.log("Sonuç: SORUN VAR, push yapılamaz.");
    return 1;
  }
  console.log(
    r.longDigits.length > 0
      ? "Sonuç: sorun yok. [3] satırlarını push'tan önce tek tek inceleyin."
      : "Sonuç: temiz.",
  );
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  // Beklenmeyen hatalarda mesaj basılmaz: içerik ya da desen taşıyabilir.
  console.error(e instanceof CheckError ? `Hata: ${e.message}` : "Hata: beklenmeyen bir hata oluştu");
  process.exitCode = 1;
}

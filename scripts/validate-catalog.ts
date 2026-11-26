/**
 * Katalog dosyalarını catalog/schema.json kurallarına göre doğrular.
 *
 *   npm run validate-catalog
 *
 * Build'in ilk adımıdır; hata varsa build durur.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateCatalog, type CatalogFile, type CatalogKind } from "../src/catalog/validate.ts";

const root = join(import.meta.dirname, "..");

async function jsonFiles(dir: string, kind: CatalogKind): Promise<CatalogFile[]> {
  let names: string[];
  try {
    names = (await readdir(join(root, dir))).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return Promise.all(names.map((n) => readCatalogFile(`${dir}/${n}`, kind)));
}

async function readCatalogFile(path: string, kind: CatalogKind): Promise<CatalogFile> {
  const text = await readFile(join(root, path), "utf8");
  try {
    return { path, kind, data: JSON.parse(text) };
  } catch {
    return { path, kind, data: undefined };
  }
}

const files = [
  ...(await jsonFiles("catalog/merchants", "merchants")),
  ...(await jsonFiles("catalog/fees", "fees")),
  await readCatalogFile("catalog/intermediaries.json", "intermediaries"),
];
const issues = validateCatalog(files);
const count = (kind: CatalogKind) =>
  files.filter((f) => f.kind === kind).reduce((n, f) => n + (Array.isArray(f.data) ? f.data.length : 0), 0);

if (issues.length > 0) {
  for (const i of issues) console.error(`${i.path}${i.id ? ` [${i.id}]` : ""}: ${i.message}`);
  console.error(`Katalog geçersiz: ${issues.length} sorun.`);
  process.exitCode = 1;
} else {
  console.log(
    `Katalog geçerli: ${count("merchants")} satıcı, ${count("fees")} ücret kuralı, ${count("intermediaries")} ödeme aracısı.`,
  );
}

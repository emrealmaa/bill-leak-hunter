import {
  getDocument,
  GlobalWorkerOptions,
  InvalidPDFException,
  OPS,
  PasswordException,
  type PDFDocumentLoadingTask,
  type PDFPageProxy,
} from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
// Worker, Vite tarafından uygulamayla birlikte paketlenir (CDN yok, PROJE.md §10).
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { RawStatement } from "../banks/decodeStatement";
import type { PdfPage, PdfTextItem } from "../types";
import { extractPageGlyphs, type GlyphSourcePage, type PositionedGlyph } from "./glyphs";

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfReadErrorCode = "encrypted" | "invalid" | "unknown";

export class PdfReadError extends Error {
  readonly code: PdfReadErrorCode;
  constructor(code: PdfReadErrorCode, message: string) {
    super(message);
    this.name = "PdfReadError";
    this.code = code;
  }
}

function toReadError(err: unknown): PdfReadError {
  if (err instanceof PdfReadError) return err;
  if (err instanceof PasswordException) {
    return new PdfReadError("encrypted", "PDF okunamadı (şifreli olabilir).");
  }
  if (err instanceof InvalidPDFException) {
    return new PdfReadError("invalid", "Bu dosya geçerli bir PDF gibi görünmüyor.");
  }
  return new PdfReadError("unknown", "PDF okunurken beklenmeyen bir hata oluştu.");
}

/**
 * Not: cMapUrl / standardFontDataUrl / wasmUrl bilerek verilmez; böylece pdf.js
 * dışarıya istek atmaz.
 */
async function open(source: File | ArrayBuffer, extra: { fontExtraProperties?: boolean } = {}) {
  const buffer = source instanceof ArrayBuffer ? source : await source.arrayBuffer();
  return getDocument({ data: new Uint8Array(buffer), ...extra });
}

async function readPageText(page: PDFPageProxy, pageNumber: number): Promise<PdfPage> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: PdfTextItem[] = content.items
    .filter((it): it is TextItem => "str" in it)
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      width: it.width,
      height: it.height,
    }));
  return { pageNumber, width: viewport.width, height: viewport.height, items };
}

/**
 * PDF'i tamamen tarayıcıda okur ve her sayfanın metin parçalarını konumlarıyla
 * döndürür. Veri hiçbir yere gönderilmez ve saklanmaz.
 */
export async function readPdf(source: File | ArrayBuffer): Promise<PdfPage[]> {
  let task: PDFDocumentLoadingTask | undefined;
  try {
    task = await open(source);
    const doc = await task.promise;
    const pages: PdfPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      pages.push(await readPageText(page, n));
      page.cleanup();
    }
    return pages;
  } catch (err) {
    throw toReadError(err);
  } finally {
    await task?.destroy();
  }
}

/**
 * Ekstre analizi için PDF'i okur: her sayfanın pdf.js metni ve (Type3 fontlu
 * ekstreleri çözmek için) konumlanmış glifleri. Belge okunduktan sonra
 * bellekten bırakılır; veri hiçbir yere gönderilmez.
 */
export async function readStatementPdf(source: File | ArrayBuffer): Promise<RawStatement> {
  let task: PDFDocumentLoadingTask | undefined;
  try {
    task = await open(source, { fontExtraProperties: true });
    const doc = await task.promise;
    const pages: PdfPage[] = [];
    const glyphs: PositionedGlyph[][] = [];
    const hashCache = new Map<string, string>();
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      pages.push(await readPageText(page, n));
      glyphs.push(await extractPageGlyphs(page as unknown as GlyphSourcePage, OPS, hashCache));
      page.cleanup();
    }
    return { pages, glyphs };
  } catch (err) {
    throw toReadError(err);
  } finally {
    await task?.destroy();
  }
}

/** Geliştirici sayfası için açık tutulan PDF: metin, glifler ve sayfa çizimi. */
export interface PdfSession {
  pages: PdfPage[];
  /** Sayfa başına konumlanmış glifler (Type3 şekil hash'leriyle). */
  glyphs: PositionedGlyph[][];
  /** Sayfayı verilen ölçekte yeni bir canvas'a çizer. */
  renderPage(pageNumber: number, scale: number): Promise<HTMLCanvasElement>;
  /** Kullanıcı uzayındaki noktayı (y yukarı) verilen ölçekteki canvas noktasına çevirir. */
  toCanvasPoint(pageNumber: number, scale: number, x: number, y: number): [number, number];
  destroy(): Promise<void>;
}

export async function openPdfSession(source: File | ArrayBuffer): Promise<PdfSession> {
  let task: PDFDocumentLoadingTask | undefined;
  try {
    // fontExtraProperties: Type3 glif çizimlerine (charProc) erişmek için gerekli
    task = await open(source, { fontExtraProperties: true });
    const doc = await task.promise;
    const proxies: PDFPageProxy[] = [];
    const pages: PdfPage[] = [];
    const glyphs: PositionedGlyph[][] = [];
    const hashCache = new Map<string, string>();
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      proxies.push(page);
      pages.push(await readPageText(page, n));
      glyphs.push(await extractPageGlyphs(page as unknown as GlyphSourcePage, OPS, hashCache));
    }
    const loadingTask = task;
    return {
      pages,
      glyphs,
      async renderPage(pageNumber, scale) {
        const page = proxies[pageNumber - 1];
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        return canvas;
      },
      toCanvasPoint(pageNumber, scale, x, y) {
        const [cx, cy] = proxies[pageNumber - 1].getViewport({ scale }).convertToViewportPoint(x, y);
        return [cx, cy];
      },
      destroy: () => loadingTask.destroy(),
    };
  } catch (err) {
    await task?.destroy();
    throw toReadError(err);
  }
}

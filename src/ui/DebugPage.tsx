import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { openPdfSession, PdfReadError, type PdfSession } from "../pdf/readPdf";
import { DEFAULT_Y_TOLERANCE, groupIntoLines } from "../pdf/lines";
import { decodeGlyphs, DEFAULT_SPACE_THRESHOLD } from "../pdf/decode";
import type { GlyphTable } from "../pdf/glyphTable";
import { formatDebugText } from "./formatDebugText";
import { buildLabelLines } from "./labeling";
import { LabelingPanel } from "./LabelingPanel";
import { ParsedTransactions } from "./ParsedTransactions";
import type { PdfPage } from "../types";

type CopyStatus = "idle" | "copied" | "failed";
type View = "raw" | "decoded" | "label" | "parsed";

const VIEWS: { id: View; label: string }[] = [
  { id: "raw", label: "Ham metin" },
  { id: "decoded", label: "Çözülmüş metin" },
  { id: "label", label: "Etiketleme modu" },
  { id: "parsed", label: "Ayrıştırılmış işlemler" },
];

// GEÇİCİ geliştirici sayfası: PDF'ten çıkan metni gösterir ve Type3 glif
// tablosunu etiketlemeye yarar. Veri yalnızca bu bileşenin belleğinde durur;
// sayfa kapanınca kaybolur. localStorage yok, ağ isteği yok (PROJE.md §10).
export function DebugPage() {
  const [session, setSession] = useState<PdfSession | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [tolerance, setTolerance] = useState(DEFAULT_Y_TOLERANCE);
  const [spaceThreshold, setSpaceThreshold] = useState(DEFAULT_SPACE_THRESHOLD);
  const [showItems, setShowItems] = useState(false);
  const [view, setView] = useState<View>("raw");
  // Glif tablosu yeni PDF yüklense de korunur (birden çok ekstreyle etiketleme için).
  const [table, setTable] = useState<GlyphTable>(() => new Map());
  const [dirty, setDirty] = useState(false);
  // Yalnızca geri bildirim durumu; kopyalanan metnin kendisi saklanmaz.
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const sessionRef = useRef<PdfSession | null>(null);

  useEffect(() => {
    if (copyStatus === "idle") return;
    const t = setTimeout(() => setCopyStatus("idle"), 2000);
    return () => clearTimeout(t);
  }, [copyStatus]);

  // Sayfa kapanırken açık PDF'i bellekten bırak.
  useEffect(() => () => void sessionRef.current?.destroy(), []);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Lütfen bir PDF dosyası seç.");
      return;
    }
    await sessionRef.current?.destroy();
    sessionRef.current = null;
    setSession(null);
    setFileName(file.name);
    setLoading(true);
    try {
      const s = await openPdfSession(file);
      sessionRef.current = s;
      setSession(s);
    } catch (err) {
      setError(err instanceof PdfReadError ? err.message : "PDF okunamadı.");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files[0]);
  }

  // Seçili görünüme göre sayfalar: ham pdf.js metni ya da tabloyla çözülmüş glifler.
  const viewPages: PdfPage[] = useMemo(() => {
    if (!session) return [];
    if (view !== "decoded") return session.pages;
    return session.pages.map((p, i) => ({ ...p, items: decodeGlyphs(session.glyphs[i], table, { spaceThreshold }) }));
  }, [session, view, table, spaceThreshold]);

  const linesByPage = useMemo(
    () =>
      viewPages.map((p) => ({
        page: p,
        lines: groupIntoLines(p.items, { yTolerance: tolerance, joiner: "  " }),
      })),
    [viewPages, tolerance],
  );

  const labelLines = useMemo(
    () => (session ? buildLabelLines(session.glyphs, { yTolerance: tolerance }) : []),
    [session, tolerance],
  );

  async function copyText() {
    if (!session) return;
    try {
      // Metin yalnızca panoya gider: localStorage yok, ağ isteği yok (PROJE.md §10).
      await navigator.clipboard.writeText(
        formatDebugText(viewPages, { yTolerance: tolerance, showPositions: showItems }),
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6 font-sans text-slate-800">
      <h1 className="text-2xl font-bold">Sızıntı Avcısı · Geliştirici sayfası</h1>
      <p className="mt-1 text-sm text-slate-500">
        Geçici geliştirici sayfası. PDF tarayıcında okunur, hiçbir yere gönderilmez.
      </p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${
          dragging ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:bg-slate-50"
        }`}
      >
        <span className="font-medium">Ekstre PDF'ini buraya sürükle</span>
        <span className="text-sm text-slate-500">ya da tıklayıp seç</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={`rounded-md px-3 py-1 ${view === v.id ? "bg-white font-medium shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
        <label className="flex items-center gap-2">
          y toleransı
          <input
            type="number"
            min={0}
            step={0.5}
            value={tolerance}
            onChange={(e) => setTolerance(Math.max(0, Number(e.target.value) || 0))}
            className="w-20 rounded border border-slate-300 px-2 py-1"
          />
        </label>
        {view !== "raw" && (
          <label className="flex items-center gap-2" title="Glifler arası aralık > eşik × font boyutu ise boşluk konur">
            boşluk eşiği (× font boyutu)
            <input
              type="number"
              min={0}
              step={0.05}
              value={spaceThreshold}
              onChange={(e) => setSpaceThreshold(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 rounded border border-slate-300 px-2 py-1"
            />
          </label>
        )}
        {(view === "raw" || view === "decoded") && (
          <>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showItems} onChange={(e) => setShowItems(e.target.checked)} />
              Parçaları x/y ile göster
            </label>
            <button
              type="button"
              onClick={() => void copyText()}
              disabled={!session}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Metni kopyala
            </button>
            {copyStatus === "copied" && <span className="text-emerald-700">Kopyalandı ✓</span>}
            {copyStatus === "failed" && (
              <span className="text-red-700">Kopyalanamadı (tarayıcı panoya erişime izin vermedi).</span>
            )}
          </>
        )}
      </div>

      {loading && <p className="mt-6">Okunuyor…</p>}
      {error && <p className="mt-6 rounded bg-red-50 p-3 text-red-700">{error}</p>}

      {session && (
        <p className="mt-6 text-sm text-slate-500">
          {fileName} · {session.pages.length} sayfa · {table.size} glif etiketi bellekte
        </p>
      )}

      {session && view === "label" && (
        <LabelingPanel
          session={session}
          lines={labelLines}
          table={table}
          dirty={dirty}
          spaceThreshold={spaceThreshold}
          onAssign={(assignments) => {
            if (assignments.length === 0) return;
            setTable((prev) => new Map([...prev, ...assignments]));
            setDirty(true);
          }}
          onTableLoaded={(loaded) => {
            setTable(loaded);
            setDirty(false);
          }}
          onDownloaded={() => setDirty(false)}
        />
      )}

      {session && view === "parsed" && <ParsedTransactions session={session} table={table} />}

      {(view === "raw" || view === "decoded") &&
        linesByPage.map(({ page, lines }) => (
          <section key={page.pageNumber} className="mt-6">
            <h2 className="font-semibold">
              Sayfa {page.pageNumber}{" "}
              <span className="font-normal text-slate-500">
                ({Math.round(page.width)}×{Math.round(page.height)}, {page.items.length} parça, {lines.length} satır)
              </span>
            </h2>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-5 text-slate-100">
              {lines
                .map((l) =>
                  showItems
                    ? `y=${l.y.toFixed(1).padStart(6)} │ ` +
                      l.items.map((it) => `[x=${it.x.toFixed(1)}] ${it.str.trim()}`).join("  ")
                    : l.text,
                )
                .join("\n")}
            </pre>
          </section>
        ))}
    </main>
  );
}

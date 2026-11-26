import { useEffect, useMemo, useRef, useState } from "react";
import type { PdfSession } from "../pdf/readPdf";
import { GlyphTableError, parseGlyphTable, serializeGlyphTable, type GlyphTable } from "../pdf/glyphTable";
import {
  decodeLine,
  DIGIT_PUNCT,
  glyphPattern,
  groupIdenticalLines,
  labelLine,
  progress,
  sortGroupsForLabeling,
  unlabeledCount,
  type Conflict,
  type LabelGroup,
  type LabelLine,
} from "./labeling";

// GEÇİCİ geliştirici aracı. Satır resimleri ve yazılan metinler yalnızca
// bellekte durur; dosyaya yalnızca hash → karakter tablosu yazılır (PROJE.md §10).

// Satır resimleri okunaklı olsun diye sayfa 3× çizilir; kırpıntı bu boyutta gösterilir.
const RENDER_SCALE = 3;
const CROP_PAD_PX = 6;
const PAGE_SIZE = 30;

interface Props {
  session: PdfSession;
  lines: LabelLine[];
  table: GlyphTable;
  dirty: boolean;
  spaceThreshold: number;
  onAssign: (assignments: [string, string][]) => void;
  onTableLoaded: (table: GlyphTable) => void;
  onDownloaded: () => void;
}

export function LabelingPanel({ session, lines, table, dirty, spaceThreshold, onAssign, onTableLoaded, onDownloaded }: Props) {
  const [canvases, setCanvases] = useState<Map<number, HTMLCanvasElement>>(new Map());
  const [renderError, setRenderError] = useState("");
  // Aynı glif dizili satırlar tek kartta (×N).
  const groups = useMemo(() => groupIdenticalLines(lines), [lines]);
  // Sıra bir kez alınır; her kayıtta kartlar yer değiştirmesin diye "Yeniden sırala" ile güncellenir.
  const [order, setOrder] = useState<string[]>(() => sortGroupsForLabeling(groups, table).map((gr) => gr.id));
  const [onlyUnlabeled, setOnlyUnlabeled] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [importMsg, setImportMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = new Map<number, HTMLCanvasElement>();
        for (const p of session.pages) map.set(p.pageNumber, await session.renderPage(p.pageNumber, RENDER_SCALE));
        if (!cancelled) setCanvases(map);
      } catch {
        if (!cancelled) setRenderError("Sayfa çizilemedi.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    setOrder(sortGroupsForLabeling(groups, table).map((gr) => gr.id));
    setVisible(PAGE_SIZE);
    // Yalnızca kart listesi değişince (yeni PDF / tolerans) yeniden sırala;
    // tablo değişince sıra bilerek sabit kalır.
  }, [groups]);

  const byId = useMemo(() => new Map(groups.map((gr) => [gr.id, gr])), [groups]);
  const ordered = order.map((id) => byId.get(id)).filter((gr): gr is LabelGroup => !!gr);
  const isOpen = (gr: LabelGroup) => unlabeledCount(gr.lines[0], table) > 0;
  const shown = onlyUnlabeled ? ordered.filter(isOpen) : ordered;
  const openGroups = ordered.filter(isOpen);
  const prog = progress(lines, table);

  function download() {
    const blob = new Blob([serializeGlyphTable(table)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "glyphs.json";
    a.click();
    URL.revokeObjectURL(url);
    onDownloaded();
  }

  async function importFile(file: File | undefined) {
    setConfirmImport(false);
    if (!file) return;
    try {
      const loaded = parseGlyphTable(await file.text());
      onTableLoaded(loaded);
      setOrder(sortGroupsForLabeling(groups, loaded).map((gr) => gr.id));
      setImportMsg({ kind: "ok", text: `${loaded.size} glif etiketi yüklendi.` });
    } catch (err) {
      setImportMsg({ kind: "error", text: err instanceof GlyphTableError ? err.message : "Dosya okunamadı." });
    }
  }

  if (lines.length === 0) {
    return <p className="mt-6 text-slate-600">Bu PDF'te Type3 glif yok; etiketlenecek bir şey bulunmadı.</p>;
  }

  const pct = prog.totalShapes ? Math.round((100 * prog.labeledShapes) / prog.totalShapes) : 0;

  return (
    <section className="mt-6">
      <div className="sticky top-0 z-10 -mx-2 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="min-w-56">
            <div className="font-medium">
              Glifler: {prog.labeledShapes} / {prog.totalShapes} etiketli ({pct}%)
            </div>
            <div className="mt-1 h-2 w-full rounded bg-slate-200">
              <div className="h-2 rounded bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div title="Bir şeklin rakam mı harf mi olduğu etiketlenmeden bilinemez; bu yüzden toplam yerine görülen karakterler sayılır.">
            <span className="font-medium">rakam/işaret:</span> {prog.digitPunctShapes} şekil etiketli · {DIGIT_PUNCT.length} karakterden{" "}
            {prog.digitPunctSeen.length}'i görüldü
            <div className="font-mono text-xs text-slate-500">
              {DIGIT_PUNCT.map((c) => (
                <span key={c} className={prog.digitPunctSeen.includes(c) ? "text-emerald-700" : "text-slate-300"}>
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={download} className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50">
              glyphs.json indir
            </button>
            <button
              type="button"
              onClick={() => (dirty && table.size > 0 ? setConfirmImport(true) : fileInput.current?.click())}
              className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
            >
              glyphs.json yükle
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {dirty && <span className="text-amber-700">İndirilmemiş değişiklik var</span>}
          </div>
        </div>
        {confirmImport && (
          <p className="mt-2 text-sm text-amber-800">
            İndirilmemiş etiketler var; yüklenen dosya bunların yerine geçecek.{" "}
            <button type="button" className="underline" onClick={() => fileInput.current?.click()}>
              Yine de yükle
            </button>{" "}
            ·{" "}
            <button type="button" className="underline" onClick={() => setConfirmImport(false)}>
              Vazgeç
            </button>
          </p>
        )}
        {importMsg && (
          <p className={`mt-2 text-sm ${importMsg.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}>{importMsg.text}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={onlyUnlabeled} onChange={(e) => setOnlyUnlabeled(e.target.checked)} />
            Yalnızca etiketsiz glif içerenler ({openGroups.length} kart /{" "}
            {openGroups.reduce((n, gr) => n + gr.lines.length, 0)} satır)
          </label>
          <span className="text-slate-500">
            Toplam {groups.length} kart / {lines.length} satır
          </span>
          <button
            type="button"
            className="underline"
            onClick={() => setOrder(sortGroupsForLabeling(groups, table).map((gr) => gr.id))}
          >
            Yeniden sırala
          </button>
          <span className="text-slate-500">Boşluklar sayılmaz; her glif için bir karakter yaz.</span>
        </div>
      </div>

      {renderError && <p className="mt-4 text-red-700">{renderError}</p>}

      <ol className="mt-4 space-y-4">
        {shown.slice(0, visible).map((group) => (
          <LineRow
            key={group.id}
            line={group.lines[0]}
            count={group.lines.length}
            session={session}
            canvas={canvases.get(group.lines[0].pageNumber)}
            table={table}
            spaceThreshold={spaceThreshold}
            onAssign={onAssign}
          />
        ))}
      </ol>
      {shown.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-4 rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
        >
          Daha fazla göster ({shown.length - visible} kart kaldı)
        </button>
      )}
    </section>
  );
}

interface RowProps {
  /** Kartın temsil ettiği (ilk) satır. */
  line: LabelLine;
  /** Aynı glif dizisine sahip satır sayısı. */
  count: number;
  session: PdfSession;
  canvas: HTMLCanvasElement | undefined;
  table: GlyphTable;
  spaceThreshold: number;
  onAssign: (assignments: [string, string][]) => void;
}

function LineRow({ line, count, session, canvas, table, spaceThreshold, onAssign }: RowProps) {
  const crop = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<{ assignments: [string, string][]; conflicts: Conflict[] } | null>(null);

  useEffect(() => {
    const target = crop.current;
    if (!target || !canvas) return;
    const pad = CROP_PAD_PX;
    const [x0, y0] = session.toCanvasPoint(line.pageNumber, RENDER_SCALE, line.box.x0, line.box.y1);
    const [x1, y1] = session.toCanvasPoint(line.pageNumber, RENDER_SCALE, line.box.x1, line.box.y0);
    const sx = Math.max(0, Math.floor(Math.min(x0, x1)) - pad);
    const sy = Math.max(0, Math.floor(Math.min(y0, y1)) - pad);
    const w = Math.min(canvas.width - sx, Math.ceil(Math.abs(x1 - x0)) + 2 * pad);
    const h = Math.min(canvas.height - sy, Math.ceil(Math.abs(y1 - y0)) + 2 * pad);
    target.width = Math.max(1, w);
    target.height = Math.max(1, h);
    target.getContext("2d")?.drawImage(canvas, sx, sy, w, h, 0, 0, w, h);
  }, [canvas, line, session]);

  function apply(assignments: [string, string][], label: string) {
    onAssign(assignments);
    setPending(null);
    setMessage({ kind: "ok", text: label });
  }

  function save() {
    const r = labelLine(line, text, table);
    if (!r.ok) {
      setMessage({
        kind: "error",
        text: `Sayı tutmuyor: satırda ${r.glyphCount} glif var, sen ${r.charCount} karakter yazdın (boşluklar sayılmaz).`,
      });
      return;
    }
    if (r.conflicts.length > 0) {
      setPending({ assignments: r.assignments, conflicts: r.conflicts });
      setMessage(null);
      return;
    }
    apply(r.assignments, r.newCount > 0 ? `${r.newCount} yeni glif etiketlendi.` : "Değişiklik yok; hepsi zaten bu şekilde etiketli.");
  }

  const unlabeled = unlabeledCount(line, table);

  return (
    <li className={`rounded-lg border p-3 ${unlabeled === 0 ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200"}`}>
      <div className="flex items-baseline justify-between gap-4 text-xs text-slate-500">
        <span>
          {count > 1 && (
            <b
              className="mr-2 rounded bg-slate-800 px-1.5 py-0.5 text-white"
              title={`Bu glif dizisi ${count} satırda geçiyor; kaydetmek hepsini çözer.`}
            >
              ×{count}
            </b>
          )}
          Sayfa {line.pageNumber} · {line.glyphs.length} glif · {unlabeled} etiketsiz
        </span>
        <span className="font-mono" title="Glif düzeni: her • bir glif, aralar hesaplanan boşluklar">
          {glyphPattern(line, spaceThreshold)}
        </span>
      </div>
      <div className="mt-2 overflow-x-auto rounded bg-white">
        {canvas ? <canvas ref={crop} className="block max-w-none" /> : <div className="p-2 text-sm text-slate-400">Çiziliyor…</div>}
      </div>
      <div className="mt-1 font-mono text-sm text-slate-600" title="Tabloyla şu anki çözüm">
        {decodeLine(line, table, spaceThreshold)}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMessage(null);
            setPending(null);
          }}
          placeholder="Resimde gördüğün metni yaz"
          className="flex-1 rounded border border-slate-300 px-2 py-1 font-mono"
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" className="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700">
          Kaydet
        </button>
      </form>
      {message && <p className={`mt-1 text-sm ${message.kind === "ok" ? "text-emerald-700" : "text-red-700"}`}>{message.text}</p>}
      {pending && (
        <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm">
          <p className="font-medium text-amber-900">Çakışma: bu glifler daha önce farklı karaktere eşlenmiş.</p>
          <ul className="mt-1 list-inside list-disc">
            {pending.conflicts.map((c) => (
              <li key={`${c.index}-${c.hash}`}>
                {c.index + 1}. glif: şu an <b className="font-mono">{c.existing}</b>, yazdığın <b className="font-mono">{c.proposed}</b>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className="underline"
              onClick={() =>
                apply(
                  [...pending.assignments, ...pending.conflicts.map((c): [string, string] => [c.hash, c.proposed])],
                  "Yeni etiketler uygulandı.",
                )
              }
            >
              Yenileri uygula
            </button>
            <button type="button" className="underline" onClick={() => apply(pending.assignments, "Eski etiketler korundu.")}>
              Eskileri koru
            </button>
            <button type="button" className="underline" onClick={() => setPending(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

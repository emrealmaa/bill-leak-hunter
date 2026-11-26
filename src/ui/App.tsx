import { useMemo, useState } from "react";
import { StatementError } from "../banks/errors";
import { parsers } from "../banks/registry";
import { REPO_URL } from "../config";
import { buildCsv, downloadCsv } from "../export/csv";
import { I18nContext, MESSAGES, type Lang } from "../i18n";
import type { StatementReport } from "../pipeline";
import { ErrorView, type AppErrorCode } from "./ErrorView";
import { Processing } from "./Processing";
import { Results } from "./Results";
import { Welcome } from "./Welcome";

type State =
  | { screen: "welcome" }
  | { screen: "processing" }
  | { screen: "error"; code: AppErrorCode }
  | { screen: "result"; report: StatementReport };

/**
 * Ekstreyi işler. pdf.js ağır olduğu için ilk yüklemeye girmez; dosya seçilince
 * dinamik olarak yüklenir (yine uygulamayla birlikte paketlenir, CDN yok).
 */
async function processFile(file: File): Promise<StatementReport> {
  const [{ readStatementPdf }, { processStatement }] = await Promise.all([
    import("../pdf/readPdf"),
    import("../pipeline"),
  ]);
  return processStatement(await readStatementPdf(file));
}

function errorCode(err: unknown): AppErrorCode {
  if (err instanceof StatementError) return err.code;
  if (err instanceof Error && err.name === "PdfReadError" && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "encrypted" || code === "invalid") return code;
  }
  return "unknown";
}

const isPdf = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

export function App() {
  const [lang, setLang] = useState<Lang>("tr");
  const [state, setState] = useState<State>({ screen: "welcome" });
  const i18n = useMemo(() => ({ m: MESSAGES[lang], lang, setLang }), [lang]);
  const m = i18n.m;

  async function handleFile(file: File) {
    if (!isPdf(file)) {
      setState({ screen: "error", code: "not-pdf" });
      return;
    }
    setState({ screen: "processing" });
    try {
      // Rapor yalnızca bu bileşenin belleğinde durur; localStorage yok (PROJE.md §10).
      setState({ screen: "result", report: await processFile(file) });
    } catch (err) {
      setState({ screen: "error", code: errorCode(err) });
    }
  }

  const reset = () => setState({ screen: "welcome" });

  return (
    <I18nContext.Provider value={i18n}>
      <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <button type="button" onClick={reset} className="text-lg font-bold text-slate-900 hover:text-emerald-800">
              {m.appName}
            </button>
            <div className="flex items-center gap-1 text-sm" role="group" aria-label={m.language.label}>
              {(["tr", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  lang={l}
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  className={`rounded-md px-2 py-1 ${lang === l ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {m.language[l]}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
          {state.screen === "welcome" && (
            <Welcome banks={parsers.map((p) => p.displayName)} onFile={(f) => void handleFile(f)} />
          )}
          {state.screen === "processing" && <Processing />}
          {state.screen === "error" && <ErrorView code={state.code} onRetry={reset} />}
          {state.screen === "result" && (
            <Results
              report={state.report}
              onReset={reset}
              onDownloadCsv={() => downloadCsv(buildCsv(state.report, m), m.csv.fileName)}
            />
          )}
        </main>

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:px-6">
            <span>{m.footer.noTracking}</span>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {m.footer.source} ↗
            </a>
          </div>
        </footer>
      </div>
    </I18nContext.Provider>
  );
}

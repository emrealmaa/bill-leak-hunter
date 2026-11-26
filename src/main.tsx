import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./ui/App";

// Geliştirici sayfası (etiketleme, ham metin) yalnızca `npm run dev` ile ve
// adres #debug ile açılır. Üretim build'inde import.meta.env.DEV false olduğu
// için bu dal ve DebugPage paketin içine hiç girmez.
const DebugPage = import.meta.env.DEV
  ? lazy(() => import("./ui/DebugPage").then((mod) => ({ default: mod.DebugPage })))
  : null;

const showDebug = DebugPage !== null && window.location.hash === "#debug";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {showDebug && DebugPage ? (
      <Suspense fallback={null}>
        <DebugPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);

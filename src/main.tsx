import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { DebugPage } from "./ui/DebugPage";

// Geçici: banka formatını incelemek için ham metin sayfası.
// Gerçek sonuç ekranı Hafta 3'te bunun yerini alacak.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DebugPage />
  </StrictMode>,
);

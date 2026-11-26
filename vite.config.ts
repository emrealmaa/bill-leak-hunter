import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * İçerik Güvenlik Politikası (PROJE.md §10: uygulama hiçbir ağ isteği yapmaz).
 * - connect-src 'none': fetch/XHR/WebSocket tamamen kapalı.
 * - worker-src 'self': pdf.js worker'ı uygulamayla birlikte gelir.
 * - img-src/font-src data: blob: pdf.js'in bellekte ürettiği görüntü ve fontlar için.
 * Yalnızca üretim build'ine eklenir; geliştirme sunucusunun HMR bağlantısını engellemesin diye.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function cspPlugin(): Plugin {
  return {
    name: "sizinti-avcisi-csp",
    apply: "build",
    transformIndexHtml(html) {
      // charset ilk etiket kalsın diye hemen arkasına eklenir.
      return html.replace(
        /(<meta charset="UTF-8" \/>)/,
        `$1\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

/**
 * GitHub Pages adresi: https://<kullanıcı>.github.io/bill-leak-hunter/
 * build ve `vite preview` bu alt yolu kullanır; geliştirme sunucusu kökte kalır.
 */
export const PAGES_BASE = "/bill-leak-hunter/";

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? PAGES_BASE : "/",
  plugins: [react(), tailwindcss(), cspPlugin()],
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Publié dans un sous-dossier du FTP (storytelling.blick.ch/fr/__is_embed_somewhere/bl-iframe-traffic/) :
  // chemins relatifs à index.html.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": `http://localhost:${process.env.PORT || 8787}` },
  },
  // MapLibre (≈ 1 Mo) est chargé à part, en import dynamique (comme bl-iframe-map-ski).
  build: { chunkSizeWarningLimit: 2000 },
});

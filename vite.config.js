import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": `http://localhost:${process.env.PORT || 8787}` },
  },
  // MapLibre (≈ 1 Mo) est chargé à part, en import dynamique (comme bl-iframe-map-ski).
  build: { chunkSizeWarningLimit: 2000 },
});

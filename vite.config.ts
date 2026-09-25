import { defineConfig } from "vite";
import { resolve } from "node:path";

// Vite solo empaqueta index.html por defecto: la calibración necesita su propia entrada.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        aparato: resolve(import.meta.dirname, "index.html"),
        calibracion: resolve(import.meta.dirname, "calibracion.html"),
      },
    },
  },
});

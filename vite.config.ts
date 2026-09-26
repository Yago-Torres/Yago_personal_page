import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";

/**
 * En producción el Worker sirve /aitana como aitana/index.html él solo
 * (html_handling por defecto). El servidor de desarrollo no hace esa
 * equivalencia, así que se la damos aquí y las dos se comportan igual.
 */
function rutasSinBarra(): Plugin {
  return {
    name: "ytg-rutas-sin-barra",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, _res, siguiente) => {
        if (req.url === "/aitana" || req.url === "/aitana/") req.url = "/aitana/index.html";
        siguiente();
      });
    },
  };
}

// Vite solo empaqueta index.html por defecto. /aitana necesita su propia
// entrada: es lo que hace que la dirección funcione sin ningún enlace hacia ella.
export default defineConfig({
  appType: "mpa",
  plugins: [rutasSinBarra()],
  build: {
    rollupOptions: {
      input: {
        parte: resolve(import.meta.dirname, "index.html"),
        aitana: resolve(import.meta.dirname, "aitana/index.html"),
      },
    },
  },
});

import { genoma, expandir, tortuga } from "./botanica.ts";

const ITERACIONES_MAX = 6;
const LONGITUD_BASE = 0.55;

const plantas = [
  { slug: "beca-erasmus", vigor: 0.35 },
  { slug: "primer-trabajo", vigor: 0.72 },
  { slug: "proyecto-freelance", vigor: 0.5 },
  { slug: "curso-de-rust", vigor: 0.18 },
  { slug: "startup-fallida", vigor: 0.12 },
  { slug: "master-en-datos", vigor: 0.86 },
  { slug: "contribucion-open-source", vigor: 0.95 },
];

for (const p of plantas) {
  const g = genoma(p.slug);
  const iteraciones = Math.round(2 + 4 * p.vigor);
  const cadena = expandir(g, iteraciones);
  const segs = tortuga(cadena, g, { longitud: (LONGITUD_BASE * (0.5 + 0.5 * p.vigor)) / ITERACIONES_MAX, grosor: 0.05 });
  const maxY = Math.max(...segs.map((s) => Math.max(s.y1, s.y2)));
  const minX = Math.min(...segs.map((s) => Math.min(s.x1, s.x2)));
  const maxX = Math.max(...segs.map((s) => Math.max(s.x1, s.x2)));
  console.log(
    p.slug,
    "iter=", iteraciones,
    "ramaDoble=", g.ramaDoble,
    "angulo=", g.angulo.toFixed(1),
    "curvatura=", g.curvatura.toFixed(2),
    "decaimiento=", g.decaimiento.toFixed(2),
    "nSeg=", segs.length,
    "maxY=", maxY.toFixed(3),
    "spreadX=", (maxX - minX).toFixed(3),
  );
}

// Banco de pruebas del motor botánico: expone en vivo las constantes de
// calibración para compararlas sin tocar código. No es parte del aparato.

import { genoma, expandir, tortuga } from "./botanica";
import type { Genoma, Segmento } from "./botanica";
import { tramar } from "./tramado";

// Especies de ejemplo para comparar lado a lado.
const SLUGS_EJEMPLO = [
  "helecho",
  "roble-viejo",
  "musgo-de-turba",
  "buganvilla",
  "aloe-vera",
  "bambu-enano",
  "cactus-columnar",
  "hiedra-trepadora",
];

// Deben coincidir con jardin.ts para que la comparación sea honesta.
const LONGITUD_BASE = 0.55;
const GROSOR_BASE = 0.05;

interface Ajustes {
  vigor: number;
  iteraciones: number;
  angulo: number;
  decaimiento: number;
  umbralDesborde: number;
  bufferAncho: number;
  bufferAlto: number;
  densidad: number;
}

type Punto = { x: number; y: number };

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`falta #${id} en calibracion.html`);
  return el as T;
}

function leerAjustes(): Ajustes {
  return {
    vigor: Number($<HTMLInputElement>("vigor").value),
    iteraciones: Number($<HTMLInputElement>("iteraciones").value),
    angulo: Number($<HTMLInputElement>("angulo").value),
    decaimiento: Number($<HTMLInputElement>("decaimiento").value),
    umbralDesborde: Number($<HTMLInputElement>("umbral").value),
    bufferAncho: Number($<HTMLInputElement>("ancho").value),
    bufferAlto: Number($<HTMLInputElement>("alto").value),
    densidad: Number($<HTMLInputElement>("densidad").value),
  };
}

function hexARgb(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.trim().replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function trazar(ctx: CanvasRenderingContext2D, pares: { p1: Punto; p2: Punto }[], color: string, ancho: number): void {
  if (pares.length === 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = ancho;
  ctx.beginPath();
  for (const { p1, p2 } of pares) {
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }
  ctx.stroke();
}

function construirTarjetas(): void {
  const contenedor = $("tarjetas");
  for (const slug of SLUGS_EJEMPLO) {
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta";

    const titulo = document.createElement("div");
    titulo.className = "serigrafia";
    titulo.textContent = slug;

    const lienzo = document.createElement("canvas");
    lienzo.className = "tarjeta__lienzo";
    lienzo.dataset["slug"] = slug;

    tarjeta.append(titulo, lienzo);
    contenedor.append(tarjeta);
  }
}

function dibujarTarjeta(
  canvas: HTMLCanvasElement,
  slug: string,
  ajustes: Ajustes,
  fondo: readonly [number, number, number],
  fosforo: readonly [number, number, number],
  rojo: string,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = ajustes.bufferAncho;
  canvas.height = ajustes.bufferAlto;

  const base = genoma(slug);
  // los sliders sobrescriben ángulo y decaimiento para aislar su efecto; el
  // resto de genes (curvatura, hojas, rama doble) siguen siendo de la especie.
  const g: Genoma = { ...base, angulo: ajustes.angulo, decaimiento: ajustes.decaimiento };
  const cadena = expandir(g, ajustes.iteraciones);
  const segmentos = tortuga(cadena, g, {
    longitud: LONGITUD_BASE * (0.5 + 0.5 * ajustes.vigor),
    grosor: GROSOR_BASE,
  });

  const baseX = canvas.width / 2;
  const baseY = canvas.height * 0.92;
  const escala = canvas.height * 0.85;
  const dentro = (p: Punto) => p.x >= 0 && p.x <= canvas.width && p.y >= 0 && p.y <= canvas.height;
  const puedeDesbordar = ajustes.vigor > ajustes.umbralDesborde;

  const gruesos: { p1: Punto; p2: Punto }[] = [];
  const finos: { p1: Punto; p2: Punto }[] = [];
  const fuera: { p1: Punto; p2: Punto }[] = [];

  for (const seg of segmentos as Segmento[]) {
    const p1 = { x: baseX + seg.x1 * escala, y: baseY - seg.y1 * escala };
    const p2 = { x: baseX + seg.x2 * escala, y: baseY - seg.y2 * escala };
    if (dentro(p1) && dentro(p2)) {
      (seg.nivel <= 1 ? gruesos : finos).push({ p1, p2 });
    } else {
      fuera.push({ p1, p2 });
    }
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  trazar(ctx, gruesos, "#fff", Math.max(0.8, GROSOR_BASE * escala));
  trazar(ctx, finos, "#ccc", Math.max(0.5, GROSOR_BASE * escala * 0.4));

  const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
  ctx.putImageData(tramar(imagen, fondo, fosforo, ajustes.densidad), 0, 0);

  // las ramas que se saldrían del visor se marcan en rojo y sin tramado, igual
  // que en el aparato real trepan por el chasis sin dithering de por medio.
  if (puedeDesbordar && fuera.length > 0) {
    trazar(ctx, fuera, rojo, Math.max(0.8, GROSOR_BASE * escala));
  }
}

function pintarSalidas(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>(".controles-cal input")) {
    const salida = document.querySelector(`output[for="${input.id}"]`);
    if (salida) salida.textContent = input.value;
  }
}

function dibujarTodo(): void {
  pintarSalidas();
  const ajustes = leerAjustes();
  const estilo = getComputedStyle(document.documentElement);
  const fondo = hexARgb(estilo.getPropertyValue("--pantalla"));
  const fosforo = hexARgb(estilo.getPropertyValue("--fosforo"));
  const rojo = estilo.getPropertyValue("--rojo").trim();

  for (const canvas of document.querySelectorAll<HTMLCanvasElement>(".tarjeta__lienzo")) {
    const slug = canvas.dataset["slug"]!;
    dibujarTarjeta(canvas, slug, ajustes, fondo, fosforo, rojo);
  }
}

construirTarjetas();
for (const input of document.querySelectorAll<HTMLInputElement>(".controles-cal input")) {
  input.addEventListener("input", dibujarTodo);
}
dibujarTodo();

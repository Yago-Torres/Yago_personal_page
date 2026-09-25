// El renderizador: dibuja el jardín en un buffer pequeño, lo tramea y lo vuelca
// escalado a la pantalla. Las ramas que superan el umbral de vigor se salen del
// visor y se dibujan sobre el chasis, en el canvas `.desbordes`.

import { genoma, expandir, tortuga } from "./botanica";
import type { Segmento } from "./botanica";
import { tramar, DENSIDAD_TRAMADO } from "./tramado";
import { ahora } from "./tiempo";

/* ─── calibración ───────────────────────────────────────────── */

// Resolución interna del jardín. Subirla da más nitidez antes de tramar, pero
// más píxeles que dithering y más trabajo por fotograma durante el crecimiento.
const BUFFER_ANCHO = 480;
const BUFFER_ALTO = 270;

// Fracción del alto del buffer que separa la base de las plantas del borde
// inferior, a modo de sustrato. Subirla encoge el espacio útil de crecimiento.
const MARGEN_BASE = 0.08;

// Fracción del alto del buffer que ocupa una planta de longitud normalizada 1.
// Subirla hace que las plantas desborden con menos vigor.
const ESCALA_VERTICAL = 0.85;

// Longitud y grosor del primer segmento, en unidades normalizadas de planta.
// El vigor (0..1) escala la longitud entre la mitad y el total de este valor:
// una planta con vigor 0 nunca desaparece, solo queda en la mitad de tamaño.
const LONGITUD_BASE = 0.55;
const GROSOR_BASE = 0.05;

// El vigor (0..1) mapea linealmente a iteraciones del L-system. Subir el máximo
// dispara el número de segmentos de forma exponencial (ver botanica.ts).
const ITERACIONES_MIN = 2;
const ITERACIONES_MAX = 6;

// Vigor a partir del cual una planta manda ramas fuera del visor. Bajarlo hace
// que casi cualquier planta trepe por el chasis; subirlo lo reserva a muy pocas.
const UMBRAL_DESBORDE = 0.62;

// Ventana horaria (hora local de Zaragoza) que cuenta como "de noche". Fuera de
// ese rango el jardín se trama en modo diurno.
const HORA_AMANECER = 7;
const HORA_ANOCHECER = 21;

// Milisegundos que tarda el jardín en desplegarse al montarse. Se ignora por
// completo si el visitante pide prefers-reduced-motion.
const CRECIMIENTO_MS = 2400;

// Cada cuántos milisegundos se vuelve a pintar el jardín ya crecido, solo para
// seguir el ciclo día/noche (no hay más animación continua que esa).
const REDIBUJO_MS = 20_000;

export interface Planta {
  readonly slug: string;
  /** 0..1: cuánto ha crecido y cuidado está el proyecto/planta */
  readonly vigor: number;
  /** posición horizontal normalizada dentro del visor, 0..1 */
  readonly x: number;
}

/* ─── color: los tokens de style.css, leídos en vivo ───────────────── */

function leerColor(variable: string): readonly [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ─── geometría precalculada de cada planta ────────────────────────── */

interface PlantaCalculada {
  readonly planta: Planta;
  readonly segmentos: Segmento[];
}

function calcularPlanta(planta: Planta): PlantaCalculada {
  const g = genoma(planta.slug);
  const iteraciones = Math.round(ITERACIONES_MIN + (ITERACIONES_MAX - ITERACIONES_MIN) * planta.vigor);
  const cadena = expandir(g, iteraciones);
  const segmentos = tortuga(cadena, g, {
    longitud: LONGITUD_BASE * (0.5 + 0.5 * planta.vigor),
    grosor: GROSOR_BASE,
  });
  return { planta, segmentos };
}

type Punto = { x: number; y: number };

// Agrupa segmentos en un único trazo por estilo: dibujar miles de líneas sueltas
// (una planta madura puede tener miles) con stroke() individual notaba en el
// framerate del crecimiento. Se pierde el matiz de grosor segmento a segmento,
// pero el tramado posterior ya lo difumina casi todo.
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

/* ─── montaje ───────────────────────────────────────────────────────── */

/**
 * Monta el jardín: `canvasPantalla` es el cristal (tramado, 1-bit), `canvasDesbordes`
 * es la capa transparente por encima del chasis donde trepan las ramas desbordadas.
 */
export function montarJardin(canvasPantalla: HTMLCanvasElement, canvasDesbordes: HTMLCanvasElement, plantas: Planta[]): void {
  const ctxPantalla = canvasPantalla.getContext("2d");
  const ctxDesbordes = canvasDesbordes.getContext("2d");
  const buffer = document.createElement("canvas");
  buffer.width = BUFFER_ANCHO;
  buffer.height = BUFFER_ALTO;
  const ctxBuffer = buffer.getContext("2d", { willReadFrequently: true });
  if (!ctxPantalla || !ctxDesbordes || !ctxBuffer) return;

  const reducida = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const calculadas = plantas.map(calcularPlanta);

  let rectPantalla = new DOMRect();
  let rectDesbordes = new DOMRect();

  function ajustar(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): DOMRect {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // a partir de aquí se dibuja en px CSS
    return rect;
  }

  // const, no function: así el chequeo de nulos de arriba se propaga al cerrar sobre ctxPantalla/ctxDesbordes
  const medir = (): void => {
    rectPantalla = ajustar(canvasPantalla, ctxPantalla);
    rectDesbordes = ajustar(canvasDesbordes, ctxDesbordes);
  };

  // px normalizados de una planta -> px del buffer interno
  function aBuffer(planta: Planta, x: number, y: number): Punto {
    const baseX = planta.x * BUFFER_ANCHO;
    const baseY = BUFFER_ALTO * (1 - MARGEN_BASE);
    const escala = BUFFER_ALTO * ESCALA_VERTICAL;
    return { x: baseX + x * escala, y: baseY - y * escala };
  }

  function dentroDelBuffer(p: Punto): boolean {
    return p.x >= 0 && p.x <= BUFFER_ANCHO && p.y >= 0 && p.y <= BUFFER_ALTO;
  }

  // px del buffer -> px CSS del canvas de desbordes (más grande, por encima del chasis)
  function aDesbordes(p: Punto): Punto {
    return {
      x: (p.x / BUFFER_ANCHO) * rectPantalla.width + (rectPantalla.left - rectDesbordes.left),
      y: (p.y / BUFFER_ALTO) * rectPantalla.height + (rectPantalla.top - rectDesbordes.top),
    };
  }

  const dibujar = (progreso: number): void => {
    const t = ahora();
    const esDeNoche = t.hora24 < HORA_AMANECER || t.hora24 >= HORA_ANOCHECER;

    ctxBuffer.setTransform(1, 0, 0, 1, 0, 0);
    ctxBuffer.fillStyle = "#000";
    ctxBuffer.fillRect(0, 0, BUFFER_ANCHO, BUFFER_ALTO);
    ctxBuffer.lineCap = "round";

    const tinta = leerColor("--tinta");
    ctxDesbordes.setTransform(1, 0, 0, 1, 0, 0);
    ctxDesbordes.clearRect(0, 0, canvasDesbordes.width, canvasDesbordes.height);
    ctxDesbordes.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctxDesbordes.strokeStyle = `rgb(${tinta[0]} ${tinta[1]} ${tinta[2]})`;
    ctxDesbordes.lineCap = "round";

    for (const { planta, segmentos } of calculadas) {
      const hastaIndice = Math.max(1, Math.ceil(segmentos.length * progreso));
      const puedeDesbordar = planta.vigor > UMBRAL_DESBORDE;

      const gruesos: { p1: Punto; p2: Punto }[] = [];
      const finos: { p1: Punto; p2: Punto }[] = [];

      for (let i = 0; i < hastaIndice; i++) {
        const seg = segmentos[i]!;
        const p1 = aBuffer(planta, seg.x1, seg.y1);
        const p2 = aBuffer(planta, seg.x2, seg.y2);

        if (dentroDelBuffer(p1) && dentroDelBuffer(p2)) {
          (seg.nivel <= 1 ? gruesos : finos).push({ p1, p2 });
        } else if (puedeDesbordar) {
          const d1 = aDesbordes(p1);
          const d2 = aDesbordes(p2);
          ctxDesbordes.lineWidth = Math.max(1, seg.grosor * BUFFER_ALTO * ESCALA_VERTICAL * (rectPantalla.width / BUFFER_ANCHO));
          ctxDesbordes.beginPath();
          ctxDesbordes.moveTo(d1.x, d1.y);
          ctxDesbordes.lineTo(d2.x, d2.y);
          ctxDesbordes.stroke();
        }
      }

      trazar(ctxBuffer, gruesos, "#fff", Math.max(0.8, GROSOR_BASE * BUFFER_ALTO * ESCALA_VERTICAL));
      trazar(ctxBuffer, finos, "#ccc", Math.max(0.5, GROSOR_BASE * BUFFER_ALTO * ESCALA_VERTICAL * 0.4));
    }

    const imagen = ctxBuffer.getImageData(0, 0, BUFFER_ANCHO, BUFFER_ALTO);
    const tramada = tramar(imagen, leerColor("--pantalla"), leerColor("--fosforo"), DENSIDAD_TRAMADO, esDeNoche);
    ctxBuffer.putImageData(tramada, 0, 0);

    const dpr = window.devicePixelRatio || 1;
    ctxPantalla.setTransform(1, 0, 0, 1, 0, 0);
    ctxPantalla.imageSmoothingEnabled = false;
    ctxPantalla.clearRect(0, 0, canvasPantalla.width, canvasPantalla.height);
    ctxPantalla.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxPantalla.drawImage(buffer, 0, 0, BUFFER_ANCHO, BUFFER_ALTO, 0, 0, rectPantalla.width, rectPantalla.height);
  };

  medir();

  if (reducida) {
    dibujar(1);
  } else {
    const inicio = performance.now();
    const paso = (ahoraMs: number) => {
      const progreso = Math.min(1, (ahoraMs - inicio) / CRECIMIENTO_MS);
      dibujar(progreso);
      if (progreso < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  setInterval(() => dibujar(1), REDIBUJO_MS);
  addEventListener("resize", () => {
    medir();
    dibujar(1);
  });
}

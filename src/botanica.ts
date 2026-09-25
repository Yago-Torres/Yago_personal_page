// El motor botánico: cada especie es un L-system determinista derivado del
// hash de su slug. El mismo slug da siempre la misma planta; slugs distintos
// dan plantas visiblemente distintas.

// Rango de ángulo de ramificación, en grados. Subir el máximo abre demasiado
// la copa y las ramas acaban solapándose; bajar el mínimo da plantas casi rectas.
const ANGULO_MIN = 14;
const ANGULO_MAX = 42;

// Decaimiento de longitud por nivel de ramificación (0..1). Subir el máximo
// alarga las ramas de los niveles altos: la planta tiende a salirse del visor antes.
const DECAIMIENTO_MIN = 0.55;
const DECAIMIENTO_MAX = 0.82;

// Deriva angular acumulada por cada segmento dibujado de una rama, en grados.
// Se compone a lo largo de toda la cadena de una rama (puede haber muchos
// segmentos): subir esto poco ya encoge una rama larga sobre sí misma.
const CURVATURA_MIN = -1.4;
const CURVATURA_MAX = 1.4;

// Hojas dibujadas en cada punta de rama sin desarrollar. Subir el máximo
// carga de ruido el tramado, sobre todo en plantas de pocas iteraciones.
const HOJAS_MAX = 3;

/* ─── hash determinista del slug (FNV-1a de 32 bits) ───────────────────── */

function fnv1a(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// PRNG mulberry32: pequeño, determinista y de sobra para repartir genes a partir
// de una semilla de 32 bits. No es criptográfico, no hace falta que lo sea.
function crearGenerador(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entre = (rand: () => number, min: number, max: number) => min + rand() * (max - min);

/* ─── genoma ────────────────────────────────────────────────────────── */

export interface Genoma {
  readonly slug: string;
  readonly semilla: number;
  readonly angulo: number;
  readonly decaimiento: number;
  /** decide la regla de reescritura: una rama por nudo o dos (copa más tupida) */
  readonly ramaDoble: boolean;
  readonly curvatura: number;
  readonly hojas: number;
}

/** Deriva los genes de una especie a partir de su slug. Determinista: mismo slug, misma planta. */
export function genoma(slug: string): Genoma {
  const semilla = fnv1a(slug);
  const rand = crearGenerador(semilla);
  return {
    slug,
    semilla,
    angulo: entre(rand, ANGULO_MIN, ANGULO_MAX),
    decaimiento: entre(rand, DECAIMIENTO_MIN, DECAIMIENTO_MAX),
    ramaDoble: rand() >= 0.5,
    curvatura: entre(rand, CURVATURA_MIN, CURVATURA_MAX),
    hojas: 1 + Math.floor(rand() * HOJAS_MAX),
  };
}

/* ─── L-system: reescritura ────────────────────────────────────────── */

/**
 * Reescribe el axioma `iteraciones` veces según el genoma. Puramente determinista:
 * misma cadena de entrada, mismo genoma, mismo resultado siempre.
 */
export function expandir(g: Genoma, iteraciones: number): string {
  let cadena = "X";
  for (let i = 0; i < iteraciones; i++) {
    // en las especies de una sola rama por nudo, alternar el lado en cada
    // iteración da un zigzag de helecho; si siempre gira al mismo lado, la
    // cadena principal acumula el ángulo iteración tras iteración y acaba
    // enroscada sobre sí misma en vez de subir.
    const lado = i % 2 === 0 ? "+" : "-";
    let siguiente = "";
    for (const simbolo of cadena) {
      // F es terminal (no se reescribe): si también se duplicara en cada
      // iteración, el tronco principal crecería exponencialmente y se saldría
      // del visor sin llegar a mostrar ninguna rama.
      siguiente += simbolo === "X" ? (g.ramaDoble ? "F[+X][-X]FX" : `F[${lado}X]FX`) : simbolo;
    }
    cadena = siguiente;
  }
  // las puntas que no llegaron a ramificar más florecen al final
  return cadena.replaceAll("X", "L".repeat(g.hojas));
}

/* ─── tortuga: de cadena a segmentos dibujables ────────────────────── */

export interface Segmento {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly grosor: number;
  readonly nivel: number;
}

export interface OpcionesTortuga {
  /** longitud del primer segmento, en unidades normalizadas */
  readonly longitud: number;
  /** grosor del tronco, en las mismas unidades */
  readonly grosor: number;
}

interface EstadoTortuga {
  x: number;
  y: number;
  angulo: number; // grados; 90 = hacia arriba
  longitud: number;
  grosor: number;
  nivel: number;
}

/**
 * Convierte la cadena del L-system en segmentos, con la base de la planta en (0,0)
 * y crecimiento hacia y positiva. Un vigor de 0 (longitud/grosor mínimos) sigue
 * produciendo segmentos: la planta nunca desaparece, solo se encoge.
 */
export function tortuga(cadena: string, g: Genoma, opciones: OpcionesTortuga): Segmento[] {
  const segmentos: Segmento[] = [];
  const pila: EstadoTortuga[] = [];
  let estado: EstadoTortuga = {
    x: 0,
    y: 0,
    angulo: 90,
    longitud: opciones.longitud,
    grosor: opciones.grosor,
    nivel: 0,
  };

  for (const simbolo of cadena) {
    if (simbolo === "F") {
      const rad = (estado.angulo * Math.PI) / 180;
      const x2 = estado.x + Math.cos(rad) * estado.longitud;
      const y2 = estado.y + Math.sin(rad) * estado.longitud;
      segmentos.push({ x1: estado.x, y1: estado.y, x2, y2, grosor: estado.grosor, nivel: estado.nivel });
      estado.x = x2;
      estado.y = y2;
      // la deriva vive en el propio ángulo: al ser parte de `estado` se empuja y
      // se recupera correctamente con cada rama, en vez de arrastrarse entre ramas.
      // Solo se aplica a partir del nivel 1: el tronco principal sube recto y son
      // las ramas las que se enroscan, si no la curvatura acaba encorvando el tronco.
      if (estado.nivel > 0) estado.angulo += g.curvatura;
    } else if (simbolo === "L") {
      const rad = ((estado.angulo + 90) * Math.PI) / 180;
      const largo = estado.longitud * 0.35;
      const x2 = estado.x + Math.cos(rad) * largo;
      const y2 = estado.y + Math.sin(rad) * largo;
      segmentos.push({
        x1: estado.x,
        y1: estado.y,
        x2,
        y2,
        grosor: Math.max(estado.grosor * 0.5, 0.001),
        nivel: estado.nivel + 1,
      });
    } else if (simbolo === "+") {
      estado.angulo += g.angulo;
    } else if (simbolo === "-") {
      estado.angulo -= g.angulo;
    } else if (simbolo === "[") {
      pila.push({ ...estado });
      estado.longitud *= g.decaimiento;
      estado.grosor *= g.decaimiento;
      estado.nivel += 1;
    } else if (simbolo === "]") {
      const anterior = pila.pop();
      if (anterior) estado = anterior;
    }
  }

  return segmentos;
}

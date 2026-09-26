// El intérprete de la consola: lógica pura sobre un `Estado`, sin DOM, sin
// Three.js y sin red. Quien llama a `ejecutar` es quien pinta la respuesta y
// persiste el estado (que esta función muta directamente, como haría un
// terminal real con su propia memoria).

import { ARBOLES, ARBUSTOS, ESTRATOS, ETIQUETAS, FRUTOS, SEMILLAS } from "./jardin-datos.ts";
import type { Arbol, Arbusto } from "./jardin-datos.ts";

/* ─── calibración ───────────────────────────────────────────────────── */

// Riegos que cada visitante reparte al día. Subirlo banaliza el gesto de
// regar; bajarlo demasiado deja el jardín seco casi todo el tiempo.
const CUPO_RIEGO_DIARIO = 3;

// Cuántas especies sin regar nunca se nombran en `mirar`. Subirlo satura la
// panorámica con una lista larga en vez de una pista rápida.
const MAX_ESPECIES_SEDIENTAS_EN_MIRAR = 3;

// Distancia de edición máxima para sugerir un comando parecido. Subirlo
// sugiere órdenes muy distintas entre sí y despista más de lo que ayuda.
const UMBRAL_DISTANCIA_SUGERENCIA = 2;

// Cuántas sugerencias se muestran cuando no reconoce una orden. Subirlo lista
// alternativas cada vez menos parecidas.
const MAX_SUGERENCIAS = 1;

/* ─── tipos públicos ─────────────────────────────────────────────────── */

export type Efecto =
  | { tipo: "enfocar"; slug: string } // la cámara entra en una planta
  | { tipo: "excavar" } // baja al subsuelo
  | { tipo: "subir" } // vuelve a la superficie
  | { tipo: "salir" } // sale del enfoque
  | { tipo: "regar"; slug: string }
  | { tipo: "plantar" }
  | { tipo: "sonido" };

export type Respuesta = { lineas: string[]; efecto?: Efecto };

export type Estado = {
  riegos: Record<string, number>; // riegos por slug
  riegosHoy: number;
  miRiegosRestantes: number; // 3 al día por visitante
  haPlantado: boolean;
  estacion: string;
  hora24: number;
};

/* ─── el jardín como un único índice de especies ────────────────────── */

type Especie = { tipo: "arbol"; datos: Arbol } | { tipo: "arbusto"; datos: Arbusto };

function todasLasEspecies(): Especie[] {
  return [
    ...ARBOLES.map((a): Especie => ({ tipo: "arbol", datos: a })),
    ...ARBUSTOS.map((a): Especie => ({ tipo: "arbusto", datos: a })),
  ];
}

function buscarEspecie(slug: string): Especie | undefined {
  return todasLasEspecies().find((e) => e.datos.slug === slug);
}

/* ─── comandos que existen de verdad ─────────────────────────────────── */

// Los dos únicos comandos cuyo segundo campo es el slug de una especie, para
// que el autocompletado también complete ahí.
const COMANDOS_CON_SLUG: string[] = ["regar", "abrir"];

export const COMANDOS: { nombre: string; uso: string; ayuda: string }[] = [
  { nombre: "ayuda", uso: "ayuda", ayuda: "lista lo que este aparato entiende." },
  {
    nombre: "mirar",
    uso: "mirar",
    ayuda: "una panorámica del jardín: especies, estación, hora y quién pide agua.",
  },
  { nombre: "regar", uso: "regar <especie>", ayuda: "le da agua a una especie. hay un cupo diario." },
  { nombre: "abrir", uso: "abrir <especie>", ayuda: "abre la ficha de una especie y acerca la cámara." },
  { nombre: "plantar", uso: "plantar", ayuda: "entierra tu semilla en el jardín. una por visitante." },
  { nombre: "excavar", uso: "excavar", ayuda: "baja al subsuelo y muestra los estratos." },
  { nombre: "subir", uso: "subir", ayuda: "vuelve del subsuelo a la superficie." },
  {
    nombre: "etiquetas",
    uso: "etiquetas",
    ayuda: "las certificaciones clavadas en el sustrato, obtenidas y pendientes.",
  },
  { nombre: "historia", uso: "historia", ayuda: "los frutos y las semillas del jardín, en orden." },
  { nombre: "salir", uso: "salir", ayuda: "sale del enfoque sobre una especie." },
  { nombre: "sonido", uso: "sonido", ayuda: "activa o silencia el sonido del aparato." },
];

// Comandos de otra vida que aquí no existen. Cada uno responde distinto para
// que no suene a un único mensaje de error reciclado.
const UNIX_IMPOSTORES: Record<string, string> = {
  whoami: "esto no es una terminal. es una consola de riego, y aquí no hay usuarios, solo visitantes.",
  ls: "no hay directorios que listar. hay especies. prueba «mirar».",
  cd: "aquí no se navega por carpetas, se baja al sustrato. prueba «excavar» o «subir».",
  sudo: "nadie administra un jardín. el agua se reparte igual para todos.",
  pwd: "estás de pie frente al aparato, delante del jardín. esa es toda la ruta que hay.",
  cat: "no hay ficheros que mostrar. si quieres leer algo, prueba «abrir» una especie.",
  rm: "aquí no se borra nada vivo.",
  help: "eso se dice «ayuda» en este jardín.",
  man: "no hay manual, solo un aparato y lo que crece a su alrededor. prueba «ayuda».",
  exit: "eso se dice «salir» aquí dentro.",
};

/* ─── distancia de edición, para sugerir el comando parecido ────────── */

function distanciaEdicion(a: string, b: string): number {
  const filas: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) filas[i]![0] = i;
  for (let j = 0; j <= b.length; j++) filas[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      filas[i]![j] = Math.min(
        filas[i - 1]![j]! + 1, // borrar
        filas[i]![j - 1]! + 1, // insertar
        filas[i - 1]![j - 1]! + coste, // sustituir
      );
    }
  }
  return filas[a.length]![b.length]!;
}

function comandoParecido(entrada: string): string | null {
  const candidatos = COMANDOS.map((c) => ({ nombre: c.nombre, distancia: distanciaEdicion(entrada, c.nombre) }))
    .filter((c) => c.distancia <= UMBRAL_DISTANCIA_SUGERENCIA)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, MAX_SUGERENCIAS);
  return candidatos[0]?.nombre ?? null;
}

/* ─── cada comando ───────────────────────────────────────────────────── */

function ayuda(): Respuesta {
  return { lineas: ["comandos de esta consola:", ...COMANDOS.map((c) => `${c.uso} — ${c.ayuda}`)] };
}

function mirar(estado: Estado): Respuesta {
  const totalEspecies = ARBOLES.length + ARBUSTOS.length;
  const sedientas = todasLasEspecies()
    .filter((e) => !((estado.riegos[e.datos.slug] ?? 0) > 0))
    .slice(0, MAX_ESPECIES_SEDIENTAS_EN_MIRAR)
    .map((e) => e.datos.nombre);

  const lineas = [
    `${totalEspecies} especies creciendo. estación: ${estado.estacion}. son las ${estado.hora24}h en zaragoza.`,
    `hoy se ha regado ${estado.riegosHoy} ${estado.riegosHoy === 1 ? "vez" : "veces"}.`,
  ];
  if (sedientas.length > 0) {
    lineas.push(`piden agua: ${sedientas.join(", ")}.`);
  } else {
    lineas.push("todo el jardín ha recibido agua alguna vez.");
  }
  return { lineas };
}

function regar(slug: string, estado: Estado): Respuesta {
  if (!slug) return { lineas: ["dime a qué especie le echas el agua. por ejemplo: regar capgemini."] };
  const especie = buscarEspecie(slug);
  if (!especie) return { lineas: [`no crece ninguna especie llamada «${slug}» en este jardín.`] };
  if (estado.miRiegosRestantes <= 0) {
    return { lineas: [`ya has repartido tus ${CUPO_RIEGO_DIARIO} riegos de hoy. vuelve mañana.`] };
  }
  estado.riegos[slug] = (estado.riegos[slug] ?? 0) + 1;
  estado.riegosHoy += 1;
  estado.miRiegosRestantes -= 1;
  return {
    lineas: [`riegas ${especie.datos.nombre}. te quedan ${estado.miRiegosRestantes} riegos hoy.`],
    efecto: { tipo: "regar", slug },
  };
}

function abrir(slug: string): Respuesta {
  if (!slug) return { lineas: ["dime qué especie quieres abrir. por ejemplo: abrir capgemini."] };
  const especie = buscarEspecie(slug);
  if (!especie) return { lineas: [`no crece ninguna especie llamada «${slug}» en este jardín.`] };

  if (especie.tipo === "arbol") {
    const a = especie.datos;
    const fechas = a.hasta ? `de ${a.desde} a ${a.hasta}.` : `desde ${a.desde}, sigue en pie.`;
    return {
      lineas: [`${a.nombre} — ${a.rol}.`, fechas, a.resumen, "notas:", ...a.notas.map((n) => `- ${n.texto}`)],
      efecto: { tipo: "enfocar", slug: a.slug },
    };
  }
  const b = especie.datos;
  return {
    lineas: [`${b.nombre}.`, b.resumen, b.repo ? `repositorio: ${b.repo}.` : "sin repositorio público todavía."],
    efecto: { tipo: "enfocar", slug: b.slug },
  };
}

function plantar(estado: Estado): Respuesta {
  if (estado.haPlantado) {
    return { lineas: ["ya plantaste tu semilla en este jardín. una por visitante."] };
  }
  estado.haPlantado = true;
  return { lineas: ["entierras una semilla nueva en el sustrato.", "con tiempo, algo crecerá ahí."], efecto: { tipo: "plantar" } };
}

function excavar(): Respuesta {
  const estratos = [...ESTRATOS].sort((a, b) => b.peso - a.peso);
  return {
    lineas: ["bajas al subsuelo. esto es de lo que está hecho el jardín, de arriba abajo:", ...estratos.map((e) => `- ${e.nombre}`)],
    efecto: { tipo: "excavar" },
  };
}

function subir(): Respuesta {
  return { lineas: ["subes de vuelta a la superficie."], efecto: { tipo: "subir" } };
}

function etiquetas(): Respuesta {
  const obtenidas = ETIQUETAS.filter((e) => e.estado === "obtenida");
  const pendientes = ETIQUETAS.filter((e) => e.estado === "pendiente");
  const lineas = ["etiquetas clavadas en el sustrato:"];
  for (const e of obtenidas) lineas.push(`- ${e.codigo}: ${e.nombre}, obtenida en ${e.fecha}.`);
  for (const e of pendientes) lineas.push(`- ${e.codigo}: ${e.nombre}, pendiente todavía.`);
  if (obtenidas.length === 0) lineas.push("ninguna clavada de verdad todavía: todas están en blanco.");
  return { lineas };
}

function historia(): Respuesta {
  const hitos = [
    ...FRUTOS.map((f) => ({ fecha: f.fecha, texto: `${f.fecha}: ${f.nombre}, en ${f.lugar}.` })),
    ...SEMILLAS.map((s) => {
      const fecha = s.desde ?? s.hasta;
      return {
        fecha: fecha ?? "", // sin fecha: se cuenta como lo más antiguo, al fondo de la historia
        texto: fecha ? `${fecha}: ${s.nombre}, en ${s.lugar}.` : `${s.nombre}, en ${s.lugar}.`,
      };
    }),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { lineas: ["frutos y semillas del jardín, en orden:", ...hitos.map((h) => `- ${h.texto}`)] };
}

function salir(): Respuesta {
  return { lineas: ["sales del enfoque."], efecto: { tipo: "salir" } };
}

function sonido(): Respuesta {
  return { lineas: ["un clic. el sonido cambia de estado."], efecto: { tipo: "sonido" } };
}

function desconocido(comando: string): Respuesta {
  const parecido = comandoParecido(comando);
  if (parecido) return { lineas: [`no existe la orden «${comando}». ¿quisiste decir «${parecido}»?`] };
  return { lineas: ["no reconozco esa orden. escribe «ayuda» para ver qué entiende el aparato."] };
}

/* ─── entrada pública ─────────────────────────────────────────────────── */

export function ejecutar(entrada: string, estado: Estado): Respuesta {
  const partes = entrada.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const comando = partes[0];
  if (!comando) return { lineas: ["di algo. o escribe «ayuda» si no sabes por dónde empezar."] };
  const arg = partes.slice(1).join(" ");

  const impostor = UNIX_IMPOSTORES[comando];
  if (impostor) return { lineas: [impostor] };

  switch (comando) {
    case "ayuda":
      return ayuda();
    case "mirar":
      return mirar(estado);
    case "regar":
      return regar(arg, estado);
    case "abrir":
      return abrir(arg);
    case "plantar":
      return plantar(estado);
    case "excavar":
      return excavar();
    case "subir":
      return subir();
    case "etiquetas":
      return etiquetas();
    case "historia":
      return historia();
    case "salir":
      return salir();
    case "sonido":
      return sonido();
    default:
      return desconocido(comando);
  }
}

export function completar(entrada: string): string | null {
  const partes = entrada.toLowerCase().split(" ");
  const primera = partes[0] ?? "";

  if (partes.length === 1) {
    if (!primera) return null;
    const candidatos = COMANDOS.map((c) => c.nombre).filter((n) => n.startsWith(primera) && n !== primera);
    return candidatos.length === 1 ? candidatos[0]! : null;
  }

  if (partes.length === 2 && COMANDOS_CON_SLUG.includes(primera)) {
    const segunda = partes[1] ?? "";
    const slugs = todasLasEspecies().map((e) => e.datos.slug);
    const candidatos = slugs.filter((s) => s.startsWith(segunda) && s !== segunda);
    return candidatos.length === 1 ? `${primera} ${candidatos[0]!}` : null;
  }

  return null;
}

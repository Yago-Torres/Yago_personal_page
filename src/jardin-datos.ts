// El contenido del jardín. Esto es el CV, escrito como botánica.
//
// Árboles = etapas profesionales (la copa crece con los años allí).
// Arbustos = proyectos, y cuelgan del árbol donde se hicieron.
// Estratos = el stack, el corte del subsuelo.
// Semillas = formación, más abajo todavía.
// Frutos = lo que el jardín ya ha dado.
// Etiquetas = certificaciones, clavadas en el sustrato, con su caducidad.

export type Arbusto = { slug: string; nombre: string; resumen: string };

export type Arbol = {
  slug: string;
  nombre: string;
  rol: string;
  desde: string;          // AAAA-MM
  hasta?: string;         // ausente = sigue vivo
  resumen: string;
  proyectos: Arbusto[];
};

export type Estrato = { nombre: string; peso: number };  // peso relativo del estrato
export type Semilla = { nombre: string; lugar: string; desde: string; hasta: string };
export type Fruto = { nombre: string; lugar: string; fecha: string };
export type Etiqueta = {
  codigo: string;
  nombre: string;
  estado: "obtenida" | "pendiente";
  fecha?: string;
  caduca?: string;
};

export const ARBOLES: Arbol[] = [
  {
    slug: "capgemini",
    nombre: "Capgemini",
    rol: "Equipo GenAI",
    desde: "2026-09",
    resumen: "IA generativa, devops, agentes y automatización.",
    // ponytail: pendiente de que Yago liste los proyectos concretos.
    proyectos: [],
  },
  {
    slug: "inetum",
    nombre: "INETUM",
    rol: "Becario de análisis documental con IA",
    desde: "2024-06",
    hasta: "2024-08",
    resumen:
      "Equipo de análisis documental con IA, sobre una herramienta usada por varias " +
      "instituciones públicas españolas. Desarrollé una versión on-premise de toda la " +
      "infraestructura Azure de análisis y clasificación.",
    proyectos: [],
  },
  {
    slug: "urtats",
    nombre: "Urtats",
    rol: "Socorrista",
    desde: "2023-05",
    hasta: "2023-08",
    resumen:
      "Socorrista titulado en piscinas cubiertas y descubiertas. Seguridad acuática, " +
      "respuesta ante emergencias, RCP, primeros auxilios y uso de desfibrilador.",
    proyectos: [],
  },
];

export const ESTRATOS: Estrato[] = [
  { nombre: "Linux y administración de sistemas", peso: 3 },
  { nombre: "Docker · Kubernetes · Terraform · OpenStack · FreeIPA", peso: 3 },
  { nombre: "Python · IA generativa · agentes", peso: 3 },
  { nombre: "Go", peso: 2 },
  { nombre: "C · C++ · Java · Ensamblador", peso: 2 },
  { nombre: "JavaScript · React · Next", peso: 2 },
  { nombre: "SQL", peso: 1 },
  { nombre: "Haskell", peso: 1 },
];

// Una sola carrera, dos sitios: el último año en Konstanz.
export const SEMILLAS: Semilla[] = [
  {
    nombre: "Grado en Ingeniería Informática",
    lugar: "Universidad de Zaragoza",
    desde: "2022-09",
    hasta: "2025-07",
  },
  {
    nombre: "Grado en Ingeniería Informática · último curso",
    lugar: "Universität Konstanz, Alemania",
    desde: "2025-09",
    hasta: "2026-06",
  },
  {
    nombre: "Inglés C1 · Alemán B1",
    lugar: "Escuela Oficial de Idiomas",
    desde: "",
    hasta: "",
  },
  {
    nombre: "Estudios profesionales de música",
    lugar: "Conservatorio de Tudela",
    desde: "",
    hasta: "2012-06",
  },
];

export const FRUTOS: Fruto[] = [
  { nombre: "Olimpiada de programación de Navarra · ganador", lugar: "UPNA", fecha: "2022-06" },
  { nombre: "NASA Space Apps Challenge", lugar: "Etopía, Zaragoza", fecha: "2024-04" },
  { nombre: "Premio de música Fernando Remacha", lugar: "Conservatorio de Tudela", fecha: "2012-06" },
  { nombre: "Bachillerato British Council", lugar: "IES Benjamín de Tudela", fecha: "2022-06" },
];

// Las cuatro están pendientes: se dibujan como etiquetas en blanco, sin clavar.
export const ETIQUETAS: Etiqueta[] = [
  { codigo: "AZ-900", nombre: "Azure Fundamentals", estado: "pendiente" },
  { codigo: "AI-900", nombre: "Azure AI Fundamentals", estado: "pendiente" },
  { codigo: "AZ-104", nombre: "Azure Administrator Associate", estado: "pendiente" },
  { codigo: "GH-200", nombre: "GitHub Actions", estado: "pendiente" },
];

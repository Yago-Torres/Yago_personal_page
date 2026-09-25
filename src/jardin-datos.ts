// El contenido del jardín. Esto es el CV, escrito como botánica.
//
// Árboles   = etapas profesionales. No llevan proyectos con nombre: el trabajo
//             de cliente es confidencial. Llevan NOTAS: qué hice, qué usé y qué
//             aprendí allí. Un árbol crece añadiéndole notas.
// Arbustos  = proyectos personales y públicos, los que sí se pueden enseñar.
// Estratos  = el stack, el corte del subsuelo. Las notas apuntan a ellos.
// Semillas  = formación, más abajo todavía.
// Frutos    = lo que el jardín ya ha dado.
// Etiquetas = certificaciones, clavadas en el sustrato, con su caducidad.
//
// Para actualizar el jardín se edita este fichero y se hace push: el despliegue
// es automático. No hay panel de administración y no hace falta.

/** Identificadores de los estratos, para que las notas no los referencien a ciegas. */
export type SlugEstrato =
  | "linux" | "infra" | "ia" | "go" | "sistemas" | "web" | "sql" | "funcional";

export type Estrato = { slug: SlugEstrato; nombre: string; peso: number };

/** Lo que hiciste, usaste o aprendiste en una etapa. La unidad que irás añadiendo. */
export type Nota = {
  texto: string;
  usado?: SlugEstrato[];
};

export type Arbol = {
  slug: string;
  nombre: string;
  rol: string;
  desde: string;          // AAAA-MM
  hasta?: string;         // ausente = sigue vivo
  resumen: string;
  notas: Nota[];
};

/** Proyecto personal o público: estos sí tienen nombre y enlace. */
export type Arbusto = {
  slug: string;
  nombre: string;
  resumen: string;
  repo?: string;
  usado?: SlugEstrato[];
};

export type Semilla = { nombre: string; lugar: string; desde?: string; hasta?: string };
export type Fruto = { nombre: string; lugar: string; fecha: string };
export type Etiqueta = {
  codigo: string;
  nombre: string;
  estado: "obtenida" | "pendiente";
  fecha?: string;
  caduca?: string;
};

// ponytail: las notas de abajo están sacadas del CV para que el jardín no salga
// pelado. Son un borrador: reescríbelas en primera persona y con lo que de
// verdad te llevaste de cada sitio. Nada de nombres de cliente ni de proyecto.
export const ARBOLES: Arbol[] = [
  {
    slug: "capgemini",
    nombre: "Capgemini",
    rol: "Equipo GenAI",
    desde: "2026-09",
    resumen: "IA generativa, devops, agentes y automatización.",
    notas: [
      { texto: "Desarrollo de agentes y automatización sobre IA generativa.", usado: ["ia"] },
      { texto: "Prácticas de devops en el ciclo de vida de producto.", usado: ["infra", "linux"] },
    ],
  },
  {
    slug: "inetum",
    nombre: "INETUM",
    rol: "Becario de análisis documental con IA",
    desde: "2024-06",
    hasta: "2024-08",
    resumen: "Análisis y clasificación documental con IA para instituciones públicas.",
    notas: [
      {
        texto:
          "Llevé una infraestructura de análisis documental de la nube a on-premise, " +
          "replicando el comportamiento de los servicios gestionados.",
        usado: ["infra", "linux", "ia"],
      },
      { texto: "Primer contacto real con metodologías ágiles y pipelines de CI/CD.", usado: ["infra"] },
      { texto: "Aprendí que la parte difícil de la IA en producción no es el modelo.", usado: ["ia"] },
    ],
  },
  {
    slug: "urtats",
    nombre: "Urtats",
    rol: "Socorrista",
    desde: "2023-05",
    hasta: "2023-08",
    resumen: "Socorrista titulado en piscinas cubiertas y descubiertas.",
    notas: [
      { texto: "Seguridad acuática, respuesta ante emergencias, RCP y desfibrilador." },
      { texto: "Trabajo en equipo con responsabilidad real sobre personas." },
    ],
  },
];

// ponytail: sacados de los repos públicos de github.com/Yago-Torres.
// Poda los que no quieras enseñar y escribe un resumen decente de los que sí.
export const ARBUSTOS: Arbusto[] = [
  {
    slug: "yagotg-dev",
    nombre: "yagotg.dev",
    resumen: "Este jardín. Diorama en 3D donde las plantas son mi carrera.",
    repo: "Yago-Torres/Yago_personal_page",
    usado: ["web"],
  },
  {
    slug: "rustytype",
    nombre: "rustytype",
    resumen: "Aplicación de terminal para practicar mecanografía, inspirada en Monkeytype.",
    repo: "Yago-Torres/rustytype",
  },
  {
    slug: "bloste",
    nombre: "Bloste",
    resumen: "Implementación de la librería Bloste.",
    repo: "Yago-Torres/Bloste",
  },
  {
    slug: "nebulin",
    nombre: "nebulin",
    resumen: "Pendiente de describir.",
    repo: "Yago-Torres/nebulin",
    usado: ["web"],
  },
];

export const ESTRATOS: Estrato[] = [
  { slug: "linux",     nombre: "Linux y administración de sistemas", peso: 3 },
  { slug: "infra",     nombre: "Docker · Kubernetes · Terraform · OpenStack · FreeIPA", peso: 3 },
  { slug: "ia",        nombre: "IA generativa · agentes · Python", peso: 3 },
  { slug: "go",        nombre: "Go", peso: 2 },
  { slug: "sistemas",  nombre: "C · C++ · Java · Ensamblador", peso: 2 },
  { slug: "web",       nombre: "JavaScript · TypeScript · React · Next", peso: 2 },
  { slug: "sql",       nombre: "SQL", peso: 1 },
  { slug: "funcional", nombre: "Haskell", peso: 1 },
];

// Una sola carrera, dos sitios: el último curso en Konstanz.
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
  { nombre: "Inglés C1 · Alemán B1", lugar: "Escuela Oficial de Idiomas" },
  { nombre: "Estudios profesionales de música", lugar: "Conservatorio de Tudela", hasta: "2012-06" },
];

export const FRUTOS: Fruto[] = [
  { nombre: "Olimpiada de programación de Navarra · ganador", lugar: "UPNA", fecha: "2022-06" },
  { nombre: "NASA Space Apps Challenge", lugar: "Etopía, Zaragoza", fecha: "2024-04" },
  { nombre: "Premio de música Fernando Remacha", lugar: "Conservatorio de Tudela", fecha: "2012-06" },
  { nombre: "Bachillerato British Council", lugar: "IES Benjamín de Tudela", fecha: "2022-06" },
];

// Las cuatro pendientes: se dibujan como etiquetas en blanco, sin clavar.
export const ETIQUETAS: Etiqueta[] = [
  { codigo: "AZ-900", nombre: "Azure Fundamentals", estado: "pendiente" },
  { codigo: "AI-900", nombre: "Azure AI Fundamentals", estado: "pendiente" },
  { codigo: "AZ-104", nombre: "Azure Administrator Associate", estado: "pendiente" },
  { codigo: "GH-200", nombre: "GitHub Actions", estado: "pendiente" },
];

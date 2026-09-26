// El aparato: escena, cámara y mandos.
//
// En escritorio la interfaz se proyecta sobre la pantalla del aparato. En un
// móvil eso no se puede usar, así que la misma interfaz se sirve como hoja
// inferior y la cámara deja el diorama arriba.

import {
  ACESFilmicToneMapping,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  PCFSoftShadowMap,
  Raycaster,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { ahora } from "../tiempo.ts";
import { construirEscena, CALIBRACION as ESCENA, type Interactivo } from "./escena.ts";
import { montarInterfaz } from "./interfaz.ts";
import { COLORES, montarMensaje } from "./mensaje.ts";
import { consultarMeteo, NOMBRES, RESERVA, type Meteo } from "./meteo.ts";
import { TramadoShader, CALIBRACION as TRAMA } from "./tramado.ts";

export const CALIBRACION = {
  // Suavizado de la cámara por fotograma. Subirlo la hace más seca.
  SUAVIZADO: 0.07,
  // Altura de la cámara sobre el visor al enfocarlo. Bajarlo lo agranda.
  ALTURA_VISOR: 9.0,
  // Retranqueo del enfoque. A 0 la cámara cae a plomo.
  SESGO_VISOR: 2.9,
  // Margen que se recorta del visor para que no se monte sobre el bisel.
  MARGEN_VISOR: 0.94,
  // En móvil la cámara se aleja y sube la mira, para dejar sitio a la hoja.
  ALTURA_MOVIL: 15,
  ALZADO_MOVIL: 3.4,
  // Riegos que puede repartir cada visitante al día.
  CUPO_RIEGO: 3,
  // Cada cuánto se vuelve a consultar el tiempo de Zaragoza, en minutos.
  REFRESCO_METEO: 10,
};

const esMovil = () => matchMedia("(max-width: 820px), (pointer: coarse)").matches;
let movil = esMovil();

const lienzo = document.getElementById("lienzo") as HTMLCanvasElement;

const renderer = new WebGLRenderer({ canvas: lienzo, antialias: !movil });
renderer.setPixelRatio(Math.min(devicePixelRatio, movil ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const { scene, camera, diorama, interactivos, cielo, pantalla } = construirEscena(
  innerWidth / innerHeight,
  renderer,
);

const cartel = montarMensaje(diorama);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const pasoTramado = new ShaderPass(TramadoShader);
composer.addPass(pasoTramado);

function medir() {
  movil = esMovil();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.85 ? 32 : 24;
  camera.updateProjectionMatrix();
  pasoTramado.uniforms["uResolucion"]!.value = new Vector2(innerWidth, innerHeight);
  cartel.escalar(Math.min(1, camera.aspect * 1.15));
  visor.classList.toggle("hoja", movil);
  if (movil) medirHoja();
  if (!abierto) objetivo = vistaGeneral();
}
addEventListener("resize", medir);

/* ─── vistas ────────────────────────────────────────────────── */

type Vista = { pos: Vector3; mira: Vector3; quieto: boolean };

function vistaGeneral(): Vista {
  // en vertical el objetivo recorta mucho de ancho: hay que retirarse
  const estrechez = Math.max(1, 0.76 / Math.max(camera.aspect, 0.3));
  const lejos = ESCENA.DISTANCIA * estrechez;
  return {
    pos: new Vector3(lejos * 0.62, lejos * ESCENA.ALTURA, lejos * 0.62),
    mira: new Vector3(0, movil ? -3.4 : -0.7, 0),
    quieto: false,
  };
}

/** Encuadre sobre el visor. En móvil se aleja y sube la mira. */
function vistaVisor(): Vista {
  const centro = pantalla.getWorldPosition(new Vector3());
  if (movil) {
    return {
      pos: new Vector3(centro.x, centro.y + CALIBRACION.ALTURA_MOVIL, centro.z + 7),
      mira: new Vector3(centro.x, centro.y - CALIBRACION.ALZADO_MOVIL, centro.z),
      quieto: true,
    };
  }
  return {
    pos: new Vector3(
      centro.x,
      centro.y + CALIBRACION.ALTURA_VISOR,
      centro.z + CALIBRACION.SESGO_VISOR,
    ),
    mira: centro.clone(),
    quieto: true,
  };
}

let objetivo: Vista = vistaGeneral();
const posActual = objetivo.pos.clone();
const miraActual = objetivo.mira.clone();
let abierto = false;

const visor = document.getElementById("visor")!;
const salir = document.getElementById("salir")!;

// Tiempo que tarda la interfaz en encenderse: que aparezca cuando la cámara
// ya casi ha llegado, no a mitad de viaje.
const ESPERA_VISOR = 420;
let encendido: ReturnType<typeof setTimeout> | undefined;

function abrir() {
  objetivo = { ...vistaVisor(), quieto: true };
  abierto = true;
  visor.classList.add("montado");
  visor.classList.toggle("hoja", movil);
  salir.classList.add("visible");
  if (movil) medirHoja();
  clearTimeout(encendido);
  encendido = setTimeout(() => visor.classList.add("visible"), movil ? 120 : ESPERA_VISOR);
}

function cerrar() {
  objetivo = vistaGeneral();
  abierto = false;
  clearTimeout(encendido);
  visor.classList.remove("montado", "visible");
  salir.classList.remove("visible");
}

/* ─── colocación de la interfaz ─────────────────────────────── */

// Esquinas de la cara superior de la pantalla, en su propio espacio local.
const ESQUINAS = [
  new Vector3(-1.15, 0.05, -0.8),
  new Vector3(1.15, 0.05, -0.8),
  new Vector3(1.15, 0.05, 0.8),
  new Vector3(-1.15, 0.05, 0.8),
];
const proyectada = new Vector3();

/** En móvil la interfaz es una hoja inferior y no se proyecta. */
function medirHoja() {
  visor.style.left = "";
  visor.style.top = "";
  visor.style.width = "";
  visor.style.height = "";
  visor.style.setProperty("--u", `${Math.min(innerWidth, 560) / 46}px`);
}

function colocarVisor() {
  if (!abierto || movil) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const esquina of ESQUINAS) {
    proyectada.copy(esquina).applyMatrix4(pantalla.matrixWorld).project(camera);
    const x = ((proyectada.x + 1) / 2) * innerWidth;
    const y = ((1 - proyectada.y) / 2) * innerHeight;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const ancho = (maxX - minX) * CALIBRACION.MARGEN_VISOR;
  const alto = (maxY - minY) * CALIBRACION.MARGEN_VISOR;
  visor.style.left = `${minX + (maxX - minX - ancho) / 2}px`;
  visor.style.top = `${minY + (maxY - minY - alto) / 2}px`;
  visor.style.width = `${ancho}px`;
  visor.style.height = `${alto}px`;
  // la tipografía escala con la pantalla, no con la ventana
  visor.style.setProperty("--u", `${alto / 38}px`);
}

/* ─── estado del jardín ─────────────────────────────────────── */

// Mientras no exista el Worker, esto vive en tu navegador. Con D1 pasa a ser
// estado compartido y el mensaje necesitará moderación antes de publicarse.
const LLAVE = "ytg01.jardin";

type Guardado = {
  riegos: Record<string, number>;
  restantes: number;
  dia: string;
  marca: { texto: string; color: number };
};

const hoy = () => new Date().toISOString().slice(0, 10);

function cargar(): Guardado {
  const base: Guardado = {
    riegos: {},
    restantes: CALIBRACION.CUPO_RIEGO,
    dia: hoy(),
    marca: { texto: "", color: 0 },
  };
  try {
    const crudo = localStorage.getItem(LLAVE);
    if (!crudo) return base;
    const g = JSON.parse(crudo) as Partial<Guardado>;
    return {
      riegos: g.riegos ?? {},
      restantes: g.dia === hoy() ? (g.restantes ?? CALIBRACION.CUPO_RIEGO) : CALIBRACION.CUPO_RIEGO,
      dia: hoy(),
      marca: g.marca ?? base.marca,
    };
  } catch {
    return base;
  }
}

const estado = cargar();

function guardar() {
  try {
    localStorage.setItem(LLAVE, JSON.stringify(estado));
  } catch {
    // navegación privada o almacenamiento bloqueado: el jardín sigue andando
  }
}

/* ─── respingos y flores ────────────────────────────────────── */

const palmadas = new Map<Object3D, number>();

function senalar(slug: string) {
  const destino = interactivos.find((i) => i.slug === slug);
  if (destino) palmadas.set(destino.malla, 0);
}

let miFlor: Group | undefined;

/** La flor del visitante, del color que haya elegido. */
function plantarFlor(color: number) {
  const tono = COLORES[color] ?? COLORES[0]!;
  if (!miFlor) {
    const a = Math.random() * Math.PI * 2;
    miFlor = new Group();
    const tallo = new Mesh(
      new CylinderGeometry(0.025, 0.035, 0.4, 10),
      new MeshPhysicalMaterial({ color: new Color("#5fbe4e"), roughness: 0.3, clearcoat: 1 }),
    );
    tallo.position.y = 0.2;
    const petalo = new Mesh(
      new SphereGeometry(0.14, 18, 12),
      new MeshPhysicalMaterial({ roughness: 0.12, clearcoat: 1, iridescence: 0.5 }),
    );
    petalo.name = "petalo";
    petalo.position.y = 0.44;
    miFlor.add(tallo, petalo);
    miFlor.position.set(Math.cos(a) * 5.05, 0, Math.sin(a) * 5.05);
    miFlor.castShadow = true;
    diorama.add(miFlor);
  }
  const petalo = miFlor.getObjectByName("petalo") as Mesh | undefined;
  if (petalo) (petalo.material as MeshPhysicalMaterial).color.set(tono.flor);
  miFlor.visible = true;
}

/* ─── la interfaz ───────────────────────────────────────────── */

const pz = montarInterfaz(document.getElementById("visor-interior")!, {
  senalar,
  regar: (slug) => {
    if (estado.restantes <= 0) {
      return {
        ok: false,
        riegos: estado.riegos[slug] ?? 0,
        restantes: 0,
        aviso: "el depósito está vacío. vuelve mañana.",
      };
    }
    estado.riegos[slug] = (estado.riegos[slug] ?? 0) + 1;
    estado.restantes -= 1;
    guardar();
    senalar(slug);
    return {
      ok: true,
      riegos: estado.riegos[slug]!,
      restantes: estado.restantes,
      aviso: `se yergue. te quedan ${estado.restantes} riegos hoy.`,
    };
  },
  dejarMarca: (texto, color) => {
    estado.marca = { texto, color };
    guardar();
    cartel.poner(texto, COLORES[color] ?? COLORES[0]!);
    if (texto.trim()) plantarFlor(color);
    else if (miFlor) miFlor.visible = false;
  },
  marca: () => estado.marca,
  riegosDe: (slug) => estado.riegos[slug] ?? 0,
  riegosRestantes: () => estado.restantes,
});

// si ya dejaste marca en otra visita, sigue ahí
if (estado.marca.texto.trim()) {
  cartel.poner(estado.marca.texto, COLORES[estado.marca.color] ?? COLORES[0]!);
  plantarFlor(estado.marca.color);
}

/* ─── señalar y pulsar ──────────────────────────────────────── */

const rayo = new Raycaster();
const puntero = new Vector2();
let senalado: Interactivo | null = null;
let hayPuntero = false;
let objetivoX = 0;
let objetivoY = 0;

const pista = document.getElementById("pista")!;

addEventListener("pointermove", (e) => {
  if (e.pointerType === "touch") return;
  hayPuntero = true;
  puntero.x = (e.clientX / innerWidth) * 2 - 1;
  puntero.y = -(e.clientY / innerHeight) * 2 + 1;
  objetivoX = (e.clientX / innerWidth - 0.5) * 2;
  objetivoY = (e.clientY / innerHeight - 0.5) * 2;
});

function bajoElPuntero(): Interactivo | null {
  rayo.setFromCamera(puntero, camera);
  const toca = rayo.intersectObjects(interactivos.map((i) => i.malla), true)[0];
  if (!toca) return null;
  for (let o: Object3D | null = toca.object; o; o = o.parent) {
    const encontrado = interactivos.find((i) => i.malla === o);
    if (encontrado) return encontrado;
  }
  return null;
}

function repasarSenalado() {
  if (!hayPuntero || abierto || movil) {
    if (senalado) {
      senalado = null;
      pista.classList.remove("visible");
      document.body.style.cursor = "default";
    }
    return;
  }
  const nuevo = bajoElPuntero();
  if (nuevo !== senalado) {
    senalado = nuevo;
    document.body.style.cursor = nuevo ? "pointer" : "default";
    pista.textContent = nuevo?.etiqueta ?? "";
    pista.classList.toggle("visible", Boolean(nuevo));
  }
}

function pulsar(x: number, y: number) {
  if (abierto) return;
  puntero.x = (x / innerWidth) * 2 - 1;
  puntero.y = -(y / innerHeight) * 2 + 1;
  const tocado = bajoElPuntero();
  if (!tocado) return;

  abrir();
  if (tocado.slug) pz.abrirFicha(tocado.slug);
  else pz.abrirIndice();
}

lienzo.addEventListener("pointerup", (e) => pulsar(e.clientX, e.clientY));

addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrar();
});
salir.addEventListener("click", cerrar);

/* ─── el tiempo de Zaragoza ─────────────────────────────────── */

let meteo: Meteo = RESERVA;
// -1 devuelve el control a la lectura real de Zaragoza.
let horaForzada = -1;
let nubesForzadas = -1;
let lluviaForzada = -1;

const lecturas = {
  meteo: document.getElementById("lectura-meteo"),
  temperatura: document.getElementById("lectura-temperatura"),
  hora: document.getElementById("lectura-hora"),
  estacion: document.getElementById("lectura-estacion"),
};

function pintarLecturas() {
  const t = ahora();
  const hora = horaForzada < 0 ? t.hora24 : horaForzada;
  const lluvia = lluviaForzada < 0 ? meteo.precipitacion : lluviaForzada;
  const nubosidad = nubesForzadas < 0 ? meteo.nubosidad : nubesForzadas;

  const mezcla: Meteo = {
    ...meteo,
    nubosidad,
    precipitacion: lluvia,
    cielo:
      lluviaForzada < 0
        ? meteo.cielo
        : lluvia > 0
          ? "lluvia"
          : nubosidad > 0.5
            ? "nubes"
            : "despejado",
  };

  const textoHora = horaForzada < 0 ? t.hora : `${String(hora).padStart(2, "0")}:00`;
  if (lecturas.hora) lecturas.hora.textContent = textoHora;
  if (lecturas.meteo) lecturas.meteo.textContent = NOMBRES[mezcla.cielo];
  if (lecturas.temperatura) lecturas.temperatura.textContent = `${Math.round(mezcla.temperatura)}°`;
  if (lecturas.estacion) lecturas.estacion.textContent = t.estacion;
  pz.reloj(textoHora);

  cielo.aplicar(mezcla, hora);
}

async function refrescarMeteo() {
  meteo = await consultarMeteo();
  pintarLecturas();
}

medir();
pintarLecturas();
void refrescarMeteo();
setInterval(() => void refrescarMeteo(), CALIBRACION.REFRESCO_METEO * 60_000);
setInterval(pintarLecturas, 60_000);

/* ─── bucle ─────────────────────────────────────────────────── */

const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
let giro = 0;
let balanceoX = 0;
let balanceoY = 0;
let suelto = 1;
let reloj = 0;
let anterior = performance.now();

function cuadro(instante: number) {
  const dt = Math.min((instante - anterior) / 1000, 0.1);
  anterior = instante;
  reloj += dt;

  if (!reducido && !objetivo.quieto) giro += ((ESCENA.GIRO * Math.PI) / 180) * dt;

  const rad = (ESCENA.PARALAJE * Math.PI) / 180;
  balanceoX += (objetivoY * rad - balanceoX) * 0.05;
  balanceoY += (objetivoX * rad - balanceoY) * 0.05;

  suelto += ((objetivo.quieto ? 0 : 1) - suelto) * CALIBRACION.SUAVIZADO;
  diorama.rotation.y = (giro + balanceoY) * suelto;
  diorama.rotation.x = balanceoX * 0.4 * suelto;
  diorama.updateMatrixWorld();

  if (abierto) {
    const v = vistaVisor();
    objetivo.pos.copy(v.pos);
    objetivo.mira.copy(v.mira);
  }

  posActual.lerp(objetivo.pos, CALIBRACION.SUAVIZADO);
  miraActual.lerp(objetivo.mira, CALIBRACION.SUAVIZADO);
  camera.position.copy(posActual);
  camera.lookAt(miraActual);
  camera.updateMatrixWorld();

  for (const [malla, t] of palmadas) {
    const avance = t + dt * 2.6;
    if (avance >= 1) {
      malla.scale.setScalar(1);
      palmadas.delete(malla);
    } else {
      palmadas.set(malla, avance);
      malla.scale.setScalar(1 + Math.sin(avance * Math.PI) * 0.14);
    }
  }

  cartel.animar(reloj, camera);
  cielo.animar(dt, camera.position);
  colocarVisor();
  repasarSenalado();
  composer.render();
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

/* ─── ajustes ───────────────────────────────────────────────── */

const mandos: [string, string, number, number, number, number, (v: number) => void][] = [
  ["fuerza", "grano de trama", 0, 1, 0.05, TRAMA.FUERZA, (v) => (pasoTramado.uniforms["uFuerza"]!.value = v)],
  ["niveles", "niveles de color", 2, 24, 1, TRAMA.NIVELES, (v) => (pasoTramado.uniforms["uNiveles"]!.value = v)],
  ["tamano", "tamaño del píxel", 1, 6, 1, TRAMA.GRANO, (v) => (pasoTramado.uniforms["uGrano"]!.value = v)],
  ["distancia", "distancia", 12, 34, 1, ESCENA.DISTANCIA, (v) => {
    ESCENA.DISTANCIA = v;
    if (!abierto) objetivo = vistaGeneral();
  }],
  ["giro", "giro", 0, 8, 0.2, ESCENA.GIRO, (v) => (ESCENA.GIRO = v)],
  ["hora", "hora (-1 = real)", -1, 23, 1, -1, (v) => { horaForzada = v; pintarLecturas(); }],
  ["nubes", "nubes (-1 = real)", -1, 1, 0.05, -1, (v) => { nubesForzadas = v; pintarLecturas(); }],
  ["lluvia", "lluvia (-1 = real)", -1, 4, 0.25, -1, (v) => { lluviaForzada = v; pintarLecturas(); }],
];

const panel = document.getElementById("mandos")!;
for (const [id, etiqueta, min, max, paso, valor, aplicar] of mandos) {
  const fila = document.createElement("label");
  fila.innerHTML =
    `<span>${etiqueta}</span>` +
    `<input type="range" id="${id}" min="${min}" max="${max}" step="${paso}" value="${valor}">` +
    `<output>${valor}</output>`;
  panel.append(fila);
  const rango = fila.querySelector("input")!;
  const salida = fila.querySelector("output")!;
  rango.addEventListener("input", () => {
    const v = Number(rango.value);
    salida.textContent = String(v);
    aplicar(v);
  });
}

document.getElementById("abrir-ajustes")!.addEventListener("click", () => {
  document.getElementById("ajustes")!.classList.toggle("abierto");
});

// El aparato: escena, cámara y mandos.
//
// Dos vistas. En la general el diorama gira despacio y se señalan las plantas.
// Al pulsar la pantalla —o cualquier planta— la cámara baja a plomo sobre el
// visor y la interfaz se coloca encima, proyectada sobre la pantalla real.

import {
  ACESFilmicToneMapping,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  Raycaster,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { ahora } from "../tiempo.ts";
import { ejecutar, type Estado } from "../consola.ts";
import { construirEscena, CALIBRACION as ESCENA, type Interactivo } from "./escena.ts";
import { montarInterfaz } from "./interfaz.ts";
import { consultarMeteo, NOMBRES, RESERVA, type Meteo } from "./meteo.ts";
import { TramadoShader, CALIBRACION as TRAMA } from "./tramado.ts";

export const CALIBRACION = {
  // Suavizado de la cámara por fotograma. Subirlo la hace más seca.
  SUAVIZADO: 0.07,
  // Altura de la cámara sobre el visor al enfocarlo. Bajarlo lo agranda.
  ALTURA_VISOR: 7.4,
  // Retranqueo del enfoque. A 0 la cámara cae a plomo y la proyección es
  // un rectángulo perfecto, pero se pierde toda sensación de volumen.
  SESGO_VISOR: 2.3,
  // Margen que se recorta del visor para que no se monte sobre el bisel.
  MARGEN_VISOR: 0.94,
  // Cada cuánto se vuelve a consultar el tiempo de Zaragoza, en minutos.
  REFRESCO_METEO: 10,
};

const lienzo = document.getElementById("lienzo") as HTMLCanvasElement;

const renderer = new WebGLRenderer({ canvas: lienzo, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const { scene, camera, diorama, interactivos, cielo } = construirEscena(innerWidth / innerHeight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const pasoTramado = new ShaderPass(TramadoShader);
composer.addPass(pasoTramado);

function medir() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  pasoTramado.uniforms["uResolucion"]!.value = new Vector2(innerWidth, innerHeight);
}
medir();
addEventListener("resize", medir);

/* ─── vistas ────────────────────────────────────────────────── */

type Vista = { pos: Vector3; mira: Vector3; quieto: boolean };

const pantalla = interactivos.find((i) => i.nombre === "pantalla")!.malla as Mesh;

function vistaGeneral(): Vista {
  return {
    pos: new Vector3(
      ESCENA.DISTANCIA * 0.62,
      ESCENA.DISTANCIA * ESCENA.ALTURA,
      ESCENA.DISTANCIA * 0.62,
    ),
    mira: new Vector3(0, -0.7, 0),
    quieto: false,
  };
}

/** Encuadre sobre el visor: la cámara cae casi a plomo y la pantalla manda. */
function vistaVisor(): Vista {
  const centro = pantalla.getWorldPosition(new Vector3());
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
let enVisor = false;

const visor = document.getElementById("visor")!;
const salir = document.getElementById("salir")!;

// Tiempo que tarda la interfaz en encenderse, para que aparezca cuando la
// cámara ya casi ha llegado y no a mitad del viaje.
const ESPERA_VISOR = 420;
let encendido: ReturnType<typeof setTimeout> | undefined;

function entrarEnVisor() {
  // el diorama se endereza para que la pantalla mire a cámara
  objetivo = { ...vistaVisor(), quieto: true };
  enVisor = true;
  visor.classList.add("montado");
  salir.classList.add("visible");
  clearTimeout(encendido);
  encendido = setTimeout(() => visor.classList.add("visible"), ESPERA_VISOR);
}

function volverAGeneral() {
  objetivo = vistaGeneral();
  enVisor = false;
  clearTimeout(encendido);
  visor.classList.remove("montado", "visible");
  salir.classList.remove("visible");
}

/* ─── el visor, proyectado sobre la pantalla de verdad ──────── */

// Esquinas de la cara superior de la pantalla, en su propio espacio local.
const ESQUINAS = [
  new Vector3(-1.15, 0.05, -0.8),
  new Vector3(1.15, 0.05, -0.8),
  new Vector3(1.15, 0.05, 0.8),
  new Vector3(-1.15, 0.05, 0.8),
];
const proyectada = new Vector3();

function colocarVisor() {
  if (!enVisor) return;

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
  visor.style.left = `${minX + ((maxX - minX) - ancho) / 2}px`;
  visor.style.top = `${minY + ((maxY - minY) - alto) / 2}px`;
  visor.style.width = `${ancho}px`;
  visor.style.height = `${alto}px`;
  // la tipografía de la pantalla escala con la pantalla, no con la ventana
  visor.style.setProperty("--u", `${alto / 38}px`);

}

/* ─── estado del jardín ─────────────────────────────────────── */

// Mientras no exista el Worker, lo que riegas y lo que plantas vive en tu
// navegador. Cuando entre D1 esto pasa a ser estado compartido de verdad.
const LLAVE = "ytg01.jardin";

function cargarEstado(): Estado {
  const t = ahora();
  const base: Estado = {
    riegos: {},
    riegosHoy: 0,
    miRiegosRestantes: 3,
    haPlantado: false,
    estacion: t.estacion,
    hora24: t.hora24,
  };
  try {
    const crudo = localStorage.getItem(LLAVE);
    if (!crudo) return base;
    const guardado = JSON.parse(crudo) as Partial<Estado> & { dia?: string };
    const hoy = new Date().toISOString().slice(0, 10);
    return {
      ...base,
      riegos: guardado.riegos ?? {},
      haPlantado: guardado.haPlantado ?? false,
      miRiegosRestantes: guardado.dia === hoy ? (guardado.miRiegosRestantes ?? 3) : 3,
      riegosHoy: guardado.dia === hoy ? (guardado.riegosHoy ?? 0) : 0,
    };
  } catch {
    return base;
  }
}

function guardarEstado() {
  try {
    localStorage.setItem(
      LLAVE,
      JSON.stringify({ ...estado, dia: new Date().toISOString().slice(0, 10) }),
    );
  } catch {
    // navegación privada o almacenamiento bloqueado: el jardín sigue andando
  }
}

const estado = cargarEstado();

function correr(orden: string) {
  const t = ahora();
  estado.estacion = t.estacion;
  estado.hora24 = horaForzada < 0 ? t.hora24 : horaForzada;
  const respuesta = ejecutar(orden, estado);
  guardarEstado();
  return respuesta;
}

/* ─── respingos y flores ────────────────────────────────────── */

const palmadas = new Map<Object3D, number>();

function palmear(slug: string) {
  const destino = interactivos.find((i) => i.slug === slug);
  if (destino) palmadas.set(destino.malla, 0);
}

/** La flor que deja quien planta: pequeña, en el margen, y para siempre. */
function brotar() {
  const a = Math.random() * Math.PI * 2;
  const tallo = new Mesh(
    new CylinderGeometry(0.02, 0.03, 0.34, 5),
    new MeshStandardMaterial({ color: new Color("#6f9b4e"), roughness: 1, flatShading: true }),
  );
  tallo.position.y = 0.17;
  const petalo = new Mesh(
    new IcosahedronGeometry(0.11, 0),
    new MeshStandardMaterial({ color: new Color("#ff8fb1"), roughness: 0.8, flatShading: true }),
  );
  petalo.position.y = 0.36;
  const flor = new Group();
  flor.add(tallo, petalo);
  flor.position.set(Math.cos(a) * 5.05, 0, Math.sin(a) * 5.05);
  flor.castShadow = true;
  diorama.add(flor);
}

/* ─── la interfaz de la pantalla ────────────────────────────── */

const pz = montarInterfaz(document.getElementById("visor-interior")!, {
  // no movemos la cámara: estamos leyendo en la pantalla. La planta da un
  // respingo para que se sepa cuál es al volver a la vista general.
  enfocar: palmear,
  excavar: () => {},
  salir: volverAGeneral,
  regar: (slug) => {
    const r = correr(`regar ${slug}`);
    if (r.efecto?.tipo === "regar") palmear(slug);
    return r;
  },
  plantar: () => {
    const r = correr("plantar");
    if (r.efecto?.tipo === "plantar") brotar();
    return r;
  },
  ejecutarTexto: (orden) => {
    const r = correr(orden);
    if (r.efecto?.tipo === "regar") palmear(r.efecto.slug);
    if (r.efecto?.tipo === "plantar") brotar();
    if (r.efecto?.tipo === "salir") volverAGeneral();
    return r;
  },
  riegosDe: (slug) => estado.riegos[slug] ?? 0,
  riegosRestantes: () => estado.miRiegosRestantes,
  haPlantado: () => estado.haPlantado,
});

/* ─── señalar y pulsar ──────────────────────────────────────── */

const rayo = new Raycaster();
const puntero = new Vector2();
let senalado: Interactivo | null = null;
let hayPuntero = false;
let objetivoX = 0;
let objetivoY = 0;

const pista = document.getElementById("pista")!;

addEventListener("pointermove", (e) => {
  hayPuntero = true;
  puntero.x = (e.clientX / innerWidth) * 2 - 1;
  puntero.y = -(e.clientY / innerHeight) * 2 + 1;
  objetivoX = (e.clientX / innerWidth - 0.5) * 2;
  objetivoY = (e.clientY / innerHeight - 0.5) * 2;
});

function repasarSenalado() {
  if (!hayPuntero || enVisor) {
    if (senalado) {
      senalado = null;
      pista.classList.remove("visible");
      document.body.style.cursor = "default";
    }
    return;
  }

  rayo.setFromCamera(puntero, camera);
  const toca = rayo.intersectObjects(interactivos.map((i) => i.malla), true)[0];

  let nuevo: Interactivo | null = null;
  if (toca) {
    for (let o: Object3D | null = toca.object; o; o = o.parent) {
      const encontrado = interactivos.find((i) => i.malla === o);
      if (encontrado) {
        nuevo = encontrado;
        break;
      }
    }
  }

  if (nuevo !== senalado) {
    senalado = nuevo;
    document.body.style.cursor = nuevo ? "pointer" : "default";
    pista.textContent = nuevo?.etiqueta ?? "";
    pista.classList.toggle("visible", Boolean(nuevo));
  }
}

lienzo.addEventListener("click", () => {
  if (enVisor || !senalado) return;

  if (senalado.slug) {
    // pulsar una planta abre su ficha en el visor: se lee en el aparato
    entrarEnVisor();
    pz.abrirFicha(senalado.slug);
  } else if (senalado.nombre === "pantalla" || senalado.nombre.startsWith("comando:")) {
    entrarEnVisor();
    pz.abrirIndice();
  }
});

addEventListener("keydown", (e) => {
  if (e.key === "Escape") volverAGeneral();
});
salir.addEventListener("click", volverAGeneral);

/* ─── el tiempo de Zaragoza ─────────────────────────────────── */

let meteo: Meteo = RESERVA;
// -1 = hora real de Zaragoza. Cualquier otro valor la fuerza.
let horaForzada = -1;
// Los mandos no pisan la lectura real: se guardan aparte y se mezclan.
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
  const mezclaNubosidad = nubesForzadas < 0 ? meteo.nubosidad : nubesForzadas;
  const mezcla: Meteo = {
    ...meteo,
    nubosidad: mezclaNubosidad,
    precipitacion: lluvia,
    // al soltar el mando de lluvia el cielo vuelve a lo que diga la lectura real
    cielo:
      lluviaForzada < 0
        ? meteo.cielo
        : lluvia > 0
          ? "lluvia"
          : mezclaNubosidad > 0.5
            ? "nubes"
            : "despejado",
  };

  if (lecturas.meteo) lecturas.meteo.textContent = NOMBRES[mezcla.cielo];
  if (lecturas.temperatura) lecturas.temperatura.textContent = `${Math.round(mezcla.temperatura)}º`;
  if (lecturas.estacion) lecturas.estacion.textContent = t.estacion;

  const textoHora = horaForzada < 0 ? t.hora : `${String(hora).padStart(2, "0")}:00`;
  if (lecturas.hora) lecturas.hora.textContent = textoHora;
  pz.reloj(textoHora);

  cielo.aplicar(mezcla, hora);
}

async function refrescarMeteo() {
  meteo = await consultarMeteo();
  pintarLecturas();
}

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
let anterior = performance.now();

function cuadro(instante: number) {
  const dt = Math.min((instante - anterior) / 1000, 0.1);
  anterior = instante;

  if (!reducido && !objetivo.quieto) giro += ((ESCENA.GIRO * Math.PI) / 180) * dt;

  const rad = (ESCENA.PARALAJE * Math.PI) / 180;
  balanceoX += (objetivoY * rad - balanceoX) * 0.05;
  balanceoY += (objetivoX * rad - balanceoY) * 0.05;

  // al enfocar, el diorama se frena y se endereza
  suelto += ((objetivo.quieto ? 0 : 1) - suelto) * CALIBRACION.SUAVIZADO;
  diorama.rotation.y = (giro + balanceoY) * suelto;
  diorama.rotation.x = balanceoX * 0.4 * suelto;
  diorama.updateMatrixWorld();

  // el encuadre del visor depende de dónde haya quedado la pantalla
  if (enVisor) {
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
    if (!enVisor) objetivo = vistaGeneral();
  }],
  ["giro", "giro", 0, 8, 0.2, ESCENA.GIRO, (v) => (ESCENA.GIRO = v)],
  ["hora", "hora (-1 = real)", -1, 23, 1, -1, (v) => {
    horaForzada = v;
    pintarLecturas();
  }],
  ["nubes", "nubes (-1 = real)", -1, 1, 0.05, -1, (v) => {
    nubesForzadas = v;
    pintarLecturas();
  }],
  ["lluvia", "lluvia (-1 = real)", -1, 4, 0.25, -1, (v) => {
    lluviaForzada = v;
    pintarLecturas();
  }],
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

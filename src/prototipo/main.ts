// El aparato: escena, cámara y mandos.
//
// Tres vistas: general (el diorama girando), enfoque (sobre la pantalla o
// sobre una planta) y subsuelo (al excavar). La cámara nunca salta, interpola.

import {
  ACESFilmicToneMapping,
  Box3,
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
import { ahora } from "../tiempo";
import { construirEscena, CALIBRACION as ESCENA, type Interactivo } from "./escena";
import { consultarMeteo, NOMBRES, RESERVA, type Meteo } from "./meteo";
import { TramadoShader, CALIBRACION as TRAMA } from "./tramado";

export const CALIBRACION = {
  // Suavizado de la cámara por fotograma. Subirlo la hace más seca.
  SUAVIZADO: 0.055,
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

// Encuadre del enfoque sobre la pantalla del aparato.
const VISTA_PANTALLA: Vista = {
  pos: new Vector3(1.1, 9.2, 10.0),
  mira: new Vector3(0.5, 0.2, -0.1),
  quieto: true,
};

// Vista del subsuelo al excavar: la cámara baja hasta el corte de estratos.
const VISTA_SUBSUELO: Vista = {
  pos: new Vector3(13.5, -2.2, 13.5),
  mira: new Vector3(0, -4.2, 0),
  quieto: true,
};

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

/** Encuadre de una planta concreta, a partir de su sitio en el diorama. */
function vistaDe(objeto: Interactivo): Vista {
  const caja = new Box3().setFromObject(objeto.malla);
  const centro = caja.getCenter(new Vector3());
  const alto = Math.max(caja.max.y - caja.min.y, 1);
  return {
    pos: new Vector3(centro.x + alto * 1.5, centro.y + alto * 1.1, centro.z + alto * 2.1),
    mira: new Vector3(centro.x, centro.y * 0.6, centro.z),
    quieto: true,
  };
}

let objetivo: Vista = vistaGeneral();
const posActual = objetivo.pos.clone();
const miraActual = objetivo.mira.clone();
let enfocado = false;

const ficha = document.getElementById("ficha")!;
const fichaTitulo = document.getElementById("ficha-titulo")!;
const fichaCuerpo = document.getElementById("ficha-cuerpo")!;

function volverAGeneral() {
  objetivo = vistaGeneral();
  enfocado = false;
  ficha.classList.remove("visible");
}

/* ─── señalar y pulsar ──────────────────────────────────────── */

const rayo = new Raycaster();
const puntero = new Vector2();
let senalado: Interactivo | null = null;
let hayPuntero = false;

const pista = document.getElementById("pista")!;

addEventListener("pointermove", (e) => {
  hayPuntero = true;
  puntero.x = (e.clientX / innerWidth) * 2 - 1;
  puntero.y = -(e.clientY / innerHeight) * 2 + 1;
  objetivoX = (e.clientX / innerWidth - 0.5) * 2;
  objetivoY = (e.clientY / innerHeight - 0.5) * 2;
});

function repasarSenalado() {
  if (!hayPuntero) return;
  rayo.setFromCamera(puntero, camera);
  const toca = rayo.intersectObjects(interactivos.map((i) => i.malla), true)[0];

  let nuevo: Interactivo | null = null;
  if (toca) {
    // el rayo devuelve la malla concreta; hay que subir hasta el interactivo
    for (let o: typeof toca.object | null = toca.object; o; o = o.parent) {
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
  if (!senalado) {
    if (enfocado) volverAGeneral();
    return;
  }
  if (senalado.nombre === "pantalla") {
    objetivo = VISTA_PANTALLA;
    enfocado = true;
    mostrarConsola();
  } else if (senalado.nombre.startsWith("planta:") || senalado.nombre.startsWith("etiqueta:")) {
    objetivo = vistaDe(senalado);
    enfocado = true;
    mostrarFicha(senalado);
  } else if (senalado.nombre.startsWith("comando:")) {
    // las teclas de colores del aparato son atajos de la consola
    lanzar(senalado.nombre.slice("comando:".length));
  }
});

addEventListener("keydown", (e) => {
  if (e.key === "Escape") volverAGeneral();
});

document.getElementById("volver")!.addEventListener("click", volverAGeneral);

/* ─── contenido de la ficha ─────────────────────────────────── */

import { ARBOLES, ARBUSTOS, ETIQUETAS } from "../jardin-datos.ts";
import { completar, ejecutar, type Efecto, type Estado } from "../consola.ts";

function mostrarTexto(titulo: string, lineas: string[]) {
  fichaTitulo.textContent = titulo;
  fichaCuerpo.innerHTML = lineas.map((l) => `<p>${l}</p>`).join("");
  ficha.classList.add("visible");
}

function mostrarConsola() {
  mostrarTexto("consola de riego", [
    "escribe <b>ayuda</b> para ver los comandos.",
    "o pulsa una planta para abrir su ficha.",
  ]);
  entrada.focus();
}

/* ─── la consola ────────────────────────────────────────────── */

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
    // el cupo de riego se renueva cada día
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
const entrada = document.getElementById("entrada") as HTMLInputElement;
const registro = document.getElementById("consola-log")!;
const historial: string[] = [];
let puestoHistorial = -1;

function escribir(lineas: string[], eco?: string) {
  if (eco) {
    const p = document.createElement("p");
    p.className = "eco";
    p.textContent = `> ${eco}`;
    registro.append(p);
  }
  for (const linea of lineas) {
    const p = document.createElement("p");
    p.innerHTML = linea;
    registro.append(p);
  }
  registro.scrollTop = registro.scrollHeight;
}

function aplicarEfecto(efecto: Efecto) {
  switch (efecto.tipo) {
    case "enfocar": {
      const destino = interactivos.find((i) => i.slug === efecto.slug);
      if (destino) {
        objetivo = vistaDe(destino);
        enfocado = true;
      }
      break;
    }
    case "excavar":
      objetivo = VISTA_SUBSUELO;
      enfocado = true;
      break;
    case "subir":
      objetivo = vistaGeneral();
      enfocado = false;
      break;
    case "salir":
      volverAGeneral();
      break;
    case "regar":
      palmear(efecto.slug);
      break;
    case "plantar":
      brotar();
      break;
    case "sonido":
      escribir(["el altavoz está montado pero todavía no hay pistas dentro."]);
      break;
  }
}

function lanzar(orden: string) {
  const t = ahora();
  estado.estacion = t.estacion;
  estado.hora24 = horaForzada < 0 ? t.hora24 : horaForzada;

  const respuesta = ejecutar(orden, estado);
  ficha.classList.add("visible");
  escribir(respuesta.lineas, orden);
  if (respuesta.efecto) aplicarEfecto(respuesta.efecto);
  guardarEstado();
}

entrada.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const orden = entrada.value.trim();
    if (!orden) return;
    historial.unshift(orden);
    puestoHistorial = -1;
    entrada.value = "";
    lanzar(orden);
  } else if (e.key === "Tab") {
    e.preventDefault();
    const sugerido = completar(entrada.value);
    if (sugerido) entrada.value = sugerido;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (puestoHistorial + 1 < historial.length) {
      puestoHistorial += 1;
      entrada.value = historial[puestoHistorial]!;
    }
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    puestoHistorial = Math.max(puestoHistorial - 1, -1);
    entrada.value = puestoHistorial < 0 ? "" : historial[puestoHistorial]!;
  }
  e.stopPropagation();
});

/** Un riego: la planta da un respingo. */
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
  flor.position.set(Math.cos(a) * 5.0, 0, Math.sin(a) * 5.0);
  flor.castShadow = true;
  diorama.add(flor);
}

function mostrarFicha(objeto: Interactivo) {
  const slug = objeto.slug ?? "";

  const arbol = ARBOLES.find((a) => a.slug === slug);
  if (arbol) {
    const hasta = arbol.hasta ?? "hoy";
    mostrarTexto(arbol.nombre, [
      `<b>${arbol.rol}</b> · ${arbol.desde} — ${hasta}`,
      arbol.resumen,
      ...arbol.notas.map((n) => `· ${n.texto}`),
    ]);
    return;
  }

  const arbusto = ARBUSTOS.find((a) => a.slug === slug);
  if (arbusto) {
    mostrarTexto(arbusto.nombre, [
      arbusto.resumen,
      arbusto.repo ? `<b>github.com/${arbusto.repo}</b>` : "",
    ].filter(Boolean));
    return;
  }

  const cert = ETIQUETAS.find((c) => c.codigo === slug);
  if (cert) {
    mostrarTexto(cert.codigo, [
      cert.nombre,
      cert.estado === "pendiente" ? "etiqueta sin clavar. todavía." : "obtenida.",
    ]);
  }
}

/* ─── el tiempo de Zaragoza ─────────────────────────────────── */

let meteo: Meteo = RESERVA;

// -1 = hora real de Zaragoza. Cualquier otro valor la fuerza, para poder ver
// el jardín de noche a mediodía y al revés.
let horaForzada = -1;

const lecturas = {
  meteo: document.getElementById("lectura-meteo"),
  temperatura: document.getElementById("lectura-temperatura"),
  hora: document.getElementById("lectura-hora"),
  estacion: document.getElementById("lectura-estacion"),
};

function pintarLecturas() {
  const t = ahora();
  if (lecturas.meteo) lecturas.meteo.textContent = NOMBRES[meteo.cielo];
  if (lecturas.temperatura) lecturas.temperatura.textContent = `${Math.round(meteo.temperatura)}º`;
  const hora = horaForzada < 0 ? t.hora24 : horaForzada;
  if (lecturas.hora) {
    lecturas.hora.textContent = horaForzada < 0 ? t.hora : `${String(hora).padStart(2, "0")}:00`;
  }
  if (lecturas.estacion) lecturas.estacion.textContent = t.estacion;
  cielo.aplicar(meteo, hora);
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
let objetivoX = 0;
let objetivoY = 0;
let anterior = performance.now();

function cuadro(instante: number) {
  const dt = Math.min((instante - anterior) / 1000, 0.1);
  anterior = instante;

  if (!reducido && !objetivo.quieto) giro += ((ESCENA.GIRO * Math.PI) / 180) * dt;

  const rad = (ESCENA.PARALAJE * Math.PI) / 180;
  balanceoX += (objetivoY * rad - balanceoX) * 0.05;
  balanceoY += (objetivoX * rad - balanceoY) * 0.05;

  // al enfocar, el diorama se frena y se endereza para mirar de frente
  const sueltoObjetivo = objetivo.quieto ? 0 : 1;
  const suelto = (diorama.userData["suelto"] as number | undefined) ?? 1;
  const nuevoSuelto = suelto + (sueltoObjetivo - suelto) * CALIBRACION.SUAVIZADO * 2;
  diorama.userData["suelto"] = nuevoSuelto;
  diorama.rotation.y = (giro + balanceoY) * nuevoSuelto;
  diorama.rotation.x = balanceoX * 0.4 * nuevoSuelto;

  posActual.lerp(objetivo.pos, CALIBRACION.SUAVIZADO);
  miraActual.lerp(objetivo.mira, CALIBRACION.SUAVIZADO);
  camera.position.copy(posActual);
  camera.lookAt(miraActual);

  // respingo de las plantas recién regadas
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
  repasarSenalado();
  composer.render();
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

/* ─── ajustes ───────────────────────────────────────────────── */

const mandos: [string, string, number, number, number, (v: number) => void][] = [
  ["fuerza", "tramado (0 = sin)", 0, 1, TRAMA.FUERZA, (v) => (pasoTramado.uniforms["uFuerza"]!.value = v)],
  ["niveles", "niveles de color", 2, 24, TRAMA.NIVELES, (v) => (pasoTramado.uniforms["uNiveles"]!.value = v)],
  ["grano", "grano de trama", 1, 8, TRAMA.GRANO, (v) => (pasoTramado.uniforms["uGrano"]!.value = v)],
  ["distancia", "distancia", 10, 34, ESCENA.DISTANCIA, (v) => {
    ESCENA.DISTANCIA = v;
    if (!enfocado) objetivo = vistaGeneral();
  }],
  ["altura", "altura", 0.1, 1, ESCENA.ALTURA, (v) => {
    ESCENA.ALTURA = v;
    if (!enfocado) objetivo = vistaGeneral();
  }],
  ["giro", "giro", 0, 12, ESCENA.GIRO, (v) => (ESCENA.GIRO = v)],
  ["hora", "hora (-1 = real)", -1, 23, -1, (v) => {
    horaForzada = v;
    pintarLecturas();
  }],
  ["nubes", "nubosidad", 0, 1, RESERVA.nubosidad, (v) => {
    meteo = { ...meteo, nubosidad: v };
    pintarLecturas();
  }],
  ["lluvia", "lluvia (mm)", 0, 4, 0, (v) => {
    meteo = { ...meteo, precipitacion: v, cielo: v > 0 ? "lluvia" : meteo.cielo };
    pintarLecturas();
  }],
];

const panel = document.getElementById("mandos")!;
for (const [id, etiqueta, min, max, valor, aplicar] of mandos) {
  const fila = document.createElement("label");
  const paso = max <= 1 ? 0.02 : max <= 12 ? 0.1 : 1;
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

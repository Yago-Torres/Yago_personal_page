// Prototipo de dirección visual. Página aparte: no toca el sitio real.
//
// Dos vistas: el diorama general y el enfoque sobre la pantalla del aparato.
// Se pasa de una a otra haciendo clic; la cámara interpola, no salta.

import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  Raycaster,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { colocarCamara, construirEscena, CALIBRACION as ESCENA } from "./escena";
import { TramadoShader, CALIBRACION as TRAMA } from "./tramado";

const lienzo = document.getElementById("lienzo") as HTMLCanvasElement;

const renderer = new WebGLRenderer({ canvas: lienzo, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const { scene, camera, diorama, interactivos } = construirEscena(innerWidth / innerHeight);

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

/* ─── las dos vistas ────────────────────────────────────────── */

// Encuadre del enfoque sobre la pantalla. Tocar si el visor queda torcido.
const ENFOQUE = {
  POSICION: new Vector3(1.1, 9.2, 10.0),
  MIRA: new Vector3(0.5, 0.2, -0.1),
  // Segundos que tarda la cámara en entrar y salir.
  DURACION: 0.9,
};

let mezcla = 0;          // 0 = diorama, 1 = pantalla
let objetivoMezcla = 0;

const suavizar = (t: number) => t * t * (3 - 2 * t);

const posGeneral = new Vector3();
const miraGeneral = new Vector3(0, -0.7, 0);
const posActual = new Vector3();
const miraActual = new Vector3();

function encuadreGeneral(distancia: number, altura: number) {
  posGeneral.set(distancia * 0.62, distancia * altura, distancia * 0.62);
}
encuadreGeneral(ESCENA.DISTANCIA, ESCENA.ALTURA);

/* ─── señalar y pulsar ──────────────────────────────────────── */

const rayo = new Raycaster();
const puntero = new Vector2();
const mallas = interactivos.map((i) => i.malla);
let senalado: (typeof interactivos)[number] | null = null;

const pista = document.getElementById("pista")!;

addEventListener("pointermove", (e) => {
  puntero.x = (e.clientX / innerWidth) * 2 - 1;
  puntero.y = -(e.clientY / innerHeight) * 2 + 1;
});

function repasarSenalado() {
  rayo.setFromCamera(puntero, camera);
  const toca = rayo.intersectObjects(mallas, false)[0];
  const nuevo = toca ? interactivos.find((i) => i.malla === toca.object) ?? null : null;

  if (nuevo !== senalado) {
    senalado = nuevo;
    document.body.style.cursor = nuevo ? "pointer" : "default";
    pista.textContent = nuevo?.etiqueta ?? "";
    pista.classList.toggle("visible", Boolean(nuevo));
  }
}

lienzo.addEventListener("click", () => {
  if (senalado?.nombre === "pantalla") objetivoMezcla = 1;
  else if (mezcla > 0.5 && !senalado) objetivoMezcla = 0;
});

addEventListener("keydown", (e) => {
  if (e.key === "Escape") objetivoMezcla = 0;
});

document.getElementById("volver")!.addEventListener("click", () => (objetivoMezcla = 0));

/* ─── bucle ─────────────────────────────────────────────────── */

const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ficha = document.getElementById("ficha")!;

let giro = 0;
let balanceoX = 0;
let balanceoY = 0;
let objetivoX = 0;
let objetivoY = 0;
let anterior = performance.now();

addEventListener("pointermove", (e) => {
  objetivoX = (e.clientX / innerWidth - 0.5) * 2;
  objetivoY = (e.clientY / innerHeight - 0.5) * 2;
});

function cuadro(ahora: number) {
  const dt = Math.min((ahora - anterior) / 1000, 0.1);
  anterior = ahora;

  // avance hacia la vista pedida
  const paso = dt / ENFOQUE.DURACION;
  mezcla += Math.sign(objetivoMezcla - mezcla) * Math.min(paso, Math.abs(objetivoMezcla - mezcla));
  const t = suavizar(mezcla);

  // enfocado: el diorama se para y se endereza para que la pantalla mire a cámara
  if (!quieto && objetivoMezcla === 0) giro += ((ESCENA.GIRO * Math.PI) / 180) * dt;

  const rad = (ESCENA.PARALAJE * Math.PI) / 180;
  balanceoX += (objetivoY * rad - balanceoX) * 0.05;
  balanceoY += (objetivoX * rad - balanceoY) * 0.05;

  diorama.rotation.y = (giro + balanceoY) * (1 - t);
  diorama.rotation.x = balanceoX * 0.4 * (1 - t);

  posActual.lerpVectors(posGeneral, ENFOQUE.POSICION, t);
  miraActual.lerpVectors(miraGeneral, ENFOQUE.MIRA, t);
  camera.position.copy(posActual);
  camera.lookAt(miraActual);

  ficha.classList.toggle("visible", t > 0.75);

  repasarSenalado();
  composer.render();
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

/* ─── ajustes, para quien entre ─────────────────────────────── */

const mandos: [string, string, number, number, number, (v: number) => void][] = [
  ["fuerza", "tramado (0 = sin)", 0, 1, TRAMA.FUERZA, (v) => (pasoTramado.uniforms["uFuerza"]!.value = v)],
  ["niveles", "niveles de color", 2, 24, TRAMA.NIVELES, (v) => (pasoTramado.uniforms["uNiveles"]!.value = v)],
  ["grano", "grano de trama", 1, 8, TRAMA.GRANO, (v) => (pasoTramado.uniforms["uGrano"]!.value = v)],
  ["distancia", "distancia", 10, 34, ESCENA.DISTANCIA, (v) => {
    ESCENA.DISTANCIA = v;
    encuadreGeneral(v, ESCENA.ALTURA);
  }],
  ["altura", "altura", 0.1, 1, ESCENA.ALTURA, (v) => {
    ESCENA.ALTURA = v;
    encuadreGeneral(ESCENA.DISTANCIA, v);
  }],
  ["giro", "giro", 0, 12, ESCENA.GIRO, (v) => (ESCENA.GIRO = v)],
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

const cajon = document.getElementById("ajustes")!;
document.getElementById("abrir-ajustes")!.addEventListener("click", () => {
  cajon.classList.toggle("abierto");
});

// colocación inicial coherente con los mandos
colocarCamara(camera, ESCENA.DISTANCIA, ESCENA.ALTURA);

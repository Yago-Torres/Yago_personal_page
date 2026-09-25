// Prototipo de dirección visual. Página aparte: no toca el sitio real.

import { ACESFilmicToneMapping, PCFSoftShadowMap, Vector2, WebGLRenderer } from "three";
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

const { scene, camera, diorama } = construirEscena(innerWidth / innerHeight);

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

/* ─── paralaje del puntero ──────────────────────────────────── */

let objetivoX = 0;
let objetivoY = 0;
addEventListener("pointermove", (e) => {
  objetivoX = (e.clientX / innerWidth - 0.5) * 2;
  objetivoY = (e.clientY / innerHeight - 0.5) * 2;
});

/* ─── bucle ─────────────────────────────────────────────────── */

const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
let giro = 0;
let anterior = performance.now();
let balanceoX = 0;
let balanceoY = 0;

function cuadro(ahora: number) {
  const dt = Math.min((ahora - anterior) / 1000, 0.1);
  anterior = ahora;

  if (!quieto) giro += (ESCENA.GIRO * Math.PI / 180) * dt;

  const rad = (ESCENA.PARALAJE * Math.PI) / 180;
  balanceoX += (objetivoY * rad - balanceoX) * 0.05;
  balanceoY += (objetivoX * rad - balanceoY) * 0.05;

  diorama.rotation.y = giro + balanceoY;
  diorama.rotation.x = balanceoX * 0.4;

  composer.render();
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

/* ─── mandos de calibración ─────────────────────────────────── */

// El tramado arranca suave: a 0 de fuerza desaparece del todo, para poder
// comparar la escena limpia con la tramada moviendo un solo mando.
const mandos: [string, string, number, number, number, (v: number) => void][] = [
  ["fuerza", "tramado (0 = sin)", 0, 1, TRAMA.FUERZA, (v) => (pasoTramado.uniforms["uFuerza"]!.value = v)],
  ["niveles", "niveles de color", 2, 24, TRAMA.NIVELES, (v) => (pasoTramado.uniforms["uNiveles"]!.value = v)],
  ["grano", "grano de trama", 1, 8, TRAMA.GRANO, (v) => (pasoTramado.uniforms["uGrano"]!.value = v)],
  ["distancia", "distancia de cámara", 10, 34, ESCENA.DISTANCIA, (v) => colocarCamara(camera, v, ESCENA.ALTURA)],
  ["altura", "altura de cámara", 0.1, 1, ESCENA.ALTURA, (v) => {
    ESCENA.ALTURA = v;
    colocarCamara(camera, Number((document.getElementById("distancia") as HTMLInputElement).value), v);
  }],
  ["giro", "giro automático", 0, 12, ESCENA.GIRO, (v) => (ESCENA.GIRO = v)],
];

const panel = document.getElementById("mandos")!;
for (const [id, etiqueta, min, max, valor, aplicar] of mandos) {
  const fila = document.createElement("label");
  const paso = max <= 1 ? 0.02 : max <= 12 ? 0.1 : 1;
  fila.innerHTML = `<span>${etiqueta}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${paso}" value="${valor}"><output>${valor}</output>`;
  panel.append(fila);
  const rango = fila.querySelector("input")!;
  const salida = fila.querySelector("output")!;
  rango.addEventListener("input", () => {
    const v = Number(rango.value);
    salida.textContent = String(v);
    aplicar(v);
  });
}

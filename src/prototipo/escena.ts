// Prototipo 2 de dirección visual: diorama low-poly, caricaturesco y con color.
// Esto es para MIRARLO y decidir, no es código de producción.
//
// La isla flotante no es decoración: su corte es la estructura del CV.
// Arriba el presente (aparato y plantas), abajo los estratos del stack, cada
// uno con su color, y al fondo la roca de donde viene todo.

import {
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const CALIBRACION = {
  // Distancia de la cámara. Subirlo aleja y aplana hacia isométrico puro.
  DISTANCIA: 19,
  // Altura de la cámara. Bajarlo enseña más el corte del subsuelo.
  ALTURA: 0.42,
  // Cuánto translúcido es el plástico. 0 = opaco mate, 1 = casi cristal.
  TRANSLUCIDEZ: 0.4,
  // Giro automático del diorama, en grados por segundo. 0 lo deja quieto.
  GIRO: 2.2,
  // Grados de balanceo que añade el puntero.
  PARALAJE: 7,
};

const PALETA = {
  cieloAlto: "#bfe6f0",
  cieloBajo: "#ffe6c9",
  chasis:    "#f6f1e4",
  pantalla:  "#1b2a24",
  boton:     "#ff6b4a",
  dial:      "#46b3a6",
  corteza:   "#9a6f45",
  hoja:      "#5fbe4e",
  hojaClara: "#8fd86a",
};

// Los estratos del subsuelo: el stack, cada capa con su color.
// En producción vienen de garden.ts; aquí van a mano para ver el corte.
const ESTRATOS = [
  { alto: 0.34, radio: 3.05, color: "#74c65a" }, // césped
  { alto: 0.52, radio: 2.95, color: "#e7b955" }, // arena
  { alto: 0.46, radio: 2.72, color: "#e08a4e" }, // arcilla
  { alto: 0.62, radio: 2.42, color: "#d2605f" },
  { alto: 0.54, radio: 2.02, color: "#9a5f9c" },
  { alto: 0.80, radio: 1.56, color: "#4f7fb8" },
  { alto: 1.00, radio: 1.02, color: "#3a5c86" }, // roca madre
];

const ARRIBA = new Vector3(0, 1, 0);

/** Fondo en degradado: quita el gris triste de la primera versión. */
function cielo() {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, PALETA.cieloAlto);
  grad.addColorStop(1, PALETA.cieloBajo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  return new CanvasTexture(c);
}

function isla() {
  const g = new Group();
  let y = 0;

  for (const capa of ESTRATOS) {
    // 6 lados y flatShading: facetas gordas, nada de superficie lisa
    const geo = new CylinderGeometry(capa.radio, capa.radio * 0.82, capa.alto, 6);
    const mat = new MeshStandardMaterial({
      color: new Color(capa.color),
      roughness: 0.92,
      flatShading: true,
    });
    const m = new Mesh(geo, mat);
    m.position.y = y - capa.alto / 2;
    m.rotation.y = 0.26;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    y -= capa.alto;
  }

  const punta = new Mesh(
    new CylinderGeometry(1.02, 0.08, 1.5, 6),
    new MeshStandardMaterial({ color: new Color("#31507a"), roughness: 1, flatShading: true }),
  );
  punta.position.y = y - 0.75;
  punta.rotation.y = 0.26;
  punta.castShadow = true;
  g.add(punta);

  return g;
}

/** Un segmento de tallo entre dos puntos, orientado de verdad. */
function segmento(g: Group, mat: MeshStandardMaterial, a: Vector3, b: Vector3, grosor: number) {
  const largo = a.distanceTo(b);
  const m = new Mesh(new CylinderGeometry(grosor * 0.72, grosor, largo, 5), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize());
  m.castShadow = true;
  g.add(m);
}

/** Rama recursiva. En producción la geometría la genera botanica.ts. */
function rama(
  g: Group,
  mat: MeshStandardMaterial,
  matHoja: MeshStandardMaterial,
  base: Vector3,
  dir: Vector3,
  largo: number,
  grosor: number,
  nivel: number,
) {
  const punta = base.clone().addScaledVector(dir, largo);
  segmento(g, mat, base, punta, grosor);

  // copa: bolas facetadas gordas, estilo caricatura
  if (nivel >= 2) {
    const r = grosor * (6.2 - nivel * 1.1);
    const hoja = new Mesh(new IcosahedronGeometry(r, 0), matHoja);
    hoja.position.copy(punta);
    hoja.scale.y = 0.78;
    hoja.castShadow = true;
    g.add(hoja);
    if (nivel >= 3) return;
  }

  const eje = new Vector3(-dir.z, 0, dir.x).normalize();
  for (const signo of [1, -1]) {
    const hija = dir
      .clone()
      .applyAxisAngle(eje, signo * (0.62 - nivel * 0.08))
      .applyAxisAngle(ARRIBA, signo * 1.1)
      .lerp(ARRIBA, 0.12)
      .normalize();
    rama(g, mat, matHoja, punta, hija, largo * 0.68, grosor * 0.7, nivel + 1);
  }
}

function planta(altura: number, tono: number) {
  const g = new Group();
  const mat = new MeshStandardMaterial({
    color: new Color(PALETA.corteza),
    roughness: 0.95,
    flatShading: true,
  });
  const matHoja = new MeshStandardMaterial({
    color: new Color(tono > 0.5 ? PALETA.hoja : PALETA.hojaClara),
    roughness: 0.8,
    flatShading: true,
  });
  rama(g, mat, matHoja, new Vector3(0, 0, 0), ARRIBA.clone(), altura * 0.34, altura * 0.095, 0);
  return g;
}

function aparato() {
  const g = new Group();

  const cuerpo = new Mesh(
    new RoundedBoxGeometry(3.6, 0.52, 2.35, 4, 0.18),
    new MeshPhysicalMaterial({
      color: new Color(PALETA.chasis),
      roughness: 0.5,
      transmission: CALIBRACION.TRANSLUCIDEZ,
      thickness: 1.0,
      ior: 1.45,
      clearcoat: 0.45,
      clearcoatRoughness: 0.55,
    }),
  );
  cuerpo.castShadow = true;
  cuerpo.receiveShadow = true;
  g.add(cuerpo);

  const pantalla = new Mesh(
    new RoundedBoxGeometry(2.35, 0.09, 1.45, 2, 0.05),
    new MeshStandardMaterial({ color: new Color(PALETA.pantalla), roughness: 0.3 }),
  );
  pantalla.position.set(-0.5, 0.25, 0);
  g.add(pantalla);

  const boton = new Mesh(
    new CylinderGeometry(0.26, 0.26, 0.16, 12),
    new MeshStandardMaterial({ color: new Color(PALETA.boton), roughness: 0.45, flatShading: true }),
  );
  boton.position.set(1.3, 0.29, -0.48);
  boton.castShadow = true;
  g.add(boton);

  const dial = new Mesh(
    new CylinderGeometry(0.19, 0.2, 0.17, 10),
    new MeshStandardMaterial({ color: new Color(PALETA.dial), roughness: 0.4, flatShading: true }),
  );
  dial.position.set(1.3, 0.3, 0.4);
  dial.castShadow = true;
  g.add(dial);

  return g;
}

export function colocarCamara(camera: PerspectiveCamera, distancia: number, altura: number) {
  camera.position.set(distancia * 0.62, distancia * altura, distancia * 0.62);
  camera.lookAt(0, -0.7, 0);
}

export function construirEscena(anchoAlto: number) {
  const scene = new Scene();
  scene.background = cielo();

  const camera = new PerspectiveCamera(24, anchoAlto, 1, 100);
  colocarCamara(camera, CALIBRACION.DISTANCIA, CALIBRACION.ALTURA);

  const diorama = new Group();
  scene.add(diorama);
  diorama.add(isla());

  const consola = aparato();
  consola.position.y = 0.26;
  diorama.add(consola);

  const sitios: [number, number, number, number][] = [
    [-2.1, 1.6, 0.8, 0.2], [2.0, 2.0, -0.9, 0.9], [-1.0, 1.3, -2.0, 0.6],
    [1.3, 1.8, 1.7, 0.1], [-2.3, 1.4, -1.0, 0.8], [0.3, 2.2, 2.0, 0.4],
  ];
  for (const [x, alto, z, tono] of sitios) {
    const p = planta(alto, tono);
    p.position.set(x, 0.15, z);
    diorama.add(p);
  }

  // piedrecitas sueltas: dan escala y rompen la simetría
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const piedra = new Mesh(
      new IcosahedronGeometry(0.07 + (i % 3) * 0.04, 0),
      new MeshStandardMaterial({ color: new Color("#b9a98c"), roughness: 1, flatShading: true }),
    );
    piedra.position.set(Math.cos(a) * 2.5, 0.18, Math.sin(a) * 2.5);
    piedra.castShadow = true;
    diorama.add(piedra);
  }

  // suelo invisible que solo recoge la sombra de contacto
  const sombra = new Mesh(
    new PlaneGeometry(60, 60),
    new MeshStandardMaterial({ color: new Color(PALETA.cieloBajo), roughness: 1 }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = -6.5;
  sombra.receiveShadow = true;
  scene.add(sombra);

  // sol cálido
  const key = new DirectionalLight(0xfff0d8, 2.6);
  key.position.set(6, 9, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.0008;
  scene.add(key);

  // rebote frío del cielo: sin esto la sombra sale negra y triste
  const relleno = new DirectionalLight(0xbfe0ff, 1.5);
  relleno.position.set(-7, 2, -5);
  scene.add(relleno);

  scene.add(new HemisphereLight(0xdcf2ff, 0xf0c98a, 1.6));

  // halo suave que despega la isla del fondo
  const halo = new Mesh(
    new SphereGeometry(7.5, 16, 12),
    new MeshStandardMaterial({
      color: new Color(PALETA.cieloAlto),
      transparent: true,
      opacity: 0.12,
    }),
  );
  halo.position.y = -1;
  scene.add(halo);

  return { scene, camera, diorama };
}

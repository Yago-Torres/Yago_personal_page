// Prototipo de dirección visual: diorama isométrico + tramado.
// Esto es para MIRARLO y decidir, no es código de producción.
//
// La isla flotante no es decoración: su corte es la estructura del CV.
// Arriba el presente (aparato y plantas), abajo los estratos del stack y,
// al fondo, las raíces que llegan hasta la formación.

import {
  BoxGeometry,
  CylinderGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
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
  // Distancia de la cámara. Subirlo aplana la perspectiva hacia isométrico puro.
  DISTANCIA: 31,
  // Altura de la cámara. Bajarlo enseña más el corte del subsuelo.
  ALTURA: 0.34,
  // Apertura de la lente. Bajarlo aplana; subirlo exagera la fuga.
  LENTE: 20,
  // Cuánto translúcido es el plástico. 0 = opaco mate, 1 = casi cristal.
  TRANSLUCIDEZ: 0.45,
  // Giro automático del diorama, en grados por segundo. 0 lo deja quieto.
  GIRO: 1.6,
  // Grados de balanceo que añade el puntero.
  PARALAJE: 7,
};

const PALETA = {
  fondo:    "#cdc8bd",
  chasis:   "#e9e5da",
  pantalla: "#12150f",
  boton:    "#d8552f",
  planta:   "#718f56",
  hoja:     "#8aa864",
};

// Los estratos del subsuelo: el stack, de lo más reciente a lo más profundo.
// En producción estos vienen de garden.ts; aquí van a mano para ver el corte.
const ESTRATOS = [
  { alto: 0.45, radio: 3.5,  color: "#7f6b4e" }, // mantillo
  { alto: 0.55, radio: 3.32, color: "#a08a63" }, // banda clara: se lee el corte
  { alto: 0.70, radio: 3.05, color: "#6a5942" },
  { alto: 0.50, radio: 2.66, color: "#8d7754" },
  { alto: 0.90, radio: 2.18, color: "#54483a" },
  { alto: 1.15, radio: 1.52, color: "#6b5c47" },
  { alto: 1.40, radio: 0.78, color: "#3d352b" }, // roca madre
];

function isla() {
  const g = new Group();
  let y = 0;

  for (const capa of ESTRATOS) {
    const geo = new CylinderGeometry(capa.radio, capa.radio * 0.86, capa.alto, 7);
    const mat = new MeshStandardMaterial({ color: new Color(capa.color), roughness: 0.95 });
    const m = new Mesh(geo, mat);
    m.position.y = y - capa.alto / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    y -= capa.alto;
  }

  // punta inferior de la isla
  const punta = new Mesh(
    new CylinderGeometry(0.7, 0.05, 1.4, 7),
    new MeshStandardMaterial({ color: new Color("#251f1a"), roughness: 1 }),
  );
  punta.position.y = y - 0.7;
  punta.castShadow = true;
  g.add(punta);

  return g;
}

const ARRIBA = new Vector3(0, 1, 0);

/** Un segmento de tallo entre dos puntos, orientado de verdad. */
function segmento(g: Group, mat: MeshStandardMaterial, a: Vector3, b: Vector3, grosor: number) {
  const largo = a.distanceTo(b);
  const m = new Mesh(new CylinderGeometry(grosor * 0.72, grosor, largo, 6), mat);
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

  if (nivel >= 4 || largo < 0.1) {
    const hoja = new Mesh(new SphereGeometry(grosor * 4.2, 7, 5), matHoja);
    hoja.position.copy(punta);
    hoja.scale.set(1, 0.45, 1);
    hoja.castShadow = true;
    g.add(hoja);
    return;
  }

  // dos hijas: se abren en abanico y tienden a enderezarse hacia la luz
  const eje = new Vector3(-dir.z, 0, dir.x).normalize();
  for (const signo of [1, -1]) {
    const hija = dir
      .clone()
      .applyAxisAngle(eje, signo * (0.78 - nivel * 0.09))
      .applyAxisAngle(ARRIBA, signo * 1.05)
      .lerp(ARRIBA, 0.08)
      .normalize();
    rama(g, mat, matHoja, punta, hija, largo * 0.7, grosor * 0.66, nivel + 1);
  }
}

function planta(altura: number, inclinacion = 0) {
  const g = new Group();
  const mat = new MeshStandardMaterial({ color: new Color(PALETA.planta), roughness: 0.9 });
  const matHoja = new MeshStandardMaterial({ color: new Color(PALETA.hoja), roughness: 0.85 });
  const dir = ARRIBA.clone().applyAxisAngle(new Vector3(1, 0, 0), inclinacion).normalize();
  rama(g, mat, matHoja, new Vector3(0, 0, 0), dir, altura * 0.52, altura * 0.055, 0);
  return g;
}

function aparato() {
  const g = new Group();

  // cuerpo: plástico translúcido mate
  const cuerpo = new Mesh(
    new RoundedBoxGeometry(3.2, 0.42, 2.1, 5, 0.14),
    new MeshPhysicalMaterial({
      color: new Color(PALETA.chasis),
      roughness: 0.58,
      transmission: CALIBRACION.TRANSLUCIDEZ,
      thickness: 1.1,
      ior: 1.45,
      clearcoat: 0.35,
      clearcoatRoughness: 0.7,
    }),
  );
  cuerpo.castShadow = true;
  cuerpo.receiveShadow = true;
  g.add(cuerpo);

  // pantalla hundida
  const pantalla = new Mesh(
    new BoxGeometry(2.1, 0.06, 1.25),
    new MeshStandardMaterial({
      color: new Color(PALETA.pantalla),
      roughness: 0.25,
      metalness: 0.1,
    }),
  );
  pantalla.position.set(-0.42, 0.21, 0);
  g.add(pantalla);

  // botón maestro
  const boton = new Mesh(
    new CylinderGeometry(0.22, 0.22, 0.12, 20),
    new MeshStandardMaterial({ color: new Color(PALETA.boton), roughness: 0.5 }),
  );
  boton.position.set(1.18, 0.24, -0.45);
  boton.castShadow = true;
  g.add(boton);

  // dial
  const dial = new Mesh(
    new CylinderGeometry(0.16, 0.17, 0.14, 16),
    new MeshStandardMaterial({ color: new Color("#b9b3a5"), roughness: 0.45, metalness: 0.5 }),
  );
  dial.position.set(1.18, 0.25, 0.32);
  dial.castShadow = true;
  g.add(dial);

  return g;
}

export function construirEscena(anchoAlto: number) {
  const scene = new Scene();
  scene.background = new Color(PALETA.fondo);
  scene.fog = new Fog(new Color(PALETA.fondo), 22, 40);

  const camera = new PerspectiveCamera(CALIBRACION.LENTE, anchoAlto, 1, 100);
  const d = CALIBRACION.DISTANCIA;
  camera.position.set(d * 0.62, d * CALIBRACION.ALTURA, d * 0.62);
  camera.lookAt(0, -0.9, 0);

  // el diorama entero gira como conjunto
  const diorama = new Group();
  scene.add(diorama);

  diorama.add(isla());

  const consola = aparato();
  consola.position.y = 0.21;
  diorama.add(consola);

  // plantas repartidas por la superficie, alguna trepando sobre el aparato
  const sitios: [number, number, number][] = [
    [-2.5, 1.7, 0.9], [2.4, 2.2, -1.0], [-1.2, 1.3, -2.3],
    [1.5, 1.9, 2.0], [-2.7, 1.5, -1.1], [0.3, 2.4, 2.4],
  ];
  for (const [x, alto, z] of sitios) {
    const p = planta(alto);
    p.position.set(x, 0, z);
    diorama.add(p);
  }

  // suelo invisible que solo recibe la sombra de contacto
  const sombra = new Mesh(
    new PlaneGeometry(40, 40),
    new MeshStandardMaterial({ color: new Color(PALETA.fondo), roughness: 1 }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = -7.5;
  sombra.receiveShadow = true;
  scene.add(sombra);

  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(6, 10, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.0008;
  scene.add(key);

  const relleno = new DirectionalLight(0xdbe4ff, 1.35);
  relleno.position.set(-7, 3, -5);
  scene.add(relleno);

  scene.add(new HemisphereLight(0xffffff, 0x9d8a6f, 1.5));

  return { scene, camera, diorama };
}

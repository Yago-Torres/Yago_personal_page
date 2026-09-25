// Prototipo 3 de dirección visual: diorama low-poly con el aparato en el centro,
// superficie de mandos densa y pantalla enfocable.
//
// La isla flotante no es decoración: su corte es la estructura del CV.
// Arriba el presente (aparato y plantas), abajo los estratos del stack.

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
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const CALIBRACION = {
  // Distancia de la cámara en la vista general. Subirlo aleja y aplana.
  DISTANCIA: 23,
  // Altura de la cámara. Bajarlo enseña más el corte del subsuelo.
  ALTURA: 0.44,
  // Cuánto translúcido es el plástico. 0 = opaco mate, 1 = casi cristal.
  TRANSLUCIDEZ: 0.4,
  // Giro automático del diorama, en grados por segundo. 0 lo deja quieto.
  GIRO: 2.2,
  // Grados de balanceo que añade el puntero.
  PARALAJE: 6,
};

const PALETA = {
  cieloAlto: "#bfe6f0",
  cieloBajo: "#ffe6c9",
  chasis:    "#f6f1e4",
  pantalla:  "#141f1a",
  coral:     "#ff6b4a",
  turquesa:  "#46b3a6",
  amarillo:  "#f5c451",
  violeta:   "#8a6fc4",
  grafito:   "#3b3a35",
  corteza:   "#9a6f45",
  hoja:      "#5fbe4e",
  hojaClara: "#8fd86a",
};

// El stack, de la superficie a la roca madre. En producción sale de jardin-datos.ts.
const ESTRATOS = [
  { alto: 0.40, radio: 5.3, color: "#74c65a" }, // césped
  { alto: 0.60, radio: 5.15, color: "#e7b955" },
  { alto: 0.52, radio: 4.72, color: "#e08a4e" },
  { alto: 0.70, radio: 4.18, color: "#d2605f" },
  { alto: 0.62, radio: 3.46, color: "#9a5f9c" },
  { alto: 0.92, radio: 2.62, color: "#4f7fb8" },
  { alto: 1.15, radio: 1.70, color: "#3a5c86" },
];

const ARRIBA = new Vector3(0, 1, 0);

/** Malla sobre la que se puede hacer clic. */
export type Interactivo = {
  malla: Mesh;
  nombre: string;
  etiqueta: string;
  alturaBase: number;
};

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
    new CylinderGeometry(1.70, 0.1, 2.1, 6),
    new MeshStandardMaterial({ color: new Color("#31507a"), roughness: 1, flatShading: true }),
  );
  punta.position.y = y - 1.05;
  punta.rotation.y = 0.26;
  punta.castShadow = true;
  g.add(punta);

  return g;
}

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

  if (nivel >= 2) {
    const hoja = new Mesh(new IcosahedronGeometry(grosor * (6.2 - nivel * 1.1), 0), matHoja);
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

function planta(altura: number, claro: boolean) {
  const g = new Group();
  const mat = new MeshStandardMaterial({
    color: new Color(PALETA.corteza),
    roughness: 0.95,
    flatShading: true,
  });
  const matHoja = new MeshStandardMaterial({
    color: new Color(claro ? PALETA.hojaClara : PALETA.hoja),
    roughness: 0.8,
    flatShading: true,
  });
  rama(g, mat, matHoja, new Vector3(0, 0, 0), ARRIBA.clone(), altura * 0.34, altura * 0.095, 0);
  return g;
}

/* ─── el aparato ────────────────────────────────────────────── */

const GROSOR_CHASIS = 0.54;
const CARA = GROSOR_CHASIS / 2;   // altura de la cara superior, en local

function tapa(color: string, rugosidad = 0.45) {
  return new MeshStandardMaterial({ color: new Color(color), roughness: rugosidad, flatShading: true });
}

/** Botón redondo. */
function pulsador(x: number, z: number, radio: number, alto: number, color: string) {
  const m = new Mesh(new CylinderGeometry(radio, radio, alto, 14), tapa(color));
  m.position.set(x, CARA + alto / 2 - 0.02, z);
  m.castShadow = true;
  return m;
}

/** Tecla cuadrada de las del teclado numérico. */
function tecla(x: number, z: number, lado: number, color: string) {
  const m = new Mesh(new RoundedBoxGeometry(lado, 0.1, lado, 2, 0.022), tapa(color));
  m.position.set(x, CARA + 0.04, z);
  m.castShadow = true;
  return m;
}

/** Perilla con su marca de posición. */
function perilla(x: number, z: number, radio: number) {
  const g = new Group();
  const cuerpo = new Mesh(
    new CylinderGeometry(radio, radio * 1.06, 0.2, 12),
    tapa(PALETA.grafito, 0.38),
  );
  cuerpo.castShadow = true;
  g.add(cuerpo);
  const marca = new Mesh(
    new RoundedBoxGeometry(radio * 0.18, 0.04, radio * 0.9, 1, 0.01),
    tapa(PALETA.chasis, 0.6),
  );
  marca.position.set(0, 0.1, -radio * 0.42);
  g.add(marca);
  g.position.set(x, CARA + 0.08, z);
  g.rotation.y = -0.5;
  return g;
}

function aparato() {
  const g = new Group();
  const interactivos: Interactivo[] = [];

  // cuerpo: plástico translúcido mate
  const cuerpo = new Mesh(
    new RoundedBoxGeometry(5.0, GROSOR_CHASIS, 3.0, 4, 0.2),
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

  // marco hundido de la pantalla
  const hueco = new Mesh(
    new RoundedBoxGeometry(2.5, 0.1, 1.8, 2, 0.05),
    tapa("#d8d2c2", 0.7),
  );
  hueco.position.set(-1.05, CARA - 0.02, -0.1);
  g.add(hueco);

  // la pantalla: esto es lo enfocable
  const pantalla = new Mesh(
    new RoundedBoxGeometry(2.3, 0.1, 1.6, 2, 0.04),
    new MeshStandardMaterial({ color: new Color(PALETA.pantalla), roughness: 0.22, metalness: 0.15 }),
  );
  pantalla.position.set(-1.05, CARA + 0.015, -0.1);
  pantalla.name = "pantalla";
  g.add(pantalla);
  interactivos.push({
    malla: pantalla,
    nombre: "pantalla",
    etiqueta: "entrar en el jardín",
    alturaBase: pantalla.position.y,
  });

  // tira de teclas bajo la pantalla
  const tonos = [PALETA.coral, PALETA.turquesa, PALETA.amarillo, PALETA.violeta];
  for (let i = 0; i < 6; i++) {
    const t = tecla(-2.0 + i * 0.38, 1.12, 0.3, tonos[i % 4]!);
    g.add(t);
    interactivos.push({
      malla: t,
      nombre: `tecla-${i}`,
      etiqueta: ["mirar", "regar", "plantar", "excavar", "etiquetas", "historia"][i]!,
      alturaBase: t.position.y,
    });
  }

  // retícula de pulsadores a la derecha
  for (let fila = 0; fila < 2; fila++) {
    for (let col = 0; col < 3; col++) {
      const b = tecla(0.55 + col * 0.42, -0.95 + fila * 0.42, 0.33, fila + col === 0 ? PALETA.amarillo : "#e3ded0");
      g.add(b);
      interactivos.push({
        malla: b,
        nombre: `mando-${fila}-${col}`,
        etiqueta: "mando",
        alturaBase: b.position.y,
      });
    }
  }

  // perillas
  g.add(perilla(2.05, -0.85, 0.3));
  g.add(perilla(1.5, -0.85, 0.2));

  // botón maestro
  const maestro = pulsador(2.0, 0.42, 0.42, 0.22, PALETA.coral);
  g.add(maestro);
  interactivos.push({
    malla: maestro,
    nombre: "maestro",
    etiqueta: "sonido",
    alturaBase: maestro.position.y,
  });

  // rejilla de altavoz troquelada
  for (let fx = 0; fx < 6; fx++) {
    for (let fz = 0; fz < 3; fz++) {
      const hoyo = new Mesh(
        new CylinderGeometry(0.045, 0.045, 0.06, 8),
        tapa("#c9c3b2", 0.9),
      );
      hoyo.position.set(0.62 + fx * 0.13, CARA - 0.01, 0.75 + fz * 0.13);
      g.add(hoyo);
    }
  }

  // leds de estado en el borde superior
  const leds = ["#7ddc5a", PALETA.amarillo, PALETA.coral];
  leds.forEach((c, i) => {
    const led = new Mesh(new SphereGeometry(0.055, 8, 6), new MeshStandardMaterial({
      color: new Color(c),
      emissive: new Color(c),
      emissiveIntensity: 0.6,
      roughness: 0.3,
    }));
    led.position.set(1.4 + i * 0.2, CARA + 0.02, -1.22);
    g.add(led);
  });

  // fader
  const carril = new Mesh(new RoundedBoxGeometry(0.16, 0.06, 1.1, 1, 0.03), tapa("#cdc7b6", 0.8));
  carril.position.set(0.18, CARA - 0.005, -0.7);
  g.add(carril);
  const pomo = new Mesh(new RoundedBoxGeometry(0.26, 0.14, 0.2, 2, 0.04), tapa(PALETA.grafito, 0.4));
  pomo.position.set(0.18, CARA + 0.07, -0.45);
  pomo.castShadow = true;
  g.add(pomo);

  return { grupo: g, interactivos, pantalla };
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
  consola.grupo.position.y = 0.3;
  diorama.add(consola.grupo);

  // las plantas se apartan del aparato, que ahora manda
  const sitios: [number, number, number, boolean][] = [
    [-4.3, 1.5, 1.5, false], [4.2, 1.7, -1.3, true], [-2.4, 1.2, -3.4, false],
    [2.6, 1.4, 3.2, true], [-4.4, 1.3, -1.4, true], [0.2, 1.6, 3.7, false],
    [4.4, 1.2, 1.1, false], [-0.6, 1.4, -3.8, true],
  ];
  for (const [x, alto, z, claro] of sitios) {
    const p = planta(alto, claro);
    p.position.set(x, 0.15, z);
    diorama.add(p);
  }

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const piedra = new Mesh(
      new IcosahedronGeometry(0.08 + (i % 3) * 0.04, 0),
      new MeshStandardMaterial({ color: new Color("#b9a98c"), roughness: 1, flatShading: true }),
    );
    piedra.position.set(Math.cos(a) * 4.6, 0.21, Math.sin(a) * 4.6);
    piedra.castShadow = true;
    diorama.add(piedra);
  }

  const sombra = new Mesh(
    new PlaneGeometry(60, 60),
    new MeshStandardMaterial({ color: new Color(PALETA.cieloBajo), roughness: 1 }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = -6.5;
  sombra.receiveShadow = true;
  scene.add(sombra);

  const key = new DirectionalLight(0xfff0d8, 2.6);
  key.position.set(6, 9, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -11;
  key.shadow.camera.right = 11;
  key.shadow.camera.top = 11;
  key.shadow.camera.bottom = -11;
  key.shadow.bias = -0.0008;
  scene.add(key);

  // rebote frío del cielo: sin esto la sombra sale negra y triste
  const relleno = new DirectionalLight(0xbfe0ff, 1.5);
  relleno.position.set(-7, 2, -5);
  scene.add(relleno);

  scene.add(new HemisphereLight(0xdcf2ff, 0xf0c98a, 1.6));

  return {
    scene,
    camera,
    diorama,
    interactivos: consola.interactivos,
    pantalla: consola.pantalla as Object3D,
  };
}

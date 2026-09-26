// El diorama: isla flotante, aparato y jardín.
//
// La isla no es decoración: su corte es la estructura del CV. Arriba el
// presente (el aparato, los árboles de cada etapa y los arbustos de los
// proyectos propios), en la línea del suelo las etiquetas de certificación,
// y abajo los estratos del stack.

import {
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
  ShadowMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ARBOLES, ARBUSTOS, ESTRATOS, ETIQUETAS } from "../jardin-datos";
import { plantaDe } from "./botanica3d";
import { montarCielo, type Luces } from "./cielo";

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
  // Escala de los árboles de etapa frente a los arbustos de proyecto.
  ESCALA_ARBOL: 5.2,
  ESCALA_ARBUSTO: 2.7,
};

const PALETA = {
  chasis:    "#f6f1e4",
  pantalla:  "#141f1a",
  coral:     "#ff6b4a",
  turquesa:  "#46b3a6",
  amarillo:  "#f5c451",
  violeta:   "#8a6fc4",
  grafito:   "#3b3a35",
  corteza:   "#8a6340",
  hoja:      "#5fbe4e",
  hojaClara: "#8fd86a",
  etiqueta:  "#efe9d8",
};

/** Un color por estrato, del césped a la roca madre. */
const TONOS_ESTRATO = ["#e7b955", "#e08a4e", "#d2605f", "#b0567f", "#9a5f9c", "#6a6fb0", "#4f7fb8", "#3a5c86"];

const ARRIBA = new Vector3(0, 1, 0);

export type Interactivo = {
  malla: Object3D;
  nombre: string;
  etiqueta: string;
  /** slug del contenido, si lo tiene */
  slug?: string;
};

/* ─── la isla ───────────────────────────────────────────────── */

const ALTO_CESPED = 0.4;

function isla() {
  const g = new Group();
  const radioTope = 5.3;

  const cesped = new Mesh(
    new CylinderGeometry(radioTope, radioTope * 0.97, ALTO_CESPED, 6),
    new MeshStandardMaterial({ color: new Color("#74c65a"), roughness: 0.92, flatShading: true }),
  );
  cesped.position.y = -ALTO_CESPED / 2;
  cesped.rotation.y = 0.26;
  cesped.castShadow = true;
  cesped.receiveShadow = true;
  g.add(cesped);

  // un estrato por tecnología del stack: el grosor es su peso
  let y = -ALTO_CESPED;
  let radio = radioTope * 0.97;
  ESTRATOS.forEach((estrato, i) => {
    const alto = 0.3 + estrato.peso * 0.22;
    const siguiente = radio * (0.9 - i * 0.012);
    const m = new Mesh(
      new CylinderGeometry(radio, siguiente, alto, 6),
      new MeshStandardMaterial({
        color: new Color(TONOS_ESTRATO[i % TONOS_ESTRATO.length]!),
        roughness: 0.94,
        flatShading: true,
      }),
    );
    m.position.y = y - alto / 2;
    m.rotation.y = 0.26;
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData["estrato"] = estrato.slug;
    g.add(m);
    y -= alto;
    radio = siguiente;
  });

  const punta = new Mesh(
    new CylinderGeometry(radio, 0.1, 2.0, 6),
    new MeshStandardMaterial({ color: new Color("#2f4a70"), roughness: 1, flatShading: true }),
  );
  punta.position.y = y - 1.0;
  punta.rotation.y = 0.26;
  punta.castShadow = true;
  g.add(punta);

  return g;
}

/* ─── plantas ───────────────────────────────────────────────── */

const matCorteza = new MeshStandardMaterial({
  color: new Color(PALETA.corteza),
  roughness: 0.95,
  flatShading: true,
});

function construirPlanta(slug: string, vigor: number, escala: number, claro: boolean) {
  const g = new Group();
  const matHoja = new MeshStandardMaterial({
    color: new Color(claro ? PALETA.hojaClara : PALETA.hoja),
    roughness: 0.82,
    flatShading: true,
  });

  for (const r of plantaDe(slug, vigor, escala)) {
    const largo = r.a.distanceTo(r.b);
    if (largo < 1e-4) continue;

    const tallo = new Mesh(
      new CylinderGeometry(r.grosor * 0.72, r.grosor, largo, 5),
      matCorteza,
    );
    tallo.position.copy(r.a).add(r.b).multiplyScalar(0.5);
    tallo.quaternion.setFromUnitVectors(ARRIBA, r.b.clone().sub(r.a).normalize());
    tallo.castShadow = true;
    g.add(tallo);

    if (r.hoja) {
      const hoja = new Mesh(new IcosahedronGeometry(r.grosor * 5.4, 0), matHoja);
      hoja.position.copy(r.b);
      hoja.scale.y = 0.72;
      hoja.castShadow = true;
      g.add(hoja);
    }
  }

  return g;
}

/** Vigor de una etapa: cuenta el tiempo, pero lo vivo pesa más que lo largo. */
function vigorEtapa(desde: string, hasta?: string) {
  const ini = new Date(`${desde}-01T00:00:00Z`).getTime();
  const fin = hasta ? new Date(`${hasta}-01T00:00:00Z`).getTime() : Date.now();
  const meses = Math.max((fin - ini) / (1000 * 60 * 60 * 24 * 30.4), 0);
  const vivo = hasta ? 0 : 0.35;
  return Math.min(0.2 + meses / 26 + vivo, 1);
}

/* ─── etiquetas de certificación ────────────────────────────── */

function etiquetaDeVivero(pendiente: boolean) {
  const g = new Group();

  const palo = new Mesh(
    new CylinderGeometry(0.035, 0.035, 0.62, 6),
    new MeshStandardMaterial({ color: new Color("#cfc7b2"), roughness: 0.9, flatShading: true }),
  );
  palo.position.y = 0.31;
  palo.castShadow = true;
  g.add(palo);

  const placa = new Mesh(
    new RoundedBoxGeometry(0.62, 0.36, 0.035, 2, 0.05),
    new MeshStandardMaterial({
      color: new Color(PALETA.etiqueta),
      roughness: pendiente ? 1 : 0.6,
      flatShading: true,
    }),
  );
  placa.position.y = 0.7;
  placa.castShadow = true;
  g.add(placa);

  // una pendiente va en blanco y ladeada: todavía no se ha clavado del todo
  if (pendiente) g.rotation.z = 0.16;

  return g;
}

/* ─── el aparato ────────────────────────────────────────────── */

const GROSOR_CHASIS = 0.54;
const CARA = GROSOR_CHASIS / 2;

const tapa = (color: string, rugosidad = 0.45) =>
  new MeshStandardMaterial({ color: new Color(color), roughness: rugosidad, flatShading: true });

function tecla(x: number, z: number, lado: number, color: string) {
  const m = new Mesh(new RoundedBoxGeometry(lado, 0.1, lado, 2, 0.022), tapa(color));
  m.position.set(x, CARA + 0.04, z);
  m.castShadow = true;
  return m;
}

function perilla(x: number, z: number, radio: number) {
  const g = new Group();
  const cuerpo = new Mesh(new CylinderGeometry(radio, radio * 1.06, 0.2, 12), tapa(PALETA.grafito, 0.38));
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

/** Los seis comandos de la tira de teclas, en orden. */
export const TECLAS = ["mirar", "regar", "plantar", "excavar", "etiquetas", "historia"] as const;

function aparato() {
  const g = new Group();
  const interactivos: Interactivo[] = [];

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

  const hueco = new Mesh(new RoundedBoxGeometry(2.5, 0.1, 1.8, 2, 0.05), tapa("#d8d2c2", 0.7));
  hueco.position.set(-1.05, CARA - 0.02, -0.1);
  g.add(hueco);

  const pantalla = new Mesh(
    new RoundedBoxGeometry(2.3, 0.1, 1.6, 2, 0.04),
    new MeshStandardMaterial({ color: new Color(PALETA.pantalla), roughness: 0.22, metalness: 0.15 }),
  );
  pantalla.position.set(-1.05, CARA + 0.015, -0.1);
  pantalla.name = "pantalla";
  g.add(pantalla);
  interactivos.push({ malla: pantalla, nombre: "pantalla", etiqueta: "entrar en el jardín" });

  const tonos = [PALETA.coral, PALETA.turquesa, PALETA.amarillo, PALETA.violeta];
  TECLAS.forEach((comando, i) => {
    const t = tecla(-2.0 + i * 0.38, 1.12, 0.3, tonos[i % 4]!);
    g.add(t);
    interactivos.push({ malla: t, nombre: `comando:${comando}`, etiqueta: comando });
  });

  for (let fila = 0; fila < 2; fila++) {
    for (let col = 0; col < 3; col++) {
      const b = tecla(0.55 + col * 0.42, -0.95 + fila * 0.42, 0.33, "#e3ded0");
      g.add(b);
      interactivos.push({ malla: b, nombre: `mando-${fila}-${col}`, etiqueta: "mando" });
    }
  }

  g.add(perilla(2.05, -0.85, 0.3));
  g.add(perilla(1.5, -0.85, 0.2));

  const maestro = new Mesh(new CylinderGeometry(0.42, 0.42, 0.22, 14), tapa(PALETA.coral));
  maestro.position.set(2.0, CARA + 0.09, 0.42);
  maestro.castShadow = true;
  g.add(maestro);
  interactivos.push({ malla: maestro, nombre: "comando:sonido", etiqueta: "sonido" });

  for (let fx = 0; fx < 6; fx++) {
    for (let fz = 0; fz < 3; fz++) {
      const hoyo = new Mesh(new CylinderGeometry(0.045, 0.045, 0.06, 8), tapa("#c9c3b2", 0.9));
      hoyo.position.set(0.62 + fx * 0.13, CARA - 0.01, 0.75 + fz * 0.13);
      g.add(hoyo);
    }
  }

  const leds: Mesh[] = [];
  ["#7ddc5a", PALETA.amarillo, PALETA.coral].forEach((c, i) => {
    const led = new Mesh(
      new SphereGeometry(0.055, 8, 6),
      new MeshStandardMaterial({
        color: new Color(c),
        emissive: new Color(c),
        emissiveIntensity: 0.6,
        roughness: 0.3,
      }),
    );
    led.position.set(1.4 + i * 0.2, CARA + 0.02, -1.22);
    g.add(led);
    leds.push(led);
  });

  const carril = new Mesh(new RoundedBoxGeometry(0.16, 0.06, 1.1, 1, 0.03), tapa("#cdc7b6", 0.8));
  carril.position.set(0.18, CARA - 0.005, -0.7);
  g.add(carril);
  const pomo = new Mesh(new RoundedBoxGeometry(0.26, 0.14, 0.2, 2, 0.04), tapa(PALETA.grafito, 0.4));
  pomo.position.set(0.18, CARA + 0.07, -0.45);
  pomo.castShadow = true;
  g.add(pomo);

  return { grupo: g, interactivos, pantalla, leds };
}

/* ─── montaje ───────────────────────────────────────────────── */

export function colocarCamara(camera: PerspectiveCamera, distancia: number, altura: number) {
  camera.position.set(distancia * 0.62, distancia * altura, distancia * 0.62);
  camera.lookAt(0, -0.7, 0);
}

export function construirEscena(anchoAlto: number) {
  const scene = new Scene();

  const camera = new PerspectiveCamera(24, anchoAlto, 1, 260);
  colocarCamara(camera, CALIBRACION.DISTANCIA, CALIBRACION.ALTURA);

  const diorama = new Group();
  scene.add(diorama);
  diorama.add(isla());

  const consola = aparato();
  consola.grupo.position.y = 0.3;
  diorama.add(consola.grupo);

  const interactivos: Interactivo[] = [...consola.interactivos];

  // los árboles de cada etapa, repartidos por el borde para no tapar el aparato
  const ANILLO_ARBOLES = 4.55;
  ARBOLES.forEach((arbol, i) => {
    const a = (i / ARBOLES.length) * Math.PI * 2 + 0.7;
    const planta = construirPlanta(
      arbol.slug,
      vigorEtapa(arbol.desde, arbol.hasta),
      CALIBRACION.ESCALA_ARBOL,
      i % 2 === 0,
    );
    planta.position.set(Math.cos(a) * ANILLO_ARBOLES, 0, Math.sin(a) * ANILLO_ARBOLES);
    diorama.add(planta);
    interactivos.push({
      malla: planta,
      nombre: `planta:${arbol.slug}`,
      etiqueta: `${arbol.nombre} · ${arbol.rol}`,
      slug: arbol.slug,
    });
  });

  // los arbustos de proyecto propio, más adentro y más pequeños
  const ANILLO_ARBUSTOS = 3.15;
  ARBUSTOS.forEach((arbusto, i) => {
    const a = (i / ARBUSTOS.length) * Math.PI * 2 + 0.25;
    const planta = construirPlanta(arbusto.slug, 0.55, CALIBRACION.ESCALA_ARBUSTO, i % 2 === 1);
    planta.position.set(Math.cos(a) * ANILLO_ARBUSTOS, 0, Math.sin(a) * ANILLO_ARBUSTOS);
    diorama.add(planta);
    interactivos.push({
      malla: planta,
      nombre: `planta:${arbusto.slug}`,
      etiqueta: arbusto.nombre,
      slug: arbusto.slug,
    });
  });

  // las etiquetas de certificación, en hilera a la altura del suelo
  ETIQUETAS.forEach((cert, i) => {
    const a = -0.9 + i * 0.22;
    const e = etiquetaDeVivero(cert.estado === "pendiente");
    e.position.set(Math.cos(a) * 4.85, 0, Math.sin(a) * 4.85);
    e.rotation.y = -a + Math.PI / 2;
    diorama.add(e);
    interactivos.push({
      malla: e,
      nombre: `etiqueta:${cert.codigo}`,
      etiqueta: `${cert.codigo} · ${cert.estado}`,
      slug: cert.codigo,
    });
  });

  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.4;
    const piedra = new Mesh(
      new IcosahedronGeometry(0.08 + (i % 3) * 0.04, 0),
      new MeshStandardMaterial({ color: new Color("#b9a98c"), roughness: 1, flatShading: true }),
    );
    piedra.position.set(Math.cos(a) * 4.9, 0.02, Math.sin(a) * 4.9);
    piedra.castShadow = true;
    diorama.add(piedra);
  }

  // suelo que solo recoge la sombra: sin material visible, para que no
  // reaparezca el plano de fondo que afeaba la escena
  const sombra = new Mesh(new PlaneGeometry(80, 80), new ShadowMaterial({ opacity: 0.16 }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = -7.5;
  sombra.receiveShadow = true;
  scene.add(sombra);

  const luces: Luces = {
    sol: new DirectionalLight(0xfff0d8, 2.6),
    relleno: new DirectionalLight(0xbfe0ff, 1.5),
    ambiente: new HemisphereLight(0xdcf2ff, 0xf0c98a, 1.6),
  };
  luces.sol.position.set(6, 9, 4);
  luces.sol.castShadow = true;
  luces.sol.shadow.mapSize.set(2048, 2048);
  luces.sol.shadow.camera.left = -11;
  luces.sol.shadow.camera.right = 11;
  luces.sol.shadow.camera.top = 11;
  luces.sol.shadow.camera.bottom = -11;
  luces.sol.shadow.bias = -0.0008;
  luces.relleno.position.set(-7, 2, -5);
  scene.add(luces.sol, luces.relleno, luces.ambiente);

  const cielo = montarCielo(scene, luces);

  return { scene, camera, diorama, interactivos, cielo, leds: consola.leds };
}

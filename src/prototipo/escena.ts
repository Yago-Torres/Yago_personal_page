// El diorama, en clave Y2K.
//
// Nada de caras planas: aquí manda el brillo. Plástico translúcido de colores
// tipo carcasa de los 2000, cromados con reflejo de entorno, teclas de caramelo
// e irisado en los remates. La isla sigue siendo el CV: arriba el presente,
// abajo los estratos del stack.

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
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ARBOLES, ARBUSTOS, ESTRATOS, ETIQUETAS } from "../jardin-datos.ts";
import { plantaDe } from "./botanica3d.ts";
import { montarCielo, type Luces } from "./cielo.ts";

export const CALIBRACION = {
  // Distancia de la cámara en la vista general. Subirlo aleja y aplana.
  DISTANCIA: 25,
  // Altura de la cámara. Bajarlo enseña más el corte del subsuelo.
  ALTURA: 0.44,
  // Giro automático del diorama, en grados por segundo. 0 lo deja quieto.
  GIRO: 2.2,
  // Grados de balanceo que añade el puntero.
  PARALAJE: 6,
  // Escala de los árboles de etapa frente a los arbustos de proyecto.
  ESCALA_ARBOL: 5.2,
  ESCALA_ARBUSTO: 2.7,
  // Redondez de la geometría. Bajarlo vuelve al low-poly de antes.
  LADOS: 28,
};

/** Paleta Y2K: plásticos de caramelo, cromo y un irisado de remate. */
const PALETA = {
  carcasa:   "#9fd8ee",   // translúcido tipo bondi
  carcasaAlt:"#c9a6e8",   // uva, para la variante
  cromo:     "#e8edf2",
  pantalla:  "#0b1a1f",
  coral:     "#ff5f8d",
  lima:      "#b6f03c",
  mandarina: "#ffa726",
  uva:       "#8e6bd6",
  cielo:     "#3ec8e0",
  corteza:   "#a8794f",
  hoja:      "#57cf5a",
  hojaClara: "#9bf06e",
  cesped:    "#5fd35f",
};

/** Un color por estrato, del césped a la roca madre. */
const TONOS_ESTRATO = [
  "#ffd257", "#ff9d4d", "#ff6f7d", "#e05bb0", "#a95fd6", "#6f74e0", "#4aa6e8", "#2f78bd",
];

const ARRIBA = new Vector3(0, 1, 0);

export type Interactivo = {
  malla: Object3D;
  nombre: string;
  etiqueta: string;
  slug?: string;
};

/* ─── materiales ────────────────────────────────────────────── */

/** Plástico de caramelo: brillante, con algo de transparencia. */
function caramelo(color: string, transparencia = 0) {
  return new MeshPhysicalMaterial({
    color: new Color(color),
    roughness: 0.14,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    transmission: transparencia,
    thickness: transparencia > 0 ? 1.2 : 0,
    ior: 1.5,
  });
}

/** Cromo: el remate de los 2000. */
function cromo(tinte = PALETA.cromo) {
  return new MeshStandardMaterial({
    color: new Color(tinte),
    roughness: 0.08,
    metalness: 1,
  });
}

/** Irisado: el tornasol de los CD y las carcasas holográficas. */
function irisado(color: string) {
  return new MeshPhysicalMaterial({
    color: new Color(color),
    roughness: 0.12,
    metalness: 0.35,
    iridescence: 1,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [120, 500],
    clearcoat: 1,
  });
}

/** Materia orgánica: brillo suave, sin facetas. */
function jugoso(color: string, brillo = 0.35) {
  return new MeshStandardMaterial({
    color: new Color(color),
    roughness: brillo,
    metalness: 0.05,
  });
}

/* ─── la isla ───────────────────────────────────────────────── */

const ALTO_CESPED = 0.4;

function isla() {
  const g = new Group();
  const radioTope = 5.3;
  const lados = CALIBRACION.LADOS;

  const cesped = new Mesh(
    new CylinderGeometry(radioTope, radioTope * 0.97, ALTO_CESPED, lados),
    jugoso(PALETA.cesped, 0.55),
  );
  cesped.position.y = -ALTO_CESPED / 2;
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
      new CylinderGeometry(radio, siguiente, alto, lados),
      caramelo(TONOS_ESTRATO[i % TONOS_ESTRATO.length]!),
    );
    m.position.y = y - alto / 2;
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData["estrato"] = estrato.slug;
    g.add(m);
    y -= alto;
    radio = siguiente;
  });

  const punta = new Mesh(
    new CylinderGeometry(radio, 0.12, 2.0, lados),
    caramelo("#2a5fa8"),
  );
  punta.position.y = y - 1.0;
  punta.castShadow = true;
  g.add(punta);

  // anillo cromado en la línea del suelo: remate de carcasa
  const aro = new Mesh(new TorusGeometry(radioTope * 0.985, 0.07, 10, lados * 2), cromo());
  aro.rotation.x = Math.PI / 2;
  aro.position.y = -ALTO_CESPED;
  g.add(aro);

  return g;
}

/* ─── plantas ───────────────────────────────────────────────── */

const matCorteza = jugoso(PALETA.corteza, 0.62);

function construirPlanta(slug: string, vigor: number, escala: number, claro: boolean) {
  const g = new Group();
  const matHoja = caramelo(claro ? PALETA.hojaClara : PALETA.hoja);

  for (const r of plantaDe(slug, vigor, escala)) {
    const largo = r.a.distanceTo(r.b);
    if (largo < 1e-4) continue;

    const tallo = new Mesh(
      new CylinderGeometry(r.grosor * 0.72, r.grosor, largo, 10),
      matCorteza,
    );
    tallo.position.copy(r.a).add(r.b).multiplyScalar(0.5);
    tallo.quaternion.setFromUnitVectors(ARRIBA, r.b.clone().sub(r.a).normalize());
    tallo.castShadow = true;
    g.add(tallo);

    if (r.hoja) {
      // esferas lisas, no icosaedros: se acabó el facetado
      const hoja = new Mesh(new SphereGeometry(r.grosor * 5.4, 14, 10), matHoja);
      hoja.position.copy(r.b);
      hoja.scale.y = 0.78;
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
  return Math.min(0.2 + meses / 26 + (hasta ? 0 : 0.35), 1);
}

/* ─── etiquetas de certificación ────────────────────────────── */

function etiquetaDeVivero(pendiente: boolean) {
  const g = new Group();

  const palo = new Mesh(new CylinderGeometry(0.035, 0.035, 0.62, 10), cromo("#cfd6de"));
  palo.position.y = 0.31;
  palo.castShadow = true;
  g.add(palo);

  const placa = new Mesh(
    new RoundedBoxGeometry(0.62, 0.36, 0.04, 3, 0.06),
    pendiente ? caramelo("#ffffff", 0.35) : irisado("#dfe7f0"),
  );
  placa.position.y = 0.7;
  placa.castShadow = true;
  g.add(placa);

  if (pendiente) g.rotation.z = 0.16;
  return g;
}

/* ─── el aparato ────────────────────────────────────────────── */

const GROSOR_CHASIS = 0.54;
const CARA = GROSOR_CHASIS / 2;

function tecla(x: number, z: number, lado: number, color: string) {
  const m = new Mesh(new RoundedBoxGeometry(lado, 0.11, lado, 4, 0.03), caramelo(color, 0.12));
  m.position.set(x, CARA + 0.045, z);
  m.castShadow = true;
  return m;
}

function perilla(x: number, z: number, radio: number) {
  const g = new Group();
  const cuerpo = new Mesh(new CylinderGeometry(radio, radio * 1.06, 0.2, 24), cromo());
  cuerpo.castShadow = true;
  g.add(cuerpo);
  const marca = new Mesh(
    new RoundedBoxGeometry(radio * 0.18, 0.04, radio * 0.9, 2, 0.015),
    caramelo(PALETA.coral),
  );
  marca.position.set(0, 0.1, -radio * 0.42);
  g.add(marca);
  g.position.set(x, CARA + 0.08, z);
  g.rotation.y = -0.5;
  return g;
}

export const TECLAS = ["mirar", "regar", "plantar", "excavar", "etiquetas", "historia"] as const;

function aparato() {
  const g = new Group();
  const interactivos: Interactivo[] = [];

  // carcasa translúcida de color, lo más Y2K que hay
  const cuerpo = new Mesh(
    new RoundedBoxGeometry(5.0, GROSOR_CHASIS, 3.0, 6, 0.24),
    new MeshPhysicalMaterial({
      color: new Color(PALETA.carcasa),
      roughness: 0.1,
      metalness: 0,
      transmission: 0.55,
      thickness: 1.4,
      ior: 1.52,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      iridescence: 0.35,
      iridescenceIOR: 1.4,
    }),
  );
  cuerpo.castShadow = true;
  cuerpo.receiveShadow = true;
  g.add(cuerpo);

  // marco cromado de la pantalla
  const marco = new Mesh(new RoundedBoxGeometry(2.62, 0.12, 1.92, 4, 0.07), cromo());
  marco.position.set(-1.05, CARA - 0.02, -0.1);
  g.add(marco);

  const pantalla = new Mesh(
    new RoundedBoxGeometry(2.3, 0.1, 1.6, 3, 0.04),
    new MeshPhysicalMaterial({
      color: new Color(PALETA.pantalla),
      roughness: 0.06,
      metalness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
    }),
  );
  pantalla.position.set(-1.05, CARA + 0.02, -0.1);
  pantalla.name = "pantalla";
  g.add(pantalla);
  interactivos.push({ malla: pantalla, nombre: "pantalla", etiqueta: "abrir el jardín" });

  const tonos = [PALETA.coral, PALETA.cielo, PALETA.mandarina, PALETA.uva, PALETA.lima, PALETA.coral];
  TECLAS.forEach((comando, i) => {
    const t = tecla(-2.0 + i * 0.38, 1.12, 0.3, tonos[i]!);
    g.add(t);
    interactivos.push({ malla: t, nombre: `comando:${comando}`, etiqueta: comando });
  });

  for (let fila = 0; fila < 2; fila++) {
    for (let col = 0; col < 3; col++) {
      const b = tecla(0.55 + col * 0.42, -0.95 + fila * 0.42, 0.33, PALETA.cromo);
      g.add(b);
      interactivos.push({ malla: b, nombre: `mando-${fila}-${col}`, etiqueta: "mando" });
    }
  }

  g.add(perilla(2.05, -0.85, 0.3), perilla(1.5, -0.85, 0.2));

  const maestro = new Mesh(new CylinderGeometry(0.42, 0.42, 0.24, 28), caramelo(PALETA.coral, 0.1));
  maestro.position.set(2.0, CARA + 0.1, 0.42);
  maestro.castShadow = true;
  g.add(maestro);
  interactivos.push({ malla: maestro, nombre: "comando:sonido", etiqueta: "sonido" });

  // aro irisado alrededor del botón grande
  const aro = new Mesh(new TorusGeometry(0.52, 0.035, 10, 32), irisado("#ffd9e8"));
  aro.rotation.x = Math.PI / 2;
  aro.position.set(2.0, CARA + 0.01, 0.42);
  g.add(aro);

  const rejilla = new Mesh(
    new RoundedBoxGeometry(0.92, 0.05, 0.46, 3, 0.03),
    cromo("#c4ccd6"),
  );
  rejilla.position.set(0.96, CARA - 0.005, 0.88);
  g.add(rejilla);

  ["#5fff9b", PALETA.mandarina, PALETA.coral].forEach((c, i) => {
    const led = new Mesh(
      new SphereGeometry(0.06, 16, 12),
      new MeshStandardMaterial({
        color: new Color(c),
        emissive: new Color(c),
        emissiveIntensity: 1.1,
        roughness: 0.15,
      }),
    );
    led.position.set(1.4 + i * 0.2, CARA + 0.02, -1.22);
    g.add(led);
  });

  return { grupo: g, interactivos, pantalla };
}

/* ─── montaje ───────────────────────────────────────────────── */

export function construirEscena(anchoAlto: number, renderer: WebGLRenderer) {
  const scene = new Scene();

  // reflejos de entorno: sin esto el cromo es gris muerto
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.75;

  const camera = new PerspectiveCamera(24, anchoAlto, 1, 260);

  const diorama = new Group();
  scene.add(diorama);
  diorama.add(isla());

  const consola = aparato();
  consola.grupo.position.y = 0.3;
  diorama.add(consola.grupo);

  const interactivos: Interactivo[] = [...consola.interactivos];

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

  // guijarros irisados, como cuentas de plástico
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.4;
    const piedra = new Mesh(new IcosahedronGeometry(0.1 + (i % 3) * 0.04, 1), irisado("#dff0ff"));
    piedra.position.set(Math.cos(a) * 4.9, 0.05, Math.sin(a) * 4.9);
    piedra.castShadow = true;
    diorama.add(piedra);
  }

  const sombra = new Mesh(new PlaneGeometry(80, 80), new ShadowMaterial({ opacity: 0.14 }));
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

  return { scene, camera, diorama, interactivos, cielo, pantalla: consola.pantalla };
}

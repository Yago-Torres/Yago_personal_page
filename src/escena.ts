// La azotea.
//
// Un trozo de tejado con un Yago diminuto que hace cosas según el tiempo que
// haga de verdad en la ciudad elegida: riega las macetas si luce, saca el
// paraguas si llueve y se pone a trabajar cuando cae la noche.
//
// Monocroma: todo vive en tonos de un mismo acento con la crema de contrapunto,
// que es lo que la mantiene pegada a la página.

import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const CALIBRACION = {
  // Distancia de la cámara. Subirlo aleja y aplana hacia isométrico.
  DISTANCIA: 13.5,
  // Altura de la cámara, en proporción a la distancia.
  ALTURA: 0.46,
  // Grados por segundo del giro automático. 0 deja la azotea quieta.
  GIRO: 2.4,
  // Grados de balanceo que añade el puntero.
  PARALAJE: 5,
  // Segundos que tarda Yago en ir de una maceta a la siguiente.
  PASO: 3.2,
  // Cuánto se mecen las plantas con el viento, por cada 100 km/h.
  MECIDA: 0.5,
  // Gotas de lluvia.
  GOTAS: 700,
  CAIDA: 18,
};

const TONOS = {
  dia: { base: "#e9432a", hondo: "#b32a17", alto: "#f68a76", crema: "#f4efe6", oscuro: "#6d1a0e" },
  noche: { base: "#c9381f", hondo: "#8a2211", alto: "#e9705a", crema: "#e6e0d4", oscuro: "#40100a" },
};

export type Faena = "regar" | "trabajar" | "paraguas";

function mate(color: string, rugosidad = 0.62) {
  return new MeshStandardMaterial({ color: new Color(color), roughness: rugosidad, metalness: 0.02 });
}

export function montarEscena(lienzo: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  renderer.setClearAlpha(0);
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 1, 100);

  const azotea = new Group();
  scene.add(azotea);

  const mats = {
    obra: mate(TONOS.dia.base, 0.85),
    obraHonda: mate(TONOS.dia.hondo, 0.88),
    pretil: mate(TONOS.dia.alto, 0.8),
    piel: mate(TONOS.dia.crema, 0.7),
    pelo: mate(TONOS.dia.hondo, 0.75),
    ropa: mate(TONOS.dia.base, 0.6),
    metal: mate(TONOS.dia.alto, 0.35),
    hoja: mate(TONOS.dia.alto, 0.6),
    sombra: mate(TONOS.dia.oscuro, 0.5),
  };

  /* ─── el edificio ─── */

  const LADO = 4.4;

  const losa = new Mesh(new RoundedBoxGeometry(LADO, 0.36, LADO, 3, 0.06), mats.obra);
  losa.receiveShadow = true;
  losa.castShadow = true;
  azotea.add(losa);

  // el bloque de abajo, solo lo justo para que se entienda que es un tejado
  const bloque = new Mesh(new RoundedBoxGeometry(LADO * 0.94, 2.1, LADO * 0.94, 3, 0.06), mats.obraHonda);
  bloque.position.y = -1.25;
  bloque.castShadow = true;
  azotea.add(bloque);

  // pretil en dos lados: da profundidad sin cerrar la vista
  for (const [x, z, ancho, fondo] of [
    [0, -LADO / 2 + 0.12, LADO, 0.24],
    [-LADO / 2 + 0.12, 0, 0.24, LADO],
  ] as const) {
    const muro = new Mesh(new RoundedBoxGeometry(ancho, 0.62, fondo, 3, 0.05), mats.pretil);
    muro.position.set(x, 0.49, z);
    muro.castShadow = true;
    muro.receiveShadow = true;
    azotea.add(muro);
  }

  // caseta de la escalera
  const caseta = new Mesh(new RoundedBoxGeometry(1.35, 1.2, 1.2, 3, 0.07), mats.pretil);
  caseta.position.set(-1.2, 0.78, -1.1);
  caseta.castShadow = true;
  azotea.add(caseta);

  const puerta = new Mesh(new RoundedBoxGeometry(0.62, 0.86, 0.06, 2, 0.03), mats.sombra);
  puerta.position.set(-1.35, 0.61, -0.63);
  azotea.add(puerta);

  // depósito de agua
  const deposito = new Mesh(new CylinderGeometry(0.42, 0.42, 0.72, 20), mats.metal);
  deposito.position.set(1.7, 0.72, -1.55);
  deposito.castShadow = true;
  azotea.add(deposito);

  // antena
  const mastil = new Mesh(new CylinderGeometry(0.035, 0.05, 1.9, 8), mats.metal);
  mastil.position.set(-1.35, 2.35, -1.3);
  azotea.add(mastil);
  for (let i = 0; i < 3; i++) {
    const brazo = new Mesh(new CylinderGeometry(0.02, 0.02, 0.62 - i * 0.14, 6), mats.metal);
    brazo.rotation.z = Math.PI / 2;
    brazo.position.set(-1.35, 2.75 + i * 0.26, -1.3);
    azotea.add(brazo);
  }

  /* ─── las macetas ─── */

  const SITIOS: [number, number][] = [
    [1.25, 1.15],
    [0.15, 1.5],
    [-0.75, 1.2],
    [1.5, 0.05],
  ];
  const plantas: Group[] = [];

  for (const [x, z] of SITIOS) {
    const maceta = new Group();
    const tiesto = new Mesh(new CylinderGeometry(0.24, 0.19, 0.34, 14), mats.pretil);
    tiesto.position.y = 0.34;
    tiesto.castShadow = true;
    maceta.add(tiesto);

    const mata = new Group();
    const tallo = new Mesh(new CylinderGeometry(0.03, 0.045, 0.8, 8), mats.pelo);
    tallo.position.y = 0.4;
    mata.add(tallo);
    for (let h = 0; h < 4; h++) {
      const a = (h / 4) * Math.PI * 2;
      const hoja = new Mesh(new SphereGeometry(0.17, 12, 9), mats.hoja);
      hoja.scale.set(0.42, 0.3, 1.25);
      hoja.position.set(Math.cos(a) * 0.2, 0.62 + (h % 2) * 0.16, Math.sin(a) * 0.2);
      hoja.rotation.y = -a;
      hoja.rotation.x = -0.5;
      hoja.castShadow = true;
      mata.add(hoja);
    }
    mata.position.y = 0.5;
    maceta.add(mata);
    maceta.userData["mata"] = mata;

    maceta.position.set(x, 0.18, z);
    azotea.add(maceta);
    plantas.push(maceta);
  }

  /* ─── Yago ─── */

  const yago = new Group();

  const piernas = new Mesh(new RoundedBoxGeometry(0.26, 0.34, 0.2, 3, 0.05), mats.sombra);
  piernas.position.y = 0.17;
  piernas.castShadow = true;
  yago.add(piernas);

  // la camiseta roja de la foto es justo el acento: encaja sin forzar nada
  const torso = new Mesh(new RoundedBoxGeometry(0.38, 0.42, 0.26, 3, 0.07), mats.ropa);
  torso.position.y = 0.55;
  torso.castShadow = true;
  yago.add(torso);

  const brazoIzq = new Mesh(new CylinderGeometry(0.055, 0.05, 0.36, 8), mats.piel);
  brazoIzq.position.set(-0.24, 0.56, 0);
  brazoIzq.castShadow = true;
  yago.add(brazoIzq);

  const brazoDer = new Mesh(new CylinderGeometry(0.055, 0.05, 0.36, 8), mats.piel);
  brazoDer.position.set(0.24, 0.56, 0);
  brazoDer.castShadow = true;
  yago.add(brazoDer);

  const cuello = new Mesh(new CylinderGeometry(0.06, 0.06, 0.07, 8), mats.piel);
  cuello.position.y = 0.79;
  yago.add(cuello);

  const cabeza = new Mesh(new SphereGeometry(0.17, 20, 16), mats.piel);
  cabeza.position.y = 0.95;
  cabeza.scale.set(0.92, 1, 0.92);
  cabeza.castShadow = true;
  yago.add(cabeza);

  // el pelo, revuelto y con volumen: es lo que hace que se reconozca
  const pelo = new Group();
  const casquete = new Mesh(new SphereGeometry(0.185, 18, 14), mats.pelo);
  casquete.scale.set(1, 0.82, 1);
  casquete.position.y = 0.04;
  pelo.add(casquete);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const mecha = new Mesh(new SphereGeometry(0.075, 10, 8), mats.pelo);
    mecha.position.set(Math.cos(a) * 0.115, 0.13 + (i % 3) * 0.035, Math.sin(a) * 0.115);
    mecha.scale.set(1, 1.5, 1);
    mecha.rotation.z = Math.cos(a) * 0.5;
    pelo.add(mecha);
  }
  pelo.position.y = 0.99;
  yago.add(pelo);

  yago.scale.setScalar(1.55);
  azotea.add(yago);

  /* ─── los trastos ─── */

  const regadera = new Group();
  const cubo = new Mesh(new CylinderGeometry(0.1, 0.085, 0.16, 12), mats.metal);
  regadera.add(cubo);
  const pitorro = new Mesh(new CylinderGeometry(0.022, 0.032, 0.24, 8), mats.metal);
  pitorro.rotation.z = -0.9;
  pitorro.position.set(0.13, 0.03, 0);
  regadera.add(pitorro);
  regadera.position.set(0.3, 0.46, 0.1);
  yago.add(regadera);

  // el chorro, solo visible en el momento de regar
  const chorro = new Mesh(new CylinderGeometry(0.012, 0.02, 0.4, 6), mats.metal);
  chorro.position.set(0.44, 0.24, 0.1);
  chorro.visible = false;
  yago.add(chorro);

  const paraguas = new Group();
  const varilla = new Mesh(new CylinderGeometry(0.018, 0.018, 0.72, 6), mats.metal);
  varilla.position.y = 0.36;
  paraguas.add(varilla);
  const copa = new Mesh(new SphereGeometry(0.46, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.pretil);
  copa.position.y = 0.66;
  copa.scale.y = 0.62;
  copa.castShadow = true;
  paraguas.add(copa);
  paraguas.position.set(0.26, 0.46, 0.05);
  paraguas.visible = false;
  yago.add(paraguas);

  const escritorio = new Group();
  const tablero = new Mesh(new RoundedBoxGeometry(0.85, 0.06, 0.5, 2, 0.02), mats.pretil);
  tablero.position.y = 0.42;
  tablero.castShadow = true;
  escritorio.add(tablero);
  for (const [px, pz] of [[-0.34, -0.17], [0.34, -0.17], [-0.34, 0.17], [0.34, 0.17]] as const) {
    const pata = new Mesh(new CylinderGeometry(0.022, 0.022, 0.42, 6), mats.sombra);
    pata.position.set(px, 0.21, pz);
    escritorio.add(pata);
  }
  const portatil = new Mesh(new RoundedBoxGeometry(0.34, 0.24, 0.02, 2, 0.01), mats.metal);
  portatil.position.set(0, 0.58, -0.1);
  portatil.rotation.x = -0.28;
  escritorio.add(portatil);
  const brillo = new Mesh(new RoundedBoxGeometry(0.3, 0.2, 0.01, 2, 0.01), mate(TONOS.dia.crema, 0.2));
  brillo.material.emissive = new Color(TONOS.dia.crema);
  brillo.material.emissiveIntensity = 0.6;
  brillo.position.set(0, 0.58, -0.088);
  brillo.rotation.x = -0.28;
  escritorio.add(brillo);
  const silla = new Mesh(new RoundedBoxGeometry(0.3, 0.06, 0.3, 2, 0.02), mats.sombra);
  silla.position.set(0, 0.3, 0.52);
  escritorio.add(silla);
  escritorio.position.set(-1.9, 0.18, 1.35);
  escritorio.visible = false;
  azotea.add(escritorio);

  /* ─── lluvia ─── */

  const gotas = new Float32Array(CALIBRACION.GOTAS * 6);
  const geoLluvia = new BufferGeometry();
  geoLluvia.setAttribute("position", new BufferAttribute(gotas, 3));
  const lluvia = new LineSegments(
    geoLluvia,
    new LineBasicMaterial({ color: new Color(TONOS.dia.hondo), transparent: true, opacity: 0.45 }),
  );
  lluvia.frustumCulled = false;
  lluvia.visible = false;
  scene.add(lluvia);
  for (let i = 0; i < CALIBRACION.GOTAS; i++) {
    const j = i * 6;
    gotas[j] = (Math.random() - 0.5) * 11;
    gotas[j + 1] = Math.random() * 11;
    gotas[j + 2] = (Math.random() - 0.5) * 11;
    gotas[j + 3] = gotas[j]!;
    gotas[j + 4] = gotas[j + 1]! - 0.55;
    gotas[j + 5] = gotas[j + 2]!;
  }

  /* ─── sol, y un aro que hace de sol o de luna ─── */

  const astro = new Mesh(new TorusGeometry(0.62, 0.07, 10, 28), mats.metal);
  astro.position.set(2.1, 3.1, -1.2);
  azotea.add(astro);

  const sol = new DirectionalLight(0xffffff, 2.4);
  sol.position.set(4, 7, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.left = -6;
  sol.shadow.camera.right = 6;
  sol.shadow.camera.top = 6;
  sol.shadow.camera.bottom = -6;
  sol.shadow.bias = -0.001;
  scene.add(sol);
  const relleno = new DirectionalLight(0xffffff, 0.75);
  relleno.position.set(-5, 3, -3);
  scene.add(relleno);
  scene.add(new AmbientLight(0xffffff, 1.15));

  /* ─── estado ─── */

  let giro = 0;
  let balanceoX = 0;
  let balanceoY = 0;
  let punteroX = 0;
  let punteroY = 0;
  let reloj = 0;
  let faena: Faena = "regar";
  let viento = 0;
  let destino = 0;
  let cambio = 0;

  function medir() {
    const caja = lienzo.getBoundingClientRect();
    if (!caja.width || !caja.height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(caja.width, caja.height, false);
    camera.aspect = caja.width / caja.height;
    const lejos = CALIBRACION.DISTANCIA * Math.max(1, 0.95 / Math.max(camera.aspect, 0.35));
    camera.position.set(lejos * 0.62, lejos * CALIBRACION.ALTURA, lejos * 0.62);
    camera.lookAt(0, -0.15, 0);
    camera.updateProjectionMatrix();
  }

  return {
    medir,

    pintar(turno: "dia" | "noche") {
      const p = TONOS[turno];
      mats.obra.color.set(p.base);
      mats.obraHonda.color.set(p.hondo);
      mats.pretil.color.set(p.alto);
      mats.piel.color.set(p.crema);
      mats.pelo.color.set(p.hondo);
      mats.ropa.color.set(p.base);
      mats.metal.color.set(p.alto);
      mats.hoja.color.set(p.alto);
      mats.sombra.color.set(p.oscuro);
      (brillo.material as MeshStandardMaterial).color.set(p.crema);
      (brillo.material as MeshStandardMaterial).emissive.set(p.crema);
      (lluvia.material as LineBasicMaterial).color.set(p.hondo);
    },

    /** Qué está haciendo Yago ahí arriba. */
    hacer(nueva: Faena) {
      if (nueva === faena) return;
      faena = nueva;
      paraguas.visible = nueva === "paraguas";
      regadera.visible = nueva === "regar";
      chorro.visible = false;
      escritorio.visible = nueva === "trabajar";
      lluvia.visible = nueva === "paraguas";
    },

    /** Velocidad del viento en km/h: mece las plantas y la antena. */
    soplar(kmh: number) {
      viento = kmh;
    },

    apuntar(x: number, y: number) {
      punteroX = x;
      punteroY = y;
    },

    cuadro(dt: number, quieto: boolean) {
      reloj += dt;

      if (!quieto) giro += ((CALIBRACION.GIRO * Math.PI) / 180) * dt;
      const rad = (CALIBRACION.PARALAJE * Math.PI) / 180;
      balanceoY += (punteroX * rad - balanceoY) * 0.05;
      balanceoX += (punteroY * rad * 0.5 - balanceoX) * 0.05;
      azotea.rotation.y = giro + balanceoY;
      azotea.rotation.x = balanceoX;

      // las plantas se mecen con el viento de verdad
      const mecida = (viento / 100) * CALIBRACION.MECIDA;
      plantas.forEach((maceta, i) => {
        const mata = maceta.userData["mata"] as Group;
        mata.rotation.z = Math.sin(reloj * 1.6 + i) * mecida;
        mata.rotation.x = Math.cos(reloj * 1.2 + i * 2) * mecida * 0.6;
      });
      mastil.rotation.z = Math.sin(reloj * 2.1) * mecida * 0.35;

      if (faena === "regar") {
        // va de maceta en maceta, se para y riega
        cambio += dt;
        if (cambio > CALIBRACION.PASO) {
          cambio = 0;
          destino = (destino + 1) % SITIOS.length;
        }
        const objetivo = SITIOS[destino]!;
        const meta = { x: objetivo[0] - 0.55, z: objetivo[1] - 0.1 };
        yago.position.x += (meta.x - yago.position.x) * dt * 2.2;
        yago.position.z += (meta.z - yago.position.z) * dt * 2.2;
        yago.position.y = 0.18 + Math.abs(Math.sin(reloj * 6)) * 0.02;
        yago.rotation.y = Math.atan2(objetivo[0] - yago.position.x, objetivo[1] - yago.position.z);

        const regando = cambio > CALIBRACION.PASO * 0.45;
        chorro.visible = regando;
        regadera.rotation.z = regando ? -0.7 : 0;
      } else if (faena === "trabajar") {
        yago.position.x += (-1.9 - yago.position.x) * dt * 2.2;
        yago.position.z += (1.87 - yago.position.z) * dt * 2.2;
        yago.position.y = 0.32;
        yago.rotation.y = Math.PI;
        // el teclear: un cabeceo mínimo
        cabeza.position.y = 0.95 + Math.sin(reloj * 7) * 0.008;
      } else {
        yago.position.x += (0.2 - yago.position.x) * dt * 2.2;
        yago.position.z += (0.9 - yago.position.z) * dt * 2.2;
        yago.position.y = 0.18;
        yago.rotation.y = 0.5;
        paraguas.rotation.z = Math.sin(reloj * 1.4) * 0.05;
      }

      astro.rotation.z += dt * 0.15;

      if (lluvia.visible) {
        const caida = CALIBRACION.CAIDA * dt;
        for (let i = 0; i < CALIBRACION.GOTAS; i++) {
          const j = i * 6;
          gotas[j + 1] = gotas[j + 1]! - caida;
          gotas[j + 4] = gotas[j + 4]! - caida;
          if (gotas[j + 4]! < -3.5) {
            gotas[j] = (Math.random() - 0.5) * 11;
            gotas[j + 2] = (Math.random() - 0.5) * 11;
            gotas[j + 1] = 9;
            gotas[j + 3] = gotas[j]!;
            gotas[j + 4] = 8.45;
            gotas[j + 5] = gotas[j + 2]!;
          }
        }
        geoLluvia.attributes["position"]!.needsUpdate = true;
      }

      renderer.render(scene, camera);
    },
  };
}

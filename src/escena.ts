// La isla de la portada.
//
// Monocroma: todo el objeto vive en tonos de un mismo color, con la crema
// como único contrapunto. Es lo que la mantiene pegada a la página en vez de
// parecer una ilustración distinta metida con calzador.
//
// El contenido lo lee del DOM: cada [data-planta] del documento es una planta.

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
  Vector3,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { plantaDe } from "./botanica3d.ts";

export const CALIBRACION = {
  // Distancia de la cámara. Subirlo aleja y aplana hacia isométrico.
  DISTANCIA: 23,
  // Altura de la cámara sobre el suelo, en proporción a la distancia.
  ALTURA: 0.46,
  // Grados por segundo del giro automático. 0 deja la isla quieta.
  GIRO: 3.2,
  // Grados de balanceo que añade el puntero.
  PARALAJE: 5,
  // Radio del disco de tierra.
  RADIO: 5.0,
  // Escala de árboles (etapas) y arbustos (proyectos).
  ESCALA_ARBOL: 5.4,
  ESCALA_ARBUSTO: 3.0,
  // Gotas cuando llueve de verdad en Zaragoza.
  GOTAS: 900,
  CAIDA: 22,
};

/** Los dos juegos de tonos: de día el objeto es del acento, de noche es crema. */
const TONOS = {
  dia: { base: "#e9432a", hondo: "#b32a17", alto: "#f68a76", crema: "#f4efe6", oscuro: "#6d1a0e" },
  noche: { base: "#c9381f", hondo: "#8a2211", alto: "#e9705a", crema: "#e6e0d4", oscuro: "#40100a" },
};

const ARRIBA = new Vector3(0, 1, 0);

type Paleta = (typeof TONOS)["dia"];

function mate(color: string, rugosidad = 0.62) {
  return new MeshStandardMaterial({ color: new Color(color), roughness: rugosidad, metalness: 0.02 });
}

/** Planta descrita en el documento: <article data-planta="slug" data-vigor="0.6"> */
export type Semilla = { slug: string; vigor: number; arbol: boolean };

export function leerPlantasDelDocumento(): Semilla[] {
  return [...document.querySelectorAll<HTMLElement>("[data-planta]")].map((el) => ({
    slug: el.dataset["planta"]!,
    vigor: Number(el.dataset["vigor"] ?? 0.5),
    // las etapas son <article>; los proyectos son tarjetas enlazadas
    arbol: el.tagName === "ARTICLE",
  }));
}

export function montarEscena(lienzo: HTMLCanvasElement, semillas: Semilla[]) {
  const renderer = new WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  renderer.setClearAlpha(0);
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 1, 120);

  const isla = new Group();
  scene.add(isla);

  /* ─── materiales, reasignables al cambiar día/noche ─── */

  const mats = {
    tierra: mate(TONOS.dia.base, 0.78),
    tierraHonda: mate(TONOS.dia.hondo, 0.82),
    corteza: mate(TONOS.dia.hondo, 0.7),
    hoja: mate(TONOS.dia.alto, 0.6),
    carcasa: mate(TONOS.dia.crema, 0.45),
    detalle: mate(TONOS.dia.oscuro, 0.4),
    canto: mate(TONOS.dia.alto, 0.5),
  };

  /* ─── el disco de tierra ─── */

  const R = CALIBRACION.RADIO;
  const tapa = new Mesh(new CylinderGeometry(R, R, 0.5, 64), mats.tierra);
  tapa.position.y = -0.25;
  tapa.castShadow = true;
  tapa.receiveShadow = true;
  isla.add(tapa);

  // el cono del subsuelo, en el tono hondo
  const cono = new Mesh(new CylinderGeometry(R * 0.99, 0.2, 4.6, 64), mats.tierraHonda);
  cono.position.y = -2.8;
  cono.castShadow = true;
  isla.add(cono);

  // filo claro en la línea del suelo: separa la hierba de la tierra
  const filo = new Mesh(new CylinderGeometry(R * 1.005, R * 1.005, 0.08, 64), mats.canto);
  filo.position.y = -0.02;
  isla.add(filo);

  /* ─── el aparato, reducido a su silueta ─── */

  const aparato = new Group();
  const cuerpo = new Mesh(new RoundedBoxGeometry(3.5, 0.42, 2.1, 5, 0.18), mats.carcasa);
  cuerpo.castShadow = true;
  cuerpo.receiveShadow = true;
  aparato.add(cuerpo);

  const visor = new Mesh(new RoundedBoxGeometry(1.7, 0.08, 1.15, 3, 0.05), mats.detalle);
  visor.position.set(-0.68, 0.23, 0);
  aparato.add(visor);

  for (let i = 0; i < 4; i++) {
    const t = new Mesh(new RoundedBoxGeometry(0.26, 0.1, 0.26, 3, 0.03), mats.detalle);
    t.position.set(0.62 + (i % 2) * 0.36, 0.23, -0.3 + Math.floor(i / 2) * 0.36);
    t.castShadow = true;
    aparato.add(t);
  }

  const perilla = new Mesh(new CylinderGeometry(0.2, 0.22, 0.18, 20), mats.canto);
  perilla.position.set(1.45, 0.26, 0.34);
  perilla.castShadow = true;
  aparato.add(perilla);

  aparato.position.y = 0.21;
  isla.add(aparato);

  /* ─── las plantas ─── */

  const plantas = new Map<string, Group>();

  const arboles = semillas.filter((s) => s.arbol);
  const arbustos = semillas.filter((s) => !s.arbol);

  function sembrar(s: Semilla, radio: number, angulo: number, escala: number) {
    const g = new Group();
    for (const r of plantaDe(s.slug, s.vigor, escala)) {
      const largo = r.a.distanceTo(r.b);
      if (largo < 1e-4) continue;
      const tallo = new Mesh(new CylinderGeometry(r.grosor * 0.7, r.grosor, largo, 8), mats.corteza);
      tallo.position.copy(r.a).add(r.b).multiplyScalar(0.5);
      tallo.quaternion.setFromUnitVectors(ARRIBA, r.b.clone().sub(r.a).normalize());
      tallo.castShadow = true;
      g.add(tallo);
      if (r.hoja) {
        const hoja = new Mesh(new SphereGeometry(r.grosor * 5.2, 12, 9), mats.hoja);
        hoja.position.copy(r.b);
        hoja.scale.y = 0.8;
        hoja.castShadow = true;
        g.add(hoja);
      }
    }
    g.position.set(Math.cos(angulo) * radio, 0, Math.sin(angulo) * radio);
    isla.add(g);
    plantas.set(s.slug, g);
  }

  arboles.forEach((s, i) =>
    sembrar(s, R * 0.78, (i / Math.max(arboles.length, 1)) * Math.PI * 2 + 0.6, CALIBRACION.ESCALA_ARBOL),
  );
  arbustos.forEach((s, i) =>
    sembrar(s, R * 0.44, (i / Math.max(arbustos.length, 1)) * Math.PI * 2 + 0.2, CALIBRACION.ESCALA_ARBUSTO),
  );

  /* ─── la marca del visitante ─── */

  const flor = new Group();
  const tallo = new Mesh(new CylinderGeometry(0.03, 0.04, 0.5, 8), mats.corteza);
  tallo.position.y = 0.25;
  const capullo = new Mesh(new SphereGeometry(0.17, 16, 12), mats.canto);
  capullo.position.y = 0.55;
  flor.add(tallo, capullo);
  flor.position.set(R * 0.92, 0, -R * 0.2);
  flor.visible = false;
  isla.add(flor);

  /* ─── lluvia ─── */

  const gotas = new Float32Array(CALIBRACION.GOTAS * 6);
  const geoLluvia = new BufferGeometry();
  geoLluvia.setAttribute("position", new BufferAttribute(gotas, 3));
  const lluvia = new LineSegments(
    geoLluvia,
    new LineBasicMaterial({ color: new Color(TONOS.dia.hondo), transparent: true, opacity: 0.5 }),
  );
  lluvia.frustumCulled = false;
  lluvia.visible = false;
  scene.add(lluvia);

  for (let i = 0; i < CALIBRACION.GOTAS; i++) {
    const j = i * 6;
    gotas[j] = (Math.random() - 0.5) * 16;
    gotas[j + 1] = Math.random() * 16;
    gotas[j + 2] = (Math.random() - 0.5) * 16;
    gotas[j + 3] = gotas[j]!;
    gotas[j + 4] = gotas[j + 1]! - 0.7;
    gotas[j + 5] = gotas[j + 2]!;
  }

  /* ─── luz ─── */

  const sol = new DirectionalLight(0xffffff, 2.5);
  sol.position.set(5, 8, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.left = -8;
  sol.shadow.camera.right = 8;
  sol.shadow.camera.top = 8;
  sol.shadow.camera.bottom = -8;
  sol.shadow.bias = -0.001;
  scene.add(sol);

  const relleno = new DirectionalLight(0xffffff, 0.8);
  relleno.position.set(-6, 3, -4);
  scene.add(relleno);
  scene.add(new AmbientLight(0xffffff, 1.1));

  /* ─── control ─── */

  let giro = 0;
  let balanceoX = 0;
  let balanceoY = 0;
  let punteroX = 0;
  let punteroY = 0;
  let lloviendo = false;

  function medir() {
    const caja = lienzo.getBoundingClientRect();
    if (!caja.width || !caja.height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(caja.width, caja.height, false);
    camera.aspect = caja.width / caja.height;
    // en marcos estrechos hay que retirarse o la isla no cabe
    const lejos = CALIBRACION.DISTANCIA * Math.max(1, 0.95 / Math.max(camera.aspect, 0.35));
    camera.position.set(lejos * 0.6, lejos * CALIBRACION.ALTURA, lejos * 0.6);
    camera.lookAt(0, -1.9, 0);
    camera.updateProjectionMatrix();
  }

  return {
    medir,

    /** Cambia todo el objeto de golpe a la paleta de día o de noche. */
    pintar(turno: "dia" | "noche") {
      const p: Paleta = TONOS[turno];
      mats.tierra.color.set(p.base);
      mats.tierraHonda.color.set(p.hondo);
      mats.corteza.color.set(p.hondo);
      mats.hoja.color.set(p.alto);
      mats.carcasa.color.set(p.crema);
      mats.detalle.color.set(p.oscuro);
      mats.canto.color.set(p.alto);
      (lluvia.material as LineBasicMaterial).color.set(p.hondo);
    },

    llover(si: boolean) {
      lloviendo = si;
      lluvia.visible = si;
    },

    /** La flor del visitante aparece con su mensaje. */
    florecer(si: boolean) {
      flor.visible = si;
    },

    apuntar(x: number, y: number) {
      punteroX = x;
      punteroY = y;
    },

    cuadro(dt: number, quieto: boolean) {
      if (!quieto) giro += ((CALIBRACION.GIRO * Math.PI) / 180) * dt;
      const rad = (CALIBRACION.PARALAJE * Math.PI) / 180;
      balanceoY += (punteroX * rad - balanceoY) * 0.05;
      balanceoX += (punteroY * rad * 0.5 - balanceoX) * 0.05;
      isla.rotation.y = giro + balanceoY;
      isla.rotation.x = balanceoX;

      if (lloviendo) {
        const caida = CALIBRACION.CAIDA * dt;
        for (let i = 0; i < CALIBRACION.GOTAS; i++) {
          const j = i * 6;
          gotas[j + 1] = gotas[j + 1]! - caida;
          gotas[j + 4] = gotas[j + 4]! - caida;
          if (gotas[j + 4]! < -5) {
            gotas[j] = (Math.random() - 0.5) * 16;
            gotas[j + 2] = (Math.random() - 0.5) * 16;
            gotas[j + 1] = 14;
            gotas[j + 3] = gotas[j]!;
            gotas[j + 4] = 13.3;
            gotas[j + 5] = gotas[j + 2]!;
          }
        }
        geoLluvia.attributes["position"]!.needsUpdate = true;
      }

      renderer.render(scene, camera);
    },

    /** Un respingo de la planta, para señalarla desde la página. */
    palmear(slug: string) {
      const g = plantas.get(slug);
      if (g) g.userData["palmada"] = 0;
    },

    animarPalmadas(dt: number) {
      for (const g of plantas.values()) {
        const t = g.userData["palmada"] as number | undefined;
        if (t === undefined) continue;
        const avance = t + dt * 2.4;
        if (avance >= 1) {
          g.scale.setScalar(1);
          delete g.userData["palmada"];
        } else {
          g.userData["palmada"] = avance;
          g.scale.setScalar(1 + Math.sin(avance * Math.PI) * 0.12);
        }
      }
    },
  };
}

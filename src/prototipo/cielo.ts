// El cielo: cúpula en degradado, nubes de poliedros, lluvia y estrellas.
//
// Sustituye al plano de fondo plano, que era lo más feo de la escena. El color
// y la luz siguen la hora real de Zaragoza, y las nubes y la lluvia siguen el
// tiempo real de allí. Si llueve en Zaragoza, llueve en el jardín.

import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import type { Meteo } from "./meteo";

export const CALIBRACION = {
  // Radio de la cúpula. Tiene que englobar la isla y las nubes con holgura.
  RADIO: 90,
  // Nubes con nubosidad al 100%. Bajarlo despeja el cielo.
  NUBES_MAX: 30,
  // Altura media del banco de nubes. Negativa: la isla flota por encima.
  ALTURA_NUBES: -6.5,
  // Radio del anillo de nubes alrededor del diorama.
  ANILLO_NUBES: 27,
  // Velocidad de deriva de las nubes, en radianes por segundo.
  DERIVA: 0.012,
  // Gotas de lluvia con precipitación fuerte. Subirlo carga la GPU.
  GOTAS_MAX: 1400,
  // Velocidad de caída de la lluvia, en unidades por segundo.
  CAIDA: 26,
  // Estrellas de noche.
  ESTRELLAS: 260,
};

/** Paleta del cielo por franja horaria: [cenit, horizonte, sol, ambiente]. */
const FRANJAS: { hasta: number; cenit: string; horizonte: string; sol: string; ambiente: string }[] = [
  { hasta: 5,  cenit: "#16255a", horizonte: "#33477f", sol: "#9fb4ea", ambiente: "#54689c" },
  { hasta: 8,  cenit: "#4f7fc4", horizonte: "#ffbd77", sol: "#ffd2a1", ambiente: "#9fb4d8" },
  { hasta: 11, cenit: "#5cb4e0", horizonte: "#ffe3bc", sol: "#fff0d8", ambiente: "#dcf2ff" },
  { hasta: 18, cenit: "#4aa8dc", horizonte: "#cfeaf5", sol: "#fff0d8", ambiente: "#dcf2ff" },
  { hasta: 21, cenit: "#4c7fc0", horizonte: "#ff8a52", sol: "#ffb787", ambiente: "#c6b9d6" },
  { hasta: 24, cenit: "#16255a", horizonte: "#33477f", sol: "#9fb4ea", ambiente: "#54689c" },
];

function franja(hora: number) {
  return FRANJAS.find((f) => hora < f.hasta) ?? FRANJAS[FRANJAS.length - 1]!;
}

/** Cuando está muy nublado el cielo se apaga y se agrisa. */
function agrisar(c: Color, nubosidad: number) {
  const gris = new Color("#9aa3a8");
  return c.clone().lerp(gris, nubosidad * 0.55);
}

function crearCupula() {
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uCenit: { value: new Color("#bfe6f0") },
      uHorizonte: { value: new Color("#ffe6c9") },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCenit;
      uniform vec3 uHorizonte;
      varying vec3 vPos;
      void main() {
        // la mezcla se concentra cerca del horizonte, como un cielo de verdad
        float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(uHorizonte, uCenit, pow(h, 0.65)), 1.0);
      }
    `,
  });

  return new Mesh(new SphereGeometry(CALIBRACION.RADIO, 32, 16), material);
}

/** Una nube: racimo de poliedros achatados, a juego con el resto del diorama. */
function crearNube(semilla: number) {
  const g = new Group();
  const material = new MeshStandardMaterial({
    color: new Color("#ffffff"),
    roughness: 1,
    flatShading: true,
  });

  const bolas = 3 + (semilla % 3);
  for (let i = 0; i < bolas; i++) {
    const r = 0.85 + ((semilla * (i + 3)) % 7) * 0.12;
    const bola = new Mesh(new IcosahedronGeometry(r, 0), material);
    bola.position.set(
      (i - bolas / 2) * 0.82 + (((semilla * (i + 1)) % 5) - 2) * 0.12,
      (((semilla * (i + 2)) % 4) - 1.5) * 0.28,
      (((semilla * (i + 5)) % 5) - 2) * 0.3,
    );
    bola.scale.y = 0.62;
    g.add(bola);
  }
  return g;
}

function crearLluvia() {
  const n = CALIBRACION.GOTAS_MAX;
  const pos = new Float32Array(n * 6);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  const malla = new LineSegments(
    geo,
    new LineBasicMaterial({ color: new Color("#cfe3f5"), transparent: true, opacity: 0.55 }),
  );
  malla.frustumCulled = false;
  malla.visible = false;
  return { malla, pos, geo };
}

function crearEstrellas() {
  const n = CALIBRACION.ESTRELLAS;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // repartidas por la media esfera superior
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * 0.62 + 0.12;
    const r = CALIBRACION.RADIO * 0.82;
    pos[i * 3] = Math.cos(u) * Math.sin(v * Math.PI) * r;
    pos[i * 3 + 1] = Math.cos(v * Math.PI) * -r;
    pos[i * 3 + 2] = Math.sin(u) * Math.sin(v * Math.PI) * r;
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  const puntos = new Points(
    geo,
    new PointsMaterial({
      color: new Color("#ffffff"),
      size: 0.55,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  return puntos;
}

export type Luces = {
  sol: DirectionalLight;
  relleno: DirectionalLight;
  ambiente: HemisphereLight;
};

export function montarCielo(scene: Scene, luces: Luces) {
  const cupula = crearCupula();
  scene.add(cupula);

  const estrellas = crearEstrellas();
  scene.add(estrellas);

  const nubes = new Group();
  scene.add(nubes);
  for (let i = 0; i < CALIBRACION.NUBES_MAX; i++) {
    const nube = crearNube(i * 37 + 11);
    const a = (i / CALIBRACION.NUBES_MAX) * Math.PI * 2;
    const radio = CALIBRACION.ANILLO_NUBES * (0.82 + ((i * 13) % 7) / 22);
    nube.position.set(
      Math.cos(a) * radio,
      CALIBRACION.ALTURA_NUBES + (((i * 7) % 5) - 2) * 2.2,
      Math.sin(a) * radio,
    );
    nube.userData["angulo"] = a;
    nube.userData["radio"] = radio;
    nube.visible = false;
    nubes.add(nube);
  }

  const lluvia = crearLluvia();
  scene.add(lluvia.malla);

  // sol de mentira, un disco que se ve en la cúpula
  const disco = new Mesh(
    new SphereGeometry(1.5, 12, 8),
    new MeshBasicMaterial({ color: new Color("#fff4d6") }),
  );
  disco.position.set(28, 26, 16);
  scene.add(disco);

  let gotasActivas = 0;
  let deNoche = false;
  let cuantasNubes = 0;

  /** Aplica hora y tiempo real: color del cielo, luz, nubes y lluvia. */
  function aplicar(meteo: Meteo, hora24: number) {
    const f = franja(hora24);
    deNoche = hora24 < 6 || hora24 >= 21;

    const mat = cupula.material as ShaderMaterial;
    (mat.uniforms["uCenit"]!.value as Color).copy(agrisar(new Color(f.cenit), meteo.nubosidad));
    (mat.uniforms["uHorizonte"]!.value as Color).copy(
      agrisar(new Color(f.horizonte), meteo.nubosidad),
    );

    // con nubes o de noche, el sol pega menos
    const apagado = 1 - meteo.nubosidad * 0.55;
    luces.sol.color.set(f.sol);
    luces.sol.intensity = (deNoche ? 1.35 : 2.6) * apagado;
    luces.relleno.color.set(f.ambiente);
    luces.relleno.intensity = deNoche ? 1.5 : 1.5;
    luces.ambiente.color.set(f.ambiente);
    luces.ambiente.intensity = deNoche ? 1.7 : 1.6;

    disco.visible = !deNoche && meteo.nubosidad < 0.7;
    (disco.material as MeshBasicMaterial).color.set(f.sol);

    (estrellas.material as PointsMaterial).opacity = deNoche ? 1 - meteo.nubosidad * 0.8 : 0;

    cuantasNubes = Math.round(meteo.nubosidad * CALIBRACION.NUBES_MAX);

    const llueve = meteo.precipitacion > 0 || meteo.cielo === "lluvia" || meteo.cielo === "tormenta";
    gotasActivas = llueve
      ? Math.round(Math.min(meteo.precipitacion / 3, 1) * (CALIBRACION.GOTAS_MAX - 320) + 320)
      : 0;
    lluvia.malla.visible = gotasActivas > 0;

    if (gotasActivas > 0) {
      const p = lluvia.pos;
      for (let i = 0; i < gotasActivas; i++) {
        const j = i * 6;
        p[j] = (Math.random() - 0.5) * 42;
        p[j + 1] = Math.random() * 30 - 4;
        p[j + 2] = (Math.random() - 0.5) * 42;
        p[j + 3] = p[j]!;
        p[j + 4] = p[j + 1]! - 0.9;
        p[j + 5] = p[j + 2]!;
      }
      lluvia.geo.setDrawRange(0, gotasActivas * 2);
      lluvia.geo.attributes["position"]!.needsUpdate = true;
    }
  }

  /** Deriva de nubes y caída de la lluvia. */
  function animar(dt: number, camara: Vector3) {
    const lejos = camara.length();
    nubes.children.forEach((n, i) => {
      const a = (n.userData["angulo"] as number) + CALIBRACION.DERIVA * dt;
      n.userData["angulo"] = a;
      const radio = n.userData["radio"] as number;
      n.position.x = Math.cos(a) * radio;
      n.position.z = Math.sin(a) * radio;
      // solo se ven las que estan por detras de la isla: las de delante
      // taparian el diorama y parecerian tempanos flotando ante el objetivo
      n.visible = i < cuantasNubes && n.position.distanceTo(camara) > lejos;
    });

    if (gotasActivas > 0) {
      const p = lluvia.pos;
      const caida = CALIBRACION.CAIDA * dt;
      for (let i = 0; i < gotasActivas; i++) {
        const j = i * 6;
        p[j + 1] = p[j + 1]! - caida;
        p[j + 4] = p[j + 4]! - caida;
        if (p[j + 4]! < -8) {
          // reaparece arriba en otra posición
          p[j] = (Math.random() - 0.5) * 42;
          p[j + 2] = (Math.random() - 0.5) * 42;
          p[j + 1] = 26;
          p[j + 3] = p[j]!;
          p[j + 4] = 25.1;
          p[j + 5] = p[j + 2]!;
        }
      }
      lluvia.geo.attributes["position"]!.needsUpdate = true;
    }
  }

  return { aplicar, animar, esDeNoche: () => deNoche };
}

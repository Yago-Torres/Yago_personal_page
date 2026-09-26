// La azotea de Yago, que es medio estudio.
//
// Hay escritorio, piano, guitarras, un micro de grabación, una cama y macetas.
// Yago hace una cosa u otra según la hora, el día de la semana y el tiempo que
// haga de verdad en la ciudad elegida. Y si pulsas un trasto, va y lo usa.

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
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const CALIBRACION = {
  // Distancia de la cámara. Subirlo aleja y aplana hacia isométrico.
  DISTANCIA: 14.5,
  // Altura de la cámara, en proporción a la distancia.
  ALTURA: 0.44,
  // Grados por segundo del giro automático.
  GIRO: 2.2,
  // Grados de balanceo que añade el puntero.
  PARALAJE: 4,
  // Lo rápido que Yago se desplaza a su sitio.
  ANDAR: 2.4,
  // Cuánto se mecen las plantas por cada 100 km/h de viento.
  MECIDA: 0.5,
  GOTAS: 650,
  CAIDA: 18,
};

/** Colores de verdad: la escena ya no es monocroma. */
const COLOR = {
  losa: "#c2bcae",
  bloque: "#9a9287",
  pretil: "#d6d0c2",
  caseta: "#cac3b4",
  metal: "#9aa3ab",
  tierra: "#7a5641",
  tiesto: "#c4693f",
  hoja: "#5aa84f",
  hojaClara: "#79c463",
  madera: "#a9713f",
  maderaOsc: "#6f4526",
  piel: "#e9b58c",
  pelo: "#c46a2c",
  camiseta: "#d8422e",
  vaquero: "#3f5878",
  zapato: "#2f3338",
  pianoNegro: "#23252a",
  teclaBlanca: "#f2efe8",
  sabana: "#eae5d9",
  almohada: "#ffffff",
  pantallaOn: "#9fe6ff",
  guitarraRoja: "#c0392b",
  cielo: "#8fd0e8",
};

export type Faena = "trabajar" | "piano" | "guitarra" | "micro" | "regar" | "dormir" | "paraguas";

/** Dónde se pone Yago y hacia dónde mira para cada faena. */
const PUESTOS: Record<Faena, { x: number; z: number; giro: number }> = {
  trabajar: { x: -1.55, z: -0.55, giro: 0 },
  piano: { x: -1.5, z: 1.72, giro: Math.PI },
  guitarra: { x: 1.65, z: 1.35, giro: Math.PI * 0.85 },
  micro: { x: 0.35, z: 1.05, giro: 0.1 },
  regar: { x: 1.5, z: -1.15, giro: -1.2 },
  dormir: { x: 1.45, z: -1.35, giro: 0 },
  paraguas: { x: 0.1, z: 0.35, giro: 0.6 },
};

function mate(color: string, rugosidad = 0.72, metalico = 0.02) {
  return new MeshStandardMaterial({
    color: new Color(color),
    roughness: rugosidad,
    metalness: metalico,
  });
}

export function montarEscena(lienzo: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  renderer.setClearAlpha(0);
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 1, 100);

  const azotea = new Group();
  scene.add(azotea);

  /** Trastos sobre los que se puede pulsar. */
  const pulsables: { raiz: Object3D; faena: Faena; nombre: string }[] = [];

  /* ─── el edificio ─── */

  const LADO = 4.6;

  const losa = new Mesh(new RoundedBoxGeometry(LADO, 0.34, LADO, 3, 0.06), mate(COLOR.losa, 0.9));
  losa.receiveShadow = true;
  losa.castShadow = true;
  azotea.add(losa);

  const bloque = new Mesh(
    new RoundedBoxGeometry(LADO * 0.93, 2.0, LADO * 0.93, 3, 0.06),
    mate(COLOR.bloque, 0.92),
  );
  bloque.position.y = -1.18;
  bloque.castShadow = true;
  azotea.add(bloque);

  for (const [x, z, ancho, fondo] of [
    [0, -LADO / 2 + 0.1, LADO, 0.2],
    [-LADO / 2 + 0.1, 0, 0.2, LADO],
  ] as const) {
    const muro = new Mesh(new RoundedBoxGeometry(ancho, 0.5, fondo, 3, 0.04), mate(COLOR.pretil, 0.88));
    muro.position.set(x, 0.42, z);
    muro.castShadow = true;
    muro.receiveShadow = true;
    azotea.add(muro);
  }

  const caseta = new Mesh(new RoundedBoxGeometry(1.1, 1.0, 1.0, 3, 0.06), mate(COLOR.caseta, 0.88));
  caseta.position.set(-1.45, 0.67, -1.6);
  caseta.castShadow = true;
  azotea.add(caseta);

  /* ─── escritorio ─── */

  const escritorio = new Group();
  const tablero = new Mesh(new RoundedBoxGeometry(1.15, 0.07, 0.6, 2, 0.02), mate(COLOR.madera, 0.65));
  tablero.position.y = 0.52;
  tablero.castShadow = true;
  escritorio.add(tablero);
  for (const [px, pz] of [[-0.48, -0.22], [0.48, -0.22], [-0.48, 0.22], [0.48, 0.22]] as const) {
    const pata = new Mesh(new CylinderGeometry(0.025, 0.025, 0.52, 8), mate(COLOR.maderaOsc, 0.7));
    pata.position.set(px, 0.26, pz);
    escritorio.add(pata);
  }
  const base = new Mesh(new RoundedBoxGeometry(0.42, 0.02, 0.3, 2, 0.01), mate(COLOR.zapato, 0.4, 0.4));
  base.position.set(0, 0.57, 0.05);
  escritorio.add(base);
  const tapa = new Mesh(new RoundedBoxGeometry(0.42, 0.28, 0.02, 2, 0.01), mate(COLOR.zapato, 0.4, 0.4));
  tapa.position.set(0, 0.7, -0.09);
  tapa.rotation.x = -0.22;
  escritorio.add(tapa);
  const brillo = new Mesh(
    new RoundedBoxGeometry(0.37, 0.23, 0.01, 2, 0.005),
    new MeshStandardMaterial({
      color: new Color(COLOR.pantallaOn),
      emissive: new Color(COLOR.pantallaOn),
      emissiveIntensity: 0.55,
      roughness: 0.3,
    }),
  );
  brillo.position.set(0, 0.7, -0.078);
  brillo.rotation.x = -0.22;
  escritorio.add(brillo);
  escritorio.position.set(-1.55, 0.17, -1.15);
  azotea.add(escritorio);
  pulsables.push({ raiz: escritorio, faena: "trabajar", nombre: "el escritorio" });

  /* ─── cama ─── */

  const cama = new Group();
  const somier = new Mesh(new RoundedBoxGeometry(1.0, 0.18, 1.55, 3, 0.04), mate(COLOR.maderaOsc, 0.75));
  somier.position.y = 0.2;
  somier.castShadow = true;
  cama.add(somier);
  const colchon = new Mesh(new RoundedBoxGeometry(0.94, 0.2, 1.48, 3, 0.07), mate(COLOR.sabana, 0.85));
  colchon.position.y = 0.38;
  colchon.castShadow = true;
  cama.add(colchon);
  const almohada = new Mesh(new RoundedBoxGeometry(0.62, 0.14, 0.32, 3, 0.06), mate(COLOR.almohada, 0.9));
  almohada.position.set(0, 0.52, -0.52);
  cama.add(almohada);
  const cabecero = new Mesh(new RoundedBoxGeometry(1.0, 0.5, 0.08, 3, 0.03), mate(COLOR.maderaOsc, 0.7));
  cabecero.position.set(0, 0.48, -0.78);
  cama.add(cabecero);
  cama.position.set(1.45, 0.17, -1.1);
  azotea.add(cama);
  pulsables.push({ raiz: cama, faena: "dormir", nombre: "la cama" });

  /* ─── piano ─── */

  const piano = new Group();
  const mueble = new Mesh(new RoundedBoxGeometry(1.5, 0.62, 0.46, 3, 0.04), mate(COLOR.pianoNegro, 0.35));
  mueble.position.y = 0.55;
  mueble.castShadow = true;
  piano.add(mueble);
  const teclado = new Mesh(new RoundedBoxGeometry(1.34, 0.05, 0.26, 2, 0.015), mate(COLOR.teclaBlanca, 0.5));
  teclado.position.set(0, 0.87, 0.14);
  piano.add(teclado);
  for (let i = 0; i < 9; i++) {
    const negra = new Mesh(new RoundedBoxGeometry(0.045, 0.035, 0.15, 1, 0.008), mate(COLOR.pianoNegro, 0.4));
    negra.position.set(-0.58 + i * 0.145, 0.91, 0.09);
    piano.add(negra);
  }
  for (const px of [-0.66, 0.66] as const) {
    const pata = new Mesh(new CylinderGeometry(0.045, 0.045, 0.52, 8), mate(COLOR.pianoNegro, 0.4));
    pata.position.set(px, 0.26, 0);
    piano.add(pata);
  }
  const banqueta = new Mesh(new RoundedBoxGeometry(0.52, 0.09, 0.26, 2, 0.02), mate(COLOR.maderaOsc, 0.7));
  banqueta.position.set(0, 0.4, 0.62);
  piano.add(banqueta);
  piano.position.set(-1.5, 0.17, 1.28);
  piano.rotation.y = Math.PI;
  azotea.add(piano);
  pulsables.push({ raiz: piano, faena: "piano", nombre: "el piano" });

  /* ─── guitarras ─── */

  function guitarra(color: string) {
    const g = new Group();
    const caja = new Mesh(new SphereGeometry(0.26, 18, 14), mate(color, 0.42));
    caja.scale.set(1, 1.2, 0.34);
    caja.position.y = 0.3;
    caja.castShadow = true;
    g.add(caja);
    const cintura = new Mesh(new SphereGeometry(0.19, 16, 12), mate(color, 0.42));
    cintura.scale.set(1, 1, 0.34);
    cintura.position.y = 0.62;
    g.add(cintura);
    const boca = new Mesh(new CylinderGeometry(0.075, 0.075, 0.02, 16), mate("#2b1d12", 0.9));
    boca.rotation.x = Math.PI / 2;
    boca.position.set(0, 0.34, 0.09);
    g.add(boca);
    const mastil = new Mesh(new RoundedBoxGeometry(0.075, 0.72, 0.05, 2, 0.02), mate(COLOR.maderaOsc, 0.6));
    mastil.position.y = 1.08;
    g.add(mastil);
    const pala = new Mesh(new RoundedBoxGeometry(0.11, 0.18, 0.04, 2, 0.02), mate(COLOR.maderaOsc, 0.6));
    pala.position.y = 1.5;
    g.add(pala);
    const pie = new Mesh(new CylinderGeometry(0.02, 0.16, 0.16, 10), mate(COLOR.metal, 0.4, 0.7));
    pie.position.y = 0.06;
    g.add(pie);
    return g;
  }

  const guitarras = new Group();
  const g1 = guitarra(COLOR.madera);
  g1.position.set(-0.28, 0, 0);
  g1.rotation.z = 0.08;
  const g2 = guitarra(COLOR.guitarraRoja);
  g2.position.set(0.3, 0, 0.12);
  g2.rotation.z = -0.1;
  guitarras.add(g1, g2);
  guitarras.position.set(1.62, 0.17, 1.62);
  guitarras.rotation.y = -0.6;
  azotea.add(guitarras);
  pulsables.push({ raiz: guitarras, faena: "guitarra", nombre: "las guitarras" });

  /* ─── micrófono ─── */

  const micro = new Group();
  const trípode = new Mesh(new CylinderGeometry(0.022, 0.03, 1.15, 10), mate(COLOR.metal, 0.35, 0.8));
  trípode.position.y = 0.58;
  micro.add(trípode);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pataM = new Mesh(new CylinderGeometry(0.014, 0.014, 0.3, 6), mate(COLOR.metal, 0.35, 0.8));
    pataM.position.set(Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1);
    pataM.rotation.z = Math.cos(a) * 0.7;
    pataM.rotation.x = -Math.sin(a) * 0.7;
    micro.add(pataM);
  }
  const capsula = new Mesh(new CylinderGeometry(0.075, 0.075, 0.22, 16), mate(COLOR.zapato, 0.4, 0.5));
  capsula.position.y = 1.2;
  capsula.castShadow = true;
  micro.add(capsula);
  const rejilla = new Mesh(new SphereGeometry(0.08, 14, 10), mate(COLOR.metal, 0.3, 0.9));
  rejilla.position.y = 1.31;
  micro.add(rejilla);
  const antipop = new Mesh(new CylinderGeometry(0.11, 0.11, 0.015, 18), mate("#2f3338", 0.8));
  antipop.rotation.x = Math.PI / 2;
  antipop.position.set(0, 1.26, 0.17);
  micro.add(antipop);
  micro.position.set(0.35, 0.17, 1.62);
  azotea.add(micro);
  pulsables.push({ raiz: micro, faena: "micro", nombre: "el micrófono" });

  /* ─── macetas ─── */

  const SITIOS: [number, number][] = [
    [1.75, -0.05],
    [1.15, 0.45],
    [-0.3, -1.65],
  ];
  const plantas: Group[] = [];
  for (const [x, z] of SITIOS) {
    const maceta = new Group();
    const tiesto = new Mesh(new CylinderGeometry(0.2, 0.16, 0.3, 16), mate(COLOR.tiesto, 0.85));
    tiesto.position.y = 0.15;
    tiesto.castShadow = true;
    maceta.add(tiesto);
    const sustrato = new Mesh(new CylinderGeometry(0.18, 0.18, 0.04, 16), mate(COLOR.tierra, 1));
    sustrato.position.y = 0.3;
    maceta.add(sustrato);

    const mata = new Group();
    const tallo = new Mesh(new CylinderGeometry(0.025, 0.035, 0.42, 8), mate(COLOR.hoja, 0.8));
    tallo.position.y = 0.21;
    mata.add(tallo);
    for (let h = 0; h < 5; h++) {
      const a = (h / 5) * Math.PI * 2;
      const hoja = new Mesh(new SphereGeometry(0.15, 12, 9), mate(h % 2 ? COLOR.hoja : COLOR.hojaClara, 0.75));
      hoja.scale.set(0.4, 0.28, 1.1);
      hoja.position.set(Math.cos(a) * 0.14, 0.34 + (h % 2) * 0.12, Math.sin(a) * 0.14);
      hoja.rotation.y = -a;
      hoja.rotation.x = -0.55;
      hoja.castShadow = true;
      mata.add(hoja);
    }
    mata.position.y = 0.3;
    maceta.add(mata);
    maceta.userData["mata"] = mata;
    maceta.position.set(x, 0.17, z);
    azotea.add(maceta);
    plantas.push(maceta);
  }
  pulsables.push({ raiz: plantas[0]!, faena: "regar", nombre: "las macetas" });

  /* ─── Yago ─── */

  const yago = new Group();

  const piernas = new Mesh(new RoundedBoxGeometry(0.24, 0.32, 0.18, 3, 0.05), mate(COLOR.vaquero, 0.85));
  piernas.position.y = 0.16;
  piernas.castShadow = true;
  yago.add(piernas);

  const torso = new Mesh(new RoundedBoxGeometry(0.34, 0.38, 0.23, 3, 0.07), mate(COLOR.camiseta, 0.8));
  torso.position.y = 0.5;
  torso.castShadow = true;
  yago.add(torso);

  const brazoIzq = new Mesh(new CylinderGeometry(0.05, 0.045, 0.34, 8), mate(COLOR.piel, 0.8));
  brazoIzq.position.set(-0.21, 0.5, 0);
  brazoIzq.castShadow = true;
  yago.add(brazoIzq);
  const brazoDer = new Mesh(new CylinderGeometry(0.05, 0.045, 0.34, 8), mate(COLOR.piel, 0.8));
  brazoDer.position.set(0.21, 0.5, 0);
  brazoDer.castShadow = true;
  yago.add(brazoDer);

  const cabeza = new Mesh(new SphereGeometry(0.155, 20, 16), mate(COLOR.piel, 0.8));
  cabeza.position.y = 0.85;
  cabeza.scale.set(0.93, 1, 0.93);
  cabeza.castShadow = true;
  yago.add(cabeza);

  // el pelo revuelto: es lo que hace que se reconozca
  const pelo = new Group();
  const casquete = new Mesh(new SphereGeometry(0.168, 18, 14), mate(COLOR.pelo, 0.9));
  casquete.scale.set(1, 0.84, 1);
  pelo.add(casquete);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const mecha = new Mesh(new SphereGeometry(0.068, 10, 8), mate(COLOR.pelo, 0.9));
    mecha.position.set(Math.cos(a) * 0.105, 0.085 + (i % 3) * 0.032, Math.sin(a) * 0.105);
    mecha.scale.set(1, 1.5, 1);
    mecha.rotation.z = Math.cos(a) * 0.5;
    pelo.add(mecha);
  }
  pelo.position.y = 0.895;
  yago.add(pelo);

  yago.scale.setScalar(1.35);
  azotea.add(yago);

  /* ─── trastos que lleva encima ─── */

  const regadera = new Group();
  regadera.add(new Mesh(new CylinderGeometry(0.09, 0.075, 0.14, 12), mate(COLOR.metal, 0.4, 0.6)));
  const pitorro = new Mesh(new CylinderGeometry(0.02, 0.028, 0.2, 8), mate(COLOR.metal, 0.4, 0.6));
  pitorro.rotation.z = -0.9;
  pitorro.position.set(0.11, 0.02, 0);
  regadera.add(pitorro);
  regadera.position.set(0.27, 0.42, 0.08);
  regadera.visible = false;
  yago.add(regadera);

  const paraguas = new Group();
  const varilla = new Mesh(new CylinderGeometry(0.016, 0.016, 0.66, 6), mate(COLOR.metal, 0.4, 0.6));
  varilla.position.y = 0.33;
  paraguas.add(varilla);
  const copa = new Mesh(
    new SphereGeometry(0.44, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    mate(COLOR.camiseta, 0.7),
  );
  copa.position.y = 0.6;
  copa.scale.y = 0.6;
  copa.castShadow = true;
  paraguas.add(copa);
  paraguas.position.set(0.24, 0.42, 0.04);
  paraguas.visible = false;
  yago.add(paraguas);

  const guitarraEnMano = guitarra(COLOR.madera);
  guitarraEnMano.scale.setScalar(0.72);
  guitarraEnMano.position.set(0.02, 0.18, 0.2);
  guitarraEnMano.rotation.set(0.25, 0, -0.5);
  guitarraEnMano.visible = false;
  yago.add(guitarraEnMano);

  /* ─── lluvia ─── */

  const gotas = new Float32Array(CALIBRACION.GOTAS * 6);
  const geoLluvia = new BufferGeometry();
  geoLluvia.setAttribute("position", new BufferAttribute(gotas, 3));
  const lluvia = new LineSegments(
    geoLluvia,
    new LineBasicMaterial({ color: new Color("#9dc4de"), transparent: true, opacity: 0.55 }),
  );
  lluvia.frustumCulled = false;
  lluvia.visible = false;
  scene.add(lluvia);
  for (let i = 0; i < CALIBRACION.GOTAS; i++) {
    const j = i * 6;
    gotas[j] = (Math.random() - 0.5) * 10;
    gotas[j + 1] = Math.random() * 10;
    gotas[j + 2] = (Math.random() - 0.5) * 10;
    gotas[j + 3] = gotas[j]!;
    gotas[j + 4] = gotas[j + 1]! - 0.5;
    gotas[j + 5] = gotas[j + 2]!;
  }

  /* ─── luz ─── */

  const sol = new DirectionalLight(0xfff2e0, 2.3);
  sol.position.set(4, 7, 3);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  sol.shadow.camera.left = -5;
  sol.shadow.camera.right = 5;
  sol.shadow.camera.top = 5;
  sol.shadow.camera.bottom = -5;
  sol.shadow.bias = -0.001;
  scene.add(sol);
  const relleno = new DirectionalLight(0xcfe4ff, 0.85);
  relleno.position.set(-5, 3, -3);
  scene.add(relleno);
  const ambiente = new AmbientLight(0xffffff, 1.05);
  scene.add(ambiente);

  /* ─── estado ─── */

  let giro = 0;
  let balanceoX = 0;
  let balanceoY = 0;
  let punteroX = 0;
  let punteroY = 0;
  let reloj = 0;
  let faena: Faena = "trabajar";
  let viento = 0;

  const rayo = new Raycaster();
  const puntero = new Vector2();

  function medir() {
    const caja = lienzo.getBoundingClientRect();
    if (!caja.width || !caja.height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(caja.width, caja.height, false);
    camera.aspect = caja.width / caja.height;
    const lejos = CALIBRACION.DISTANCIA * Math.max(1, 0.9 / Math.max(camera.aspect, 0.35));
    camera.position.set(lejos * 0.62, lejos * CALIBRACION.ALTURA, lejos * 0.62);
    camera.lookAt(0, -0.25, 0);
    camera.updateProjectionMatrix();
  }

  return {
    medir,

    /** Qué trasto hay bajo el puntero, si hay alguno. */
    trastoEn(x: number, y: number) {
      const caja = lienzo.getBoundingClientRect();
      puntero.x = ((x - caja.left) / caja.width) * 2 - 1;
      puntero.y = -((y - caja.top) / caja.height) * 2 + 1;
      rayo.setFromCamera(puntero, camera);
      const toca = rayo.intersectObjects(pulsables.map((p) => p.raiz), true)[0];
      if (!toca) return null;
      for (let o: Object3D | null = toca.object; o; o = o.parent) {
        const encontrado = pulsables.find((p) => p.raiz === o);
        if (encontrado) return encontrado;
      }
      return null;
    },

    hacer(nueva: Faena) {
      faena = nueva;
      regadera.visible = nueva === "regar";
      paraguas.visible = nueva === "paraguas";
      guitarraEnMano.visible = nueva === "guitarra";
      lluvia.visible = nueva === "paraguas";
      yago.visible = true;
      // dormido se le ve tumbado, así que el cuerpo gira entero
      yago.rotation.z = nueva === "dormir" ? Math.PI / 2 : 0;
    },

    /** De noche se enciende el portátil y baja la luz general. */
    alumbrar(esDeDia: boolean) {
      sol.intensity = esDeDia ? 2.3 : 0.9;
      relleno.intensity = esDeDia ? 0.85 : 0.7;
      ambiente.intensity = esDeDia ? 1.05 : 0.8;
      (brillo.material as MeshStandardMaterial).emissiveIntensity = esDeDia ? 0.35 : 1.4;
    },

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

      const mecida = (viento / 100) * CALIBRACION.MECIDA;
      plantas.forEach((maceta, i) => {
        const mata = maceta.userData["mata"] as Group;
        mata.rotation.z = Math.sin(reloj * 1.6 + i) * mecida;
        mata.rotation.x = Math.cos(reloj * 1.2 + i * 2) * mecida * 0.6;
      });

      // se va andando a su puesto
      const p = PUESTOS[faena];
      yago.position.x += (p.x - yago.position.x) * dt * CALIBRACION.ANDAR;
      yago.position.z += (p.z - yago.position.z) * dt * CALIBRACION.ANDAR;

      const lejos = Math.hypot(p.x - yago.position.x, p.z - yago.position.z);
      const andando = lejos > 0.06;

      if (faena === "dormir") {
        yago.position.y = 0.62;
        yago.rotation.y = 0;
      } else {
        // pasitos mientras se mueve, y un respirar leve al llegar
        yago.position.y = 0.17 + (andando ? Math.abs(Math.sin(reloj * 9)) * 0.03 : 0);
        yago.rotation.y = p.giro;
      }

      // pequeños gestos según lo que esté haciendo
      const gesto = andando ? 0 : 1;
      if (faena === "trabajar") {
        cabeza.position.y = 0.85 + Math.sin(reloj * 7) * 0.006 * gesto;
        brazoIzq.rotation.x = -0.9 * gesto;
        brazoDer.rotation.x = -0.9 * gesto;
      } else if (faena === "piano") {
        brazoIzq.rotation.x = (-1.1 + Math.sin(reloj * 8) * 0.12) * gesto;
        brazoDer.rotation.x = (-1.1 + Math.cos(reloj * 8) * 0.12) * gesto;
      } else if (faena === "guitarra") {
        brazoDer.rotation.x = (-0.6 + Math.sin(reloj * 6) * 0.25) * gesto;
        brazoIzq.rotation.x = -0.8 * gesto;
        yago.position.y += Math.sin(reloj * 3) * 0.008 * gesto;
      } else if (faena === "micro") {
        cabeza.position.y = 0.85 + Math.sin(reloj * 2.4) * 0.012 * gesto;
        brazoIzq.rotation.x = -0.3 * gesto;
        brazoDer.rotation.x = -0.3 * gesto;
      } else if (faena === "regar") {
        regadera.rotation.z = -0.7 * gesto;
        brazoDer.rotation.x = -0.7 * gesto;
        brazoIzq.rotation.x = 0;
      } else {
        cabeza.position.y = 0.85;
        brazoIzq.rotation.x = 0;
        brazoDer.rotation.x = 0;
      }

      if (lluvia.visible) {
        const caida = CALIBRACION.CAIDA * dt;
        for (let i = 0; i < CALIBRACION.GOTAS; i++) {
          const j = i * 6;
          gotas[j + 1] = gotas[j + 1]! - caida;
          gotas[j + 4] = gotas[j + 4]! - caida;
          if (gotas[j + 4]! < -3) {
            gotas[j] = (Math.random() - 0.5) * 10;
            gotas[j + 2] = (Math.random() - 0.5) * 10;
            gotas[j + 1] = 8;
            gotas[j + 3] = gotas[j]!;
            gotas[j + 4] = 7.5;
            gotas[j + 5] = gotas[j + 2]!;
          }
        }
        geoLluvia.attributes["position"]!.needsUpdate = true;
      }

      renderer.render(scene, camera);
    },
  };
}

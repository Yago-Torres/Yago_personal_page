// Un minimundo: un balcón pequeño con una chica y un gato gris.
//
// Ella va cambiando de cosa —fuma, lee, acaricia al gato, se asoma— y el gato
// va a la suya, que a veces coincide y a veces no. No hay currículum aquí ni
// nada que leer: es un sitio al que se llega sabiendo la dirección.

import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const CALIBRACION = {
  // Distancia de la cámara. Subirlo aleja y aplana.
  DISTANCIA: 9.2,
  ALTURA: 0.42,
  // Grados por segundo del giro automático.
  GIRO: 2.6,
  PARALAJE: 5,
  // Segundos que dura cada cosa antes de pasar a la siguiente.
  RATO: 13,
  RATO_GATO: 9,
  // Velocidad a la que se desplazan.
  ANDAR: 2.2,
  // Caladas por minuto, más o menos.
  CALADAS: 7,
};

const COLOR = {
  suelo: "#b9a892",
  baldosa: "#cbbaa4",
  muro: "#a8977f",
  baranda: "#4a4f57",
  pelo: "#1d1a20",
  piel: "#e7b493",
  jersey: "#6b5f8f",
  pantalon: "#2f3a4c",
  zapato: "#26262b",
  gato: "#8f9096",
  gatoOscuro: "#6e6f76",
  hocico: "#e6a6ae",
  planta: "#4f9a52",
  tiesto: "#bf6a44",
  madera: "#96613a",
  libro: "#c2553f",
  taza: "#e8e1d4",
  ovillo: "#d68b5c",
  ascua: "#ff7a3c",
  humo: "#e8e4dc",
  farol: "#ffd9a0",
};

export type Cosa = "fumar" | "leer" | "acariciar" | "asomarse";
export type CosaGato = "dormir" | "estirarse" | "sentarse" | "ovillo";

const SITIOS: Record<Cosa, { x: number; z: number; giro: number }> = {
  fumar: { x: 0.25, z: -1.0, giro: 0.85 },
  leer: { x: -1.05, z: 0.78, giro: 1.1 },
  acariciar: { x: 0.95, z: 0.95, giro: -2.3 },
  asomarse: { x: -1.2, z: -1.15, giro: 0.35 },
};

const SITIOS_GATO: Record<CosaGato, { x: number; z: number; giro: number }> = {
  dormir: { x: 1.25, z: 0.45, giro: 0.4 },
  estirarse: { x: 0.35, z: 1.25, giro: -0.8 },
  sentarse: { x: 1.15, z: 1.15, giro: -2.4 },
  ovillo: { x: -0.85, z: 1.4, giro: 1.6 },
};

const mate = (color: string, rugosidad = 0.75) =>
  new MeshStandardMaterial({ color: new Color(color), roughness: rugosidad, metalness: 0.02 });

export function montarMinimundo(lienzo: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  renderer.setClearAlpha(0);
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, 1, 1, 80);
  const mundo = new Group();
  scene.add(mundo);

  /* ─── el balcón ─── */

  const LADO = 3.8;
  const losa = new Mesh(new RoundedBoxGeometry(LADO, 0.28, LADO, 3, 0.05), mate(COLOR.baldosa, 0.9));
  losa.receiveShadow = true;
  losa.castShadow = true;
  mundo.add(losa);

  const bajo = new Mesh(new RoundedBoxGeometry(LADO * 0.9, 1.5, LADO * 0.9, 3, 0.05), mate(COLOR.suelo, 0.95));
  bajo.position.y = -0.9;
  mundo.add(bajo);

  // muro de la casa, en dos lados
  for (const [x, z, ancho, fondo] of [
    [0, -LADO / 2 + 0.12, LADO, 0.24],
    [-LADO / 2 + 0.12, 0, 0.24, LADO],
  ] as const) {
    const muro = new Mesh(new RoundedBoxGeometry(ancho, 1.5, fondo, 3, 0.04), mate(COLOR.muro, 0.92));
    muro.position.set(x, 0.89, z);
    muro.castShadow = true;
    muro.receiveShadow = true;
    mundo.add(muro);
  }

  // ventana con luz cálida
  const ventana = new Mesh(new RoundedBoxGeometry(0.85, 0.95, 0.06, 2, 0.03), mate(COLOR.farol, 0.4));
  (ventana.material as MeshStandardMaterial).emissive = new Color(COLOR.farol);
  (ventana.material as MeshStandardMaterial).emissiveIntensity = 0.9;
  ventana.position.set(-1.78, 1.0, 0.35);
  ventana.rotation.y = Math.PI / 2;
  mundo.add(ventana);

  const lampara = new PointLight(0xffd9a0, 9, 6, 2);
  lampara.position.set(-1.45, 1.1, 0.35);
  mundo.add(lampara);

  // barandilla en los dos lados abiertos
  for (const [ejeX, signo] of [[true, 1], [false, 1]] as const) {
    const pasamanos = new Mesh(
      new CylinderGeometry(0.035, 0.035, LADO, 10),
      mate(COLOR.baranda, 0.4),
    );
    pasamanos.rotation.z = Math.PI / 2;
    if (!ejeX) pasamanos.rotation.y = Math.PI / 2;
    pasamanos.position.set(
      ejeX ? 0 : (LADO / 2 - 0.1) * signo,
      0.84,
      ejeX ? (LADO / 2 - 0.1) * signo : 0,
    );
    mundo.add(pasamanos);

    for (let i = 0; i < 9; i++) {
      const barrote = new Mesh(new CylinderGeometry(0.022, 0.022, 0.72, 8), mate(COLOR.baranda, 0.4));
      const t = -LADO / 2 + 0.2 + (i * (LADO - 0.4)) / 8;
      barrote.position.set(
        ejeX ? t : (LADO / 2 - 0.1) * signo,
        0.5,
        ejeX ? (LADO / 2 - 0.1) * signo : t,
      );
      mundo.add(barrote);
    }
  }

  /* ─── trastos ─── */

  const taburete = new Group();
  const asiento = new Mesh(new CylinderGeometry(0.26, 0.26, 0.07, 16), mate(COLOR.madera, 0.7));
  asiento.position.y = 0.48;
  asiento.castShadow = true;
  taburete.add(asiento);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pata = new Mesh(new CylinderGeometry(0.025, 0.025, 0.48, 8), mate(COLOR.madera, 0.7));
    pata.position.set(Math.cos(a) * 0.17, 0.24, Math.sin(a) * 0.17);
    taburete.add(pata);
  }
  taburete.position.set(-1.05, 0.14, 0.75);
  mundo.add(taburete);

  const alfombra = new Mesh(new CylinderGeometry(0.62, 0.62, 0.025, 24), mate("#9a7f6b", 0.95));
  alfombra.position.set(1.15, 0.15, 0.7);
  alfombra.receiveShadow = true;
  mundo.add(alfombra);

  const maceta = new Group();
  const tiesto = new Mesh(new CylinderGeometry(0.2, 0.16, 0.3, 16), mate(COLOR.tiesto, 0.88));
  tiesto.position.y = 0.15;
  tiesto.castShadow = true;
  maceta.add(tiesto);
  const mata = new Group();
  for (let h = 0; h < 6; h++) {
    const a = (h / 6) * Math.PI * 2;
    const hoja = new Mesh(new SphereGeometry(0.17, 12, 9), mate(COLOR.planta, 0.8));
    hoja.scale.set(0.38, 0.26, 1.1);
    hoja.position.set(Math.cos(a) * 0.15, 0.1 + (h % 2) * 0.14, Math.sin(a) * 0.15);
    hoja.rotation.y = -a;
    hoja.rotation.x = -0.5;
    hoja.castShadow = true;
    mata.add(hoja);
  }
  mata.position.y = 0.3;
  maceta.add(mata);
  maceta.position.set(1.5, 0.14, -1.35);
  mundo.add(maceta);

  const taza = new Mesh(new CylinderGeometry(0.075, 0.062, 0.1, 14), mate(COLOR.taza, 0.6));
  taza.position.set(-0.72, 0.19, 0.42);
  taza.castShadow = true;
  mundo.add(taza);
  const asa = new Mesh(new TorusGeometry(0.045, 0.012, 8, 14), mate(COLOR.taza, 0.6));
  asa.position.set(-0.64, 0.2, 0.42);
  asa.rotation.y = Math.PI / 2;
  mundo.add(asa);

  const ovillo = new Mesh(new SphereGeometry(0.11, 14, 11), mate(COLOR.ovillo, 0.9));
  ovillo.position.set(-0.85, 0.25, 1.4);
  ovillo.castShadow = true;
  mundo.add(ovillo);

  /* ─── ella ─── */

  const chica = new Group();

  const piernas = new Mesh(new RoundedBoxGeometry(0.22, 0.4, 0.17, 3, 0.05), mate(COLOR.pantalon, 0.85));
  piernas.position.y = 0.2;
  piernas.castShadow = true;
  chica.add(piernas);

  const torso = new Mesh(new RoundedBoxGeometry(0.3, 0.38, 0.2, 3, 0.07), mate(COLOR.jersey, 0.85));
  torso.position.y = 0.58;
  torso.castShadow = true;
  chica.add(torso);

  const brazoIzq = new Mesh(new CylinderGeometry(0.045, 0.04, 0.34, 8), mate(COLOR.jersey, 0.85));
  brazoIzq.position.set(-0.19, 0.58, 0);
  brazoIzq.castShadow = true;
  chica.add(brazoIzq);

  const brazoDer = new Mesh(new CylinderGeometry(0.045, 0.04, 0.34, 8), mate(COLOR.jersey, 0.85));
  brazoDer.position.set(0.19, 0.58, 0);
  brazoDer.castShadow = true;
  chica.add(brazoDer);

  const manoDer = new Mesh(new SphereGeometry(0.048, 10, 8), mate(COLOR.piel, 0.8));
  manoDer.position.set(0.19, 0.4, 0);
  chica.add(manoDer);

  const cabeza = new Mesh(new SphereGeometry(0.145, 20, 16), mate(COLOR.piel, 0.8));
  cabeza.position.y = 0.9;
  cabeza.scale.set(0.93, 1, 0.93);
  cabeza.castShadow = true;
  chica.add(cabeza);

  // melena negra por debajo de la oreja: el rasgo que la define
  const pelo = new Group();
  const casquete = new Mesh(new SphereGeometry(0.158, 18, 14), mate(COLOR.pelo, 0.85));
  casquete.scale.set(1, 0.95, 1);
  pelo.add(casquete);
  const melena = new Mesh(new RoundedBoxGeometry(0.29, 0.34, 0.24, 4, 0.11), mate(COLOR.pelo, 0.85));
  melena.position.set(0, -0.22, -0.03);
  melena.castShadow = true;
  pelo.add(melena);
  for (const lado of [-1, 1] as const) {
    const mechon = new Mesh(new RoundedBoxGeometry(0.08, 0.3, 0.1, 3, 0.04), mate(COLOR.pelo, 0.85));
    mechon.position.set(0.13 * lado, -0.14, 0.05);
    pelo.add(mechon);
  }
  pelo.position.y = 0.935;
  chica.add(pelo);

  // el cigarro, entre los dedos
  const piti = new Group();
  const caña = new Mesh(new CylinderGeometry(0.011, 0.011, 0.13, 8), mate("#f2eee4", 0.8));
  caña.rotation.z = Math.PI / 2;
  piti.add(caña);
  const ascua = new Mesh(new SphereGeometry(0.016, 8, 6), mate(COLOR.ascua, 0.5));
  (ascua.material as MeshStandardMaterial).emissive = new Color(COLOR.ascua);
  (ascua.material as MeshStandardMaterial).emissiveIntensity = 1.6;
  ascua.position.x = 0.07;
  piti.add(ascua);
  piti.position.set(0.22, 0.37, 0.06);
  chica.add(piti);

  // el humo: tres bolitas que suben y se deshacen
  const humo: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const bola = new Mesh(
      new SphereGeometry(0.05, 10, 8),
      new MeshStandardMaterial({
        color: new Color(COLOR.humo),
        roughness: 1,
        transparent: true,
        opacity: 0,
      }),
    );
    bola.userData["fase"] = i / 3;
    chica.add(bola);
    humo.push(bola);
  }

  const libro = new Mesh(new RoundedBoxGeometry(0.24, 0.03, 0.18, 2, 0.01), mate(COLOR.libro, 0.8));
  libro.position.set(0.02, 0.52, 0.19);
  libro.rotation.x = -0.5;
  libro.visible = false;
  chica.add(libro);

  chica.scale.setScalar(1.15);
  mundo.add(chica);

  /* ─── el gato ─── */

  const gato = new Group();

  const cuerpo = new Mesh(new SphereGeometry(0.16, 16, 12), mate(COLOR.gato, 0.9));
  cuerpo.scale.set(1, 0.82, 1.55);
  cuerpo.position.y = 0.15;
  cuerpo.castShadow = true;
  gato.add(cuerpo);

  const cabezaGato = new Mesh(new SphereGeometry(0.105, 16, 12), mate(COLOR.gato, 0.9));
  cabezaGato.position.set(0, 0.24, 0.2);
  cabezaGato.castShadow = true;
  gato.add(cabezaGato);

  for (const lado of [-1, 1] as const) {
    const oreja = new Mesh(new CylinderGeometry(0.001, 0.045, 0.08, 4), mate(COLOR.gatoOscuro, 0.9));
    oreja.position.set(0.055 * lado, 0.32, 0.19);
    oreja.rotation.x = 0.15;
    gato.add(oreja);
  }

  const hocico = new Mesh(new SphereGeometry(0.018, 8, 6), mate(COLOR.hocico, 0.7));
  hocico.position.set(0, 0.22, 0.3);
  gato.add(hocico);

  const cola = new Mesh(new CylinderGeometry(0.018, 0.028, 0.34, 8), mate(COLOR.gatoOscuro, 0.9));
  cola.position.set(0, 0.22, -0.24);
  cola.rotation.x = 0.9;
  gato.add(cola);

  for (const [px, pz] of [[-0.08, 0.12], [0.08, 0.12], [-0.08, -0.1], [0.08, -0.1]] as const) {
    const pata = new Mesh(new CylinderGeometry(0.028, 0.028, 0.14, 8), mate(COLOR.gato, 0.9));
    pata.position.set(px, 0.07, pz);
    gato.add(pata);
  }

  gato.scale.setScalar(1.1);
  mundo.add(gato);

  /* ─── luz ─── */

  const luna = new DirectionalLight(0xbfd4ff, 1.15);
  luna.position.set(3, 6, 2);
  luna.castShadow = true;
  luna.shadow.mapSize.set(1024, 1024);
  luna.shadow.camera.left = -4;
  luna.shadow.camera.right = 4;
  luna.shadow.camera.top = 4;
  luna.shadow.camera.bottom = -4;
  luna.shadow.bias = -0.001;
  scene.add(luna);
  scene.add(new DirectionalLight(0xffd9a0, 0.45).translateX(-4));
  scene.add(new AmbientLight(0xffffff, 0.75));

  /* ─── estado ─── */

  let giro = 0;
  let balanceoX = 0;
  let balanceoY = 0;
  let punteroX = 0;
  let punteroY = 0;
  let reloj = 0;

  const COSAS: Cosa[] = ["fumar", "asomarse", "leer", "acariciar"];
  const COSAS_GATO: CosaGato[] = ["dormir", "sentarse", "estirarse", "ovillo"];
  let cosa: Cosa = "fumar";
  let cosaGato: CosaGato = "dormir";
  let desde = 0;
  let desdeGato = 0;
  let iCosa = 0;
  let iGato = 0;

  function medir() {
    const caja = lienzo.getBoundingClientRect();
    if (!caja.width || !caja.height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(caja.width, caja.height, false);
    camera.aspect = caja.width / caja.height;
    const lejos = CALIBRACION.DISTANCIA * Math.max(1, 0.9 / Math.max(camera.aspect, 0.35));
    camera.position.set(lejos * 0.62, lejos * CALIBRACION.ALTURA, lejos * 0.62);
    camera.lookAt(0, 0.12, 0);
    camera.updateProjectionMatrix();
  }

  return {
    medir,
    apuntar(x: number, y: number) {
      punteroX = x;
      punteroY = y;
    },
    /** Qué está haciendo ella ahora mismo, para contarlo debajo. */
    quePasa: () => cosa,

    cuadro(dt: number, quieto: boolean) {
      reloj += dt;

      if (!quieto) giro += ((CALIBRACION.GIRO * Math.PI) / 180) * dt;
      const rad = (CALIBRACION.PARALAJE * Math.PI) / 180;
      balanceoY += (punteroX * rad - balanceoY) * 0.05;
      balanceoX += (punteroY * rad * 0.5 - balanceoX) * 0.05;
      mundo.rotation.y = giro + balanceoY;
      mundo.rotation.x = balanceoX;

      // ella cambia de cosa cada rato
      if (reloj - desde > CALIBRACION.RATO) {
        desde = reloj;
        iCosa = (iCosa + 1) % COSAS.length;
        cosa = COSAS[iCosa]!;
      }
      // el gato va a la suya, con su propio ritmo
      if (reloj - desdeGato > CALIBRACION.RATO_GATO) {
        desdeGato = reloj;
        iGato = (iGato + 1) % COSAS_GATO.length;
        cosaGato = COSAS_GATO[iGato]!;
      }

      const sitio = SITIOS[cosa];
      chica.position.x += (sitio.x - chica.position.x) * dt * CALIBRACION.ANDAR;
      chica.position.z += (sitio.z - chica.position.z) * dt * CALIBRACION.ANDAR;
      const andando = Math.hypot(sitio.x - chica.position.x, sitio.z - chica.position.z) > 0.06;
      chica.position.y = 0.14 + (andando ? Math.abs(Math.sin(reloj * 8)) * 0.025 : 0);
      chica.rotation.y = sitio.giro;

      const parada = andando ? 0 : 1;
      piti.visible = cosa === "fumar";
      libro.visible = cosa === "leer" && !andando;

      if (cosa === "fumar") {
        // la calada: sube la mano, y el ascua se aviva
        const ciclo = (reloj * CALIBRACION.CALADAS) / 60;
        const calada = Math.max(0, Math.sin(ciclo * Math.PI * 2));
        brazoDer.rotation.x = -1.5 * calada * parada;
        manoDer.position.y = 0.4 + 0.3 * calada * parada;
        piti.position.y = 0.37 + 0.3 * calada * parada;
        piti.position.z = 0.06 + 0.06 * calada * parada;
        (ascua.material as MeshStandardMaterial).emissiveIntensity = 1.2 + calada * 2.2;

        for (const bola of humo) {
          const fase = ((reloj * 0.35 + (bola.userData["fase"] as number)) % 1);
          bola.position.set(0.22, 0.45 + fase * 0.7, 0.06 + fase * 0.12);
          bola.scale.setScalar(0.6 + fase * 1.9);
          (bola.material as MeshStandardMaterial).opacity = (1 - fase) * 0.3 * parada;
          bola.visible = true;
        }
      } else {
        brazoDer.rotation.x = 0;
        manoDer.position.y = 0.4;
        for (const bola of humo) bola.visible = false;
      }

      if (cosa === "leer") {
        cabeza.rotation.x = 0.35 * parada;
        brazoIzq.rotation.x = -1.2 * parada;
        brazoDer.rotation.x = -1.2 * parada;
      } else if (cosa === "acariciar") {
        brazoDer.rotation.x = (-1.1 + Math.sin(reloj * 3) * 0.18) * parada;
        cabeza.rotation.x = 0.3 * parada;
      } else if (cosa === "asomarse") {
        cabeza.rotation.x = -0.12 * parada;
        brazoIzq.rotation.x = -0.5 * parada;
      } else {
        cabeza.rotation.x = 0;
        brazoIzq.rotation.x = 0;
      }

      // el gato: si ella le acaricia, se acerca; si no, a lo suyo
      const destinoGato =
        cosa === "acariciar"
          ? { x: SITIOS.acariciar.x - 0.35, z: SITIOS.acariciar.z + 0.3, giro: 1.2 }
          : SITIOS_GATO[cosaGato];
      gato.position.x += (destinoGato.x - gato.position.x) * dt * CALIBRACION.ANDAR * 0.9;
      gato.position.z += (destinoGato.z - gato.position.z) * dt * CALIBRACION.ANDAR * 0.9;
      const gateando = Math.hypot(destinoGato.x - gato.position.x, destinoGato.z - gato.position.z) > 0.06;
      gato.rotation.y = destinoGato.giro;

      const quietoGato = gateando ? 0 : 1;
      if (cosaGato === "dormir" && !gateando && cosa !== "acariciar") {
        // hecho un ovillo, respirando
        gato.position.y = 0.09;
        cuerpo.scale.set(1.15, 0.72, 1.15 + Math.sin(reloj * 1.6) * 0.03);
        cabezaGato.position.set(0, 0.16, 0.12);
        cola.rotation.x = 1.9;
      } else {
        gato.position.y = 0.14 + (gateando ? Math.abs(Math.sin(reloj * 11)) * 0.02 : 0);
        cuerpo.scale.set(1, 0.82, 1.55);
        cabezaGato.position.set(0, 0.24 + (cosaGato === "sentarse" ? 0.08 : 0) * quietoGato, 0.2);
        // la cola siempre en marcha, que para eso es un gato
        cola.rotation.x = 0.9 + Math.sin(reloj * 2.2) * 0.3;
        cola.rotation.z = Math.sin(reloj * 1.7) * 0.25;
      }

      if (cosaGato === "ovillo" && !gateando) {
        ovillo.position.y = 0.25 + Math.abs(Math.sin(reloj * 4)) * 0.06;
        ovillo.rotation.z += dt * 3;
      }

      renderer.render(scene, camera);
    },
  };
}

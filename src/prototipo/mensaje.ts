// El mensaje que deja quien pasa por aquí, escrito en grande sobre la isla.
//
// Se dibuja en un lienzo a alta resolución y se pega en un plano que mira
// siempre a cámara: así el texto se lee nítido desde cualquier ángulo, sin
// cargar tipografías ni geometría de letras.

import {
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Camera,
} from "three";

export const CALIBRACION = {
  // Caracteres que caben. Más allá no se lee y deja de ser un titular.
  LARGO_MAX: 48,
  // Altura a la que flota el cartel sobre la isla.
  ALTURA: 3.3,
  // Anchura del cartel en el mundo. El alto sale de la proporción del lienzo.
  ANCHO: 8,
  // Amplitud y ritmo del cabeceo.
  VAIVEN: 0.22,
  RITMO: 0.55,
  // Resolución del lienzo. Subirlo afina el texto y gasta más memoria.
  LIENZO_ANCHO: 1536,
  LIENZO_ALTO: 384,
};

export const COLORES: { nombre: string; alto: string; bajo: string; flor: string }[] = [
  { nombre: "cromo", alto: "#ffffff", bajo: "#7f9fc0", flor: "#dfe9f5" },
  { nombre: "chicle", alto: "#ffd7ec", bajo: "#ff3f8e", flor: "#ff6fae" },
  { nombre: "lima", alto: "#eaffc0", bajo: "#6fc21a", flor: "#a8e84a" },
  { nombre: "mandarina", alto: "#ffe6bd", bajo: "#ff7a18", flor: "#ffa347" },
  { nombre: "uva", alto: "#ecd9ff", bajo: "#7b3fd4", flor: "#a875ea" },
  { nombre: "piscina", alto: "#d6f7ff", bajo: "#12a3d6", flor: "#4cc8ec" },
];

function pintar(lienzo: HTMLCanvasElement, texto: string, alto: string, bajo: string) {
  const ctx = lienzo.getContext("2d")!;
  const { width: w, height: h } = lienzo;
  ctx.clearRect(0, 0, w, h);

  // el tamaño se ajusta para que quepa siempre, sin partir la frase
  let cuerpo = 190;
  ctx.font = `900 ${cuerpo}px ui-sans-serif, system-ui, "Segoe UI", Helvetica, sans-serif`;
  while (ctx.measureText(texto).width > w * 0.9 && cuerpo > 40) {
    cuerpo -= 6;
    ctx.font = `900 ${cuerpo}px ui-sans-serif, system-ui, "Segoe UI", Helvetica, sans-serif`;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const x = w / 2;
  const y = h / 2;

  // sombra proyectada
  ctx.save();
  ctx.fillStyle = "#0b1a2a55";
  ctx.fillText(texto, x + cuerpo * 0.05, y + cuerpo * 0.06);
  ctx.restore();

  // relleno cromado: degradado vertical con corte duro en el medio, que es
  // lo que hace que parezca metal y no un degradado cualquiera
  const metal = ctx.createLinearGradient(0, y - cuerpo * 0.6, 0, y + cuerpo * 0.6);
  metal.addColorStop(0, alto);
  metal.addColorStop(0.46, bajo);
  metal.addColorStop(0.5, "#ffffff");
  metal.addColorStop(0.54, bajo);
  metal.addColorStop(1, alto);
  ctx.fillStyle = metal;
  ctx.fillText(texto, x, y);

  // contorno oscuro para que despegue del cielo
  ctx.lineWidth = Math.max(cuerpo * 0.045, 3);
  ctx.strokeStyle = "#12233a";
  ctx.strokeText(texto, x, y);

  // brillo superior
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const luz = ctx.createLinearGradient(0, y - cuerpo * 0.62, 0, y);
  luz.addColorStop(0, "#ffffffcc");
  luz.addColorStop(1, "#ffffff00");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function montarMensaje(padre: Group) {
  const lienzo = document.createElement("canvas");
  lienzo.width = CALIBRACION.LIENZO_ANCHO;
  lienzo.height = CALIBRACION.LIENZO_ALTO;

  const textura = new CanvasTexture(lienzo);
  textura.colorSpace = SRGBColorSpace;
  textura.minFilter = LinearFilter;
  textura.magFilter = LinearFilter;

  const alto = (CALIBRACION.ANCHO * CALIBRACION.LIENZO_ALTO) / CALIBRACION.LIENZO_ANCHO;
  const cartel = new Mesh(
    new PlaneGeometry(CALIBRACION.ANCHO, alto),
    new MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false }),
  );
  cartel.position.y = CALIBRACION.ALTURA;
  cartel.visible = false;
  cartel.renderOrder = 2;
  padre.add(cartel);

  let base = CALIBRACION.ALTURA;

  return {
    /** Escribe el mensaje. Vacío lo borra del cielo. */
    poner(texto: string, color: (typeof COLORES)[number]) {
      const limpio = texto.trim().slice(0, CALIBRACION.LARGO_MAX);
      cartel.visible = limpio.length > 0;
      if (!limpio) return;
      pintar(lienzo, limpio, color.alto, color.bajo);
      textura.needsUpdate = true;
    },

    /** Cabeceo suave y siempre de cara a la cámara. */
    animar(t: number, camara: Camera) {
      if (!cartel.visible) return;
      cartel.position.y = base + Math.sin(t * CALIBRACION.RITMO) * CALIBRACION.VAIVEN;
      // mira a cámara pero sin volcarse: solo gira sobre su eje vertical
      const p = camara.position;
      cartel.rotation.y = Math.atan2(p.x - cartel.position.x, p.z - cartel.position.z);
    },

    ocultar() {
      cartel.visible = false;
    },

    subir(alturaNueva: number) {
      base = alturaNueva;
    },

    /** Encoge el cartel en pantallas estrechas para que no se salga. */
    escalar(f: number) {
      cartel.scale.setScalar(f);
    },
  };
}

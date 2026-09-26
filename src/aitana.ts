// La página escondida: monta el minimundo y va contando qué pasa.

import { montarMinimundo, type Cosa } from "./minimundo.ts";

const QUE_HACE: Record<Cosa, string> = {
  fumar: "Fumándose un piti",
  leer: "Leyendo en el taburete",
  acariciar: "Acariciando al gato",
  asomarse: "Asomada a la barandilla",
};

const lienzo = document.getElementById("lienzo") as HTMLCanvasElement | null;
const pie = document.getElementById("pie-mundo");

if (lienzo) {
  const mundo = montarMinimundo(lienzo);
  mundo.medir();
  addEventListener("resize", mundo.medir);

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    mundo.apuntar(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
  });

  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ultima: Cosa | null = null;
  let anterior = performance.now();

  const cuadro = (t: number) => {
    const dt = Math.min((t - anterior) / 1000, 0.1);
    anterior = t;
    mundo.cuadro(dt, quieto);

    const ahora = mundo.quePasa();
    if (pie && ahora !== ultima) {
      ultima = ahora;
      pie.textContent = QUE_HACE[ahora];
    }
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
}

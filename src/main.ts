// Fase 1: el chasis. Solo lo que hace que el aparato parezca encendido y sólido.
// ponytail: motor botánico, CLI y estado compartido llegan en las fases 2, 4 y 6.

import { ahora } from "./tiempo";

const $ = (id: string) => document.getElementById(id);

const pon = (id: string, texto: string) => {
  const el = $(id);
  if (el) el.textContent = texto;
};

/* ─── reloj de Zaragoza ─────────────────────────────────────── */

const tic = () => {
  const t = ahora();
  pon("reloj", t.hora);
  pon("fecha", t.fecha);
  pon("estacion", t.estacion);
};

tic();
setInterval(tic, 20_000);

/* ─── el aparato es un objeto: se inclina hacia el puntero ──── */

// Calibración del volumen. Subir INCLINACION exagera el efecto 3D.
const INCLINACION = 3.5; // grados de giro máximo en cada eje

const aparato = $("aparato");
const finoYQuieto = matchMedia("(prefers-reduced-motion: reduce)");
const conPuntero = matchMedia("(hover: hover) and (pointer: fine)");

if (aparato && conPuntero.matches && !finoYQuieto.matches) {
  addEventListener("pointermove", (e) => {
    const x = e.clientX / innerWidth - 0.5;
    const y = e.clientY / innerHeight - 0.5;
    aparato.style.setProperty("--ry", `${x * INCLINACION * 2}deg`);
    aparato.style.setProperty("--rx", `${-y * INCLINACION}deg`);
  });
  addEventListener("pointerleave", () => {
    aparato.style.removeProperty("--rx");
    aparato.style.removeProperty("--ry");
  });
}

/* ─── ponytail: selector de color para decidir el chasis. Se borra al elegir. */

const CHASIS = ["amarillo", "verde", "gris"] as const;
$("muestra")?.addEventListener("click", () => {
  const actual = document.documentElement.dataset["chasis"] ?? "amarillo";
  const siguiente = CHASIS[(CHASIS.indexOf(actual as never) + 1) % CHASIS.length]!;
  document.documentElement.dataset["chasis"] = siguiente;
});

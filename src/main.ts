// La página: el parte del tiempo de la ciudad elegida, y la azotea que lo
// obedece. Todo el contenido vive en el HTML; aquí solo se le da vida.

import { montarEscena, type Faena } from "./escena.ts";
import { CIUDADES, consultarMeteo, NOMBRES, RESERVA, rosa, type Ciudad, type Meteo } from "./meteo.ts";
import { ahora } from "./tiempo.ts";

export const CALIBRACION = {
  // Cada cuánto se vuelve a consultar el tiempo, en minutos.
  REFRESCO: 10,
  // Caracteres del mensaje. Más allá deja de ser un titular.
  LARGO_MARCA: 42,
  // Segundos que Yago se queda haciendo la faena que se señala en el pronóstico.
  OJEADA: 2.6,
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
const pon = (sel: string, texto: string) => {
  const el = $(sel);
  if (el) el.textContent = texto;
};

/* ─── la azotea ─────────────────────────────────────────────── */

const lienzo = $<HTMLCanvasElement>("#lienzo");
const escena = lienzo ? montarEscena(lienzo) : null;

if (escena && lienzo) {
  escena.medir();
  addEventListener("resize", escena.medir);

  let aLaVista = true;
  new IntersectionObserver(([e]) => (aLaVista = e!.isIntersecting), { threshold: 0.05 })
    .observe(lienzo);

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    escena.apuntar(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
  });

  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let anterior = performance.now();
  const cuadro = (t: number) => {
    const dt = Math.min((t - anterior) / 1000, 0.1);
    anterior = t;
    if (aLaVista) escena.cuadro(dt, quieto);
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
}

/* ─── qué hace Yago ─────────────────────────────────────────── */

const FAENAS: Record<Faena, string> = {
  regar: "Yago riega las macetas",
  trabajar: "Yago se ha puesto a trabajar",
  paraguas: "Yago ha sacado el paraguas",
};

let faenaReal: Faena = "regar";
let ojeada: ReturnType<typeof setTimeout> | undefined;

function ponerFaena(f: Faena) {
  escena?.hacer(f);
  pon("#escena-pie", FAENAS[f]);
}

/** El pronóstico deja asomarse: al señalar una etapa, Yago la representa. */
for (const fila of document.querySelectorAll<HTMLElement>(".dia[data-faena]")) {
  const f = fila.dataset["faena"] as Faena;
  const asomar = () => {
    clearTimeout(ojeada);
    ponerFaena(f);
    ojeada = setTimeout(() => ponerFaena(faenaReal), CALIBRACION.OJEADA * 1000);
  };
  fila.addEventListener("pointerenter", asomar);
  fila.addEventListener("focusin", asomar);
}

/* ─── el viento: las barras del stack ───────────────────────── */

// se llenan al entrar en pantalla, para que se vea el gesto
const rachas = [...document.querySelectorAll<HTMLElement>(".racha")];
const llenar = (el: HTMLElement) => {
  const barra = el.querySelector<HTMLElement>(".racha__barra i");
  if (barra) barra.style.width = `${el.dataset["fuerza"] ?? 0}%`;
};
if (rachas.length) {
  const ojo = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        llenar(e.target as HTMLElement);
        ojo.unobserve(e.target);
      }
    },
    { threshold: 0.3 },
  );
  for (const r of rachas) ojo.observe(r);
}

/* ─── ciudad y parte del tiempo ─────────────────────────────── */

const LLAVE_CIUDAD = "ytg01.ciudad";

function ciudadGuardada(): Ciudad {
  try {
    const c = localStorage.getItem(LLAVE_CIUDAD);
    if (c && c in CIUDADES) return c as Ciudad;
  } catch {
    // almacenamiento bloqueado: se empieza por Zaragoza y ya está
  }
  return "zaragoza";
}

let ciudad: Ciudad = ciudadGuardada();
let meteo: Meteo = RESERVA;

function pintar() {
  const t = ahora();
  const noche = !meteo.esDeDia;

  document.documentElement.dataset["turno"] = noche ? "noche" : "dia";
  const tema = $<HTMLMetaElement>('meta[name="theme-color"]');
  if (tema) tema.content = noche ? "#14130f" : "#ece9e2";

  pon("#ciudad-nombre", CIUDADES[ciudad].nombre);
  pon("#ahora-temp", `${Math.round(meteo.temperatura)}°`);
  pon("#ahora-cielo", NOMBRES[meteo.cielo]);
  pon("#ahora-sensacion", `${Math.round(meteo.sensacion)}°`);
  pon("#ahora-hora", t.hora);
  pon("#dato-viento", `${Math.round(meteo.viento)} km/h ${rosa(meteo.rumbo)}`);
  pon("#dato-humedad", `${Math.round(meteo.humedad)}%`);
  pon("#dato-lluvia", `${meteo.precipitacion.toFixed(1)} mm`);
  pon("#dato-estacion", t.estacion);

  // el amanecer y el atardecer de verdad, junto a los de la carrera
  const arco = document.querySelectorAll<HTMLElement>(".arco__hito .rotulillo");
  if (arco.length === 2 && meteo.real) {
    arco[0]!.textContent = `Amanece ${meteo.amanecer} · 2022`;
    arco[1]!.textContent = `Se pone ${meteo.atardecer} · 2026`;
  }

  const llueve = meteo.precipitacion > 0 || meteo.cielo === "lluvia" || meteo.cielo === "tormenta";
  faenaReal = llueve ? "paraguas" : noche ? "trabajar" : "regar";
  clearTimeout(ojeada);
  ponerFaena(faenaReal);

  escena?.pintar(noche ? "noche" : "dia");
  escena?.soplar(meteo.viento);
}

async function traerMeteo() {
  meteo = await consultarMeteo(ciudad);
  pintar();
}

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-ciudad]")) {
  b.addEventListener("click", () => {
    ciudad = b.dataset["ciudad"] as Ciudad;
    for (const otro of document.querySelectorAll<HTMLButtonElement>("[data-ciudad]")) {
      otro.setAttribute("aria-pressed", String(otro === b));
    }
    try {
      localStorage.setItem(LLAVE_CIUDAD, ciudad);
    } catch {
      // si no se puede recordar, tampoco pasa nada
    }
    void traerMeteo();
  });
  b.setAttribute("aria-pressed", String(b.dataset["ciudad"] === ciudad));
}

pintar();
void traerMeteo();
setInterval(() => void traerMeteo(), CALIBRACION.REFRESCO * 60_000);
setInterval(pintar, 60_000);

const anio = $("#anio");
if (anio) anio.textContent = String(new Date().getFullYear());

/* ─── deja tu marca ─────────────────────────────────────────── */

// Mientras no exista el Worker esto vive en el navegador de cada visitante.
// Al pasar a estado compartido, el mensaje necesita moderación antes de salir.
const LLAVE_MARCA = "ytg01.marca";

const campo = $<HTMLInputElement>("#campo-marca");
const cuenta = $("#cuenta-marca");
const eco = $("#marca-eco");

function pintarMarca(texto: string) {
  const limpio = texto.slice(0, CALIBRACION.LARGO_MARCA);
  if (cuenta) cuenta.textContent = `${limpio.length}/${CALIBRACION.LARGO_MARCA}`;
  if (eco) {
    eco.textContent = limpio;
    eco.hidden = limpio.trim().length === 0;
  }
}

if (campo) {
  try {
    campo.value = localStorage.getItem(LLAVE_MARCA) ?? "";
  } catch {
    // almacenamiento bloqueado: se empieza en blanco
  }
  pintarMarca(campo.value);

  campo.addEventListener("input", () => {
    pintarMarca(campo.value);
    try {
      localStorage.setItem(LLAVE_MARCA, campo.value);
    } catch {
      // igual que arriba
    }
  });

  $("#borrar-marca")?.addEventListener("click", () => {
    campo.value = "";
    pintarMarca("");
    try {
      localStorage.removeItem(LLAVE_MARCA);
    } catch {
      // nada que hacer
    }
    campo.focus();
  });
}

$("#forma-marca")?.addEventListener("submit", (e) => e.preventDefault());

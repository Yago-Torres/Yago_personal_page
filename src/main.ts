// La página: enchufa el objeto 3D, el tiempo real de Zaragoza y la marca del
// visitante. Todo el contenido vive en el HTML; aquí solo se le da vida.

import { montarEscena, leerPlantasDelDocumento } from "./escena.ts";
import { consultarMeteo, NOMBRES, RESERVA, type Meteo } from "./meteo.ts";
import { ahora } from "./tiempo.ts";

export const CALIBRACION = {
  // Franja nocturna en Zaragoza: fuera de ella la página se da la vuelta.
  AMANECE: 7,
  ANOCHECE: 21,
  // Cada cuánto se vuelve a consultar el tiempo, en minutos.
  REFRESCO_METEO: 10,
  // Caracteres del mensaje. Más allá deja de ser un titular.
  LARGO_MARCA: 42,
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);

/* ─── el objeto ─────────────────────────────────────────────── */

const lienzo = $<HTMLCanvasElement>("#lienzo");
const escena = lienzo ? montarEscena(lienzo, leerPlantasDelDocumento()) : null;

if (escena) {
  escena.medir();
  addEventListener("resize", escena.medir);

  // el objeto solo gira mientras se ve: si está fuera de pantalla, se para
  let aLaVista = true;
  if (lienzo) {
    new IntersectionObserver(([e]) => (aLaVista = e!.isIntersecting), { threshold: 0.05 })
      .observe(lienzo);
  }

  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    escena.apuntar(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5);
  });

  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let anterior = performance.now();

  const cuadro = (t: number) => {
    const dt = Math.min((t - anterior) / 1000, 0.1);
    anterior = t;
    if (aLaVista) {
      escena.cuadro(dt, quieto);
      escena.animarPalmadas(dt);
    }
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);

  // señalar una etapa o un proyecto hace que su planta dé un respingo
  for (const el of document.querySelectorAll<HTMLElement>("[data-planta]")) {
    const slug = el.dataset["planta"]!;
    el.addEventListener("pointerenter", () => escena.palmear(slug));
    el.addEventListener("focusin", () => escena.palmear(slug));
  }
}

/* ─── barras del stack ──────────────────────────────────────── */

for (const el of document.querySelectorAll<HTMLElement>(".estrato")) {
  const peso = Number(el.dataset["peso"] ?? 1);
  const barra = el.querySelector<HTMLElement>(".barra-nivel i");
  if (barra) barra.style.width = `${(peso / 3) * 100}%`;
}

/* ─── hora, tiempo y turno ──────────────────────────────────── */

let meteo: Meteo = RESERVA;

function pintarLecturas() {
  const t = ahora();
  const noche = t.hora24 < CALIBRACION.AMANECE || t.hora24 >= CALIBRACION.ANOCHECE;

  document.documentElement.dataset["turno"] = noche ? "noche" : "dia";
  const tema = $<HTMLMetaElement>('meta[name="theme-color"]');
  if (tema) tema.content = noche ? "#14130f" : "#ece9e2";

  const pon = (sel: string, texto: string) => {
    const el = $(sel);
    if (el) el.textContent = texto;
  };
  pon("#lectura-hora", t.hora);
  pon("#lectura-temperatura", `${Math.round(meteo.temperatura)}°`);
  pon("#lectura-meteo", NOMBRES[meteo.cielo]);
  pon("#lectura-estacion", t.estacion);

  escena?.pintar(noche ? "noche" : "dia");
  escena?.llover(meteo.precipitacion > 0 || meteo.cielo === "lluvia" || meteo.cielo === "tormenta");
}

pintarLecturas();
void consultarMeteo().then((m) => {
  meteo = m;
  pintarLecturas();
});
setInterval(() => void consultarMeteo().then((m) => { meteo = m; pintarLecturas(); }),
  CALIBRACION.REFRESCO_METEO * 60_000);
setInterval(pintarLecturas, 60_000);

const anio = $("#anio");
if (anio) anio.textContent = String(new Date().getFullYear());

/* ─── deja tu marca ─────────────────────────────────────────── */

// Mientras no exista el Worker esto vive en el navegador de cada visitante.
// Al pasar a estado compartido, el mensaje necesita moderación antes de salir.
const LLAVE = "ytg01.marca";

const campo = $<HTMLInputElement>("#campo-marca");
const cuenta = $("#cuenta-marca");
const borrar = $("#borrar-marca");
const eco = $("#marca-eco");

function pintarMarca(texto: string) {
  const limpio = texto.slice(0, CALIBRACION.LARGO_MARCA);
  if (cuenta) cuenta.textContent = `${limpio.length}/${CALIBRACION.LARGO_MARCA}`;
  if (eco) {
    eco.textContent = limpio;
    eco.hidden = limpio.trim().length === 0;
  }
  escena?.florecer(limpio.trim().length > 0);
}

if (campo) {
  try {
    campo.value = localStorage.getItem(LLAVE) ?? "";
  } catch {
    // almacenamiento bloqueado: se empieza en blanco y ya está
  }
  pintarMarca(campo.value);

  campo.addEventListener("input", () => {
    pintarMarca(campo.value);
    try {
      localStorage.setItem(LLAVE, campo.value);
    } catch {
      // igual que arriba: no pasa nada, solo no se recuerda
    }
  });

  borrar?.addEventListener("click", () => {
    campo.value = "";
    pintarMarca("");
    try {
      localStorage.removeItem(LLAVE);
    } catch {
      // nada que hacer
    }
    campo.focus();
  });
}

$("#forma-marca")?.addEventListener("submit", (e) => e.preventDefault());

// La página: el parte del tiempo de la ciudad elegida, y la azotea que lo
// obedece. Todo el contenido vive en el HTML; aquí solo se le da vida.

import { montarEscena, type Faena } from "./escena.ts";
import { CIUDADES, consultarMeteo, NOMBRES, RESERVA, rosa, type Ciudad, type Meteo } from "./meteo.ts";
import { ahora } from "./tiempo.ts";

export const CALIBRACION = {
  // Jornada laboral: de lunes a viernes, a estas horas, Yago está trabajando.
  ENTRA: 8,
  SALE: 17,
  // Fuera de la jornada, a partir de esta hora se va a la cama.
  ACUESTA: 23,
  LEVANTA: 8,
  // Segundos que dura cada rato de ocio antes de cambiar de trasto.
  RATO: 24,
  // Segundos que se queda haciendo lo que le pides al pulsar o al señalar.
  CAPRICHO: 14,
  // Cada cuánto se vuelve a consultar el tiempo, en minutos.
  REFRESCO: 10,
  LARGO_MARCA: 42,
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
const pon = (sel: string, texto: string) => {
  const el = $(sel);
  if (el) el.textContent = texto;
};

/* ─── la azotea ─────────────────────────────────────────────── */

const lienzo = $<HTMLCanvasElement>("#lienzo");
const escena = lienzo ? montarEscena(lienzo) : null;

/* ─── qué hace Yago ─────────────────────────────────────────── */

const FAENAS: Record<Faena, string> = {
  trabajar: "Yago está trabajando",
  piano: "Yago está al piano",
  guitarra: "Yago está con la guitarra",
  micro: "Yago está grabando",
  regar: "Yago riega las macetas",
  dormir: "Yago está durmiendo",
  paraguas: "Yago ha sacado el paraguas",
};

const OCIO: Faena[] = ["piano", "guitarra", "micro", "regar"];

let meteo: Meteo = RESERVA;
let faenaFijada: Faena | null = null;
let soltar: ReturnType<typeof setTimeout> | undefined;
let ratoDesde = Date.now();
let ocioActual = 0;

/** Lo que tocaría hacer ahora mismo, sin contar caprichos. */
function faenaDeAgenda(): Faena {
  const t = ahora();
  const llueve = meteo.precipitacion > 0 || meteo.cielo === "lluvia" || meteo.cielo === "tormenta";
  if (llueve) return "paraguas";
  if (t.hora24 >= CALIBRACION.ACUESTA || t.hora24 < CALIBRACION.LEVANTA) return "dormir";
  if (t.laborable && t.hora24 >= CALIBRACION.ENTRA && t.hora24 < CALIBRACION.SALE) return "trabajar";

  // rato libre: va cambiando de trasto
  if (Date.now() - ratoDesde > CALIBRACION.RATO * 1000) {
    ratoDesde = Date.now();
    ocioActual = (ocioActual + 1) % OCIO.length;
  }
  return OCIO[ocioActual]!;
}

function ponerFaena(f: Faena) {
  escena?.hacer(f);
  pon("#escena-pie", FAENAS[f]);
}

function repasarFaena() {
  ponerFaena(faenaFijada ?? faenaDeAgenda());
}

/** Un capricho: lo que le pides dura un rato y luego vuelve a su agenda. */
function pedir(f: Faena) {
  faenaFijada = f;
  ponerFaena(f);
  clearTimeout(soltar);
  soltar = setTimeout(() => {
    faenaFijada = null;
    repasarFaena();
  }, CALIBRACION.CAPRICHO * 1000);
}

/* ─── el bucle y los trastos ────────────────────────────────── */

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

  // pulsar un trasto manda a Yago a usarlo
  lienzo.addEventListener("pointerup", (e) => {
    const trasto = escena.trastoEn(e.clientX, e.clientY);
    if (trasto) pedir(trasto.faena);
  });

  lienzo.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    lienzo.style.cursor = escena.trastoEn(e.clientX, e.clientY) ? "pointer" : "grab";
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

/** El pronóstico deja asomarse: al señalar una etapa, Yago la representa. */
for (const fila of document.querySelectorAll<HTMLElement>(".dia[data-faena]")) {
  const f = fila.dataset["faena"] as Faena;
  fila.addEventListener("pointerenter", () => pedir(f));
  fila.addEventListener("focusin", () => pedir(f));
}

/* ─── el viento: las barras del stack ───────────────────────── */

const rachas = [...document.querySelectorAll<HTMLElement>(".racha")];
if (rachas.length) {
  const ojo = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        const barra = el.querySelector<HTMLElement>(".racha__barra i");
        if (barra) barra.style.width = `${el.dataset["fuerza"] ?? 0}%`;
        ojo.unobserve(el);
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
    // almacenamiento bloqueado: se empieza por Zaragoza
  }
  return "zaragoza";
}

let ciudad: Ciudad = ciudadGuardada();

/** El símbolo que se enseña arriba, según la condición y si es de día. */
const SIMBOLO: Record<string, string> = {
  despejado: "#w-sol",
  nubes: "#w-sol-nube",
  niebla: "#w-niebla",
  lluvia: "#w-lluvia",
  tormenta: "#w-tormenta",
  nieve: "#w-nieve",
};

const CIELO_TEMA: Record<string, string> = {
  despejado: "#2f7cc9",
  nubes: "#5c7d97",
  niebla: "#7c858c",
  lluvia: "#35505f",
  tormenta: "#262f3d",
  nieve: "#6d879c",
};

function pintar() {
  const t = ahora();
  const noche = !meteo.esDeDia;
  const raiz = document.documentElement;

  raiz.dataset["turno"] = noche ? "noche" : "dia";
  raiz.dataset["cielo"] = meteo.cielo;
  const tema = $<HTMLMetaElement>('meta[name="theme-color"]');
  if (tema) tema.content = noche ? "#0a1120" : (CIELO_TEMA[meteo.cielo] ?? "#2f7cc9");

  pon("#ciudad-nombre", CIUDADES[ciudad].nombre);
  pon("#ahora-temp", `${Math.round(meteo.temperatura)}°`);
  pon("#ahora-cielo", NOMBRES[meteo.cielo]);
  pon("#ahora-sensacion", `${Math.round(meteo.sensacion)}°`);
  pon("#ahora-hora", t.hora);
  pon("#ahora-estacion", t.estacion);
  pon("#dato-viento", `${Math.round(meteo.viento)} ${rosa(meteo.rumbo)}`);
  pon("#dato-humedad", `${Math.round(meteo.humedad)}%`);
  pon("#dato-lluvia", `${meteo.precipitacion.toFixed(1)} mm`);
  pon("#dato-sensacion", `${Math.round(meteo.sensacion)}°`);

  if (meteo.real) {
    pon("#hora-amanecer", `Sale a las ${meteo.amanecer}`);
    pon("#hora-atardecer", `Se pone a las ${meteo.atardecer}`);
  }

  const icono = document.getElementById("icono-cielo");
  if (icono) {
    // de noche y despejado manda la luna; con nubes, el símbolo de siempre
    const cual = !meteo.esDeDia && meteo.cielo === "despejado"
      ? "#w-luna"
      : (SIMBOLO[meteo.cielo] ?? "#w-sol");
    icono.setAttribute("href", cual);
  }

  escena?.alumbrar(meteo.esDeDia);
  escena?.soplar(meteo.viento);
  repasarFaena();
}

async function traerMeteo() {
  meteo = await consultarMeteo(ciudad);
  pintar();
}

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-ciudad]")) {
  b.setAttribute("aria-pressed", String(b.dataset["ciudad"] === ciudad));
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
}

pintar();
void traerMeteo();
setInterval(() => void traerMeteo(), CALIBRACION.REFRESCO * 60_000);
// el reloj y la agenda se repasan a menudo: Yago cambia de faena solo
setInterval(() => {
  pon("#ahora-hora", ahora().hora);
  repasarFaena();
}, 5_000);

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

/* ─── escríbeme ─────────────────────────────────────────────── */

// El endpoint solo envía si el dominio está dado de alta en Email Sending.
// Si no lo está, responde 503 y aquí se abre el cliente de correo del
// visitante con el mensaje ya escrito: el formulario sirve igual.
const CORREO = "torresgarciayago@gmail.com";

const forma = $<HTMLFormElement>("#forma-contacto");
const estado = $("#estado-contacto");
const enviar = $<HTMLButtonElement>("#enviar-contacto");

function decir(texto: string, como: "bien" | "mal" | "" = "") {
  if (!estado) return;
  estado.textContent = texto;
  if (como) estado.dataset["estado"] = como;
  else delete estado.dataset["estado"];
}

function porCliente(nombre: string, correo: string, mensaje: string) {
  const asunto = encodeURIComponent(`Hola Yago — ${nombre}`);
  const cuerpo = encodeURIComponent(`${mensaje}

—
${nombre}
${correo}`);
  location.href = `mailto:${CORREO}?subject=${asunto}&body=${cuerpo}`;
  decir("Te he abierto tu correo con el mensaje escrito. Solo queda darle a enviar.");
}

forma?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(forma)) as Record<string, string>;
  const nombre = (datos["nombre"] ?? "").trim();
  const correo = (datos["correo"] ?? "").trim();
  const mensaje = (datos["mensaje"] ?? "").trim();
  if (!nombre || !correo || !mensaje) return;

  if (enviar) enviar.disabled = true;
  decir("Enviando…");

  try {
    const r = await fetch("/api/contacto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nombre, correo, mensaje, web: datos["web"] ?? "" }),
      signal: AbortSignal.timeout(10000),
    });

    if (r.ok) {
      forma.reset();
      decir("Recibido. Te contesto en cuanto pueda.", "bien");
    } else {
      // 400 es culpa del formulario; cualquier otra cosa (404 sin desplegar,
      // 503 sin envío montado, 5xx) significa que aquí no se puede enviar
      const cuerpo = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.status === 400 && cuerpo.error) decir(cuerpo.error, "mal");
      else porCliente(nombre, correo, mensaje);
    }
  } catch {
    porCliente(nombre, correo, mensaje);
  } finally {
    if (enviar) enviar.disabled = false;
  }
});

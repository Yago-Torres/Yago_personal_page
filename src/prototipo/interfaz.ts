// Lo que se ve dentro de la pantalla del aparato.
//
// Se navega pulsando. No hay comandos, no hay terminal: índice, ficha y el
// apartado para dejar tu marca en la isla.

import { ARBOLES, ARBUSTOS, ESTRATOS, ETIQUETAS, FRUTOS, SEMILLAS } from "../jardin-datos.ts";
import { COLORES, CALIBRACION as MSG } from "./mensaje.ts";

export type Riego = { ok: boolean; riegos: number; restantes: number; aviso: string };

export type Acciones = {
  /** la planta da un respingo para reconocerla al volver */
  senalar(slug: string): void;
  regar(slug: string): Riego;
  dejarMarca(texto: string, color: number): void;
  marca(): { texto: string; color: number };
  riegosDe(slug: string): number;
  riegosRestantes(): number;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const fecha = (aaaamm?: string) => {
  if (!aaaamm) return "hoy";
  const [a, m] = aaaamm.split("-");
  return m ? `${MESES[Number(m) - 1]} ${a}` : a!;
};

function crear<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  clase?: string,
  texto?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;
  return el;
}

export function montarInterfaz(raiz: HTMLElement, acciones: Acciones) {
  raiz.innerHTML = "";

  const cabecera = crear("header", "pz-cabecera");
  const titulo = crear("span", "pz-titulo", "el jardín");
  const reloj = crear("span", "pz-reloj", "--:--");
  cabecera.append(titulo, reloj);

  const cuerpo = crear("div", "pz-cuerpo");

  const pie = crear("footer", "pz-pie");
  const atras = crear("button", "pz-atras", "volver");
  atras.type = "button";
  pie.append(atras);

  raiz.append(cabecera, cuerpo, pie);

  /* ─── piezas ──────────────────────────────────────────────── */

  function fila(nombre: string, apunte: string, alPulsar?: () => void) {
    const b = crear("button", "pz-fila");
    b.type = "button";
    b.append(crear("span", "pz-fila-nombre", nombre), crear("span", "pz-fila-apunte", apunte));
    if (alPulsar) b.addEventListener("click", alPulsar);
    else b.disabled = true;
    return b;
  }

  const grupo = (texto: string) => crear("div", "pz-grupo", texto);

  function encabezar(nombre: string, apunte: string, conVuelta = true) {
    titulo.textContent = nombre;
    atras.hidden = !conVuelta;
    cuerpo.innerHTML = "";
    cuerpo.scrollTop = 0;
    if (apunte) cuerpo.append(crear("p", "pz-apunte", apunte));
  }

  /* ─── índice ──────────────────────────────────────────────── */

  function abrirIndice() {
    encabezar("el jardín", "", false);

    const marca = crear("button", "pz-destacado");
    marca.type = "button";
    marca.append(
      crear("span", "pz-destacado-titulo", "deja tu marca"),
      crear("span", "pz-destacado-apunte", "una flor y un mensaje sobre la isla"),
    );
    marca.addEventListener("click", abrirMarca);
    cuerpo.append(marca);

    cuerpo.append(grupo("dónde he trabajado"));
    for (const a of ARBOLES) {
      cuerpo.append(fila(a.nombre, `${fecha(a.desde)} — ${fecha(a.hasta)}`, () => abrirFicha(a.slug)));
    }

    cuerpo.append(grupo("lo que he hecho por mi cuenta"));
    for (const a of ARBUSTOS) {
      cuerpo.append(fila(a.nombre, a.repo ? "repo" : "", () => abrirFicha(a.slug)));
    }

    cuerpo.append(grupo("y además"));
    cuerpo.append(
      fila("certificaciones", String(ETIQUETAS.length), abrirCertificaciones),
      fila("bajo tierra", "el stack", abrirSubsuelo),
      fila("historia", "premios y estudios", abrirHistoria),
    );
  }

  /* ─── ficha de una especie ────────────────────────────────── */

  function botonRegar(slug: string) {
    const caja = crear("div", "pz-riego");
    const b = crear("button", "pz-regar");
    b.type = "button";
    const nota = crear("p", "pz-aviso");

    const pintar = () => {
      const riegos = acciones.riegosDe(slug);
      const quedan = acciones.riegosRestantes();
      b.textContent = quedan > 0 ? "regar" : "sin agua hoy";
      b.disabled = quedan <= 0;
      nota.textContent = riegos === 0 ? "nadie la ha regado todavía" : `${riegos} riegos`;
    };
    pintar();

    b.addEventListener("click", () => {
      const r = acciones.regar(slug);
      pintar();
      nota.textContent = r.aviso;
    });

    caja.append(b, nota);
    return caja;
  }

  function abrirFicha(slug: string) {
    acciones.senalar(slug);

    const arbol = ARBOLES.find((a) => a.slug === slug);
    if (arbol) {
      encabezar(arbol.nombre, `${arbol.rol} · ${fecha(arbol.desde)} — ${fecha(arbol.hasta)}`);
      cuerpo.append(crear("p", "pz-resumen", arbol.resumen));
      const lista = crear("ul", "pz-notas");
      for (const n of arbol.notas) lista.append(crear("li", undefined, n.texto));
      cuerpo.append(lista, botonRegar(slug));
      return;
    }

    const arbusto = ARBUSTOS.find((a) => a.slug === slug);
    if (arbusto) {
      encabezar(arbusto.nombre, "proyecto propio");
      cuerpo.append(crear("p", "pz-resumen", arbusto.resumen));
      if (arbusto.repo) {
        const enlace = crear("a", "pz-enlace", `github.com/${arbusto.repo}`);
        enlace.href = `https://github.com/${arbusto.repo}`;
        enlace.target = "_blank";
        enlace.rel = "noopener noreferrer";
        cuerpo.append(enlace);
      }
      cuerpo.append(botonRegar(slug));
      return;
    }

    if (ETIQUETAS.some((c) => c.codigo === slug)) abrirCertificaciones();
  }

  /* ─── deja tu marca ───────────────────────────────────────── */

  function abrirMarca() {
    const actual = acciones.marca();
    encabezar("tu marca", "se queda flotando sobre la isla");

    const campo = crear("input", "pz-campo");
    campo.type = "text";
    campo.maxLength = MSG.LARGO_MAX;
    campo.placeholder = "escribe algo";
    campo.value = actual.texto;
    campo.setAttribute("aria-label", "tu mensaje");

    const cuenta = crear("span", "pz-cuenta");
    const paleta = crear("div", "pz-paleta");
    let elegido = actual.color;

    const aplicar = () => {
      cuenta.textContent = `${campo.value.length}/${MSG.LARGO_MAX}`;
      acciones.dejarMarca(campo.value, elegido);
    };

    COLORES.forEach((c, i) => {
      const b = crear("button", "pz-color");
      b.type = "button";
      b.title = c.nombre;
      b.setAttribute("aria-label", c.nombre);
      b.style.background = `linear-gradient(160deg, ${c.alto}, ${c.bajo})`;
      b.classList.toggle("elegido", i === elegido);
      b.addEventListener("click", () => {
        elegido = i;
        for (const otro of paleta.children) otro.classList.remove("elegido");
        b.classList.add("elegido");
        aplicar();
      });
      paleta.append(b);
    });

    campo.addEventListener("input", aplicar);

    const borrar = crear("button", "pz-borrar", "quitarla");
    borrar.type = "button";
    borrar.addEventListener("click", () => {
      campo.value = "";
      aplicar();
    });

    cuenta.textContent = `${campo.value.length}/${MSG.LARGO_MAX}`;
    cuerpo.append(campo, cuenta, crear("div", "pz-grupo", "color"), paleta, borrar);
    campo.focus();
  }

  /* ─── otras vistas ────────────────────────────────────────── */

  function abrirCertificaciones() {
    encabezar("certificaciones", "las pendientes van en blanco, sin clavar");
    for (const c of ETIQUETAS) {
      const f = crear("div", `pz-cert${c.estado === "pendiente" ? " pz-cert--pendiente" : ""}`);
      f.append(crear("span", "pz-fila-nombre", c.codigo), crear("span", "pz-fila-apunte", c.nombre));
      cuerpo.append(f);
    }
  }

  function abrirSubsuelo() {
    encabezar("bajo tierra", "cada estrato es una capa del stack");
    for (const e of ESTRATOS) {
      const f = crear("div", "pz-estrato");
      f.append(crear("span", "pz-fila-nombre", e.nombre));
      const barra = crear("span", "pz-barra");
      const relleno = crear("i");
      relleno.style.width = `${(e.peso / 3) * 100}%`;
      barra.append(relleno);
      f.append(barra);
      cuerpo.append(f);
    }
  }

  function abrirHistoria() {
    encabezar("historia", "lo que el jardín ya ha dado");
    cuerpo.append(grupo("frutos"));
    for (const f of FRUTOS) cuerpo.append(fila(f.nombre, fecha(f.fecha)));
    cuerpo.append(grupo("semillas"));
    for (const s of SEMILLAS) cuerpo.append(fila(s.nombre, s.lugar));
  }

  atras.addEventListener("click", abrirIndice);
  abrirIndice();

  return {
    abrirIndice,
    abrirFicha,
    abrirMarca,
    reloj: (texto: string) => (reloj.textContent = texto),
  };
}

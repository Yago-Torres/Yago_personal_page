// Lo que se ve DENTRO de la pantalla del aparato.
//
// Se navega pulsando, no escribiendo: índice, ficha y subsuelo. La consola de
// texto existe, pero está guardada detrás de un botón, porque escribir órdenes
// es un extra para quien le apetezca, no el único camino.

import { ARBOLES, ARBUSTOS, ESTRATOS, ETIQUETAS, FRUTOS, SEMILLAS } from "../jardin-datos.ts";
import type { Respuesta } from "../consola.ts";

export type Acciones = {
  /** acerca la cámara a una especie */
  enfocar(slug: string): void;
  /** baja al subsuelo */
  excavar(): void;
  /** vuelve a la vista general y cierra la pantalla */
  salir(): void;
  regar(slug: string): Respuesta;
  plantar(): Respuesta;
  ejecutarTexto(orden: string): Respuesta;
  /** riegos acumulados de una especie */
  riegosDe(slug: string): number;
  riegosRestantes(): number;
  haPlantado(): boolean;
};

const fecha = (aaaamm?: string) => {
  if (!aaaamm) return "hoy";
  const [a, m] = aaaamm.split("-");
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
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
  const abrirConsola = crear("button", "pz-consola-abrir", ">_");
  abrirConsola.type = "button";
  abrirConsola.title = "consola de texto";
  pie.append(atras, abrirConsola);

  // la consola de texto, plegada
  const consola = crear("div", "pz-consola");
  const registro = crear("div", "pz-registro");
  const linea = crear("div", "pz-linea");
  const signo = crear("span", "pz-signo", ">");
  const entrada = crear("input", "pz-entrada");
  entrada.type = "text";
  entrada.autocomplete = "off";
  entrada.spellcheck = false;
  entrada.placeholder = "ayuda";
  entrada.setAttribute("aria-label", "consola de riego");
  linea.append(signo, entrada);
  consola.append(registro, linea);

  raiz.append(cabecera, cuerpo, consola, pie);

  /* ─── índice ──────────────────────────────────────────────── */

  function fila(etiqueta: string, apunte: string, alPulsar: () => void) {
    const b = crear("button", "pz-fila");
    b.type = "button";
    b.append(crear("span", "pz-fila-nombre", etiqueta), crear("span", "pz-fila-apunte", apunte));
    b.addEventListener("click", alPulsar);
    return b;
  }

  function grupo(texto: string) {
    return crear("div", "pz-grupo", texto);
  }

  function abrirIndice() {
    titulo.textContent = "el jardín";
    atras.hidden = true;
    cuerpo.innerHTML = "";

    cuerpo.append(grupo("dónde he trabajado"));
    for (const a of ARBOLES) {
      cuerpo.append(
        fila(a.nombre, `${fecha(a.desde)} — ${fecha(a.hasta)}`, () => abrirFicha(a.slug)),
      );
    }

    cuerpo.append(grupo("lo que he hecho por mi cuenta"));
    for (const a of ARBUSTOS) {
      cuerpo.append(fila(a.nombre, a.repo ? "repo" : "", () => abrirFicha(a.slug)));
    }

    cuerpo.append(grupo("y además"));
    cuerpo.append(
      fila("certificaciones", `${ETIQUETAS.length}`, abrirCertificaciones),
      fila("bajo tierra", "el stack", abrirSubsuelo),
      fila("historia", "premios y estudios", abrirHistoria),
    );
  }

  /* ─── ficha de una especie ────────────────────────────────── */

  function cabeceraFicha(nombre: string, apunte: string) {
    titulo.textContent = nombre;
    atras.hidden = false;
    cuerpo.innerHTML = "";
    if (apunte) cuerpo.append(crear("p", "pz-apunte", apunte));
  }

  function botonRegar(slug: string) {
    const b = crear("button", "pz-regar");
    b.type = "button";

    const pintar = () => {
      const riegos = acciones.riegosDe(slug);
      const quedan = acciones.riegosRestantes();
      b.textContent = quedan > 0 ? `regar · ${riegos}` : `sin agua hoy · ${riegos}`;
      b.disabled = quedan <= 0;
    };
    pintar();

    b.addEventListener("click", () => {
      const r = acciones.regar(slug);
      pintar();
      const aviso = crear("p", "pz-aviso", r.lineas.join(" "));
      b.after(aviso);
      setTimeout(() => aviso.remove(), 3200);
    });
    return b;
  }

  function abrirFicha(slug: string) {
    acciones.enfocar(slug);

    const arbol = ARBOLES.find((a) => a.slug === slug);
    if (arbol) {
      cabeceraFicha(arbol.nombre, `${arbol.rol} · ${fecha(arbol.desde)} — ${fecha(arbol.hasta)}`);
      cuerpo.append(crear("p", "pz-resumen", arbol.resumen));
      const lista = crear("ul", "pz-notas");
      for (const n of arbol.notas) lista.append(crear("li", undefined, n.texto));
      cuerpo.append(lista, botonRegar(slug));
      return;
    }

    const arbusto = ARBUSTOS.find((a) => a.slug === slug);
    if (arbusto) {
      cabeceraFicha(arbusto.nombre, "proyecto propio");
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

    const cert = ETIQUETAS.find((c) => c.codigo === slug);
    if (cert) abrirCertificaciones();
  }

  /* ─── otras vistas ────────────────────────────────────────── */

  function abrirCertificaciones() {
    cabeceraFicha("certificaciones", "las pendientes van en blanco, sin clavar");
    for (const c of ETIQUETAS) {
      const f = crear("div", `pz-cert ${c.estado === "pendiente" ? "pz-cert--pendiente" : ""}`);
      f.append(
        crear("span", "pz-fila-nombre", c.codigo),
        crear("span", "pz-fila-apunte", c.nombre),
      );
      cuerpo.append(f);
    }
  }

  function abrirSubsuelo() {
    acciones.excavar();
    cabeceraFicha("bajo tierra", "cada estrato es una capa del stack");
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
    cabeceraFicha("historia", "lo que el jardín ya ha dado");
    cuerpo.append(grupo("frutos"));
    for (const f of FRUTOS) cuerpo.append(fila(f.nombre, fecha(f.fecha), () => {}));
    cuerpo.append(grupo("semillas"));
    for (const s of SEMILLAS) cuerpo.append(fila(s.nombre, s.lugar, () => {}));
  }

  /* ─── consola de texto, para quien quiera ─────────────────── */

  let consolaAbierta = false;
  consola.hidden = true;

  function escribir(lineas: string[], eco?: string) {
    if (eco) registro.append(crear("p", "pz-eco", `> ${eco}`));
    for (const l of lineas) registro.append(crear("p", undefined, l));
    registro.scrollTop = registro.scrollHeight;
  }

  abrirConsola.addEventListener("click", () => {
    consolaAbierta = !consolaAbierta;
    consola.hidden = !consolaAbierta;
    abrirConsola.classList.toggle("activo", consolaAbierta);
    if (consolaAbierta) {
      if (!registro.childElementCount) {
        escribir(["también puedes escribir. prueba <b>ayuda</b>."]);
      }
      entrada.focus();
    }
  });

  entrada.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key !== "Enter") return;
    const orden = entrada.value.trim();
    if (!orden) return;
    entrada.value = "";
    escribir(acciones.ejecutarTexto(orden).lineas, orden);
  });

  atras.addEventListener("click", abrirIndice);

  abrirIndice();

  return {
    abrirIndice,
    abrirFicha,
    abrirSubsuelo,
    /** el reloj de la cabecera de la pantalla */
    reloj: (texto: string) => (reloj.textContent = texto),
  };
}

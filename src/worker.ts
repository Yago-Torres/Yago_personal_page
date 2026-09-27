// El Worker: solo existe para recoger el formulario de contacto.
//
// Todo lo demás lo sirven los ficheros estáticos, que se resuelven antes de
// llegar aquí. Si el envío de correo no está configurado devuelve 503 y la
// página lo sabe: abre el cliente de correo del visitante con el texto puesto.

// Tipos mínimos del binding, para no arrastrar @cloudflare/workers-types
// entero solo por esto. Si algún día hace falta más, se genera con `wrangler types`.
type Direccion = string | { email: string; name?: string };

interface EnvioCorreo {
  send(mensaje: {
    from: Direccion;
    to: Direccion;
    subject: string;
    text?: string;
    html?: string;
    replyTo?: Direccion;
  }): Promise<{ messageId: string }>;
}

type Env = {
  /** Se activa dando de alta el dominio en Email Sending. Sin él, 503. */
  EMAIL?: EnvioCorreo;
  /** A dónde llega el formulario. */
  DESTINO?: string;
  /** Desde qué dirección sale. Tiene que ser del dominio dado de alta. */
  REMITE?: string;
};

const LIMITES = { nombre: 80, correo: 120, mensaje: 2000 };

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/** Validación en el servidor: lo del navegador no cuenta, se salta trivialmente. */
function revisar(datos: Record<string, unknown>) {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nombre = texto(datos["nombre"]);
  const correo = texto(datos["correo"]);
  const mensaje = texto(datos["mensaje"]);

  if (!nombre || nombre.length > LIMITES.nombre) return { error: "Falta tu nombre." };
  if (!correo || correo.length > LIMITES.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    return { error: "Ese correo no parece válido." };
  }
  if (!mensaje || mensaje.length > LIMITES.mensaje) return { error: "Falta el mensaje." };

  return { nombre, correo, mensaje };
}

export default {
  async fetch(peticion: Request, env: Env): Promise<Response> {
    const url = new URL(peticion.url);
    if (url.pathname !== "/api/contacto") return new Response("No encontrado", { status: 404 });
    if (peticion.method !== "POST") return json({ error: "Solo POST" }, 405);

    let datos: Record<string, unknown>;
    try {
      datos = (await peticion.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Envío mal formado." }, 400);
    }

    // trampa para robots: si viene rellena, hacemos como que sí y no enviamos
    if (typeof datos["web"] === "string" && datos["web"].trim() !== "") return json({ ok: true });

    const revisado = revisar(datos);
    if ("error" in revisado) return json({ error: revisado.error }, 400);

    if (!env.EMAIL || !env.DESTINO || !env.REMITE) {
      // no está configurado el envío: que la página tire del cliente de correo
      return json({ error: "sin-envio" }, 503);
    }

    const cuerpo =
      `De: ${revisado.nombre} <${revisado.correo}>\n\n` +
      `${revisado.mensaje}\n\n` +
      `— enviado desde el formulario de yagotg.dev`;

    try {
      await env.EMAIL.send({
        from: { email: env.REMITE, name: "yagotg.dev" },
        to: env.DESTINO,
        replyTo: { email: revisado.correo, name: revisado.nombre },
        subject: `yagotg.dev · mensaje de ${revisado.nombre}`,
        text: cuerpo,
      });
      return json({ ok: true });
    } catch (e) {
      console.error("no se pudo enviar", e);
      return json({ error: "sin-envio" }, 503);
    }
  },
};

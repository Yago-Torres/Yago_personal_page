// El tiempo real de Zaragoza, de Open-Meteo. Sin API key y sin servidor.
//
// Si la petición falla el jardín no se queda en blanco: se cae a un día
// tranquilo. Un aparato que se queda colgado porque no hay red es un aparato
// roto, y esto tiene que aguantar sin internet.

import { ZARAGOZA } from "../tiempo";

export type Cielo = "despejado" | "nubes" | "niebla" | "lluvia" | "nieve" | "tormenta";

export type Meteo = {
  cielo: Cielo;
  /** 0..1 */
  nubosidad: number;
  /** mm en la última hora */
  precipitacion: number;
  temperatura: number;
  esDeDia: boolean;
  /** false si no se pudo consultar y estamos con el valor de reserva */
  real: boolean;
};

export const RESERVA: Meteo = {
  cielo: "despejado",
  nubosidad: 0.25,
  precipitacion: 0,
  temperatura: 18,
  esDeDia: true,
  real: false,
};

// Códigos WMO: https://open-meteo.com/en/docs
function traducir(codigo: number): Cielo {
  if (codigo >= 95) return "tormenta";
  if (codigo >= 71 && codigo <= 77) return "nieve";
  if (codigo >= 85) return "nieve";
  if (codigo >= 51) return "lluvia";
  if (codigo === 45 || codigo === 48) return "niebla";
  if (codigo >= 1) return "nubes";
  return "despejado";
}

export const NOMBRES: Record<Cielo, string> = {
  despejado: "despejado",
  nubes: "nublado",
  niebla: "niebla",
  lluvia: "lluvia",
  nieve: "nieve",
  tormenta: "tormenta",
};

type RespuestaApi = {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    cloud_cover?: number;
    is_day?: number;
    weather_code?: number;
  };
};

export async function consultarMeteo(): Promise<Meteo> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${ZARAGOZA.lat}&longitude=${ZARAGOZA.lon}` +
    "&current=temperature_2m,precipitation,cloud_cover,is_day,weather_code" +
    `&timezone=${encodeURIComponent(ZARAGOZA.zona)}`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return RESERVA;

    const datos = (await r.json()) as RespuestaApi;
    const a = datos.current;
    if (!a) return RESERVA;

    return {
      cielo: traducir(a.weather_code ?? 0),
      nubosidad: Math.min(Math.max((a.cloud_cover ?? 25) / 100, 0), 1),
      precipitacion: a.precipitation ?? 0,
      temperatura: a.temperature_2m ?? RESERVA.temperatura,
      esDeDia: (a.is_day ?? 1) === 1,
      real: true,
    };
  } catch {
    return RESERVA;
  }
}

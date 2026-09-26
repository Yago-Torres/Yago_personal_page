// El tiempo real de las tres ciudades, de Open-Meteo. Sin clave y sin servidor.
//
// Si la petición falla la página no se queda en blanco: se cae a un día
// tranquilo. Una web que se rompe porque no hay red es una web rota.

export const CIUDADES = {
  tudela: { nombre: "Tudela", lat: 42.0649, lon: -1.6069 },
  zaragoza: { nombre: "Zaragoza", lat: 41.6488, lon: -0.8891 },
  madrid: { nombre: "Madrid", lat: 40.4168, lon: -3.7038 },
} as const;

export type Ciudad = keyof typeof CIUDADES;

export type Cielo = "despejado" | "nubes" | "niebla" | "lluvia" | "nieve" | "tormenta";

export type Meteo = {
  cielo: Cielo;
  temperatura: number;
  sensacion: number;
  humedad: number;
  precipitacion: number;
  /** km/h */
  viento: number;
  /** grados, de donde sopla */
  rumbo: number;
  esDeDia: boolean;
  amanecer: string;
  atardecer: string;
  /** false si no se pudo consultar y estamos con el valor de reserva */
  real: boolean;
};

export const RESERVA: Meteo = {
  cielo: "despejado",
  temperatura: 18,
  sensacion: 18,
  humedad: 45,
  precipitacion: 0,
  viento: 9,
  rumbo: 315,
  esDeDia: true,
  amanecer: "—",
  atardecer: "—",
  real: false,
};

// Códigos WMO: https://open-meteo.com/en/docs
function traducir(codigo: number): Cielo {
  if (codigo >= 95) return "tormenta";
  if (codigo >= 85) return "nieve";
  if (codigo >= 71 && codigo <= 77) return "nieve";
  if (codigo >= 51) return "lluvia";
  if (codigo === 45 || codigo === 48) return "niebla";
  if (codigo >= 1) return "nubes";
  return "despejado";
}

export const NOMBRES: Record<Cielo, string> = {
  despejado: "Despejado",
  nubes: "Nublado",
  niebla: "Niebla",
  lluvia: "Lluvia",
  nieve: "Nieve",
  tormenta: "Tormenta",
};

/** Rosa de los vientos, para no enseñar grados a pelo. */
export function rosa(grados: number) {
  const puntos = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return puntos[Math.round(grados / 45) % 8]!;
}

const hhmm = (iso?: string) => (iso ? iso.slice(11, 16) : "—");

type Respuesta = {
  current?: Record<string, number | undefined>;
  daily?: { sunrise?: string[]; sunset?: string[] };
};

export async function consultarMeteo(ciudad: Ciudad): Promise<Meteo> {
  const c = CIUDADES[ciudad];
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${c.lat}&longitude=${c.lon}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation," +
    "weather_code,wind_speed_10m,wind_direction_10m,is_day" +
    "&daily=sunrise,sunset&forecast_days=1" +
    "&timezone=Europe%2FMadrid";

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return RESERVA;
    const datos = (await r.json()) as Respuesta;
    const a = datos.current;
    if (!a) return RESERVA;

    return {
      cielo: traducir(Number(a["weather_code"] ?? 0)),
      temperatura: Number(a["temperature_2m"] ?? RESERVA.temperatura),
      sensacion: Number(a["apparent_temperature"] ?? a["temperature_2m"] ?? RESERVA.sensacion),
      humedad: Number(a["relative_humidity_2m"] ?? RESERVA.humedad),
      precipitacion: Number(a["precipitation"] ?? 0),
      viento: Number(a["wind_speed_10m"] ?? RESERVA.viento),
      rumbo: Number(a["wind_direction_10m"] ?? RESERVA.rumbo),
      esDeDia: Number(a["is_day"] ?? 1) === 1,
      amanecer: hhmm(datos.daily?.sunrise?.[0]),
      atardecer: hhmm(datos.daily?.sunset?.[0]),
      real: true,
    };
  } catch {
    return RESERVA;
  }
}

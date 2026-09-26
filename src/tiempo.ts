// El jardín vive en Zaragoza: la hora, el día y la estación son los de allí,
// no los del visitante. Alguien que entre desde Tokio ve el jardín de noche.

export const ZARAGOZA = {
  zona: "Europe/Madrid",
  lat: 41.6488,
  lon: -0.8891,
} as const;

export type Estacion = "invierno" | "primavera" | "verano" | "otoño";

// Estaciones meteorológicas (no astronómicas): bloques limpios de tres meses.
const POR_MES: readonly Estacion[] = [
  "invierno", "invierno", "primavera", "primavera", "primavera", "verano",
  "verano", "verano", "otoño", "otoño", "otoño", "invierno",
];

/** Partes del instante actual en Zaragoza, sea cual sea la zona del visitante. */
export function ahora(d = new Date()) {
  const partes = new Intl.DateTimeFormat("es-ES", {
    timeZone: ZARAGOZA.zona,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    hour12: false,
  }).formatToParts(d);

  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";

  // el mes numérico lo sacamos aparte: formatToParts con month:"short" da el nombre
  const mes = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: ZARAGOZA.zona, month: "numeric" }).format(d),
  );

  // día de la semana allí: 1 lunes ... 7 domingo
  const DIAS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const corto = new Intl.DateTimeFormat("en-US", { timeZone: ZARAGOZA.zona, weekday: "short" })
    .format(d)
    .toLowerCase();
  const diaSemana = DIAS.indexOf(corto);

  return {
    hora: `${parte("hour")}:${parte("minute")}`,
    /** 0 domingo, 1 lunes … 6 sábado */
    diaSemana,
    laborable: diaSemana >= 1 && diaSemana <= 5,
    fecha: `${parte("day")} ${parte("month").replace(".", "")}`,
    hora24: Number(parte("hour")),
    estacion: POR_MES[mes - 1] as Estacion,
  };
}

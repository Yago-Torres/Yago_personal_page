// Fase 1: el chasis. Solo lo que hace que el aparato parezca encendido.
// ponytail: el motor botánico, la CLI y el estado compartido llegan en fases 2, 4 y 6.

const ESTACIONES = [
  "invierno", "invierno", "primavera", "primavera", "primavera", "verano",
  "verano", "verano", "otoño", "otoño", "otoño", "invierno",
] as const;

const pon = (id: string, texto: string) => {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
};

const tic = () => {
  const ahora = new Date();
  pon("reloj", ahora.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
  pon("estacion", ESTACIONES[ahora.getMonth()] ?? "");
};

tic();
setInterval(tic, 30_000);

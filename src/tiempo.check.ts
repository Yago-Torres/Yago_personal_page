// Comprobación mínima: el jardín debe leer la hora de Zaragoza, no la del visitante.
// Ejecutar con:  npm run check
import assert from "node:assert/strict";
import { ahora } from "./tiempo.ts";

// 15:30 UTC del 1 de julio = 17:30 en Zaragoza (verano, UTC+2)
const verano = ahora(new Date("2026-07-01T15:30:00Z"));
assert.equal(verano.hora, "17:30");
assert.equal(verano.hora24, 17);
assert.equal(verano.estacion, "verano");

// 23:30 UTC del 31 de diciembre ya es 1 de enero en Zaragoza (invierno, UTC+1)
const nochevieja = ahora(new Date("2026-12-31T23:30:00Z"));
assert.equal(nochevieja.hora, "00:30");
assert.equal(nochevieja.estacion, "invierno");
assert.match(nochevieja.fecha, /^01 ene$/);

// el cambio de estación cae en el límite de mes
assert.equal(ahora(new Date("2026-02-28T12:00:00Z")).estacion, "invierno");
assert.equal(ahora(new Date("2026-03-01T12:00:00Z")).estacion, "primavera");

console.log("tiempo: ok");

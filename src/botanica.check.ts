// Comprobación mínima del motor botánico: determinismo del genoma, que slugs
// distintos den plantas distintas, y que un vigor mínimo nunca borre la planta.
// Ejecutar con: npm run check
import assert from "node:assert/strict";
import { genoma, expandir, tortuga } from "./botanica.ts";

// mismo slug -> mismo genoma, siempre
const a1 = genoma("helecho-de-produccion");
const a2 = genoma("helecho-de-produccion");
assert.deepEqual(a1, a2);

// slugs distintos -> genes distintos (plantas visiblemente distintas)
const b = genoma("cactus-de-pruebas");
assert.notEqual(a1.angulo, b.angulo);
assert.notEqual(a1.semilla, b.semilla);

// la expansión es puramente determinista
const g = genoma("planta-sin-riego");
assert.equal(expandir(g, 3), expandir(genoma("planta-sin-riego"), 3));

// vigor 0 (planta mínima): iteraciones mínimas y longitud reducida, pero real
const cadenaMinima = expandir(g, 2); // 2 = ITERACIONES_MIN en jardin.ts
const segmentosMinimos = tortuga(cadenaMinima, g, { longitud: 0.15, grosor: 0.02 });
assert.ok(segmentosMinimos.length > 0, "una planta con vigor 0 no debe quedarse sin segmentos");
const tieneLongitudReal = segmentosMinimos.some((s) => s.x1 !== s.x2 || s.y1 !== s.y2);
assert.ok(tieneLongitudReal, "el tallo mínimo debe tener longitud real, no quedar en un punto");

console.log("botanica: ok");

// Comprobación mínima del intérprete: que ayuda liste todo, que el cupo de
// riego se respete, que abrir devuelva las notas reales, que los comandos
// de otra vida no rompan nada, y que una orden mal escrita sugiera la parecida.
// Ejecutar con: npm run check
import assert from "node:assert/strict";
import { ejecutar, completar, COMANDOS } from "./consola.ts";

type Estado = Parameters<typeof ejecutar>[1];

function estadoNuevo(): Estado {
  return { riegos: {}, riegosHoy: 0, miRiegosRestantes: 3, haPlantado: false, estacion: "otoño", hora24: 12 };
}

// ayuda lista todos los comandos declarados
const respuestaAyuda = ejecutar("ayuda", estadoNuevo());
for (const c of COMANDOS) {
  assert.ok(
    respuestaAyuda.lineas.some((linea: string) => linea.includes(c.nombre)),
    `ayuda no menciona «${c.nombre}»`,
  );
}

// regar respeta el cupo diario del visitante
const estadoRiego = estadoNuevo();
estadoRiego.miRiegosRestantes = 1;
const primerRiego = ejecutar("regar capgemini", estadoRiego);
assert.equal(estadoRiego.miRiegosRestantes, 0);
assert.equal(estadoRiego.riegos["capgemini"], 1);
assert.equal(primerRiego.efecto?.tipo, "regar");
const segundoRiego = ejecutar("regar capgemini", estadoRiego);
assert.equal(estadoRiego.riegos["capgemini"], 1, "sin cupo no debe sumar riegos");
assert.equal(segundoRiego.efecto, undefined);

// regar un slug inexistente responde en ficción, sin reventar
const riegoFantasma = ejecutar("regar planta-que-no-existe", estadoNuevo());
assert.equal(riegoFantasma.efecto, undefined);
assert.ok(riegoFantasma.lineas.length > 0);

// abrir un slug real (árbol) devuelve sus notas y emite el enfoque
const fichaArbol = ejecutar("abrir inetum", estadoNuevo());
assert.equal(fichaArbol.efecto?.tipo, "enfocar");
assert.ok(fichaArbol.lineas.some((l: string) => l.includes("infraestructura de análisis documental")));

// abrir un slug real (arbusto) devuelve su repo
const fichaArbusto = ejecutar("abrir rustytype", estadoNuevo());
assert.ok(fichaArbusto.lineas.some((l: string) => l.includes("Yago-Torres/rustytype")));

// un comando de otra vida responde en ficción sin ejecutar nada ni romperse
const unix = ejecutar("sudo", estadoNuevo());
assert.ok(unix.lineas.length > 0);
assert.equal(unix.efecto, undefined);
assert.ok(!unix.lineas[0].includes("Error"));

// comando mal escrito sugiere el más parecido
const errata = ejecutar("regr", estadoNuevo());
assert.ok(errata.lineas[0].includes("regar"));

// autocompletado: prefijo único de comando, y de especie tras «regar »
assert.equal(completar("exc"), "excavar");
assert.equal(completar("regar cap"), "regar capgemini");
assert.equal(completar("a"), null); // ambiguo: ayuda / abrir

console.log("consola: ok");

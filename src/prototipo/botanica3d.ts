// Tortuga en tres dimensiones.
//
// Reutiliza lo caro de src/botanica.ts —el genoma determinista por slug y la
// cadena del L-system— y solo cambia el paso final: en vez de segmentos en un
// plano, produce segmentos en el espacio. La misma etapa profesional da
// siempre el mismo árbol, y dos etapas distintas dan árboles distintos.

import { Vector3 } from "three";
import { expandir, genoma, type Genoma } from "../botanica";

export const CALIBRACION = {
  // Vueltas de rosca que se aplican al ramificar. El número áureo reparte las
  // ramas alrededor del tronco sin que se solapen; cambiarlo las alinea feo.
  ROSCA: 137.5,
  // Cuánto se endereza cada rama hacia la luz (0..1). Subirlo da plantas
  // más verticales y cerradas; bajarlo, plantas desparramadas.
  FOTOTROPISMO: 0.13,
  // Iteraciones según vigor 0..1.
  ITERACIONES_MIN: 2,
  ITERACIONES_MAX: 5,
};

export type Rama = {
  a: Vector3;
  b: Vector3;
  grosor: number;
  nivel: number;
  /** punta sin ramificar: ahí va una hoja */
  hoja: boolean;
};

const ARRIBA = new Vector3(0, 1, 0);
const grados = (g: number) => (g * Math.PI) / 180;

type Estado = {
  pos: Vector3;
  dir: Vector3;
  /** eje sobre el que se abre la rama, perpendicular a la dirección */
  eje: Vector3;
  longitud: number;
  grosor: number;
  nivel: number;
};

/**
 * Convierte la cadena del L-system en ramas tridimensionales.
 * La base queda en el origen y la planta crece hacia y positiva.
 */
export function ramificar(
  g: Genoma,
  cadena: string,
  longitud: number,
  grosor: number,
): Rama[] {
  const ramas: Rama[] = [];
  const pila: Estado[] = [];
  let rosca = 0;

  let e: Estado = {
    pos: new Vector3(0, 0, 0),
    dir: ARRIBA.clone(),
    eje: new Vector3(1, 0, 0),
    longitud,
    grosor,
    nivel: 0,
  };

  const girar = (signo: number) => {
    // se abre sobre su eje y además rosca alrededor del tronco, para que las
    // ramas no queden todas en el mismo plano
    rosca += CALIBRACION.ROSCA;
    e.dir = e.dir
      .clone()
      .applyAxisAngle(e.eje, signo * grados(g.angulo))
      .applyAxisAngle(ARRIBA, grados(rosca))
      .lerp(ARRIBA, CALIBRACION.FOTOTROPISMO)
      .normalize();
    e.eje = new Vector3(-e.dir.z, 0, e.dir.x).normalize();
    if (e.eje.lengthSq() < 1e-6) e.eje.set(1, 0, 0);
  };

  for (const simbolo of cadena) {
    switch (simbolo) {
      case "F": {
        const a = e.pos.clone();
        const b = a.clone().addScaledVector(e.dir, e.longitud);
        ramas.push({ a, b, grosor: e.grosor, nivel: e.nivel, hoja: false });
        e.pos = b;
        break;
      }
      case "L":
        // punta florecida: una rama corta y fina que lleva hoja
        ramas.push({
          a: e.pos.clone(),
          b: e.pos.clone().addScaledVector(e.dir, e.longitud * 0.45),
          grosor: e.grosor * 0.6,
          nivel: e.nivel,
          hoja: true,
        });
        break;
      case "+":
        girar(1);
        break;
      case "-":
        girar(-1);
        break;
      case "[":
        pila.push({ ...e, pos: e.pos.clone(), dir: e.dir.clone(), eje: e.eje.clone() });
        e.longitud *= g.decaimiento;
        e.grosor *= 0.68;
        e.nivel += 1;
        break;
      case "]": {
        const previo = pila.pop();
        if (previo) e = previo;
        break;
      }
    }
  }

  return ramas;
}

/** Atajo: de slug y vigor a ramas, sin pensar en el L-system. */
export function plantaDe(slug: string, vigor: number, escala: number): Rama[] {
  const g = genoma(slug);
  const v = Math.min(Math.max(vigor, 0), 1);
  const iteraciones = Math.round(
    CALIBRACION.ITERACIONES_MIN +
      v * (CALIBRACION.ITERACIONES_MAX - CALIBRACION.ITERACIONES_MIN),
  );
  const cadena = expandir(g, iteraciones);
  // el tronco se acorta al subir iteraciones para que la planta no crezca sin límite
  const longitud = (escala * (0.55 + v * 0.45)) / (1 + iteraciones * 2.3);
  return ramificar(g, cadena, longitud, escala * 0.022 * (0.6 + v * 0.6));
}

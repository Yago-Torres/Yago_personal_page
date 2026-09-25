// Post-proceso: tramado ordenado Bayer 8x8 con cuantización a paleta corta.
//
// No es 1 bit: a 1 bit se pierde el plástico translúcido, el reflejo y la sombra,
// que son justo lo que da cuerpo al objeto. Cuantizamos a NIVELES por canal y
// usamos el Bayer como ruido de decisión, así el degradado se rompe en trama
// pero el material sobrevive. La pantalla del aparato sí irá a 1 bit estricto,
// pero eso se dibuja en su propia textura, no aquí.

import { Vector2 } from "three";

export const CALIBRACION = {
  // Niveles por canal. 2 = un bit por canal (durísimo). Subirlo suaviza y pierde gracia.
  NIVELES: 6,
  // Lado del píxel de trama, en píxeles de pantalla. Subirlo engorda el grano.
  GRANO: 2,
  // Fuerza del desplazamiento Bayer. 0 = sin trama, 1 = trama completa.
  FUERZA: 0.85,
};

export const TramadoShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolucion: { value: new Vector2(1, 1) },
    uNiveles: { value: CALIBRACION.NIVELES },
    uGrano: { value: CALIBRACION.GRANO },
    uFuerza: { value: CALIBRACION.FUERZA },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2  uResolucion;
    uniform float uNiveles;
    uniform float uGrano;
    uniform float uFuerza;
    varying vec2 vUv;

    // Bayer 8x8 clásico, normalizado a 0..1
    const int BAYER[64] = int[64](
       0, 32,  8, 40,  2, 34, 10, 42,
      48, 16, 56, 24, 50, 18, 58, 26,
      12, 44,  4, 36, 14, 46,  6, 38,
      60, 28, 52, 20, 62, 30, 54, 22,
       3, 35, 11, 43,  1, 33,  9, 41,
      51, 19, 59, 27, 49, 17, 57, 25,
      15, 47,  7, 39, 13, 45,  5, 37,
      63, 31, 55, 23, 61, 29, 53, 21
    );

    float bayer(vec2 celda) {
      int x = int(mod(celda.x, 8.0));
      int y = int(mod(celda.y, 8.0));
      return float(BAYER[y * 8 + x]) / 64.0;
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      vec2  celda  = floor(gl_FragCoord.xy / uGrano);
      float umbral = (bayer(celda) - 0.5) * uFuerza;

      float pasos = max(uNiveles - 1.0, 1.0);
      vec3 salida = floor((color.rgb + umbral / pasos) * pasos + 0.5) / pasos;

      gl_FragColor = vec4(clamp(salida, 0.0, 1.0), color.a);
    }
  `,
};

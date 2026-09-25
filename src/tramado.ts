// Tramado Bayer ordenado 4x4: reduce una imagen en escala de grises a los dos
// colores de la pantalla. Nada de difusión de error (Floyd-Steinberg parpadea
// al redibujar un canvas en vivo cada pocos segundos).

// Matriz de Bayer 4x4 clásica, valores 0..15. Es una constante del método, no
// se calibra: cambiarla cambia el patrón de trama, no la cantidad de detalle.
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

// Densidad por defecto del tramado (0..1). Subirla llena la pantalla de fósforo
// incluso con poca luz; bajarla deja casi todo en fondo salvo lo más brillante.
export const DENSIDAD_TRAMADO = 0.5;

export type ColorRGB = readonly [number, number, number];

/**
 * Reduce `imagen` (ya en escala de grises, aunque venga en formato RGBA) a dos
 * colores. `densidad` desplaza el umbral de la trama; `invertir` cambia qué lado
 * del umbral se pinta de fósforo (de noche: el jardín se vuelve silueta oscura).
 */
export function tramar(
  imagen: ImageData,
  fondo: ColorRGB,
  fosforo: ColorRGB,
  densidad = DENSIDAD_TRAMADO,
  invertir = false,
): ImageData {
  const salida = new ImageData(imagen.width, imagen.height);
  const sesgo = (densidad - 0.5) * 255;

  for (let y = 0; y < imagen.height; y++) {
    for (let x = 0; x < imagen.width; x++) {
      const i = (y * imagen.width + x) * 4;
      // el canal R basta: el buffer que llega aquí solo dibuja grises
      const luminancia = imagen.data[i]! + sesgo;
      const umbral = ((BAYER_4X4[y % 4]![x % 4]! + 0.5) / 16) * 255;
      const encendido = invertir ? luminancia <= umbral : luminancia > umbral;
      const [r, g, b] = encendido ? fosforo : fondo;
      salida.data[i] = r;
      salida.data[i + 1] = g;
      salida.data[i + 2] = b;
      salida.data[i + 3] = 255;
    }
  }

  return salida;
}

---
name: ytg-diseno
description: Sistema de diseño del aparato YTG-01 (yagotg.dev). Cargar SIEMPRE antes de escribir o modificar CSS, HTML, markup de componentes, dibujo en canvas, copy de la interfaz o textos de la consola de este proyecto. Define la regla chasis/pantalla, los tokens, la retícula, la tipografía, el tramado y el tono de voz.
---

# Sistema de diseño YTG-01

El sitio no es una página: **es un aparato**. Una consola de cultivo que vigila
un jardín compartido donde las plantas son la carrera de Yago. Todo lo que
escribas tiene que sostener esa ficción.

**Regla de contenido, dura:** los árboles son etapas profesionales y **nunca**
llevan nombres de cliente ni de proyecto interno. Llevan notas de qué se hizo,
qué se usó y qué se aprendió. Solo los arbustos —proyectos personales y
públicos— tienen nombre propio y enlace. Si dudas de si algo es publicable,
no lo publiques y pregunta.

## La regla madre

> **El aparato tiene materia. La pantalla es de 1 bit.**

El sitio es un **diorama isométrico en 3D**: una isla flotante cuyo corte de
subsuelo es el CV, con el aparato encima y las plantas creciendo alrededor.
Toda la escena pasa por un post-proceso de tramado ordenado con cuantización a
paleta corta —no a 1 bit, que se cargaría el material—, de modo que el plástico
translúcido, el reflejo y la sombra sobreviven a la trama.

La pantalla del aparato sí es **1 bit estricto**, porque se dibuja en su propia
textura antes del post-proceso. Nunca metas color de acento dentro de la
pantalla. Si esas dos capas se mezclan, el concepto se cae.

## Las tres capas

| Capa | Qué es | Dónde vive |
|---|---|---|
| 1. Marco | Hardware: chasis, canto, serigrafía, botones, LED, rejilla | DOM + CSS |
| 2. Interfaz | Blueprint: retícula, líneas de 1px, cotas, etiquetas, marcas de esquina | DOM + CSS |
| 3. Lo vivo | Tramado 1-bit: plantas, sustrato, lo que crece | Canvas |

**El texto y la retícula nunca se dibujan dentro del canvas.** Van en DOM para
que sean nítidos, seleccionables y accesibles. El canvas es solo para lo vivo.

## Tokens

Están todos en `src/style.css` bajo `:root`. **Nunca escribas un color literal
en una regla**: si falta un token, añádelo ahí.

- Chasis: `--chasis`, `--chasis-alto`, `--chasis-bajo`, `--surco`
  (plástico translúcido mate, hueso apagado. **El amarillo y el verde chillón
  se descartaron**: no los reintroduzcas.)
- Serigrafía: `--tinta`, `--tinta-tenue`
- Acentos, exactamente tres: `--azul` (botón maestro), `--rojo` (marca y ayuda), `--verde` (señal de vida)
- Pantalla: `--pantalla`, `--fosforo`, `--reticula`
- Medidas: `--paso` (8px), `--radio`, `--canto`

Hay tres variantes de chasis vía `:root[data-chasis="verde"|"gris"]`. Cualquier
token de color nuevo tiene que funcionar en las tres.

## Retícula

Todo espaciado, padding y gap es múltiplo de `--paso` (8px), expresado como
`calc(var(--paso) * n)`. Sin números sueltos. Las excepciones son los detalles
de 1–5px del relieve físico (bordes, cantos, sombras duras).

## Tipografía

- **Chasis** (`--tipo-chasis`): sans del sistema. Las etiquetas usan la clase
  `.serigrafia`: 9px, peso 700, `letter-spacing: .14em`, minúsculas en el HTML
  y mayúsculas por CSS.
- **Pantalla y cifras** (`--tipo-pantalla`): monoespaciada. Todos los números
  llevan `font-variant-numeric: tabular-nums` para que no bailen al actualizarse.
- Sin fuentes web. Si alguna vez hace falta una, se pregunta antes.

## El objeto

El aparato tiene volumen y hay que mantenerlo:

- El volumen es **real**: Three.js, materiales físicos, luz de estudio y sombra
  de contacto. El aparato es plástico translúcido mate
  (`MeshPhysicalMaterial` con `transmission`), nunca plano ni de color chillón.
- El movimiento de cámara es lento y corto: giro automático de pocos grados por
  segundo más un paralaje leve con el puntero. Nada de órbita libre brusca.
- Se desactiva con `prefers-reduced-motion` y se aligera en táctil.
- **Cero dependencias más allá de `three`.** Nada de motores de física, GUI de
  depuración ni librerías de post-proceso: los pases se escriben a mano.

## Tramado

- **Escena 3D**: Bayer ordenado 8×8 como paso de post-proceso, cuantizando a
  pocos niveles por canal (ver `src/prototipo/tramado.ts`). Nada de difusión de
  error: Floyd-Steinberg parpadea al animar.
- **Pantalla del aparato**: Bayer 4×4 a dos valores exactos, `--pantalla` y
  `--fosforo`, dibujada en un buffer pequeño y escalada con
  `imageSmoothingEnabled = false`. El píxel gordo es parte del estilo.
- El grano de trama se mide en píxeles de pantalla, no en píxeles del mundo:
  la trama se queda pegada al cristal, no a los objetos.

## Calibración

Nada de números mágicos enterrados. Toda constante que afecte a cómo se ve o
se mueve algo vivo —crecimiento, ángulos, umbrales, inclinación, mezcla de
audio— se declara arriba del módulo, en mayúsculas, con un comentario de una
línea diciendo qué pasa si la subes. Un aparato se ajusta.

## Voz

La consola habla en **castellano, en minúsculas, en corto y desde dentro de la
ficción**. Es un aparato de jardinería, no un terminal Unix.

- Bien: `el helecho se yergue. 3 personas lo han regado hoy.`
- Bien: `sustrato seco. esta planta lleva 40 días sin tocarse.`
- Mal: `Error: comando no encontrado.`
- Mal: cualquier emoji, cualquier signo de exclamación.

**`whoami`, `ls`, `cd`, `sudo` y demás no existen.** Si alguien los escribe, el
aparato responde en ficción sin ejecutar nada:
`esto no es una terminal. es una consola de riego.`

Los comandos son verbos de jardinería en castellano: `mirar`, `regar`, `abrir`,
`plantar`, `podar`, `excavar`, `etiquetas`, `historia`, `ayuda`.

## Accesibilidad, no negociable

- Cada planta tiene una URL real con HTML pre-generado, navegable sin JS.
- El canvas siempre lleva `aria-hidden="true"`: lo que cuenta va en DOM.
- Todo control es un `<button>` o un `<a>` de verdad, con `:focus-visible`
  visible y etiqueta accesible.
- Nada depende solo del color: el estado se dice también con texto o forma.
- Respeta `prefers-reduced-motion` en cualquier cosa que se mueva.

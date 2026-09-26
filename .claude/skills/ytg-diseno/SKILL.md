---
name: ytg-diseno
description: Sistema de diseño de yagotg.dev (YTG-01), la web personal de Yago Torres. Cargar SIEMPRE antes de escribir o modificar HTML, CSS, copy de la interfaz o la escena 3D de este proyecto. Define la jerarquía tipográfica, el acento único, la retícula, la regla de contenido y el papel del objeto 3D.
---

# Sistema de diseño YTG-01

Una web personal editorial: **manda la tipografía y el objeto 3D acompaña**. Es
una página con secciones, no una aplicación 3D con interfaz flotando encima.

## La metáfora

El currículum se lee **como un parte meteorológico**. Cada widget de una app
del tiempo sostiene una parte del CV, y la traducción es fija:

| Widget | Contenido |
|---|---|
| Ahora mismo | El tiempo real de la ciudad elegida y el puesto actual |
| Próximas horas | Certificaciones pendientes |
| Pronóstico | Experiencia: cada etapa es un día |
| Viento | El stack, con velocidad en % |
| Amanecer y atardecer | La carrera, de Zaragoza a Konstanz |
| Avisos | Premios, en formato aviso meteorológico |
| Estaciones | Proyectos propios |

El selector de ciudad (Tudela · Zaragoza · Madrid) cambia el tiempo real y con
él la escena. **El 3D obedece al tiempo, siempre**: si llueve en la ciudad
elegida, llueve en la azotea. No inventes estados que no vengan de la lectura.

## La regla madre

> **El contenido está en el HTML. El 3D lo ilustra, no lo contiene.**

Todo el currículum —etapas, proyectos, stack, formación, premios,
certificaciones— vive como HTML semántico en `index.html`. La escena 3D lee del
documento (`[data-planta]`, `[data-vigor]`, `[data-peso]`), nunca al revés.
Consecuencia directa: la página se lee sin JavaScript, con teclado y con lector
de pantalla. **Eso no se recorta nunca.**

Si necesitas un dato nuevo en la escena, añádelo como atributo `data-` en el
HTML donde ya está ese contenido. No crees un fichero de datos paralelo: se
desincroniza y duplica la verdad.

## Jerarquía

1. **Titulares**: Anton, mayúsculas, interlineado 0.86, tamaños grandes de
   verdad (`clamp` hasta 100px o más). Es el elemento principal de cada sección.
2. **Texto**: Archivo. Párrafos cortos, ancho máximo ~44ch.
3. **Etiquetas y cifras**: monoespaciada, 11px, `letter-spacing: .18em`,
   mayúsculas, en `--tinta-media`. Son el detalle técnico que da carácter.

## Color

**Un solo acento y neutros alrededor.** Nada de paletas de caramelo, nada de
arcoíris, nada de degradados de color.

- Neutros: `--papel`, `--papel-alto`, `--linea`, `--tinta`, `--tinta-media`
- Acento: `--acento` y `--acento-baja`, y nada más

El acento se reserva para una palabra del titular, los botones de acción, las
marcas de las filas y el mensaje del visitante. Si aparece en todas partes deja
de ser un acento.

**El objeto 3D es monocromo**: la azotea de Yago, con un Yago diminuto que
riega, trabaja o saca el paraguas según el tiempo. Vive entera en tonos del
acento, con la crema como único contrapunto. Es lo que lo mantiene pegado a la página en vez de
parecer una ilustración traída de otro sitio. Los tonos están en `TONOS`, en
`src/escena.ts`.

**De noche en Zaragoza la página se da la vuelta** con
`:root[data-turno="noche"]`: el papel se vuelve tinta y la tinta papel. El
acento se mantiene, solo se apaga un punto. Cualquier color nuevo tiene que
funcionar en los dos turnos, así que siempre va como token.

## Retícula y estructura

- El ancho lo marca `.carril`; el aire lateral es `--gutter`.
- Las secciones se separan con **reglas de 1px en `--linea`**, no con sombras
  ni tarjetas flotantes. El sitio es plano: sin biseles, sin brillos, sin
  sombras de caja.
- Las listas de contenido son filas con regla arriba, como un índice.
- Marcas de esquina finas solo alrededor de la escena, y con moderación.

## El objeto 3D

- Fondo transparente: el lienzo deja ver el papel de la página.
- Movimiento lento y corto: giro de pocos grados por segundo más un paralaje
  leve con el puntero. Se para al salir de pantalla y con
  `prefers-reduced-motion`.
- Solo `three` como dependencia. Nada de post-proceso, motores de física ni
  librerías de interfaz. Si crees que hace falta una, pregunta.
- Toda constante que afecte a lo que se ve va en `CALIBRACION`, en mayúsculas,
  arriba del módulo, con un comentario de una línea diciendo qué pasa si sube.

## Regla de contenido, dura

Las etapas profesionales **nunca** llevan nombres de cliente ni de proyecto
interno: ese trabajo es confidencial. Llevan notas de qué se hizo, qué se usó y
qué se aprendió. Solo los proyectos propios y públicos tienen nombre y enlace.
Si dudas de si algo es publicable, no lo publiques y pregunta.

El mensaje que deja el visitante es texto libre. Hoy vive en su navegador, así
que no hay riesgo. **En cuanto pase a ser compartido necesita moderación antes
de publicarse**, porque sale en grande con el nombre de Yago debajo.

## Voz

Castellano, primera persona, frases cortas y sin humo. Nada de emoji, nada de
signos de exclamación, nada de «apasionado por la tecnología».

- Bien: `Llevé una infraestructura de análisis documental de la nube a on-premise.`
- Mal: `Experto en soluciones cloud de vanguardia.`

## Lo descartado, para que nadie lo reintroduzca

- Chasis amarillo y estética Teenage Engineering.
- Estética Y2K: cromados, irisado, plásticos de caramelo, arcoíris.
- Tramado y post-proceso de dither.
- Interfaz proyectada sobre la pantalla del aparato en 3D.
- Terminal, intérprete de comandos y cualquier emulador de consola.
- Low-poly con caras planas.
- El jardín: la isla flotante, las plantas como proyectos y los estratos del
  subsuelo. Sustituido por la azotea y el parte del tiempo.

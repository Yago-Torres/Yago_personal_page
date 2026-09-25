# AGENTS.md — YTG-01

Consola de cultivo en yagotg.dev. Un jardín compartido donde las plantas son
proyectos, empleos y formación reales, y los visitantes pueden regar y plantar.

## Stack fijo
- Vite + TypeScript vanilla. **Sin framework, sin librería de UI, sin librería de terminal.**
- Plantas: L-systems dibujados en canvas 2D a baja resolución + tramado Bayer 4x4.
- Retícula, texto e interfaz en DOM/CSS, **nunca dentro del canvas**.
- Despliegue: Worker con Static Assets (no Pages). Estado en D1. Sin Durable Objects.
- Datos externos cacheados en el Worker con Cache API, no en build.

## Estética
Tres capas, no se mezclan:
1. **Marco** = hardware. La página es un aparato: chasis, serigrafía, modelo, LED.
2. **Interfaz** = blueprint. Retícula, líneas de 1px, cotas, etiquetas, anotaciones.
3. **Lo vivo** = tramado 1-bit. Solo las plantas y el sustrato.

## Reglas
1. Una PR por fase, una sola responsabilidad.
2. No añadir dependencias. Si crees que hace falta una, pregunta antes.
3. Nada de `whoami`, `ls`, `cd` ni cosplay de Unix: los comandos son de jardinería
   y en español. Un comando de Unix responde en ficción, no ejecuta nada.
4. Cada planta tiene URL real con HTML pre-generado, navegable sin JS y con teclado.
   La accesibilidad no se recorta nunca.
5. Todo lo que dependa del mundo físico (crecimiento, luz, ritmo, mezcla de audio)
   lleva constantes de calibración expuestas, no números mágicos enterrados.
6. Lógica no trivial deja una comprobación ejecutable. Sin frameworks de test.
7. No ampliar alcance sin autorización explícita.

## Flujo
Problema -> slice mínimo -> implementación -> validación en navegador -> revisión humana -> merge.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Jugadores de un grupo de Pathfinder 2e** (el grupo del autor). Varios son nuevos en el sistema y se
  pierden con facilidad; vienen de jugar en Foundry VTT y lo sienten pesado y confuso.
- **El GM** de ese grupo, que prepara el tablero, los enemigos y lleva el combate.

Su trabajo durante la sesión: entender qué pueden hacer en su turno, hacerlo sin pelearse con la
herramienta y seguir lo que pasa en la mesa.

## Product Purpose

Wayforge es una mesa virtual de Pathfinder 2e en el navegador, en tiempo real, que hace las cuentas
por el jugador y explica cada número. El éxito es que un jugador nuevo juegue una sesión completa sin
abrir el manual ni preguntar "¿qué sumo aquí?".

## Positioning

Tan simple como una mesa virtual ligera, pero con las reglas de PF2e automatizadas y explicadas en
lenguaje humano: economía de 3 acciones, penalización por ataque múltiple, grados de éxito y
condiciones que se aplican solas.

## Operating Context

Se juega en dos formatos, los dos con la misma importancia:

1. **Mesa compartida + teléfonos:** una pantalla (TV o laptop) muestra el tablero para todos; cada
   jugador usa su teléfono como su ficha y su mando.
2. **Todos en PC:** cada quien en su computadora, con el tablero y su ficha en la misma pantalla,
   presencial o a distancia.

Se entra con un código de mesa; cada personaje tiene su propio código.

## Capabilities and Constraints

- Ya existe: salas en tiempo real (Cloudflare Workers + Durable Objects), tablero con imágenes propias,
  fichas con cálculo y desglose, tiradas hechas por el servidor, combate con iniciativa, 3 acciones,
  reacción, condiciones y grados de éxito contra la CA.
- Interfaz en **español**; los términos de reglas de PF2e (skills, condiciones, acciones) en
  **inglés**, con su explicación en español.
- **Todo personalizable**: tablero, imágenes de tokens y enemigos, temas, reglas de la casa; siempre
  con buenos valores por defecto.
- **Contenido de los manuales precargado** (skills, acciones, y más adelante ascendencias, clases,
  dotes, conjuros, equipo), bajo la licencia ORC de Pathfinder 2e. Pendiente: de qué fuente se carga.
- Sin material con marca registrada de Paizo en la interfaz.

## Brand Commitments

- Nombre: **Wayforge**. Lema: "La mesa de Pathfinder 2e que hace las cuentas por ti".
- Voz: cercana, en español, explica sin condescender.
- Dos temas: uno claro y uno oscuro.

## Product Principles

1. **Explicar antes que esconder:** cada número y cada regla se puede abrir para ver de dónde sale.
2. **Lo que toca, a la vista:** en cada momento, la siguiente acción probable es la más fácil de hacer.
3. **La mesa tiene la última palabra:** las tiradas y las reglas las resuelve el servidor, igual para todos.
4. **Personalizable sin obligar:** se juega sin tocar ningún ajuste.

---
version: 1
slug: "src-paginas-sala-tsx"
primary_target: "src/paginas/Sala.tsx"
related_targets: ["src/componentes/Ficha.tsx","src/componentes/Combate.tsx"]
---

# Mesa del jugador (y del GM)

Modo: Operate. Audiencia: jugadores de PF2e, varios novatos que se pierden en Foundry; el GM. Tarea: en
su turno, entender qué pueden hacer y hacerlo; fuera de su turno, seguir la mesa. Dos formatos: todos
en PC (tablero + hoja en pantalla) y mesa compartida (tablero en la tele, el teléfono como mando).

Pendiente: fuente del contenido precargado de los manuales (por ahora, acciones básicas escritas a mano).

## Direction contract

THESIS: La partida es el cuaderno cuadriculado de la mesa: el tablero es la cuadrícula del papel y el
personaje es una página arrancada apoyada encima. Rechaza el HUD oscuro de paneles de las mesas virtuales.

OWN-WORLD: Papel blanco frío con cuadrícula azul de 24px; lápiz grafito para trazos y texto secundario;
bolígrafo azul para lo propio y lo tocable; rojo para enemigos y restas; marcatextos amarillo solo para
"lo que toca ahora"; post-its para condiciones; cinta adhesiva y foto pegada. Letra a mano legible
(Shantell Sans) para títulos y números; Atkinson Hyperlegible para el texto. Trazos con leve temblor.

STORY: El jugador ve de un vistazo su vida, sus acciones restantes y la acción probable resaltada; toca
y lee la cuenta de por qué ese número; separa lo que puede usar siempre de lo que gasta (foco, día, consumibles).

FIRST VIEWPORT: Escritorio: tablero a pantalla completa, orden de turnos escrito arriba, tiradas como
lista al margen derecho, página del jugador abajo (quién y PG | acciones agrupadas por cómo se recuperan
| post-its y "Terminar turno"). Teléfono: cabecera con PG y ◆◆◆, lista agrupada con la acción abierta
como tarjeta, "Terminar turno" fijo sobre la barra de pestañas.

FORM: Cuaderno de mazmorras, candidato 1 de la lista propia (elegido por el usuario sobre la tirada); seed 2f2e0533.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

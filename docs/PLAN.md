# Wayforge — plan hasta "nuestro Foundry"

> Qué falta para que una sesión completa de PF2e se juegue en Wayforge sin abrir Foundry, en qué orden y
> cómo sabemos que cada parte está terminada. Se actualiza al cerrar cada fase.

## Dónde estamos (octubre 2026)

| Área | Ya funciona |
|---|---|
| Entrada | Código de mesa → personaje → código del personaje; código de GM; sesiones por dispositivo |
| Tablero | Mapa con imagen, cuadrícula ajustable, tokens con imagen y tamaño, zoom y paneo |
| Movimiento | Casillas alcanzables, ruta con costo PF2e (diagonales 5/10), token que recorre el camino |
| Reglas en la mesa | Turno, acciones, alcance: la sala lo hace cumplir y dice por qué no se puede |
| Combate | Iniciativa, orden, 3 acciones, reacción, MAP, grados de éxito contra la CA, condiciones comunes |
| Fichas | Asistente paso a paso, aptitudes por recuperación, conjuros con espacios, foco, descansos |
| Avisos | Momento justo de cada aptitud, pausa para reaccionar, daño con "Restar" |
| Gráficos | Dado rodando, trazo del golpe, impacto, números de daño, sello de turno |
| Jugador | Hoja de cuaderno en PC; mando en el teléfono con pestañas |
| Compendio | Todo el contenido del sistema PF2e de Foundry (`npm run compendio`): 6.519 criaturas, 2.018 conjuros, 6.366 dotes, equipo, acciones, condiciones, ascendencias, clases, deidades y peligros. El GM pone cualquier criatura en el tablero; el jugador agrega conjuros, dotes y objetos a su hoja; el creador ofrece todas las dotes y conjuros de nivel 1 |

## Lo que tiene Foundry y nos falta

Agrupado por lo que más se nota en una sesión real. **P** = prioridad (1 alta, 3 baja).

| P | Falta | Por qué importa |
|---|---|---|
| 1 | Editar personajes desde la mesa (tocar el retrato) | Hoy el editor está escondido en la ficha completa |
| 1 | Ver los punteros y los objetivos de los demás | En remoto nadie sabe de qué habla el otro |
| 1 | Ver el alcance de una habilidad antes de elegir objetivo | Elegir objetivo a ciegas es lo que más frustra |
| 1 | Señalar un punto del mapa ("¡aquí!") | Igual que el ping de Foundry |
| 1 | Enemigos con sus ataques, salvaciones y habilidades | El GM hoy tira "a mano" con la tirada libre |
| 1 | Aplicar daño y curación con un toque (con resistencias y crítico) | Hoy se resta en un aviso, sin resistencias |
| 1 | Conjuros con salvación: CD, grados, daño por grado, áreas | La mitad de los conjuros de PF2e son así |
| 2 | Plantillas de área (explosión, cono, línea) y regla para medir | Necesario para conjuros de área |
| 2 | Bestiario: enemigos comunes listos, y guardar los propios | Preparar un combate en minutos |
| 2 | Escenas: varios mapas por mesa, preparar el siguiente sin que se vea | Cambiar de lugar sin rehacer todo |
| 2 | Niebla de guerra manual (revelar por zonas) | Mazmorras |
| 2 | Chat y registro de la sesión (tiradas + mensajes + susurros) | Remoto |
| 2 | Inventario, oro y objetos con efecto | Pociones, armas nuevas |
| 2 | Importar de Pathbuilder (JSON) | Nadie quiere copiar la ficha a mano |
| 2 | Dying, Wounded, recuperación y muerte automáticas | Las reglas de muerte son las más olvidadas |
| 3 | Visión, luces y paredes | Muy caro; la niebla manual cubre casi todo |
| 3 | Diario de campaña, notas y handouts | Fuera de la mesa |
| 3 | Música y sonido ambiente | Bonito, no esencial |
| 3 | Campañas guardadas y lista de mesas del GM | Hoy cada mesa vive sola por su código |
| 3 | Macros y módulos | Lo cubrimos con "todo personalizable" como datos |

## Fases

Cada fase se cierra con: typecheck, tests, build, una ronda jugada con clics reales (escritorio y
teléfono), y la mesa de prueba (`npm run demo`) actualizada para mostrar lo nuevo.

### Fase 1 — La mesa se siente compartida *(hecha)*

Además de lo que sigue, entraron en esta fase:

- **Dado 3D** (three.js, cargado solo al tirar): gira en cuanto se aprieta y cae en la cara que salió;
  d4, d6, d8, d10, d12 y d20 con caras de papel y aristas a tinta. Sin WebGL, el dado dibujado en 2D.
- **Resultados a tinta**: la cuenta a lápiz, el total en un círculo a mano, el grado como sello
  ("¡Le diste!", "Pifia") y el daño sobre una mancha roja, en la tarjeta y sobre el token.
- **Base de datos PF2e** (`reglas/datos/`): 8 ascendencias con herencias, 34 trasfondos, 12 clases
  con subclases, dotes de nivel 1 (habilidad, generales, de ascendencia y de clase), 44 trucos y
  conjuros de rango 1, armas, armaduras, escudos y equipo.
- **Creador de personajes guiado** (`reglas/creador.ts` + `src/componentes/creador/`): ascendencia →
  trasfondo → clase → atributos → skills → dotes → conjuros → equipo → quién es → código, con la ficha
  calculándose en vivo y lo que falta en cada paso. Sigue existiendo "copiar mi ficha a mano".
- **Moverse solo arrastrando**: las casillas alcanzables y la ruta aparecen mientras se lleva el token;
  la ficha se levanta como una pieza de cartón. Tablero de papel con viñeta, cuadrícula milimetrada y
  tokens con sombra, doble trazo de tinta, etiqueta de nombre y barra de PG a lápiz.
- **Atajos Q W E R T Y libres**: seis espacios que cada jugador llena con lo que quiera (desde la lista,
  desde el detalle de cualquier acción o con una ventana para elegir); se guardan en la ficha.
- **Paneles**: Grupo (G), Mochila (I), Reglas rápidas (H), Tiradas y Ficha, en un cajón lateral en PC y
  en ventanas que suben desde abajo en el teléfono ("Más").

1. **Editar personaje desde el retrato.** Tocar la foto (hoja en PC, mando en el teléfono, lista de
   personajes del GM, token del personaje en las herramientas del GM) abre el editor encima de la mesa,
   sin perder el juego de fondo. Solo se guarda lo que cambió, para no pisar los PG que cambiaron mientras
   se editaba.
2. **Punteros de los demás.** Cada quien ve el puntero de los otros sobre el tablero, con su nombre y su
   color. Se apagan solos si no se mueven. Viajan por el WebSocket sin guardarse (no tocan el estado).
3. **Objetivos de los demás.** Si un aliado apunta a un enemigo, ese enemigo lleva una marca con el
   color y el nombre del aliado.
4. **Señal.** Mantener presionado el tablero (o Alt + clic) lanza una onda en ese punto que ven todos.
5. **Alcance antes de elegir objetivo.** Al pasar por una acción, abrirla o elegirla, el tablero sombrea
   hasta dónde llega desde tu token y marca qué tokens quedan dentro. Si eliges atacar sin objetivo, la
   mesa entra en modo "elige objetivo": tocar a alguien dentro del alcance hace la acción; fuera, dice
   por qué.

**Listo cuando:** dos navegadores ven el puntero y el objetivo del otro; atacar sin objetivo lleva al
modo de elegir; el retrato abre el editor en PC, teléfono y GM.

### Fase 2 — El GM juega a sus enemigos *(hecha)*

Ya hecho: ficha de criatura en el token (nivel, salvaciones, velocidad, ataques con bono y daño, skills,
notas), bestiario con 12 criaturas de nivel −1 a 3, mesa del GM con el estilo de cuaderno (hoja de la
criatura abajo, paneles a la izquierda, cajón lateral), la criatura en turno pasa sola al GM, se mueve
gastando Strides, ataca desde su hoja o desde el menú contra un objetivo con las mismas reglas que los
jugadores (turno, acciones, alcance, penalización por ataques seguidos, pausa para reaccionar), y el daño
se tira y se resta con un toque, ya con resistencias, debilidades e inmunidades aplicadas. Los jugadores
ven a los enemigos como "ileso", "herido", "muy herido", "casi muerto" o "derrotado" (tachado), sin sus PG.

1. **Ficha de enemigo** (`Criatura`): nivel, CA, PG, salvaciones, Perception, velocidad, ataques
   (bono, daño, rasgos: agile, reach), habilidades, resistencias, debilidades, inmunidades.
2. **El GM controla al enemigo en turno igual que un jugador:** casillas, ruta, menú contra un objetivo,
   MAP, grados contra la CA del personaje. Reutiliza `MenuObjetivo` y las reglas de la sala.
3. **Daño y curación aplicados.** "Aplicar" resta del objetivo con resistencia/debilidad/inmunidad y PG
   temporales; "Curar" suma hasta el máximo. Funciona igual para personajes y enemigos.
4. **Bestiario inicial** con 20–30 criaturas de nivel −1 a 4 (goblins, kobolds, lobos, esqueletos,
   zombis…) bajo licencia ORC, y "guardar como plantilla" para las propias.
5. **Ocultar información:** los jugadores ven el estado del enemigo como texto ("herido", "muy herido"),
   no sus PG.

**Listo cuando:** el GM corre un combate de 3 goblins contra 2 personajes sin usar la tirada libre.

### Fase 3 — Conjuros y áreas

1. **Salvaciones contra CD** con los cuatro grados y el resultado por grado (sin efecto, mitad, completo,
   doble) aplicado a cada objetivo.
2. **Plantillas de área:** explosión (radio), cono, línea y emanación, con las reglas de PF2e para qué
   casillas cubre; se colocan en el tablero y marcan a quién tocan.
3. **Regla para medir** (arrastrar con una tecla o botón) con distancia PF2e.
4. **Conjuros automatizados** del catálogo: Electric Arc, Fireball, Heal (los 3 modos), Magic Missile/Force
   Barrage, Fear, Grease, Ray of Frost, Produce Flame, Shield…
5. **Daño persistente y efectos con duración** (rondas) que se cuentan solos al terminar el turno.

**Listo cuando:** Fireball sobre 3 goblins tira las 3 salvaciones, aplica el daño por grado y deja el
registro claro.

### Fase 4 — Muerte, descanso y exploración

1. Dying / Wounded / Doomed automáticos al llegar a 0 PG; recuperación al inicio del turno con su
   tirada; Hero Points.
2. Treat Wounds, Refocus y descanso largo con sus cuentas (Medicine contra CD, 10 minutos).
3. Modo exploración: actividades (Search, Avoid Notice, Defend…) que deciden la iniciativa.

### Fase 5 — Escenas, niebla y mesa

1. Escenas: varios mapas por mesa, la activa la ven todos, el GM prepara las demás.
2. Niebla manual: el GM revela/oculta zonas con pincel o rectángulo.
3. Chat de la mesa: mensajes, susurros al GM, tiradas en el mismo registro; "tirar en secreto" del GM.
4. Notas y handouts (imagen o texto) que el GM muestra a todos o a uno.

### Fase 6 — Contenido y fichas

1. Importar personaje de Pathbuilder 2e (JSON exportado).
2. Inventario: objetos, cantidad, Bulk, oro; consumibles conectados a "Objetos".
3. ~~Compendio buscable~~ (hecho, con todo el contenido de Foundry; los textos quedan en inglés, como en los libros).
4. Subida de nivel guiada (lo que cambia por nivel).

### Fase 7 — Campañas y publicación

1. Campañas: el GM guarda sus mesas, las reabre, exporta e importa (JSON + imágenes).
2. Publicar en Cloudflare (`npm run deploy`) con dominio propio; límites de tamaño de imágenes.
3. Rendimiento con mapas grandes y 20+ tokens; accesibilidad (teclado, lector de pantalla, contraste).
4. Tests de punta a punta de una ronda completa (los guiones de captura convertidos en pruebas).

## Decisiones de arquitectura que guían todo

- **La sala es la fuente de verdad.** Toda regla que decide algo (alcance, acciones, daño) vive en
  `compartido/` o `reglas/` y la sala la vuelve a revisar; la pantalla solo la usa para avisar antes.
- **Lo efímero no se guarda.** Punteros, señales y "estoy apuntando a" viajan por el WebSocket y no
  tocan `EstadoSala` ni el almacenamiento del Durable Object.
- **Contenido como datos.** Bestiario, conjuros y acciones son datos tipados con tests de validación; el
  GM puede copiar y modificar cualquiera.
- **Cada número explica de dónde sale**, también para enemigos y conjuros.

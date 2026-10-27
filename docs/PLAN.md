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

### Fase 3 — Conjuros y áreas *(hecha, salvo la regla para medir)*

Ya hecho: el **motor de interacciones** (`reglas/interacciones.ts`, `reglas/efectos.ts`, `reglas/areas.ts` y
`compartido/interacciones.ts`). Cada aptitud puede decir quién tira (quien la usa contra una defensa, o cada
objetivo su salvación contra la CD), a quiénes alcanza (uno, varios, un área, aliados, uno mismo), qué daño o
curación lleva y qué deja en cada grado (condiciones, efectos con duración, daño persistente, inmunidad a
repetirla). La sala tira todo con sus dados y lo aplica: resistencias, PG temporales, Dying al caer a 0.
Los efectos traen bonos y penalizadores tipados que se apilan con las reglas de PF2e (del mismo tipo, el
mejor bono y la peor penalización) y llegan a todas las tiradas, la CA y las CD. Las rondas se cuentan en el
turno de quien lo lanzó; lo sostenido se va si no se mantiene; lo persistente quema al terminar el turno y
se apaga con un 15. Hay un catálogo de 26 aptitudes ya automatizadas (Demoralize, Trip, Grapple, Fear,
Electric Arc, Fireball, Grease, Bless, Heal, Shield…) y los 2.018 conjuros del compendio traen su
interacción armada con lo que dice el libro. En el tablero, las áreas siguen al puntero y marcan a quién
tocan; al lanzar, las casillas se llenan con la tinta del elemento, cada objetivo recibe su sello ("A
medias", "Falla") y su número, y los efectos se ven como halo y marquitas en el token.

Al apuntar, cada token muestra si sirve como objetivo y qué se tira contra él ("contra su Will · 15 ft"),
o por qué no ("a 40 ft · llega a 30", "no es tu aliado", "inmune por ahora"), sin enseñar los números de
las criaturas; tocar uno que no sirve lo dice ahí mismo. Un área que daña marca aparte a los aliados que
tocaría ("¡ojo! también a Korakai").

**Preparación del combate:** el GM marca quién pelea y prepara el combate. A cada jugador le llega una hoja
para elegir con qué tira la iniciativa (Perception, Stealth si venía escondido u otra skill) y usar lo que
sirve "al tirar iniciativa": las dotes con ese Trigger se detectan solas (también las del compendio) y las
más comunes están automatizadas (Oracular Warning, Scout's Warning, Swaggering Initiative, Prescience;
After You y Big Debut te dejan ir último). El GM ve quién está listo y qué usó, elige por sus criaturas y
tira cuando quiere. Los bonos a la iniciativa entran en la tirada y se gastan con ella. Al empezar, todos
ven el orden de juego; el GM lo ajusta con flechas (los empates los resuelve la regla de PF2e: primero los
enemigos, salvo que el GM mueva a alguien).

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

### Fase 4 — Muerte, descanso y exploración *(hecha)*

Ya hecho: al caer a 0 PG se queda Dying e inconsciente; **al empezar cada turno la sala tira la salvación de
recuperación** (chequeo plano 10 + Dying): a 0 se estabiliza con Wounded +1, y con Dying 4 (menos Doomed) muere.
Inconsciente o muerto no se actúa; con curación se despierta. **Hero Points** (0–3, los da el GM): uno repite una
tirada propia de un d20 (vale la nueva), todos juntos sacan de Dying sin sumar Wounded. **Reloj de la mesa**: el GM
pasa el tiempo (10 min, 1 h, 8 h) y los efectos se cuentan solos (1 minuto = 10 rondas); **descanso corto** del
grupo (Refocus, y quien está a vida completa pierde Wounded) y **la noche** (vida, espacios, foco; Doomed −1, sin
fatiga). **Treat Wounds**: eliges a quién y la dificultad según tu rango en Medicine (con la chance a la vista),
cura o daña según el grado, quita Wounded, deja una hora de inmunidad y suma 10 minutos. **Actividades de
exploración**: Avoid Notice tira la iniciativa con Stealth, Scout da +1 a los aliados, Defend entra con el escudo
levantado.

1. Dying / Wounded / Doomed automáticos al llegar a 0 PG; recuperación al inicio del turno con su
   tirada; Hero Points.
2. Treat Wounds, Refocus y descanso largo con sus cuentas (Medicine contra CD, 10 minutos).
3. Modo exploración: actividades (Search, Avoid Notice, Defend…) que deciden la iniciativa. *(La
   preparación del combate ya deja elegir la skill a mano; falta que la actividad la proponga sola.)*

### Fase 5 — Escenas, niebla y mesa

Ya hecho: el tablero nunca empieza vacío. Sin imagen de mapa trae un **terreno dibujado a tinta** (un claro
del bosque con sendero, árboles y rocas; o una sala de mazmorra), que el GM cambia o quita desde Mesa ("Papel
en blanco"). Es decoración: no bloquea ni cuesta movimiento. El tablero está **delimitado**: la cuadrícula
queda dentro, afuera el papel se ve apagado y rayado, el borde va a tinta doble y nadie (ni el GM) puede soltar
un token fuera. Los tokens nuevos aparecen a la izquierda, a media altura, y la vista encuadra el tablero a
la derecha de los botones. A la izquierda, los **compañeros en miniatura**: retrato con anillo de vida (y de PG
temporales), marquitas de efectos y condiciones, estrella si le toca, Dying en rojo; con el cursor se ve el
detalle (PG, CA, condiciones, efectos con su duración) y tocar el retrato lleva la vista a su token.

**Niebla de guerra con muros** (`compartido/vision.ts`): el GM dibuja muros, puertas y ventanas sobre las
esquinas de la cuadrícula, o una habitación entera de un tirón (cuatro muros con su puerta). Los muros y las
puertas cerradas frenan la vista y el paso; las ventanas dejan ver pero no pasar; las puertas se abren
tocándolas (el GM cualquiera; un jugador, la que tiene al lado, y en combate gasta una acción); las cerradas
con llave solo las abre el GM. El grupo comparte la visión: lo que cualquiera ve en línea de vista se ve claro,
lo explorado antes queda en penumbra y lo demás bajo la niebla (con bordes difuminados). **La sala filtra lo
que manda a cada jugador**: las criaturas que no se ven y los muros que todavía nadie descubrió no viajan.
El GM ve todo, puede mirar la niebla como la ven los jugadores, volver a cubrir lo explorado o apagarla.

**Luz y línea de vista:** el GM elige la luz del lugar (día, penumbra, oscuridad) y pone braseros; los tokens
llevan antorcha, linterna o vela (los jugadores la encienden desde su hoja). Los muros cortan la luz. Cada
personaje ve según sus sentidos: a oscuras no se ve sin darkvision; en penumbra, sin low-light vision, lo
demás queda **oculto** (chequeo plano CD 5); lo **escondido** o invisible pide CD 11 (al invisible el jugador
ni lo recibe). La sala no deja atacar ni lanzar contra alguien que no ves o detrás de algo sólido (una ventana
deja ver pero no pasar), y las áreas no atraviesan paredes. **Hide** tira Stealth contra la Perception más alta
de los enemigos que te ven (a plena luz necesitas una pared pegada); escondido, tu ataque toma desprevenido al
objetivo (−2 a su CA) y te delata; un Stride también.

1. ~~Escenas~~ (hecho: cada escena guarda su mapa, muros, luz, criaturas y dónde quedó cada personaje; el GM
   crea, copia, renombra y pasa de una a otra; con el **telón** bajo los jugadores no ven el tablero mientras la
   prepara, y al subirlo aparece el nombre de la escena. Las escenas guardadas nunca le llegan a un jugador).
2. Niebla, luz y línea de vista: hechas *(falta: visión por personaje en vez de compartida, Sneak y Seek
   contra lo escondido, y un pincel para revelar a mano en mapas con imagen)*.
3. ~~Chat de la mesa~~ (hecho: mensajes y tiradas en el mismo registro; susurros al GM o a otro personaje que
   solo ven quien lo manda, quien lo recibe y el GM; tiradas en secreto del GM que no le llegan a nadie más).
4. ~~Notas y handouts~~ (hecho: el GM prepara handouts con texto e imagen en Mesa → Handouts y los muestra a
   todos, a uno o a varios; a quien se lo muestran se le abre en la pantalla y queda en sus Notas para volver a
   verlo. Nadie recibe un handout que no le mostraron: la sala le manda su estado filtrado).

### Fase 6 — Contenido y fichas

1. ~~Importar de Pathbuilder 2e~~ (hecho: `reglas/pathbuilder.ts`. Se pega el JSON de "Export JSON" o se sube el
   archivo; los números salen de Pathbuilder y las dotes, conjuros y objetos se buscan por nombre en el compendio.
   Avisa lo que no cuadra, como un bono de daño que la mesa no suma. Pathbuilder no deja pedir el JSON desde un
   servidor, por eso no basta con el número de la exportación).
2. ~~Inventario~~ (hecho: `reglas/objetos.ts`. La mochila es la cuenta de verdad: cada consumible está ligado a su
   acción y usarlo descuenta de los dos; las pociones curan solas y las bombas son un Strike con Dex. El Bulk cuenta
   lo ligero de a 10 y las monedas de a 1000; pasar 5 + Str deja Encumbered (Clumsy 1 y −10 ft). Se compra en el
   compendio con las monedas de la ficha, con cambio, y se vende a mitad de precio).
3. ~~Compendio buscable~~ (hecho, con todo el contenido de Foundry; los textos quedan en inglés, como en los libros).
4. ~~Subida de nivel guiada~~ (hecha: `reglas/nivel.ts`, `reglas/sugerencias.ts`, `src/componentes/nivel/`).
   La progresión de cada clase sale de Foundry (niveles de dotes y de skills, rasgos de clase y las
   competencias que suben, leídas de su texto). La ventana muestra lo que llega solo, pide lo que hay que
   elegir (atributos, skill, dotes, conjuros) con sugerencias que dicen por qué (requisitos, su mejor
   skill, lo que combina con lo que ya usa, lo que al grupo le falta) y el antes → después de la ficha.

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

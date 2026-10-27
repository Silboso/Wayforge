# Wayforge — concepto

> La mesa de Pathfinder 2e que hace las cuentas por ti.

Un VTT ligero en el navegador, en tiempo real, pensado primero para nuestro grupo. Sirve igual
en mesa presencial (cada quien con su teléfono) que a distancia. Nace como respuesta a Foundry:
potente, pero se pierde uno fácil.

## Pilares

1. **Las reglas trabajan para ti.** La economía de 3 acciones, la penalización por ataque múltiple,
   los grados de éxito y las condiciones se calculan solos. Cada número explica de dónde sale.
2. **Tiempo real en cualquier dispositivo.** El GM ve el tablero completo; cada jugador ve en su
   teléfono su ficha, su turno y su token.
3. **Cero fricción.** Se entra con un link. Las fichas se importan de Pathbuilder 2e.
4. **Todo personalizable, con buenos valores por defecto.** Se puede jugar sin tocar ningún ajuste;
   quien quiera, cambia lo que quiera.

## Entrar a la mesa

1. El GM crea la partida y recibe dos códigos: el **de la mesa** (6 letras, `K7M2QX`) para compartir y
   el **de GM** (6 números) solo para él.
2. Cada jugador entra con el código de la mesa y ve la lista de personajes.
3. Elige el suyo y escribe su **código de personaje** (4 números, lo eligió al crear la ficha). Si no
   tiene, crea uno nuevo con el asistente de ficha.
4. Al salir se cierra la sesión de ese dispositivo: para volver se repiten los pasos 2 y 3. Mientras
   no salga, el dispositivo recuerda la sesión.

Los códigos se guardan con hash. Tras 5 códigos equivocados, ese personaje (o el GM) queda bloqueado
un minuto.

| Rol | Puede |
|---|---|
| GM | Todo: tokens, mapa, todas las fichas, tirar por cualquiera |
| Jugador | Mover su token, editar su ficha, tirar con ella; ve el tablero y las tiradas de todos |
| Visitante | Solo ver la lista de personajes para entrar |

## Combate

1. El GM marca quién pelea y la mesa tira la iniciativa (Perception) de todos. En un empate, los
   enemigos van primero.
2. Una barra sobre el tablero muestra el orden y de quién es el turno; su token tiene un anillo.
3. Quien tiene el turno ve sus **◆◆◆** y los gasta al actuar. Los ataques los gastan solos y la ficha
   marca cuál toca (1.º, 2.º o 3.º), con su penalización por ataque múltiple ya aplicada.
4. La **reacción** (⟲) es una por ronda; cada jugador marca la suya, también en el turno de otro.
5. Al **terminar el turno**: Frightened baja 1. Al empezar el siguiente, Slowed, Stunned y Quickened
   ajustan sus acciones y recupera su reacción.

**Objetivo:** tocar un token en el tablero lo vuelve el objetivo. El ataque se compara con su CA (con
sus condiciones) y la mesa dice el grado de éxito: crítico, éxito, fallo o pifia, con el 20 y el 1
naturales. Los jugadores ven el resultado pero no la CA de los enemigos.

**Enemigos:** el GM les pone CA, PG y Perception desde el token, y tira por ellos con la tirada libre
(`1d20+7`, "Goblin arquero"). Sus PG solo los ve el GM.

**Condiciones:** viven en el token, tanto de personajes como de enemigos. Las comunes ya cambian los
números: Frightened, Sickened, Clumsy, Enfeebled, Drained, Stupefied, Fatigued, Off-guard, Prone,
Grabbed, Restrained y Unconscious. De las penalizaciones de estado solo cuenta la peor, como en las
reglas. Cada condición tiene su explicación en español al tocarla.

## La hoja del jugador (estética de cuaderno)

La partida es un cuaderno cuadriculado: el tablero es la cuadrícula del papel y el personaje es una
página arrancada apoyada encima. Bolígrafo azul para lo propio, rojo para enemigos y restas,
marcatextos solo para "lo que toca ahora", post-its para las condiciones.

- **En PC:** el tablero ocupa la pantalla. Abajo está la página del jugador, que se puede bajar, con tres
  columnas: quién es y sus PG, sus acciones agrupadas, y los post-its con "Terminar turno". Las tiradas
  van como notas al margen.
- **En el teléfono:** la página es el mando, porque el tablero suele estar en la tele. "Terminar turno"
  está siempre a mano y abajo hay pestañas: Turno, Ficha, Tablero y Tiradas.
- **Teclado en PC:** Q W E R T abren las acciones del turno, Enter las usa y F termina el turno.
- **Cada acción, al tocarla,** muestra qué hace, cuánto cuesta, cómo se recupera y la cuenta del número.

### Aptitudes, separadas por cómo se recuperan

| Grupo | Qué es | Se recupera |
|---|---|---|
| Siempre | Acciones básicas (precargadas) y trucos (cantrips) | No se gastan |
| Foco | Conjuros de foco y algunas aptitudes de clase | Refocus (10 minutos): +1 punto |
| Conjuros | Conjuros con espacio, por rango | Descanso de 8 horas |
| Con límite | "Una vez por día / hora / 10 minutos / turno" | Al pasar su período |
| Objetos | Pociones, pergaminos, elixires | No vuelven: se acaban |
| Reacciones | Una por ronda, también en el turno de otros | Al empezar tu turno |
| Exploración | Actividades de minutos (Treat Wounds) | Fuera de combate |

Fuera de combate, la hoja ofrece descansar: Refocus o descanso de 8 horas. El descanso largo devuelve
espacios, foco y usos diarios, y cura Con × nivel PG.

## Avisos en el momento justo

Cada aptitud dice cuándo sirve, con estos momentos: antes de atacar, al acertar, al hacer crítico, al
fallar, cuando te atacan, cuando te aciertan, cuando un enemigo se mueve a tu lado, y al empezar o
terminar tu turno. La mesa avisa en ese momento:

- **Cuando te atacan y tienes una reacción para eso** (Nimble Dodge), la mesa pausa el ataque y
  pregunta "¿Reaccionas?", con 20 segundos para decidir. Si la usas, el ataque se tira con tu CA
  mejorada. El GM ve la espera y puede seguir sin ella.
- **Avisos que no frenan el juego:** "¡Le diste! Tira el daño", "Te acertó: puedes usar Shield
  Block", "El Goblin se movió a tu lado: Reactive Strike", "Te hace 7 de daño (Restar)", "¡Tu turno!"
  con lo que tienes que recordar.
- **Antes de atacar,** el detalle del Strike ofrece las alternativas (Power Attack, Sudden Charge).
- **El GM** recibe "Kyra le hace 9 de daño al Goblin (Restar)".

Un catálogo trae reacciones y dotes comunes listas para agregar. Raise a Shield deja el escudo
levantado (+2 CA) hasta tu próximo turno, que es lo que habilita Shield Block.

## Gráficos

- **Los dados ruedan** un instante (un d20 dibujado) antes de mostrar el resultado.
- **En el tablero:** un trazo de tinta va del atacante al objetivo, el impacto estalla y salta el
  resultado: "¡Le diste!", "¡Crítico!", "Falló" o el daño en rojo (−9).
- Todo respeta la preferencia de "reducir movimiento" del sistema.

## Para el jugador novato

- **"¿Qué puedo hacer?"**: en tu turno, tus opciones como botones grandes con su costo (◆, ◆◆) y una
  frase de para qué sirven.
- **Cada número es explicable**: tocar la CA 18 muestra `10 + 3 Dex + 4 entrenado + 1 armadura`.
- **Condiciones en lenguaje humano**: "Frightened 1 — −1 a casi todo; baja solo al final de tu turno".
- **Poca pantalla a la vez**: el jugador ve su turno, no cuarenta botones.

## Personalización

Principio de arquitectura: **lo personalizable son datos, no código.**

| Qué | Cómo |
|---|---|
| Tablero | Cualquier imagen como mapa; tamaño y desplazamiento de la cuadrícula ajustables |
| Enemigos, NPCs y personajes | Imagen propia para cada token, tamaño PF2e (Tiny…Gargantuan), color de borde |
| Tema | Colores y fuentes como variables CSS. Temas incluidos: **Taberna** (claro) y **Obsidiana** (oscuro) |
| Automatización | Por partida: Manual · Asistido (sugiere y confirmas) · Automático |
| Reglas de la casa | Variantes oficiales como interruptores (Free Archetype, Automatic Bonus Progression, Proficiency without Level) y contenido propio: condiciones, objetos, acciones |
| Interfaz | Paneles reordenables, diseño de ficha ajustable |

## Idioma

- Interfaz en **español**.
- Términos de reglas de PF2e en **inglés**: habilidades (Athletics, Stealth), y por ahora también
  condiciones y acciones (Frightened, Strike), con la explicación en español al tocarlos. El grupo
  viene de Foundry en inglés; se puede revisar.

## MVP — lo mínimo para jugar una sesión real

| Área | Incluye |
|---|---|
| Sala | Crear partida, link para unirse, roles GM / jugador |
| Tablero | Mapa con imagen propia, cuadrícula, tokens con imagen propia que se mueven sincronizados |
| Dados | Notación (`1d20+7`, `2d6+4`), tiradas en el servidor, registro compartido |
| Iniciativa | Tracker de turnos; el GM pasa turno y todos lo ven |
| Fichas | Importar de Pathbuilder: PG, CA, salvaciones, Perception, Strikes, skills |
| Combate | Pips de 3 acciones, MAP automático, grados de éxito contra la CA |
| Condiciones | Las comunes, con efecto y caducidad |

**Después:** niebla de guerra, conjuros automatizados, bestiario, constructor de personajes,
visión y luces.

## Arquitectura

Un solo Worker de Cloudflare sirve la web, la API y las salas.

```
src/          interfaz (React 19 + Vite, tablero con Konva)
worker/       Worker (Hono) + Durable Object `Sala`
compartido/   tipos del protocolo entre interfaz y sala
reglas/       motor PF2e en TypeScript puro, sin interfaz, con tests (vitest)
```

- **Una partida = un Durable Object `Sala`.** Todos se conectan a él por WebSocket (con
  hibernación: no cobra mientras nadie juega). Es la fuente de verdad: guarda el estado en su
  SQLite y tira los dados.
- **Workers KV** guarda las imágenes de mapas y tokens (gratis, sin activar nada). Si la cuenta activa
  **R2**, basta con agregar el bucket `IMAGENES` en `wrangler.jsonc` y el Worker lo usa en su lugar.
- **D1** (más adelante) para cuentas y lista de campañas.
- **El motor de reglas no conoce la interfaz.** Se prueba sin navegador.

## Licencia del contenido

Pathfinder 2e se usa bajo la licencia ORC. Nada de material con marca registrada de Paizo
(nombres de productos, logos) en la interfaz.

## Publicar

La mesa está en **https://wayforge.convoca.workers.dev**.

```
npm run deploy                                        # compila y sube el Worker
node scripts/demo.mjs https://wayforge.convoca.workers.dev   # una mesa de prueba en producción
```

La primera vez hizo falta: iniciar sesión con `npx wrangler login`, y crear el espacio de KV de las
imágenes (`npx wrangler kv namespace create IMAGENES_KV`, cuyo id va en `wrangler.jsonc`). Los Durable
Objects con SQLite no necesitan nada: se crean solos con la migración `v1`.

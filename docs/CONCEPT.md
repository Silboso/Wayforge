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
- **R2** guarda las imágenes de mapas y tokens.
- **D1** (más adelante) para cuentas y lista de campañas.
- **El motor de reglas no conoce la interfaz.** Se prueba sin navegador.

## Licencia del contenido

Pathfinder 2e se usa bajo la licencia ORC. Nada de material con marca registrada de Paizo
(nombres de productos, logos) en la interfaz.

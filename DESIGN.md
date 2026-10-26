---
name: Wayforge
description: Una mesa de Pathfinder 2e dibujada en un cuaderno cuadriculado de mazmorras.
colors:
  fondo: "#f8f9f5"
  superficie: "#fbfcfd"
  superficie-2: "#eef1f6"
  borde: "#c9d3e1"
  texto: "#33373e"
  texto-suave: "#646a74"
  acento: "#2450b0"
  acento-suave: "#5f7fc6"
  sobre-acento: "#ffffff"
  peligro: "#c8392b"
  exito: "#2e7d4a"
  marca: "#f7e14a"
  sobre-marca: "#33373e"
  postit: "#f8c9d6"
  tinta-postit: "#2b2a22"
  cinta: "rgba(246, 163, 189, 0.6)"
  cuadricula: "rgba(122, 156, 200, 0.32)"
  sombra: "rgba(40, 50, 70, 0.45)"
  fondo-noche: "#14171d"
  superficie-noche: "#1c2028"
  superficie-2-noche: "#252a34"
  borde-noche: "#343b48"
  texto-noche: "#dfe3ea"
  texto-suave-noche: "#9aa3b2"
  acento-noche: "#8fb0ff"
  acento-suave-noche: "#6c8bd6"
  sobre-acento-noche: "#10131a"
  peligro-noche: "#ff7f70"
  exito-noche: "#6fd296"
  marca-noche: "#e8d64a"
  sobre-marca-noche: "#14171d"
  postit-noche: "#d9a2b2"
  cinta-noche: "rgba(217, 154, 173, 0.45)"
  cuadricula-noche: "rgba(143, 176, 255, 0.13)"
  sombra-noche: "rgba(0, 0, 0, 0.6)"
typography:
  display:
    fontFamily: "'Shantell Sans', 'Comic Neue', cursive"
    fontSize: "38px"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "'Shantell Sans', 'Comic Neue', cursive"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
  title:
    fontFamily: "'Shantell Sans', 'Comic Neue', cursive"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
  row:
    fontFamily: "'Shantell Sans', 'Comic Neue', cursive"
    fontSize: "16px"
    fontWeight: 600
  number:
    fontFamily: "'Shantell Sans', 'Comic Neue', cursive"
    fontSize: "19px"
    fontWeight: 700
    fontFeature: "'tnum'"
  button:
    fontFamily: "'Shantell Sans', 'Comic Neue', cursive"
    fontSize: "17px"
    fontWeight: 700
  label:
    fontFamily: "'Shantell Sans', 'Comic Neue', cursive"
    fontSize: "14px"
    fontWeight: 400
  body:
    fontFamily: "'Atkinson Hyperlegible Next', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.375
    fontFeature: "'tnum'"
  body-small:
    fontFamily: "'Atkinson Hyperlegible Next', system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
rounded:
  sm: "2px"
  foto: "3px"
  tecla: "4px"
  pestana: "6px"
  lg: "8px"
  xl: "12px"
  boli: "10px 13px 9px 12px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  cuadricula: "24px"
  renglon: "30px"
components:
  boton-boli:
    backgroundColor: "{colors.acento}"
    textColor: "{colors.sobre-acento}"
    typography: "{typography.button}"
    rounded: "{rounded.boli}"
    height: "48px"
  boton-boli-contorno:
    textColor: "{colors.acento}"
    rounded: "{rounded.boli}"
    height: "48px"
  boton-boli-sin-acciones:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.texto-suave}"
    rounded: "{rounded.boli}"
    height: "48px"
  renglon-accion:
    typography: "{typography.row}"
    height: "44px"
    padding: "4px"
  renglon-accion-marcado:
    backgroundColor: "{colors.marca}"
    textColor: "{colors.sobre-marca}"
  postit-condicion:
    backgroundColor: "{colors.postit}"
    textColor: "{colors.tinta-postit}"
    padding: "10px 14px"
  hoja:
    backgroundColor: "{colors.superficie}"
  tarjeta-detalle:
    backgroundColor: "{colors.superficie}"
    padding: "14px 16px"
    width: "400px"
  cuenta:
    backgroundColor: "{colors.superficie-2}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  pestana-indice:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.pestana}"
    padding: "4px 10px 2px"
  tecla:
    textColor: "{colors.texto-suave}"
    rounded: "{rounded.tecla}"
    height: "20px"
  boton-control:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 12px"
  entrada:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.texto}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "0 12px"
---

# Design System: Wayforge

## Overview

**Creative North Star: "Cuaderno de mazmorras"**

The game is the table's graph-paper notebook. The board is the paper's own 24px blue grid, running edge to edge under the whole app, and the player's character is a torn-out page resting on top of it. Everything is written with the tools a player has at a real table: graphite pencil for strokes and secondary text, a blue ballpoint for what is yours and what you can touch, red for enemies and subtractions, a yellow highlighter for the one thing to do now, pink post-its for conditions, adhesive tape and a taped-on photo. Strokes carry a slight tremor; sheets sit a fraction of a degree off square.

Density is that of a well-kept notebook page: lists as ruled lines with dashed separators, numbers big and handwritten, explanations small and readable. The world explicitly rejects the dark, paneled HUD of virtual tabletops: there are no boxed dashboards floating over the map, only paper resting on paper. Two themes carry the same notebook: **Cuaderno** (light, cold white paper, blue grid) and **Noche** (the same notebook with a black cover and gel ink, for low light). A theme is only a block of custom properties on `:root[data-tema]`; the board reads the same variables at runtime.

The interface speaks Spanish; Pathfinder 2e rule terms stay in English (Frightened, Strike, Ray of Frost) beside the Spanish name, so players can match them to the rulebook.

**Key Characteristics:**
- 24px blue graph grid under everything, the board included; it is the world's material, not decoration.
- Hand-drawn SVG and canvas strokes for rules, frames, rhombs and token rims.
- Three inks with fixed meanings (blue ballpoint, red, graphite) plus one highlighter reserved for "what to do now".
- Handwritten Shantell Sans for titles and numbers, Atkinson Hyperlegible Next for reading text.
- Depth from paper resting on paper: long soft shadows, tape, small rotations.

## Colors

A cold paper-and-ink palette: near-white paper, blue grid, three inks and two stationery colors, mirrored into a dark gel-ink notebook for Noche.

### Primary
- **Bolígrafo Azul** (acento): the player's own things and everything touchable. Character name, own stat values, action costs (rhombs), row totals, the Total line of a Cuenta, primary buttons, focus ring, caret, own token rims and the dashed selection ring on the board. In Noche it brightens to a gel-ink periwinkle (acento-noche).
- **Azul Lavado** (acento-suave): quiet links such as "ver todas".

### Secondary
- **Tinta Roja** (peligro): enemies and subtractions. Enemy names in the initiative order, enemy token rims, the dashed line from you to your target, negative lines in a Cuenta ("Frightened 1 −1"), exhausted-resource text, a failed roll, the disconnected dot, and the last fifth of a PG bar.

### Tertiary
- **Marcatextos Amarillo** (marca, with sobre-marca text): the highlighter. Reserved for what to do now (see the Highlighter Rule).
- **Post-it Rosa** (postit, with tinta-postit text): conditions, wherever they appear: the sheet's side column, the phone header, the label stuck to a token on the board.
- **Cinta** (cinta): translucent pink adhesive tape holding the portrait photo.
- **Verde de Acierto** (exito): connected dot and successful-roll text.

### Neutral
- **Papel** (fondo): the notebook page behind everything, and the board when no map image is loaded.
- **Hoja** (superficie): torn-out sheet, cards, token fill.
- **Hoja Sombreada** (superficie-2): the Cuenta box, disabled ballpoint buttons, hover wash on plain controls.
- **Línea de Cuadrícula** (cuadricula): the 24px grid and, at 70%, the sheet's 30px ruled lines.
- **Grafito** (texto): body text, hand-drawn rules and frames, strike-through on unaffordable actions.
- **Grafito Suave** (texto-suave): secondary text, English rule subtitles, done initiative entries, empty rhombs, key caps.
- **Borde** (borde): dashed row separators, column dividers, control borders, scrollbar thumb.
- **Sombra** (sombra): the only shadow tint; every paper shadow is built from it.

### Named Rules
**The Highlighter Rule.** Yellow highlighter (marca) marks only what to do now: "¡Tu turno!", the current entry in the initiative order, the probable action row, the blot under the token whose turn it is, and the reach of your Stride on the board. It never marks selection, an active tab, a hover or decoration. (Native text selection uses it because selecting text is highlighting.)

**The Three Inks Rule.** Blue ballpoint is yours and touchable; red is enemies and anything that subtracts; graphite is everything secondary or already done. An ink never borrows another's meaning.

**The Pink Post-it Rule.** A condition is always a pink post-it with its short explanation in handwriting, rotated about 2°. Pink is chosen so it can never be confused with the highlighter.

## Typography

**Display Font:** Shantell Sans (with Comic Neue, cursive), weights 400 / 600 / 700
**Body Font:** Atkinson Hyperlegible Next (with system-ui, sans-serif), weights 400 / 500 / 700

**Character:** A legible handwritten face writes the page (titles, names, numbers, tabs, buttons), while a hyperlegible sans carries anything you read to understand a rule. Numbers are tabular everywhere (`font-variant-numeric: tabular-nums` on body).

### Hierarchy
- **Display** (700, 38px, line-height 1): current PG on the sheet.
- **Headline** (700, 30px, line-height 1; 25px on phone): character name in blue.
- **Title** (700, 22px, 1.25): the open action card's name; turn header at 21px semibold (19px on phone); section titles on phone at 18px.
- **Row** (600, 16px): action names in ruled lists.
- **Number** (700, 19px): row values; stat values at 20px; roll totals in the margin at 28px.
- **Button** (700, 17px): ballpoint buttons; outline buttons at 15px semibold.
- **Label** (400, 14px; 12px to 13px for small captions): tabs, "te queda 1", stat abbreviations, trait chips, condition text.
- **Body** (Atkinson 400, 14px, 1.375): action descriptions and guidance.
- **Body small** (Atkinson 400, 12.5px to 13px): the English rule term and detail after an action name, help text, damage line.

### Named Rules
**The Handwriting-for-Numbers Rule.** Titles and every number a player reads at a glance are handwritten in Shantell Sans; paragraphs that explain a rule are in Atkinson Hyperlegible Next. Never set a description in Shantell or a key number in Atkinson.

**The Two Languages Rule.** The Spanish name leads in handwriting; the PF2e term follows in English, smaller and in graphite Atkinson ("Cubrirte · Take Cover"). Rule terms are never translated away.

## Layout

The page background is the 24px graph grid (`linear-gradient` lines, 1px, cuadricula tint) on fondo. Without a map image, the Konva board draws the same grid to the screen edges, so the board and the page are one sheet of paper. This grid is intentional and pinned to the world; it is not a decorative pattern to remove.

**Desktop (1024px and up):** the board fills the viewport below a dashed-rule header. The initiative order is written on a strip centered at the top of the board (rotated −0.6°). The last three rolls sit as margin notes at the right (260px wide). The player's sheet rests at the bottom, inset 20px, in three columns (290px / flexible / 250px; 310px / flexible / 270px from 1280px): who and PG, actions grouped by how they recover, then post-its and the big action. The sheet folds down to a 56px tab ("Bajar la hoja" / "Mostrar mi hoja"). An opened action becomes a 400px card floating above the sheet's right side. The full sheet and roll history open in a 440px drawer from the right.

**Phone (below 1024px):** the sheet is the controller. A torn-sheet header (12px side inset) carries photo, name, PG bar, turn state and post-its; sections stack as ruled lists below; the opened action expands inline as a card; the big action ("Terminar turno" or the rests) is fixed above a four-tab bottom bar (Turno, Ficha, Tablero, Tiradas) that respects the safe area.

**Rhythm:** 4px steps (4, 8, 12, 16, 20). Ruled rows are at least 44px tall for touch and tighten to 34px on fine pointers. The sheet's own lines are 30px apart.

## Elevation & Depth

Depth is paper resting on paper. Every shadow is soft, long and negatively spread, tinted with the sombra token, so a sheet seems to lift a few millimeters off the notebook rather than float. There are no hard offset shadows and no glows except the ballpoint button's own blue ink bleed. Tape, rotation and the perforated top edge of the sheet do as much depth work as shadows.

### Shadow Vocabulary
- **Hoja** (`box-shadow: 0 22px 40px -18px var(--sombra), 0 1px 2px color-mix(in srgb, var(--sombra) 30%, transparent)`): the torn-out character sheet.
- **Tarjeta** (`box-shadow: 0 16px 32px -16px var(--sombra), 0 1px 2px color-mix(in srgb, var(--sombra) 30%, transparent)`): the open action card.
- **Post-it** (`box-shadow: 0 8px 16px -8px var(--sombra)`): condition notes.
- **Foto pegada** (`box-shadow: 0 5px 12px -4px var(--sombra)`): the taped portrait.
- **Tira de iniciativa** (`box-shadow: 0 6px 16px -10px var(--sombra)`): the initiative strip on the board.
- **Tinta de bolígrafo** (`box-shadow: 0 6px 12px -6px var(--acento)`): primary ballpoint buttons only.
- **Cajón** (`box-shadow: -20px 0 40px -20px var(--sombra)`): the right drawer.

### Named Rules
**The Paper-on-Paper Rule.** Anything that sits above the notebook is a piece of paper: it gets a sombra shadow, may be taped, and may sit up to 3° off square. Nothing is a floating panel.

## Shapes

Lines are drawn, not ruled by a machine. Totals and tab baselines use a hand-drawn SVG stroke with a slight wave (RayaAMano); the PG bar's frame is an SVG path whose corners do not quite close; action-cost rhombs are hand-drawn, slightly crooked SVG diamonds; tokens on the board are circles drawn with a seeded tremor and an overshooting close. Lists separate with dashed lines; columns of the sheet with dashed vertical rules.

Corners are small and uneven. Ballpoint buttons use a deliberately irregular radius (10px 13px 9px 12px). Paper pieces (sheet, card, post-it) have square corners; the Cuenta box and trait chips 2px; the photo 3px; key caps 4px; index tabs 6px on top only. Plain controls use 8px and plain panels 12px. Small rotations are part of the form: photo −3°, tape −8°, sheet −0.3°, card +0.5°, post-its alternating +2° and −1.5°, initiative strip −0.6°.

### Named Rules
**The Hand-Drawn Rule.** Rules, frames, rhombs and token rims are SVG or canvas strokes with a tremor. A straight CSS border is reserved for dashed list separators and plain controls.

## Components

### Buttons
Ballpoint buttons: tactile ink on paper.
- **Shape:** irregular hand-drawn radius (10px 13px 9px 12px), 48px tall in the action card and the sticky phone bar, 44px for rests.
- **Primary (boli):** acento fill, sobre-acento handwritten label (Shantell 700, 17px), blue ink-bleed shadow. "Terminar turno" adds a −1° tilt and its key cap (F).
- **Outline:** 2px acento border, acento label (Shantell 600, 15px); hover washes acento at 10%.
- **Pressed:** scale to 0.97.
- **Can't pay:** superficie-2 fill, graphite label, no shadow, and the label says what is missing ("Te falta 1 acción", "No te quedan usos").
- **Plain controls (shared):** 40px, 8px radius, borde border, superficie fill, hover superficie-2; icon buttons 36px in graphite. Used for header, forms and utilities, never for game actions.

### Action rows (renglones)
- Ruled lines with a dashed borde bottom; grid of cost / name + detail / value (+ key cap on desktop "Tu turno").
- Cost in blue hand-drawn rhombs; name in Shantell 600 16px; English term and recovery state in Atkinson 12.5px graphite; value in blue Shantell 700 19px.
- The probable action's name carries the highlighter. Hover washes acento at 6%; the open row at 8%.
- **Unaffordable:** name and value at 55% opacity, name struck through (2px, texto), rhombs hollow and crossed out.

### Index tabs (pestañas)
- One tab per recovery group (Tu turno, Siempre, Foco, Conjuros, Con límite, Objetos, Reacciones, Exploración), each with its count in small graphite.
- Active tab: superficie fill, 1.5px graphite outline open at the bottom, bold. Inactive: graphite text, no box. They stand on a hand-drawn baseline.

### Post-it de condición
- Pink paper (postit), dark ink (tinta-postit), Shantell 17px bold name with its value, 13px explanation with "X" replaced by the real value, rotated about 2°.
- Compact form: name only at 13px, explanation in the tooltip. On the board: a pink label stuck at the token's upper right, rotated 4°.

### Hoja (character sheet)
- Torn-out page: superficie with faint 30px ruled lines, a perforated top edge drawn with a repeating radial gradient, the Hoja shadow, −0.3° tilt.
- Holds the taped photo (72px, 4px white border, pink tape), the PG count and bar, and the stat strip (CA in blue as a fixed value; Fort, Ref, Will, Perc as touchable rolls).

### Tarjeta de detalle and Cuenta
- The open action as a card: title, English term, description, trait chips (2px radius, graphite outline, lowercase), target line with crosshair, the Cuenta, then the buttons.
- **Cuenta:** the written sum in Shantell 14.5px: each part on its own line, subtractions in red, a hand-drawn rule, then the Total ("Tiras 1d20") in blue bold 17px.

### Barra PG
- A pencil-hatched bar (−55° stripes, 2.5px on 6px) inside a hand-drawn frame, never a solid game bar. Hatching is green above half, amber above a fifth, then red. Temporary PG show as a blue wash at the right end. Width animates 500ms ease-out.

### Navigation
- Header: dashed bottom rule on fondo, "Wayforge" in blue Shantell 22px rotated −2°, table code in graphite, connection dot.
- Initiative order: names written in a row; done entries struck through in graphite, the current one highlighted, enemies in red, initiative values small after each name.
- Phone tab bar: four icon + Shantell 12.5px labels; current one blue and bold.

### Tablero (board)
- Konva canvas reading the theme's variables. Tokens are hand-drawn circles on superficie fill, rim in their ink (blue for characters, red for enemies), initial in Shantell. The current-turn token sits on a highlighter blot; the selected token gets a dashed blue hand-drawn ring.
- Your Stride reach is a highlighter wash with a dotted highlighter edge and a handwritten "hasta aquí: 25 ft"; on dark paper the wash is lightened. The line to your target is dashed red.

### Tecla (key cap)
- A pencil box (1.3px graphite outline at 50%, 4px radius, 20px tall, Shantell 11px). On a ballpoint button it turns sobre-acento.

## Do's and Don'ts

### Do:
- **Do** keep the 24px grid under the whole app and let the board be the same paper when there is no map image.
- **Do** reserve the highlighter (marca) for what to do now: your turn, the current initiative entry, the probable action, the current token and your reach.
- **Do** write conditions as pink post-its with their explanation, in every place they appear.
- **Do** use blue ballpoint (acento) for your own things and anything touchable, and red (peligro) for enemies and subtractions.
- **Do** draw rules, frames and token rims by hand (SVG or canvas with a tremor) and tilt paper pieces by a degree or two.
- **Do** dim, strike through and cross out the rhombs of any action the player can't pay for, and let its button say what is missing.
- **Do** set titles and numbers in Shantell Sans and reading text in Atkinson Hyperlegible Next.
- **Do** write the UI in Spanish and keep PF2e rule terms in English beside it.
- **Do** add new themes as a single block of custom properties; the board reads the same variables.

### Don't:
- **Don't** build the dark paneled HUD of virtual tabletops; paper rests on paper.
- **Don't** use the highlighter yellow for selection states, active tabs, tape or decoration.
- **Don't** make conditions yellow, or anything other than a pink post-it.
- **Don't** render PG as a solid, glossy game bar; it is pencil hatching in a hand-drawn frame.
- **Don't** use hard offset shadows or colored glows; the only colored shadow is the ballpoint button's ink.
- **Don't** offer a game action the player can't pay for as if it were available.
- **Don't** translate PF2e rule terms away or set a rule explanation in handwriting.

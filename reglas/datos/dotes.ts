import type { Aptitud } from '../aptitudes';
import type { Dote, TipoDote } from './tipos';

// Dotes de nivel 1 del Player Core (remaster): de habilidad, generales, de ascendencia y de clase. Licencia ORC.
// Las que se usan en la mesa traen su aptitud: así aparecen en la hoja con su costo y su aviso.

const d = (id: string, nombre: string, tipo: TipoDote, descripcion: string, extra: Partial<Dote> = {}): Dote =>
  ({ id, nombre, nivel: 1, tipo, rasgos: [], descripcion, ...extra });

// Una aptitud de dote: la que se agrega a la ficha
const usa = (verbo: string, costo: Aptitud['costo'], descripcion: string, extra: Partial<Aptitud> = {}): Omit<Aptitud, 'id'> =>
  ({ nombre: '', verbo, categoria: 'dote', costo, recuperacion: { tipo: 'siempre' }, descripcion, rasgos: [], ...extra });

export const DOTES_HABILIDAD: Dote[] = [
  d('assurance-athletics', 'Assurance (Athletics)', 'habilidad', 'En Athletics puedes no tirar: sacas 10 + tu competencia, sin modificadores. Ideal para lo que no puede fallar.'),
  d('assurance-survival', 'Assurance (Survival)', 'habilidad', 'En Survival puedes no tirar: sacas 10 + tu competencia, sin modificadores.'),
  d('assurance-arcana', 'Assurance (Arcana)', 'habilidad', 'En Arcana puedes no tirar: sacas 10 + tu competencia, sin modificadores.'),
  d('bargain-hunter', 'Bargain Hunter', 'habilidad', 'Con Diplomacy consigues mejores precios, y empiezas con 2 po extra.'),
  d('battle-medicine', 'Battle Medicine', 'habilidad', 'Curas en pleno combate con Medicine contra CD 15: con éxito recupera 2d8 PG (más con crítico). Cada criatura, una vez al día.', {
    aptitud: usa('Curar en combate', 1, 'Tiras Medicine (CD 15) para curar a un aliado a tu lado: éxito 2d8, crítico 4d8, pifia le haces 1d8 de daño. Una vez al día por criatura.', { rasgos: ['healing', 'manipulate'], tirada: { tipo: 'skill', clave: 'medicine' } }),
    requisitos: 'trained en Medicine',
  }),
  d('cat-fall', 'Cat Fall', 'habilidad', 'Caes como un gato: trata las caídas como 10 ft más cortas.'),
  d('charming-liar', 'Charming Liar', 'habilidad', 'Si tu mentira es un crítico, la persona te tiene más simpatía.'),
  d('courtly-graces', 'Courtly Graces', 'habilidad', 'Usas Society para hacerte pasar por noble y para causar buena impresión en la corte.'),
  d('dubious-knowledge', 'Dubious Knowledge', 'habilidad', 'Cuando fallas un Recall Knowledge, igual recuerdas una verdad y una mentira (sin saber cuál es cuál).'),
  d('experienced-smuggler', 'Experienced Smuggler', 'habilidad', 'Esconder objetos pequeños se te da natural: nunca sacas menos de 10 en el dado al hacerlo.'),
  d('experienced-tracker', 'Experienced Tracker', 'habilidad', 'Sigues rastros a tu velocidad completa, sin penalización.'),
  d('fascinating-performance', 'Fascinating Performance', 'habilidad', 'Con una actuación, dejas Fascinated a quien te mira.'),
  d('forager', 'Forager', 'habilidad', 'Al buscar comida en la naturaleza, nunca fallas del todo y alimentas a más gente.'),
  d('group-impression', 'Group Impression', 'habilidad', 'Make an Impression funciona con varias personas a la vez.'),
  d('hefty-hauler', 'Hefty Hauler', 'habilidad', 'Cargas 2 de Bulk más antes de quedar Encumbered.'),
  d('hobnobber', 'Hobnobber', 'habilidad', 'Reúnes información (Gather Information) en la mitad del tiempo.'),
  d('impressive-performance', 'Impressive Performance', 'habilidad', 'Usas Performance para causar buena impresión (Make an Impression).'),
  d('intimidating-glare', 'Intimidating Glare', 'habilidad', 'Asustas con la mirada: Demoralize sin hablar, y no importa si no te entienden.'),
  d('lie-to-me', 'Lie to Me', 'habilidad', 'Usas Deception para detectar mentiras en una conversación.'),
  d('multilingual', 'Multilingual', 'habilidad', 'Aprendes dos idiomas más.'),
  d('natural-medicine', 'Natural Medicine', 'habilidad', 'Usas Nature en lugar de Medicine para curar heridas (Treat Wounds).'),
  d('oddity-identification', 'Oddity Identification', 'habilidad', '+2 para identificar magia mental, de adivinación o de fortuna.'),
  d('pickpocket', 'Pickpocket', 'habilidad', 'Robas objetos que alguien está vigilando, sin penalización.'),
  d('quick-coercion', 'Quick Coercion', 'habilidad', 'Coaccionas a alguien en un minuto en lugar de diez.'),
  d('specialty-crafting', 'Specialty Crafting', 'habilidad', '+1 al fabricar objetos de tu especialidad (+2 con Master).'),
  d('steady-balance', 'Steady Balance', 'habilidad', 'Al mantener el equilibrio, los éxitos son críticos y no quedas Off-guard.'),
  d('streetwise', 'Streetwise', 'habilidad', 'Usas Society para reunir información, y ya conoces los rumores de tu ciudad.'),
  d('student-of-the-canon', 'Student of the Canon', 'habilidad', 'Sabes mucho de religiones: al recordar sobre ellas nunca te equivocas del todo.'),
  d('survey-wildlife', 'Survey Wildlife', 'habilidad', 'Observando 10 minutos la zona, sabes qué criaturas viven allí.'),
  d('terrain-expertise', 'Terrain Expertise', 'habilidad', '+1 a Survival en un tipo de terreno (bajo tierra, bosque…).'),
  d('train-animal', 'Train Animal', 'habilidad', 'Enseñas un truco a un animal durante una semana.'),
  d('underwater-marauder', 'Underwater Marauder', 'habilidad', 'Bajo el agua no quedas Off-guard y no tienes penalización con armas cortantes ni contundentes.'),
];

export const DOTES_GENERALES: Dote[] = [
  d('armor-proficiency', 'Armor Proficiency', 'general', 'Ganas competencia (Trained) con la siguiente categoría de armadura.'),
  d('canny-acumen', 'Canny Acumen', 'general', 'Una salvación o Perception sube a Expert.'),
  d('diehard', 'Diehard', 'general', 'Mueres con Dying 5 en lugar de Dying 4.'),
  d('fast-recovery', 'Fast Recovery', 'general', 'Recuperas el doble de PG al descansar y te curas antes de venenos y enfermedades.'),
  d('feather-step', 'Feather Step', 'general', 'Puedes dar un Step en terreno difícil.'),
  d('fleet', 'Fleet', 'general', '+5 ft a tu Velocidad.'),
  d('incredible-initiative', 'Incredible Initiative', 'general', '+2 a tus tiradas de iniciativa.'),
  d('shield-block', 'Shield Block', 'general', 'Con el escudo levantado, bloqueas daño físico con tu reacción.', {
    aptitud: usa('Bloquear con el escudo', 'reaccion', 'Con el escudo levantado, cuando un ataque te iba a hacer daño físico: el escudo absorbe tanto daño como su Dureza (Hardness). El resto se reparte entre tú y el escudo.', { disparadores: ['te-golpean'], requiere: 'shield-raised' }),
  }),
  d('toughness', 'Toughness', 'general', 'Ganas tantos PG máximos como tu nivel, y te recuperas mejor de Dying.'),
  d('weapon-proficiency', 'Weapon Proficiency', 'general', 'Trained con todas las armas marciales (o una avanzada si ya las tienes).'),
];

export const DOTES_ASCENDENCIA: Dote[] = [
  // Dwarf
  d('dwarven-doughtiness', 'Dwarven Doughtiness', 'ascendencia', 'Tozudo hasta el final: Frightened te baja 2 al terminar el turno en lugar de 1.', { de: 'dwarf' }),
  d('dwarven-lore', 'Dwarven Lore', 'ascendencia', 'Trained en Crafting y Religion, y en Dwarven Lore.', { de: 'dwarf' }),
  d('dwarven-weapon-familiarity', 'Dwarven Weapon Familiarity', 'ascendencia', 'Trained con battle axe, pick y warhammer; las armas enanas cuentan como una categoría menos.', { de: 'dwarf' }),
  d('rock-runner', 'Rock Runner', 'ascendencia', 'Los suelos de piedra irregular no son terreno difícil para ti.', { de: 'dwarf' }),
  d('stonemasons-eye', "Stonemason's Eye", 'ascendencia', 'Notas trabajos de piedra raros y trampas en ellos sin buscarlos.', { de: 'dwarf' }),
  d('unburdened-iron', 'Unburdened Iron', 'ascendencia', 'La armadura pesada no te frena: ignoras la reducción de Velocidad.', { de: 'dwarf' }),
  // Elf
  d('ancestral-longevity', 'Ancestral Longevity', 'ascendencia', 'Cada día eliges una skill en la que quedas Trained.', { de: 'elf' }),
  d('elven-lore', 'Elven Lore', 'ascendencia', 'Trained en Arcana y Nature, y en Elven Lore.', { de: 'elf' }),
  d('elven-weapon-familiarity', 'Elven Weapon Familiarity', 'ascendencia', 'Trained con longbow, composite longbow, rapier, shortbow y composite shortbow.', { de: 'elf' }),
  d('forlorn', 'Forlorn', 'ascendencia', '+1 contra efectos de emoción; tus éxitos contra ellos son críticos.', { de: 'elf' }),
  d('nimble-elf', 'Nimble Elf', 'ascendencia', '+5 ft a tu Velocidad.', { de: 'elf' }),
  d('otherworldly-magic', 'Otherworldly Magic', 'ascendencia', 'Un truco arcano como conjuro innato.', { de: 'elf' }),
  // Gnome
  d('animal-accomplice', 'Animal Accomplice', 'ascendencia', 'Ganas un familiar animal.', { de: 'gnome' }),
  d('fey-fellowship', 'Fey Fellowship', 'ascendencia', '+2 a Perception y salvaciones contra hadas.', { de: 'gnome' }),
  d('first-world-magic', 'First World Magic', 'ascendencia', 'Un truco primal como conjuro innato.', { de: 'gnome' }),
  d('gnome-obsession', 'Gnome Obsession', 'ascendencia', 'Trained en un Lore que te obsesiona; sube contigo.', { de: 'gnome' }),
  d('illusion-sense', 'Illusion Sense', 'ascendencia', '+1 para descubrir ilusiones, y las notas sin buscarlas.', { de: 'gnome' }),
  // Goblin
  d('burn-it', 'Burn It!', 'ascendencia', 'Tu fuego quema más: +1 de daño de fuego por dado en conjuros y alquimia, y el fuego persistente sube.', { de: 'goblin' }),
  d('city-scavenger', 'City Scavenger', 'ascendencia', '+1 a reunir información y a vivir de la ciudad.', { de: 'goblin' }),
  d('goblin-scuttle', 'Goblin Scuttle', 'ascendencia', 'Cuando un aliado acaba al lado tuyo, das un Step como reacción.', {
    de: 'goblin',
    aptitud: usa('Escabullirse', 'reaccion', 'Un aliado terminó de moverse a tu lado: das un Step (5 ft) sin provocar reacciones.'),
  }),
  d('goblin-song', 'Goblin Song', 'ascendencia', 'Cantas para distraer: Performance contra la Will de un enemigo a 30 ft; con éxito, −1 a su Perception y Will.', {
    de: 'goblin',
    aptitud: usa('Canción goblin', 1, 'Tiras Performance contra la Will DC de un enemigo a 30 ft: con éxito tiene −1 a Perception y Will por 1 ronda (1 minuto con crítico).', { rasgos: ['auditory', 'concentrate'], tirada: { tipo: 'skill', clave: 'performance' }, distancia: 30 }),
  }),
  d('goblin-weapon-familiarity', 'Goblin Weapon Familiarity', 'ascendencia', 'Trained con dogslicer y horsechopper.', { de: 'goblin' }),
  d('very-sneaky', 'Very Sneaky', 'ascendencia', 'Te mueves 5 ft más al Sneak y puedes seguir escondido al final del turno.', { de: 'goblin' }),
  // Halfling
  d('distracting-shadows', 'Distracting Shadows', 'ascendencia', 'Te escondes detrás de criaturas más grandes como si fueran cobertura.', { de: 'halfling' }),
  d('halfling-luck', 'Halfling Luck', 'ascendencia', 'Una vez al día, repites una tirada fallida y te quedas con la nueva.', {
    de: 'halfling',
    aptitud: { ...usa('Suerte halfling', 'libre', 'Una vez al día, después de fallar una tirada de skill o Perception, la repites y te quedas con el segundo resultado.'), recuperacion: { tipo: 'frecuencia', veces: 1, periodo: 'dia' }, disparadores: ['al-fallar'] },
  }),
  d('halfling-lore', 'Halfling Lore', 'ascendencia', 'Trained en Acrobatics y Stealth, y en Halfling Lore.', { de: 'halfling' }),
  d('halfling-weapon-familiarity', 'Halfling Weapon Familiarity', 'ascendencia', 'Trained con sling, halfling sling staff y shortsword.', { de: 'halfling' }),
  d('sure-feet', 'Sure Feet', 'ascendencia', 'Al mantener el equilibrio o trepar, los éxitos son críticos y no quedas Off-guard.', { de: 'halfling' }),
  // Human
  d('adapted-cantrip', 'Adapted Cantrip', 'ascendencia', 'Un truco de otra tradición entra en tu lista de conjuros.', { de: 'human' }),
  d('cooperative-nature', 'Cooperative Nature', 'ascendencia', '+4 cuando ayudas (Aid) a un aliado.', { de: 'human' }),
  d('general-training', 'General Training', 'ascendencia', 'Una dote general de nivel 1 extra.', { de: 'human' }),
  d('haughty-obstinacy', 'Haughty Obstinacy', 'ascendencia', 'Resistes que te controlen: tus éxitos contra efectos mentales que te obligan son críticos.', { de: 'human' }),
  d('natural-ambition', 'Natural Ambition', 'ascendencia', 'Una dote de clase de nivel 1 extra.', { de: 'human' }),
  d('natural-skill', 'Natural Skill', 'ascendencia', 'Dos skills más en Trained.', { de: 'human' }),
  // Leshy
  d('harmlessly-cute', 'Harmlessly Cute', 'ascendencia', '+1 a Deception para parecer inofensivo e iniciativa con Deception.', { de: 'leshy' }),
  d('leshy-lore', 'Leshy Lore', 'ascendencia', 'Trained en Nature y Stealth, y en Leshy Lore.', { de: 'leshy' }),
  d('seedpod', 'Seedpod', 'ascendencia', 'Lanzas una vaina de semillas (1d4, a 30 ft) que deja al objetivo más lento.', { de: 'leshy' }),
  // Orc
  d('beast-trainer', 'Beast Trainer', 'ascendencia', 'Trained en Nature y Train Animal; los animales te respetan.', { de: 'orc' }),
  d('iron-fists', 'Iron Fists', 'ascendencia', 'Tus puños hacen más daño y no son no-letales a la fuerza.', { de: 'orc' }),
  d('orc-ferocity', 'Orc Ferocity', 'ascendencia', 'Una vez al día, al caer a 0 PG, te quedas con 1 PG.', {
    de: 'orc',
    aptitud: { ...usa('Ferocidad orca', 'reaccion', 'Una vez al día, cuando ibas a caer a 0 PG, te quedas en 1 PG y ganas Wounded 1.'), recuperacion: { tipo: 'frecuencia', veces: 1, periodo: 'dia' }, disparadores: ['te-golpean'] },
  }),
  d('orc-superstition', 'Orc Superstition', 'ascendencia', 'Te concentras contra la magia: +1 a una salvación contra un conjuro.', { de: 'orc' }),
  d('orc-weapon-familiarity', 'Orc Weapon Familiarity', 'ascendencia', 'Trained con falchion y greataxe; armas orcas una categoría menos.', { de: 'orc' }),
  d('tusks', 'Tusks', 'ascendencia', 'Tus colmillos son un ataque sin armas: 1d6 piercing.', { de: 'orc' }),
];

export const DOTES_CLASE: Dote[] = [
  // Fighter
  d('double-slice', 'Double Slice', 'clase', 'Dos Strikes con un arma en cada mano; si los dos aciertan, el daño se suma.', {
    de: 'fighter', aptitud: usa('Doble tajo', 2, 'Con un arma en cada mano, haces dos Strikes al mismo enemigo con la penalización actual; si los dos aciertan, el daño se suma.', { tirada: { tipo: 'golpe' }, disparadores: ['al-atacar'] }),
  }),
  d('exacting-strike', 'Exacting Strike', 'clase', 'Un Strike que, si falla, no cuenta para la penalización del siguiente.', {
    de: 'fighter', aptitud: usa('Golpe preciso', 1, 'Un Strike: si falla, no cuenta para la penalización por ataque múltiple.', { rasgos: ['press'], tirada: { tipo: 'golpe' }, disparadores: ['al-atacar'] }),
  }),
  d('point-blank-stance', 'Point Blank Stance', 'clase', 'Postura: con armas a distancia, sin penalización por estar cerca y +2 de daño en el primer incremento.', { de: 'fighter' }),
  d('reactive-shield', 'Reactive Shield', 'clase', 'Levantas el escudo como reacción cuando te van a golpear.', {
    de: 'fighter', aptitud: { ...usa('Escudo reactivo', 'reaccion', 'Cuando un enemigo te ataca cuerpo a cuerpo, levantas el escudo: +2 a tu CA contra ese ataque.'), disparadores: ['te-apuntan'], efecto: { bonoCA: 2 } },
  }),
  d('snagging-strike', 'Snagging Strike', 'clase', 'Con una mano libre, un Strike que deja Off-guard al enemigo hasta tu próximo turno.', {
    de: 'fighter', aptitud: usa('Golpe enganchador', 1, 'Con una mano libre: un Strike; si acierta, el objetivo queda Off-guard hasta el inicio de tu próximo turno.', { tirada: { tipo: 'golpe' }, disparadores: ['al-atacar'] }),
  }),
  d('sudden-charge', 'Sudden Charge', 'clase', 'Te mueves dos veces tu Velocidad y haces un Strike al llegar.', {
    de: 'fighter', aptitud: usa('Carga repentina', 2, 'Te mueves dos veces tu Velocidad y, si terminas al lado de un enemigo, le haces un Strike cuerpo a cuerpo.', { tirada: { tipo: 'golpe' }, disparadores: ['al-atacar'] }),
  }),
  d('vicious-swing', 'Vicious Swing', 'clase', 'Un Strike cuerpo a cuerpo con un dado de daño extra; cuenta como dos ataques.', {
    de: 'fighter', aptitud: usa('Golpe brutal', 2, 'Un Strike cuerpo a cuerpo con un dado de daño extra. Cuenta como dos ataques para la penalización de los siguientes.', { rasgos: ['flourish'], tirada: { tipo: 'golpe' }, disparadores: ['al-atacar'] }),
  }),
  // Barbarian
  d('acute-vision', 'Acute Vision', 'clase', 'Mientras estás en furia, ves en la oscuridad.', { de: 'barbarian' }),
  d('adrenaline-rush', 'Adrenaline Rush', 'clase', 'En furia cargas más y tienes +1 a Athletics para levantar o romper cosas.', { de: 'barbarian' }),
  d('moment-of-clarity', 'Moment of Clarity', 'clase', 'Puedes usar acciones de concentración aunque estés en furia, durante ese turno.', { de: 'barbarian' }),
  d('raging-intimidation', 'Raging Intimidation', 'clase', 'Tus acciones de Demoralize pierden el rasgo de concentración en furia.', { de: 'barbarian' }),
  d('raging-thrower', 'Raging Thrower', 'clase', 'El daño extra de la furia se aplica a armas arrojadizas.', { de: 'barbarian' }),
  d('sudden-charge-barbarian', 'Sudden Charge', 'clase', 'Te mueves dos veces tu Velocidad y haces un Strike al llegar.', {
    de: 'barbarian', aptitud: usa('Carga repentina', 2, 'Te mueves dos veces tu Velocidad y, si terminas al lado de un enemigo, le haces un Strike cuerpo a cuerpo.', { tirada: { tipo: 'golpe' }, disparadores: ['al-atacar'] }),
  }),
  // Bard
  d('bardic-lore', 'Bardic Lore', 'clase', 'Puedes recordar cualquier cosa con Bardic Lore.', { de: 'bard' }),
  d('lingering-composition', 'Lingering Composition', 'clase', 'Conjuro de foco: tu próxima composición dura más si pasas una Performance.', { de: 'bard' }),
  d('reach-spell-bard', 'Reach Spell', 'clase', 'Tu próximo conjuro llega 30 ft más lejos.', { de: 'bard' }),
  d('versatile-performance', 'Versatile Performance', 'clase', 'Usas Performance en lugar de Diplomacy, Intimidation o Deception en ciertas situaciones.', { de: 'bard' }),
  // Champion
  d('deitys-domain', "Deity's Domain", 'clase', 'Un conjuro de foco del dominio de tu deidad.', { de: 'champion' }),
  d('desperate-prayer', 'Desperate Prayer', 'clase', 'Una vez al día, recuperas un punto de foco al empezar un combate sin foco.', { de: 'champion' }),
  d('ranged-reprisal', 'Ranged Reprisal', 'clase', 'Tu reacción de campeón funciona a 15 ft.', { de: 'champion' }),
  d('unimpeded-step', 'Unimpeded Step', 'clase', 'Tras tu reacción, un aliado da un Step libre de terreno difícil.', { de: 'champion' }),
  // Cleric
  d('deadly-simplicity', 'Deadly Simplicity', 'clase', 'El arma favorita de tu deidad, si es simple, hace un dado más grande.', { de: 'cleric' }),
  d('domain-initiate', 'Domain Initiate', 'clase', 'Un conjuro de foco de uno de los dominios de tu deidad.', { de: 'cleric' }),
  d('harming-hands', 'Harming Hands', 'clase', 'Tu Harm hace d10 en lugar de d8.', { de: 'cleric' }),
  d('healing-hands', 'Healing Hands', 'clase', 'Tu Heal cura d10 en lugar de d8.', { de: 'cleric' }),
  d('reach-spell-cleric', 'Reach Spell', 'clase', 'Tu próximo conjuro llega 30 ft más lejos.', { de: 'cleric' }),
  // Druid
  d('animal-companion-druid', 'Animal Companion', 'clase', 'Un compañero animal joven que pelea a tu lado.', { de: 'druid' }),
  d('reach-spell-druid', 'Reach Spell', 'clase', 'Tu próximo conjuro llega 30 ft más lejos.', { de: 'druid' }),
  d('storm-born', 'Storm Born', 'clase', 'El clima no te molesta y tus conjuros no sufren por viento o lluvia.', { de: 'druid' }),
  d('untamed-form', 'Untamed Form', 'clase', 'Conjuro de foco: te transformas en un animal de combate.', { de: 'druid' }),
  d('widen-spell-druid', 'Widen Spell', 'clase', 'El área de tu próximo conjuro crece.', { de: 'druid' }),
  // Monk
  d('crane-stance', 'Crane Stance', 'clase', 'Postura: +1 a la CA y tus golpes de ala hacen 1d6 contundente.', { de: 'monk' }),
  d('dragon-stance', 'Dragon Stance', 'clase', 'Postura: tus patadas de dragón hacen 1d10 y atraviesas terreno difícil.', { de: 'monk' }),
  d('monastic-weaponry', 'Monastic Weaponry', 'clase', 'Usas armas de monje con tus técnicas sin armas.', { de: 'monk' }),
  d('mountain-stance', 'Mountain Stance', 'clase', 'Postura: +4 a la CA sin armadura (tope de Dex +0) y eres difícil de mover.', { de: 'monk' }),
  d('tiger-stance', 'Tiger Stance', 'clase', 'Postura: zarpazos de tigre 1d8 agile y Step de 10 ft.', { de: 'monk' }),
  d('wolf-stance', 'Wolf Stance', 'clase', 'Postura: mordidas de lobo 1d8 que derriban cuando flanqueas.', { de: 'monk' }),
  // Ranger
  d('animal-companion-ranger', 'Animal Companion', 'clase', 'Un compañero animal joven que caza contigo.', { de: 'ranger' }),
  d('crossbow-ace', 'Crossbow Ace', 'clase', 'Con ballesta, +2 de daño contra tu presa y recargas mejor.', { de: 'ranger' }),
  d('hunted-shot', 'Hunted Shot', 'clase', 'Dos disparos a tu presa con una sola acción doble; si los dos aciertan, el daño se suma.', {
    de: 'ranger', aptitud: usa('Disparo de caza', 1, 'Una vez por turno: dos Strikes a distancia contra tu presa con un arma de recarga 0.', { rasgos: ['flourish'], tirada: { tipo: 'golpe' }, disparadores: ['al-atacar'] }),
  }),
  d('monster-hunter', 'Monster Hunter', 'clase', 'Al cazar una presa, también recuerdas algo útil sobre ella.', { de: 'ranger' }),
  d('twin-takedown', 'Twin Takedown', 'clase', 'Dos Strikes a tu presa con un arma en cada mano.', {
    de: 'ranger', aptitud: usa('Derribo doble', 1, 'Una vez por turno: un Strike con cada arma cuerpo a cuerpo contra tu presa.', { rasgos: ['flourish'], tirada: { tipo: 'golpe' }, disparadores: ['al-atacar'] }),
  }),
  // Rogue
  d('nimble-dodge', 'Nimble Dodge', 'clase', 'Reacción: +2 a tu CA contra un ataque que ves venir.', {
    de: 'rogue', aptitud: { ...usa('Esquiva ágil', 'reaccion', 'Cuando un enemigo que puedes ver te ataca, te apartas: +2 a tu CA contra ese ataque.'), disparadores: ['te-apuntan'], efecto: { bonoCA: 2 } },
  }),
  d('overextending-feint', 'Overextending Feint', 'clase', 'Tu finta hace que el enemigo falle más feo contra ti.', { de: 'rogue' }),
  d('plant-evidence', 'Plant Evidence', 'clase', 'Metes un objeto en el bolsillo de alguien sin que lo note.', { de: 'rogue' }),
  d('trap-finder', 'Trap Finder', 'clase', '+1 para encontrar y desactivar trampas, y contra ellas.', { de: 'rogue' }),
  d('twin-feint', 'Twin Feint', 'clase', 'Dos Strikes con dos armas; el segundo deja Off-guard al enemigo.', { de: 'rogue' }),
  d('youre-next', "You're Next", 'clase', 'Al derribar a un enemigo, asustas a otro con tu reacción.', { de: 'rogue' }),
  // Sorcerer
  d('counterspell-sorcerer', 'Counterspell', 'clase', 'Reacción: anulas un conjuro enemigo gastando uno igual.', { de: 'sorcerer' }),
  d('dangerous-sorcery', 'Dangerous Sorcery', 'clase', 'Tus conjuros con espacio que dañan suman su rango al daño.', { de: 'sorcerer' }),
  d('familiar-sorcerer', 'Familiar', 'clase', 'Un familiar mágico te acompaña.', { de: 'sorcerer' }),
  d('reach-spell-sorcerer', 'Reach Spell', 'clase', 'Tu próximo conjuro llega 30 ft más lejos.', { de: 'sorcerer' }),
  d('widen-spell-sorcerer', 'Widen Spell', 'clase', 'El área de tu próximo conjuro crece.', { de: 'sorcerer' }),
  // Witch
  d('cackle', 'Cackle', 'clase', 'Tu risa mantiene un hechizo de bruja con una acción libre.', { de: 'witch' }),
  d('counterspell-witch', 'Counterspell', 'clase', 'Reacción: anulas un conjuro enemigo gastando uno igual.', { de: 'witch' }),
  d('reach-spell-witch', 'Reach Spell', 'clase', 'Tu próximo conjuro llega 30 ft más lejos.', { de: 'witch' }),
  d('widen-spell-witch', 'Widen Spell', 'clase', 'El área de tu próximo conjuro crece.', { de: 'witch' }),
  // Wizard
  d('counterspell-wizard', 'Counterspell', 'clase', 'Reacción: anulas un conjuro enemigo gastando uno igual.', { de: 'wizard' }),
  d('familiar-wizard', 'Familiar', 'clase', 'Un familiar mágico te acompaña.', { de: 'wizard' }),
  d('reach-spell-wizard', 'Reach Spell', 'clase', 'Tu próximo conjuro llega 30 ft más lejos.', { de: 'wizard' }),
  d('spellbook-prodigy', 'Spellbook Prodigy', 'clase', 'Aprendes conjuros nuevos más rápido y nunca fallas del todo al copiarlos.', { de: 'wizard' }),
  d('widen-spell-wizard', 'Widen Spell', 'clase', 'El área de tu próximo conjuro crece.', { de: 'wizard' }),
];

export const DOTES: Dote[] = [...DOTES_HABILIDAD, ...DOTES_GENERALES, ...DOTES_ASCENDENCIA, ...DOTES_CLASE];

export function doteDe(id: string): Dote | undefined {
  return DOTES.find((x) => x.id === id);
}

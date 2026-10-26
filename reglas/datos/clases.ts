import type { Aptitud } from '../aptitudes';
import type { Clase } from './tipos';

// Clases del Player Core 1 y 2 (remaster), a nivel 1. Licencia ORC.

const apt = (nombre: string, verbo: string, costo: Aptitud['costo'], descripcion: string, extra: Partial<Aptitud> = {}): Omit<Aptitud, 'id'> =>
  ({ nombre, verbo, categoria: 'dote', costo, recuperacion: { tipo: 'siempre' }, descripcion, rasgos: [], ...extra });

const sinArmas = { simples: 1, marciales: 0, avanzadas: 0, sinArmas: 1 } as const;
const soloSinArmadura = { sinArmadura: 1, ligera: 0, media: 0, pesada: 0 } as const;

export const CLASES: Clase[] = [
  {
    id: 'fighter', nombre: 'Fighter', rol: 'El mejor con las armas: pega más fuerte y más seguido que nadie.',
    descripcion: 'Maestro del combate con cualquier arma o armadura. Empieza con Expert en armas: acierta más que el resto.',
    atributoClave: ['str', 'dex'], pg: 10, percepcion: 2, salvaciones: { fortitude: 2, reflex: 2, will: 1 },
    habilidadesFijas: [], habilidadesAElegir: [['acrobatics', 'athletics']], habilidadesLibres: 3,
    armas: { simples: 2, marciales: 2, avanzadas: 1, sinArmas: 2 }, defensa: { sinArmadura: 1, ligera: 1, media: 1, pesada: 1 },
    rasgos: [
      { nombre: 'Reactive Strike', descripcion: 'Castigas con un Strike al enemigo que se mueve o manipula a tu alcance.' },
      { nombre: 'Shield Block', descripcion: 'Bloqueas daño con el escudo levantado.' },
    ],
    aptitudes: [
      apt('Reactive Strike', 'Golpe de oportunidad', 'reaccion', 'Cuando un enemigo a tu alcance se mueve o usa una acción de manipular, le haces un Strike. Con crítico, si estaba manipulando, lo interrumpes.', { disparadores: ['enemigo-se-mueve'], tirada: { tipo: 'golpe' } }),
      apt('Shield Block', 'Bloquear con el escudo', 'reaccion', 'Con el escudo levantado, cuando un ataque te iba a hacer daño físico: el escudo absorbe tanto daño como su Dureza (Hardness).', { disparadores: ['te-golpean'], requiere: 'shield-raised' }),
    ],
  },
  {
    id: 'barbarian', nombre: 'Barbarian', rol: 'Furia: mucho daño y muchos PG, a cambio de defenderse un poco peor.',
    descripcion: 'Entra en furia para pelear con una fuerza descomunal. Tu instinto le da forma a esa furia.',
    atributoClave: ['str'], pg: 12, percepcion: 2, salvaciones: { fortitude: 2, reflex: 1, will: 2 },
    habilidadesFijas: ['athletics'], habilidadesAElegir: [], habilidadesLibres: 3,
    armas: { simples: 1, marciales: 1, avanzadas: 0, sinArmas: 1 }, defensa: { sinArmadura: 1, ligera: 1, media: 1, pesada: 0 },
    rasgos: [
      { nombre: 'Rage', descripcion: 'Una acción: +2 de daño cuerpo a cuerpo, PG temporales (nivel + Con) y −1 a la CA. No puedes usar acciones de concentración.' },
      { nombre: 'Instinct', descripcion: 'De dónde sale tu furia: cambia el daño extra y te da habilidades.' },
    ],
    aptitudes: [
      apt('Rage', 'Entrar en furia', 1, 'Ganas PG temporales iguales a tu nivel + Con, +2 de daño con armas cuerpo a cuerpo y −1 a la CA, hasta que termine el combate o te desmayes. Luego, un minuto sin poder volver.', { rasgos: ['concentrate', 'emotion', 'mental'] }),
    ],
    subclase: {
      titulo: 'Instinct', opciones: [
        { id: 'animal', nombre: 'Animal Instinct', descripcion: 'Tu furia es la de una bestia: ataques sin armas (mandíbulas o garras).' },
        { id: 'dragon', nombre: 'Dragon Instinct', descripcion: 'La furia de un dragón: más daño y, luego, aliento.' },
        { id: 'fury', nombre: 'Fury Instinct', descripcion: 'Furia pura: una dote de clase extra.' },
        { id: 'giant', nombre: 'Giant Instinct', descripcion: 'Usas armas enormes con mucho más daño.' },
        { id: 'spirit', nombre: 'Spirit Instinct', descripcion: 'Los espíritus te acompañan: tu daño puede ser espiritual.' },
      ],
    },
  },
  {
    id: 'bard', nombre: 'Bard', rol: 'Apoyo con magia y música: mejora a todos y engaña a los enemigos.',
    descripcion: 'Su arte es magia oculta. Con composiciones anima a los aliados y con conjuros resuelve casi cualquier cosa.',
    atributoClave: ['cha'], pg: 8, percepcion: 2, salvaciones: { fortitude: 1, reflex: 1, will: 2 },
    habilidadesFijas: ['occultism', 'performance'], habilidadesAElegir: [], habilidadesLibres: 4,
    armas: { ...sinArmas, extra: ['Longsword', 'Rapier', 'Sap', 'Shortbow', 'Shortsword', 'Whip'] }, defensa: { sinArmadura: 1, ligera: 1, media: 0, pesada: 0 },
    lanzador: { tradicion: 'occult', tipo: 'espontaneo', trucos: 5, espacios: 2, repertorio: 2, foco: 1 },
    rasgos: [
      { nombre: 'Composition Spells', descripcion: 'Courageous Anthem: +1 a ataques, daño y salvaciones contra miedo de tus aliados cerca.' },
      { nombre: 'Muse', descripcion: 'Lo que te inspira: te da una dote y un conjuro.' },
    ],
    aptitudes: [
      apt('Courageous Anthem', 'Himno de valor', 1, 'Truco de composición: tú y tus aliados a 60 ft tienen +1 a ataques, daño y salvaciones contra miedo durante 1 ronda.', { categoria: 'truco', rasgos: ['cantrip', 'composition', 'emotion', 'mental'] }),
    ],
    subclase: {
      titulo: 'Muse', opciones: [
        { id: 'enigma', nombre: 'Enigma', descripcion: 'Te inspiran los misterios: Bardic Lore.' },
        { id: 'maestro', nombre: 'Maestro', descripcion: 'Te inspira el arte puro: Lingering Composition.' },
        { id: 'polymath', nombre: 'Polymath', descripcion: 'Te inspira todo saber: Versatile Performance.' },
        { id: 'warrior', nombre: 'Warrior', descripcion: 'Te inspira la batalla: Martial Performance.' },
      ],
    },
  },
  {
    id: 'champion', nombre: 'Champion', rol: 'Defensor sagrado: protege a sus aliados con su reacción y su escudo.',
    descripcion: 'Un guerrero consagrado a una causa. Su reacción castiga a quien lastima a sus aliados.',
    atributoClave: ['str', 'dex'], pg: 10, percepcion: 1, salvaciones: { fortitude: 2, reflex: 1, will: 2 },
    habilidadesFijas: ['religion'], habilidadesAElegir: [], habilidadesLibres: 2,
    armas: { simples: 1, marciales: 1, avanzadas: 0, sinArmas: 1 }, defensa: { sinArmadura: 1, ligera: 1, media: 1, pesada: 1 },
    lanzador: { tradicion: 'divine', tipo: 'espontaneo', trucos: 0, espacios: 0, foco: 1 },
    rasgos: [
      { nombre: "Champion's Reaction", descripcion: 'Según tu causa: proteges a un aliado que van a herir, y castigas al atacante.' },
      { nombre: 'Devotion Spells', descripcion: 'Lay on Hands: curas con un toque (conjuro de foco).' },
      { nombre: 'Shield Block', descripcion: 'Bloqueas daño con el escudo levantado.' },
    ],
    aptitudes: [
      apt("Champion's Reaction", 'Proteger', 'reaccion', 'Un enemigo a 15 ft hace daño a un aliado: el aliado gana resistencia a ese daño (2 + nivel) y el enemigo sufre las consecuencias de tu causa.', { disparadores: ['te-golpean'] }),
      apt('Shield Block', 'Bloquear con el escudo', 'reaccion', 'Con el escudo levantado, el escudo absorbe tanto daño como su Dureza (Hardness).', { disparadores: ['te-golpean'], requiere: 'shield-raised' }),
      apt('Lay on Hands', 'Imponer manos', 1, 'Conjuro de foco: curas 6 PG a un aliado que tocas (o dañas a un no-muerto).', { categoria: 'foco', recuperacion: { tipo: 'foco' }, rasgos: ['healing', 'vitality'] }),
    ],
    subclase: {
      titulo: 'Cause', opciones: [
        { id: 'justice', nombre: 'Justice', descripcion: 'Castigas con un Strike al que hiere a tu aliado.' },
        { id: 'liberation', nombre: 'Liberation', descripcion: 'Liberas al aliado: puede escapar o moverse.' },
        { id: 'redemption', nombre: 'Redemption', descripcion: 'El atacante queda debilitado si sigue atacando.' },
        { id: 'grandeur', nombre: 'Grandeur', descripcion: 'Tu luz sagrada abruma al enemigo.' },
      ],
    },
  },
  {
    id: 'cleric', nombre: 'Cleric', rol: 'Sanador y lanzador divino: cura como nadie y castiga con su fe.',
    descripcion: 'Sirve a una deidad y canaliza su poder. Su Divine Font le da muchas curaciones (o daño a no-muertos).',
    atributoClave: ['wis'], pg: 8, percepcion: 1, salvaciones: { fortitude: 1, reflex: 1, will: 2 },
    habilidadesFijas: ['religion'], habilidadesAElegir: [], habilidadesLibres: 2,
    armas: { ...sinArmas, extra: ['El arma favorita de tu deidad'] }, defensa: soloSinArmadura,
    lanzador: { tradicion: 'divine', tipo: 'preparado', trucos: 5, espacios: 2, foco: 0 },
    rasgos: [
      { nombre: 'Divine Font', descripcion: '4 espacios extra de rango 1 solo para Heal (o Harm).' },
      { nombre: 'Doctrine', descripcion: 'Cloistered Cleric (más magia) o Warpriest (más armadura y armas).' },
    ],
    aptitudes: [
      apt('Heal (Divine Font)', 'Curar', 2, 'Con un espacio de tu Divine Font: un aliado a 30 ft recupera 1d8 + 8 PG (con dos acciones). Con 3 acciones, curas a todos a tu alrededor.', { categoria: 'conjuro', recuperacion: { tipo: 'consumible', cantidad: 4 }, rasgos: ['healing', 'vitality'], tirada: { tipo: 'expresion', expresion: '1d8+8' }, distancia: 30 }),
    ],
    subclase: {
      titulo: 'Doctrine', opciones: [
        { id: 'cloistered', nombre: 'Cloistered Cleric', descripcion: 'Más magia: Domain Initiate y mejores conjuros con el tiempo.' },
        { id: 'warpriest', nombre: 'Warpriest', descripcion: 'Más guerra: armadura ligera y media, Shield Block y mejor Fortitude.' },
      ],
    },
  },
  {
    id: 'druid', nombre: 'Druid', rol: 'Magia de la naturaleza: controla el campo, cura y se transforma.',
    descripcion: 'Guardián del mundo natural. Su orden decide si tiene un animal, si llama tormentas o si se transforma.',
    atributoClave: ['wis'], pg: 8, percepcion: 1, salvaciones: { fortitude: 1, reflex: 1, will: 2 },
    habilidadesFijas: ['nature'], habilidadesAElegir: [], habilidadesLibres: 2,
    armas: sinArmas, defensa: { sinArmadura: 1, ligera: 1, media: 1, pesada: 0 },
    lanzador: { tradicion: 'primal', tipo: 'preparado', trucos: 5, espacios: 2, foco: 1 },
    rasgos: [
      { nombre: 'Druidic Order', descripcion: 'Tu orden: un compañero animal, una hoja, la tormenta o la forma salvaje.' },
      { nombre: 'Wildsong', descripcion: 'El idioma secreto de los druidas.' },
    ],
    aptitudes: [],
    subclase: {
      titulo: 'Order', opciones: [
        { id: 'animal', nombre: 'Animal Order', descripcion: 'Un compañero animal y Athletics.', habilidad: 'athletics' },
        { id: 'leaf', nombre: 'Leaf Order', descripcion: 'Un familiar leshy y Diplomacy.', habilidad: 'diplomacy' },
        { id: 'storm', nombre: 'Storm Order', descripcion: 'Llamas tormentas y Acrobatics.', habilidad: 'acrobatics' },
        { id: 'untamed', nombre: 'Untamed Order', descripcion: 'Te transformas y Intimidation.', habilidad: 'intimidation' },
      ],
    },
  },
  {
    id: 'monk', nombre: 'Monk', rol: 'Rápido y duro sin armas: golpea dos veces con una acción.',
    descripcion: 'Su cuerpo es su arma. Golpes rápidos, posturas de combate y una defensa sin armadura excelente.',
    atributoClave: ['str', 'dex'], pg: 10, percepcion: 1, salvaciones: { fortitude: 2, reflex: 2, will: 2 },
    habilidadesFijas: [], habilidadesAElegir: [['acrobatics', 'athletics']], habilidadesLibres: 4,
    armas: sinArmas, defensa: { sinArmadura: 2, ligera: 0, media: 0, pesada: 0 },
    rasgos: [
      { nombre: 'Flurry of Blows', descripcion: 'Una acción: dos Strikes sin armas, una vez por turno.' },
      { nombre: 'Powerful Fist', descripcion: 'Tus puños hacen 1d6 y no pierden nada por ser letales.' },
    ],
    aptitudes: [
      apt('Flurry of Blows', 'Ráfaga de golpes', 1, 'Una vez por turno: dos Strikes sin armas. Si los dos aciertan al mismo enemigo, el daño se suma.', { rasgos: ['flourish'], tirada: { tipo: 'golpe' }, disparadores: ['al-atacar'] }),
    ],
  },
  {
    id: 'ranger', nombre: 'Ranger', rol: 'Cazador: elige una presa y la persigue con arco o con dos armas.',
    descripcion: 'Rastreador experto. Marca a su presa y gana ventaja contra ella según su estilo de caza.',
    atributoClave: ['str', 'dex'], pg: 10, percepcion: 2, salvaciones: { fortitude: 2, reflex: 2, will: 1 },
    habilidadesFijas: ['nature', 'survival'], habilidadesAElegir: [], habilidadesLibres: 4,
    armas: { simples: 1, marciales: 1, avanzadas: 0, sinArmas: 1 }, defensa: { sinArmadura: 1, ligera: 1, media: 1, pesada: 0 },
    rasgos: [
      { nombre: 'Hunt Prey', descripcion: 'Una acción: marcas a una criatura como tu presa.' },
      { nombre: "Hunter's Edge", descripcion: 'Flurry (menos penalización), Precision (daño extra) u Outwit (mejor contra sus trucos).' },
    ],
    aptitudes: [
      apt('Hunt Prey', 'Marcar presa', 1, 'Marcas a una criatura que ves como tu presa: +2 a Perception para buscarla y a Survival para rastrearla, y ganas tu ventaja de cazador contra ella.', { rasgos: ['concentrate'], distancia: 100 }),
    ],
    subclase: {
      titulo: "Hunter's Edge", opciones: [
        { id: 'flurry', nombre: 'Flurry', descripcion: 'Contra tu presa, la penalización por ataque múltiple es −3/−6.' },
        { id: 'precision', nombre: 'Precision', descripcion: 'El primer golpe a tu presa cada turno hace +1d8.' },
        { id: 'outwit', nombre: 'Outwit', descripcion: '+2 a Deception, Intimidation, Stealth y CA contra tu presa.' },
      ],
    },
  },
  {
    id: 'rogue', nombre: 'Rogue', rol: 'Ágil y astuto: muchas skills y golpes certeros cuando el enemigo se descuida.',
    descripcion: 'Experto en skills y en aprovechar descuidos. Su Sneak Attack castiga a los enemigos Off-guard.',
    atributoClave: ['dex'], pg: 8, percepcion: 2, salvaciones: { fortitude: 1, reflex: 2, will: 2 },
    habilidadesFijas: ['stealth'], habilidadesAElegir: [], habilidadesLibres: 7,
    armas: { ...sinArmas, extra: ['Rapier', 'Sap', 'Shortbow', 'Shortsword'] }, defensa: { sinArmadura: 1, ligera: 1, media: 0, pesada: 0 },
    rasgos: [
      { nombre: 'Sneak Attack', descripcion: '+1d6 de daño con armas ágiles o finesse contra enemigos Off-guard.' },
      { nombre: 'Surprise Attack', descripcion: 'En el primer turno, los enemigos que aún no actuaron están Off-guard para ti.' },
      { nombre: "Rogue's Racket", descripcion: 'Tu estilo: Ruffian, Scoundrel o Thief.' },
    ],
    aptitudes: [],
    subclase: {
      titulo: 'Racket', opciones: [
        { id: 'ruffian', nombre: 'Ruffian', descripcion: 'Matón: Sneak Attack con cualquier arma simple y armadura media.', habilidad: 'intimidation' },
        { id: 'scoundrel', nombre: 'Scoundrel', descripcion: 'Embaucador: tus fintas dejan al enemigo Off-guard más tiempo.', habilidad: 'deception' },
        { id: 'thief', nombre: 'Thief', descripcion: 'Ladrón: sumas Dex al daño de armas finesse.', habilidad: 'thievery' },
      ],
    },
  },
  {
    id: 'sorcerer', nombre: 'Sorcerer', rol: 'Magia innata: muchos conjuros por día, su sangre decide de qué tipo.',
    descripcion: 'La magia corre por su sangre. Su linaje decide su tradición y le da poderes extra.',
    atributoClave: ['cha'], pg: 6, percepcion: 1, salvaciones: { fortitude: 1, reflex: 1, will: 2 },
    habilidadesFijas: [], habilidadesAElegir: [], habilidadesLibres: 2,
    armas: sinArmas, defensa: soloSinArmadura,
    lanzador: { tradicion: 'segun-eleccion', tipo: 'espontaneo', trucos: 5, espacios: 3, repertorio: 2, foco: 1 },
    rasgos: [
      { nombre: 'Bloodline', descripcion: 'De dónde viene tu magia: decide tu tradición, dos skills y conjuros de sangre.' },
      { nombre: 'Blood Magic', descripcion: 'Al lanzar un conjuro de tu linaje ganas un efecto extra.' },
    ],
    aptitudes: [],
    subclase: {
      titulo: 'Bloodline', opciones: [
        { id: 'aberrant', nombre: 'Aberrant', descripcion: 'Magia oculta de seres de más allá.', tradicion: 'occult', habilidad: 'occultism' },
        { id: 'angelic', nombre: 'Angelic', descripcion: 'Magia divina celestial.', tradicion: 'divine', habilidad: 'religion' },
        { id: 'demonic', nombre: 'Demonic', descripcion: 'Magia divina de demonios.', tradicion: 'divine', habilidad: 'intimidation' },
        { id: 'draconic', nombre: 'Draconic', descripcion: 'Magia arcana de dragones.', tradicion: 'arcane', habilidad: 'arcana' },
        { id: 'fey', nombre: 'Fey', descripcion: 'Magia primal de las hadas.', tradicion: 'primal', habilidad: 'nature' },
        { id: 'imperial', nombre: 'Imperial', descripcion: 'Magia arcana antigua de imperios humanos.', tradicion: 'arcane', habilidad: 'arcana' },
      ],
    },
  },
  {
    id: 'witch', nombre: 'Witch', rol: 'Magia a través de un familiar: maldiciones, trucos únicos y control.',
    descripcion: 'Un patrón misterioso le enseña magia a través de su familiar. Sus hexes cambian el combate.',
    atributoClave: ['int'], pg: 6, percepcion: 1, salvaciones: { fortitude: 1, reflex: 1, will: 2 },
    habilidadesFijas: [], habilidadesAElegir: [], habilidadesLibres: 3,
    armas: sinArmas, defensa: soloSinArmadura,
    lanzador: { tradicion: 'segun-eleccion', tipo: 'preparado', trucos: 5, espacios: 2, foco: 1 },
    rasgos: [
      { nombre: 'Patron', descripcion: 'Quién te da la magia: decide tu tradición y un hex.' },
      { nombre: 'Familiar', descripcion: 'Tu familiar guarda tus conjuros.' },
    ],
    aptitudes: [],
    subclase: {
      titulo: 'Patron', opciones: [
        { id: 'faith', nombre: "Faith's Flamekeeper", descripcion: 'Patrón divino.', tradicion: 'divine', habilidad: 'religion' },
        { id: 'inscribed', nombre: 'The Inscribed One', descripcion: 'Patrón arcano.', tradicion: 'arcane', habilidad: 'arcana' },
        { id: 'resentment', nombre: 'The Resentment', descripcion: 'Patrón oculto.', tradicion: 'occult', habilidad: 'occultism' },
        { id: 'wild', nombre: 'Wilding Steward', descripcion: 'Patrón primal.', tradicion: 'primal', habilidad: 'nature' },
      ],
    },
  },
  {
    id: 'wizard', nombre: 'Wizard', rol: 'El lanzador estudioso: la lista de conjuros más amplia del juego.',
    descripcion: 'Aprende magia arcana de sus libros. Prepara conjuros cada día y su escuela le da poderes extra.',
    atributoClave: ['int'], pg: 6, percepcion: 1, salvaciones: { fortitude: 1, reflex: 1, will: 2 },
    habilidadesFijas: ['arcana'], habilidadesAElegir: [], habilidadesLibres: 2,
    armas: { simples: 0, marciales: 0, avanzadas: 0, sinArmas: 1, extra: ['Club', 'Crossbow', 'Dagger', 'Heavy crossbow', 'Staff'] }, defensa: soloSinArmadura,
    lanzador: { tradicion: 'arcane', tipo: 'preparado', trucos: 5, espacios: 2, foco: 1 },
    rasgos: [
      { nombre: 'Arcane School', descripcion: 'Tu escuela: un espacio extra de conjuros de su currículo y un conjuro de foco.' },
      { nombre: 'Arcane Bond', descripcion: 'Una vez al día, recuperas un conjuro ya lanzado con tu objeto vinculado.' },
      { nombre: 'Spellbook', descripcion: 'Tu libro de conjuros: preparas desde ahí.' },
    ],
    aptitudes: [
      { ...apt('Drain Bonded Item', 'Vaciar objeto vinculado', 'libre', 'Una vez al día: vuelves a lanzar un conjuro que ya lanzaste hoy, sin gastar espacio.'), recuperacion: { tipo: 'frecuencia', veces: 1, periodo: 'dia' } },
    ],
    subclase: {
      titulo: 'Arcane School', opciones: [
        { id: 'battle-magic', nombre: 'School of Battle Magic', descripcion: 'Conjuros de daño y protección.' },
        { id: 'civic-wizardry', nombre: 'School of Civic Wizardry', descripcion: 'Magia útil para construir y ayudar.' },
        { id: 'mentalism', nombre: 'School of Mentalism', descripcion: 'Magia de la mente.' },
        { id: 'protean-form', nombre: 'School of Protean Form', descripcion: 'Transformar cuerpos.' },
        { id: 'unified-theory', nombre: 'School of Unified Magical Theory', descripcion: 'Sin currículo: una dote extra de mago.' },
      ],
    },
  },
];

export function claseDe(id: string): Clase | undefined {
  return CLASES.find((c) => c.id === id);
}

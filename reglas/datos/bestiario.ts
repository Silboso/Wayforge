import type { Criatura, Defensas } from '../criaturas';

// Criaturas de nivel bajo para empezar, con valores de referencia del Monster Core (remaster, licencia ORC).
// Son un punto de partida: el GM las ajusta a su mesa desde la hoja de la criatura.
export interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  tamano: 'Small' | 'Medium' | 'Large';
  ca: number;
  pg: number;
  percepcion: number;
  criatura: Criatura;
}

const ataque = (nombre: string, bono: number, dano: string, tipoDano: string, rasgos: string[] = [], distancia?: number) => ({
  id: nombre.toLowerCase().replace(/[^a-z]+/g, '-'), nombre, bono, dano, tipoDano,
  agil: rasgos.includes('agile'), rasgos, ...(distancia ? { distancia } : {}),
});

const c = (nivel: number, fort: number, ref: number, will: number, velocidad: number, ataques: Criatura['ataques'],
  habilidades: Criatura['habilidades'], rasgos: string[], notas = '', defensas?: Defensas): Criatura =>
  ({ nivel, salvaciones: { fortitude: fort, reflex: ref, will }, velocidad, ataques, habilidades, rasgos, notas, ...(defensas ? { defensas } : {}) });

export const BESTIARIO: Plantilla[] = [
  {
    id: 'goblin-warrior', nombre: 'Goblin Warrior', tamano: 'Small', ca: 16, pg: 6, percepcion: 2,
    descripcion: 'Goblin con espada corta y arco: ataca en grupo y huye cuando pierde.',
    criatura: c(-1, 5, 7, 3, 25, [
      ataque('Dogslicer', 7, '1d6', 'slashing', ['agile', 'backstabber', 'finesse']),
      ataque('Shortbow', 6, '1d6', 'piercing', ['deadly d10'], 60),
    ], [{ nombre: 'Acrobatics', bono: 5 }, { nombre: 'Stealth', bono: 5 }], ['Goblin', 'Humanoid']),
  },
  {
    id: 'goblin-commando', nombre: 'Goblin Commando', tamano: 'Small', ca: 17, pg: 18, percepcion: 5,
    descripcion: 'Goblin más curtido, con un hacha de asta para enganchar a sus presas.',
    criatura: c(1, 8, 7, 5, 25, [
      ataque('Horsechopper', 8, '1d8+2', 'slashing', ['reach', 'trip', 'versatile P'], 10),
      ataque('Shortbow', 7, '1d6', 'piercing', ['deadly d10'], 60),
    ], [{ nombre: 'Athletics', bono: 7 }, { nombre: 'Stealth', bono: 7 }], ['Goblin', 'Humanoid']),
  },
  {
    id: 'kobold-warrior', nombre: 'Kobold Warrior', tamano: 'Small', ca: 16, pg: 8, percepcion: 3,
    descripcion: 'Pequeño reptiloide con lanza; se esconde y pelea con trampas.',
    criatura: c(-1, 4, 7, 3, 25, [
      ataque('Spear', 6, '1d6', 'piercing'),
      ataque('Sling', 7, '1d6', 'bludgeoning', [], 50),
    ], [{ nombre: 'Stealth', bono: 5 }], ['Kobold', 'Humanoid']),
  },
  {
    id: 'giant-rat', nombre: 'Giant Rat', tamano: 'Small', ca: 15, pg: 8, percepcion: 5,
    descripcion: 'Rata del tamaño de un perro; muerde rápido.',
    criatura: c(-1, 6, 7, 2, 30, [ataque('Jaws', 7, '1d6', 'piercing', ['agile', 'finesse'])], [{ nombre: 'Stealth', bono: 5 }], ['Animal']),
  },
  {
    id: 'skeleton-guard', nombre: 'Skeleton Guard', tamano: 'Medium', ca: 16, pg: 4, percepcion: 2,
    descripcion: 'Esqueleto animado que vigila sin cansarse. Resiste lo cortante y perforante.',
    criatura: c(-1, 2, 8, 2, 25, [
      ataque('Scimitar', 6, '1d6+2', 'slashing', ['forceful', 'sweep']),
      ataque('Shortbow', 6, '1d6', 'piercing', ['deadly d10'], 60),
    ], [{ nombre: 'Athletics', bono: 4 }], ['Undead', 'Mindless', 'Skeleton'], 'Muerto sin mente: no se cansa ni tiene miedo.', {
      inmunidades: ['mental', 'poison'], resistencias: [{ tipo: 'cold', valor: 5 }, { tipo: 'piercing', valor: 5 }, { tipo: 'slashing', valor: 5 }], debilidades: [],
    }),
  },
  {
    id: 'zombie-shambler', nombre: 'Zombie Shambler', tamano: 'Medium', ca: 13, pg: 20, percepcion: 0,
    descripcion: 'Muerto lento y torpe, pero difícil de tumbar.',
    criatura: c(-1, 6, 0, 2, 25, [ataque('Fist', 7, '1d6+1', 'bludgeoning')], [], ['Undead', 'Mindless', 'Zombie'],
      'Slowed 1 siempre (2 acciones por turno).', {
        inmunidades: ['mental', 'poison'], resistencias: [], debilidades: [{ tipo: 'slashing', valor: 5 }, { tipo: 'vitality', valor: 5 }],
      }),
  },
  {
    id: 'wolf', nombre: 'Wolf', tamano: 'Medium', ca: 15, pg: 24, percepcion: 7,
    descripcion: 'Lobo de caza en manada; derriba a su presa.',
    criatura: c(1, 9, 7, 5, 35, [ataque('Jaws', 7, '1d6+2', 'piercing')], [{ nombre: 'Athletics', bono: 7 }, { nombre: 'Stealth', bono: 7 }], ['Animal'],
      'Knockdown: si su mordisco acierta, puede hacer Trip gratis. Pack Attack: +1d4 contra quien esté al lado de otro lobo.'),
  },
  {
    id: 'bandit', nombre: 'Bandido', tamano: 'Medium', ca: 17, pg: 20, percepcion: 5,
    descripcion: 'Asaltante de caminos con espada corta y ballesta.',
    criatura: c(1, 7, 8, 5, 25, [
      ataque('Shortsword', 8, '1d6+2', 'piercing', ['agile', 'finesse', 'versatile S']),
      ataque('Crossbow', 8, '1d8', 'piercing', [], 120),
    ], [{ nombre: 'Deception', bono: 5 }, { nombre: 'Intimidation', bono: 5 }], ['Human', 'Humanoid']),
  },
  {
    id: 'orc-brute', nombre: 'Orc Brute', tamano: 'Medium', ca: 15, pg: 15, percepcion: 3,
    descripcion: 'Orco de primera línea: carga sin pensar.',
    criatura: c(0, 8, 5, 3, 25, [
      ataque('Greataxe', 8, '1d12+3', 'slashing', ['sweep']),
      ataque('Javelin', 5, '1d6+3', 'piercing', ['thrown'], 30),
    ], [{ nombre: 'Athletics', bono: 7 }, { nombre: 'Intimidation', bono: 3 }], ['Orc', 'Humanoid'], 'Ferocity: una vez al día, queda en 1 PG en lugar de caer.'),
  },
  {
    id: 'hobgoblin-soldier', nombre: 'Hobgoblin Soldier', tamano: 'Medium', ca: 18, pg: 20, percepcion: 7,
    descripcion: 'Soldado disciplinado con espada larga y arco.',
    criatura: c(1, 9, 7, 5, 25, [
      ataque('Longsword', 9, '1d8+3', 'slashing', ['versatile P']),
      ataque('Composite Longbow', 7, '1d8', 'piercing', ['deadly d10'], 100),
    ], [{ nombre: 'Athletics', bono: 7 }], ['Goblin', 'Humanoid'], 'Formation: +1 a la CA si está al lado de otro hobgoblin.'),
  },
  {
    id: 'ogre', nombre: 'Ogre', tamano: 'Large', ca: 17, pg: 50, percepcion: 5,
    descripcion: 'Gigantón brutal con un garfio enorme: llega lejos y pega fuerte.',
    criatura: c(3, 13, 6, 5, 25, [
      ataque('Ogre Hook', 12, '1d10+7', 'piercing', ['deadly d10', 'reach', 'trip'], 10),
      ataque('Javelin', 6, '1d6+7', 'piercing', ['thrown'], 30),
    ], [{ nombre: 'Athletics', bono: 11 }, { nombre: 'Intimidation', bono: 5 }], ['Giant', 'Humanoid']),
  },
  {
    id: 'animated-broom', nombre: 'Animated Broom', tamano: 'Small', ca: 16, pg: 6, percepcion: 3,
    descripcion: 'Escoba encantada que barre a los intrusos.',
    criatura: c(-1, 3, 7, 3, 15, [ataque('Bristles', 7, '1d4+1', 'bludgeoning', ['magical'])], [], ['Construct', 'Mindless'],
      'Dust: los que golpea quedan Dazzled si fallan Fortitude.'),
  },
];

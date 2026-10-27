// Los íconos de game-icons.net que trae el sistema PF2e de Foundry (CC BY 3.0, ver public/iconos/LICENCIA.txt).
// Se dibujan como máscara: toman el color de la tinta del texto que los rodea.

const ASCENDENCIAS = new Set([
  'anadi', 'android', 'athamaru', 'automaton', 'awakened-animal', 'azarketi', 'catfolk', 'centaur', 'conrasu', 'dwarf', 'elf', 'fetchling',
  'fleshwarp', 'gnoll', 'gnome', 'goblin', 'goloma', 'grippli', 'halfling', 'hobgoblin', 'human', 'kashrishi', 'kitsune', 'kobold', 'leshy',
  'lizardfolk', 'merfolk', 'minotaur', 'orc', 'poppet', 'ratfolk', 'shisk', 'skeleton', 'sprite', 'strix', 'surki', 'tanuki', 'tengu',
]);

export type TipoIcono =
  | 'action' | 'ancestry' | 'armor' | 'background' | 'backpack' | 'book' | 'character' | 'class' | 'condition' | 'consumable' | 'deity'
  | 'effect' | 'equipment' | 'feat' | 'hazard' | 'heritage' | 'lore' | 'martial' | 'melee' | 'npc' | 'party' | 'shield' | 'spell'
  | 'treasure' | 'weapon';

// El ícono de una ascendencia (Human, Elf…), o el genérico si no hay uno propio
export function rutaAscendencia(id: string): string {
  const k = id.toLowerCase().replace(/\s*\(.*\)$/, '').replace(/[^a-z]+/g, '-');
  return ASCENDENCIAS.has(k) ? `/iconos/ascendencias/${k}.svg` : '/iconos/tipos/ancestry.svg';
}

export const rutaTipo = (t: TipoIcono) => `/iconos/tipos/${t}.svg`;

export function IconoJuego({ ruta, className = 'size-5', titulo }: { ruta: string; className?: string; titulo?: string }) {
  return (
    <span role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ maskImage: `url(${ruta})`, WebkitMaskImage: `url(${ruta})`, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }} />
  );
}

import type { Arma, Armadura, Equipo, Escudo } from './tipos';

// Armas, armaduras, escudos y equipo básico del Player Core (remaster). Licencia ORC.
// Precios en piezas de plata (1 po = 10 pp, 1 pp = 10 pc). Bulto: 0.1 = L (ligero).

const a = (id: string, nombre: string, categoria: Arma['categoria'], tipo: Arma['tipo'], dados: string, tipoDano: Arma['tipoDano'], manos: 1 | 2,
  rasgos: string[], precio: number, bulto: number, grupo: string, extra: Partial<Arma> = {}): Arma =>
  ({ id, nombre, categoria, tipo, dados, tipoDano, manos, rasgos, precio, bulto, grupo, ...extra });

export const ARMAS: Arma[] = [
  // Sin armas
  a('fist', 'Fist', 'sin-armas', 'cuerpo', '1d4', 'B', 1, ['agile', 'finesse', 'nonlethal', 'unarmed'], 0, 0, 'brawling'),
  // Simples cuerpo a cuerpo
  a('club', 'Club', 'simple', 'cuerpo', '1d6', 'B', 1, ['thrown 10'], 0, 1, 'club', { distancia: 10 }),
  a('dagger', 'Dagger', 'simple', 'cuerpo', '1d4', 'P', 1, ['agile', 'finesse', 'thrown 10', 'versatile S'], 2, 0.1, 'knife', { distancia: 10 }),
  a('clan-dagger', 'Clan Dagger', 'simple', 'cuerpo', '1d4', 'P', 1, ['agile', 'dwarf', 'parry', 'versatile B'], 20, 0.1, 'knife'),
  a('gauntlet', 'Gauntlet', 'simple', 'cuerpo', '1d4', 'B', 1, ['agile', 'free-hand'], 2, 0.1, 'brawling'),
  a('light-mace', 'Light Mace', 'simple', 'cuerpo', '1d4', 'B', 1, ['agile', 'finesse', 'shove'], 4, 0.1, 'club'),
  a('longspear', 'Longspear', 'simple', 'cuerpo', '1d8', 'P', 2, ['reach'], 5, 2, 'spear'),
  a('mace', 'Mace', 'simple', 'cuerpo', '1d6', 'B', 1, ['shove'], 10, 1, 'club'),
  a('morningstar', 'Morningstar', 'simple', 'cuerpo', '1d6', 'B', 1, ['versatile P'], 10, 1, 'club'),
  a('sickle', 'Sickle', 'simple', 'cuerpo', '1d4', 'S', 1, ['agile', 'finesse', 'trip'], 2, 0.1, 'knife'),
  a('spear', 'Spear', 'simple', 'cuerpo', '1d6', 'P', 1, ['thrown 20'], 1, 1, 'spear', { distancia: 20 }),
  a('staff', 'Staff', 'simple', 'cuerpo', '1d4', 'B', 1, ['two-hand d8'], 0, 1, 'club'),
  // Simples a distancia
  a('crossbow', 'Crossbow', 'simple', 'distancia', '1d8', 'P', 2, [], 30, 1, 'bow', { distancia: 120, recarga: 1 }),
  a('dart', 'Dart', 'simple', 'distancia', '1d4', 'P', 1, ['agile', 'thrown'], 0.1, 0.1, 'dart', { distancia: 20 }),
  a('heavy-crossbow', 'Heavy Crossbow', 'simple', 'distancia', '1d10', 'P', 2, [], 40, 2, 'bow', { distancia: 120, recarga: 2 }),
  a('javelin', 'Javelin', 'simple', 'distancia', '1d6', 'P', 1, ['thrown'], 1, 0.1, 'dart', { distancia: 30 }),
  a('sling', 'Sling', 'simple', 'distancia', '1d6', 'B', 1, ['propulsive'], 0, 0.1, 'sling', { distancia: 50, recarga: 1 }),
  // Marciales cuerpo a cuerpo
  a('battle-axe', 'Battle Axe', 'marcial', 'cuerpo', '1d8', 'S', 1, ['sweep'], 10, 1, 'axe'),
  a('bastard-sword', 'Bastard Sword', 'marcial', 'cuerpo', '1d8', 'S', 1, ['two-hand d12'], 40, 1, 'sword'),
  a('falchion', 'Falchion', 'marcial', 'cuerpo', '1d10', 'S', 2, ['forceful', 'sweep'], 30, 2, 'sword'),
  a('flail', 'Flail', 'marcial', 'cuerpo', '1d6', 'B', 1, ['disarm', 'sweep', 'trip'], 8, 1, 'flail'),
  a('glaive', 'Glaive', 'marcial', 'cuerpo', '1d8', 'S', 2, ['deadly d8', 'forceful', 'reach'], 10, 2, 'polearm'),
  a('greataxe', 'Greataxe', 'marcial', 'cuerpo', '1d12', 'S', 2, ['sweep'], 20, 2, 'axe'),
  a('greatsword', 'Greatsword', 'marcial', 'cuerpo', '1d12', 'S', 2, ['versatile P'], 20, 2, 'sword'),
  a('guisarme', 'Guisarme', 'marcial', 'cuerpo', '1d10', 'S', 2, ['reach', 'trip'], 20, 2, 'polearm'),
  a('halberd', 'Halberd', 'marcial', 'cuerpo', '1d10', 'P', 2, ['reach', 'versatile S'], 20, 2, 'polearm'),
  a('light-hammer', 'Light Hammer', 'marcial', 'cuerpo', '1d6', 'B', 1, ['agile', 'thrown 20'], 3, 0.1, 'hammer', { distancia: 20 }),
  a('longsword', 'Longsword', 'marcial', 'cuerpo', '1d8', 'S', 1, ['versatile P'], 10, 1, 'sword'),
  a('maul', 'Maul', 'marcial', 'cuerpo', '1d12', 'B', 2, ['shove'], 30, 2, 'hammer'),
  a('pick', 'Pick', 'marcial', 'cuerpo', '1d6', 'P', 1, ['fatal d10'], 7, 1, 'pick'),
  a('rapier', 'Rapier', 'marcial', 'cuerpo', '1d6', 'P', 1, ['deadly d8', 'disarm', 'finesse'], 20, 1, 'sword'),
  a('scimitar', 'Scimitar', 'marcial', 'cuerpo', '1d6', 'S', 1, ['forceful', 'sweep'], 10, 1, 'sword'),
  a('scythe', 'Scythe', 'marcial', 'cuerpo', '1d10', 'S', 2, ['deadly d10', 'trip'], 20, 2, 'polearm'),
  a('shortsword', 'Shortsword', 'marcial', 'cuerpo', '1d6', 'P', 1, ['agile', 'finesse', 'versatile S'], 9, 0.1, 'sword'),
  a('trident', 'Trident', 'marcial', 'cuerpo', '1d8', 'P', 1, ['thrown 20'], 10, 1, 'spear', { distancia: 20 }),
  a('warhammer', 'Warhammer', 'marcial', 'cuerpo', '1d8', 'B', 1, ['shove'], 10, 1, 'hammer'),
  a('whip', 'Whip', 'marcial', 'cuerpo', '1d4', 'S', 1, ['disarm', 'finesse', 'nonlethal', 'reach', 'trip'], 1, 1, 'flail'),
  a('sap', 'Sap', 'marcial', 'cuerpo', '1d6', 'B', 1, ['agile', 'nonlethal'], 1, 0.1, 'club'),
  // Marciales a distancia
  a('composite-longbow', 'Composite Longbow', 'marcial', 'distancia', '1d8', 'P', 2, ['deadly d10', 'propulsive', 'volley 30'], 200, 2, 'bow', { distancia: 100 }),
  a('composite-shortbow', 'Composite Shortbow', 'marcial', 'distancia', '1d6', 'P', 2, ['deadly d10', 'propulsive'], 140, 1, 'bow', { distancia: 60 }),
  a('longbow', 'Longbow', 'marcial', 'distancia', '1d8', 'P', 2, ['deadly d10', 'volley 30'], 60, 2, 'bow', { distancia: 100 }),
  a('shortbow', 'Shortbow', 'marcial', 'distancia', '1d6', 'P', 2, ['deadly d10'], 30, 1, 'bow', { distancia: 60 }),
];

export const ARMADURAS: Armadura[] = [
  { id: 'none', nombre: 'Sin armadura', categoria: 'sin-armadura', ca: 0, topeDex: null, penalizacion: 0, velocidad: 0, fuerza: 0, precio: 0, bulto: 0, rasgos: [] },
  { id: 'explorers-clothing', nombre: "Explorer's Clothing", categoria: 'sin-armadura', ca: 0, topeDex: 5, penalizacion: 0, velocidad: 0, fuerza: 0, precio: 1, bulto: 0.1, rasgos: ['comfort'] },
  { id: 'padded', nombre: 'Padded Armor', categoria: 'ligera', ca: 1, topeDex: 3, penalizacion: 0, velocidad: 0, fuerza: 1, precio: 2, bulto: 0.1, rasgos: ['comfort'] },
  { id: 'leather', nombre: 'Leather Armor', categoria: 'ligera', ca: 1, topeDex: 4, penalizacion: -1, velocidad: 0, fuerza: 1, precio: 20, bulto: 1, rasgos: [] },
  { id: 'studded-leather', nombre: 'Studded Leather', categoria: 'ligera', ca: 2, topeDex: 3, penalizacion: -1, velocidad: 0, fuerza: 1, precio: 30, bulto: 1, rasgos: [] },
  { id: 'chain-shirt', nombre: 'Chain Shirt', categoria: 'ligera', ca: 2, topeDex: 3, penalizacion: -1, velocidad: 0, fuerza: 1, precio: 50, bulto: 1, rasgos: ['flexible', 'noisy'] },
  { id: 'hide', nombre: 'Hide Armor', categoria: 'media', ca: 3, topeDex: 2, penalizacion: -2, velocidad: -5, fuerza: 2, precio: 20, bulto: 2, rasgos: [] },
  { id: 'scale-mail', nombre: 'Scale Mail', categoria: 'media', ca: 3, topeDex: 2, penalizacion: -2, velocidad: -5, fuerza: 2, precio: 40, bulto: 2, rasgos: [] },
  { id: 'chain-mail', nombre: 'Chain Mail', categoria: 'media', ca: 4, topeDex: 1, penalizacion: -2, velocidad: -5, fuerza: 3, precio: 60, bulto: 2, rasgos: ['flexible', 'noisy'] },
  { id: 'breastplate', nombre: 'Breastplate', categoria: 'media', ca: 4, topeDex: 1, penalizacion: -2, velocidad: -5, fuerza: 3, precio: 80, bulto: 2, rasgos: [] },
  { id: 'splint-mail', nombre: 'Splint Mail', categoria: 'pesada', ca: 5, topeDex: 1, penalizacion: -3, velocidad: -10, fuerza: 3, precio: 130, bulto: 3, rasgos: [] },
  { id: 'half-plate', nombre: 'Half Plate', categoria: 'pesada', ca: 5, topeDex: 1, penalizacion: -3, velocidad: -10, fuerza: 3, precio: 180, bulto: 3, rasgos: [] },
  { id: 'full-plate', nombre: 'Full Plate', categoria: 'pesada', ca: 6, topeDex: 0, penalizacion: -3, velocidad: -10, fuerza: 4, precio: 300, bulto: 4, rasgos: ['bulwark'] },
];

export const ESCUDOS: Escudo[] = [
  { id: 'buckler', nombre: 'Buckler', ca: 1, dureza: 3, pg: 6, precio: 10, bulto: 0.1, descripcion: 'Pequeño, en el antebrazo: te deja la mano casi libre.' },
  { id: 'wooden-shield', nombre: 'Wooden Shield', ca: 2, dureza: 3, pg: 12, precio: 10, bulto: 1, descripcion: 'El escudo de siempre: barato y ligero.' },
  { id: 'steel-shield', nombre: 'Steel Shield', ca: 2, dureza: 5, pg: 20, precio: 20, bulto: 1, descripcion: 'Más pesado y mucho más resistente.' },
  { id: 'tower-shield', nombre: 'Tower Shield', ca: 2, dureza: 5, pg: 20, precio: 100, bulto: 4, descripcion: 'Enorme: con Take Cover te da +4 a la CA.' },
];

export const EQUIPO: Equipo[] = [
  { id: 'adventurers-pack', nombre: "Adventurer's Pack", precio: 15, bulto: 1, descripcion: 'Mochila, saco de dormir, cuerda, 2 bolsas, tiza, pedernal, 10 antorchas, raciones para 2 semanas y odre.' },
  { id: 'backpack', nombre: 'Backpack', precio: 1, bulto: 0.1, descripcion: 'Carga hasta 4 de Bulk.' },
  { id: 'bedroll', nombre: 'Bedroll', precio: 0.2, bulto: 0.1, descripcion: 'Para dormir al aire libre.' },
  { id: 'rope', nombre: 'Rope (50 ft)', precio: 5, bulto: 0.1, descripcion: 'Cuerda resistente.' },
  { id: 'torch', nombre: 'Torch', precio: 0.1, bulto: 0.1, descripcion: 'Luz brillante en 20 ft durante 1 hora.' },
  { id: 'rations', nombre: 'Rations (1 week)', precio: 4, bulto: 0.1, descripcion: 'Comida de viaje para una semana.' },
  { id: 'grappling-hook', nombre: 'Grappling Hook', precio: 1, bulto: 0.1, descripcion: 'Para trepar con cuerda.' },
  { id: 'healers-toolkit', nombre: "Healer's Toolkit", precio: 50, bulto: 1, descripcion: 'Necesario para Treat Wounds y Battle Medicine.' },
  { id: 'thieves-toolkit', nombre: "Thieves' Toolkit", precio: 30, bulto: 0.1, descripcion: 'Ganzúas: necesarias para abrir cerraduras.' },
  { id: 'repair-toolkit', nombre: 'Repair Toolkit', precio: 20, bulto: 1, descripcion: 'Para reparar objetos y escudos.' },
  { id: 'religious-symbol', nombre: 'Religious Symbol (wooden)', precio: 1, bulto: 0.1, descripcion: 'Símbolo de tu fe; enfoca conjuros divinos.' },
  { id: 'spellbook', nombre: 'Spellbook (blank)', precio: 10, bulto: 1, descripcion: 'Libro para anotar conjuros.' },
  { id: 'musical-instrument', nombre: 'Musical Instrument (handheld)', precio: 8, bulto: 1, descripcion: 'Laúd, flauta o tambor: para composiciones.' },
  { id: 'material-pouch', nombre: 'Material Component Pouch', precio: 5, bulto: 0.1, descripcion: 'Componentes para lanzar conjuros.' },
  { id: 'arrows', nombre: 'Arrows (10)', precio: 0.1, bulto: 0.1, descripcion: 'Munición para arcos.' },
  { id: 'bolts', nombre: 'Bolts (10)', precio: 0.1, bulto: 0.1, descripcion: 'Munición para ballestas.' },
  {
    id: 'minor-healing-potion', nombre: 'Minor Healing Potion', precio: 40, bulto: 0.1, descripcion: 'Bebes y recuperas 1d8 PG.',
    aptitud: { nombre: 'Minor Healing Potion', verbo: 'Beber poción', categoria: 'objeto', costo: 1, recuperacion: { tipo: 'consumible', cantidad: 1 }, descripcion: 'Recuperas 1d8 PG.', rasgos: ['consumable', 'healing', 'potion'], tirada: { tipo: 'expresion', expresion: '1d8' } },
  },
  {
    id: 'minor-elixir-of-life', nombre: 'Minor Elixir of Life', precio: 30, bulto: 0.1, descripcion: 'Recuperas 1d6 PG y +1 contra enfermedades y venenos.',
    aptitud: { nombre: 'Minor Elixir of Life', verbo: 'Tomar elixir', categoria: 'objeto', costo: 1, recuperacion: { tipo: 'consumible', cantidad: 1 }, descripcion: 'Recuperas 1d6 PG y ganas +1 contra enfermedades y venenos por 10 minutos.', rasgos: ['alchemical', 'consumable', 'elixir', 'healing'], tirada: { tipo: 'expresion', expresion: '1d6' } },
  },
];

// Lo que trae cada personaje para gastar al empezar: 15 po
export const DINERO_INICIAL = 150;

// "5 po 4 pp", "3 pc": como se cuenta en la mesa
export function precioTexto(pp: number): string {
  const cobre = Math.round(pp * 10);
  if (cobre === 0) return 'gratis';
  const oro = Math.floor(cobre / 100);
  const plata = Math.floor((cobre % 100) / 10);
  const resto = cobre % 10;
  return [oro && `${oro} po`, plata && `${plata} pp`, resto && `${resto} pc`].filter(Boolean).join(' ');
}

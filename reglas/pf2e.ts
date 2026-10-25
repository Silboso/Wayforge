// Motor de reglas de Pathfinder 2e (remaster). TypeScript puro: no sabe nada de la interfaz ni de la red.
// Cada número calculado trae su desglose (`partes`), para que la interfaz pueda explicar de dónde sale.

export type Atributo = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ATRIBUTOS: Record<Atributo, { nombre: string; abrev: string; ayuda: string }> = {
  str: { nombre: 'Strength', abrev: 'Str', ayuda: 'Fuerza física: golpes cuerpo a cuerpo, Athletics' },
  dex: { nombre: 'Dexterity', abrev: 'Dex', ayuda: 'Agilidad: CA, Reflex, ataques a distancia, Stealth' },
  con: { nombre: 'Constitution', abrev: 'Con', ayuda: 'Aguante: puntos de golpe y Fortitude' },
  int: { nombre: 'Intelligence', abrev: 'Int', ayuda: 'Razonamiento: Arcana, Crafting, Society' },
  wis: { nombre: 'Wisdom', abrev: 'Wis', ayuda: 'Intuición: Perception, Will, Medicine' },
  cha: { nombre: 'Charisma', abrev: 'Cha', ayuda: 'Presencia: Diplomacy, Deception, Intimidation' },
};

// 0 Untrained · 1 Trained · 2 Expert · 3 Master · 4 Legendary
export type Rango = 0 | 1 | 2 | 3 | 4;

export const RANGOS: { nombre: string; letra: string; bono: number }[] = [
  { nombre: 'Untrained', letra: 'U', bono: 0 },
  { nombre: 'Trained', letra: 'T', bono: 2 },
  { nombre: 'Expert', letra: 'E', bono: 4 },
  { nombre: 'Master', letra: 'M', bono: 6 },
  { nombre: 'Legendary', letra: 'L', bono: 8 },
];

export const HABILIDADES = [
  { clave: 'acrobatics', nombre: 'Acrobatics', atributo: 'dex' },
  { clave: 'arcana', nombre: 'Arcana', atributo: 'int' },
  { clave: 'athletics', nombre: 'Athletics', atributo: 'str' },
  { clave: 'crafting', nombre: 'Crafting', atributo: 'int' },
  { clave: 'deception', nombre: 'Deception', atributo: 'cha' },
  { clave: 'diplomacy', nombre: 'Diplomacy', atributo: 'cha' },
  { clave: 'intimidation', nombre: 'Intimidation', atributo: 'cha' },
  { clave: 'medicine', nombre: 'Medicine', atributo: 'wis' },
  { clave: 'nature', nombre: 'Nature', atributo: 'wis' },
  { clave: 'occultism', nombre: 'Occultism', atributo: 'int' },
  { clave: 'performance', nombre: 'Performance', atributo: 'cha' },
  { clave: 'religion', nombre: 'Religion', atributo: 'wis' },
  { clave: 'society', nombre: 'Society', atributo: 'int' },
  { clave: 'stealth', nombre: 'Stealth', atributo: 'dex' },
  { clave: 'survival', nombre: 'Survival', atributo: 'wis' },
  { clave: 'thievery', nombre: 'Thievery', atributo: 'dex' },
] as const satisfies readonly { clave: string; nombre: string; atributo: Atributo }[];

export type ClaveHabilidad = (typeof HABILIDADES)[number]['clave'];

export const SALVACIONES = [
  { clave: 'fortitude', nombre: 'Fortitude', atributo: 'con' },
  { clave: 'reflex', nombre: 'Reflex', atributo: 'dex' },
  { clave: 'will', nombre: 'Will', atributo: 'wis' },
] as const satisfies readonly { clave: string; nombre: string; atributo: Atributo }[];

export type ClaveSalvacion = (typeof SALVACIONES)[number]['clave'];

export interface Golpe {
  id: string;
  nombre: string;
  // Str para cuerpo a cuerpo, Dex para distancia o armas finesse
  atributo: 'str' | 'dex';
  rango: Rango;
  bonoObjeto: number;
  // Dados de daño del arma, como "1d8"; los dados extra por runas se escriben aquí ("2d8")
  dados: string;
  tipoDano: string;
  // Cuerpo a cuerpo y arrojadizas suman Str al daño
  sumarFuerza: boolean;
  // Las armas agile tienen menos penalización por ataque múltiple (−4/−8 en vez de −5/−10)
  agil: boolean;
}

export interface Personaje {
  id: string;
  nombre: string;
  ascendencia: string;
  clase: string;
  nivel: number;
  retrato?: string;
  atributos: Record<Atributo, number>;
  pgAscendencia: number;
  // PG que da la clase en cada nivel (sin contar Con)
  pgClase: number;
  pgActual: number;
  pgTemporales: number;
  velocidad: number;
  percepcion: Rango;
  salvaciones: Record<ClaveSalvacion, Rango>;
  armadura: { nombre: string; rango: Rango; bonoObjeto: number; topeDex: number | null };
  habilidades: Record<ClaveHabilidad, Rango>;
  golpes: Golpe[];
  notas: string;
}

export interface Parte {
  etiqueta: string;
  valor: number;
}

export interface Valor {
  total: number;
  partes: Parte[];
}

export interface FichaCalculada {
  pgMax: Valor;
  ca: Valor;
  percepcion: Valor;
  salvaciones: Record<ClaveSalvacion, Valor>;
  habilidades: Record<ClaveHabilidad, Valor>;
  golpes: { ataque: Valor; penalizaciones: [number, number, number]; dano: string }[];
}

export function bonoCompetencia(rango: Rango, nivel: number): number {
  return rango === 0 ? 0 : RANGOS[rango]!.bono + nivel;
}

function valor(partes: Parte[]): Valor {
  return { total: partes.reduce((suma, p) => suma + p.valor, 0), partes };
}

function parteCompetencia(rango: Rango, nivel: number): Parte {
  const r = RANGOS[rango]!;
  return {
    etiqueta: rango === 0 ? 'Untrained' : `${r.nombre} (+${r.bono} + nivel ${nivel})`,
    valor: bonoCompetencia(rango, nivel),
  };
}

function parteAtributo(p: Personaje, atributo: Atributo): Parte {
  return { etiqueta: ATRIBUTOS[atributo].abrev, valor: p.atributos[atributo] };
}

// Modificador de un chequeo: atributo + competencia
function chequeo(p: Personaje, atributo: Atributo, rango: Rango): Valor {
  return valor([parteAtributo(p, atributo), parteCompetencia(rango, p.nivel)]);
}

export function calcular(p: Personaje): FichaCalculada {
  const dexEnCa = p.armadura.topeDex === null ? p.atributos.dex : Math.min(p.atributos.dex, p.armadura.topeDex);
  const ca = valor([
    { etiqueta: 'Base', valor: 10 },
    { etiqueta: p.armadura.topeDex !== null && dexEnCa < p.atributos.dex ? `Dex (tope ${p.armadura.topeDex})` : 'Dex', valor: dexEnCa },
    parteCompetencia(p.armadura.rango, p.nivel),
    ...(p.armadura.bonoObjeto ? [{ etiqueta: p.armadura.nombre || 'Armadura', valor: p.armadura.bonoObjeto }] : []),
  ]);

  const pgMax = valor([
    { etiqueta: 'Ascendencia', valor: p.pgAscendencia },
    { etiqueta: `Clase (${p.pgClase} × nivel ${p.nivel})`, valor: p.pgClase * p.nivel },
    { etiqueta: `Con (${signo(p.atributos.con)} × nivel ${p.nivel})`, valor: p.atributos.con * p.nivel },
  ]);

  const salvaciones = Object.fromEntries(
    SALVACIONES.map((s) => [s.clave, chequeo(p, s.atributo, p.salvaciones[s.clave])]),
  ) as Record<ClaveSalvacion, Valor>;

  const habilidades = Object.fromEntries(
    HABILIDADES.map((h) => [h.clave, chequeo(p, h.atributo, p.habilidades[h.clave])]),
  ) as Record<ClaveHabilidad, Valor>;

  const golpes = p.golpes.map((g) => {
    const ataque = valor([
      parteAtributo(p, g.atributo),
      parteCompetencia(g.rango, p.nivel),
      ...(g.bonoObjeto ? [{ etiqueta: 'Objeto (runa)', valor: g.bonoObjeto }] : []),
    ]);
    const paso = g.agil ? 4 : 5;
    const bonoDano = g.sumarFuerza ? p.atributos.str : 0;
    return {
      ataque,
      penalizaciones: [ataque.total, ataque.total - paso, ataque.total - paso * 2] as [number, number, number],
      dano: `${g.dados}${bonoDano ? signo(bonoDano) : ''}${g.tipoDano ? ` ${g.tipoDano}` : ''}`,
    };
  });

  return { pgMax, ca, percepcion: chequeo(p, 'wis', p.percepcion), salvaciones, habilidades, golpes };
}

export function signo(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// "2d6" → { cantidad: 2, caras: 6 }. Solo los dados de PF2e.
export function leerDados(texto: string): { cantidad: number; caras: number } | null {
  const m = /^(\d{1,2})d(4|6|8|10|12)$/.exec(texto.trim().toLowerCase());
  if (!m) return null;
  const cantidad = Number(m[1]);
  return cantidad >= 1 ? { cantidad, caras: Number(m[2]) } : null;
}

export function personajeNuevo(id: string): Personaje {
  return {
    id,
    nombre: '',
    ascendencia: '',
    clase: '',
    nivel: 1,
    atributos: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    pgAscendencia: 8,
    pgClase: 8,
    pgActual: 16,
    pgTemporales: 0,
    velocidad: 25,
    percepcion: 1,
    salvaciones: { fortitude: 1, reflex: 1, will: 1 },
    armadura: { nombre: '', rango: 1, bonoObjeto: 0, topeDex: null },
    habilidades: Object.fromEntries(HABILIDADES.map((h) => [h.clave, 0])) as Record<ClaveHabilidad, Rango>,
    golpes: [],
    notas: '',
  };
}

// La sala no confía en lo que llega del navegador: revisa cada campo de la ficha.
export function esPersonajeValido(valor: unknown): valor is Personaje {
  if (typeof valor !== 'object' || valor === null) return false;
  const p = valor as Record<string, unknown>;
  const atributos = p.atributos as Record<string, unknown> | undefined;
  const salvaciones = p.salvaciones as Record<string, unknown> | undefined;
  const habilidades = p.habilidades as Record<string, unknown> | undefined;
  const armadura = p.armadura as Record<string, unknown> | undefined;
  return esTexto(p.id, 100) && esTexto(p.nombre, 60) && (p.nombre as string).trim().length > 0
    && esTexto(p.ascendencia, 60) && esTexto(p.clase, 60)
    && esEntero(p.nivel, 1, 20)
    && (p.retrato === undefined || esTexto(p.retrato, 500))
    && typeof atributos === 'object' && atributos !== null
    && (Object.keys(ATRIBUTOS) as Atributo[]).every((a) => esEntero(atributos[a], -5, 10))
    && esEntero(p.pgAscendencia, 0, 30) && esEntero(p.pgClase, 0, 20)
    && esEntero(p.pgActual, 0, 999) && esEntero(p.pgTemporales, 0, 999)
    && esEntero(p.velocidad, 0, 200)
    && esRango(p.percepcion)
    && typeof salvaciones === 'object' && salvaciones !== null && SALVACIONES.every((s) => esRango(salvaciones[s.clave]))
    && typeof habilidades === 'object' && habilidades !== null && HABILIDADES.every((h) => esRango(habilidades[h.clave]))
    && typeof armadura === 'object' && armadura !== null
    && esTexto(armadura.nombre, 60) && esRango(armadura.rango) && esEntero(armadura.bonoObjeto, 0, 10)
    && (armadura.topeDex === null || esEntero(armadura.topeDex, 0, 10))
    && Array.isArray(p.golpes) && p.golpes.length <= 20 && p.golpes.every(esGolpeValido)
    && esTexto(p.notas, 5000);
}

function esGolpeValido(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null) return false;
  const g = valor as Record<string, unknown>;
  return esTexto(g.id, 100) && esTexto(g.nombre, 60)
    && (g.atributo === 'str' || g.atributo === 'dex')
    && esRango(g.rango) && esEntero(g.bonoObjeto, 0, 4)
    && typeof g.dados === 'string' && leerDados(g.dados) !== null
    && esTexto(g.tipoDano, 30)
    && typeof g.sumarFuerza === 'boolean' && typeof g.agil === 'boolean';
}

function esTexto(t: unknown, max: number): boolean {
  return typeof t === 'string' && t.length <= max;
}

function esEntero(n: unknown, min: number, max: number): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}

function esRango(r: unknown): boolean {
  return r === 0 || r === 1 || r === 2 || r === 3 || r === 4;
}

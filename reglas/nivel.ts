// Subir de nivel: qué trae el nivel nuevo (PG, rasgos de clase, competencias, dotes, skill, atributos, conjuros)
// y cómo queda la ficha con lo que se eligió. Puro: los datos de cada clase vienen del compendio de Foundry.

import type { Aptitud } from './aptitudes';
import { claveDe } from './interacciones';
import { ATRIBUTOS, HABILIDADES, type Atributo, type ClaveHabilidad, type ClaveSalvacion, type Personaje, type Rango } from './pf2e';

export type QueSube = 'percepcion' | ClaveSalvacion | 'armas' | 'armadura' | 'conjuros' | 'claseCD';

export interface RasgoDeClase {
  nivel: number;
  nombre: string;
  texto: string;
  sube: { que: QueSube; rango: number }[];
}

export type HuecoDote = 'clase' | 'skill' | 'general' | 'ascendencia';

export interface Progresion {
  dotes: Record<HuecoDote, number[]>;
  mejorasSkill: number[];
  rasgos: RasgoDeClase[];
}

// Lo que el compendio guarda de una clase (en `datos`)
export interface DatosClase {
  pg: number;
  atributoClave: string[];
  progresion: Progresion;
}

export const NOMBRES_HUECO: Record<HuecoDote, string> = {
  clase: 'Dote de clase', skill: 'Dote de skill', general: 'Dote general', ascendencia: 'Dote de ascendencia',
};

export const NOMBRES_SUBE: Record<QueSube, string> = {
  percepcion: 'Perception', fortitude: 'Fortitude', reflex: 'Reflex', will: 'Will',
  armas: 'armas', armadura: 'armadura', conjuros: 'conjuros', claseCD: 'CD de clase',
};

export const NIVELES_ATRIBUTOS = [5, 10, 15, 20];
// Lanzadores con 4 espacios por rango (los demás, 3); los de pocos espacios no se tocan
const CUATRO_ESPACIOS = ['sorcerer'];
const POCOS_ESPACIOS = ['magus', 'summoner'];
// Los que eligen conjuros nuevos de su repertorio en cada espacio nuevo; los demás suman 2 a su libro
const ESPONTANEOS = ['sorcerer', 'bard', 'oracle', 'psychic', 'summoner'];

export interface QueTrae {
  nivel: number;
  pg: number;
  rasgos: RasgoDeClase[];
  dotes: HuecoDote[];
  mejoraSkill: boolean;
  mejorasAtributo: boolean;
  // Lo que cambia en sus competencias, ya combinado (el mejor rango de cada cosa)
  sube: { que: QueSube; rango: Rango }[];
  conjuros: { rangoMax: number; espacios: { rango: number; max: number }[]; aprender: number } | null;
}

export const claseDe = (p: Personaje) => p.origen?.clase || claveDe(p.clase);
export const ascendenciaDe = (p: Personaje) => p.origen?.ascendencia || claveDe(p.ascendencia.replace(/\s*\(.*\)$/, ''));

// El rango más alto que puede tener una skill en un nivel
export const rangoMaximoSkill = (nivel: number): Rango => (nivel >= 15 ? 4 : nivel >= 7 ? 3 : 2);

// Los espacios de conjuro de un lanzador completo en un nivel
export function espaciosEn(nivel: number, clase: string, extra: number): { rango: number; max: number }[] {
  const base = CUATRO_ESPACIOS.includes(clase) ? 4 : 3;
  const rangoMax = Math.min(10, Math.ceil(nivel / 2));
  return Array.from({ length: rangoMax }, (_, i) => {
    const rango = i + 1;
    const max = rango === 10 ? 1 : rango === rangoMax && nivel % 2 === 1 ? base - 1 : base;
    return { rango, max: max + (rango === 10 ? 0 : extra) };
  });
}

// Los lanzadores cuyos rasgos no dicen cuándo suben sus conjuros siguen lo de siempre: 7, 15 y 19
const CONJUROS_POR_DEFECTO: Record<number, Rango> = { 7: 2, 15: 3, 19: 4 };

export function queTrae(p: Personaje, datos: DatosClase, nivel = p.nivel + 1): QueTrae {
  const prog = datos.progresion;
  const rasgos = prog.rasgos.filter((r) => r.nivel === nivel);
  const sube = new Map<QueSube, Rango>();
  for (const r of rasgos) for (const s of r.sube) sube.set(s.que, Math.max(sube.get(s.que) ?? 0, s.rango) as Rango);
  const clase = claseDe(p);
  const dicenConjuros = prog.rasgos.some((r) => r.sube.some((s) => s.que === 'conjuros'));
  if (p.lanzador && !dicenConjuros && CONJUROS_POR_DEFECTO[nivel]) sube.set('conjuros', CONJUROS_POR_DEFECTO[nivel]!);
  let conjuros: QueTrae['conjuros'] = null;
  if (p.lanzador && !POCOS_ESPACIOS.includes(clase)) {
    const extra = clase === 'wizard' && p.origen?.subclase !== 'unified-theory' ? 1 : 0;
    const espacios = espaciosEn(nivel, clase, extra);
    const antes = espaciosEn(nivel - 1, clase, extra);
    const nuevos = espacios.reduce((s, e) => s + Math.max(0, e.max - (antes.find((x) => x.rango === e.rango)?.max ?? 0)), 0);
    conjuros = { rangoMax: espacios.at(-1)?.rango ?? 1, espacios, aprender: ESPONTANEOS.includes(clase) ? Math.max(1, nuevos) : 2 };
  }
  return {
    nivel,
    // Los PG de clase de su ficha (los mismos con los que se calculan sus PG máximos)
    pg: (p.pgClase || datos.pg) + p.atributos.con,
    rasgos,
    dotes: (['clase', 'ascendencia', 'skill', 'general'] as HuecoDote[]).filter((h) => prog.dotes[h].includes(nivel)),
    mejoraSkill: prog.mejorasSkill.includes(nivel),
    mejorasAtributo: NIVELES_ATRIBUTOS.includes(nivel),
    sube: [...sube].map(([que, rango]) => ({ que, rango })),
    conjuros,
  };
}

export interface DoteElegida { id: string; nombre: string; categoria: string; nivel: number; aptitud: Aptitud | null }

export interface EleccionNivel {
  atributos: Atributo[];
  skill: ClaveHabilidad | null;
  dotes: Partial<Record<HuecoDote, DoteElegida>>;
  conjuros: { id: string; nombre: string; aptitud: Aptitud }[];
}

export const ELECCION_NIVEL_VACIA: EleccionNivel = { atributos: [], skill: null, dotes: {}, conjuros: [] };

// Lo que falta elegir, en palabras
export function faltaElegir(trae: QueTrae, e: EleccionNivel): string[] {
  const falta: string[] = [];
  if (trae.mejorasAtributo && new Set(e.atributos).size < 4) falta.push(`Elige ${4 - new Set(e.atributos).size} atributo(s) más para mejorar`);
  if (trae.mejoraSkill && !e.skill) falta.push('Elige una skill para subir');
  for (const h of trae.dotes) if (!e.dotes[h]) falta.push(`Elige tu ${NOMBRES_HUECO[h].toLowerCase()}`);
  if (trae.conjuros && e.conjuros.length < trae.conjuros.aprender) falta.push(`Elige ${trae.conjuros.aprender - e.conjuros.length} conjuro(s) nuevo(s)`);
  return falta;
}

// Un atributo con un aumento: +1 hasta +4; desde ahí, cada dos aumentos suben uno (la mitad queda anotada)
export function aumentarAtributo(valor: number, parcial: boolean): { valor: number; parcial: boolean } {
  if (valor < 4) return { valor: valor + 1, parcial: false };
  return parcial ? { valor: valor + 1, parcial: false } : { valor, parcial: true };
}

// La ficha en el nivel nuevo, con todo lo que trae y lo que se eligió
export function subirNivel(p: Personaje, trae: QueTrae, e: EleccionNivel): Personaje {
  const subir = (actual: Rango, a: Rango) => Math.max(actual, a) as Rango;
  let atributos = { ...p.atributos };
  let parciales = [...(p.parciales ?? [])];
  for (const a of [...new Set(e.atributos)].slice(0, 4)) {
    const r = aumentarAtributo(atributos[a], parciales.includes(a));
    atributos = { ...atributos, [a]: r.valor };
    parciales = r.parcial ? [...parciales, a] : parciales.filter((x) => x !== a);
  }
  const mejoras = new Map(trae.sube.map((s) => [s.que, s.rango]));
  const habilidades = { ...p.habilidades };
  if (e.skill) habilidades[e.skill] = Math.min(rangoMaximoSkill(trae.nivel), habilidades[e.skill] + 1) as Rango;

  const aptitudes = [...(p.aptitudes ?? [])];
  const nuevas = [...Object.values(e.dotes).map((d) => d?.aptitud ?? null), ...e.conjuros.map((c) => c.aptitud)];
  for (const a of nuevas) if (a && !aptitudes.some((x) => x.id === a.id) && aptitudes.length < 80) aptitudes.push(a);
  const dotes = [...(p.dotes ?? [])];
  for (const d of Object.values(e.dotes)) {
    if (d && !dotes.some((x) => x.id === d.id) && dotes.length < 60) {
      dotes.push({ id: d.id.slice(0, 80), nombre: d.nombre.slice(0, 80), tipo: d.categoria.slice(0, 20), nivel: Math.min(20, Math.max(1, d.nivel)) });
    }
  }
  // Los PG nuevos se suman también a los actuales (la Con mejorada cuenta en todos los niveles)
  const conAntes = p.atributos.con;
  const pgGanados = trae.pg - conAntes + atributos.con + (atributos.con - conAntes) * p.nivel;
  const recursos = p.recursos && trae.conjuros
    ? { ...p.recursos, espacios: trae.conjuros.espacios.map((x) => ({ ...x, max: Math.min(9, x.max), usados: Math.min(x.max, p.recursos!.espacios.find((y) => y.rango === x.rango)?.usados ?? 0) })) }
    : p.recursos;

  return {
    ...p,
    nivel: trae.nivel,
    atributos,
    ...(parciales.length || p.parciales ? { parciales } : {}),
    pgActual: Math.max(0, Math.min(999, p.pgActual + pgGanados)),
    percepcion: subir(p.percepcion, mejoras.get('percepcion') ?? 0),
    salvaciones: {
      fortitude: subir(p.salvaciones.fortitude, mejoras.get('fortitude') ?? 0),
      reflex: subir(p.salvaciones.reflex, mejoras.get('reflex') ?? 0),
      will: subir(p.salvaciones.will, mejoras.get('will') ?? 0),
    },
    armadura: { ...p.armadura, rango: subir(p.armadura.rango, mejoras.get('armadura') ?? 0) },
    golpes: p.golpes.map((g) => ({ ...g, rango: g.rango > 0 ? subir(g.rango, mejoras.get('armas') ?? 0) : g.rango })),
    habilidades,
    aptitudes,
    dotes,
    ...(p.lanzador ? { lanzador: { ...p.lanzador, rango: subir(p.lanzador.rango, mejoras.get('conjuros') ?? 0) } } : {}),
    ...(p.claseCD ? { claseCD: { ...p.claseCD, rango: subir(p.claseCD.rango, mejoras.get('claseCD') ?? 0) } } : {}),
    ...(recursos ? { recursos } : {}),
  };
}

// "+3 Expert" para mostrar el cambio de una competencia
export const nombreRango = (r: number) => ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'][r] ?? '';
export const nombreAtributo = (a: Atributo) => ATRIBUTOS[a].abrev;
export const nombreSkill = (h: ClaveHabilidad) => HABILIDADES.find((x) => x.clave === h)!.nombre;

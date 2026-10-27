// Motor de reglas de Pathfinder 2e (remaster). TypeScript puro: no sabe nada de la interfaz ni de la red.
// Cada número calculado trae su desglose (`partes`), para que la interfaz pueda explicar de dónde sale.

import { penalizaciones, type Condicion, type Contexto } from './condiciones';
import type { EfectoActivo } from './efectos';
import { esAptitudValida, esRecursosValido, type Aptitud, type Lanzador, type Recursos } from './aptitudes';

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
  // A distancia: hasta dónde llega, en pies. Sin valor es cuerpo a cuerpo (5 ft, al lado)
  distancia?: number;
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
  // Conjuros, dotes y objetos propios (las acciones básicas vienen precargadas). Opcional en fichas viejas.
  aptitudes?: Aptitud[];
  lanzador?: Lanzador | null;
  recursos?: Recursos;
  // Lo que deja el creador de personajes (opcional: las fichas hechas a mano no lo tienen)
  // De qué está hecho, con los ids de la base de datos (para subir de nivel después)
  origen?: { ascendencia: string; herencia: string | null; trasfondo: string; clase: string; subclase: string | null };
  idiomas?: string[];
  sentidos?: string;
  // Lores en Trained (Warfare Lore, Circus Lore…)
  saberes?: string[];
  dotes?: { id: string; nombre: string; tipo: string; nivel: number }[];
  inventario?: { id: string; nombre: string; cantidad: number; bulto: number }[];
  monedas?: { oro: number; plata: number; cobre: number };
  // La CD de clase (para los efectos que la usan)
  claseCD?: { atributo: Atributo; rango: Rango };
  escudo?: { nombre: string; ca: number; dureza: number; pg: number; pgActual: number };
  // Los atajos Q W E R T Y que eligió el jugador (claves de sus acciones; null = espacio vacío)
  atajos?: (string | null)[];
  // Atributos de +4 o más con medio aumento anotado (el siguiente los sube uno)
  parciales?: Atributo[];
  // Hero Points (0 a 3): repetir una tirada, o gastarlos todos para no morir
  puntosHeroicos?: number;
  // La actividad de exploración (Avoid Notice, Scout…): decide con qué tira la iniciativa
  exploracion?: string;
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
  // Solo si lanza conjuros
  conjuros: { ataque: Valor; cd: Valor } | null;
  claseCD: Valor | null;
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

// `condiciones` y `efectos` son los del token del personaje: suman o restan con las reglas de apilamiento
export function calcular(p: Personaje, condiciones: Condicion[] = [], efectos: EfectoActivo[] = []): FichaCalculada {
  const con = (contexto: Contexto) => penalizaciones(condiciones, contexto, efectos);
  // Modificador de un chequeo: atributo + competencia + lo que sumen o quiten condiciones y efectos
  const chequeo = (atributo: Atributo, rango: Rango, salvacion?: ClaveSalvacion, clase?: 'percepcion' | 'habilidad') =>
    valor([parteAtributo(p, atributo), parteCompetencia(rango, p.nivel), ...con({ tipo: 'chequeo', atributo, salvacion, clase })]);

  const dexEnCa = p.armadura.topeDex === null ? p.atributos.dex : Math.min(p.atributos.dex, p.armadura.topeDex);
  const ca = valor([
    { etiqueta: 'Base', valor: 10 },
    { etiqueta: p.armadura.topeDex !== null && dexEnCa < p.atributos.dex ? `Dex (tope ${p.armadura.topeDex})` : 'Dex', valor: dexEnCa },
    parteCompetencia(p.armadura.rango, p.nivel),
    ...(p.armadura.bonoObjeto ? [{ etiqueta: p.armadura.nombre || 'Armadura', valor: p.armadura.bonoObjeto }] : []),
    ...con({ tipo: 'ca' }),
  ]);

  const pgMax = valor([
    { etiqueta: 'Ascendencia', valor: p.pgAscendencia },
    { etiqueta: `Clase (${p.pgClase} × nivel ${p.nivel})`, valor: p.pgClase * p.nivel },
    { etiqueta: `Con (${signo(p.atributos.con)} × nivel ${p.nivel})`, valor: p.atributos.con * p.nivel },
  ]);

  const salvaciones = Object.fromEntries(
    SALVACIONES.map((s) => [s.clave, chequeo(s.atributo, p.salvaciones[s.clave], s.clave)]),
  ) as Record<ClaveSalvacion, Valor>;

  const habilidades = Object.fromEntries(
    HABILIDADES.map((h) => [h.clave, chequeo(h.atributo, p.habilidades[h.clave], undefined, 'habilidad')]),
  ) as Record<ClaveHabilidad, Valor>;

  const golpes = p.golpes.map((g) => {
    const ataque = valor([
      parteAtributo(p, g.atributo),
      parteCompetencia(g.rango, p.nivel),
      ...(g.bonoObjeto ? [{ etiqueta: 'Objeto (runa)', valor: g.bonoObjeto }] : []),
      ...con({ tipo: 'ataque', atributo: g.atributo }),
    ]);
    const paso = g.agil ? 4 : 5;
    const bonoDano = bonoDeDano(p, g, condiciones, efectos);
    return {
      ataque,
      penalizaciones: [ataque.total, ataque.total - paso, ataque.total - paso * 2] as [number, number, number],
      dano: `${g.dados}${bonoDano ? signo(bonoDano) : ''}${g.tipoDano ? ` ${g.tipoDano}` : ''}`,
    };
  });

  const l = p.lanzador;
  const conjuros = l
    ? (() => {
      const ataque = valor([
        parteAtributo(p, l.atributo),
        parteCompetencia(l.rango, p.nivel),
        ...con({ tipo: 'ataque', atributo: l.atributo }),
      ]);
      // La CD es 10 + lo mismo que el ataque
      return { ataque, cd: valor([{ etiqueta: 'Base', valor: 10 }, ...ataque.partes]) };
    })()
    : null;

  const claseCD = p.claseCD
    ? valor([{ etiqueta: 'Base', valor: 10 }, parteAtributo(p, p.claseCD.atributo), parteCompetencia(p.claseCD.rango, p.nivel)])
    : null;

  return { pgMax, ca, percepcion: chequeo('wis', p.percepcion, undefined, 'percepcion'), salvaciones, habilidades, golpes, conjuros, claseCD };
}

// Lo que se suma a los dados de daño de un arma
export function bonoDeDano(p: Personaje, g: Golpe, condiciones: Condicion[] = [], efectos: EfectoActivo[] = []): number {
  const extra = penalizaciones(condiciones, { tipo: 'dano', conFuerza: g.sumarFuerza }, efectos);
  return (g.sumarFuerza ? p.atributos.str : 0) + extra.reduce((s, x) => s + x.valor, 0);
}

export type Grado = 'critico' | 'exito' | 'fallo' | 'pifia';

export const GRADOS: Record<Grado, string> = {
  critico: 'Éxito crítico',
  exito: 'Éxito',
  fallo: 'Fallo',
  pifia: 'Fallo crítico',
};

// Los cuatro grados de éxito: pasar la CD por 10 es crítico, fallar por 10 es pifia.
// Un 20 natural sube un grado y un 1 natural lo baja.
export function gradoDeExito(total: number, dado: number, cd: number): Grado {
  const orden: Grado[] = ['pifia', 'fallo', 'exito', 'critico'];
  let i = total >= cd + 10 ? 3 : total >= cd ? 2 : total <= cd - 10 ? 0 : 1;
  if (dado === 20) i = Math.min(3, i + 1);
  if (dado === 1) i = Math.max(0, i - 1);
  return orden[i]!;
}

// "2d6+1d4+3" → dados y modificador. Para la tirada libre.
export function leerExpresion(texto: string): { dados: { cantidad: number; caras: number }[]; modificador: number } | null {
  const limpio = texto.replace(/\s+/g, '').toLowerCase();
  if (!limpio || limpio.length > 40 || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(limpio)) return null;
  const dados: { cantidad: number; caras: number }[] = [];
  let modificador = 0;
  for (const [, signoTermino, termino] of limpio.matchAll(/([+-]?)(\d*d\d+|\d+)/g)) {
    const negativo = signoTermino === '-';
    if (termino!.includes('d')) {
      if (negativo) return null;
      const [c, k] = termino!.split('d');
      const cantidad = c ? Number(c) : 1;
      const caras = Number(k);
      if (cantidad < 1 || cantidad > 20 || ![2, 4, 6, 8, 10, 12, 20, 100].includes(caras)) return null;
      dados.push({ cantidad, caras });
    } else {
      modificador += negativo ? -Number(termino) : Number(termino);
    }
  }
  if (dados.length === 0 || Math.abs(modificador) > 100) return null;
  return { dados, modificador };
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
    && (p.puntosHeroicos === undefined || esEntero(p.puntosHeroicos, 0, 3))
    && (p.exploracion === undefined || esTexto(p.exploracion, 30))
    && esEntero(p.velocidad, 0, 200)
    && esRango(p.percepcion)
    && typeof salvaciones === 'object' && salvaciones !== null && SALVACIONES.every((s) => esRango(salvaciones[s.clave]))
    && typeof habilidades === 'object' && habilidades !== null && HABILIDADES.every((h) => esRango(habilidades[h.clave]))
    && typeof armadura === 'object' && armadura !== null
    && esTexto(armadura.nombre, 60) && esRango(armadura.rango) && esEntero(armadura.bonoObjeto, 0, 10)
    && (armadura.topeDex === null || esEntero(armadura.topeDex, 0, 10))
    && Array.isArray(p.golpes) && p.golpes.length <= 20 && p.golpes.every(esGolpeValido)
    && esTexto(p.notas, 5000)
    && (p.aptitudes === undefined || (Array.isArray(p.aptitudes) && p.aptitudes.length <= 80
      && p.aptitudes.every((a) => esAptitudValida(a, (c) => HABILIDADES.some((h) => h.clave === c), (e) => leerExpresion(e) !== null))))
    && (p.lanzador === undefined || p.lanzador === null || esLanzadorValido(p.lanzador))
    && (p.recursos === undefined || esRecursosValido(p.recursos))
    && esExtrasValidos(p);
}

// Lo que agrega el creador: todo opcional, todo acotado
function esExtrasValidos(p: Record<string, unknown>): boolean {
  const lista = (v: unknown, max: number, ok: (x: unknown) => boolean) => v === undefined || (Array.isArray(v) && v.length <= max && v.every(ok));
  const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  const origen = p.origen;
  const monedas = p.monedas;
  const claseCD = p.claseCD;
  const escudo = p.escudo;
  return (origen === undefined || (obj(origen) && esTexto(origen.ascendencia, 60) && esTexto(origen.trasfondo, 60) && esTexto(origen.clase, 60)
      && (origen.herencia === null || esTexto(origen.herencia, 60)) && (origen.subclase === null || esTexto(origen.subclase, 60))))
    && lista(p.idiomas, 20, (x) => esTexto(x, 40))
    && lista(p.atajos, 12, (x) => x === null || esTexto(x, 120))
    && lista(p.parciales, 6, (x) => typeof x === 'string' && x in ATRIBUTOS)
    && (p.sentidos === undefined || esTexto(p.sentidos, 100))
    && lista(p.saberes, 20, (x) => esTexto(x, 60))
    && lista(p.dotes, 60, (x) => obj(x) && esTexto(x.id, 80) && esTexto(x.nombre, 80) && esTexto(x.tipo, 20) && esEntero(x.nivel, 1, 20))
    && lista(p.inventario, 200, (x) => obj(x) && esTexto(x.id, 80) && esTexto(x.nombre, 80) && esEntero(x.cantidad, 0, 9999)
      && typeof x.bulto === 'number' && x.bulto >= 0 && x.bulto <= 50)
    && (monedas === undefined || (obj(monedas) && esEntero(monedas.oro, 0, 1e7) && esEntero(monedas.plata, 0, 1e7) && esEntero(monedas.cobre, 0, 1e7)))
    && (claseCD === undefined || (obj(claseCD) && typeof claseCD.atributo === 'string' && claseCD.atributo in ATRIBUTOS && esRango(claseCD.rango)))
    && (escudo === undefined || (obj(escudo) && esTexto(escudo.nombre, 60) && esEntero(escudo.ca, 0, 4) && esEntero(escudo.dureza, 0, 50)
      && esEntero(escudo.pg, 0, 500) && esEntero(escudo.pgActual, 0, 500)));
}

function esLanzadorValido(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null) return false;
  const l = valor as Record<string, unknown>;
  return ['arcane', 'divine', 'occult', 'primal'].includes(l.tradicion as string)
    && typeof l.atributo === 'string' && l.atributo in ATRIBUTOS && esRango(l.rango);
}

function esGolpeValido(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null) return false;
  const g = valor as Record<string, unknown>;
  return esTexto(g.id, 100) && esTexto(g.nombre, 60)
    && (g.atributo === 'str' || g.atributo === 'dex')
    && esRango(g.rango) && esEntero(g.bonoObjeto, 0, 4)
    && typeof g.dados === 'string' && leerDados(g.dados) !== null
    && esTexto(g.tipoDano, 30)
    && typeof g.sumarFuerza === 'boolean' && typeof g.agil === 'boolean'
    && (g.distancia === undefined || esEntero(g.distancia, 5, 1000));
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

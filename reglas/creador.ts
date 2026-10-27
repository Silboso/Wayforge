// El creador de personajes: de las elecciones (ascendencia, trasfondo, clase, mejoras, skills, dotes,
// conjuros y equipo) sale una ficha completa. Puro: la interfaz solo guarda las elecciones y muestra el resultado.

import { HABILIDADES, type Atributo, type ClaveHabilidad, type Golpe, type Personaje, type Rango } from './pf2e';
import { RECURSOS_VACIOS, type Aptitud, type Lanzador } from './aptitudes';
import { ASCENDENCIAS } from './datos/ascendencias';
import { TRASFONDOS } from './datos/trasfondos';
import { CLASES } from './datos/clases';
import { DOTES, doteDe } from './datos/dotes';
import { CONJUROS } from './datos/conjuros';
import { ARMADURAS, ARMAS, DINERO_INICIAL, EQUIPO, ESCUDOS } from './datos/equipo';
import type { Arma, Clase, Conjuro, Tradicion } from './datos/tipos';

export interface Eleccion {
  ascendencia: string | null;
  herencia: string | null;
  // Regla del remaster: en vez de las mejoras y el defecto de la ascendencia, dos mejoras libres
  dosLibres: boolean;
  // Una por cada mejora "libre" de la ascendencia (o las dos de la regla anterior)
  mejorasAscendencia: (Atributo | null)[];
  trasfondo: string | null;
  // [la que eliges entre las dos del trasfondo, la libre]
  mejorasTrasfondo: [Atributo | null, Atributo | null];
  clase: string | null;
  subclase: string | null;
  atributoClave: Atributo | null;
  // Las cuatro mejoras libres de nivel 1
  mejorasLibres: (Atributo | null)[];
  // Las skills que elige el jugador (las que pide la clase y las libres)
  habilidades: ClaveHabilidad[];
  doteAscendencia: string | null;
  doteClase: string | null;
  // Versatile Human o General Training
  doteGeneral: string | null;
  trucos: string[];
  conjuros: string[];
  // Lo que se eligió del compendio completo en vez de las listas de arriba. Se guarda ya convertido
  // (el compendio se carga aparte y construir es puro)
  delCompendio: ElegidoCompendio[];
  armas: string[];
  armadura: string;
  escudo: string | null;
  equipo: { id: string; cantidad: number }[];
  idiomas: string[];
}

// Para qué hueco se eligió: cuenta igual que la dote o el conjuro de la lista corta
export type RanuraCompendio = 'ascendencia' | 'clase' | 'general' | 'truco' | 'rango1';
export interface ElegidoCompendio {
  ranura: RanuraCompendio;
  id: string;
  nombre: string;
  // ancestry, class, general… (para la lista de dotes de la ficha)
  categoria: string;
  nivel: number;
  // null para las dotes pasivas: van solo a la lista de dotes
  aptitud: Aptitud | null;
}

export const delCompendio = (e: Eleccion, ranura: RanuraCompendio) => (e.delCompendio ?? []).filter((x) => x.ranura === ranura);
// Lo elegido en cada hueco, de la lista corta o del compendio
export const tieneDote = (e: Eleccion, ranura: 'ascendencia' | 'clase' | 'general') =>
  !!(ranura === 'ascendencia' ? e.doteAscendencia : ranura === 'clase' ? e.doteClase : e.doteGeneral) || delCompendio(e, ranura).length > 0;
export const trucosElegidos = (e: Eleccion) => e.trucos.length + delCompendio(e, 'truco').length;
export const conjurosElegidos = (e: Eleccion) => e.conjuros.length + delCompendio(e, 'rango1').length;

export const ELECCION_VACIA: Eleccion = {
  ascendencia: null, herencia: null, dosLibres: false, mejorasAscendencia: [],
  trasfondo: null, mejorasTrasfondo: [null, null],
  clase: null, subclase: null, atributoClave: null,
  mejorasLibres: [null, null, null, null],
  habilidades: [], doteAscendencia: null, doteClase: null, doteGeneral: null,
  trucos: [], conjuros: [], delCompendio: [], armas: [], armadura: 'none', escudo: null, equipo: [], idiomas: [],
};

const asc = (e: Eleccion) => ASCENDENCIAS.find((a) => a.id === e.ascendencia);
const tras = (e: Eleccion) => TRASFONDOS.find((t) => t.id === e.trasfondo);
const cla = (e: Eleccion) => CLASES.find((c) => c.id === e.clase);

// Cuántas mejoras libres pide la ascendencia (las fijas no se eligen)
export function libresDeAscendencia(e: Eleccion): number {
  const a = asc(e);
  if (!a) return 0;
  return e.dosLibres ? 2 : a.mejoras.filter((m) => m === 'libre').length;
}

// Cada mejora de atributo, de dónde viene (para mostrar la cuenta y validar que no se repitan en un mismo paso)
export function fuentesDeMejoras(e: Eleccion): { atributo: Atributo; fuente: string; valor: number }[] {
  const lista: { atributo: Atributo; fuente: string; valor: number }[] = [];
  const a = asc(e);
  if (a) {
    if (!e.dosLibres) {
      for (const m of a.mejoras) if (m !== 'libre') lista.push({ atributo: m, fuente: a.nombre, valor: 1 });
      if (a.defecto) lista.push({ atributo: a.defecto, fuente: `${a.nombre} (defecto)`, valor: -1 });
    }
    for (const m of e.mejorasAscendencia.slice(0, libresDeAscendencia(e))) if (m) lista.push({ atributo: m, fuente: a.nombre, valor: 1 });
  }
  const t = tras(e);
  if (t) for (const m of e.mejorasTrasfondo) if (m) lista.push({ atributo: m, fuente: t.nombre, valor: 1 });
  const c = cla(e);
  if (c && e.atributoClave) lista.push({ atributo: e.atributoClave, fuente: `${c.nombre} (clave)`, valor: 1 });
  for (const m of e.mejorasLibres) if (m) lista.push({ atributo: m, fuente: 'Nivel 1', valor: 1 });
  return lista;
}

export function atributosDe(e: Eleccion): Record<Atributo, number> {
  const r = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  for (const f of fuentesDeMejoras(e)) r[f.atributo] += f.valor;
  return r;
}

// Las skills que ya vienen dadas (clase, trasfondo, subclase), sin contar las que elige el jugador
export function habilidadesDadas(e: Eleccion): { clave: ClaveHabilidad; fuente: string }[] {
  const lista: { clave: ClaveHabilidad; fuente: string }[] = [];
  const c = cla(e);
  if (c) for (const h of c.habilidadesFijas) lista.push({ clave: h, fuente: c.nombre });
  const sub = c?.subclase?.opciones.find((o) => o.id === e.subclase);
  if (sub?.habilidad) lista.push({ clave: sub.habilidad, fuente: sub.nombre });
  const t = tras(e);
  if (t) lista.push({ clave: t.habilidad, fuente: t.nombre });
  return lista;
}

// Cuántas skills elige el jugador: los grupos de la clase, las libres, su Int, y una más por cada repetida
export function habilidadesAElegir(e: Eleccion): number {
  const c = cla(e);
  if (!c) return 0;
  const dadas = habilidadesDadas(e).map((h) => h.clave);
  const repetidas = dadas.length - new Set(dadas).size;
  const int = Math.max(0, atributosDe(e).int);
  const extra = (e.herencia === 'skilled' ? 1 : 0) + (e.doteAscendencia === 'natural-skill' ? 2 : 0);
  return c.habilidadesAElegir.length + c.habilidadesLibres + int + repetidas + extra;
}

export function tradicionDe(e: Eleccion): Tradicion | null {
  const c = cla(e);
  if (!c?.lanzador) return null;
  if (c.lanzador.tradicion !== 'segun-eleccion') return c.lanzador.tradicion;
  return c.subclase?.opciones.find((o) => o.id === e.subclase)?.tradicion ?? null;
}

// Los conjuros que puede aprender: de su tradición, y del rango que corresponde
export function conjurosDisponibles(e: Eleccion, rango: number): Conjuro[] {
  const t = tradicionDe(e);
  return t ? CONJUROS.filter((x) => x.rango === rango && x.tradiciones.includes(t)) : [];
}

// Cuántos conjuros de rango 1 elige: el repertorio de los espontáneos, o lo que lleva su libro/familiar
export function conjurosAElegir(e: Eleccion): { trucos: number; rango1: number } {
  const l = cla(e)?.lanzador;
  if (!l || (l.trucos === 0 && l.espacios === 0)) return { trucos: 0, rango1: 0 };
  return { trucos: l.trucos, rango1: l.tipo === 'espontaneo' ? (l.repertorio ?? 0) : l.espacios + 2 };
}

export function idiomasAElegir(e: Eleccion): number {
  const extra = e.ascendencia === 'human' ? 1 : 0;
  return Math.max(0, atributosDe(e).int) + extra + (e.doteAscendencia === 'multilingual' ? 2 : 0);
}

export function gastoDe(e: Eleccion): number {
  let total = 0;
  for (const id of e.armas) {
    const a = ARMAS.find((x) => x.id === id);
    // La daga del clan es un regalo para los enanos
    if (a && !(id === 'clan-dagger' && e.ascendencia === 'dwarf')) total += a.precio;
  }
  total += ARMADURAS.find((x) => x.id === e.armadura)?.precio ?? 0;
  if (e.escudo) total += ESCUDOS.find((x) => x.id === e.escudo)?.precio ?? 0;
  for (const it of e.equipo) total += (EQUIPO.find((x) => x.id === it.id)?.precio ?? 0) * it.cantidad;
  return Math.round(total * 10) / 10;
}

// Las dotes que puede tomar cada uno
export function dotesDeAscendencia(e: Eleccion) {
  const extra = e.herencia === 'aiuvarin' ? 'elf' : e.herencia === 'dromaar' ? 'orc' : null;
  return DOTES.filter((d) => d.tipo === 'ascendencia' && (d.de === e.ascendencia || (extra && d.de === extra)));
}
export function dotesDeClase(e: Eleccion) {
  return DOTES.filter((d) => d.tipo === 'clase' && d.de === e.clase);
}
export function necesitaDoteGeneral(e: Eleccion): boolean {
  return e.herencia === 'versatile' || e.doteAscendencia === 'general-training';
}

export interface Pendiente { paso: Paso; falta: string }
export type Paso = 'ascendencia' | 'trasfondo' | 'clase' | 'atributos' | 'habilidades' | 'dotes' | 'conjuros' | 'equipo' | 'detalles';

// Lo que falta elegir en cada paso, en palabras
export function pendientes(e: Eleccion): Pendiente[] {
  const lista: Pendiente[] = [];
  const a = asc(e);
  const c = cla(e);
  if (!a) lista.push({ paso: 'ascendencia', falta: 'Elige una ascendencia' });
  else if (!e.herencia) lista.push({ paso: 'ascendencia', falta: 'Elige una herencia' });
  if (!tras(e)) lista.push({ paso: 'trasfondo', falta: 'Elige un trasfondo' });
  if (!c) lista.push({ paso: 'clase', falta: 'Elige una clase' });
  else if (c.subclase && !e.subclase) lista.push({ paso: 'clase', falta: `Elige tu ${c.subclase.titulo}` });

  const libresAsc = libresDeAscendencia(e);
  const elegidasAsc = e.mejorasAscendencia.slice(0, libresAsc).filter(Boolean) as Atributo[];
  if (a && elegidasAsc.length < libresAsc) lista.push({ paso: 'atributos', falta: `Faltan ${libresAsc - elegidasAsc.length} mejora(s) de ${a.nombre}` });
  if (a && !e.dosLibres && elegidasAsc.some((m) => a.mejoras.includes(m))) lista.push({ paso: 'atributos', falta: `La mejora libre de ${a.nombre} no puede repetir una fija` });
  if (new Set(elegidasAsc).size < elegidasAsc.length) lista.push({ paso: 'atributos', falta: `Las mejoras de ${a?.nombre} deben ser distintas` });
  const [t1, t2] = e.mejorasTrasfondo;
  if (tras(e) && (!t1 || !t2)) lista.push({ paso: 'atributos', falta: 'Faltan mejoras del trasfondo' });
  if (t1 && t2 && t1 === t2) lista.push({ paso: 'atributos', falta: 'Las dos mejoras del trasfondo deben ser distintas' });
  if (c && !e.atributoClave) lista.push({ paso: 'atributos', falta: 'Elige tu atributo clave' });
  const libres = e.mejorasLibres.filter(Boolean) as Atributo[];
  if (libres.length < 4) lista.push({ paso: 'atributos', falta: `Faltan ${4 - libres.length} mejoras libres` });
  if (new Set(libres).size < libres.length) lista.push({ paso: 'atributos', falta: 'Las 4 mejoras libres deben ser distintas' });

  const total = habilidadesAElegir(e);
  if (c && e.habilidades.length < total) lista.push({ paso: 'habilidades', falta: `Te faltan ${total - e.habilidades.length} skill(s)` });
  if (c) {
    for (const grupo of c.habilidadesAElegir) {
      const dadas = habilidadesDadas(e).map((h) => h.clave);
      if (!grupo.some((h) => e.habilidades.includes(h) || dadas.includes(h))) {
        lista.push({ paso: 'habilidades', falta: `Elige ${grupo.map(nombreHabilidad).join(' o ')}` });
      }
    }
  }

  if (a && !tieneDote(e, 'ascendencia')) lista.push({ paso: 'dotes', falta: 'Elige una dote de ascendencia' });
  if (c && !tieneDote(e, 'clase') && dotesDeClase(e).length) lista.push({ paso: 'dotes', falta: 'Elige una dote de clase' });
  if (necesitaDoteGeneral(e) && !tieneDote(e, 'general')) lista.push({ paso: 'dotes', falta: 'Elige una dote general' });

  const pide = conjurosAElegir(e);
  if (pide.trucos && trucosElegidos(e) < pide.trucos) lista.push({ paso: 'conjuros', falta: `Te faltan ${pide.trucos - trucosElegidos(e)} truco(s)` });
  if (pide.rango1 && conjurosElegidos(e) < pide.rango1) lista.push({ paso: 'conjuros', falta: `Te faltan ${pide.rango1 - conjurosElegidos(e)} conjuro(s) de rango 1` });
  if (cla(e)?.lanzador && !tradicionDe(e)) lista.push({ paso: 'conjuros', falta: 'Elige primero tu subclase (decide tu tradición)' });

  if (gastoDe(e) > DINERO_INICIAL) lista.push({ paso: 'equipo', falta: 'Gastaste más de 15 po' });
  if (e.idiomas.length > idiomasAElegir(e)) lista.push({ paso: 'detalles', falta: 'Demasiados idiomas' });
  return lista;
}

function nombreHabilidad(h: ClaveHabilidad): string {
  return HABILIDADES.find((x) => x.clave === h)!.nombre;
}

// Qué competencia tiene con un arma
export function rangoConArma(c: Clase, arma: Arma, e: Eleccion): Rango {
  const porCategoria = arma.categoria === 'simple' ? c.armas.simples : arma.categoria === 'marcial' ? c.armas.marciales
    : arma.categoria === 'avanzada' ? c.armas.avanzadas : c.armas.sinArmas;
  const suelta = c.armas.extra?.some((n) => n.toLowerCase() === arma.nombre.toLowerCase()) ? 1 : 0;
  const familiar = familiaridad(e).includes(arma.id) ? Math.max(1, c.armas.marciales) : 0;
  return Math.max(porCategoria, suelta, familiar) as Rango;
}

// Armas de las dotes de "Weapon Familiarity"
function familiaridad(e: Eleccion): string[] {
  switch (e.doteAscendencia) {
    case 'dwarven-weapon-familiarity': return ['battle-axe', 'pick', 'warhammer'];
    case 'elven-weapon-familiarity': return ['longbow', 'composite-longbow', 'rapier', 'shortbow', 'composite-shortbow'];
    case 'halfling-weapon-familiarity': return ['sling', 'shortsword'];
    case 'orc-weapon-familiarity': return ['falchion', 'greataxe'];
    default: return [];
  }
}

function golpeDe(arma: Arma, c: Clase, e: Eleccion, attr: Record<Atributo, number>): Golpe {
  const distancia = arma.tipo === 'distancia';
  const finesse = arma.rasgos.includes('finesse');
  const usaDex = distancia || (finesse && attr.dex > attr.str);
  const arrojadiza = arma.rasgos.some((r) => r.startsWith('thrown'));
  const alcance = arma.rasgos.includes('reach') ? 10 : undefined;
  const monje = e.clase === 'monk' && arma.id === 'fist';
  return {
    id: `arma-${arma.id}`,
    nombre: arma.nombre,
    atributo: usaDex ? 'dex' : 'str',
    rango: rangoConArma(c, arma, e),
    bonoObjeto: 0,
    dados: monje ? '1d6' : arma.dados,
    tipoDano: { B: 'bludgeoning', P: 'piercing', S: 'slashing' }[arma.tipoDano],
    sumarFuerza: !distancia || arrojadiza,
    agil: arma.rasgos.includes('agile'),
    ...(distancia ? { distancia: arma.distancia } : alcance ? { distancia: alcance } : {}),
  };
}

function aptitudDeConjuro(x: Conjuro): Aptitud {
  const salvacion = x.defensa && x.defensa !== 'ataque' ? ` Salvación básica de ${x.defensa[0]!.toUpperCase()}${x.defensa.slice(1)}.` : '';
  return {
    id: `conjuro:${x.id}`,
    nombre: x.nombre,
    verbo: x.nombre,
    categoria: x.rango === 0 ? 'truco' : 'conjuro',
    costo: x.costo,
    recuperacion: x.rango === 0 ? { tipo: 'siempre' } : { tipo: 'espacio', rango: x.rango },
    descripcion: `${x.descripcion}${x.defensa === 'ataque' ? '' : salvacion}${x.potenciado ? ` Más fuerte: ${x.potenciado}.` : ''}`,
    rasgos: [x.rango === 0 ? 'cantrip' : 'spell', ...x.rasgos],
    ...(x.defensa === 'ataque' ? { tirada: { tipo: 'ataque-conjuro' as const } } : x.dano ? { tirada: { tipo: 'expresion' as const, expresion: x.dano } } : {}),
    ...(x.dano ? { dano: x.dano } : {}),
    ...(x.distancia !== null ? { distancia: Math.max(5, x.distancia) } : {}),
  };
}

// La ficha completa a partir de las elecciones (nivel 1)
export function construir(e: Eleccion, base: Pick<Personaje, 'id' | 'nombre'> & Partial<Personaje>): Personaje {
  const a = asc(e);
  const t = tras(e);
  const c = cla(e);
  const herencia = a?.herencias.find((h) => h.id === e.herencia);
  const sub = c?.subclase?.opciones.find((o) => o.id === e.subclase);
  const attr = atributosDe(e);

  const habilidades = Object.fromEntries(HABILIDADES.map((h) => [h.clave, 0])) as Record<ClaveHabilidad, Rango>;
  for (const h of [...habilidadesDadas(e).map((x) => x.clave), ...e.habilidades]) habilidades[h] = 1;
  // Las dotes de "Lore" de ascendencia que dan skills
  const deDote: Record<string, ClaveHabilidad[]> = {
    'dwarven-lore': ['crafting', 'religion'], 'elven-lore': ['arcana', 'nature'], 'halfling-lore': ['acrobatics', 'stealth'],
    'leshy-lore': ['nature', 'stealth'], 'beast-trainer': ['nature'],
  };
  for (const h of deDote[e.doteAscendencia ?? ''] ?? []) habilidades[h] = Math.max(habilidades[h], 1) as Rango;

  // Armadura: su categoría decide la competencia; si no llega a la Fuerza pedida, frena un poco más
  const armadura = ARMADURAS.find((x) => x.id === e.armadura) ?? ARMADURAS[0]!;
  const rangoArmadura = c ? c.defensa[{ 'sin-armadura': 'sinArmadura', ligera: 'ligera', media: 'media', pesada: 'pesada' }[armadura.categoria] as keyof Clase['defensa']] : 0;
  const frenoArmadura = e.doteAscendencia === 'unburdened-iron' ? 0
    : attr.str >= armadura.fuerza ? Math.min(0, armadura.velocidad + 5) : armadura.velocidad;
  const velocidad = (a?.velocidad ?? 25) + (herencia?.efecto?.velocidad ?? 0)
    + (e.doteAscendencia === 'nimble-elf' ? 5 : 0) + (e.doteGeneral === 'fleet' ? 5 : 0) + frenoArmadura;

  const golpes: Golpe[] = c ? e.armas.map((id) => ARMAS.find((x) => x.id === id)).filter((x): x is Arma => !!x).map((x) => golpeDe(x, c, e, attr)) : [];
  if (c && (golpes.length === 0 || e.clase === 'monk')) golpes.push(golpeDe(ARMAS.find((x) => x.id === 'fist')!, c, e, attr));

  // Aptitudes: lo de la clase, las dotes que se usan en la mesa, los conjuros y los consumibles
  const aptitudes: Aptitud[] = [];
  c?.aptitudes.forEach((x, i) => aptitudes.push({ ...x, id: `clase:${c.id}:${i}` }));
  const dotes = [e.doteAscendencia, e.doteClase, e.doteGeneral, t?.dote].filter((x): x is string => !!x).map((id) => doteDe(id)).filter((x) => !!x);
  for (const d of dotes) if (d.aptitud && !aptitudes.some((x) => x.nombre === d.nombre)) aptitudes.push({ ...d.aptitud, nombre: d.aptitud.nombre || d.nombre, id: `dote:${d.id}` });
  for (const id of [...e.trucos, ...e.conjuros]) {
    const x = CONJUROS.find((y) => y.id === id);
    if (x) aptitudes.push(aptitudDeConjuro(x));
  }
  const extras = e.delCompendio ?? [];
  for (const x of extras) if (x.aptitud && !aptitudes.some((y) => y.id === x.aptitud!.id)) aptitudes.push(x.aptitud);
  for (const it of e.equipo) {
    const x = EQUIPO.find((y) => y.id === it.id);
    if (x?.aptitud) aptitudes.push({ ...x.aptitud, id: `objeto:${x.id}`, recuperacion: { tipo: 'consumible', cantidad: it.cantidad } });
  }

  const tradicion = tradicionDe(e);
  const lanzador: Lanzador | null = c?.lanzador && tradicion && e.atributoClave
    ? { tradicion, atributo: e.atributoClave, rango: 1 }
    : null;
  const espacios = c?.lanzador?.espacios ? [{ rango: 1, max: c.lanzador.espacios + (e.clase === 'wizard' && e.subclase !== 'unified-theory' ? 1 : 0), usados: 0 }] : [];
  const foco = c?.lanzador?.foco ?? 0;

  const pgAscendencia = (herencia?.efecto?.pg ?? a?.pg ?? 8) + (e.doteGeneral === 'toughness' ? 1 : 0);
  const pgClase = c?.pg ?? 8;
  const restante = Math.max(0, DINERO_INICIAL - gastoDe(e));
  const inventario = [
    ...e.armas.map((id) => ARMAS.find((x) => x.id === id)).filter((x) => !!x).map((x) => ({ id: x.id, nombre: x.nombre, cantidad: 1, bulto: x.bulto })),
    ...(armadura.id !== 'none' ? [{ id: armadura.id, nombre: armadura.nombre, cantidad: 1, bulto: armadura.bulto }] : []),
    ...(e.escudo ? ESCUDOS.filter((x) => x.id === e.escudo).map((x) => ({ id: x.id, nombre: x.nombre, cantidad: 1, bulto: x.bulto })) : []),
    ...e.equipo.map((it) => ({ it, x: EQUIPO.find((y) => y.id === it.id) })).filter((p) => !!p.x)
      .map(({ it, x }) => ({ id: x!.id, nombre: x!.nombre, cantidad: it.cantidad, bulto: x!.bulto, ...(x!.aptitud ? { aptitudId: `objeto:${x!.id}` } : {}) })),
  ];
  const escudo = e.escudo ? ESCUDOS.find((x) => x.id === e.escudo) : undefined;

  const notas = [
    herencia && `Herencia: ${herencia.nombre}. ${herencia.descripcion}`,
    a?.especial,
    t && `Trasfondo: ${t.nombre} (${t.saber}).`,
    sub && `${c!.subclase!.titulo}: ${sub.nombre}. ${sub.descripcion}`,
    ...(c?.rasgos.map((r) => `${r.nombre}: ${r.descripcion}`) ?? []),
    ...dotes.map((d) => `${d.nombre}: ${d.descripcion}`),
  ].filter(Boolean).join('\n');

  const nivel = 1;
  return {
    ...base,
    id: base.id,
    nombre: base.nombre,
    ascendencia: a ? (herencia ? `${a.nombre} (${herencia.nombre})` : a.nombre) : '',
    clase: c?.nombre ?? '',
    nivel,
    atributos: attr,
    pgAscendencia,
    pgClase,
    pgActual: pgAscendencia + (pgClase + attr.con) * nivel,
    pgTemporales: 0,
    velocidad: Math.max(5, velocidad),
    percepcion: c?.percepcion ?? 1,
    salvaciones: c?.salvaciones ?? { fortitude: 1, reflex: 1, will: 1 },
    armadura: { nombre: armadura.id === 'none' ? '' : armadura.nombre, rango: rangoArmadura, bonoObjeto: armadura.ca, topeDex: armadura.topeDex },
    habilidades,
    golpes,
    notas,
    aptitudes,
    lanzador,
    recursos: { ...RECURSOS_VACIOS, foco: { max: foco, actual: foco }, espacios },
    origen: { ascendencia: e.ascendencia ?? '', herencia: e.herencia, trasfondo: e.trasfondo ?? '', clase: e.clase ?? '', subclase: e.subclase },
    idiomas: [...(a?.idiomas ?? []), ...e.idiomas],
    sentidos: herencia?.efecto?.sentidos ?? a?.sentidos ?? '',
    saberes: t ? [t.saber] : [],
    dotes: [
      ...dotes.map((d) => ({ id: d.id, nombre: d.nombre, tipo: d.tipo, nivel: d.nivel })),
      ...extras.filter((x) => x.ranura !== 'truco' && x.ranura !== 'rango1')
        .map((x) => ({ id: x.id.slice(0, 80), nombre: x.nombre.slice(0, 80), tipo: x.categoria.slice(0, 20), nivel: Math.min(20, Math.max(1, x.nivel)) })),
    ],
    inventario,
    monedas: { oro: Math.floor(restante / 10), plata: Math.floor(restante % 10), cobre: Math.round((restante * 10) % 10) },
    ...(c && e.atributoClave ? { claseCD: { atributo: e.atributoClave, rango: 1 as Rango } } : {}),
    ...(escudo ? { escudo: { nombre: escudo.nombre, ca: escudo.ca, dureza: escudo.dureza, pg: escudo.pg, pgActual: escudo.pg } } : {}),
  };
}


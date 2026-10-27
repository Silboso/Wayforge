// Importar un personaje de Pathbuilder 2e: el JSON que da "Export JSON" (json.php?id=…) se vuelve una ficha de la mesa.
// Pathbuilder trae los números ya hechos (competencias, runas, CA); las dotes, conjuros y objetos se buscan por
// nombre en el compendio para que lleguen con su texto, su costo y lo que hacen en combate.

import type { Aptitud, Lanzador, Recursos } from './aptitudes';
import {
  conjuroAAptitud, doteAAptitud,
  type AccionCompendio, type ConjuroCompendio, type DoteCompendio, type EntradaCompendio, type EquipoCompendio,
  type GenericoCompendio, type Indice, type TipoCompendio,
} from './compendio';
import {
  ATRIBUTOS, calcular, esPersonajeValido, HABILIDADES, SALVACIONES, signo,
  type Atributo, type ClaveHabilidad, type ClaveSalvacion, type Golpe, type Personaje, type Rango,
} from './pf2e';

// Lo que usamos del JSON de Pathbuilder (todo opcional: las versiones viejas no traen todo)
export interface ArmaPathbuilder {
  name: string;
  display?: string;
  prof?: string;
  die?: string;
  pot?: number;
  str?: string;
  damageType?: string;
  attack?: number;
  damageBonus?: number;
}

export interface ArmaduraPathbuilder {
  name: string;
  display?: string;
  prof?: string;
  pot?: number;
  worn?: boolean;
}

export interface LanzadorPathbuilder {
  name?: string;
  magicTradition?: string;
  spellcastingType?: string;
  ability?: string;
  proficiency?: number;
  innate?: boolean;
  perDay?: number[];
  spells?: { spellLevel: number; list: string[] }[];
  prepared?: { spellLevel: number; list: string[] }[];
}

export interface BuildPathbuilder {
  name: string;
  class: string;
  dualClass?: string | null;
  level: number;
  ancestry: string;
  heritage?: string;
  background?: string;
  deity?: string;
  keyability?: string;
  languages?: string[];
  attributes?: { ancestryhp?: number; classhp?: number; bonushp?: number; bonushpPerLevel?: number; speed?: number; speedBonus?: number };
  abilities: Record<Atributo, number>;
  proficiencies: Record<string, number>;
  specificProficiencies?: { trained?: string[]; expert?: string[]; master?: string[]; legendary?: string[] };
  feats?: unknown[][];
  specials?: string[];
  lores?: [string, number][];
  equipment?: unknown[][];
  weapons?: ArmaPathbuilder[];
  armor?: ArmaduraPathbuilder[];
  money?: { cp?: number; sp?: number; gp?: number; pp?: number };
  spellCasters?: LanzadorPathbuilder[];
  focusPoints?: number;
  focus?: Record<string, Record<string, { focusCantrips?: string[]; focusSpells?: string[] }>>;
  acTotal?: { acProfBonus?: number; acAbilityBonus?: number; acItemBonus?: number; acTotal?: number; shieldBonus?: number | string | null };
}

// Acepta lo que devuelve json.php ({ success, build }) o el build solo. null si no parece de Pathbuilder.
export function leerPathbuilder(texto: string): BuildPathbuilder | null {
  let datos: unknown;
  try { datos = JSON.parse(texto.trim()); } catch { return null; }
  if (typeof datos !== 'object' || datos === null) return null;
  const raiz = datos as Record<string, unknown>;
  const b = (typeof raiz.build === 'object' && raiz.build !== null ? raiz.build : raiz) as Record<string, unknown>;
  const abilities = b.abilities as Record<string, unknown> | undefined;
  const ok = typeof b.name === 'string' && typeof b.class === 'string' && typeof b.level === 'number'
    && typeof abilities === 'object' && abilities !== null && (Object.keys(ATRIBUTOS) as Atributo[]).every((a) => typeof abilities[a] === 'number')
    && typeof b.proficiencies === 'object' && b.proficiencies !== null;
  return ok ? (b as unknown as BuildPathbuilder) : null;
}

// ---------- Buscar en el compendio por nombre ----------

export type Buscador = (tipo: TipoCompendio, nombre: string) => Promise<EntradaCompendio | null>;

// "Explorer's Clothing" y "explorers clothing" son lo mismo
const normal = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Arma el buscador con las dos funciones de carga (las del navegador, o leer los archivos en las pruebas)
export function buscadorDe(indice: (tipo: TipoCompendio) => Promise<Indice[]>, entrada: (tipo: TipoCompendio, id: string) => Promise<EntradaCompendio | null>): Buscador {
  const mapas = new Map<TipoCompendio, Promise<Map<string, string>>>();
  const mapaDe = (tipo: TipoCompendio) => {
    let m = mapas.get(tipo);
    if (!m) {
      m = indice(tipo).then((filas) => {
        const r = new Map<string, string>();
        for (const f of filas) if (!r.has(normal(f.nombre))) r.set(normal(f.nombre), f.id);
        return r;
      });
      mapas.set(tipo, m);
    }
    return m;
  };
  return async (tipo, nombre) => {
    const m = await mapaDe(tipo);
    // Tal cual; sin lo de entre paréntesis ("Weapon Proficiency (Martial)"); sin el "+1 Striking" del principio
    const intentos = [nombre, nombre.replace(/\s*\(.*\)\s*$/, ''), nombre.replace(/^\+\d\s+((greater|major)\s+)?(striking\s+)?/i, '')];
    for (const n of intentos) {
      const id = m.get(normal(n));
      if (id) return entrada(tipo, id);
    }
    return null;
  };
}

// ---------- La traducción ----------

export interface Importado {
  personaje: Personaje;
  // Lo que conviene revisar (números que no cuadran, cosas que se dejaron afuera)
  avisos: string[];
  // Lo que no se encontró en el compendio: queda en la lista de dotes o en las notas, sin acción en la mesa
  sinEncontrar: string[];
}

const corto = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : 0)));
const rangoDe = (v: number | undefined): Rango => entre((v ?? 0) / 2, 0, 4) as Rango;
const slug = (t: string) => normal(t).replace(/ /g, '-');
const esAtributo = (a: unknown): a is Atributo => typeof a === 'string' && a in ATRIBUTOS;
const TRADICIONES = ['arcane', 'divine', 'occult', 'primal'] as const;
const esTradicion = (t: unknown): t is Lanzador['tradicion'] => typeof t === 'string' && (TRADICIONES as readonly string[]).includes(t);
const DADOS_RUNA: Record<string, number> = { '': 1, striking: 2, greaterStriking: 3, majorStriking: 4 };
const TIPOS_DANO: Record<string, string> = { B: 'bludgeoning', P: 'piercing', S: 'slashing' };
const TIPOS_DOTE: Record<string, string> = {
  'Ancestry Feat': 'ancestry', 'Class Feat': 'class', 'Skill Feat': 'skill', 'General Feat': 'general',
  'Archetype Feat': 'archetype', 'Awarded Feat': 'bonus', 'Background Feat': 'background',
};

// Pathbuilder guarda los atributos como puntuaciones (18 = +4); por si alguna versión trae ya el modificador
function modificador(v: number): number {
  return v >= 8 ? Math.floor((v - 10) / 2) : v;
}

export async function desdePathbuilder(b: BuildPathbuilder, id: string, buscar: Buscador): Promise<Importado> {
  const avisos: string[] = [];
  const sinEncontrar: string[] = [];
  const nivel = entre(b.level, 1, 20);
  const prof = b.proficiencies;
  const atributos = Object.fromEntries((Object.keys(ATRIBUTOS) as Atributo[]).map((a) => [a, entre(modificador(b.abilities[a]), -5, 10)])) as Record<Atributo, number>;
  // Una puntuación impar de 19 o más es medio aumento anotado (el siguiente sube el modificador)
  const parciales = (Object.keys(ATRIBUTOS) as Atributo[]).filter((a) => b.abilities[a] >= 19 && b.abilities[a] % 2 === 1);
  const competencia = (r: Rango) => (r === 0 ? 0 : r * 2 + nivel);

  // Buscar sin repetir (la misma dote puede venir dos veces)
  const cache = new Map<string, Promise<EntradaCompendio | null>>();
  const hallar = <T extends EntradaCompendio>(tipo: TipoCompendio, nombre: string) => {
    const clave = `${tipo}|${nombre}`;
    if (!cache.has(clave)) cache.set(clave, buscar(tipo, nombre).catch(() => null));
    return cache.get(clave)! as Promise<T | null>;
  };

  // --- Golpes: Pathbuilder da el ataque total; de ahí se deduce el atributo y la competencia que usa ---
  const especificas = b.specificProficiencies ?? {};
  const rangoEspecifico = (nombre: string): Rango => {
    const n = normal(nombre);
    const en = (l?: string[]) => (l ?? []).some((x) => normal(x) === n);
    return en(especificas.legendary) ? 4 : en(especificas.master) ? 3 : en(especificas.expert) ? 2 : en(especificas.trained) ? 1 : 0;
  };
  const golpes: Golpe[] = [];
  const diferenciasDano: string[] = [];
  const armas = [...(b.weapons ?? [])];
  if (armas.length === 0) armas.push({ name: 'Fist', die: 'd4', damageType: 'B', prof: 'unarmed' });
  for (const [i, w] of armas.slice(0, 20).entries()) {
    const e = await hallar<EquipoCompendio>('equipo', w.name);
    const arma = e?.arma;
    const rasgos = e?.rasgos ?? (normal(w.name) === 'fist' ? ['agile', 'finesse', 'nonlethal', 'unarmed'] : []);
    const arrojadiza = rasgos.some((r) => r.startsWith('thrown'));
    const distancia = !!arma?.distancia && !arrojadiza;
    const finesse = rasgos.includes('finesse');
    const pot = entre(w.pot ?? 0, 0, 4);
    const base = Math.max(rangoDe(prof[w.prof ?? ''] ?? 0), rangoEspecifico(w.name)) as Rango;
    // Qué atributo y rango explican el ataque de Pathbuilder (primero el rango que dice su categoría)
    const posibles: Golpe['atributo'][] = distancia ? ['dex'] : finesse ? ['str', 'dex'] : ['str'];
    const porRegla: Golpe['atributo'] = distancia || (finesse && atributos.dex > atributos.str) ? 'dex' : 'str';
    let atributo = porRegla;
    let rango = base;
    if (typeof w.attack === 'number') {
      const rangos = [base, 0, 1, 2, 3, 4].filter((r, k, l) => l.indexOf(r) === k) as Rango[];
      const hallado = rangos.flatMap((r) => [porRegla, ...posibles.filter((a) => a !== porRegla)].map((a) => ({ a, r })))
        .find(({ a, r }) => atributos[a] + competencia(r) + pot === w.attack);
      if (hallado) ({ a: atributo, r: rango } = hallado);
      else avisos.push(`El ataque de ${w.display || w.name} no cuadra: en Pathbuilder es ${signo(w.attack)}, aquí ${signo(atributos[porRegla] + competencia(base) + pot)}.`);
    }
    const caras = /^d(4|6|8|10|12)$/.test(w.die ?? '') ? w.die! : arma?.dados.replace(/^\d+/, '') ?? 'd4';
    const sumarFuerza = !distancia || arrojadiza;
    const g: Golpe = {
      id: `pb-arma-${i}-${slug(w.name)}`.slice(0, 100),
      nombre: corto(w.display || w.name, 60),
      atributo,
      rango,
      bonoObjeto: pot,
      dados: `${DADOS_RUNA[w.str ?? ''] ?? 1}${caras}`,
      tipoDano: TIPOS_DANO[w.damageType ?? ''] ?? arma?.tipoDano.slice(0, 30) ?? '',
      sumarFuerza,
      agil: rasgos.includes('agile'),
      ...(distancia ? { distancia: entre(arma!.distancia!, 5, 1000) } : rasgos.includes('reach') ? { distancia: 10 } : {}),
    };
    golpes.push(g);
    const nuestro = sumarFuerza ? atributos.str : 0;
    if (typeof w.damageBonus === 'number' && w.damageBonus !== nuestro) diferenciasDano.push(`${g.nombre} (${signo(w.damageBonus)} en Pathbuilder, ${signo(nuestro)} aquí)`);
  }
  if (diferenciasDano.length) avisos.push(`El bono de daño no es el mismo en: ${diferenciasDano.join(', ')}. Lo que falta (especialización, rasgos) súmalo a mano al tirar.`);

  // --- Armadura y escudo ---
  // La que lleva puesta (las versiones viejas no dicen "worn": entonces la primera que no sea escudo)
  const sinWorn = (b.armor ?? []).every((a) => a.worn === undefined);
  const puesta = (b.armor ?? []).find((a) => a.prof !== 'shield' && (sinWorn || a.worn));
  const ea = puesta ? await hallar<EquipoCompendio>('equipo', puesta.name) : null;
  const categoria = ea?.armadura?.categoria ?? (puesta?.prof && puesta.prof !== 'shield' ? puesta.prof : 'unarmored');
  const ac = b.acTotal ?? {};
  let topeDex: number | null = ea?.armadura?.topeDex ?? null;
  if (topeDex === null && typeof ac.acAbilityBonus === 'number' && ac.acAbilityBonus < atributos.dex) topeDex = entre(ac.acAbilityBonus, 0, 10);
  const armadura = {
    nombre: puesta && ea?.armadura ? corto(puesta.display || puesta.name, 60) : '',
    rango: rangoDe(prof[categoria]),
    bonoObjeto: entre(typeof ac.acItemBonus === 'number' ? ac.acItemBonus : (ea?.armadura?.ca ?? 0) + (puesta?.pot ?? 0), 0, 10),
    topeDex: topeDex === null ? null : entre(topeDex, 0, 10),
  };
  let escudo: Personaje['escudo'];
  const candidatosEscudo = [...(b.armor ?? []).map((a) => a.name), ...(b.equipment ?? []).map((x) => String(x[0] ?? ''))];
  for (const n of candidatosEscudo) {
    const e = await hallar<EquipoCompendio>('equipo', n);
    if (e?.escudo) {
      escudo = { nombre: corto(e.nombre, 60), ca: entre(e.escudo.ca, 0, 4), dureza: entre(e.escudo.dureza, 0, 50), pg: entre(e.escudo.pg, 0, 500), pgActual: entre(e.escudo.pg, 0, 500) };
      break;
    }
  }

  // --- Aptitudes: acciones de clase, dotes, conjuros ---
  const aptitudes: Aptitud[] = [];
  // Sin repetir: Reactive Strike puede venir como rasgo de clase y como dote
  const agregar = (a: Aptitud) => { if (!aptitudes.some((x) => x.id === a.id || x.nombre === a.nombre)) aptitudes.push(a); };

  for (const s of b.specials ?? []) {
    const e = await hallar<AccionCompendio>('acciones', s);
    if (e && e.costo !== null) {
      agregar({
        id: `compendio:accion:${e.id}`.slice(0, 100), nombre: corto(e.nombre, 60), verbo: corto(e.nombre, 60), categoria: 'accion',
        costo: e.costo, recuperacion: { tipo: 'siempre' }, descripcion: corto(e.descripcion, 2000), rasgos: e.rasgos.slice(0, 12).map((r) => r.slice(0, 30)),
      });
    }
  }

  const dotes: NonNullable<Personaje['dotes']> = [];
  let herenciaDote: string | null = null;
  for (const f of b.feats ?? []) {
    const nombre = typeof f[0] === 'string' ? f[0] : '';
    if (!nombre) continue;
    const extra = typeof f[1] === 'string' && f[1] ? f[1] : null;
    const tipo = typeof f[2] === 'string' ? f[2] : '';
    if (tipo === 'Heritage') { herenciaDote = nombre; continue; }
    const nivelDote = entre(typeof f[3] === 'number' ? f[3] : 1, 1, 20);
    const d = await hallar<DoteCompendio>('dotes', nombre);
    const mostrado = extra ? `${nombre} (${extra})` : nombre;
    if (!d) sinEncontrar.push(mostrado);
    dotes.push({
      id: (d ? d.id : `pb:${slug(nombre)}`).slice(0, 80),
      nombre: corto(mostrado, 80),
      tipo: (TIPOS_DOTE[tipo] ?? d?.categoria ?? (tipo.replace(/ Feat$/, '').toLowerCase() || 'feat')).slice(0, 20),
      nivel: nivelDote,
    });
    const a = d ? doteAAptitud(d) : null;
    if (a) agregar(a);
  }

  // Conjuros: el lanzador principal (no innato) da la tradición, el atributo y los espacios
  const lanzadores = (b.spellCasters ?? []).filter((c) => esTradicion(c.magicTradition));
  const principal = lanzadores.find((c) => !c.innate) ?? null;
  if (lanzadores.filter((c) => !c.innate).length > 1) avisos.push('Tiene más de una forma de lanzar conjuros: la mesa usa una sola (la primera) para el ataque y la CD, y suma los espacios.');
  const espaciosPorRango = new Map<number, number>();
  for (const c of lanzadores) {
    if (c.innate) continue;
    (c.perDay ?? []).forEach((n, rango) => { if (rango >= 1 && rango <= 10 && n > 0) espaciosPorRango.set(rango, (espaciosPorRango.get(rango) ?? 0) + n); });
  }
  const conjuroDe = async (nombre: string, rango: number, innato: boolean) => {
    const c = await hallar<ConjuroCompendio>('conjuros', nombre);
    if (!c) { sinEncontrar.push(nombre); return; }
    const a = conjuroAAptitud(c);
    if (c.clase === 'conjuro' && rango > c.rango) {
      // Preparado o aprendido en un rango más alto: gasta ese espacio
      a.id = `${a.id}@${rango}`.slice(0, 100);
      a.nombre = corto(`${c.nombre} (rango ${rango})`, 60);
      a.recuperacion = { tipo: 'espacio', rango };
    }
    if (innato && c.clase === 'conjuro') {
      a.id = `${a.id}:innato`.slice(0, 100);
      a.recuperacion = { tipo: 'frecuencia', veces: 1, periodo: 'dia' };
    }
    agregar(a);
  };
  for (const c of lanzadores) {
    const listas = c.spellcastingType === 'prepared' && (c.prepared ?? []).some((l) => l.list.length) ? c.prepared! : c.spells ?? [];
    for (const l of listas) for (const n of l.list) await conjuroDe(n, entre(l.spellLevel, 0, 10), !!c.innate);
  }
  let focoTradicion: Lanzador | null = null;
  for (const [tradicion, porAtributo] of Object.entries(b.focus ?? {})) {
    for (const [atributo, f] of Object.entries(porAtributo ?? {})) {
      if (!focoTradicion && esTradicion(tradicion) && esAtributo(atributo)) {
        const r = rangoDe(prof[`casting${tradicion[0]!.toUpperCase()}${tradicion.slice(1)}`]);
        focoTradicion = { tradicion, atributo, rango: (r || 1) as Rango };
      }
      for (const n of [...(f.focusCantrips ?? []), ...(f.focusSpells ?? [])]) await conjuroDe(n, 0, false);
    }
  }
  const lanzador: Lanzador | null = principal && esAtributo(principal.ability)
    ? { tradicion: principal.magicTradition as Lanzador['tradicion'], atributo: principal.ability, rango: (rangoDe(principal.proficiency) || 1) as Rango }
    : focoTradicion;
  const foco = entre(b.focusPoints ?? 0, 0, 3);
  const recursos: Recursos = {
    foco: { max: foco, actual: foco },
    espacios: [...espaciosPorRango].sort((x, y) => x[0] - y[0]).map(([rango, max]) => ({ rango, max: entre(max, 0, 20), usados: 0 })),
    usos: {},
  };
  if (aptitudes.length > 80) {
    avisos.push(`Tiene ${aptitudes.length} acciones, dotes y conjuros: la mesa guarda hasta 80 y se quedaron afuera los últimos (${aptitudes.slice(80).map((a) => a.nombre).join(', ')}).`);
    aptitudes.length = 80;
  }

  // --- Origen, sentidos, inventario ---
  const ascendencia = await hallar<GenericoCompendio>('ascendencias', b.ancestry);
  const herenciaNombre = b.heritage || herenciaDote;
  const herencia = herenciaNombre ? await hallar<GenericoCompendio>('herencias', herenciaNombre) : null;
  const trasfondo = b.background ? await hallar<GenericoCompendio>('trasfondos', b.background) : null;
  const clase = await hallar<GenericoCompendio>('clases', b.class);
  const textoSentidos = [herencia?.descripcion ?? '', ...dotes.map((d) => d.nombre)].join(' ');
  const vision = /darkvision/i.test(textoSentidos) ? 'darkvision' : String(ascendencia?.datos?.vision ?? '') || (/low-light/i.test(textoSentidos) ? 'low-light-vision' : '');
  const sentidos = vision === 'darkvision' ? 'Darkvision' : /low-light/.test(vision) ? 'Low-light vision' : '';

  const inventario: NonNullable<Personaje['inventario']> = [];
  const meter = async (nombre: string, cantidad: number) => {
    if (!nombre || inventario.length >= 200) return;
    const e = await hallar<EquipoCompendio>('equipo', nombre);
    inventario.push({ id: (e ? `compendio:${e.id}` : `pb:${slug(nombre)}`).slice(0, 80), nombre: corto(nombre, 80), cantidad: entre(cantidad, 0, 9999), bulto: Math.min(50, Math.max(0, e?.bulto ?? 0)) });
  };
  for (const w of b.weapons ?? []) await meter(w.display || w.name, 1);
  for (const a of b.armor ?? []) await meter(a.display || a.name, 1);
  for (const x of b.equipment ?? []) await meter(String(x[0] ?? ''), typeof x[1] === 'number' ? x[1] : 1);
  const m = b.money ?? {};

  const at = b.attributes ?? {};
  const pgAscendencia = entre((at.ancestryhp ?? 8) + (at.bonushp ?? 0), 0, 30);
  const pgClase = entre((at.classhp ?? 8) + (at.bonushpPerLevel ?? 0), 0, 20);
  const salvaciones = Object.fromEntries(SALVACIONES.map((s) => [s.clave, rangoDe(prof[s.clave])])) as Record<ClaveSalvacion, Rango>;
  const habilidades = Object.fromEntries(HABILIDADES.map((h) => [h.clave, rangoDe(prof[h.clave])])) as Record<ClaveHabilidad, Rango>;
  const ascendenciaTexto = herenciaNombre ? `${b.ancestry} (${herenciaNombre})` : b.ancestry;
  const notas = [
    'Importado de Pathbuilder 2e.',
    b.background && `Trasfondo: ${b.background}.`,
    b.deity && b.deity !== 'Not set' && `Deidad: ${b.deity}.`,
    b.dualClass && `Clase doble: ${b.dualClass}.`,
    (b.specials ?? []).length > 0 && `Rasgos: ${(b.specials ?? []).join(', ')}.`,
    sinEncontrar.length > 0 && `Sin texto en el compendio: ${sinEncontrar.join(', ')}.`,
  ].filter(Boolean).join('\n');

  const p: Personaje = {
    id,
    nombre: corto(b.name.trim() || 'Sin nombre', 60),
    ascendencia: corto(ascendenciaTexto, 60),
    clase: corto(b.class, 60),
    nivel,
    atributos,
    pgAscendencia,
    pgClase,
    pgActual: pgAscendencia + (pgClase + atributos.con) * nivel,
    pgTemporales: 0,
    velocidad: entre((at.speed ?? 25) + (at.speedBonus ?? 0), 5, 200),
    percepcion: rangoDe(prof.perception),
    salvaciones,
    armadura,
    habilidades,
    golpes,
    notas: corto(notas, 5000),
    aptitudes,
    lanzador,
    recursos,
    origen: {
      ascendencia: (ascendencia?.id ?? slug(b.ancestry)).slice(0, 60),
      herencia: herenciaNombre ? (herencia?.id ?? slug(herenciaNombre)).slice(0, 60) : null,
      trasfondo: (trasfondo?.id ?? slug(b.background ?? '')).slice(0, 60),
      clase: (clase?.id ?? slug(b.class)).slice(0, 60),
      subclase: null,
    },
    idiomas: (b.languages ?? []).filter((x) => typeof x === 'string' && x && x !== 'None selected').slice(0, 20).map((x) => x.slice(0, 40)),
    sentidos,
    saberes: (b.lores ?? []).filter((l) => (l[1] ?? 0) > 0).slice(0, 20).map((l) => corto(`${l[0]} Lore`, 60)),
    dotes: dotes.slice(0, 60),
    inventario,
    monedas: { oro: entre((m.gp ?? 0) + (m.pp ?? 0) * 10, 0, 1e7), plata: entre(m.sp ?? 0, 0, 1e7), cobre: entre(m.cp ?? 0, 0, 1e7) },
    ...(esAtributo(b.keyability) ? { claseCD: { atributo: b.keyability, rango: (rangoDe(prof.classDC) || 1) as Rango } } : {}),
    ...(escudo ? { escudo } : {}),
    ...(parciales.length ? { parciales } : {}),
  };
  if (dotes.length > 60) avisos.push(`Tiene ${dotes.length} dotes: la ficha guarda las primeras 60.`);

  // Lo que Pathbuilder calculó y la mesa debería dar igual
  const ficha = calcular(p);
  if (typeof ac.acTotal === 'number' && ac.acTotal !== ficha.ca.total) {
    avisos.push(`La CA da ${ficha.ca.total} y en Pathbuilder es ${ac.acTotal}${escudo ? ' (sin contar el escudo levantado)' : ''}. Revísala en la ficha.`);
  }
  if (!clase) avisos.push(`La clase ${b.class} no está en el compendio: subir de nivel no sabrá qué ofrecer.`);
  if (!esPersonajeValido(p)) avisos.push('Algo de la ficha quedó fuera de los límites de la mesa: revísala antes de guardar.');
  return { personaje: p, avisos, sinEncontrar };
}

// El motor de interacciones: qué hace una aptitud cuando alcanza a alguien.
// Quién tira (quien la usa contra una defensa, o el objetivo su salvación), a quiénes alcanza (uno, varios, un área,
// aliados), qué daño o curación lleva y qué deja según el grado de éxito: condiciones, efectos con duración,
// daño persistente, inmunidad a repetirla. La sala lo resuelve todo de una vez con sus propios dados.

import type { Aptitud } from './aptitudes';
import { CONDICIONES, type ClaveCondicion } from './condiciones';
import { esPlantillaValida, modificadorTexto, type PlantillaEfecto } from './efectos';
import { areaTexto, leerArea, type Area } from './areas';
import { GRADOS, HABILIDADES, leerExpresion, type ClaveHabilidad, type Grado } from './pf2e';

export type Salvacion = 'fortitude' | 'reflex' | 'will';

export type ModoTirada =
  // Quien la usa tira contra la CA: su ataque de conjuro o su arma
  | { tipo: 'ataque' }
  // Quien la usa tira una skill contra la CD de una defensa del objetivo (Demoralize: Intimidation contra Will)
  | { tipo: 'chequeo'; habilidad: ClaveHabilidad; contra: Salvacion | 'percepcion' }
  // Cada objetivo tira su salvación contra la CD de quien la usa (de conjuro, o de clase)
  | { tipo: 'salvacion'; salvacion: Salvacion; basica: boolean; cd?: 'conjuro' | 'clase' }
  // No se tira nada: alcanza y ya (Bless, Force Barrage, Heal)
  | { tipo: 'ninguna' };

export type Objetivos =
  | { tipo: 'uno'; aliados?: boolean }
  | { tipo: 'varios'; max: number; aliados?: boolean }
  // Un área: a todos los que toque (o solo a los aliados, para lo que ayuda)
  | { tipo: 'area'; area: Area; aliados?: boolean }
  | { tipo: 'yo' };

export interface CondicionPuesta { clave: ClaveCondicion; valor: number }

export interface Resultado {
  // Cuánto del daño recibe: nada, la mitad, todo o el doble
  dano?: 0 | 0.5 | 1 | 2;
  condiciones?: CondicionPuesta[];
  efecto?: PlantillaEfecto;
  // Lo que le pasa a quien la usó (Trip con pifia: tú caes al suelo)
  alAutor?: CondicionPuesta[];
  // Lo que se lee en el registro ("queda Frightened 2")
  texto?: string;
}

export interface Interaccion {
  modo: ModoTirada;
  objetivos: Objetivos;
  dano?: { formula: string; tipo: string };
  curacion?: string;
  // Lo que pasa según el grado (del que tira: quien la usa, o el objetivo si es una salvación)
  porGrado?: Partial<Record<Grado, Resultado>>;
  // Lo que reciben todos los alcanzados, sin tirar (los buffs)
  efecto?: PlantillaEfecto;
  // Rondas que el objetivo queda inmune a que se la vuelvan a hacer (Demoralize: 10 minutos = 100 rondas)
  inmunidad?: number;
}

// Lo que pasa por defecto en cada grado
const POR_DEFECTO: Record<'ataque' | 'basica' | 'normal', Record<Grado, Resultado>> = {
  ataque: { critico: { dano: 2 }, exito: { dano: 1 }, fallo: { dano: 0 }, pifia: { dano: 0 } },
  basica: { critico: { dano: 0 }, exito: { dano: 0.5 }, fallo: { dano: 1 }, pifia: { dano: 2 } },
  normal: { critico: {}, exito: {}, fallo: {}, pifia: {} },
};

export function resultadoPara(i: Interaccion, grado: Grado | null): Resultado {
  if (grado === null) return { dano: 1 };
  const base = i.modo.tipo === 'ataque' ? POR_DEFECTO.ataque
    : i.modo.tipo === 'salvacion' && i.modo.basica ? POR_DEFECTO.basica : POR_DEFECTO.normal;
  return { ...base[grado], ...i.porGrado?.[grado] };
}

// ---------- Catálogo: las aptitudes más usadas, ya automatizadas (PF2e remaster, licencia ORC) ----------

const condicion = (clave: ClaveCondicion, valor = 1): CondicionPuesta => ({ clave, valor });
const efecto = (p: PlantillaEfecto) => p;

export const CATALOGO_INTERACCIONES: Record<string, Interaccion> = {
  demoralize: {
    modo: { tipo: 'chequeo', habilidad: 'intimidation', contra: 'will' }, objetivos: { tipo: 'uno' }, inmunidad: 100,
    porGrado: {
      critico: { condiciones: [condicion('frightened', 2)], texto: 'queda Frightened 2' },
      exito: { condiciones: [condicion('frightened', 1)], texto: 'queda Frightened 1' },
      fallo: { texto: 'no se deja asustar' }, pifia: { texto: 'no se deja asustar' },
    },
  },
  trip: {
    modo: { tipo: 'chequeo', habilidad: 'athletics', contra: 'reflex' }, objetivos: { tipo: 'uno' }, dano: { formula: '1d6', tipo: 'bludgeoning' },
    porGrado: {
      critico: { dano: 1, condiciones: [condicion('prone')], texto: 'cae al suelo y se golpea' },
      exito: { dano: 0, condiciones: [condicion('prone')], texto: 'cae al suelo' },
      fallo: { dano: 0, texto: 'no cae' },
      pifia: { dano: 0, alAutor: [condicion('prone')], texto: 'pierdes el equilibrio y caes tú' },
    },
  },
  grapple: {
    modo: { tipo: 'chequeo', habilidad: 'athletics', contra: 'fortitude' }, objetivos: { tipo: 'uno' },
    porGrado: {
      critico: { condiciones: [condicion('restrained')], texto: 'queda inmovilizado (Restrained)' },
      exito: { condiciones: [condicion('grabbed')], texto: 'queda agarrado (Grabbed)' },
      fallo: { texto: 'se suelta' },
      pifia: { alAutor: [condicion('off-guard')], texto: 'te deja desprevenido' },
    },
  },
  shove: {
    modo: { tipo: 'chequeo', habilidad: 'athletics', contra: 'fortitude' }, objetivos: { tipo: 'uno' },
    porGrado: {
      critico: { texto: 'sale empujado 10 ft' }, exito: { texto: 'sale empujado 5 ft' },
      fallo: { texto: 'no se mueve' }, pifia: { alAutor: [condicion('prone')], texto: 'caes tú' },
    },
  },
  disarm: {
    modo: { tipo: 'chequeo', habilidad: 'athletics', contra: 'reflex' }, objetivos: { tipo: 'uno' },
    porGrado: {
      critico: { texto: 'suelta el arma' },
      exito: { efecto: efecto({ clave: 'disarm', nombre: 'Casi desarmado', beneficioso: false, modificadores: [{ blanco: 'ataque', tipo: 'circunstancia', valor: -2 }], rondas: 1, aspecto: 'marca' }), texto: '−2 a sus ataques con esa arma' },
      fallo: { texto: 'no suelta nada' }, pifia: { alAutor: [condicion('off-guard')], texto: 'te deja desprevenido' },
    },
  },
  fear: {
    modo: { tipo: 'salvacion', salvacion: 'will', basica: false }, objetivos: { tipo: 'uno' },
    porGrado: {
      critico: { texto: 'no siente miedo' },
      exito: { condiciones: [condicion('frightened', 1)], texto: 'queda Frightened 1' },
      fallo: { condiciones: [condicion('frightened', 2)], texto: 'queda Frightened 2' },
      pifia: { condiciones: [condicion('frightened', 3)], texto: 'queda Frightened 3 y huye' },
    },
  },
  daze: {
    modo: { tipo: 'salvacion', salvacion: 'will', basica: true }, objetivos: { tipo: 'uno' }, dano: { formula: '1d6', tipo: 'mental' },
    porGrado: { pifia: { dano: 2, condiciones: [condicion('stunned', 1)], texto: 'queda Stunned 1' } },
  },
  'electric-arc': {
    modo: { tipo: 'salvacion', salvacion: 'reflex', basica: true }, objetivos: { tipo: 'varios', max: 2 }, dano: { formula: '2d4', tipo: 'electricity' },
  },
  'ray-of-frost': {
    modo: { tipo: 'ataque' }, objetivos: { tipo: 'uno' }, dano: { formula: '2d4', tipo: 'cold' },
    porGrado: { critico: { dano: 2, efecto: efecto({ clave: 'ray-of-frost', nombre: 'Escarcha', beneficioso: false, modificadores: [{ blanco: 'velocidad', tipo: 'estado', valor: -10 }], rondas: 1, aspecto: 'frio' }), texto: '−10 ft de Velocidad' } },
  },
  ignition: {
    modo: { tipo: 'ataque' }, objetivos: { tipo: 'uno' }, dano: { formula: '2d4', tipo: 'fire' },
    porGrado: { critico: { dano: 2, efecto: efecto({ clave: 'fuego', nombre: 'En llamas', beneficioso: false, modificadores: [], persistente: { dano: '1d4', tipo: 'fire' }, aspecto: 'fuego' }), texto: 'queda en llamas (1d4 persistente)' } },
  },
  'produce-flame': {
    modo: { tipo: 'ataque' }, objetivos: { tipo: 'uno' }, dano: { formula: '1d4+4', tipo: 'fire' },
    porGrado: { critico: { dano: 2, efecto: efecto({ clave: 'fuego', nombre: 'En llamas', beneficioso: false, modificadores: [], persistente: { dano: '1d4', tipo: 'fire' }, aspecto: 'fuego' }), texto: 'queda en llamas (1d4 persistente)' } },
  },
  'caustic-blast': {
    modo: { tipo: 'salvacion', salvacion: 'reflex', basica: true }, objetivos: { tipo: 'area', area: { forma: 'explosion', tamano: 5 } }, dano: { formula: '2d8', tipo: 'acid' },
    porGrado: { pifia: { dano: 2, efecto: efecto({ clave: 'acido', nombre: 'Ácido', beneficioso: false, modificadores: [], persistente: { dano: '1d4', tipo: 'acid' }, aspecto: 'acido' }), texto: 'el ácido sigue quemando' } },
  },
  'breathe-fire': {
    modo: { tipo: 'salvacion', salvacion: 'reflex', basica: true }, objetivos: { tipo: 'area', area: { forma: 'cono', tamano: 15 } }, dano: { formula: '2d6', tipo: 'fire' },
  },
  fireball: {
    modo: { tipo: 'salvacion', salvacion: 'reflex', basica: true }, objetivos: { tipo: 'area', area: { forma: 'explosion', tamano: 20 } }, dano: { formula: '6d6', tipo: 'fire' },
  },
  'lightning-bolt': {
    modo: { tipo: 'salvacion', salvacion: 'reflex', basica: true }, objetivos: { tipo: 'area', area: { forma: 'linea', tamano: 120 } }, dano: { formula: '4d12', tipo: 'electricity' },
  },
  grease: {
    modo: { tipo: 'salvacion', salvacion: 'reflex', basica: false }, objetivos: { tipo: 'area', area: { forma: 'explosion', tamano: 5 } },
    porGrado: {
      critico: { texto: 'no resbala' }, exito: { texto: 'se mantiene en pie' },
      fallo: { condiciones: [condicion('prone')], texto: 'resbala y cae' },
      pifia: { condiciones: [condicion('prone')], efecto: efecto({ clave: 'grease', nombre: 'Engrasado', beneficioso: false, modificadores: [], condiciones: [condicion('off-guard')], rondas: 1, aspecto: 'marca' }), texto: 'cae y queda desprevenido' },
    },
  },
  'force-barrage': {
    modo: { tipo: 'ninguna' }, objetivos: { tipo: 'uno' }, dano: { formula: '2d4+2', tipo: 'force' },
  },
  'magic-missile': {
    modo: { tipo: 'ninguna' }, objetivos: { tipo: 'uno' }, dano: { formula: '2d4+2', tipo: 'force' },
  },
  heal: {
    modo: { tipo: 'ninguna' }, objetivos: { tipo: 'uno', aliados: true }, curacion: '1d8+8',
  },
  bless: {
    modo: { tipo: 'ninguna' }, objetivos: { tipo: 'area', area: { forma: 'emanacion', tamano: 15 }, aliados: true },
    efecto: efecto({ clave: 'bless', nombre: 'Bless', beneficioso: true, modificadores: [{ blanco: 'ataque', tipo: 'estado', valor: 1 }], rondas: 10, aspecto: 'bendicion' }),
  },
  bane: {
    modo: { tipo: 'salvacion', salvacion: 'will', basica: false }, objetivos: { tipo: 'area', area: { forma: 'emanacion', tamano: 10 } },
    porGrado: {
      critico: { texto: 'resiste' },
      exito: { efecto: efecto({ clave: 'bane', nombre: 'Bane', beneficioso: false, modificadores: [{ blanco: 'ataque', tipo: 'estado', valor: -1 }], rondas: 10, aspecto: 'mental' }), texto: '−1 a sus ataques' },
      fallo: { efecto: efecto({ clave: 'bane', nombre: 'Bane', beneficioso: false, modificadores: [{ blanco: 'ataque', tipo: 'estado', valor: -1 }], rondas: 10, aspecto: 'mental' }), texto: '−1 a sus ataques' },
      pifia: { efecto: efecto({ clave: 'bane', nombre: 'Bane', beneficioso: false, modificadores: [{ blanco: 'ataque', tipo: 'estado', valor: -1 }], rondas: 10, aspecto: 'mental' }), texto: '−1 a sus ataques' },
    },
  },
  'courageous-anthem': {
    modo: { tipo: 'ninguna' }, objetivos: { tipo: 'area', area: { forma: 'emanacion', tamano: 60 }, aliados: true },
    efecto: efecto({ clave: 'courageous-anthem', nombre: 'Courageous Anthem', beneficioso: true, modificadores: [{ blanco: 'ataque', tipo: 'estado', valor: 1 }, { blanco: 'dano', tipo: 'estado', valor: 1 }], rondas: 1, aspecto: 'bendicion' }),
  },
  heroism: {
    modo: { tipo: 'ninguna' }, objetivos: { tipo: 'uno', aliados: true },
    efecto: efecto({ clave: 'heroism', nombre: 'Heroism', beneficioso: true, modificadores: [{ blanco: 'chequeos', tipo: 'estado', valor: 1 }], rondas: 100, aspecto: 'bendicion' }),
  },
  shield: {
    modo: { tipo: 'ninguna' }, objetivos: { tipo: 'yo' },
    efecto: efecto({ clave: 'shield', nombre: 'Shield', beneficioso: true, modificadores: [{ blanco: 'ca', tipo: 'circunstancia', valor: 1 }], rondas: 1, aspecto: 'escudo' }),
  },
  'mystic-armor': {
    modo: { tipo: 'ninguna' }, objetivos: { tipo: 'yo' },
    efecto: efecto({ clave: 'mystic-armor', nombre: 'Mystic Armor', beneficioso: true, modificadores: [{ blanco: 'ca', tipo: 'objeto', valor: 1 }], aspecto: 'escudo' }),
  },
  'inside-ropes': {
    modo: { tipo: 'ataque' }, objetivos: { tipo: 'uno' }, dano: { formula: '2d4', tipo: 'bludgeoning' },
  },
};

// Nombres con los que también aparecen (en otros libros o antes del remaster)
const SINONIMOS: Record<string, string> = {
  'produce-flame': 'produce-flame', 'inspire-courage': 'courageous-anthem', 'acid-splash': 'caustic-blast',
  'magic-missile': 'magic-missile', 'burning-hands': 'breathe-fire', 'mage-armor': 'mystic-armor',
};

// "Ray of Frost" → "ray-of-frost"
export const claveDe = (nombre: string) => nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// La interacción de una aptitud: la que trae puesta, la del catálogo por su nombre, o la que se lee de su texto
export function interaccionDe(a: Aptitud): Interaccion | null {
  if (a.interaccion) return a.interaccion;
  const k = claveDe(a.nombre);
  const delCatalogo = CATALOGO_INTERACCIONES[SINONIMOS[k] ?? k];
  if (delCatalogo) return delCatalogo;
  return leerDeTexto(a);
}

// Para los conjuros que vinieron del compendio antes de existir el motor: "Salvación básica de Reflex", "20-foot burst"
function leerDeTexto(a: Aptitud): Interaccion | null {
  const formula = a.dano && leerExpresion(a.dano) ? a.dano : null;
  const tipo = /\b(\d+d\d+(?:\+\d+)?)\s+([a-z]+)\b/.exec(a.descripcion)?.[2] ?? '';
  const area = leerArea(a.descripcion);
  const objetivos: Objetivos = area ? { tipo: 'area', area } : { tipo: 'uno' };
  if (a.tirada?.tipo === 'ataque-conjuro' && formula) return { modo: { tipo: 'ataque' }, objetivos: { tipo: 'uno' }, dano: { formula, tipo } };
  const salvacion = /Salvación (básica )?de (Fortitude|Reflex|Will)/.exec(a.descripcion);
  if (salvacion && formula) {
    const s = salvacion[2]!.toLowerCase() as Salvacion;
    return { modo: { tipo: 'salvacion', salvacion: s, basica: !!salvacion[1] }, objetivos, dano: { formula, tipo }, ...(salvacion[1] ? {} : { porGrado: { fallo: { dano: 1 }, pifia: { dano: 2 } } }) };
  }
  return null;
}

// En palabras, para el detalle de una acción: "Salvación básica de Reflex · 6d6 fire · explosión de 20 ft"
export function resumenInteraccion(i: Interaccion): string[] {
  const partes: string[] = [];
  const m = i.modo;
  if (m.tipo === 'ataque') partes.push('Tiras ataque contra su CA');
  if (m.tipo === 'chequeo') partes.push(`${HABILIDADES.find((h) => h.clave === m.habilidad)?.nombre ?? m.habilidad} contra su CD de ${m.contra === 'percepcion' ? 'Perception' : nombreSalvacion(m.contra)}`);
  if (m.tipo === 'salvacion') partes.push(`Salvación${m.basica ? ' básica' : ''} de ${nombreSalvacion(m.salvacion)} contra tu CD`);
  const o = i.objetivos;
  if (o.tipo === 'area') partes.push(`${areaTexto(o.area)}${o.aliados ? ', a tus aliados' : ''}`);
  if (o.tipo === 'varios') partes.push(`hasta ${o.max} objetivos`);
  if (o.tipo === 'yo') partes.push('sobre ti');
  if (o.tipo === 'uno' && o.aliados) partes.push('a un aliado');
  if (i.dano) partes.push(`${i.dano.formula}${i.dano.tipo ? ` ${i.dano.tipo}` : ''}`);
  if (i.curacion) partes.push(`cura ${i.curacion}`);
  if (i.efecto) partes.push(`${i.efecto.nombre}: ${i.efecto.modificadores.map(modificadorTexto).join(', ')}${i.efecto.rondas ? ` (${i.efecto.rondas} ${i.efecto.rondas === 1 ? 'ronda' : 'rondas'})` : ''}`);
  return partes;
}

// Lo que pasa en cada grado, para mostrarlo antes de usarla
export function gradosTexto(i: Interaccion): { grado: Grado; nombre: string; texto: string }[] {
  if (i.modo.tipo === 'ninguna') return [];
  const salva = i.modo.tipo === 'salvacion';
  return (['critico', 'exito', 'fallo', 'pifia'] as Grado[]).map((g) => {
    const r = resultadoPara(i, g);
    const dano = i.dano && r.dano !== undefined ? ({ 0: 'sin daño', 0.5: 'mitad del daño', 1: 'el daño', 2: 'doble daño' } as const)[r.dano] : '';
    const condiciones = (r.condiciones ?? []).map((c) => `${CONDICIONES[c.clave].nombre}${CONDICIONES[c.clave].conValor ? ` ${c.valor}` : ''}`).join(', ');
    const texto = [r.texto ?? condiciones, dano].filter(Boolean).join(' · ') || 'nada';
    return { grado: g, nombre: salva ? `${GRADOS[g]} (salva)` : GRADOS[g], texto };
  });
}

export const nombreSalvacion = (s: Salvacion) => ({ fortitude: 'Fortitude', reflex: 'Reflex', will: 'Will' })[s];

// ---------- Validación: la interacción viaja dentro de la ficha ----------

const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const entero = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const SALVACIONES: unknown[] = ['fortitude', 'reflex', 'will'];
const FORMAS: unknown[] = ['explosion', 'emanacion', 'cono', 'linea'];

function esCondicionesPuestas(v: unknown): boolean {
  return v === undefined || (Array.isArray(v) && v.length <= 4
    && v.every((c) => obj(c) && typeof c.clave === 'string' && c.clave in CONDICIONES && entero(c.valor, 1, 4)));
}

function esResultadoValido(r: unknown, esExpresion: (t: string) => boolean): boolean {
  return obj(r) && (r.dano === undefined || [0, 0.5, 1, 2].includes(r.dano as number))
    && esCondicionesPuestas(r.condiciones) && esCondicionesPuestas(r.alAutor)
    && (r.efecto === undefined || esPlantillaValida(r.efecto, esExpresion))
    && (r.texto === undefined || (typeof r.texto === 'string' && r.texto.length <= 120));
}

export function esInteraccionValida(valor: unknown, esExpresion: (t: string) => boolean): boolean {
  if (!obj(valor)) return false;
  const m = valor.modo;
  const o = valor.objetivos;
  const d = valor.dano;
  const area = obj(o) ? o.area : undefined;
  const modoValido = obj(m) && (
    m.tipo === 'ataque' || m.tipo === 'ninguna'
    || (m.tipo === 'chequeo' && HABILIDADES.some((h) => h.clave === m.habilidad) && (SALVACIONES.includes(m.contra) || m.contra === 'percepcion'))
    || (m.tipo === 'salvacion' && SALVACIONES.includes(m.salvacion) && typeof m.basica === 'boolean' && (m.cd === undefined || m.cd === 'conjuro' || m.cd === 'clase')));
  const objetivosValidos = obj(o) && (o.aliados === undefined || typeof o.aliados === 'boolean') && (
    o.tipo === 'uno' || o.tipo === 'yo'
    || (o.tipo === 'varios' && entero(o.max, 2, 10))
    || (o.tipo === 'area' && obj(area) && FORMAS.includes(area.forma) && entero(area.tamano, 5, 500)));
  const porGrado = valor.porGrado;
  return modoValido && objetivosValidos
    && (d === undefined || (obj(d) && typeof d.formula === 'string' && esExpresion(d.formula) && typeof d.tipo === 'string' && d.tipo.length <= 30))
    && (valor.curacion === undefined || (typeof valor.curacion === 'string' && esExpresion(valor.curacion)))
    && (porGrado === undefined || (obj(porGrado) && Object.entries(porGrado).every(([g, r]) => g in GRADOS && esResultadoValido(r, esExpresion))))
    && (valor.efecto === undefined || esPlantillaValida(valor.efecto, esExpresion))
    && (valor.inmunidad === undefined || entero(valor.inmunidad, 1, 1000));
}

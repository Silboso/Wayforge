// Efectos: lo que una aptitud deja puesto en una criatura por un tiempo (Bless, Heroism, el fuego que sigue quemando).
// Cada efecto trae modificadores tipados; al sumarlos se siguen las reglas de PF2e: del mismo tipo cuenta solo el
// mejor bono y la peor penalización, y las penalizaciones sin tipo se suman todas.

import { CONDICIONES, type ClaveCondicion } from './condiciones';

export type TipoModificador = 'estado' | 'circunstancia' | 'objeto' | 'sin-tipo';

// A qué números toca: "chequeos" son todos los d20 (ataques, salvaciones, skills y Perception)
export type Blanco =
  | 'ataque' | 'ca' | 'salvaciones' | 'fortitude' | 'reflex' | 'will'
  | 'percepcion' | 'habilidades' | 'chequeos' | 'dano' | 'velocidad'
  // Solo la tirada de iniciativa (Oracular Warning, Scout's Warning)
  | 'iniciativa';

export const BLANCOS: Record<Blanco, string> = {
  ataque: 'ataques', ca: 'CA', salvaciones: 'salvaciones', fortitude: 'Fortitude', reflex: 'Reflex', will: 'Will',
  percepcion: 'Perception', habilidades: 'skills', chequeos: 'todos los chequeos', dano: 'daño', velocidad: 'Velocidad',
  iniciativa: 'la iniciativa',
};

export const TIPOS_MODIFICADOR: Record<TipoModificador, string> = {
  estado: 'de estado', circunstancia: 'de circunstancia', objeto: 'de objeto', 'sin-tipo': '',
};

export interface Modificador {
  blanco: Blanco;
  tipo: TipoModificador;
  valor: number;
}

export type Duracion =
  // Se cuenta al empezar el turno de `cuentaEn` (quien lo causó, o quien lo lleva si no está en combate)
  | { tipo: 'rondas'; rondas: number; cuentaEn?: string }
  // Dura mientras quien lo causó lo mantenga (Sustain) en cada turno suyo
  | { tipo: 'sostenido'; desde?: string; ronda?: number }
  // Hasta que alguien lo quite (o se salve, si es daño persistente)
  | { tipo: 'hasta-quitar' };

// Cómo se ve en el tablero: un brillo para lo bueno, una llama para el fuego que sigue
export type Aspecto = 'bendicion' | 'escudo' | 'fuego' | 'frio' | 'electricidad' | 'acido' | 'veneno' | 'sangrado' | 'mental' | 'lento' | 'marca';

// El aspecto de cada tipo de daño (para la tinta de las áreas y los halos)
export const ASPECTO_POR_DANO: Record<string, Aspecto> = {
  fire: 'fuego', cold: 'frio', electricity: 'electricidad', acid: 'acido', poison: 'veneno', bleed: 'sangrado', mental: 'mental',
};

export interface EfectoActivo {
  id: string;
  // Qué es (Bless, Heroism…): uno nuevo igual del mismo origen reemplaza al anterior
  clave: string;
  nombre: string;
  origen?: { tokenId?: string; nombre: string };
  beneficioso: boolean;
  modificadores: Modificador[];
  // Condiciones que trae puestas mientras dura (se van con él)
  condiciones?: { clave: ClaveCondicion; valor: number }[];
  // Daño al terminar cada turno de quien lo lleva; con un 15 o más en un d20 se apaga
  persistente?: { dano: string; tipo: string };
  // "Inmune a Demoralize de Kyra por 10 minutos": no hace nada salvo impedir que se repita
  inmuneA?: string;
  duracion: Duracion;
  aspecto?: Aspecto;
}

export type PlantillaEfecto = Omit<EfectoActivo, 'id' | 'origen' | 'duracion'> & {
  // En rondas; sin valor dura hasta que se quite (o, si se mantiene, mientras se sostenga)
  rondas?: number;
  sostenido?: boolean;
};

// Lo que un efecto o condición aporta a un número, antes de apilar
export interface Candidato {
  etiqueta: string;
  tipo: TipoModificador;
  valor: number;
}

// Las reglas de apilamiento: por tipo, el mejor bono y la peor penalización; sin tipo, las penalizaciones se suman
export function apilar(candidatos: Candidato[]): { etiqueta: string; valor: number }[] {
  const salen: { etiqueta: string; valor: number }[] = [];
  for (const tipo of ['estado', 'circunstancia', 'objeto'] as const) {
    const delTipo = candidatos.filter((c) => c.tipo === tipo);
    const bono = delTipo.filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor)[0];
    const pena = delTipo.filter((c) => c.valor < 0).sort((a, b) => a.valor - b.valor)[0];
    if (bono) salen.push({ etiqueta: bono.etiqueta, valor: bono.valor });
    if (pena) salen.push({ etiqueta: pena.etiqueta, valor: pena.valor });
  }
  for (const c of candidatos) if (c.tipo === 'sin-tipo' && c.valor !== 0) salen.push({ etiqueta: c.etiqueta, valor: c.valor });
  return salen;
}

// Lo que los efectos aportan a un número que toca estos blancos (sin apilar todavía)
export function candidatosDe(efectos: EfectoActivo[], blancos: Blanco[]): Candidato[] {
  const salen: Candidato[] = [];
  for (const e of efectos) {
    for (const m of e.modificadores) {
      if (blancos.includes(m.blanco)) salen.push({ etiqueta: e.nombre, tipo: m.tipo, valor: m.valor });
    }
  }
  return salen;
}

// La Velocidad con los efectos que la cambian (Ray of Frost crítico: −10 ft)
export function velocidadConEfectos(base: number, efectos: EfectoActivo[]): number {
  const total = apilar(candidatosDe(efectos, ['velocidad'])).reduce((s, x) => s + x.valor, 0);
  return Math.max(0, base + total);
}

// Pone un efecto: el mismo efecto del mismo origen se renueva en lugar de duplicarse
export function ponerEfecto(lista: EfectoActivo[], e: EfectoActivo): EfectoActivo[] {
  const mismo = (x: EfectoActivo) => x.clave === e.clave && (x.origen?.tokenId ?? x.origen?.nombre) === (e.origen?.tokenId ?? e.origen?.nombre);
  return [...lista.filter((x) => !mismo(x)), e];
}

// Un efecto concreto a partir de su plantilla
export function crearEfecto(p: PlantillaEfecto, id: string, origen: { tokenId?: string; nombre: string } | undefined, cuentaEn: string | undefined, ronda: number | undefined): EfectoActivo {
  const { rondas, sostenido, ...resto } = p;
  const duracion: Duracion = sostenido
    ? { tipo: 'sostenido', ...(origen?.tokenId ? { desde: origen.tokenId } : {}), ...(ronda !== undefined ? { ronda } : {}) }
    : rondas ? { tipo: 'rondas', rondas, ...(cuentaEn ? { cuentaEn } : {}) } : { tipo: 'hasta-quitar' };
  return { ...resto, id, ...(origen ? { origen } : {}), duracion };
}

// Al empezar el turno de `tokenId`: se descuentan las rondas de lo que cuenta en ese turno; lo que llega a 0 se va
export function contarRondas(efectos: EfectoActivo[], tokenId: string, portador: string): { quedan: EfectoActivo[]; vencidos: EfectoActivo[] } {
  const quedan: EfectoActivo[] = [];
  const vencidos: EfectoActivo[] = [];
  for (const e of efectos) {
    const d = e.duracion;
    if (d.tipo !== 'rondas' || (d.cuentaEn ?? portador) !== tokenId) { quedan.push(e); continue; }
    if (d.rondas <= 1) vencidos.push(e);
    else quedan.push({ ...e, duracion: { ...d, rondas: d.rondas - 1 } });
  }
  return { quedan, vencidos };
}

// Al terminar el turno de `tokenId`: lo que mantenía y no sostuvo esta ronda se va
export function vencerSostenidos(efectos: EfectoActivo[], tokenId: string, ronda: number): { quedan: EfectoActivo[]; vencidos: EfectoActivo[] } {
  const quedan: EfectoActivo[] = [];
  const vencidos: EfectoActivo[] = [];
  for (const e of efectos) {
    const d = e.duracion;
    if (d.tipo === 'sostenido' && d.desde === tokenId && d.ronda !== undefined && ronda > d.ronda) vencidos.push(e);
    else quedan.push(e);
  }
  return { quedan, vencidos };
}

// Sustain: lo que mantiene `tokenId` sigue una ronda más
export function sostener(efectos: EfectoActivo[], tokenId: string, ronda: number): EfectoActivo[] {
  return efectos.map((e) => (e.duracion.tipo === 'sostenido' && e.duracion.desde === tokenId ? { ...e, duracion: { ...e.duracion, ronda } } : e));
}

export function duracionTexto(d: Duracion): string {
  if (d.tipo === 'rondas') return d.rondas === 1 ? '1 ronda' : `${d.rondas} rondas`;
  if (d.tipo === 'sostenido') return 'mientras lo mantenga';
  return 'hasta que se quite';
}

// "+1 de estado a ataques" para mostrar en la ficha y en el tablero
export function modificadorTexto(m: Modificador): string {
  const n = m.valor > 0 ? `+${m.valor}` : `${m.valor}`;
  const tipo = TIPOS_MODIFICADOR[m.tipo];
  return m.blanco === 'velocidad' ? `${n} ft de Velocidad` : `${n}${tipo ? ` ${tipo}` : ''} a ${BLANCOS[m.blanco]}`;
}

const TIPOS: unknown[] = ['estado', 'circunstancia', 'objeto', 'sin-tipo'];
const BLANCOS_VALIDOS = Object.keys(BLANCOS);
const ASPECTOS: unknown[] = ['bendicion', 'escudo', 'fuego', 'frio', 'electricidad', 'acido', 'veneno', 'sangrado', 'mental', 'lento', 'marca'];

const entero = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const texto = (t: unknown, max: number) => typeof t === 'string' && t.length <= max;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function esModificadorValido(m: unknown): boolean {
  return obj(m) && BLANCOS_VALIDOS.includes(m.blanco as string) && TIPOS.includes(m.tipo) && entero(m.valor, -30, 30);
}

// Lo común a un efecto puesto y a su plantilla (la sala no confía en lo que llega)
function esCuerpoValido(e: Record<string, unknown>, esExpresion: (t: string) => boolean): boolean {
  const pers = e.persistente;
  return texto(e.clave, 80) && texto(e.nombre, 60) && (e.nombre as string).trim().length > 0
    && typeof e.beneficioso === 'boolean'
    && Array.isArray(e.modificadores) && e.modificadores.length <= 8 && e.modificadores.every(esModificadorValido)
    && (e.condiciones === undefined || (Array.isArray(e.condiciones) && e.condiciones.length <= 4
      && e.condiciones.every((c) => obj(c) && typeof c.clave === 'string' && c.clave in CONDICIONES && entero(c.valor, 1, 4))))
    && (pers === undefined || (obj(pers) && typeof pers.dano === 'string' && esExpresion(pers.dano) && texto(pers.tipo, 30)))
    && (e.inmuneA === undefined || texto(e.inmuneA, 100))
    && (e.aspecto === undefined || ASPECTOS.includes(e.aspecto));
}

export function esPlantillaValida(valor: unknown, esExpresion: (t: string) => boolean): boolean {
  return obj(valor) && esCuerpoValido(valor, esExpresion)
    && (valor.rondas === undefined || entero(valor.rondas, 1, 1000))
    && (valor.sostenido === undefined || typeof valor.sostenido === 'boolean');
}

export function esEfectoValido(valor: unknown, esExpresion: (t: string) => boolean): boolean {
  if (!obj(valor) || !esCuerpoValido(valor, esExpresion) || !texto(valor.id, 100)) return false;
  const o = valor.origen;
  const d = valor.duracion;
  return (o === undefined || (obj(o) && texto(o.nombre, 60) && (o.tokenId === undefined || texto(o.tokenId, 100))))
    && obj(d) && (
      (d.tipo === 'rondas' && entero(d.rondas, 1, 1000) && (d.cuentaEn === undefined || texto(d.cuentaEn, 100)))
      || (d.tipo === 'sostenido' && (d.desde === undefined || texto(d.desde, 100)) && (d.ronda === undefined || entero(d.ronda, 0, 100000)))
      || d.tipo === 'hasta-quitar');
}

export function esEfectosValidos(valor: unknown, esExpresion: (t: string) => boolean): boolean {
  return Array.isArray(valor) && valor.length <= 20 && valor.every((e) => esEfectoValido(e, esExpresion));
}

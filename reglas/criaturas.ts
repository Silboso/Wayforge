// Criaturas: los enemigos y NPCs que maneja el GM. Más simples que un personaje: sus números ya vienen
// sumados (como en el Monster Core), y la mesa solo les agrega la penalización por ataque múltiple y las condiciones.

import { leerExpresion, type ClaveSalvacion } from './pf2e';

export interface AtaqueCriatura {
  id: string;
  nombre: string;
  // Bono total del ataque (el primero del turno)
  bono: number;
  // Daño ya sumado: "1d6+2"
  dano: string;
  tipoDano: string;
  agil: boolean;
  // Alcance en pies: 5 al lado, 10 con reach, o el incremento de un arma a distancia
  distancia?: number;
  rasgos: string[];
}

export interface Criatura {
  nivel: number;
  salvaciones: Record<ClaveSalvacion, number>;
  velocidad: number;
  ataques: AtaqueCriatura[];
  // Skills que suele usar: "Stealth +5"
  habilidades: { nombre: string; bono: number }[];
  rasgos: string[];
  // Lo que hace especial (Sneak Attack, Knockdown, Slow…), en palabras
  notas: string;
  // Lo que le hace menos (o más) daño. Opcional: las criaturas viejas no lo tienen.
  defensas?: Defensas;
}

export interface Defensas {
  inmunidades: string[];
  resistencias: { tipo: string; valor: number }[];
  debilidades: { tipo: string; valor: number }[];
}

const FISICOS = ['bludgeoning', 'piercing', 'slashing'];

// ¿Una resistencia o debilidad de este tipo cubre ese daño? "physical" cubre los tres físicos y "all", todo.
function cubre(tipoDefensa: string, tipoDano: string): boolean {
  const t = tipoDefensa.trim().toLowerCase();
  const d = tipoDano.trim().toLowerCase();
  return t === d || t === 'all' || (t === 'physical' && FISICOS.includes(d));
}

// El daño que de verdad recibe: inmune → 0; si no, suma la debilidad más alta y resta la resistencia más alta
export function danoAjustado(c: Criatura | undefined, cantidad: number, tipoDano: string | null): { total: number; nota: string | null } {
  const def = c?.defensas;
  if (!def || !tipoDano || cantidad <= 0) return { total: Math.max(0, cantidad), nota: null };
  if (def.inmunidades.some((i) => cubre(i, tipoDano))) return { total: 0, nota: `inmune a ${tipoDano}` };
  const debilidad = Math.max(0, ...def.debilidades.filter((x) => cubre(x.tipo, tipoDano)).map((x) => x.valor));
  const resistencia = Math.max(0, ...def.resistencias.filter((x) => cubre(x.tipo, tipoDano)).map((x) => x.valor));
  const total = Math.max(0, cantidad + debilidad - resistencia);
  const partes = [debilidad && `+${debilidad} por debilidad`, resistencia && `−${resistencia} por resistencia`].filter(Boolean);
  return { total, nota: partes.length ? `${partes.join(', ')} a ${tipoDano}` : null };
}

// Cómo se ve un enemigo, sin decir sus PG: lo que ven los jugadores
export function estadoDeSalud(pg: { actual: number; max: number }): 'ileso' | 'herido' | 'muy herido' | 'casi muerto' | 'derrotado' {
  if (pg.actual <= 0) return 'derrotado';
  const k = pg.actual / Math.max(1, pg.max);
  return k >= 1 ? 'ileso' : k > 0.5 ? 'herido' : k > 0.2 ? 'muy herido' : 'casi muerto';
}

// "fire 5, cold 5" ↔ lista (para escribirlas en el editor)
export function leerValores(texto: string): { tipo: string; valor: number }[] {
  return texto.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = /^([a-zA-Záéíóúñ ]+?)\s*(\d+)$/.exec(x);
    return m ? { tipo: m[1]!.trim().toLowerCase().slice(0, 30), valor: Math.min(99, Number(m[2])) } : null;
  }).filter((x): x is { tipo: string; valor: number } => !!x);
}
export const escribirValores = (xs: { tipo: string; valor: number }[]) => xs.map((x) => `${x.tipo} ${x.valor}`).join(', ');

export const CRIATURA_VACIA: Criatura = {
  nivel: 0, salvaciones: { fortitude: 4, reflex: 4, will: 4 }, velocidad: 25, ataques: [], habilidades: [], rasgos: [], notas: '',
};

// Hasta dónde llega un ataque: lo cargado, o lo que dicen sus rasgos (thrown-30, range-60, reach-10); si no, al lado
export function alcanceAtaque(a: Pick<AtaqueCriatura, 'distancia' | 'rasgos'>): number {
  if (a.distancia) return a.distancia;
  for (const r of a.rasgos ?? []) {
    const m = /^(?:thrown|range|range-increment|reach)[- ](\d+)/i.exec(r);
    if (m) return Math.min(1000, Math.max(5, Number(m[1])));
  }
  return 5;
}

// Los números de un ataque en el 1.º, 2.º y 3.º del turno
export function penalizacionesAtaque(a: AtaqueCriatura): [number, number, number] {
  const paso = a.agil ? 4 : 5;
  return [a.bono, a.bono - paso, a.bono - paso * 2];
}

const entero = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const texto = (t: unknown, max: number) => typeof t === 'string' && t.length <= max;

export function esCriaturaValida(valor: unknown): valor is Criatura {
  if (typeof valor !== 'object' || valor === null) return false;
  const c = valor as Record<string, unknown>;
  const s = c.salvaciones as Record<string, unknown> | undefined;
  return entero(c.nivel, -1, 30)
    && typeof s === 'object' && s !== null && entero(s.fortitude, -10, 60) && entero(s.reflex, -10, 60) && entero(s.will, -10, 60)
    && entero(c.velocidad, 0, 200)
    && Array.isArray(c.ataques) && c.ataques.length <= 12 && c.ataques.every(esAtaqueValido)
    && Array.isArray(c.habilidades) && c.habilidades.length <= 20
    && c.habilidades.every((h) => typeof h === 'object' && h !== null && texto((h as Record<string, unknown>).nombre, 40) && entero((h as Record<string, unknown>).bono, -10, 60))
    && Array.isArray(c.rasgos) && c.rasgos.length <= 20 && c.rasgos.every((r) => texto(r, 30))
    && texto(c.notas, 2000)
    && (c.defensas === undefined || esDefensasValidas(c.defensas));
}

function esDefensasValidas(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null) return false;
  const d = valor as Record<string, unknown>;
  const valores = (xs: unknown) => Array.isArray(xs) && xs.length <= 20 && xs.every((x) => typeof x === 'object' && x !== null
    && texto((x as Record<string, unknown>).tipo, 30) && entero((x as Record<string, unknown>).valor, 0, 99));
  return Array.isArray(d.inmunidades) && d.inmunidades.length <= 20 && d.inmunidades.every((x) => texto(x, 30))
    && valores(d.resistencias) && valores(d.debilidades);
}

function esAtaqueValido(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null) return false;
  const a = valor as Record<string, unknown>;
  return texto(a.id, 60) && texto(a.nombre, 60) && (a.nombre as string).trim().length > 0
    && entero(a.bono, -10, 60) && typeof a.dano === 'string' && leerExpresion(a.dano) !== null
    && texto(a.tipoDano, 30) && typeof a.agil === 'boolean'
    && (a.distancia === undefined || entero(a.distancia, 5, 1000))
    && Array.isArray(a.rasgos) && a.rasgos.length <= 12 && a.rasgos.every((r) => texto(r, 30));
}

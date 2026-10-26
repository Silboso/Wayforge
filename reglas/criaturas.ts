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
}

export const CRIATURA_VACIA: Criatura = {
  nivel: 0, salvaciones: { fortitude: 4, reflex: 4, will: 4 }, velocidad: 25, ataques: [], habilidades: [], rasgos: [], notas: '',
};

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
    && texto(c.notas, 2000);
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

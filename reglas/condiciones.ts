// Condiciones de PF2e: qué penalizan y cómo cambian con los turnos.
// Las penalizaciones del mismo tipo no se suman: de las de estado (status) cuenta la peor, igual con las de circunstancia.

import type { Atributo, ClaveSalvacion, Parte } from './pf2e';

export const CONDICIONES = {
  frightened: { nombre: 'Frightened', conValor: true, ayuda: 'Miedo: −X a todos tus chequeos y CDs. Baja 1 al final de cada turno tuyo.' },
  sickened: { nombre: 'Sickened', conValor: true, ayuda: 'Náuseas: −X a todos tus chequeos y CDs. No puedes comer ni beber.' },
  clumsy: { nombre: 'Clumsy', conValor: true, ayuda: 'Torpe: −X a lo que usa Dex (CA, Reflex, ataques con Dex, Acrobatics, Stealth…).' },
  enfeebled: { nombre: 'Enfeebled', conValor: true, ayuda: 'Débil: −X a lo que usa Str (ataques y daño con Str, Athletics).' },
  drained: { nombre: 'Drained', conValor: true, ayuda: 'Agotado de vida: −X a Fortitude y a lo que usa Con.' },
  stupefied: { nombre: 'Stupefied', conValor: true, ayuda: 'Aturdido mentalmente: −X a lo que usa Int, Wis o Cha (Perception, Will…).' },
  fatigued: { nombre: 'Fatigued', conValor: false, ayuda: 'Cansado: −1 a la CA y a las salvaciones.' },
  'off-guard': { nombre: 'Off-guard', conValor: false, ayuda: 'Desprevenido: −2 a tu CA.' },
  prone: { nombre: 'Prone', conValor: false, ayuda: 'En el suelo: Off-guard y −2 a tus ataques. Levantarte cuesta una acción.' },
  grabbed: { nombre: 'Grabbed', conValor: false, ayuda: 'Agarrado: Off-guard y no te puedes mover.' },
  restrained: { nombre: 'Restrained', conValor: false, ayuda: 'Inmovilizado: Off-guard, no te puedes mover y casi no puedes actuar.' },
  slowed: { nombre: 'Slowed', conValor: true, ayuda: 'Lento: pierdes X acciones al empezar cada turno.' },
  stunned: { nombre: 'Stunned', conValor: true, ayuda: 'Aturdido: pierdes X acciones en total, y luego se va.' },
  quickened: { nombre: 'Quickened', conValor: false, ayuda: 'Acelerado: ganas 1 acción extra cada turno (para lo que diga el efecto).' },
  hidden: { nombre: 'Hidden', conValor: false, ayuda: 'Escondido: saben dónde estás más o menos, pero no te ven.' },
  invisible: { nombre: 'Invisible', conValor: false, ayuda: 'Invisible: no te pueden ver.' },
  dying: { nombre: 'Dying', conValor: true, ayuda: 'Muriendo: con Dying 4 mueres. Tira salvación de recuperación al empezar tu turno.' },
  wounded: { nombre: 'Wounded', conValor: true, ayuda: 'Herido: si vuelves a caer, empiezas con más Dying.' },
  unconscious: { nombre: 'Unconscious', conValor: false, ayuda: 'Inconsciente: no puedes actuar y tienes −4 a la CA.' },
  'shield-raised': { nombre: 'Shield raised', conValor: false, ayuda: 'Escudo levantado: +2 a tu CA hasta el inicio de tu próximo turno. Te deja usar Shield Block.' },
} as const satisfies Record<string, { nombre: string; conValor: boolean; ayuda: string }>;

export type ClaveCondicion = keyof typeof CONDICIONES;

export interface Condicion {
  clave: ClaveCondicion;
  // Las condiciones sin número guardan 1
  valor: number;
  // Se quita sola al empezar el próximo turno de quien la tiene (Raise a Shield)
  hasta?: 'inicio-turno';
}

// Para qué se está calculando el número
export type Contexto =
  | { tipo: 'chequeo'; atributo: Atributo; salvacion?: ClaveSalvacion }
  | { tipo: 'ataque'; atributo: Atributo }
  | { tipo: 'ca' }
  | { tipo: 'dano'; conFuerza: boolean };

const MENTALES: Atributo[] = ['int', 'wis', 'cha'];

function valorDe(condiciones: Condicion[], clave: ClaveCondicion): number {
  return condiciones.find((c) => c.clave === clave)?.valor ?? 0;
}

// Las penalizaciones que tocan a este número, ya resueltas (como mucho una de estado y una de circunstancia)
export function penalizaciones(condiciones: Condicion[], contexto: Contexto): Parte[] {
  const deEstado: Parte[] = [];
  const deCircunstancia: Parte[] = [];
  const estado = (clave: ClaveCondicion, valor: number) => {
    if (valor > 0) deEstado.push({ etiqueta: `${CONDICIONES[clave].nombre}${CONDICIONES[clave].conValor ? ` ${valor}` : ''}`, valor: -valor });
  };
  const atributo = contexto.tipo === 'chequeo' || contexto.tipo === 'ataque' ? contexto.atributo : contexto.tipo === 'ca' ? 'dex' : null;

  if (contexto.tipo !== 'dano') {
    estado('frightened', valorDe(condiciones, 'frightened'));
    estado('sickened', valorDe(condiciones, 'sickened'));
  }
  if (atributo === 'dex') estado('clumsy', valorDe(condiciones, 'clumsy'));
  if (atributo === 'str' || (contexto.tipo === 'dano' && contexto.conFuerza)) estado('enfeebled', valorDe(condiciones, 'enfeebled'));
  if (atributo === 'con' || (contexto.tipo === 'chequeo' && contexto.salvacion === 'fortitude')) estado('drained', valorDe(condiciones, 'drained'));
  if (atributo && MENTALES.includes(atributo) && contexto.tipo !== 'ataque') estado('stupefied', valorDe(condiciones, 'stupefied'));
  if (contexto.tipo === 'ca' || (contexto.tipo === 'chequeo' && contexto.salvacion)) estado('fatigued', valorDe(condiciones, 'fatigued'));

  if (contexto.tipo === 'ca') {
    const desprevenido = (['off-guard', 'prone', 'grabbed', 'restrained'] as const).find((c) => valorDe(condiciones, c));
    if (desprevenido) deCircunstancia.push({ etiqueta: CONDICIONES[desprevenido].nombre, valor: -2 });
    if (valorDe(condiciones, 'unconscious')) deCircunstancia.push({ etiqueta: 'Unconscious', valor: -4 });
  }
  if (contexto.tipo === 'ataque' && valorDe(condiciones, 'prone')) deCircunstancia.push({ etiqueta: 'Prone', valor: -2 });

  const peor = (partes: Parte[]) => partes.reduce<Parte | null>((a, p) => (!a || p.valor < a.valor ? p : a), null);
  // Los bonos no se cancelan con las penalizaciones: un escudo levantado suma aunque estés Off-guard
  const bonos: Parte[] = contexto.tipo === 'ca' && valorDe(condiciones, 'shield-raised') ? [{ etiqueta: 'Escudo levantado', valor: 2 }] : [];
  return [...bonos, peor(deEstado), peor(deCircunstancia)].filter((p): p is Parte => p !== null);
}

// Cuántas acciones tiene al empezar su turno, y cuánto Stunned le queda después de pagarlo
export function accionesAlEmpezar(condiciones: Condicion[]): { acciones: number; stunnedRestante: number } {
  const base = 3 + (valorDe(condiciones, 'quickened') ? 1 : 0) - valorDe(condiciones, 'slowed');
  const stunned = valorDe(condiciones, 'stunned');
  const perdidas = Math.min(stunned, Math.max(0, base));
  return { acciones: Math.max(0, base - perdidas), stunnedRestante: stunned - perdidas };
}

// Lo que cambia solo al terminar el turno: Frightened baja 1
export function alTerminarTurno(condiciones: Condicion[]): Condicion[] {
  return condiciones
    .map((c) => (c.clave === 'frightened' ? { ...c, valor: c.valor - 1 } : c))
    .filter((c) => c.valor > 0);
}

export function ponerCondicion(condiciones: Condicion[], clave: ClaveCondicion, valor: number, hasta?: Condicion['hasta']): Condicion[] {
  const resto = condiciones.filter((c) => c.clave !== clave);
  if (valor <= 0) return resto;
  return [...resto, { clave, valor: CONDICIONES[clave].conValor ? valor : 1, ...(hasta ? { hasta } : {}) }];
}

// Al empezar su turno se le van las que duraban "hasta tu próximo turno"
export function alEmpezarTurno(condiciones: Condicion[]): Condicion[] {
  return condiciones.filter((c) => c.hasta !== 'inicio-turno');
}

export function esCondicionesValida(valor: unknown): valor is Condicion[] {
  return Array.isArray(valor) && valor.length <= 30 && valor.every((c) =>
    typeof c === 'object' && c !== null && typeof c.clave === 'string' && c.clave in CONDICIONES
    && Number.isInteger(c.valor) && c.valor >= 1 && c.valor <= 20
    && (c.hasta === undefined || c.hasta === 'inicio-turno'));
}

// El compendio: todo el contenido de Pathfinder 2e importado del sistema PF2e de Foundry (licencias ORC y OGL).
// Lo genera `scripts/importar-pf2e.mjs` en `public/compendio/<tipo>/`: un índice para buscar y trozos con el detalle,
// que la app pide solo cuando hace falta. Los textos vienen en inglés, como en los libros.

import type { Aptitud, Costo } from './aptitudes';
import type { AtaqueCriatura, Criatura, Defensas } from './criaturas';
import { leerExpresion } from './pf2e';
import { leerArea } from './areas';
import { CATALOGO_INTERACCIONES, claveDe, type Interaccion, type Objetivos } from './interacciones';

export type TipoCompendio =
  | 'criaturas' | 'conjuros' | 'dotes' | 'equipo' | 'acciones' | 'condiciones'
  | 'ascendencias' | 'herencias' | 'trasfondos' | 'clases' | 'rasgos-de-clase' | 'deidades' | 'peligros';

export const TIPOS_COMPENDIO: { tipo: TipoCompendio; nombre: string; ayuda: string }[] = [
  { tipo: 'criaturas', nombre: 'Criaturas', ayuda: 'Todos los bestiarios y PNJ' },
  { tipo: 'conjuros', nombre: 'Conjuros', ayuda: 'Trucos, conjuros, de foco y rituales' },
  { tipo: 'dotes', nombre: 'Dotes', ayuda: 'De ascendencia, clase, skill, generales y arquetipos' },
  { tipo: 'equipo', nombre: 'Equipo', ayuda: 'Armas, armaduras, consumibles y objetos mágicos' },
  { tipo: 'acciones', nombre: 'Acciones', ayuda: 'Las acciones de todos y las especiales' },
  { tipo: 'condiciones', nombre: 'Condiciones', ayuda: 'Frightened, Prone, Dying…' },
  { tipo: 'ascendencias', nombre: 'Ascendencias', ayuda: 'Pueblos jugables' },
  { tipo: 'herencias', nombre: 'Herencias', ayuda: 'Variantes de cada ascendencia' },
  { tipo: 'trasfondos', nombre: 'Trasfondos', ayuda: 'De dónde viene tu personaje' },
  { tipo: 'clases', nombre: 'Clases', ayuda: 'Todas las clases' },
  { tipo: 'rasgos-de-clase', nombre: 'Rasgos de clase', ayuda: 'Lo que da cada clase por nivel' },
  { tipo: 'deidades', nombre: 'Deidades', ayuda: 'Dioses y filosofías' },
  { tipo: 'peligros', nombre: 'Peligros', ayuda: 'Trampas y peligros' },
];

// Una fila del índice: lo justo para buscar y mostrar en una lista
export interface Indice {
  id: string;
  nombre: string;
  nivel: number | null;
  rasgos: string[];
  rareza: string;
  // Libro de donde sale ("Pathfinder Monster Core")
  fuente: string;
  // Algo corto para la lista (tradiciones de un conjuro, categoría de una dote, tipo de objeto)
  resumen: string;
  // En qué trozo está el detalle
  trozo: number;
  // Solo las dotes: sus requisitos ("trained in Athletics", "Power Attack")
  requisitos?: string[];
}

interface Base {
  id: string;
  nombre: string;
  nivel: number | null;
  rasgos: string[];
  rareza: string;
  fuente: string;
  licencia: string;
  descripcion: string;
}

export interface CriaturaCompendio extends Base {
  tamano: string;
  ca: number;
  pg: number;
  percepcion: number;
  sentidos: string[];
  idiomas: string[];
  velocidad: number;
  otrasVelocidades: string[];
  salvaciones: { fortitude: number; reflex: number; will: number };
  habilidades: { nombre: string; bono: number }[];
  ataques: AtaqueCriatura[];
  defensas: Defensas;
  // Sus habilidades especiales: Goblin Scuttle, Sneak Attack, Breath Weapon…
  aptitudes: { nombre: string; costo: Costo | null; texto: string }[];
}

export interface ConjuroCompendio extends Base {
  rango: number;
  tradiciones: string[];
  costo: Costo | null;
  // "1 a 3 acciones", "10 minutos": cuando no es un costo simple
  tiempo: string;
  distancia: number | null;
  area: string;
  objetivos: string;
  duracion: string;
  defensa: 'ataque' | 'fortitude' | 'reflex' | 'will' | null;
  basica: boolean;
  dano: { formula: string; tipo: string }[];
  potenciado: string;
  // truco, conjuro, foco o ritual
  clase: 'truco' | 'conjuro' | 'foco' | 'ritual';
}

export interface DoteCompendio extends Base {
  categoria: string;
  costo: Costo | null;
  prerrequisitos: string[];
  frecuencia: string;
}

export interface EquipoCompendio extends Base {
  clase: string;
  // En piezas de plata
  precio: number;
  bulto: number;
  arma?: { categoria: string; grupo: string; dados: string; tipoDano: string; manos: number; distancia: number | null; recarga: string | null };
  armadura?: { categoria: string; ca: number; topeDex: number | null; penalizacion: number; velocidad: number; fuerza: number };
  escudo?: { ca: number; dureza: number; pg: number };
}

export interface AccionCompendio extends Base {
  costo: Costo | null;
  categoria: string;
}

// Lo demás: ascendencias, herencias, trasfondos, clases, rasgos de clase, deidades, condiciones y peligros
export interface GenericoCompendio extends Base {
  datos: Record<string, unknown>;
}

export type EntradaCompendio = CriaturaCompendio | ConjuroCompendio | DoteCompendio | EquipoCompendio | AccionCompendio | GenericoCompendio;

// ---------- Del compendio a la mesa ----------
// Lo que la sala acepta tiene topes (textos, rasgos, ataques): aquí se recorta lo que no entra.

const corto = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
const rasgosCortos = (rs: string[]) => rs.slice(0, 12).map((r) => r.slice(0, 30));

export function conjuroAAptitud(c: ConjuroCompendio): Aptitud {
  const formula = c.dano.find((d) => leerExpresion(d.formula))?.formula;
  const defensa = c.defensa === 'ataque' ? 'Ataque de conjuro contra la CA.'
    : c.defensa ? `Salvación${c.basica ? ' básica' : ''} de ${c.defensa[0]!.toUpperCase()}${c.defensa.slice(1)}.` : '';
  const datos = [c.tiempo, c.area, c.objetivos && `Objetivos: ${c.objetivos}`, c.duracion && `Duración: ${c.duracion}`, defensa].filter(Boolean).join(' · ');
  const ritual = c.clase === 'ritual';
  return {
    id: `compendio:conjuro:${c.id}`.slice(0, 100),
    nombre: corto(c.nombre, 60),
    verbo: corto(c.nombre, 60),
    categoria: c.clase === 'truco' ? 'truco' : c.clase === 'foco' ? 'foco' : 'conjuro',
    costo: ritual ? 'larga' : c.costo ?? 2,
    recuperacion: c.clase === 'truco' || ritual ? { tipo: 'siempre' } : c.clase === 'foco' ? { tipo: 'foco' } : { tipo: 'espacio', rango: Math.min(10, Math.max(1, c.rango)) },
    descripcion: corto([datos, c.descripcion].filter(Boolean).join('\n'), 2000),
    rasgos: rasgosCortos(c.rasgos),
    ...(c.defensa === 'ataque' ? { tirada: { tipo: 'ataque-conjuro' as const } } : formula ? { tirada: { tipo: 'expresion' as const, expresion: formula } } : {}),
    ...(formula ? { dano: formula } : {}),
    ...(c.distancia !== null ? { distancia: Math.min(1000, Math.max(5, c.distancia)) } : {}),
    ...(() => { const i = interaccionDeConjuro(c); return i ? { interaccion: i } : {}; })(),
  };
}

const NUMEROS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10 };

// Lo que el motor de interacciones necesita de un conjuro: quién tira, a quiénes alcanza, qué daño o curación lleva.
// Los del catálogo traen sus grados a mano; el resto se arma con lo que dice el libro.
export function interaccionDeConjuro(c: ConjuroCompendio): Interaccion | null {
  if (CATALOGO_INTERACCIONES[claveDe(c.nombre)]) return null;
  const valido = c.dano.find((d) => leerExpresion(d.formula));
  const curacion = valido && valido.tipo === 'vitality' && /willing|living|ally/i.test(c.objetivos) ? valido.formula : undefined;
  const dano = valido && !curacion ? { formula: valido.formula, tipo: valido.tipo === 'untyped' ? '' : valido.tipo.slice(0, 30) } : undefined;
  if (!dano && !curacion) return null;
  const area = leerArea(c.area.replace(/cylinder/i, 'burst'));
  const varios = /up to (\d+|one|two|three|four|five|six|ten) (?:willing )?(?:creatures|targets)/i.exec(c.objetivos);
  const max = varios ? NUMEROS[varios[1]!.toLowerCase()] ?? Number(varios[1]) : 1;
  const aliados = /willing|ally|allies/i.test(c.objetivos) || !!curacion;
  const objetivos: Objetivos = area ? { tipo: 'area', area: { ...area, tamano: Math.min(500, area.tamano) }, ...(aliados ? { aliados } : {}) }
    : max > 1 ? { tipo: 'varios', max: Math.min(10, max), ...(aliados ? { aliados } : {}) }
    : { tipo: 'uno', ...(aliados ? { aliados } : {}) };
  if (curacion) return { modo: { tipo: 'ninguna' }, objetivos, curacion };
  if (c.defensa === 'ataque') return { modo: { tipo: 'ataque' }, objetivos, dano };
  if (c.defensa) {
    return { modo: { tipo: 'salvacion', salvacion: c.defensa, basica: c.basica }, objetivos, dano, ...(c.basica ? {} : { porGrado: { fallo: { dano: 1 }, pifia: { dano: 2 } } }) };
  }
  return { modo: { tipo: 'ninguna' }, objetivos, dano };
}

const PERIODOS: Record<string, 'turno' | '10min' | 'hora' | 'dia'> = { day: 'dia', hour: 'hora', PT10M: '10min', PT1H: 'hora', P1D: 'dia', turn: 'turno', round: 'turno' };

// Solo las dotes que se usan (con acciones) se vuelven aptitud; las pasivas van a la lista de dotes
export function doteAAptitud(d: DoteCompendio): Aptitud | null {
  if (d.costo === null) return null;
  const [veces, per] = d.frecuencia.split('/');
  const periodo = per ? PERIODOS[per] : undefined;
  // "Trigger You're about to roll initiative": la mesa la ofrece al preparar el combate
  const alEmpezar = /Trigger\b[^\n—]*initiative/i.test(d.descripcion);
  return {
    id: `compendio:dote:${d.id}`.slice(0, 100),
    nombre: corto(d.nombre, 60),
    verbo: corto(d.nombre, 60),
    categoria: 'dote',
    costo: d.costo,
    recuperacion: periodo ? { tipo: 'frecuencia', veces: Math.min(10, Math.max(1, Number(veces) || 1)), periodo } : { tipo: 'siempre' },
    descripcion: corto(d.descripcion, 2000),
    rasgos: rasgosCortos(d.rasgos),
    ...(alEmpezar ? { disparadores: ['iniciativa' as const] } : {}),
  };
}

// Una criatura del compendio lista para un token: números, ataques y lo especial resumido en sus notas
export function criaturaDeCompendio(c: CriaturaCompendio): { tamano: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan'; ca: number; pg: number; percepcion: number; criatura: Criatura } {
  const tamanos = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const;
  const especial = c.aptitudes.map((a) => `${a.nombre}${a.costo ? ` (${a.costo === 'reaccion' ? 'reacción' : a.costo === 'libre' ? 'libre' : `${a.costo}◆`})` : ''}: ${a.texto}`).join('\n');
  const lista = (xs: { tipo: string; valor: number }[]) => xs.slice(0, 20).map((x) => ({ tipo: x.tipo.slice(0, 30), valor: Math.min(99, Math.max(0, x.valor)) }));
  return {
    tamano: tamanos.find((t) => t === c.tamano) ?? 'Medium',
    ca: Math.min(80, Math.max(0, c.ca)),
    pg: Math.min(999, Math.max(1, c.pg)),
    percepcion: Math.min(60, Math.max(-10, c.percepcion)),
    criatura: {
      nivel: Math.min(30, Math.max(-1, c.nivel ?? 0)),
      salvaciones: c.salvaciones,
      velocidad: Math.min(200, Math.max(0, c.velocidad)),
      ataques: c.ataques.slice(0, 12).map((a) => ({
        id: a.id.slice(0, 60), nombre: corto(a.nombre, 60), bono: a.bono, dano: a.dano, tipoDano: a.tipoDano.slice(0, 30), agil: a.agil,
        rasgos: rasgosCortos(a.rasgos), ...(a.distancia ? { distancia: Math.min(1000, Math.max(5, a.distancia)) } : {}),
      })).filter((a) => leerExpresion(a.dano)),
      habilidades: c.habilidades.slice(0, 20).map((h) => ({ nombre: h.nombre.slice(0, 40), bono: h.bono })),
      rasgos: c.rasgos.slice(0, 20).map((r) => r.slice(0, 30)),
      notas: corto([c.otrasVelocidades.length ? `Velocidades: ${c.otrasVelocidades.join(', ')}` : '', c.sentidos.length ? `Sentidos: ${c.sentidos.join(', ')}` : '', especial].filter(Boolean).join('\n'), 2000),
      defensas: {
        inmunidades: c.defensas.inmunidades.slice(0, 20).map((x) => x.slice(0, 30)),
        resistencias: lista(c.defensas.resistencias),
        debilidades: lista(c.defensas.debilidades),
      },
    },
  };
}

// Un objeto del compendio a la mochila
export function objetoDeCompendio(e: EquipoCompendio): { id: string; nombre: string; cantidad: number; bulto: number } {
  return { id: `compendio:${e.id}`.slice(0, 80), nombre: corto(e.nombre, 80), cantidad: 1, bulto: Math.min(50, Math.max(0, e.bulto)) };
}

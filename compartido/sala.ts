// Protocolo de la sala: el estado de una partida y las acciones que lo cambian.
// Lo usan la interfaz y el Durable Object con el mismo `aplicar`, así los dos lados llegan al mismo estado.

import { esPersonajeValido, type Personaje } from '../reglas/pf2e';

export type TipoToken = 'personaje' | 'enemigo' | 'npc';

// Tamaños de criatura de PF2e. El valor es cuántas casillas ocupa por lado.
export const TAMANOS = {
  Tiny: 0.5,
  Small: 1,
  Medium: 1,
  Large: 2,
  Huge: 3,
  Gargantuan: 4,
} as const;
export type Tamano = keyof typeof TAMANOS;

export interface Token {
  id: string;
  nombre: string;
  tipo: TipoToken;
  tamano: Tamano;
  // Casilla de la esquina superior izquierda
  x: number;
  y: number;
  // URL de la imagen en R2; sin imagen se dibuja la inicial sobre el color
  imagen?: string;
  color: string;
  // Token de un personaje jugador: su dueño lo puede mover. El nombre y la imagen salen de la ficha.
  personajeId?: string;
}

export interface Mapa {
  imagen?: string;
  // Medidas de la cuadrícula sobre la imagen, en píxeles de la imagen
  tamanoCelda: number;
  desplazamientoX: number;
  desplazamientoY: number;
  // Sin imagen, el tablero es una cuadrícula vacía de este tamaño
  columnas: number;
  filas: number;
  mostrarCuadricula: boolean;
}

export interface Tirada {
  id: string;
  quien: string;
  etiqueta: string;
  dados: number[];
  caras: number;
  modificador: number;
  total: number;
  cuando: number;
}

export interface EstadoSala {
  mapa: Mapa;
  tokens: Record<string, Token>;
  personajes: Record<string, Personaje>;
  // Las últimas tiradas, la más nueva al final
  tiradas: Tirada[];
}

export const MAX_TIRADAS = 40;

export type Accion =
  | { tipo: 'mover-token'; id: string; x: number; y: number }
  | { tipo: 'crear-token'; token: Token }
  | { tipo: 'editar-token'; id: string; cambios: Partial<Omit<Token, 'id' | 'personajeId'>> }
  | { tipo: 'borrar-token'; id: string }
  | { tipo: 'editar-mapa'; cambios: Partial<Mapa> }
  // Crear un personaje también pone su token en el tablero
  | { tipo: 'crear-personaje'; personaje: Personaje; x: number; y: number }
  | { tipo: 'editar-personaje'; id: string; cambios: Partial<Omit<Personaje, 'id'>> }
  | { tipo: 'borrar-personaje'; id: string }
  // Solo la sala la produce: el navegador pide tirar y la sala tira los dados
  | { tipo: 'registrar-tirada'; tirada: Tirada };

// Quién eres en la mesa. El visitante aún no entra: solo ve la lista de personajes.
export type Sesion =
  | { rol: 'visitante' }
  | { rol: 'gm' }
  | { rol: 'jugador'; personajeId: string };

export interface Presente {
  idConexion: string;
  nombre: string;
  rol: Sesion['rol'];
}

// Lo que ve quien todavía no entra: sin fichas completas
export interface ResumenPersonaje {
  id: string;
  nombre: string;
  clase: string;
  ascendencia: string;
  nivel: number;
  retrato?: string;
}

// Qué se puede tirar de una ficha. La sala calcula el modificador con el motor de reglas.
export type QueTirar =
  | { tipo: 'habilidad'; clave: string }
  | { tipo: 'salvacion'; clave: string }
  | { tipo: 'percepcion' }
  | { tipo: 'ataque'; golpe: string; numero: 0 | 1 | 2 }
  | { tipo: 'dano'; golpe: string };

// Interfaz → sala
export type MensajeCliente =
  | { tipo: 'entrar'; como: 'gm'; codigo: string }
  | { tipo: 'entrar'; como: 'jugador'; personajeId: string; codigo: string }
  | { tipo: 'reanudar'; sesion: string }
  | { tipo: 'nuevo-personaje'; personaje: Personaje; codigo: string }
  | { tipo: 'salir' }
  | { tipo: 'accion'; accion: Accion }
  | { tipo: 'tirar'; personajeId: string; que: QueTirar };

// Sala → interfaz
export type MensajeSala =
  | { tipo: 'lobby'; personajes: ResumenPersonaje[] }
  | { tipo: 'bienvenida'; sesion: string; quien: Sesion }
  | { tipo: 'rechazo'; motivo: string }
  | { tipo: 'estado'; estado: EstadoSala; presentes: Presente[]; tuConexion: string }
  | { tipo: 'accion'; accion: Accion }
  | { tipo: 'presentes'; presentes: Presente[] };

export const COLORES_TOKEN: Record<TipoToken, string> = {
  personaje: '#3f7d4e',
  enemigo: '#a8382f',
  npc: '#b08d57',
};

export function estadoInicial(): EstadoSala {
  return {
    mapa: {
      tamanoCelda: 70,
      desplazamientoX: 0,
      desplazamientoY: 0,
      columnas: 24,
      filas: 16,
      mostrarCuadricula: true,
    },
    tokens: {},
    personajes: {},
    tiradas: [],
  };
}

export function resumen(p: Personaje): ResumenPersonaje {
  return { id: p.id, nombre: p.nombre, clase: p.clase, ascendencia: p.ascendencia, nivel: p.nivel, retrato: p.retrato };
}

// Primera casilla libre de la fila de arriba, para poner un token nuevo
export function casillaLibre(estado: EstadoSala): { x: number; y: number } {
  const ocupadas = new Set(Object.values(estado.tokens).map((t) => `${t.x},${t.y}`));
  let x = 0;
  while (ocupadas.has(`${x},0`)) x++;
  return { x, y: 0 };
}

// Aplica una acción sin mutar el estado. Una acción inválida (token que no existe) no cambia nada.
export function aplicar(estado: EstadoSala, accion: Accion): EstadoSala {
  switch (accion.tipo) {
    case 'mover-token': {
      const token = estado.tokens[accion.id];
      if (!token) return estado;
      return { ...estado, tokens: { ...estado.tokens, [token.id]: { ...token, x: accion.x, y: accion.y } } };
    }
    case 'crear-token':
      return { ...estado, tokens: { ...estado.tokens, [accion.token.id]: accion.token } };
    case 'editar-token': {
      const token = estado.tokens[accion.id];
      if (!token) return estado;
      return {
        ...estado,
        tokens: { ...estado.tokens, [token.id]: { ...token, ...accion.cambios, id: token.id, personajeId: token.personajeId } },
      };
    }
    case 'borrar-token': {
      if (!estado.tokens[accion.id]) return estado;
      const { [accion.id]: _borrado, ...resto } = estado.tokens;
      return { ...estado, tokens: resto };
    }
    case 'editar-mapa':
      return { ...estado, mapa: { ...estado.mapa, ...accion.cambios } };
    case 'crear-personaje': {
      const p = accion.personaje;
      const token: Token = {
        id: p.id,
        nombre: p.nombre,
        tipo: 'personaje',
        tamano: 'Medium',
        x: accion.x,
        y: accion.y,
        color: COLORES_TOKEN.personaje,
        personajeId: p.id,
        ...(p.retrato ? { imagen: p.retrato } : {}),
      };
      return {
        ...estado,
        personajes: { ...estado.personajes, [p.id]: p },
        tokens: { ...estado.tokens, [token.id]: token },
      };
    }
    case 'editar-personaje': {
      const actual = estado.personajes[accion.id];
      if (!actual) return estado;
      const p = { ...actual, ...accion.cambios, id: actual.id };
      // El token del personaje sigue a la ficha en nombre e imagen
      const tokens = { ...estado.tokens };
      for (const t of Object.values(tokens)) {
        if (t.personajeId === p.id) tokens[t.id] = { ...t, nombre: p.nombre, imagen: p.retrato };
      }
      return { ...estado, personajes: { ...estado.personajes, [p.id]: p }, tokens };
    }
    case 'borrar-personaje': {
      if (!estado.personajes[accion.id]) return estado;
      const { [accion.id]: _borrado, ...personajes } = estado.personajes;
      const tokens = Object.fromEntries(Object.entries(estado.tokens).filter(([, t]) => t.personajeId !== accion.id));
      return { ...estado, personajes, tokens };
    }
    case 'registrar-tirada':
      return { ...estado, tiradas: [...estado.tiradas, accion.tirada].slice(-MAX_TIRADAS) };
  }
}

// Quién puede hacer qué. La sala lo hace cumplir; la interfaz lo usa para no ofrecer lo que no se puede.
export function puede(quien: Sesion, accion: Accion, estado: EstadoSala): boolean {
  if (accion.tipo === 'registrar-tirada') return false;
  if (quien.rol === 'gm') return true;
  if (quien.rol !== 'jugador') return false;
  switch (accion.tipo) {
    case 'mover-token':
      return estado.tokens[accion.id]?.personajeId === quien.personajeId;
    case 'editar-personaje':
      return accion.id === quien.personajeId;
    default:
      return false;
  }
}

export function puedeMoverToken(quien: Sesion, token: Token): boolean {
  return quien.rol === 'gm' || (quien.rol === 'jugador' && token.personajeId === quien.personajeId);
}

// La sala no confía en lo que llega por el WebSocket: revisa la forma antes de aplicar.
// Las ediciones se revisan ya combinadas con lo que hay, para que el resultado siga siendo válido.
export function esAccionValida(valor: unknown, estado: EstadoSala): valor is Accion {
  if (typeof valor !== 'object' || valor === null) return false;
  const a = valor as Record<string, unknown>;
  switch (a.tipo) {
    case 'mover-token':
      return esTexto(a.id) && esNumero(a.x) && esNumero(a.y);
    case 'crear-token':
      return esTokenValido(a.token) && !(a.token as Token).personajeId;
    case 'editar-token': {
      const token = estado.tokens[a.id as string];
      return esTexto(a.id) && !!token && esObjeto(a.cambios) && esTokenValido({ ...token, ...a.cambios });
    }
    case 'borrar-token':
      return esTexto(a.id);
    case 'editar-mapa':
      return esObjeto(a.cambios) && esMapaValido({ ...estado.mapa, ...a.cambios });
    case 'crear-personaje':
      return esPersonajeValido(a.personaje) && esNumero(a.x) && esNumero(a.y);
    case 'editar-personaje': {
      const p = estado.personajes[a.id as string];
      return esTexto(a.id) && !!p && esObjeto(a.cambios) && esPersonajeValido({ ...p, ...a.cambios, id: p.id });
    }
    case 'borrar-personaje':
      return esTexto(a.id);
    default:
      return false;
  }
}

function esNumero(n: unknown): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function esTexto(t: unknown, max = 200): boolean {
  return typeof t === 'string' && t.length <= max;
}

function esObjeto(o: unknown): o is object {
  return typeof o === 'object' && o !== null && !Array.isArray(o);
}

function esTokenValido(t: unknown): boolean {
  if (!esObjeto(t)) return false;
  const k = t as Record<string, unknown>;
  return esTexto(k.id) && esTexto(k.nombre, 60) && esNumero(k.x) && esNumero(k.y)
    && (k.tipo === 'personaje' || k.tipo === 'enemigo' || k.tipo === 'npc')
    && typeof k.tamano === 'string' && k.tamano in TAMANOS
    && (k.imagen === undefined || esTexto(k.imagen, 500))
    && esTexto(k.color, 20)
    && (k.personajeId === undefined || esTexto(k.personajeId));
}

function esMapaValido(m: Record<string, unknown>): boolean {
  const entre = (n: unknown, min: number, max: number) => esNumero(n) && (n as number) >= min && (n as number) <= max;
  return (m.imagen === undefined || esTexto(m.imagen, 500))
    && entre(m.tamanoCelda, 10, 500)
    && esNumero(m.desplazamientoX) && esNumero(m.desplazamientoY)
    && entre(m.columnas, 1, 200) && entre(m.filas, 1, 200)
    && typeof m.mostrarCuadricula === 'boolean';
}

// Protocolo de la sala: el estado de una partida y las acciones que lo cambian.
// Lo usan la interfaz y el Durable Object con el mismo `aplicar`, así los dos lados llegan al mismo estado.

import { calcular, esPersonajeValido, type Grado, type Personaje, type Valor } from '../reglas/pf2e';
import {
  accionesAlEmpezar, alEmpezarTurno, alTerminarTurno, CONDICIONES, esCondicionesValida, penalizaciones, ponerCondicion,
  type ClaveCondicion, type Condicion,
} from '../reglas/condiciones';
import { descansar, disponibilidad, todasLasAptitudes, usar, type Aptitud, type Descanso } from '../reglas/aptitudes';
import { tieneMomento, type Momento } from '../reglas/disparadores';
import { alcanzables, caminoA, distanciaEntre, huella, type Casilla, type OpcionesMovimiento } from '../reglas/movimiento';

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
  condiciones?: Condicion[];
  // Números de enemigos y NPCs; los personajes los sacan de su ficha
  ca?: number;
  pg?: { actual: number; max: number };
  // Modificador de Perception, para la iniciativa
  percepcion?: number;
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
  // 0 si mezcla dados distintos
  caras: number;
  modificador: number;
  total: number;
  cuando: number;
  // Quién tiró (para avisarle lo que sigue) y desde qué token (para dibujar el golpe)
  personajeId?: string;
  autorTokenId?: string;
  // Si se tiró contra alguien: a quién y, si fue un d20 contra su CA, cómo salió
  objetivo?: { nombre: string; tokenId?: string; cd?: number; grado?: Grado };
}

// Un ataque en pausa: el objetivo tiene una reacción para "cuando te atacan" y la mesa espera su respuesta
export interface Espera {
  id: string;
  atacante: string;
  etiqueta: string;
  objetivoTokenId: string;
  personajeId: string;
  // Las reacciones que le sirven ahora
  aptitudes: string[];
  vence: number;
}

// Cuánto espera la mesa una reacción antes de seguir sin ella
export const ESPERA_MS = 20_000;

export interface Combatiente {
  tokenId: string;
  iniciativa: number;
}

export interface Combate {
  ronda: number;
  // Índice en `orden` de quien tiene el turno
  turno: number;
  orden: Combatiente[];
  // Del turno en curso: acciones que tiene, cuántas gastó y cuántos ataques hizo (para la penalización)
  acciones: number;
  usadas: number;
  ataques: number;
  // Tokens que ya usaron su reacción; se recupera al empezar su turno
  reacciones: string[];
}

export interface EstadoSala {
  mapa: Mapa;
  tokens: Record<string, Token>;
  personajes: Record<string, Personaje>;
  // Las últimas tiradas, la más nueva al final
  tiradas: Tirada[];
  combate: Combate | null;
  esperas: Espera[];
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
  | { tipo: 'poner-condicion'; tokenId: string; clave: ClaveCondicion; valor: number; hasta?: Condicion['hasta'] }
  | { tipo: 'terminar-combate' }
  | { tipo: 'avanzar-turno' }
  | { tipo: 'fijar-iniciativa'; tokenId: string; valor: number }
  | { tipo: 'agregar-a-combate'; tokenId: string; iniciativa: number }
  | { tipo: 'quitar-de-combate'; tokenId: string }
  | { tipo: 'gastar-acciones'; usadas: number }
  | { tipo: 'usar-reaccion'; tokenId: string; usada: boolean }
  // Gasta lo que cueste una aptitud (foco, espacio, uso, consumible)
  | { tipo: 'usar-aptitud'; personajeId: string; aptitudId: string; rango?: number }
  | { tipo: 'descansar'; personajeId: string; descanso: Descanso }
  // Solo la sala produce estas: tira los dados ella
  | { tipo: 'registrar-tirada'; tirada: Tirada }
  | { tipo: 'iniciar-combate'; orden: Combatiente[] }
  // Sube la penalización del siguiente ataque; un Strike además gasta su acción
  | { tipo: 'contar-ataque'; tokenId: string; gastaAccion: boolean }
  | { tipo: 'abrir-espera'; espera: Espera }
  // Un movimiento ya validado por la sala: el camino (para animarlo) y cuántas acciones gastó (Stride)
  | { tipo: 'mover-turno'; id: string; camino: Casilla[]; acciones: number }
  | { tipo: 'cerrar-espera'; id: string };

const SOLO_SALA: Accion['tipo'][] = ['registrar-tirada', 'iniciar-combate', 'contar-ataque', 'abrir-espera', 'cerrar-espera', 'mover-turno'];

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

// Qué se puede tirar. La sala calcula el modificador con el motor de reglas.
export type QueTirar =
  | { tipo: 'habilidad'; clave: string }
  | { tipo: 'salvacion'; clave: string }
  | { tipo: 'percepcion' }
  | { tipo: 'ataque'; golpe: string; numero: 0 | 1 | 2; objetivo?: string }
  | { tipo: 'dano'; golpe: string; critico?: boolean; objetivo?: string }
  // Lo que tire una aptitud (una skill, un ataque de conjuro, unos dados, un Strike)
  | { tipo: 'aptitud'; id: string; objetivo?: string; numero?: 0 | 1 | 2 }
  // Cualquier expresión ("1d20+7"); el GM la usa para los enemigos
  | { tipo: 'libre'; expresion: string; etiqueta?: string; objetivo?: string; critico?: boolean };

// Interfaz → sala
export type MensajeCliente =
  | { tipo: 'entrar'; como: 'gm'; codigo: string }
  | { tipo: 'entrar'; como: 'jugador'; personajeId: string; codigo: string }
  | { tipo: 'reanudar'; sesion: string }
  | { tipo: 'nuevo-personaje'; personaje: Personaje; codigo: string }
  | { tipo: 'salir' }
  | { tipo: 'accion'; accion: Accion }
  | { tipo: 'tirar'; personajeId?: string; que: QueTirar }
  | { tipo: 'iniciar-combate'; tokens: string[] }
  // Mover un token a una casilla: la sala calcula el camino, valida la Velocidad y gasta los Strides
  | { tipo: 'mover'; tokenId: string; x: number; y: number }
  // Usar una aptitud: la sala revisa turno, acciones, usos y alcance, y hace todo junto
  | { tipo: 'usar'; aptitudId: string; objetivo?: string }
  // Respuesta a un ataque en pausa: la reacción elegida, o null para dejarlo pasar
  | { tipo: 'responder'; esperaId: string; aptitudId: string | null };

// Sala → interfaz
export type MensajeSala =
  | { tipo: 'lobby'; personajes: ResumenPersonaje[] }
  | { tipo: 'bienvenida'; sesion: string; quien: Sesion }
  | { tipo: 'rechazo'; motivo: string }
  | { tipo: 'estado'; estado: EstadoSala; presentes: Presente[]; tuConexion: string }
  | { tipo: 'accion'; accion: Accion }
  | { tipo: 'presentes'; presentes: Presente[] }
  // La sala no dejó hacer algo: el motivo, para mostrarlo
  | { tipo: 'negado'; motivo: string };

// Tintas del cuaderno: bolígrafo azul para los personajes, rojo para enemigos, lápiz para los NPC
export const COLORES_TOKEN: Record<TipoToken, string> = {
  personaje: '#2450b0',
  enemigo: '#c8392b',
  npc: '#6b5a2e',
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
    combate: null,
    esperas: [],
  };
}

export function tokenDePersonaje(estado: EstadoSala, personajeId: string): Token | undefined {
  return Object.values(estado.tokens).find((t) => t.personajeId === personajeId);
}

// Las reacciones que un personaje puede usar ahora para un momento: con su reacción libre en esta ronda,
// con usos disponibles y con lo que pidan (Shield Block necesita el escudo levantado)
export function reaccionesPara(estado: EstadoSala, personajeId: string, momento: Momento): Aptitud[] {
  const p = estado.personajes[personajeId];
  const token = tokenDePersonaje(estado, personajeId);
  if (!p || !token) return [];
  if (estado.combate?.reacciones.includes(token.id)) return [];
  return todasLasAptitudes(p).filter((a) =>
    a.costo === 'reaccion' && tieneMomento(a, momento) && disponibilidad(p, a).puede
    && (!a.requiere || (token.condiciones ?? []).some((c) => c.clave === a.requiere)));
}

// Lo que un personaje puede hacer en un momento de su propio turno (no reacciones): "al atacar", "al acertar"…
export function aptitudesPara(p: Personaje, momento: Momento): Aptitud[] {
  return todasLasAptitudes(p).filter((a) => a.costo !== 'reaccion' && tieneMomento(a, momento));
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

// La CA de un token con sus condiciones: la de la ficha si es un personaje, la que puso el GM si no
export function caDeToken(estado: EstadoSala, token: Token): Valor | null {
  const condiciones = token.condiciones ?? [];
  if (token.personajeId) {
    const p = estado.personajes[token.personajeId];
    return p ? calcular(p, condiciones).ca : null;
  }
  if (token.ca === undefined) return null;
  const partes = [{ etiqueta: 'CA', valor: token.ca }, ...penalizaciones(condiciones, { tipo: 'ca' })];
  return { total: partes.reduce((s, p) => s + p.valor, 0), partes };
}

export function tokenEnTurno(estado: EstadoSala): Token | undefined {
  const c = estado.combate;
  const id = c?.orden[c.turno]?.tokenId;
  return id ? estado.tokens[id] : undefined;
}

// Orden de iniciativa: de mayor a menor. En un empate, los enemigos van antes que los personajes.
export function ordenar(orden: Combatiente[], tokens: Record<string, Token>): Combatiente[] {
  const esPersonaje = (c: Combatiente) => (tokens[c.tokenId]?.personajeId ? 1 : 0);
  return [...orden].sort((a, b) => b.iniciativa - a.iniciativa || esPersonaje(a) - esPersonaje(b));
}

// Lo que pasa al empezar el turno de un token: recupera su reacción y calcula sus acciones
function empezarTurno(estado: EstadoSala, combate: Combate): EstadoSala {
  const id = combate.orden[combate.turno]?.tokenId;
  const token = id ? estado.tokens[id] : undefined;
  if (!token) return { ...estado, combate: { ...combate, acciones: 3, usadas: 0, ataques: 0 } };
  // Lo que duraba "hasta tu próximo turno" (escudo levantado) se va; luego se pagan Slowed y Stunned
  const vigentes = alEmpezarTurno(token.condiciones ?? []);
  const { acciones, stunnedRestante } = accionesAlEmpezar(vigentes);
  const condiciones = ponerCondicion(vigentes, 'stunned', stunnedRestante);
  return {
    ...estado,
    tokens: { ...estado.tokens, [token.id]: { ...token, condiciones } },
    combate: { ...combate, acciones, usadas: 0, ataques: 0, reacciones: combate.reacciones.filter((r) => r !== token.id) },
  };
}

// Saca un token del orden sin perder de quién es el turno
function quitarDelOrden(combate: Combate, tokenId: string): Combate {
  const i = combate.orden.findIndex((c) => c.tokenId === tokenId);
  if (i < 0) return combate;
  const orden = combate.orden.filter((c) => c.tokenId !== tokenId);
  const turno = i < combate.turno ? combate.turno - 1 : Math.min(combate.turno, Math.max(0, orden.length - 1));
  return { ...combate, orden, turno };
}

// Reordena manteniendo el turno en el mismo token
function reordenar(combate: Combate, orden: Combatiente[], tokens: Record<string, Token>): Combate {
  const actual = combate.orden[combate.turno]?.tokenId;
  const nuevo = ordenar(orden, tokens);
  return { ...combate, orden: nuevo, turno: Math.max(0, nuevo.findIndex((c) => c.tokenId === actual)) };
}

function sinToken(estado: EstadoSala, tokenId: string): EstadoSala {
  return estado.combate ? { ...estado, combate: quitarDelOrden(estado.combate, tokenId) } : estado;
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
      return sinToken({ ...estado, tokens: resto }, accion.id);
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
      const quitados = Object.values(estado.tokens).filter((t) => t.personajeId === accion.id).map((t) => t.id);
      const tokens = Object.fromEntries(Object.entries(estado.tokens).filter(([id]) => !quitados.includes(id)));
      return quitados.reduce(sinToken, { ...estado, personajes, tokens });
    }
    case 'poner-condicion': {
      const token = estado.tokens[accion.tokenId];
      if (!token) return estado;
      const condiciones = ponerCondicion(token.condiciones ?? [], accion.clave, accion.valor, accion.hasta);
      return { ...estado, tokens: { ...estado.tokens, [token.id]: { ...token, condiciones } } };
    }
    case 'registrar-tirada':
      return { ...estado, tiradas: [...estado.tiradas, accion.tirada].slice(-MAX_TIRADAS) };
    case 'iniciar-combate': {
      const orden = ordenar(accion.orden.filter((c) => estado.tokens[c.tokenId]), estado.tokens);
      if (orden.length === 0) return estado;
      return empezarTurno(estado, { ronda: 1, turno: 0, orden, acciones: 3, usadas: 0, ataques: 0, reacciones: [] });
    }
    case 'terminar-combate':
      return { ...estado, combate: null };
    case 'avanzar-turno': {
      const c = estado.combate;
      if (!c || c.orden.length === 0) return estado;
      // Al terminar el turno: Frightened baja 1
      const actual = tokenEnTurno(estado);
      const tokens = actual
        ? { ...estado.tokens, [actual.id]: { ...actual, condiciones: alTerminarTurno(actual.condiciones ?? []) } }
        : estado.tokens;
      const siguiente = c.turno + 1;
      const vuelta = siguiente >= c.orden.length;
      return empezarTurno({ ...estado, tokens }, { ...c, turno: vuelta ? 0 : siguiente, ronda: vuelta ? c.ronda + 1 : c.ronda });
    }
    case 'fijar-iniciativa': {
      const c = estado.combate;
      if (!c) return estado;
      const orden = c.orden.map((x) => (x.tokenId === accion.tokenId ? { ...x, iniciativa: accion.valor } : x));
      return { ...estado, combate: reordenar(c, orden, estado.tokens) };
    }
    case 'agregar-a-combate': {
      const c = estado.combate;
      if (!c || !estado.tokens[accion.tokenId] || c.orden.some((x) => x.tokenId === accion.tokenId)) return estado;
      return { ...estado, combate: reordenar(c, [...c.orden, { tokenId: accion.tokenId, iniciativa: accion.iniciativa }], estado.tokens) };
    }
    case 'quitar-de-combate':
      return sinToken(estado, accion.tokenId);
    case 'gastar-acciones': {
      const c = estado.combate;
      if (!c) return estado;
      return { ...estado, combate: { ...c, usadas: Math.max(0, Math.min(c.acciones, accion.usadas)) } };
    }
    case 'usar-reaccion': {
      const c = estado.combate;
      if (!c) return estado;
      const resto = c.reacciones.filter((r) => r !== accion.tokenId);
      return { ...estado, combate: { ...c, reacciones: accion.usada ? [...resto, accion.tokenId] : resto } };
    }
    case 'usar-aptitud': {
      const p = estado.personajes[accion.personajeId];
      const cambios = p && usar(p, accion.aptitudId, accion.rango);
      if (!p || !cambios) return estado;
      return { ...estado, personajes: { ...estado.personajes, [p.id]: { ...p, ...cambios } } };
    }
    case 'descansar': {
      const p = estado.personajes[accion.personajeId];
      if (!p) return estado;
      const cambios = descansar(p, accion.descanso, calcular(p).pgMax.total);
      return { ...estado, personajes: { ...estado.personajes, [p.id]: { ...p, ...cambios } } };
    }
    case 'mover-turno': {
      const token = estado.tokens[accion.id];
      const fin = accion.camino.at(-1);
      if (!token || !fin) return estado;
      const tokens = { ...estado.tokens, [token.id]: { ...token, x: fin.x, y: fin.y } };
      const c = estado.combate;
      const gasta = c && accion.acciones > 0 && tokenEnTurno(estado)?.id === token.id;
      return { ...estado, tokens, ...(gasta ? { combate: { ...c, usadas: Math.min(c.acciones, c.usadas + accion.acciones) } } : {}) };
    }
    case 'abrir-espera':
      return { ...estado, esperas: [...estado.esperas, accion.espera] };
    case 'cerrar-espera':
      return { ...estado, esperas: estado.esperas.filter((e) => e.id !== accion.id) };
    case 'contar-ataque': {
      const c = estado.combate;
      if (!c || tokenEnTurno(estado)?.id !== accion.tokenId) return estado;
      return { ...estado, combate: { ...c, ataques: c.ataques + 1, usadas: Math.min(c.acciones, c.usadas + (accion.gastaAccion ? 1 : 0)) } };
    }
  }
}

// Quién puede hacer qué. La sala lo hace cumplir; la interfaz lo usa para no ofrecer lo que no se puede.
export function puede(quien: Sesion, accion: Accion, estado: EstadoSala): boolean {
  if (SOLO_SALA.includes(accion.tipo)) return false;
  if (quien.rol === 'gm') return true;
  if (quien.rol !== 'jugador') return false;
  const esMio = (tokenId: string) => estado.tokens[tokenId]?.personajeId === quien.personajeId;
  switch (accion.tipo) {
    // En combate, los jugadores se mueven con Stride (mensaje 'mover'); fuera de combate, libres
    case 'mover-token':
      return esMio(accion.id) && !estado.combate;
    case 'editar-personaje':
      return accion.id === quien.personajeId;
    case 'poner-condicion':
      return esMio(accion.tokenId);
    case 'usar-reaccion':
      return esMio(accion.tokenId);
    case 'avanzar-turno':
    case 'gastar-acciones':
      return tokenEnTurno(estado)?.personajeId === quien.personajeId;
    case 'usar-aptitud':
    case 'descansar':
      return accion.personajeId === quien.personajeId;
    default:
      return false;
  }
}

export function puedeMoverToken(quien: Sesion, token: Token): boolean {
  return quien.rol === 'gm' || (quien.rol === 'jugador' && token.personajeId === quien.personajeId);
}

// ---- Reglas de la mesa en combate: lo que la sala exige, con un motivo legible cuando dice que no ----

export function ladoDe(t: Token): number {
  return Math.max(1, Math.ceil(TAMANOS[t.tamano]));
}

export function velocidadDe(estado: EstadoSala, t: Token): number {
  return (t.personajeId ? estado.personajes[t.personajeId]?.velocidad : undefined) ?? 25;
}

const esEnemigoDe = (a: Token, b: Token) => Boolean(a.personajeId) !== Boolean(b.personajeId) && (a.tipo === 'enemigo' || b.tipo === 'enemigo');

// Por dónde puede pasar un token: no atraviesa enemigos, no termina sobre nadie
export function opcionesMovimiento(estado: EstadoSala, t: Token): OpcionesMovimiento {
  const bloqueadas = new Set<string>();
  const ocupadas = new Set<string>();
  for (const otro of Object.values(estado.tokens)) {
    if (otro.id === t.id) continue;
    const casillas = huella(otro, ladoDe(otro));
    casillas.forEach((k) => ocupadas.add(k));
    if (esEnemigoDe(t, otro)) casillas.forEach((k) => bloqueadas.add(k));
  }
  const conLimites = !estado.mapa.imagen;
  return {
    lado: ladoDe(t), bloqueadas, ocupadas,
    columnas: conLimites ? estado.mapa.columnas : Infinity,
    filas: conLimites ? estado.mapa.filas : Infinity,
  };
}

export interface PlanMovimiento {
  camino: Casilla[];
  pies: number;
  // Strides que gasta (0 fuera de combate o fuera de su turno para el GM)
  acciones: number;
}

// Calcula si un token puede llegar a una casilla: en su turno, con un Stride por cada tramo de su Velocidad
export function planMovimiento(estado: EstadoSala, t: Token, destino: Casilla, libres: number | null): PlanMovimiento | { motivo: string } {
  const velocidad = velocidadDe(estado, t);
  const tramos = libres === null ? 8 : Math.min(libres, 3);
  if (libres !== null && libres <= 0) return { motivo: 'No te quedan acciones para moverte este turno.' };
  const mapa = alcanzables({ x: t.x, y: t.y }, velocidad * tramos, opcionesMovimiento(estado, t));
  const camino = caminoA(destino, mapa);
  if (!camino) {
    const ocupada = huella(destino, ladoDe(t)).some((k) => opcionesMovimiento(estado, t).ocupadas.has(k));
    if (ocupada) return { motivo: 'Esa casilla está ocupada.' };
    return { motivo: libres === null ? 'No hay camino libre hasta ahí.' : `Muy lejos: con ${libres === 1 ? 'tu acción' : `tus ${libres} acciones`} llegas a ${velocidad * tramos} ft.` };
  }
  const pies = mapa.get(`${destino.x},${destino.y}`)!.pies;
  return { camino, pies, acciones: libres === null ? 0 : Math.max(1, Math.ceil(pies / velocidad)) };
}

// ¿Puede actuar ahora un personaje con algo que cuesta `costo`? null si sí; si no, por qué
export function motivoParaActuar(estado: EstadoSala, personajeId: string, costo: number | 'reaccion' | 'libre' | 'larga'): string | null {
  const c = estado.combate;
  const token = tokenDePersonaje(estado, personajeId);
  if (costo === 'larga') return c ? 'Es una actividad de minutos: no se puede en combate.' : null;
  if (!c || !token || !c.orden.some((x) => x.tokenId === token.id)) return null;
  if (costo === 'reaccion') return c.reacciones.includes(token.id) ? 'Ya usaste tu reacción esta ronda.' : null;
  const enTurno = tokenEnTurno(estado);
  if (enTurno?.id !== token.id) return `No es tu turno: ahora juega ${enTurno?.nombre ?? 'otro'}.`;
  if (costo === 'libre') return null;
  const libres = c.acciones - c.usadas;
  if (costo > libres) return libres === 0 ? 'No te quedan acciones este turno.' : `Te ${costo - libres === 1 ? 'falta 1 acción' : `faltan ${costo - libres} acciones`}.`;
  return null;
}

// ¿Llega al objetivo? `distancia` en pies (5 = cuerpo a cuerpo, al lado)
export function motivoAlcance(desde: Token, hasta: Token, distancia: number): string | null {
  const pies = distanciaEntre(desde, ladoDe(desde), hasta, ladoDe(hasta));
  if (pies <= distancia) return null;
  return distancia <= 5
    ? `${hasta.nombre} está a ${pies} ft: tienes que estar al lado. Acércate primero.`
    : `${hasta.nombre} está a ${pies} ft y tu alcance es ${distancia} ft.`;
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
    case 'poner-condicion':
      return esTexto(a.tokenId) && typeof a.clave === 'string' && a.clave in CONDICIONES && esEntero(a.valor, 0, 20)
        && (a.hasta === undefined || a.hasta === 'inicio-turno');
    case 'terminar-combate':
    case 'avanzar-turno':
      return true;
    case 'fijar-iniciativa':
      return esTexto(a.tokenId) && esEntero(a.valor, -20, 100);
    case 'agregar-a-combate':
      return esTexto(a.tokenId) && esEntero(a.iniciativa, -20, 100);
    case 'quitar-de-combate':
      return esTexto(a.tokenId);
    case 'gastar-acciones':
      return esEntero(a.usadas, 0, 10);
    case 'usar-reaccion':
      return esTexto(a.tokenId) && typeof a.usada === 'boolean';
    case 'usar-aptitud':
      return esTexto(a.personajeId) && esTexto(a.aptitudId) && (a.rango === undefined || esEntero(a.rango, 1, 10))
        && !!estado.personajes[a.personajeId as string]
        && usar(estado.personajes[a.personajeId as string]!, a.aptitudId as string, a.rango as number | undefined) !== null;
    case 'descansar':
      return esTexto(a.personajeId) && (a.descanso === 'refocus' || a.descanso === 'diario');
    default:
      return false;
  }
}

function esNumero(n: unknown): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

function esEntero(n: unknown, min: number, max: number): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
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
  const pg = k.pg as Record<string, unknown> | undefined;
  return esTexto(k.id) && esTexto(k.nombre, 60) && esNumero(k.x) && esNumero(k.y)
    && (k.tipo === 'personaje' || k.tipo === 'enemigo' || k.tipo === 'npc')
    && typeof k.tamano === 'string' && k.tamano in TAMANOS
    && (k.imagen === undefined || esTexto(k.imagen, 500))
    && esTexto(k.color, 20)
    && (k.personajeId === undefined || esTexto(k.personajeId))
    && (k.condiciones === undefined || esCondicionesValida(k.condiciones))
    && (k.ca === undefined || esEntero(k.ca, 0, 80))
    && (k.percepcion === undefined || esEntero(k.percepcion, -10, 60))
    && (pg === undefined || (esObjeto(pg) && esEntero(pg.actual, 0, 9999) && esEntero(pg.max, 1, 9999)));
}

function esMapaValido(m: Record<string, unknown>): boolean {
  const entre = (n: unknown, min: number, max: number) => esNumero(n) && (n as number) >= min && (n as number) <= max;
  return (m.imagen === undefined || esTexto(m.imagen, 500))
    && entre(m.tamanoCelda, 10, 500)
    && esNumero(m.desplazamientoX) && esNumero(m.desplazamientoY)
    && entre(m.columnas, 1, 200) && entre(m.filas, 1, 200)
    && typeof m.mostrarCuadricula === 'boolean';
}

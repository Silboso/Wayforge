// Protocolo de la sala: el estado de una partida y las acciones que lo cambian.
// Lo usan la interfaz y el Durable Object con el mismo `aplicar`, así los dos lados llegan al mismo estado.

import { esCriaturaValida, type Criatura } from '../reglas/criaturas';
import { calcular, esPersonajeValido, leerExpresion, type Grado, type Personaje, type Valor } from '../reglas/pf2e';
import {
  contarRondas, esEfectoValido, esEfectosValidos, ponerEfecto, sostener, velocidadConEfectos, vencerSostenidos, type Aspecto, type EfectoActivo,
} from '../reglas/efectos';
import {
  accionesAlEmpezar, alEmpezarTurno, alTerminarTurno, CONDICIONES, esCondicionesValida, penalizaciones, ponerCondicion,
  type ClaveCondicion, type Condicion,
} from '../reglas/condiciones';
import { descansar, disponibilidad, todasLasAptitudes, usar, type Aptitud, type Descanso } from '../reglas/aptitudes';
import { momentoIniciativa, tieneMomento, type Momento, type MomentoIniciativa } from '../reglas/disparadores';
import { alcanzables, caminoA, distanciaEntre, huella, type Casilla, type OpcionesMovimiento } from '../reglas/movimiento';
import { esClaveIniciativa, type ClaveIniciativa } from './tiradas';
import { cruzaMuro, esBrillo, esLucesValido, esMurosValido, type Brillo, type Luz, type LuzAmbiente, type Muro } from './vision';

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
  // Lo que le dejaron puesto las aptitudes (Bless, fuego persistente…), con su duración
  efectos?: EfectoActivo[];
  // La luz que lleva (una antorcha: 20 ft brillante y 20 más tenue)
  luz?: Brillo;
  // Números de enemigos y NPCs; los personajes los sacan de su ficha
  ca?: number;
  pg?: { actual: number; max: number };
  // Modificador de Perception, para la iniciativa
  percepcion?: number;
  // Los números de un enemigo o NPC: nivel, salvaciones, velocidad y ataques
  criatura?: Criatura;
}

// El fondo dibujado cuando no hay imagen de mapa; sin valor (salas viejas) es el claro del bosque
export type Terreno = 'claro' | 'mazmorra' | 'ninguno';
export const TERRENOS_VALIDOS: Terreno[] = ['claro', 'mazmorra', 'ninguno'];

export interface Mapa {
  imagen?: string;
  terreno?: Terreno;
  // Muros, puertas y ventanas (ver compartido/vision.ts) y la niebla de guerra (prendida salvo que el GM la apague)
  muros?: Muro[];
  niebla?: boolean;
  // Lo que el grupo ya exploró, como máscara de casillas; `visibles` solo viaja en la vista de un jugador
  exploradas?: string;
  visibles?: string;
  // La luz del lugar y las fuentes que puso el GM; `penumbra` (lo que se ve apagado) solo viaja a un jugador
  luz?: LuzAmbiente;
  luces?: Luz[];
  penumbra?: string;
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
  // Si se tiró contra alguien: a quién y, si fue un d20 contra su CA, cómo salió.
  // `salvacion`: el que tiró fue el objetivo (su grado es cómo resistió)
  objetivo?: { nombre: string; tokenId?: string; cd?: number; grado?: Grado; salvacion?: boolean };
  // Lo que el motor de interacciones le aplicó al objetivo por esta tirada
  resultado?: { dano?: number; curacion?: number; tipo?: string; nota?: string };
  // Tirada en secreto del GM (Recall Knowledge, Perception contra una trampa): solo la ve el GM
  secreta?: boolean;
}

// Un mensaje del chat de la mesa. `para`: un susurro ("gm" o el id de un personaje); lo ven solo quien lo
// manda, quien lo recibe y el GM
export interface MensajeChat {
  id: string;
  quien: string;
  rol: 'gm' | 'jugador';
  personajeId?: string;
  texto: string;
  cuando: number;
  para?: string;
}

export const MAX_CHAT = 80;

// ¿Puede ver esto alguien de la mesa? (los susurros ajenos y las tiradas secretas del GM, no)
export function puedeVerMensaje(m: MensajeChat, quien: Sesion): boolean {
  if (!m.para || quien.rol === 'gm') return true;
  if (quien.rol !== 'jugador') return false;
  return m.personajeId === quien.personajeId || m.para === quien.personajeId;
}
export const puedeVerTirada = (t: Tirada, quien: Sesion) => !t.secreta || quien.rol === 'gm';

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
  // Para los empates (y cuando el GM mueve a alguien en el orden): mayor va antes
  desempate?: number;
}

// Antes de pelear: el GM eligió quiénes entran y cada jugador dice con qué tira la iniciativa,
// usa lo que sirve "al tirar iniciativa" (Oracular Warning, Scout's Warning) y avisa que está listo
export interface Preparacion {
  tokens: string[];
  // Por token: Perception si no dice otra cosa
  tiradas: Record<string, ClaveIniciativa>;
  listos: string[];
  // Lo ya usado en esta preparación: "tokenId:aptitudId"
  usadas: string[];
  // Los que eligieron ir últimos en lugar de tirar (After You)
  ultimos: string[];
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

// Una escena guardada (no la que se está jugando): su mapa, sus criaturas y dónde quedaron los personajes
export interface Escena {
  id: string;
  nombre: string;
  mapa: Mapa;
  tokens: Token[];
  posiciones?: Record<string, { x: number; y: number }>;
}

export interface EstadoSala {
  mapa: Mapa;
  tokens: Record<string, Token>;
  personajes: Record<string, Personaje>;
  // Las últimas tiradas, la más nueva al final
  tiradas: Tirada[];
  combate: Combate | null;
  // Entre "se viene un combate" y la tirada de iniciativa
  preparacion?: Preparacion | null;
  esperas: Espera[];
  // La escena que se juega (su mapa y sus tokens son `mapa` y `tokens`) y las demás, guardadas
  escena?: { id: string; nombre: string };
  escenas?: Escena[];
  // Con el telón bajo, los jugadores no ven el tablero: el GM prepara la escena
  telon?: boolean;
  // El chat de la mesa, el más nuevo al final
  chat?: MensajeChat[];
}

export const MAX_ESCENAS = 30;

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
  // Escenas: crear una (en blanco, o copia de la actual), pasar a otra, renombrar, borrar; y el telón
  | { tipo: 'crear-escena'; id: string; nombre: string; copiar?: boolean }
  | { tipo: 'cambiar-escena'; id: string }
  | { tipo: 'renombrar-escena'; id: string; nombre: string }
  | { tipo: 'borrar-escena'; id: string }
  | { tipo: 'telon'; bajo: boolean }
  // Un mensaje del chat (lo arma la sala con quién lo mandó)
  | { tipo: 'chat'; mensaje: MensajeChat }
  // La preparación: el GM la abre con quiénes pelean; cada uno elige su tirada y avisa que está listo
  | { tipo: 'preparar-combate'; tokens: string[] }
  | { tipo: 'cancelar-preparacion' }
  | { tipo: 'elegir-iniciativa'; tokenId: string; clave: ClaveIniciativa }
  | { tipo: 'marcar-listo'; tokenId: string; listo: boolean }
  // El GM mueve a alguien en el orden (los empates los decide la mesa)
  | { tipo: 'mover-en-orden'; tokenId: string; posicion: number }
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
  | { tipo: 'cerrar-espera'; id: string }
  // Efectos con duración (el GM también los pone y quita a mano)
  | { tipo: 'poner-efecto'; tokenId: string; efecto: EfectoActivo }
  | { tipo: 'quitar-efecto'; tokenId: string; efectoId: string }
  // Daño ya ajustado (resistencias) y curación: PG temporales primero; a 0 PG un personaje queda Dying
  | { tipo: 'danar'; tokenId: string; cantidad: number; critico?: boolean }
  | { tipo: 'curar'; tokenId: string; cantidad: number }
  // Sustain: lo que mantiene ese token sigue una ronda más
  | { tipo: 'sostener'; tokenId: string }
  // Solo para verlo: las casillas que cubrió un área (no cambia el estado)
  | { tipo: 'mostrar-area'; casillas: Casilla[]; aspecto?: Aspecto; tipoDano?: string; autorTokenId?: string }
  // PG temporales: no se suman a los que ya tenga, queda el mayor
  | { tipo: 'dar-temporales'; tokenId: string; cantidad: number }
  // Alguien usó una aptitud de "al tirar iniciativa" en la preparación; `ultimo`: va último en lugar de tirar
  | { tipo: 'usar-preparacion'; tokenId: string; aptitudId: string; nombre: string; ultimo?: boolean }
  // Abrir o cerrar una puerta (la sala revisa quién puede y si está al lado)
  | { tipo: 'alternar-puerta'; id: string; abierta: boolean }
  // Lo que el grupo vio queda explorado
  | { tipo: 'explorar'; mascara: string }
  // Encender o apagar la luz que lleva un token (sin `luz`, la apaga)
  | { tipo: 'llevar-luz'; tokenId: string; luz?: Brillo };

const SOLO_SALA: Accion['tipo'][] = [
  'registrar-tirada', 'iniciar-combate', 'contar-ataque', 'abrir-espera', 'cerrar-espera', 'mover-turno', 'sostener', 'mostrar-area',
  'dar-temporales', 'usar-preparacion', 'alternar-puerta', 'explorar', 'chat',
];

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
  | { tipo: 'libre'; expresion: string; etiqueta?: string; objetivo?: string; critico?: boolean }
  // Lo que tira una criatura del GM: un ataque (con su penalización), su daño, o una salvación o Perception
  | { tipo: 'criatura'; tokenId: string; ataque: string; numero: 0 | 1 | 2; objetivo?: string }
  | { tipo: 'dano-criatura'; tokenId: string; ataque: string; critico?: boolean; objetivo?: string }
  | { tipo: 'chequeo-criatura'; tokenId: string; clave: 'fortitude' | 'reflex' | 'will' | 'percepcion' };

// Interfaz → sala
export type MensajeCliente =
  | { tipo: 'entrar'; como: 'gm'; codigo: string }
  | { tipo: 'entrar'; como: 'jugador'; personajeId: string; codigo: string }
  | { tipo: 'reanudar'; sesion: string }
  | { tipo: 'nuevo-personaje'; personaje: Personaje; codigo: string }
  | { tipo: 'salir' }
  | { tipo: 'accion'; accion: Accion }
  // `secreto`: solo el GM, y solo él la ve
  | { tipo: 'tirar'; personajeId?: string; que: QueTirar; secreto?: boolean }
  | { tipo: 'iniciar-combate'; tokens: string[] }
  // Mover un token a una casilla: la sala calcula el camino, valida la Velocidad y gasta los Strides
  | { tipo: 'mover'; tokenId: string; x: number; y: number }
  // Usar una aptitud: la sala revisa turno, acciones, usos y alcance, y hace todo junto.
  // `objetivos` para las de varios; `punto` es la esquina de una explosión o hacia dónde va un cono o una línea
  | { tipo: 'usar'; aptitudId: string; objetivo?: string; objetivos?: string[]; punto?: { x: number; y: number } }
  // Respuesta a un ataque en pausa: la reacción elegida, o null para dejarlo pasar
  | { tipo: 'responder'; esperaId: string; aptitudId: string | null }
  // Dónde está mi puntero en el tablero (en casillas; null si salió) y a quién apunto. No se guarda.
  | { tipo: 'puntero'; x: number | null; y: number | null; apunta: string | null }
  // "¡Aquí!": una señal en un punto del tablero que ven todos
  | { tipo: 'senal'; x: number; y: number }
  // Hablar en el chat; `para` lo vuelve susurro ("gm" o el id de un personaje)
  | { tipo: 'decir'; texto: string; para?: string }
  // Abrir o cerrar una puerta: el GM cualquiera; un jugador, la que tiene al lado (en combate gasta una acción)
  | { tipo: 'puerta'; id: string };

// Alguien más en el tablero: su puntero y su objetivo (efímero: viaja por el socket, no toca el estado)
export interface Puntero {
  idConexion: string;
  nombre: string;
  rol: Sesion['rol'];
  personajeId?: string;
  x: number | null;
  y: number | null;
  apunta: string | null;
}

// Sala → interfaz
export type MensajeSala =
  | { tipo: 'lobby'; personajes: ResumenPersonaje[] }
  | { tipo: 'bienvenida'; sesion: string; quien: Sesion }
  | { tipo: 'rechazo'; motivo: string }
  // `por`: la acción que provocó mandar el estado entero (pasar de escena, el telón), para avisar en pantalla
  | { tipo: 'estado'; estado: EstadoSala; presentes: Presente[]; tuConexion: string; por?: Accion }
  | { tipo: 'accion'; accion: Accion }
  // Con niebla, a un jugador: la acción (si no revela nada oculto) y lo que ahora ve (tokens y mapa)
  | { tipo: 'vista'; accion?: Accion; tokens: Record<string, Token>; mapa: Mapa }
  | { tipo: 'presentes'; presentes: Presente[] }
  // La sala no dejó hacer algo: el motivo, para mostrarlo
  | { tipo: 'negado'; motivo: string }
  | ({ tipo: 'puntero' } & Puntero)
  | { tipo: 'senal'; idConexion: string; nombre: string; personajeId?: string; x: number; y: number };

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
      terreno: 'claro',
      muros: [],
      niebla: true,
    },
    tokens: {},
    personajes: {},
    tiradas: [],
    combate: null,
    preparacion: null,
    esperas: [],
    escena: { id: 'inicio', nombre: 'Primera escena' },
    escenas: [],
    telon: false,
  };
}

// Pasa a otra escena: la actual se guarda (mapa, criaturas, dónde estaba cada personaje) y la otra se abre.
// Los personajes viajan: vuelven a donde estaban en esa escena, o aparecen en la entrada. El combate termina.
function cambiarEscena(estado: EstadoSala, destino: Escena): EstadoSala {
  const actual = estado.escena ?? { id: 'inicio', nombre: 'Primera escena' };
  const pjs = Object.values(estado.tokens).filter((t) => t.personajeId);
  const guardada: Escena = {
    id: actual.id, nombre: actual.nombre,
    mapa: { ...estado.mapa, visibles: undefined, penumbra: undefined },
    tokens: Object.values(estado.tokens).filter((t) => !t.personajeId),
    posiciones: Object.fromEntries(pjs.map((t) => [t.id, { x: t.x, y: t.y }])),
  };
  let siguiente: EstadoSala = {
    ...estado,
    mapa: destino.mapa,
    tokens: Object.fromEntries(destino.tokens.map((t) => [t.id, t])),
    escena: { id: destino.id, nombre: destino.nombre },
    escenas: [...(estado.escenas ?? []).filter((e) => e.id !== destino.id), guardada],
    combate: null, preparacion: null, esperas: [],
  };
  for (const t of pjs) {
    const antes = destino.posiciones?.[t.id];
    const lugar = antes ?? casillaLibre(siguiente);
    siguiente = { ...siguiente, tokens: { ...siguiente.tokens, [t.id]: { ...t, x: lugar.x, y: lugar.y } } };
  }
  return siguiente;
}

// Un mapa en blanco para una escena nueva (con el terreno de siempre)
export function mapaNuevo(): Mapa {
  return estadoInicial().mapa;
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

// Lo que sirve al empezar un combate (Oracular Warning, Scout's Warning, posturas): se ofrece en la preparación
export function aptitudesDePreparacion(p: Personaje): { aptitud: Aptitud; momento: MomentoIniciativa }[] {
  return todasLasAptitudes(p).flatMap((a) => {
    const momento = momentoIniciativa(a);
    return momento ? [{ aptitud: a, momento }] : [];
  });
}

export function resumen(p: Personaje): ResumenPersonaje {
  return { id: p.id, nombre: p.nombre, clase: p.clase, ascendencia: p.ascendencia, nivel: p.nivel, retrato: p.retrato };
}

// Dónde aparece un token nuevo: a la izquierda, a media altura (la entrada del sendero), en la primera casilla
// libre bajando por columnas. Así no queda en la esquina, tapado por los botones del tablero.
export function casillaLibre(estado: EstadoSala): { x: number; y: number } {
  const ocupadas = new Set(Object.values(estado.tokens).flatMap((t) => huella(t, ladoDe(t))));
  const { columnas, filas } = estado.mapa;
  const y0 = Math.max(0, Math.floor(filas / 2) - 2);
  for (let x = Math.min(2, columnas - 1); x < columnas; x++) {
    for (let i = 0; i < filas; i++) {
      const y = (y0 + i) % filas;
      if (!ocupadas.has(`${x},${y}`)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

// ¿Cae dentro del tablero? Con imagen de mapa no hay límite (el mapa puede ser más grande que la cuadrícula)
export function dentroDelTablero(mapa: Mapa, t: { x: number; y: number }, lado = 1): boolean {
  if (mapa.imagen) return true;
  return t.x >= 0 && t.y >= 0 && t.x + lado <= mapa.columnas && t.y + lado <= mapa.filas;
}

// La CA de un token con sus condiciones: la de la ficha si es un personaje, la que puso el GM si no
export function caDeToken(estado: EstadoSala, token: Token): Valor | null {
  const condiciones = token.condiciones ?? [];
  if (token.personajeId) {
    const p = estado.personajes[token.personajeId];
    return p ? calcular(p, condiciones, token.efectos ?? []).ca : null;
  }
  if (token.ca === undefined) return null;
  const partes = [{ etiqueta: 'CA', valor: token.ca }, ...penalizaciones(condiciones, { tipo: 'ca' }, token.efectos ?? [])];
  return { total: partes.reduce((s, p) => s + p.valor, 0), partes };
}

export function tokenEnTurno(estado: EstadoSala): Token | undefined {
  const c = estado.combate;
  const id = c?.orden[c.turno]?.tokenId;
  return id ? estado.tokens[id] : undefined;
}

// Orden de iniciativa: de mayor a menor. En un empate decide el desempate que puso el GM y, si no hay,
// los enemigos van antes que los personajes (la regla de PF2e).
export function ordenar(orden: Combatiente[], tokens: Record<string, Token>): Combatiente[] {
  const esPersonaje = (c: Combatiente) => (tokens[c.tokenId]?.personajeId ? 1 : 0);
  return [...orden].sort((a, b) => b.iniciativa - a.iniciativa || (b.desempate ?? 0) - (a.desempate ?? 0) || esPersonaje(a) - esPersonaje(b));
}

// Pone a un combatiente en otra posición del orden. Si para quedar ahí tiene que cambiar su número,
// toma el de su nuevo vecino; los desempates se rehacen para que el orden quede tal cual lo dejó el GM.
export function moverEnOrden(orden: Combatiente[], tokenId: string, posicion: number): Combatiente[] {
  const yo = orden.find((c) => c.tokenId === tokenId);
  if (!yo) return orden;
  const resto = orden.filter((c) => c.tokenId !== tokenId);
  const i = Math.max(0, Math.min(resto.length, posicion));
  const antes = resto[i - 1];
  const despues = resto[i];
  let iniciativa = yo.iniciativa;
  if (antes && iniciativa > antes.iniciativa) iniciativa = antes.iniciativa;
  if (despues && iniciativa < despues.iniciativa) iniciativa = despues.iniciativa;
  const nuevo = [...resto.slice(0, i), { ...yo, iniciativa }, ...resto.slice(i)];
  return nuevo.map((c, j) => ({ ...c, desempate: nuevo.length - j }));
}

// Lo que se ve de la preparación de un token
export function preparacionDe(estado: EstadoSala, tokenId: string): { clave: ClaveIniciativa; listo: boolean; usadas: string[]; ultimo: boolean } | null {
  const pr = estado.preparacion;
  if (!pr || !pr.tokens.includes(tokenId)) return null;
  return {
    clave: pr.tiradas[tokenId] ?? 'percepcion',
    listo: pr.listos.includes(tokenId),
    usadas: pr.usadas.filter((u) => u.startsWith(`${tokenId}:`)).map((u) => u.slice(tokenId.length + 1)),
    ultimo: pr.ultimos.includes(tokenId),
  };
}

// Quita efectos de un token y las condiciones que traían (si ningún otro efecto que siga las trae)
function sinEfectos(token: Token, quitar: EfectoActivo[]): Token {
  if (quitar.length === 0) return token;
  const ids = new Set(quitar.map((e) => e.id));
  const quedan = (token.efectos ?? []).filter((e) => !ids.has(e.id));
  const siguen = new Set(quedan.flatMap((e) => (e.condiciones ?? []).map((c) => c.clave)));
  const traidas = new Set(quitar.flatMap((e) => (e.condiciones ?? []).map((c) => c.clave)));
  const condiciones = (token.condiciones ?? []).filter((c) => !traidas.has(c.clave) || siguen.has(c.clave));
  return { ...token, efectos: quedan, condiciones };
}

// Pone un efecto y las condiciones que trae (sin bajar una que ya fuera mayor)
function conEfecto(token: Token, e: EfectoActivo): Token {
  let condiciones = token.condiciones ?? [];
  for (const c of e.condiciones ?? []) {
    const actual = condiciones.find((x) => x.clave === c.clave)?.valor ?? 0;
    if (c.valor > actual) condiciones = ponerCondicion(condiciones, c.clave, c.valor);
  }
  return { ...token, efectos: ponerEfecto(token.efectos ?? [], e), condiciones };
}

// En todos los tokens: lo que cuenta sus rondas en el turno que empieza baja una; lo que llega a 0 se va
function contarEfectos(tokens: Record<string, Token>, enTurno: string): Record<string, Token> {
  const salen = { ...tokens };
  for (const t of Object.values(tokens)) {
    if (!t.efectos?.length) continue;
    const { quedan, vencidos } = contarRondas(t.efectos, enTurno, t.id);
    salen[t.id] = sinEfectos({ ...t, efectos: [...quedan, ...vencidos] }, vencidos);
  }
  return salen;
}

// Lo que pasa al empezar el turno de un token: recupera su reacción y calcula sus acciones
function empezarTurno(estado: EstadoSala, combate: Combate): EstadoSala {
  const id = combate.orden[combate.turno]?.tokenId;
  if (id) estado = { ...estado, tokens: contarEfectos(estado.tokens, id) };
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
      // Lo que solo daba bono a la iniciativa (Oracular Warning, Scout's Warning) ya se usó en esta tirada
      const soloIniciativa = (e: EfectoActivo) => e.modificadores.length > 0 && e.modificadores.every((m) => m.blanco === 'iniciativa') && !e.condiciones?.length && !e.persistente;
      const tokens = Object.fromEntries(Object.entries(estado.tokens).map(([id, t]) => [id, sinEfectos(t, (t.efectos ?? []).filter(soloIniciativa))]));
      return empezarTurno({ ...estado, tokens, preparacion: null }, { ronda: 1, turno: 0, orden, acciones: 3, usadas: 0, ataques: 0, reacciones: [] });
    }
    case 'terminar-combate':
      return { ...estado, combate: null };
    case 'crear-escena': {
      const escenas = estado.escenas ?? [];
      if (escenas.length >= MAX_ESCENAS || escenas.some((e) => e.id === accion.id) || estado.escena?.id === accion.id) return estado;
      const nueva: Escena = accion.copiar
        ? {
          id: accion.id, nombre: accion.nombre, mapa: { ...estado.mapa, exploradas: '', visibles: undefined, penumbra: undefined },
          tokens: Object.values(estado.tokens).filter((t) => !t.personajeId).map((t) => ({ ...t, id: `${t.id.slice(0, 40)}-${accion.id.slice(0, 8)}` })),
        }
        : { id: accion.id, nombre: accion.nombre, mapa: mapaNuevo(), tokens: [] };
      return { ...estado, escenas: [...escenas, nueva] };
    }
    case 'cambiar-escena': {
      const destino = (estado.escenas ?? []).find((e) => e.id === accion.id);
      return destino ? cambiarEscena(estado, destino) : estado;
    }
    case 'renombrar-escena': {
      if (estado.escena?.id === accion.id || (!estado.escena && accion.id === 'inicio')) return { ...estado, escena: { id: accion.id, nombre: accion.nombre } };
      return { ...estado, escenas: (estado.escenas ?? []).map((e) => (e.id === accion.id ? { ...e, nombre: accion.nombre } : e)) };
    }
    case 'borrar-escena':
      return { ...estado, escenas: (estado.escenas ?? []).filter((e) => e.id !== accion.id) };
    case 'telon':
      return { ...estado, telon: accion.bajo };
    case 'chat':
      return { ...estado, chat: [...(estado.chat ?? []), accion.mensaje].slice(-MAX_CHAT) };
    case 'preparar-combate': {
      const tokens = [...new Set(accion.tokens)].filter((id) => estado.tokens[id]);
      if (tokens.length === 0 || estado.combate) return estado;
      return { ...estado, preparacion: { tokens, tiradas: {}, listos: [], usadas: [], ultimos: [] } };
    }
    case 'cancelar-preparacion':
      return { ...estado, preparacion: null };
    case 'elegir-iniciativa': {
      const pr = estado.preparacion;
      if (!pr?.tokens.includes(accion.tokenId)) return estado;
      return { ...estado, preparacion: { ...pr, tiradas: { ...pr.tiradas, [accion.tokenId]: accion.clave } } };
    }
    case 'marcar-listo': {
      const pr = estado.preparacion;
      if (!pr?.tokens.includes(accion.tokenId)) return estado;
      const listos = pr.listos.filter((x) => x !== accion.tokenId);
      return { ...estado, preparacion: { ...pr, listos: accion.listo ? [...listos, accion.tokenId] : listos } };
    }
    case 'usar-preparacion': {
      const pr = estado.preparacion;
      if (!pr?.tokens.includes(accion.tokenId)) return estado;
      const clave = `${accion.tokenId}:${accion.aptitudId}`;
      return {
        ...estado,
        preparacion: {
          ...pr, usadas: pr.usadas.includes(clave) ? pr.usadas : [...pr.usadas, clave],
          ultimos: accion.ultimo && !pr.ultimos.includes(accion.tokenId) ? [...pr.ultimos, accion.tokenId] : pr.ultimos,
        },
      };
    }
    case 'mover-en-orden': {
      const c = estado.combate;
      if (!c || !c.orden.some((x) => x.tokenId === accion.tokenId)) return estado;
      return { ...estado, combate: reordenar(c, moverEnOrden(c.orden, accion.tokenId, accion.posicion), estado.tokens) };
    }
    case 'dar-temporales': {
      const token = estado.tokens[accion.tokenId];
      const p = token?.personajeId ? estado.personajes[token.personajeId] : undefined;
      if (!p || accion.cantidad <= p.pgTemporales) return estado;
      return { ...estado, personajes: { ...estado.personajes, [p.id]: { ...p, pgTemporales: accion.cantidad } } };
    }
    case 'avanzar-turno': {
      const c = estado.combate;
      if (!c || c.orden.length === 0) return estado;
      // Al terminar el turno: Frightened baja 1, y lo que mantenía sin sostener esta ronda se acaba
      const actual = tokenEnTurno(estado);
      let tokens = actual
        ? { ...estado.tokens, [actual.id]: { ...actual, condiciones: alTerminarTurno(actual.condiciones ?? []) } }
        : estado.tokens;
      if (actual) {
        for (const t of Object.values(tokens)) {
          if (!t.efectos?.length) continue;
          const { vencidos } = vencerSostenidos(t.efectos, actual.id, c.ronda);
          if (vencidos.length) tokens = { ...tokens, [t.id]: sinEfectos(t, vencidos) };
        }
      }
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
    case 'poner-efecto': {
      const token = estado.tokens[accion.tokenId];
      if (!token) return estado;
      return { ...estado, tokens: { ...estado.tokens, [token.id]: conEfecto(token, accion.efecto) } };
    }
    case 'quitar-efecto': {
      const token = estado.tokens[accion.tokenId];
      const efecto = token?.efectos?.find((e) => e.id === accion.efectoId);
      if (!token || !efecto) return estado;
      return { ...estado, tokens: { ...estado.tokens, [token.id]: sinEfectos(token, [efecto]) } };
    }
    case 'danar': {
      const token = estado.tokens[accion.tokenId];
      if (!token || accion.cantidad <= 0) return estado;
      const p = token.personajeId ? estado.personajes[token.personajeId] : undefined;
      if (p) {
        const deTemporales = Math.min(p.pgTemporales, accion.cantidad);
        const pgActual = Math.max(0, p.pgActual - (accion.cantidad - deTemporales));
        const personajes = { ...estado.personajes, [p.id]: { ...p, pgTemporales: p.pgTemporales - deTemporales, pgActual } };
        if (pgActual > 0) return { ...estado, personajes };
        // A 0 PG: Dying 1 más lo que tenga de Wounded (2 con un crítico); si ya estaba Dying, sube
        const condiciones = token.condiciones ?? [];
        const dying = condiciones.find((c) => c.clave === 'dying')?.valor ?? 0;
        const wounded = condiciones.find((c) => c.clave === 'wounded')?.valor ?? 0;
        const golpe = accion.critico ? 2 : 1;
        const nuevo = Math.min(4, dying ? dying + golpe : golpe + wounded);
        const puestas = ponerCondicion(ponerCondicion(condiciones, 'dying', nuevo), 'unconscious', 1);
        return { ...estado, personajes, tokens: { ...estado.tokens, [token.id]: { ...token, condiciones: puestas } } };
      }
      if (!token.pg) return estado;
      const actual = Math.max(0, token.pg.actual - accion.cantidad);
      return { ...estado, tokens: { ...estado.tokens, [token.id]: { ...token, pg: { ...token.pg, actual } } } };
    }
    case 'curar': {
      const token = estado.tokens[accion.tokenId];
      if (!token || accion.cantidad <= 0) return estado;
      const p = token.personajeId ? estado.personajes[token.personajeId] : undefined;
      if (p) {
        const max = calcular(p).pgMax.total;
        const personajes = { ...estado.personajes, [p.id]: { ...p, pgActual: Math.min(max, p.pgActual + accion.cantidad) } };
        // Quien se cura deja de morir y despierta, pero queda más herido (Wounded +1)
        const condiciones = token.condiciones ?? [];
        const dying = condiciones.some((c) => c.clave === 'dying');
        if (!dying) return { ...estado, personajes };
        const wounded = condiciones.find((c) => c.clave === 'wounded')?.valor ?? 0;
        const puestas = ponerCondicion(ponerCondicion(ponerCondicion(condiciones, 'dying', 0), 'unconscious', 0), 'wounded', wounded + 1);
        return { ...estado, personajes, tokens: { ...estado.tokens, [token.id]: { ...token, condiciones: puestas } } };
      }
      if (!token.pg) return estado;
      return { ...estado, tokens: { ...estado.tokens, [token.id]: { ...token, pg: { ...token.pg, actual: Math.min(token.pg.max, token.pg.actual + accion.cantidad) } } } };
    }
    case 'sostener': {
      const ronda = estado.combate?.ronda;
      if (ronda === undefined) return estado;
      const tokens = Object.fromEntries(Object.entries(estado.tokens).map(([id, t]) =>
        [id, t.efectos?.length ? { ...t, efectos: sostener(t.efectos, accion.tokenId, ronda) } : t]));
      return { ...estado, tokens };
    }
    case 'mostrar-area':
      return estado;
    case 'alternar-puerta': {
      const muros = estado.mapa.muros ?? [];
      if (!muros.some((m) => m.id === accion.id && m.tipo === 'puerta')) return estado;
      return { ...estado, mapa: { ...estado.mapa, muros: muros.map((m) => (m.id === accion.id ? { ...m, abierta: accion.abierta } : m)) } };
    }
    case 'explorar':
      return { ...estado, mapa: { ...estado.mapa, exploradas: accion.mascara } };
    case 'llevar-luz': {
      const token = estado.tokens[accion.tokenId];
      if (!token) return estado;
      const { luz: _luz, ...sinLuz } = token;
      return { ...estado, tokens: { ...estado.tokens, [token.id]: accion.luz ? { ...token, luz: accion.luz } : sinLuz } };
    }
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
    // Un jugador puede quitarse un efecto de encima (terminar un Shield, apagar lo que ya no aplica)
    case 'quitar-efecto':
      return esMio(accion.tokenId);
    // En la preparación, cada jugador elige con qué tira y avisa que está listo
    case 'elegir-iniciativa':
    case 'marcar-listo':
    case 'llevar-luz':
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
  const base = (t.personajeId ? estado.personajes[t.personajeId]?.velocidad : t.criatura?.velocidad) ?? 25;
  return velocidadConEfectos(base, t.efectos ?? []);
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
  const muros = estado.mapa.muros ?? [];
  return {
    lado: ladoDe(t), bloqueadas, ocupadas,
    columnas: conLimites ? estado.mapa.columnas : Infinity,
    filas: conLimites ? estado.mapa.filas : Infinity,
    ...(muros.length ? { cruzaMuro: (de: Casilla, a: Casilla) => cruzaMuro(muros, de, a) } : {}),
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
  return motivoParaActuarToken(estado, tokenDePersonaje(estado, personajeId), costo);
}

// Lo mismo para cualquier token (las criaturas del GM siguen las mismas reglas que los personajes)
export function motivoParaActuarToken(estado: EstadoSala, token: Token | undefined, costo: number | 'reaccion' | 'libre' | 'larga'): string | null {
  const c = estado.combate;
  if (costo === 'larga') return c ? 'Es una actividad de minutos: no se puede en combate.' : null;
  if (!c || !token || !c.orden.some((x) => x.tokenId === token.id)) return null;
  // A un jugador se le habla de tú; al GM, de su criatura
  const propio = !!token.personajeId;
  if (costo === 'reaccion') return c.reacciones.includes(token.id) ? (propio ? 'Ya usaste tu reacción esta ronda.' : `${token.nombre} ya usó su reacción esta ronda.`) : null;
  const enTurno = tokenEnTurno(estado);
  if (enTurno?.id !== token.id) return `${propio ? 'No es tu turno' : `No es el turno de ${token.nombre}`}: ahora juega ${enTurno?.nombre ?? 'otro'}.`;
  if (costo === 'libre') return null;
  const libres = c.acciones - c.usadas;
  if (costo > libres) {
    if (libres === 0) return propio ? 'No te quedan acciones este turno.' : `A ${token.nombre} no le quedan acciones.`;
    const falta = costo - libres === 1 ? 'falta 1 acción' : `faltan ${costo - libres} acciones`;
    return propio ? `Te ${falta}.` : `A ${token.nombre} le ${falta}.`;
  }
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
    case 'cancelar-preparacion':
      return true;
    case 'crear-escena':
      return esTexto(a.id, 60) && esNombre(a.nombre) && (a.copiar === undefined || typeof a.copiar === 'boolean');
    case 'cambiar-escena':
    case 'borrar-escena':
      return esTexto(a.id, 60);
    case 'renombrar-escena':
      return esTexto(a.id, 60) && esNombre(a.nombre);
    case 'telon':
      return typeof a.bajo === 'boolean';
    case 'preparar-combate':
      return Array.isArray(a.tokens) && a.tokens.length >= 1 && a.tokens.length <= 60 && a.tokens.every((t) => esTexto(t));
    case 'elegir-iniciativa':
      return esTexto(a.tokenId) && esClaveIniciativa(a.clave);
    case 'marcar-listo':
      return esTexto(a.tokenId) && typeof a.listo === 'boolean';
    case 'llevar-luz':
      return esTexto(a.tokenId) && (a.luz === undefined || esBrillo(a.luz));
    case 'mover-en-orden':
      return esTexto(a.tokenId) && esEntero(a.posicion, 0, 200);
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
    case 'poner-efecto':
      return esTexto(a.tokenId) && esEfectoValido(a.efecto, esExpresion)
        && (estado.tokens[a.tokenId as string]?.efectos?.length ?? 0) < 20;
    case 'quitar-efecto':
      return esTexto(a.tokenId) && esTexto(a.efectoId);
    case 'danar':
    case 'curar':
      return esTexto(a.tokenId) && esEntero(a.cantidad, 0, 9999) && (a.critico === undefined || typeof a.critico === 'boolean');
    default:
      return false;
  }
}

const esExpresion = (t: string) => leerExpresion(t) !== null;

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

const esNombre = (t: unknown) => esTexto(t, 60) && (t as string).trim().length > 0;

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
    && (k.efectos === undefined || esEfectosValidos(k.efectos, esExpresion))
    && (k.ca === undefined || esEntero(k.ca, 0, 80))
    && (k.percepcion === undefined || esEntero(k.percepcion, -10, 60))
    && (k.luz === undefined || esBrillo(k.luz))
    && (k.criatura === undefined || esCriaturaValida(k.criatura))
    && (pg === undefined || (esObjeto(pg) && esEntero(pg.actual, 0, 9999) && esEntero(pg.max, 1, 9999)));
}

function esMapaValido(m: Record<string, unknown>): boolean {
  const entre = (n: unknown, min: number, max: number) => esNumero(n) && (n as number) >= min && (n as number) <= max;
  return (m.imagen === undefined || esTexto(m.imagen, 500))
    && entre(m.tamanoCelda, 10, 500)
    && esNumero(m.desplazamientoX) && esNumero(m.desplazamientoY)
    && entre(m.columnas, 1, 200) && entre(m.filas, 1, 200)
    && typeof m.mostrarCuadricula === 'boolean'
    && (m.terreno === undefined || TERRENOS_VALIDOS.includes(m.terreno as Terreno))
    && (m.muros === undefined || esMurosValido(m.muros))
    && (m.niebla === undefined || typeof m.niebla === 'boolean')
    && (m.exploradas === undefined || (typeof m.exploradas === 'string' && m.exploradas.length <= 20_000 && /^[0-9a-f]*$/.test(m.exploradas)))
    && (m.luz === undefined || m.luz === 'brillante' || m.luz === 'tenue' || m.luz === 'oscuridad')
    && (m.luces === undefined || esLucesValido(m.luces))
    // Lo visible lo calcula la sala para cada jugador: nadie lo manda
    && m.visibles === undefined && m.penumbra === undefined;
}

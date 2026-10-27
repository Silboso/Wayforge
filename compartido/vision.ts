// Visión y niebla de guerra. El GM dibuja muros, puertas y ventanas sobre las líneas de la cuadrícula (o arma una
// habitación de un tirón). Los muros frenan el paso y la vista; las puertas cerradas también, abiertas no; las
// ventanas frenan el paso pero dejan ver. Los jugadores ven lo que ve cualquiera del grupo (visión compartida):
// lo que está en línea de vista se ve claro, lo explorado antes queda en penumbra (sin las criaturas) y lo que
// nadie vio todavía queda bajo la niebla. La sala filtra lo que manda a cada jugador: lo oculto no viaja.

import type { Casilla } from '../reglas/movimiento';
import { puedeVerHandout, puedeVerMensaje, puedeVerTirada, type EstadoSala, type Mapa, type Token } from './sala';

export type TipoMuro = 'muro' | 'puerta' | 'ventana';

export interface Muro {
  id: string;
  // Extremos en esquinas de la cuadrícula (la esquina de arriba a la izquierda de la casilla 0,0 es 0,0)
  a: Casilla;
  b: Casilla;
  tipo: TipoMuro;
  // Solo las puertas: si está abierta, y si está cerrada con llave (solo el GM la abre)
  abierta?: boolean;
  conLlave?: boolean;
}

export const NOMBRE_MURO: Record<TipoMuro, string> = { muro: 'Muro', puerta: 'Puerta', ventana: 'Ventana' };

export const frenaPaso = (m: Muro) => !(m.tipo === 'puerta' && m.abierta);
export const frenaVista = (m: Muro) => m.tipo === 'muro' || (m.tipo === 'puerta' && !m.abierta);

// La niebla está prendida salvo que el GM la apague; sin muros no tapa nada (todo queda en línea de vista)
export const visionActiva = (mapa: Mapa) => mapa.niebla !== false;

type Punto = { x: number; y: number };

// ¿Se tocan los segmentos p1-p2 y p3-p4? Cuenta también si apenas se rozan (un extremo sobre el otro)
function cortan(p1: Punto, p2: Punto, p3: Punto, p4: Punto): boolean {
  const lado = (a: Punto, b: Punto, c: Punto) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const E = 1e-9;
  const d1 = lado(p3, p4, p1);
  const d2 = lado(p3, p4, p2);
  const d3 = lado(p1, p2, p3);
  const d4 = lado(p1, p2, p4);
  if (((d1 > E && d2 < -E) || (d1 < -E && d2 > E)) && ((d3 > E && d4 < -E) || (d3 < -E && d4 > E))) return true;
  const sobre = (a: Punto, b: Punto, c: Punto) => Math.min(a.x, b.x) - E <= c.x && c.x <= Math.max(a.x, b.x) + E
    && Math.min(a.y, b.y) - E <= c.y && c.y <= Math.max(a.y, b.y) + E;
  return (Math.abs(d1) <= E && sobre(p3, p4, p1)) || (Math.abs(d2) <= E && sobre(p3, p4, p2))
    || (Math.abs(d3) <= E && sobre(p1, p2, p3)) || (Math.abs(d4) <= E && sobre(p1, p2, p4));
}

// ¿Un paso de una casilla a la vecina atraviesa un muro? (de centro a centro: así no se cuela por una esquina)
export function cruzaMuro(muros: Muro[], de: Casilla, a: Casilla): boolean {
  const p = { x: de.x + 0.5, y: de.y + 0.5 };
  const q = { x: a.x + 0.5, y: a.y + 0.5 };
  return muros.some((m) => frenaPaso(m) && cortan(p, q, m.a, m.b));
}

// ¿Se ve de un punto a otro?
export function hayLineaDeVista(muros: Muro[], p: Punto, q: Punto): boolean {
  return !muros.some((m) => frenaVista(m) && cortan(p, q, m.a, m.b));
}

const casillasDe = (t: Token, lado: number) => {
  const lista: Casilla[] = [];
  for (let dx = 0; dx < lado; dx++) for (let dy = 0; dy < lado; dy++) lista.push({ x: t.x + dx, y: t.y + dy });
  return lista;
};
const ladoDe = (t: Token) => Math.max(1, Math.ceil({ Tiny: 0.5, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4 }[t.tamano]));

// Cinco puntos de una casilla: el centro y sus esquinas un poco hacia adentro (así una pared no corta feo)
const D = 0.32;
const puntosDe = (x: number, y: number): Punto[] => [
  { x: x + 0.5, y: y + 0.5 }, { x: x + 0.5 - D, y: y + 0.5 - D }, { x: x + 0.5 + D, y: y + 0.5 - D }, { x: x + 0.5 - D, y: y + 0.5 + D }, { x: x + 0.5 + D, y: y + 0.5 + D },
];
const centroDe = (t: Token): Punto => { const l = ladoDe(t); return { x: t.x + l / 2, y: t.y + l / 2 }; };

// ---------- Luz ----------
// La luz del lugar (día, penumbra, oscuridad) y las fuentes: lo que llevan los tokens (una antorcha) y las que
// pone el GM (un brasero). Cada fuente da luz brillante hasta un radio y tenue otro tanto más allá; los muros
// y las puertas cerradas la cortan, las ventanas no.
export type LuzAmbiente = 'brillante' | 'tenue' | 'oscuridad';
export type NivelLuz = 0 | 1 | 2;
export interface Brillo { brillante: number; tenue: number }
export interface Luz extends Brillo { id: string; x: number; y: number }

export const FUENTES: Record<'antorcha' | 'linterna' | 'vela', Brillo & { nombre: string }> = {
  antorcha: { nombre: 'Antorcha', brillante: 20, tenue: 20 },
  linterna: { nombre: 'Linterna', brillante: 30, tenue: 30 },
  vela: { nombre: 'Vela', brillante: 0, tenue: 10 },
};
export const AMBIENTES: Record<LuzAmbiente, { nombre: string; ayuda: string }> = {
  brillante: { nombre: 'Día', ayuda: 'Todo iluminado.' },
  tenue: { nombre: 'Penumbra', ayuda: 'Atardecer, una cueva con grietas: sin low-light vision, lo de lejos queda oculto (CD 5).' },
  oscuridad: { nombre: 'Oscuridad', ayuda: 'Sin luz no se ve nada, salvo con darkvision. Las antorchas importan.' },
};

const NIVEL: Record<LuzAmbiente, NivelLuz> = { brillante: 2, tenue: 1, oscuridad: 0 };

// Distancia en pies de un token (o una casilla) a una casilla, con la regla de diagonales de PF2e
function pies(desde: { x: number; y: number }, lado: number, c: Casilla): number {
  const hueco = (a0: number, na: number, b0: number) => Math.max(0, b0 - (a0 + na - 1), a0 - b0);
  const dx = hueco(desde.x, lado, c.x);
  const dy = hueco(desde.y, lado, c.y);
  const diag = Math.min(dx, dy);
  return (Math.max(dx, dy) + Math.floor(diag / 2)) * 5;
}

// El nivel de luz de cada casilla del tablero
export function iluminacion(estado: EstadoSala): (k: string) => NivelLuz {
  const base = NIVEL[estado.mapa.luz ?? 'brillante'];
  if (base === 2) return () => 2;
  const muros = (estado.mapa.muros ?? []).filter(frenaVista);
  const fuentes = [
    ...(estado.mapa.luces ?? []).map((l) => ({ ...l, lado: 1, centro: { x: l.x + 0.5, y: l.y + 0.5 } })),
    ...Object.values(estado.tokens).filter((t) => t.luz && (t.luz.brillante + t.luz.tenue) > 0)
      .map((t) => ({ x: t.x, y: t.y, brillante: t.luz!.brillante, tenue: t.luz!.tenue, lado: ladoDe(t), centro: centroDe(t) })),
  ];
  const niveles = new Map<string, NivelLuz>();
  const { columnas, filas } = estado.mapa;
  for (const f of fuentes) {
    const r = Math.ceil((f.brillante + f.tenue) / 5) + f.lado;
    for (let y = Math.max(0, f.y - r); y < Math.min(filas, f.y + r + 1); y++) {
      for (let x = Math.max(0, f.x - r); x < Math.min(columnas, f.x + r + 1); x++) {
        const d = pies(f, f.lado, { x, y });
        if (d > f.brillante + f.tenue) continue;
        const nivel: NivelLuz = d <= f.brillante ? 2 : 1;
        const k = `${x},${y}`;
        if ((niveles.get(k) ?? 0) >= nivel) continue;
        if (puntosDe(x, y).some((p) => hayLineaDeVista(muros, f.centro, p))) niveles.set(k, nivel);
      }
    }
  }
  return (k) => Math.max(base, niveles.get(k) ?? 0) as NivelLuz;
}

// ---------- Sentidos ----------
export type Sentido = 'normal' | 'low-light' | 'darkvision';

// De la ficha ("Darkvision", "Low-light vision") o, en una criatura, de sus notas y rasgos
export function sentidoDe(estado: EstadoSala, t: Token): Sentido {
  const texto = t.personajeId ? estado.personajes[t.personajeId]?.sentidos ?? '' : `${t.criatura?.notas ?? ''} ${(t.criatura?.rasgos ?? []).join(' ')}`;
  return /darkvision/i.test(texto) ? 'darkvision' : /low-light/i.test(texto) ? 'low-light' : 'normal';
}

// Lo que ve el grupo junto. `penumbra`: lo que se ve pero nadie ve con claridad (luz tenue sin low-light, o
// oscuridad vista con darkvision): para dibujarlo más apagado
export function percepcionGrupo(estado: EstadoSala): { visibles: Set<string>; penumbra: Set<string> } {
  const { columnas, filas } = estado.mapa;
  const muros = (estado.mapa.muros ?? []).filter(frenaVista);
  const luz = iluminacion(estado);
  const ojos = Object.values(estado.tokens).filter((t) => t.personajeId).map((t) => ({ ...centroDe(t), propias: casillasDe(t, ladoDe(t)), sentido: sentidoDe(estado, t) }));
  const visibles = new Set<string>();
  const penumbra = new Set<string>();
  for (let y = 0; y < filas; y++) {
    for (let x = 0; x < columnas; x++) {
      const k = `${x},${y}`;
      const nivel = luz(k);
      let ve = false;
      let claro = false;
      for (const o of ojos) {
        const propia = o.propias.some((c) => c.x === x && c.y === y);
        if (!propia && !puntosDe(x, y).some((p) => hayLineaDeVista(muros, o, p))) continue;
        // A oscuras sin darkvision no se ve (salvo la casilla propia, que se conoce)
        if (nivel === 0 && o.sentido !== 'darkvision' && !propia) continue;
        ve = true;
        if (nivel === 2 || (nivel === 1 && o.sentido !== 'normal')) { claro = true; break; }
      }
      if (ve) { visibles.add(k); if (!claro) penumbra.add(k); }
    }
  }
  return { visibles, penumbra };
}

export function casillasVisibles(estado: EstadoSala): Set<string> {
  return percepcionGrupo(estado).visibles;
}

// ---------- Una criatura mirando a otra ----------
// `ve`: si la tiene a la vista; `efecto`: si nada sólido se interpone (las ventanas dejan ver pero no pasar);
// `plano`: el chequeo plano para alcanzarla (5 si está oculta en penumbra, 11 si está escondida o invisible)
export interface Visibilidad { ve: boolean; efecto: boolean; plano: 0 | 5 | 11; razon: string }

export function visibilidad(estado: EstadoSala, obs: Token, obj: Token): Visibilidad {
  if (obs.id === obj.id) return { ve: true, efecto: true, plano: 0, razon: '' };
  const muros = estado.mapa.muros ?? [];
  const ojo = centroDe(obs);
  const puntos = casillasDe(obj, ladoDe(obj)).flatMap((c) => puntosDe(c.x, c.y));
  const vista = muros.filter(frenaVista);
  const solidos = muros.filter(frenaPaso);
  const efecto = puntos.some((p) => !solidos.some((m) => cortan(ojo, p, m.a, m.b)));
  if (!puntos.some((p) => !vista.some((m) => cortan(ojo, p, m.a, m.b)))) return { ve: false, efecto, plano: 0, razon: 'no lo ves desde aquí' };
  const luz = iluminacion(estado);
  const nivel = Math.max(...casillasDe(obj, ladoDe(obj)).map((c) => luz(`${c.x},${c.y}`))) as NivelLuz;
  const sentido = sentidoDe(estado, obs);
  if (nivel === 0 && sentido !== 'darkvision') return { ve: false, efecto, plano: 0, razon: 'está a oscuras' };
  const condiciones = new Set((obj.condiciones ?? []).map((c) => c.clave));
  if (condiciones.has('invisible')) return { ve: true, efecto, plano: 11, razon: 'invisible' };
  if (condiciones.has('hidden')) return { ve: true, efecto, plano: 11, razon: 'escondido' };
  if (nivel === 1 && sentido === 'normal') return { ve: true, efecto, plano: 5, razon: 'en penumbra' };
  return { ve: true, efecto, plano: 0, razon: '' };
}

// La distancia (en casillas) de un punto a un muro
export function distanciaAMuro(p: Punto, m: Muro): number {
  const dx = m.b.x - m.a.x;
  const dy = m.b.y - m.a.y;
  const t = Math.max(0, Math.min(1, ((p.x - m.a.x) * dx + (p.y - m.a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (m.a.x + dx * t), p.y - (m.a.y + dy * t));
}

// ¿Tiene algo detrás de qué cubrirse? (un muro pegado a su casilla): sirve para esconderse a plena luz
export function conCobertura(estado: EstadoSala, t: Token): boolean {
  const c = centroDe(t);
  const l = ladoDe(t);
  return (estado.mapa.muros ?? []).some((m) => frenaPaso(m) && distanciaAMuro(c, m) <= l / 2 + 0.05);
}

// Las casillas de un área que alcanza desde su origen (una explosión no atraviesa paredes)
export function conLineaDeEfecto(muros: Muro[], origen: Punto, casillas: Casilla[]): Casilla[] {
  const solidos = muros.filter(frenaPaso);
  if (solidos.length === 0) return casillas;
  return casillas.filter((c) => puntosDe(c.x, c.y).some((p) => !solidos.some((m) => cortan(origen, p, m.a, m.b))));
}

// Un conjunto de casillas como máscara de bits en hexadecimal (fila por fila): corto para guardar y mandar
export function aMascara(casillas: Set<string>, columnas: number, filas: number): string {
  const bits = new Uint8Array(Math.ceil((columnas * filas) / 4));
  for (const k of casillas) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    if (x < 0 || y < 0 || x >= columnas || y >= filas) continue;
    const i = y * columnas + x;
    bits[i >> 2]! |= 1 << (i & 3);
  }
  return Array.from(bits, (b) => b.toString(16)).join('');
}

export function deMascara(hex: string | undefined, columnas: number, filas: number): Set<string> {
  const salen = new Set<string>();
  if (!hex || hex.length !== Math.ceil((columnas * filas) / 4)) return salen;
  for (let i = 0; i < columnas * filas; i++) {
    if (parseInt(hex[i >> 2]!, 16) & (1 << (i & 3))) salen.add(`${i % columnas},${Math.floor(i / columnas)}`);
  }
  return salen;
}

// Lo explorado más lo que se ve ahora; null si no cambió nada
export function explorar(estado: EstadoSala): string | null {
  const { columnas, filas, exploradas } = estado.mapa;
  const antes = deMascara(exploradas, columnas, filas);
  let nuevas = false;
  for (const k of casillasVisibles(estado)) if (!antes.has(k)) { antes.add(k); nuevas = true; }
  return nuevas ? aMascara(antes, columnas, filas) : null;
}

// Un muro se conoce si toca alguna casilla explorada (así el plano se descubre a medida que se recorre)
export function murosConocidos(muros: Muro[], exploradas: Set<string>): Muro[] {
  return muros.filter((m) => {
    for (const t of [0.1, 0.5, 0.9]) {
      const px = m.a.x + (m.b.x - m.a.x) * t;
      const py = m.a.y + (m.b.y - m.a.y) * t;
      for (const [dx, dy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]] as const) {
        if (exploradas.has(`${Math.floor(px + dx)},${Math.floor(py + dy)}`)) return true;
      }
    }
    return false;
  });
}

// Lo que ve un jugador: los personajes siempre; las demás criaturas solo si el grupo las ve ahora; los muros que
// ya conoce; y las máscaras de lo explorado y lo visible para dibujar la niebla. `firma` cambia cuando cambia algo
// de eso, así la sala sabe cuándo hace falta mandarle la vista de nuevo.
export function vistaJugadores(estado: EstadoSala): { estado: EstadoSala; firma: string } {
  const { columnas, filas } = estado.mapa;
  const { visibles, penumbra } = percepcionGrupo(estado);
  const exploradas = deMascara(estado.mapa.exploradas, columnas, filas);
  for (const k of visibles) exploradas.add(k);
  const dentro = (k: string) => {
    const [x, y] = k.split(',').map(Number) as [number, number];
    return x >= 0 && y >= 0 && x < columnas && y < filas;
  };
  const tokens: Record<string, Token> = {};
  for (const t of Object.values(estado.tokens)) {
    // Fuera de la cuadrícula de la niebla (un mapa más grande que el tablero) no hay niebla
    const casillas = casillasDe(t, ladoDe(t)).map((c) => `${c.x},${c.y}`);
    const invisible = (t.condiciones ?? []).some((c) => c.clave === 'invisible');
    if (t.personajeId || (!invisible && casillas.some((k) => visibles.has(k) || !dentro(k)))) tokens[t.id] = t;
  }
  const muros = murosConocidos(estado.mapa.muros ?? [], exploradas);
  // Las luces que pone el GM se ven donde ya se exploró
  const luces = (estado.mapa.luces ?? []).filter((l) => exploradas.has(`${l.x},${l.y}`));
  const mapa: Mapa = {
    ...estado.mapa, muros, luces,
    exploradas: aMascara(exploradas, columnas, filas), visibles: aMascara(visibles, columnas, filas), penumbra: aMascara(penumbra, columnas, filas),
  };
  const ajenos = Object.values(tokens).filter((t) => !t.personajeId);
  return {
    estado: { ...estado, tokens, mapa },
    firma: JSON.stringify([ajenos, muros, luces, mapa.exploradas, mapa.visibles, mapa.penumbra]),
  };
}

// Todo lo que le llega a un jugador: sin las escenas que el GM tiene guardadas; con el telón bajo, el tablero
// vacío (solo los personajes); si no, lo que ve el grupo (con niebla) o todo (sin niebla)
export function vistaDeJugador(estado: EstadoSala, personajeId?: string): { estado: EstadoSala; firma: string } {
  const quien = personajeId ? { rol: 'jugador' as const, personajeId } : { rol: 'visitante' as const };
  const sinEscenas: EstadoSala = {
    ...estado, escenas: [],
    tiradas: estado.tiradas.filter((t) => puedeVerTirada(t, quien)),
    chat: (estado.chat ?? []).filter((m) => puedeVerMensaje(m, quien)),
    handouts: (estado.handouts ?? []).filter((h) => puedeVerHandout(h, quien)),
  };
  const escena = estado.escena?.id ?? '';
  if (estado.telon) {
    const tokens = Object.fromEntries(Object.entries(estado.tokens).filter(([, t]) => t.personajeId));
    const { columnas, filas, tamanoCelda, desplazamientoX, desplazamientoY, mostrarCuadricula } = estado.mapa;
    const mapa: Mapa = { columnas, filas, tamanoCelda, desplazamientoX, desplazamientoY, mostrarCuadricula, terreno: 'ninguno', niebla: false };
    return { estado: { ...sinEscenas, tokens, mapa }, firma: JSON.stringify(['telon', escena]) };
  }
  if (!visionActiva(estado.mapa)) {
    return { estado: sinEscenas, firma: JSON.stringify([escena, Object.values(estado.tokens).filter((t) => !t.personajeId), estado.mapa]) };
  }
  const v = vistaJugadores(sinEscenas);
  return { estado: v.estado, firma: JSON.stringify([escena, v.firma]) };
}

// Una habitación de un tirón: el rectángulo entre dos esquinas, con una puerta en el medio del lado de abajo
export function habitacion(a: Casilla, b: Casilla, id: () => string): Muro[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  if (x1 - x0 < 1 || y1 - y0 < 1) return [];
  const muro = (p: Casilla, q: Casilla, tipo: TipoMuro = 'muro'): Muro => ({ id: id(), a: p, b: q, tipo, ...(tipo === 'puerta' ? { abierta: false } : {}) });
  const salen = [muro({ x: x0, y: y0 }, { x: x1, y: y0 }), muro({ x: x0, y: y0 }, { x: x0, y: y1 }), muro({ x: x1, y: y0 }, { x: x1, y: y1 })];
  if (x1 - x0 >= 3) {
    const p = Math.floor((x0 + x1) / 2);
    salen.push(muro({ x: x0, y: y1 }, { x: p, y: y1 }), muro({ x: p, y: y1 }, { x: p + 1, y: y1 }, 'puerta'), muro({ x: p + 1, y: y1 }, { x: x1, y: y1 }));
  } else {
    salen.push(muro({ x: x0, y: y1 }, { x: x1, y: y1 }));
  }
  return salen;
}

// ¿Está un token al lado de una puerta (para abrirla con Interact)?
export function alLadoDe(t: Token, m: Muro): boolean {
  const l = ladoDe(t);
  const medio = { x: (m.a.x + m.b.x) / 2, y: (m.a.y + m.b.y) / 2 };
  const cx = t.x + l / 2;
  const cy = t.y + l / 2;
  return Math.abs(medio.x - cx) <= l / 2 + 1 && Math.abs(medio.y - cy) <= l / 2 + 1;
}

const entero = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const esPunto = (p: unknown) => typeof p === 'object' && p !== null && entero((p as Punto).x, 0, 500) && entero((p as Punto).y, 0, 500);

export function esLucesValido(v: unknown): boolean {
  return Array.isArray(v) && v.length <= 100 && v.every((l) => typeof l === 'object' && l !== null && typeof (l as Luz).id === 'string' && (l as Luz).id.length <= 60
    && entero((l as Luz).x, 0, 500) && entero((l as Luz).y, 0, 500) && esBrillo(l));
}

export const esBrillo = (b: unknown) => typeof b === 'object' && b !== null && entero((b as Brillo).brillante, 0, 120) && entero((b as Brillo).tenue, 0, 120);

export function esMurosValido(v: unknown): boolean {
  return Array.isArray(v) && v.length <= 600 && v.every((m) => {
    if (typeof m !== 'object' || m === null) return false;
    const x = m as Record<string, unknown>;
    return typeof x.id === 'string' && x.id.length <= 60 && esPunto(x.a) && esPunto(x.b)
      && (x.tipo === 'muro' || x.tipo === 'puerta' || x.tipo === 'ventana')
      && (x.abierta === undefined || typeof x.abierta === 'boolean') && (x.conLlave === undefined || typeof x.conLlave === 'boolean')
      && !((x.a as Punto).x === (x.b as Punto).x && (x.a as Punto).y === (x.b as Punto).y);
  });
}

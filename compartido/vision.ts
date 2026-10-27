// Visión y niebla de guerra. El GM dibuja muros, puertas y ventanas sobre las líneas de la cuadrícula (o arma una
// habitación de un tirón). Los muros frenan el paso y la vista; las puertas cerradas también, abiertas no; las
// ventanas frenan el paso pero dejan ver. Los jugadores ven lo que ve cualquiera del grupo (visión compartida):
// lo que está en línea de vista se ve claro, lo explorado antes queda en penumbra (sin las criaturas) y lo que
// nadie vio todavía queda bajo la niebla. La sala filtra lo que manda a cada jugador: lo oculto no viaja.

import type { Casilla } from '../reglas/movimiento';
import type { EstadoSala, Mapa, Token } from './sala';

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

// Las casillas que ve el grupo: cada personaje mira desde el centro de su token. Una casilla se ve si llega una
// línea a su centro o a alguna de sus cuatro esquinas (un poco hacia adentro), para que las paredes no corten feo.
export function casillasVisibles(estado: EstadoSala): Set<string> {
  const { columnas, filas } = estado.mapa;
  const muros = (estado.mapa.muros ?? []).filter(frenaVista);
  const ojos = Object.values(estado.tokens).filter((t) => t.personajeId).map((t) => {
    const l = ladoDe(t);
    return { x: t.x + l / 2, y: t.y + l / 2, propias: casillasDe(t, l) };
  });
  const salen = new Set<string>();
  if (ojos.length === 0) return salen;
  const D = 0.32;
  for (let y = 0; y < filas; y++) {
    for (let x = 0; x < columnas; x++) {
      const puntos = [{ x: x + 0.5, y: y + 0.5 }, { x: x + 0.5 - D, y: y + 0.5 - D }, { x: x + 0.5 + D, y: y + 0.5 - D }, { x: x + 0.5 - D, y: y + 0.5 + D }, { x: x + 0.5 + D, y: y + 0.5 + D }];
      const ve = ojos.some((o) => o.propias.some((c) => c.x === x && c.y === y) || puntos.some((p) => hayLineaDeVista(muros, o, p)));
      if (ve) salen.add(`${x},${y}`);
    }
  }
  return salen;
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
  const visibles = casillasVisibles(estado);
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
    if (t.personajeId || casillas.some((k) => visibles.has(k) || !dentro(k))) tokens[t.id] = t;
  }
  const muros = murosConocidos(estado.mapa.muros ?? [], exploradas);
  const mapa: Mapa = { ...estado.mapa, muros, exploradas: aMascara(exploradas, columnas, filas), visibles: aMascara(visibles, columnas, filas) };
  const ajenos = Object.values(tokens).filter((t) => !t.personajeId);
  return {
    estado: { ...estado, tokens, mapa },
    firma: JSON.stringify([ajenos, muros, mapa.exploradas, mapa.visibles]),
  };
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

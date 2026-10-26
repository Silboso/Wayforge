// Eventos: lo que acaba de pasar en la mesa, sacado de comparar el estado antes y después de una acción.
// De aquí salen los avisos ("te atacaron", "se movió a tu lado") y las animaciones del tablero.

import { TAMANOS, tokenEnTurno, type Accion, type EstadoSala, type Tirada, type Token } from './sala';

export type Evento =
  | { tipo: 'tirada'; tirada: Tirada }
  | { tipo: 'movimiento'; tokenId: string; desde: { x: number; y: number }; hasta: { x: number; y: number }; camino?: { x: number; y: number }[] }
  | { tipo: 'turno'; tokenId: string; ronda: number };

export function eventosDe(anterior: EstadoSala, accion: Accion, posterior: EstadoSala): Evento[] {
  switch (accion.tipo) {
    case 'registrar-tirada':
      return [{ tipo: 'tirada', tirada: accion.tirada }];
    case 'mover-token': {
      const antes = anterior.tokens[accion.id];
      if (!antes || (antes.x === accion.x && antes.y === accion.y)) return [];
      return [{ tipo: 'movimiento', tokenId: accion.id, desde: { x: antes.x, y: antes.y }, hasta: { x: accion.x, y: accion.y } }];
    }
    case 'mover-turno': {
      const antes = anterior.tokens[accion.id];
      const fin = accion.camino.at(-1);
      if (!antes || !fin) return [];
      return [{ tipo: 'movimiento', tokenId: accion.id, desde: { x: antes.x, y: antes.y }, hasta: fin, camino: accion.camino }];
    }
    case 'iniciar-combate':
    case 'avanzar-turno': {
      const t = tokenEnTurno(posterior);
      return t && posterior.combate ? [{ tipo: 'turno', tokenId: t.id, ronda: posterior.combate.ronda }] : [];
    }
    default:
      return [];
  }
}

// ¿Está `otro` al alcance cuerpo a cuerpo de `token`? Casillas que se tocan (incluida la diagonal) = 5 ft.
// `posicion` permite preguntar por una posición anterior de `otro` (antes de moverse).
export function aAlcance(token: Token, otro: Token, posicion: { x: number; y: number } = otro, casillas = 1): boolean {
  const lado = (t: Token) => Math.max(1, TAMANOS[t.tamano]);
  const hueco = (a0: number, la: number, b0: number, lb: number) => Math.max(0, b0 - (a0 + la), a0 - (b0 + lb));
  const dx = hueco(token.x, lado(token), posicion.x, lado(otro));
  const dy = hueco(token.y, lado(token), posicion.y, lado(otro));
  return Math.max(dx, dy) < casillas;
}

// Eventos: lo que acaba de pasar en la mesa, sacado de comparar el estado antes y después de una acción.
// De aquí salen los avisos ("te atacaron", "se movió a tu lado") y las animaciones del tablero.

import type { Aspecto } from '../reglas/efectos';
import { TAMANOS, tokenEnTurno, type Accion, type EstadoSala, type MensajeChat, type Tirada, type Token } from './sala';

export type Evento =
  | { tipo: 'tirada'; tirada: Tirada }
  | { tipo: 'movimiento'; tokenId: string; desde: { x: number; y: number }; hasta: { x: number; y: number }; camino?: { x: number; y: number }[] }
  | { tipo: 'turno'; tokenId: string; ronda: number }
  // Lo que deja el motor de interacciones, para verlo en el tablero
  | { tipo: 'area'; casillas: { x: number; y: number }[]; aspecto?: Aspecto; tipoDano?: string; autorTokenId?: string }
  | { tipo: 'dano'; tokenId: string; cantidad: number; critico: boolean; cayo: boolean }
  | { tipo: 'curacion'; tokenId: string; cantidad: number }
  | { tipo: 'efecto'; tokenId: string; nombre: string; beneficioso: boolean; aspecto?: Aspecto; quitado: boolean }
  // Se viene un combate: quiénes entran (cada jugador elige su tirada y lo que usa antes de tirar)
  | { tipo: 'preparacion'; tokens: string[] }
  // Alguien usó algo "al tirar iniciativa" en la preparación
  | { tipo: 'preparativo'; tokenId: string; nombre: string; ultimo: boolean }
  // Todos los jugadores de la preparación avisaron que están listos
  | { tipo: 'todos-listos' }
  // Se pasó a otra escena; el telón subió o bajó
  | { tipo: 'escena'; nombre: string }
  // Alguien habló en el chat (solo llega a quien lo puede ver)
  | { tipo: 'chat'; mensaje: MensajeChat }
  | { tipo: 'telon'; bajo: boolean }
  // El GM hizo descansar al grupo
  | { tipo: 'descanso'; descanso: 'diez' | 'noche' }
  // El GM mostró un handout (a quien lo recibe se le abre)
  | { tipo: 'handout'; id: string; titulo: string }
  // Empezó el combate: el orden en que se juega, para mostrarlo a todos
  | { tipo: 'combate'; orden: { tokenId: string; iniciativa: number }[] };

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
    case 'iniciar-combate': {
      const c = posterior.combate;
      const t = tokenEnTurno(posterior);
      if (!c || !t) return [];
      return [
        { tipo: 'combate', orden: c.orden.map((x) => ({ tokenId: x.tokenId, iniciativa: x.iniciativa })) },
        { tipo: 'turno', tokenId: t.id, ronda: c.ronda },
      ];
    }
    case 'preparar-combate':
      return posterior.preparacion ? [{ tipo: 'preparacion', tokens: posterior.preparacion.tokens }] : [];
    case 'marcar-listo': {
      const todos = (e: EstadoSala) => {
        const pr = e.preparacion;
        const jugadores = pr?.tokens.filter((id) => e.tokens[id]?.personajeId) ?? [];
        return jugadores.length > 0 && jugadores.every((id) => pr!.listos.includes(id));
      };
      return todos(posterior) && !todos(anterior) ? [{ tipo: 'todos-listos' }] : [];
    }
    case 'chat':
      return [{ tipo: 'chat', mensaje: accion.mensaje }];
    case 'cambiar-escena':
      return posterior.escena && posterior.escena.id !== anterior.escena?.id ? [{ tipo: 'escena', nombre: posterior.escena.nombre }] : [];
    case 'telon':
      return !!anterior.telon !== accion.bajo ? [{ tipo: 'telon', bajo: accion.bajo }] : [];
    case 'descanso-grupo':
      return [{ tipo: 'descanso', descanso: accion.descanso }];
    case 'mostrar-handout': {
      // Solo si lo puede ver (al jugador le llega su estado filtrado: si no se lo mostraron, no está)
      const h = (posterior.handouts ?? []).find((x) => x.id === accion.id);
      return h && h.para !== 'nadie' ? [{ tipo: 'handout', id: h.id, titulo: h.titulo }] : [];
    }
    case 'usar-preparacion':
      return [{ tipo: 'preparativo', tokenId: accion.tokenId, nombre: accion.nombre, ultimo: !!accion.ultimo }];
    case 'avanzar-turno': {
      const t = tokenEnTurno(posterior);
      return t && posterior.combate ? [{ tipo: 'turno', tokenId: t.id, ronda: posterior.combate.ronda }] : [];
    }
    case 'mostrar-area':
      return [{ tipo: 'area', casillas: accion.casillas, ...(accion.aspecto ? { aspecto: accion.aspecto } : {}), ...(accion.tipoDano ? { tipoDano: accion.tipoDano } : {}), ...(accion.autorTokenId ? { autorTokenId: accion.autorTokenId } : {}) }];
    case 'danar': {
      const antes = anterior.tokens[accion.tokenId];
      if (!antes || accion.cantidad <= 0) return [];
      const vida = (e: EstadoSala) => {
        const t = e.tokens[accion.tokenId];
        return t?.personajeId ? e.personajes[t.personajeId]?.pgActual ?? 0 : t?.pg?.actual ?? 0;
      };
      return [{ tipo: 'dano', tokenId: accion.tokenId, cantidad: accion.cantidad, critico: !!accion.critico, cayo: vida(anterior) > 0 && vida(posterior) <= 0 }];
    }
    case 'curar':
      return anterior.tokens[accion.tokenId] && accion.cantidad > 0 ? [{ tipo: 'curacion', tokenId: accion.tokenId, cantidad: accion.cantidad }] : [];
    case 'poner-efecto': {
      const e = accion.efecto;
      // La inmunidad no se anuncia: es solo una marca
      if (e.inmuneA || !anterior.tokens[accion.tokenId]) return [];
      return [{ tipo: 'efecto', tokenId: accion.tokenId, nombre: e.nombre, beneficioso: e.beneficioso, ...(e.aspecto ? { aspecto: e.aspecto } : {}), quitado: false }];
    }
    case 'quitar-efecto': {
      const e = anterior.tokens[accion.tokenId]?.efectos?.find((x) => x.id === accion.efectoId);
      return e && !e.inmuneA ? [{ tipo: 'efecto', tokenId: accion.tokenId, nombre: e.nombre, beneficioso: e.beneficioso, ...(e.aspecto ? { aspecto: e.aspecto } : {}), quitado: true }] : [];
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

// Disparadores: en qué momento de la partida sirve cada aptitud.
// La mesa los usa para avisar en el momento justo: "te atacan, ¿reaccionas?", "le diste: puedes…".

import type { Aptitud } from './aptitudes';

export type Momento =
  // Tu turno, antes de un Strike: aptitudes que cambian cómo atacas (Power Attack, Sudden Charge)
  | 'al-atacar'
  // Después de tu ataque, según cómo salió
  | 'al-acertar'
  | 'al-criticar'
  | 'al-fallar'
  // Un enemigo te ataca, antes de tirar: la mesa espera tu respuesta (Nimble Dodge)
  | 'te-apuntan'
  // Un ataque te acertó (Shield Block)
  | 'te-golpean'
  // Un enemigo que estaba a tu alcance se mueve (Reactive Strike)
  | 'enemigo-se-mueve'
  | 'inicio-turno'
  | 'fin-turno';

export const MOMENTOS: Record<Momento, { titulo: string; ayuda: string }> = {
  'al-atacar': { titulo: 'Antes de atacar', ayuda: 'En tu turno, en lugar de un Strike normal.' },
  'al-acertar': { titulo: 'Cuando aciertas', ayuda: 'Justo después de que tu ataque acierta.' },
  'al-criticar': { titulo: 'Cuando haces crítico', ayuda: 'Justo después de un éxito crítico.' },
  'al-fallar': { titulo: 'Cuando fallas', ayuda: 'Justo después de fallar un ataque.' },
  'te-apuntan': { titulo: 'Cuando te atacan', ayuda: 'Un enemigo te ataca: la mesa espera tu respuesta antes de tirar.' },
  'te-golpean': { titulo: 'Cuando te aciertan', ayuda: 'Un ataque te acertó y vas a recibir daño.' },
  'enemigo-se-mueve': { titulo: 'Cuando un enemigo se mueve a tu lado', ayuda: 'Un enemigo a tu alcance se mueve.' },
  'inicio-turno': { titulo: 'Al empezar tu turno', ayuda: 'Recordatorio al empezar tu turno.' },
  'fin-turno': { titulo: 'Al terminar tu turno', ayuda: 'Recordatorio al terminar tu turno.' },
};

export const MOMENTOS_VALIDOS = Object.keys(MOMENTOS) as Momento[];

export function tieneMomento(a: Aptitud, m: Momento): boolean {
  return a.disparadores?.includes(m) ?? false;
}

const dote = (id: string, nombre: string, verbo: string, costo: Aptitud['costo'], disparadores: Momento[], descripcion: string,
  extra: Partial<Aptitud> = {}): Aptitud =>
  ({ id: `catalogo:${id}`, nombre, verbo, categoria: 'dote', costo, recuperacion: { tipo: 'siempre' }, descripcion, rasgos: [], disparadores, ...extra });

// Reacciones y dotes comunes, listas para agregar a una ficha (Pathfinder 2e, licencia ORC)
export const CATALOGO: Aptitud[] = [
  dote('shield-block', 'Shield Block', 'Bloquear con el escudo', 'reaccion', ['te-golpean'],
    'Con el escudo levantado, cuando un ataque te iba a hacer daño físico: el escudo absorbe tanto daño como su Dureza (Hardness). El resto se reparte entre tú y el escudo.',
    { requiere: 'shield-raised' }),
  dote('reactive-strike', 'Reactive Strike', 'Golpe de oportunidad', 'reaccion', ['enemigo-se-mueve'],
    'Cuando un enemigo a tu alcance se mueve o usa una acción de manipular, le haces un Strike. Con crítico, si estaba manipulando, lo interrumpes.',
    { tirada: { tipo: 'golpe' } }),
  dote('nimble-dodge', 'Nimble Dodge', 'Esquiva ágil', 'reaccion', ['te-apuntan'],
    'Cuando un enemigo que puedes ver te ataca, te apartas: +2 a tu CA contra ese ataque.',
    { efecto: { bonoCA: 2 } }),
  dote('power-attack', 'Power Attack', 'Ataque poderoso', 2, ['al-atacar'],
    'Un Strike cuerpo a cuerpo con un dado de daño extra. Cuenta como dos ataques para la penalización de los siguientes.',
    { tirada: { tipo: 'golpe' } }),
  dote('sudden-charge', 'Sudden Charge', 'Carga repentina', 2, ['al-atacar'],
    'Te mueves dos veces tu Velocidad y, si terminas al lado de un enemigo, le haces un Strike cuerpo a cuerpo.',
    { tirada: { tipo: 'golpe' } }),
  dote('double-slice', 'Double Slice', 'Doble tajo', 2, ['al-atacar'],
    'Con un arma en cada mano, haces dos Strikes al mismo enemigo con la penalización actual; si los dos aciertan, el daño se suma.',
    { tirada: { tipo: 'golpe' } }),
];

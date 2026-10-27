// Morir y curarse en PF2e: la salvación de recuperación de Dying, Doomed, Wounded, los Hero Points y Treat Wounds.

import { ponerCondicion, type Condicion } from './condiciones';
import { gradoDeExito, type Grado, type Rango } from './pf2e';

const valor = (cs: Condicion[], clave: Condicion['clave']) => cs.find((c) => c.clave === clave)?.valor ?? 0;

// Con Dying igual a esto se muere: 4, menos lo que tenga de Doomed
export function dyingMortal(condiciones: Condicion[]): number {
  return Math.max(1, 4 - valor(condiciones, 'doomed'));
}

// Al empezar su turno, quien está Dying tira un chequeo plano contra 10 + Dying.
// Éxito crítico: baja 2; éxito: baja 1; fallo: sube 1; fallo crítico: sube 2.
export function recuperacion(condiciones: Condicion[], d20: number): { cd: number; grado: Grado; dying: number } {
  const dying = valor(condiciones, 'dying');
  const cd = 10 + dying;
  const grado = gradoDeExito(d20, d20, cd);
  const cambio = { critico: -2, exito: -1, fallo: 1, pifia: 2 }[grado];
  return { cd, grado, dying: Math.max(0, dying + cambio) };
}

// Lo que queda después: si Dying llega a 0 se estabiliza (sigue inconsciente, con Wounded +1); si llega al
// máximo, muere. `sinHerida`: la recuperación heroica (Hero Points) no suma Wounded.
export function conDying(condiciones: Condicion[], dying: number, sinHerida = false): Condicion[] {
  if (dying >= dyingMortal(condiciones)) return ponerCondicion(ponerCondicion(condiciones, 'dying', 0), 'dead', 1);
  if (dying > 0) return ponerCondicion(condiciones, 'dying', dying);
  const sin = ponerCondicion(condiciones, 'dying', 0);
  return sinHerida ? sin : ponerCondicion(sin, 'wounded', valor(condiciones, 'wounded') + 1);
}

export const MAX_HEROICOS = 3;

// Treat Wounds: la dificultad que se elige (según el rango en Medicine) y cuánto cura
export const NIVELES_CURAR: { rango: Rango; nombre: string; cd: number; bono: number }[] = [
  { rango: 1, nombre: 'Trained', cd: 15, bono: 0 },
  { rango: 2, nombre: 'Expert', cd: 20, bono: 10 },
  { rango: 3, nombre: 'Master', cd: 30, bono: 30 },
  { rango: 4, nombre: 'Legendary', cd: 40, bono: 50 },
];

// Qué se tira según cómo salió: crítico 4d8, éxito 2d8 (más el bono de la dificultad), pifia 1d8 de daño
export function curarHeridas(grado: Grado, nivel: (typeof NIVELES_CURAR)[number]): { cura?: string; dana?: string } {
  if (grado === 'critico') return { cura: `4d8${nivel.bono ? `+${nivel.bono}` : ''}` };
  if (grado === 'exito') return { cura: `2d8${nivel.bono ? `+${nivel.bono}` : ''}` };
  if (grado === 'pifia') return { dana: '1d8' };
  return {};
}

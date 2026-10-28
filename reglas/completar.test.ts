import { describe, expect, it } from 'vitest';
import { completarPaso, prioridadAtributos } from './completar';
import { ELECCION_VACIA, pendientes, type Eleccion, type Paso } from './creador';
import { ASCENDENCIAS } from './datos/ascendencias';
import { TRASFONDOS } from './datos/trasfondos';
import { CLASES } from './datos/clases';

const PASOS: Paso[] = ['ascendencia', 'trasfondo', 'clase', 'atributos', 'habilidades', 'dotes', 'conjuros', 'equipo', 'detalles'];

function completar(e: Eleccion): Eleccion {
  let x = e;
  for (const p of PASOS) x = { ...x, ...completarPaso(x, p) };
  return x;
}

describe('Elegir por mí en el creador', () => {
  it('con ascendencia, trasfondo y clase elegidos, completa todo lo demás sin pendientes, para cada clase y ascendencia', () => {
    for (const c of CLASES) {
      for (const a of ASCENDENCIAS) {
        const e = completar({ ...ELECCION_VACIA, ascendencia: a.id, trasfondo: TRASFONDOS[0]!.id, clase: c.id });
        expect(pendientes(e), `${a.id} ${c.id}`).toEqual([]);
      }
    }
  });

  it('no toca lo que ya eligió el jugador', () => {
    const base: Eleccion = { ...ELECCION_VACIA, ascendencia: ASCENDENCIAS[0]!.id, trasfondo: TRASFONDOS[0]!.id, clase: 'fighter', mejorasLibres: ['cha', null, null, null] };
    const e = completar(base);
    expect(e.mejorasLibres[0]).toBe('cha');
    expect(new Set(e.mejorasLibres).size).toBe(4);
  });

  it('el atributo clave va primero; los de fuerza quieren aguante antes que esquivar', () => {
    expect(prioridadAtributos({ ...ELECCION_VACIA, clase: 'fighter', atributoClave: 'str' }).slice(0, 2)).toEqual(['str', 'con']);
    expect(prioridadAtributos({ ...ELECCION_VACIA, clase: 'wizard', atributoClave: 'int' }).slice(0, 2)).toEqual(['int', 'dex']);
  });

  it('sin ascendencia ni clase no inventa nada', () => {
    expect(completarPaso(ELECCION_VACIA, 'ascendencia')).toEqual({});
    expect(completarPaso(ELECCION_VACIA, 'clase')).toEqual({});
  });
});

describe('los conjuros que elige', () => {
  it('a un wizard le da primero los que más rinden (Electric Arc, Shield; Force Barrage, Fear)', () => {
    const e = completar({ ...ELECCION_VACIA, ascendencia: ASCENDENCIAS[0]!.id, trasfondo: TRASFONDOS[0]!.id, clase: 'wizard' });
    expect(e.trucos.slice(0, 2)).toEqual(['electric-arc', 'shield']);
    expect(e.conjuros).toContain('force-barrage');
  });
});

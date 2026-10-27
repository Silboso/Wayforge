import { describe, expect, it } from 'vitest';
import { personajeNuevo } from '../reglas/pf2e';
import { aplicar, esAccionValida, estadoInicial, puede, type Accion, type EstadoSala } from './sala';
import { vistaDeJugador } from './vision';
import { eventosDe } from './eventos';

function mesa(): EstadoSala {
  let e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: { ...personajeNuevo('kyra'), nombre: 'Kyra' }, x: 2, y: 2 });
  e = aplicar(e, { tipo: 'crear-personaje', personaje: { ...personajeNuevo('ezren'), nombre: 'Ezren' }, x: 2, y: 3 });
  return aplicar(e, { tipo: 'guardar-handout', handout: { id: 'carta', titulo: 'La carta del alcalde', texto: 'Vengan solos al molino.' } });
}
const ve = (e: EstadoSala, id: string) => (vistaDeJugador(e, id).estado.handouts ?? []).map((h) => h.id);

describe('handouts', () => {
  it('nadie lo ve hasta que el GM lo muestra; a uno solo, solo ese', () => {
    let e = mesa();
    expect(e.handouts?.[0]).toMatchObject({ titulo: 'La carta del alcalde', para: 'nadie' });
    expect(ve(e, 'kyra')).toEqual([]);
    e = aplicar(e, { tipo: 'mostrar-handout', id: 'carta', para: ['kyra'], cuando: 1 });
    expect(ve(e, 'kyra')).toEqual(['carta']);
    expect(ve(e, 'ezren')).toEqual([]);
    e = aplicar(e, { tipo: 'mostrar-handout', id: 'carta', para: 'todos', cuando: 2 });
    expect(ve(e, 'ezren')).toEqual(['carta']);
    e = aplicar(e, { tipo: 'mostrar-handout', id: 'carta', para: 'nadie', cuando: 3 });
    expect(ve(e, 'kyra')).toEqual([]);
  });

  it('a quien se lo muestran se le abre (y editarlo no lo vuelve a abrir ni cambia a quién se mostró)', () => {
    const antes = mesa();
    const accion: Accion = { tipo: 'mostrar-handout', id: 'carta', para: ['kyra'], cuando: 5 };
    const despues = aplicar(antes, accion);
    // Cada jugador calcula sus eventos con lo que le llega (su vista filtrada)
    const de = (id: string) => eventosDe(vistaDeJugador(antes, id).estado, accion, vistaDeJugador(despues, id).estado);
    expect(de('kyra')).toEqual([{ tipo: 'handout', id: 'carta', titulo: 'La carta del alcalde' }]);
    expect(de('ezren')).toEqual([]);
    const editado = aplicar(despues, { tipo: 'guardar-handout', handout: { id: 'carta', titulo: 'La carta', texto: 'Otro texto' } });
    expect(editado.handouts?.[0]).toMatchObject({ titulo: 'La carta', para: ['kyra'], cuando: 5 });
    expect(aplicar(editado, { tipo: 'borrar-handout', id: 'carta' }).handouts).toEqual([]);
  });

  it('solo el GM los maneja, y la sala revisa lo que llega', () => {
    const e = mesa();
    const accion: Accion = { tipo: 'mostrar-handout', id: 'carta', para: 'todos', cuando: 1 };
    expect(puede({ rol: 'jugador', personajeId: 'kyra' }, accion, e)).toBe(false);
    expect(puede({ rol: 'gm' }, accion, e)).toBe(true);
    expect(esAccionValida({ tipo: 'guardar-handout', handout: { id: 'x', titulo: '  ', texto: '' } }, e)).toBe(false);
    expect(esAccionValida({ tipo: 'guardar-handout', handout: { id: 'x', titulo: 'Mapa', texto: 'y'.repeat(5000) } }, e)).toBe(false);
    expect(esAccionValida({ tipo: 'mostrar-handout', id: 'carta', para: [], cuando: 1 }, e)).toBe(false);
  });
});

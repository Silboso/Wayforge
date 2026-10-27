import { describe, expect, it } from 'vitest';
import { personajeNuevo } from '../reglas/pf2e';
import { aplicar, estadoImportable, estadoInicial } from './sala';

describe('campañas: importar una mesa', () => {
  it('se abre con sus personajes, escenas y handouts; el combate y las tiradas no viajan', () => {
    let e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: { ...personajeNuevo('kyra'), nombre: 'Kyra' }, x: 2, y: 2 });
    e = aplicar(e, { tipo: 'nombrar-mesa', nombre: '  La maldición del molino ' });
    e = aplicar(e, { tipo: 'crear-escena', id: 'cueva', nombre: 'La cueva' });
    e = aplicar(e, { tipo: 'guardar-handout', handout: { id: 'carta', titulo: 'Carta', texto: 'Hola' } });
    e = { ...e, combate: { orden: [], turno: 0, ronda: 1, acciones: 3, usadas: 0, ataques: 0, reacciones: [] } as never };
    const abierto = estadoImportable(JSON.parse(JSON.stringify(e)));
    expect(abierto?.nombre).toBe('La maldición del molino');
    expect(Object.keys(abierto!.personajes)).toEqual(['kyra']);
    expect(abierto!.escenas?.map((x) => x.nombre)).toEqual(['La cueva']);
    expect(abierto!.handouts?.map((h) => h.titulo)).toEqual(['Carta']);
    expect(abierto!.combate).toBeNull();
    expect(abierto!.tiradas).toEqual([]);
  });

  it('lo que no cuadra no se abre', () => {
    const e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: { ...personajeNuevo('kyra'), nombre: 'Kyra' }, x: 2, y: 2 });
    expect(estadoImportable({ ...e, personajes: { kyra: { ...e.personajes.kyra, nivel: 99 } } })).toBeNull();
    expect(estadoImportable({ ...e, mapa: { ...e.mapa, columnas: 5000 } })).toBeNull();
    expect(estadoImportable('hola')).toBeNull();
  });
});

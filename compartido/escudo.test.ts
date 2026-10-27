import { describe, expect, it } from 'vitest';
import { personajeNuevo, type Personaje } from '../reglas/pf2e';
import { crearEfecto } from '../reglas/efectos';
import { aplicar, BLOQUEO_ESCUDO, estadoInicial, puede, type EstadoSala } from './sala';

const kyra: Personaje = {
  ...personajeNuevo('kyra'), nombre: 'Kyra', pgActual: 20,
  escudo: { nombre: 'Steel Shield', ca: 2, dureza: 5, pg: 20, pgActual: 20 },
};
const mesa = (): EstadoSala => aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: kyra, x: 2, y: 2 });
const bloquear = (e: EstadoSala) => aplicar(e, { tipo: 'poner-efecto', tokenId: 'kyra', efecto: crearEfecto({ clave: BLOQUEO_ESCUDO, nombre: 'Shield Block', beneficioso: true, modificadores: [], rondas: 1 }, 'sb', undefined, 'kyra', undefined) });

describe('Shield Block al recibir daño', () => {
  it('el escudo frena su Dureza; lo que sobra lo reciben ella y el escudo, y el bloqueo se gasta', () => {
    let e = aplicar(bloquear(mesa()), { tipo: 'danar', tokenId: 'kyra', cantidad: 12 });
    expect(e.personajes.kyra!.pgActual).toBe(13);
    expect(e.personajes.kyra!.escudo!.pgActual).toBe(13);
    expect(e.tokens.kyra!.efectos ?? []).toEqual([]);
    // Sin bloqueo, el siguiente golpe entra entero
    e = aplicar(e, { tipo: 'danar', tokenId: 'kyra', cantidad: 4 });
    expect(e.personajes.kyra!.pgActual).toBe(9);
  });

  it('un golpe chico lo frena todo', () => {
    const e = aplicar(bloquear(mesa()), { tipo: 'danar', tokenId: 'kyra', cantidad: 3 });
    expect(e.personajes.kyra!.pgActual).toBe(20);
    expect(e.personajes.kyra!.escudo!.pgActual).toBe(20);
  });

  it('restarse el daño a 0 PG deja Dying (también cuando lo hace el propio jugador)', () => {
    const e = mesa();
    expect(puede({ rol: 'jugador', personajeId: 'kyra' }, { tipo: 'danar', tokenId: 'kyra', cantidad: 30 }, e)).toBe(true);
    const caida = aplicar(e, { tipo: 'danar', tokenId: 'kyra', cantidad: 30 });
    expect(caida.tokens.kyra!.condiciones).toEqual(expect.arrayContaining([{ clave: 'dying', valor: 1 }, { clave: 'unconscious', valor: 1 }]));
  });
});

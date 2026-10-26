import { describe, expect, it } from 'vitest';
import { personajeNuevo, calcular, esPersonajeValido, type Personaje } from '../reglas/pf2e';
import { CATALOGO } from '../reglas/disparadores';
import { aAlcance, eventosDe } from './eventos';
import { aplicar, caDeToken, estadoInicial, motivoAlcance, motivoParaActuar, planMovimiento, puede, reaccionesPara, type Accion, type EstadoSala, type Token } from './sala';

const dote = (id: string) => ({ ...CATALOGO.find((a) => a.id === `catalogo:${id}`)!, id });

const kyra: Personaje = {
  ...personajeNuevo('kyra'),
  nombre: 'Kyra',
  nivel: 3,
  atributos: { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
  golpes: [{ id: 'espada', nombre: 'Longsword', atributo: 'str', rango: 2, bonoObjeto: 1, dados: '1d8', tipoDano: 'slashing', sumarFuerza: true, agil: false }],
  aptitudes: [dote('shield-block'), dote('reactive-strike'), dote('nimble-dodge'), dote('power-attack')],
};
const goblin: Token = { id: 'g1', nombre: 'Goblin', tipo: 'enemigo', tamano: 'Small', x: 1, y: 0, color: '#c8392b', ca: 15 };

function mesa(): EstadoSala {
  let e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: kyra, x: 0, y: 0 });
  e = aplicar(e, { tipo: 'crear-token', token: goblin });
  return e;
}

describe('catálogo', () => {
  it('las aptitudes del catálogo son válidas en una ficha', () => {
    expect(esPersonajeValido(kyra)).toBe(true);
  });
});

describe('reaccionesPara', () => {
  it('ofrece cada reacción en su momento', () => {
    const e = mesa();
    expect(reaccionesPara(e, 'kyra', 'te-apuntan').map((a) => a.nombre)).toEqual(['Nimble Dodge']);
    expect(reaccionesPara(e, 'kyra', 'enemigo-se-mueve').map((a) => a.nombre)).toEqual(['Reactive Strike']);
  });

  it('Shield Block solo con el escudo levantado', () => {
    let e = mesa();
    expect(reaccionesPara(e, 'kyra', 'te-golpean')).toEqual([]);
    e = aplicar(e, { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'shield-raised', valor: 1, hasta: 'inicio-turno' });
    expect(reaccionesPara(e, 'kyra', 'te-golpean').map((a) => a.nombre)).toEqual(['Shield Block']);
  });

  it('nada si ya usó su reacción esta ronda', () => {
    let e = aplicar(mesa(), { tipo: 'iniciar-combate', orden: [{ tokenId: 'g1', iniciativa: 20 }, { tokenId: 'kyra', iniciativa: 10 }] });
    e = aplicar(e, { tipo: 'usar-reaccion', tokenId: 'kyra', usada: true });
    expect(reaccionesPara(e, 'kyra', 'te-apuntan')).toEqual([]);
  });
});

describe('escudo levantado', () => {
  it('suma +2 a la CA y se va al empezar su próximo turno', () => {
    let e = aplicar(mesa(), { tipo: 'iniciar-combate', orden: [{ tokenId: 'kyra', iniciativa: 20 }, { tokenId: 'g1', iniciativa: 10 }] });
    const sin = caDeToken(e, e.tokens.kyra!)!.total;
    e = aplicar(e, { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'shield-raised', valor: 1, hasta: 'inicio-turno' });
    expect(caDeToken(e, e.tokens.kyra!)!.total).toBe(sin + 2);
    e = aplicar(e, { tipo: 'avanzar-turno' });
    expect(e.tokens.kyra?.condiciones).toEqual([{ clave: 'shield-raised', valor: 1, hasta: 'inicio-turno' }]);
    e = aplicar(e, { tipo: 'avanzar-turno' });
    expect(e.tokens.kyra?.condiciones).toEqual([]);
    expect(calcular(kyra, []).ca.total).toBe(sin);
  });
});

describe('aAlcance', () => {
  it('casillas que se tocan, también en diagonal; dos casillas lejos no', () => {
    const k: Token = { ...goblin, id: 'k', tamano: 'Medium', x: 5, y: 5 };
    expect(aAlcance(k, { ...goblin, x: 6, y: 6 })).toBe(true);
    expect(aAlcance(k, { ...goblin, x: 7, y: 5 })).toBe(false);
    // Un Large (2×2) a la izquierda que toca
    expect(aAlcance(k, { ...goblin, tamano: 'Large', x: 3, y: 4 })).toBe(true);
  });
});

describe('eventosDe', () => {
  it('saca tiradas, movimientos con su origen y cambios de turno', () => {
    const antes = mesa();
    const mover = { tipo: 'mover-token', id: 'g1', x: 4, y: 0 } as const;
    expect(eventosDe(antes, mover, aplicar(antes, mover))).toEqual([{ tipo: 'movimiento', tokenId: 'g1', desde: { x: 1, y: 0 }, hasta: { x: 4, y: 0 } }]);
    const inicio: Accion = { tipo: 'iniciar-combate', orden: [{ tokenId: 'g1', iniciativa: 20 }] };
    expect(eventosDe(antes, inicio, aplicar(antes, inicio))).toEqual([{ tipo: 'turno', tokenId: 'g1', ronda: 1 }]);
    expect(eventosDe(antes, { tipo: 'editar-mapa', cambios: { filas: 9 } }, antes)).toEqual([]);
  });
});

describe('reglas de la mesa en combate', () => {
  function enCombate(): EstadoSala {
    let e = aplicar(mesa(), { tipo: 'mover-token', id: 'g1', x: 8, y: 0 });
    e = aplicar(e, { tipo: 'iniciar-combate', orden: [{ tokenId: 'kyra', iniciativa: 20 }, { tokenId: 'g1', iniciativa: 10 }] });
    return e;
  }

  it('un Stride llega a la Velocidad; dos, al doble; más, dice por qué', () => {
    const e = enCombate();
    const kyraT = e.tokens.kyra!;
    const uno = planMovimiento(e, kyraT, { x: 0, y: 5 }, 3);
    expect(uno).toMatchObject({ pies: 25, acciones: 1 });
    const dos = planMovimiento(e, kyraT, { x: 0, y: 8 }, 3);
    expect(dos).toMatchObject({ pies: 40, acciones: 2 });
    const lejos = planMovimiento(e, kyraT, { x: 0, y: 6 }, 1);
    expect(lejos).toEqual({ motivo: 'Muy lejos: con tu acción llegas a 25 ft.' });
  });

  it('mover-turno mueve por el camino y gasta los Strides en su turno', () => {
    let e = enCombate();
    const plan = planMovimiento(e, e.tokens.kyra!, { x: 0, y: 5 }, 3);
    if ('motivo' in plan) throw new Error(plan.motivo);
    e = aplicar(e, { tipo: 'mover-turno', id: 'kyra', camino: plan.camino, acciones: plan.acciones });
    expect(e.tokens.kyra).toMatchObject({ x: 0, y: 5 });
    expect(e.combate?.usadas).toBe(1);
  });

  it('explica por qué no se puede actuar', () => {
    let e = enCombate();
    expect(motivoParaActuar(e, 'kyra', 1)).toBeNull();
    e = aplicar(e, { tipo: 'gastar-acciones', usadas: 2 });
    expect(motivoParaActuar(e, 'kyra', 2)).toBe('Te falta 1 acción.');
    e = aplicar(e, { tipo: 'avanzar-turno' });
    expect(motivoParaActuar(e, 'kyra', 1)).toBe('No es tu turno: ahora juega Goblin.');
    expect(motivoParaActuar(e, 'kyra', 'reaccion')).toBeNull();
  });

  it('cuerpo a cuerpo exige estar al lado', () => {
    const e = enCombate();
    expect(motivoAlcance(e.tokens.kyra!, e.tokens.g1!, 5)).toBe('Goblin está a 40 ft: tienes que estar al lado. Acércate primero.');
    expect(motivoAlcance(e.tokens.kyra!, { ...e.tokens.g1!, x: 1 }, 5)).toBeNull();
  });

  it('los jugadores no mueven libre en combate', () => {
    const e = enCombate();
    expect(puede({ rol: 'jugador', personajeId: 'kyra' }, { tipo: 'mover-token', id: 'kyra', x: 1, y: 1 }, e)).toBe(false);
  });
});

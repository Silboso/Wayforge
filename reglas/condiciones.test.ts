import { describe, expect, it } from 'vitest';
import { accionesAlEmpezar, alTerminarTurno, penalizaciones, ponerCondicion, type Condicion } from './condiciones';
import { calcular, gradoDeExito, leerExpresion, personajeNuevo, type Personaje } from './pf2e';

const kyra: Personaje = {
  ...personajeNuevo('kyra'),
  nombre: 'Kyra',
  nivel: 3,
  atributos: { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
  golpes: [{ id: 'g', nombre: 'Longsword', atributo: 'str', rango: 2, bonoObjeto: 1, dados: '1d8', tipoDano: 'slashing', sumarFuerza: true, agil: false }],
};

describe('penalizaciones', () => {
  it('de las de estado solo cuenta la peor', () => {
    const c: Condicion[] = [{ clave: 'frightened', valor: 1 }, { clave: 'sickened', valor: 2 }];
    expect(penalizaciones(c, { tipo: 'chequeo', atributo: 'wis' })).toEqual([{ etiqueta: 'Sickened 2', valor: -2 }]);
  });

  it('estado y circunstancia sí se suman', () => {
    const c: Condicion[] = [{ clave: 'frightened', valor: 1 }, { clave: 'off-guard', valor: 1 }];
    expect(penalizaciones(c, { tipo: 'ca' }).map((p) => p.valor)).toEqual([-1, -2]);
  });

  it('cada condición toca solo lo suyo', () => {
    const torpe: Condicion[] = [{ clave: 'clumsy', valor: 2 }];
    expect(penalizaciones(torpe, { tipo: 'chequeo', atributo: 'str' })).toEqual([]);
    expect(penalizaciones(torpe, { tipo: 'ca' })).toEqual([{ etiqueta: 'Clumsy 2', valor: -2 }]);
    expect(penalizaciones([{ clave: 'frightened', valor: 3 }], { tipo: 'dano', conFuerza: true })).toEqual([]);
    expect(penalizaciones([{ clave: 'drained', valor: 1 }], { tipo: 'chequeo', atributo: 'con', salvacion: 'fortitude' })).toHaveLength(1);
  });
});

describe('calcular con condiciones', () => {
  it('Frightened 2 baja la CA, los ataques y las skills, pero no el daño', () => {
    const sana = calcular(kyra);
    const asustada = calcular(kyra, [{ clave: 'frightened', valor: 2 }]);
    expect(asustada.ca.total).toBe(sana.ca.total - 2);
    expect(asustada.golpes[0]!.penalizaciones[0]).toBe(sana.golpes[0]!.penalizaciones[0] - 2);
    expect(asustada.habilidades.athletics.total).toBe(sana.habilidades.athletics.total - 2);
    expect(asustada.golpes[0]!.dano).toBe(sana.golpes[0]!.dano);
  });

  it('Enfeebled baja el daño con Str', () => {
    expect(calcular(kyra, [{ clave: 'enfeebled', valor: 1 }]).golpes[0]!.dano).toBe('1d8+3 slashing');
  });
});

describe('turnos', () => {
  it('Frightened baja 1 al final del turno y desaparece en 0', () => {
    expect(alTerminarTurno([{ clave: 'frightened', valor: 2 }, { clave: 'prone', valor: 1 }]))
      .toEqual([{ clave: 'frightened', valor: 1 }, { clave: 'prone', valor: 1 }]);
    expect(alTerminarTurno([{ clave: 'frightened', valor: 1 }])).toEqual([]);
  });

  it('Slowed y Stunned quitan acciones; Quickened da una', () => {
    expect(accionesAlEmpezar([])).toEqual({ acciones: 3, stunnedRestante: 0 });
    expect(accionesAlEmpezar([{ clave: 'slowed', valor: 1 }]).acciones).toBe(2);
    expect(accionesAlEmpezar([{ clave: 'quickened', valor: 1 }]).acciones).toBe(4);
    expect(accionesAlEmpezar([{ clave: 'stunned', valor: 5 }])).toEqual({ acciones: 0, stunnedRestante: 2 });
  });

  it('poner una condición la reemplaza; con valor 0 la quita', () => {
    let c = ponerCondicion([], 'frightened', 1);
    c = ponerCondicion(c, 'frightened', 3);
    expect(c).toEqual([{ clave: 'frightened', valor: 3 }]);
    expect(ponerCondicion(c, 'frightened', 0)).toEqual([]);
    expect(ponerCondicion([], 'prone', 5)).toEqual([{ clave: 'prone', valor: 1 }]);
  });
});

describe('gradoDeExito', () => {
  it('±10 es crítico o pifia; el 20 y el 1 naturales mueven un grado', () => {
    expect(gradoDeExito(25, 10, 15)).toBe('critico');
    expect(gradoDeExito(15, 8, 15)).toBe('exito');
    expect(gradoDeExito(14, 8, 15)).toBe('fallo');
    expect(gradoDeExito(5, 2, 15)).toBe('pifia');
    expect(gradoDeExito(14, 20, 15)).toBe('exito');
    expect(gradoDeExito(16, 1, 15)).toBe('fallo');
  });
});

describe('leerExpresion', () => {
  it('lee dados y modificadores', () => {
    expect(leerExpresion('1d20+7')).toEqual({ dados: [{ cantidad: 1, caras: 20 }], modificador: 7 });
    expect(leerExpresion('2d6 + 1d4 - 1')).toEqual({ dados: [{ cantidad: 2, caras: 6 }, { cantidad: 1, caras: 4 }], modificador: -1 });
    expect(leerExpresion('d20')).toEqual({ dados: [{ cantidad: 1, caras: 20 }], modificador: 0 });
  });

  it('rechaza lo raro', () => {
    for (const malo of ['', '7', '1d7', '99d6', 'hola', '1d20+', '-1d6']) expect(leerExpresion(malo)).toBeNull();
  });
});

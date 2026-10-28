import { describe, expect, it } from 'vitest';
import { calcular, esPersonajeValido, personajeNuevo, type Personaje } from './pf2e';
import { ACCIONES_BASICAS, aptitudNueva, descansar, disponibilidad, grupoDe, todasLasAptitudes, usar, type Aptitud } from './aptitudes';
import { interaccionDe } from './interacciones';

const missile: Aptitud = { ...aptitudNueva('missile'), nombre: 'Force Barrage', verbo: 'Proyectiles mágicos', recuperacion: { tipo: 'espacio', rango: 1 } };
const lance: Aptitud = { ...aptitudNueva('lance'), nombre: 'Lay on Hands', verbo: 'Imponer manos', categoria: 'foco', costo: 1, recuperacion: { tipo: 'foco' } };
const pocion: Aptitud = { ...aptitudNueva('pocion'), nombre: 'Minor Healing Potion', verbo: 'Beber poción', categoria: 'objeto', costo: 1, recuperacion: { tipo: 'consumible', cantidad: 2 } };
const diaria: Aptitud = { ...aptitudNueva('diaria'), nombre: 'Battle Medicine', verbo: 'Medicina de batalla', categoria: 'dote', costo: 1, recuperacion: { tipo: 'frecuencia', veces: 1, periodo: 'dia' } };

function maga(): Personaje {
  return {
    ...personajeNuevo('maga'),
    nombre: 'Ezren',
    nivel: 3,
    atributos: { str: 0, dex: 2, con: 1, int: 4, wis: 1, cha: 0 },
    aptitudes: [missile, lance, pocion, diaria],
    lanzador: { tradicion: 'arcane', atributo: 'int', rango: 1 },
    recursos: { foco: { max: 1, actual: 1 }, espacios: [{ rango: 1, max: 2, usados: 0 }, { rango: 2, max: 1, usados: 0 }], usos: {} },
  };
}

function aplicarCambios(p: Personaje, cambios: Partial<Personaje> | null): Personaje {
  expect(cambios).not.toBeNull();
  return { ...p, ...cambios };
}

describe('aptitudes', () => {
  it('trae las acciones básicas precargadas además de las propias', () => {
    const todas = todasLasAptitudes(maga());
    expect(todas.some((a) => a.nombre === 'Stride')).toBe(true);
    expect(todas.some((a) => a.nombre === 'Force Barrage')).toBe(true);
  });

  it('agrupa por cómo se recuperan', () => {
    expect([missile, lance, pocion, diaria].map(grupoDe)).toEqual(['espacios', 'foco', 'consumibles', 'frecuencia']);
    expect(grupoDe(todasLasAptitudes(maga()).find((a) => a.nombre === 'Aid')!)).toBe('reacciones');
  });

  it('un conjuro gasta primero el espacio más bajo que sirve, y luego los mayores', () => {
    let p = maga();
    p = aplicarCambios(p, usar(p, 'missile'));
    p = aplicarCambios(p, usar(p, 'missile'));
    expect(p.recursos?.espacios.map((e) => e.usados)).toEqual([2, 0]);
    p = aplicarCambios(p, usar(p, 'missile'));
    expect(p.recursos?.espacios.map((e) => e.usados)).toEqual([2, 1]);
    expect(disponibilidad(p, missile).puede).toBe(false);
    expect(usar(p, 'missile')).toBeNull();
  });

  it('foco, frecuencia y consumibles se agotan', () => {
    let p = maga();
    p = aplicarCambios(p, usar(p, 'lance'));
    expect(disponibilidad(p, lance)).toEqual({ puede: false, texto: '0 de 1 de foco' });
    p = aplicarCambios(p, usar(p, 'diaria'));
    expect(disponibilidad(p, diaria).puede).toBe(false);
    p = aplicarCambios(p, usar(p, 'pocion'));
    const quedan = p.aptitudes?.find((a) => a.id === 'pocion')?.recuperacion;
    expect(quedan).toEqual({ tipo: 'consumible', cantidad: 1 });
  });

  it('Refocus devuelve 1 de foco; el descanso largo devuelve todo y cura', () => {
    let p = maga();
    p = aplicarCambios(p, usar(p, 'lance'));
    p = aplicarCambios(p, usar(p, 'missile'));
    p = aplicarCambios(p, usar(p, 'diaria'));
    p = { ...p, pgActual: 5 };
    const conRefocus = { ...p, ...descansar(p, 'refocus', 30) };
    expect(conRefocus.recursos?.foco.actual).toBe(1);
    expect(conRefocus.recursos?.espacios[0]?.usados).toBe(1);
    expect(disponibilidad(conRefocus, diaria).puede).toBe(false);
    const descansada = { ...p, ...descansar(p, 'diario', 30) };
    expect(descansada.recursos?.espacios.every((e) => e.usados === 0)).toBe(true);
    expect(disponibilidad(descansada, diaria).puede).toBe(true);
    expect(descansada.pgActual).toBe(5 + 1 * 3);
  });

  it('calcula el ataque y la CD de conjuros', () => {
    const { conjuros } = calcular(maga());
    expect(conjuros?.ataque.total).toBe(4 + 5);
    expect(conjuros?.cd.total).toBe(10 + 4 + 5);
    expect(calcular(personajeNuevo('x')).conjuros).toBeNull();
  });

  it('valida fichas con aptitudes y rechaza las raras', () => {
    expect(esPersonajeValido(maga())).toBe(true);
    expect(esPersonajeValido({ ...maga(), aptitudes: [{ ...missile, costo: 7 }] })).toBe(false);
    expect(esPersonajeValido({ ...maga(), aptitudes: [{ ...missile, tirada: { tipo: 'expresion', expresion: 'hola' } }] })).toBe(false);
    expect(esPersonajeValido({ ...maga(), recursos: { foco: { max: 9, actual: 0 }, espacios: [], usos: {} } })).toBe(false);
  });
});

describe('acciones básicas con efecto', () => {
  it('Take Cover trae su efecto (+2 a la CA hasta tu próximo turno)', () => {
    const a = ACCIONES_BASICAS.find((x) => x.id === 'basica:take-cover')!;
    expect(interaccionDe(a)?.efecto?.modificadores).toEqual([{ blanco: 'ca', tipo: 'circunstancia', valor: 2 }]);
  });
});

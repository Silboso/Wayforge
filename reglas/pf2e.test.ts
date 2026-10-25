import { describe, expect, it } from 'vitest';
import { bonoCompetencia, calcular, esPersonajeValido, leerDados, personajeNuevo, type Personaje } from './pf2e';

// Guerrera humana de nivel 3: Str +4, Dex +2, Con +2, Wis +1
function kyra(): Personaje {
  return {
    ...personajeNuevo('kyra'),
    nombre: 'Kyra',
    ascendencia: 'Human',
    clase: 'Fighter',
    nivel: 3,
    atributos: { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
    pgAscendencia: 8,
    pgClase: 10,
    percepcion: 2,
    salvaciones: { fortitude: 2, reflex: 2, will: 1 },
    armadura: { nombre: 'Chain mail', rango: 1, bonoObjeto: 4, topeDex: 1 },
    habilidades: { ...personajeNuevo('x').habilidades, athletics: 1, intimidation: 1 },
    golpes: [
      { id: 'g', nombre: 'Longsword', atributo: 'str', rango: 2, bonoObjeto: 1, dados: '1d8', tipoDano: 'slashing', sumarFuerza: true, agil: false },
      { id: 'd', nombre: 'Dagger', atributo: 'str', rango: 2, bonoObjeto: 0, dados: '1d4', tipoDano: 'piercing', sumarFuerza: true, agil: true },
    ],
  };
}

describe('bonoCompetencia', () => {
  it('untrained no suma nivel; trained suma 2 + nivel', () => {
    expect(bonoCompetencia(0, 5)).toBe(0);
    expect(bonoCompetencia(1, 5)).toBe(7);
    expect(bonoCompetencia(4, 20)).toBe(28);
  });
});

describe('calcular', () => {
  const ficha = calcular(kyra());

  it('PG máximos = ascendencia + (clase + Con) × nivel', () => {
    expect(ficha.pgMax.total).toBe(8 + (10 + 2) * 3);
  });

  it('la CA respeta el tope de Dex de la armadura', () => {
    // 10 + Dex 1 (tope) + trained 5 + armadura 4
    expect(ficha.ca.total).toBe(20);
    expect(ficha.ca.partes.map((p) => p.etiqueta)).toContain('Dex (tope 1)');
  });

  it('salvaciones, Perception y habilidades suman atributo + competencia', () => {
    expect(ficha.salvaciones.fortitude.total).toBe(2 + 7);
    expect(ficha.percepcion.total).toBe(1 + 7);
    expect(ficha.habilidades.athletics.total).toBe(4 + 5);
    expect(ficha.habilidades.arcana.total).toBe(0);
  });

  it('el desglose suma el total', () => {
    for (const v of [ficha.ca, ficha.pgMax, ficha.habilidades.athletics]) {
      expect(v.partes.reduce((s, p) => s + p.valor, 0)).toBe(v.total);
    }
  });

  it('penalización por ataque múltiple: −5/−10, o −4/−8 con agile', () => {
    // Str 4 + expert 7 + runa 1
    expect(ficha.golpes[0]!.penalizaciones).toEqual([12, 7, 2]);
    expect(ficha.golpes[1]!.penalizaciones).toEqual([11, 7, 3]);
    expect(ficha.golpes[0]!.dano).toBe('1d8+4 slashing');
  });
});

describe('leerDados', () => {
  it('acepta dados de PF2e y rechaza el resto', () => {
    expect(leerDados('2d6')).toEqual({ cantidad: 2, caras: 6 });
    expect(leerDados('1d20')).toBeNull();
    expect(leerDados('0d8')).toBeNull();
    expect(leerDados('d8')).toBeNull();
  });
});

describe('esPersonajeValido', () => {
  it('acepta una ficha completa', () => {
    expect(esPersonajeValido(kyra())).toBe(true);
  });

  it('rechaza nombres vacíos, niveles fuera de rango y dados raros', () => {
    expect(esPersonajeValido({ ...kyra(), nombre: '  ' })).toBe(false);
    expect(esPersonajeValido({ ...kyra(), nivel: 21 })).toBe(false);
    expect(esPersonajeValido({ ...kyra(), golpes: [{ ...kyra().golpes[0]!, dados: '1d7' }] })).toBe(false);
  });
});

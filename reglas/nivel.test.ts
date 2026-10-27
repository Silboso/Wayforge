/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calcular, esPersonajeValido, personajeNuevo, type Personaje } from './pf2e';
import type { Indice } from './compendio';
import { aumentarAtributo, espaciosEn, faltaElegir, queTrae, subirNivel, type DatosClase } from './nivel';
import { cumple, grupoDe, sugerirAtributos, sugerirDotes, sugerirSkills } from './sugerencias';

const clases = existsSync('public/compendio/clases/0.json')
  ? JSON.parse(readFileSync('public/compendio/clases/0.json', 'utf8')) as Record<string, { datos: DatosClase }>
  : null;

const kyra: Personaje = {
  ...personajeNuevo('kyra'), nombre: 'Kyra', clase: 'Fighter', ascendencia: 'Human', nivel: 2,
  atributos: { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 }, pgAscendencia: 8, pgClase: 10, pgActual: 32,
  percepcion: 2, salvaciones: { fortitude: 2, reflex: 2, will: 1 }, habilidades: { ...personajeNuevo('x').habilidades, athletics: 1, intimidation: 1 },
  golpes: [{ id: 'espada', nombre: 'Longsword', atributo: 'str', rango: 2, bonoObjeto: 0, dados: '1d8', tipoDano: 'slashing', sumarFuerza: true, agil: false }],
  claseCD: { atributo: 'str', rango: 1 },
};

describe.skipIf(!clases)('subir de nivel con los datos de Foundry', () => {
  it('Fighter 3: PG, Bravery (Will a Expert), dote general y una skill', () => {
    const trae = queTrae(kyra, clases!.fighter!.datos);
    expect(trae).toMatchObject({ nivel: 3, pg: 12, dotes: ['general'], mejoraSkill: true, mejorasAtributo: false });
    expect(trae.sube).toEqual([{ que: 'will', rango: 2 }]);
    expect(trae.rasgos.map((r) => r.nombre)).toContain('Bravery');
    expect(faltaElegir(trae, { atributos: [], skill: null, dotes: {}, conjuros: [] })).toHaveLength(2);
    const p = subirNivel(kyra, trae, { atributos: [], skill: 'athletics', dotes: { general: { id: 'toughness', nombre: 'Toughness', categoria: 'general', nivel: 1, aptitud: null } }, conjuros: [] });
    expect(esPersonajeValido(p)).toBe(true);
    expect(p).toMatchObject({ nivel: 3, pgActual: 44, salvaciones: { will: 2 }, habilidades: { athletics: 2 } });
    expect(calcular(p).pgMax.total).toBe(8 + 30 + 6);
    expect(p.dotes).toEqual([{ id: 'toughness', nombre: 'Toughness', tipo: 'general', nivel: 1 }]);
  });

  it('nivel 5: cuatro atributos (los de +4 cuentan la mitad), maestría con armas, y la Con sube todos los PG', () => {
    const k4 = { ...kyra, nivel: 4, pgActual: 56 };
    const trae = queTrae(k4, clases!.fighter!.datos);
    expect(trae.mejorasAtributo).toBe(true);
    expect(trae.sube).toContainEqual({ que: 'armas', rango: 3 });
    const p = subirNivel(k4, trae, { atributos: ['str', 'con', 'dex', 'wis'], skill: 'athletics', dotes: {}, conjuros: [] });
    expect(p.atributos).toMatchObject({ str: 4, con: 3, dex: 3, wis: 2 });
    expect(p.parciales).toEqual(['str']);
    expect(p.golpes[0]!.rango).toBe(3);
    // 10 de clase + Con 3 + 1 extra por cada uno de los 4 niveles anteriores
    expect(p.pgActual).toBe(56 + 13 + 4);
    expect(subirNivel({ ...p, nivel: 9 }, { ...queTrae({ ...p, nivel: 9 }, clases!.fighter!.datos), mejorasAtributo: true }, { atributos: ['str'], skill: null, dotes: {}, conjuros: [] }).atributos.str).toBe(5);
  });

  it('un mago gana espacios y rango de conjuros', () => {
    const ezren: Personaje = { ...kyra, id: 'ezren', clase: 'Wizard', nivel: 6, lanzador: { tradicion: 'arcane', atributo: 'int', rango: 1 },
      recursos: { foco: { max: 1, actual: 1 }, espacios: espaciosEn(6, 'wizard', 1).map((e) => ({ ...e, usados: 1 })), usos: {} } };
    const trae = queTrae(ezren, clases!.wizard!.datos);
    expect(trae.sube).toContainEqual({ que: 'conjuros', rango: 2 });
    expect(trae.conjuros).toMatchObject({ rangoMax: 4, aprender: 2 });
    const p = subirNivel(ezren, trae, { atributos: [], skill: null, dotes: {}, conjuros: [] });
    expect(p.lanzador!.rango).toBe(2);
    expect(p.recursos!.espacios.at(-1)).toEqual({ rango: 4, max: 3, usados: 0 });
  });
});

describe('reglas sueltas', () => {
  it('los espacios: 3 por rango, 2 en el rango recién ganado, 4 para el sorcerer', () => {
    expect(espaciosEn(1, 'cleric', 0)).toEqual([{ rango: 1, max: 2 }]);
    expect(espaciosEn(4, 'cleric', 0)).toEqual([{ rango: 1, max: 3 }, { rango: 2, max: 3 }]);
    expect(espaciosEn(5, 'sorcerer', 0).at(-1)).toEqual({ rango: 3, max: 3 });
    expect(espaciosEn(20, 'wizard', 1).at(-1)).toEqual({ rango: 10, max: 1 });
  });

  it('un aumento sube 1 hasta +4; desde ahí, cada dos', () => {
    expect(aumentarAtributo(3, false)).toEqual({ valor: 4, parcial: false });
    expect(aumentarAtributo(4, false)).toEqual({ valor: 4, parcial: true });
    expect(aumentarAtributo(4, true)).toEqual({ valor: 5, parcial: false });
  });

  it('lee los requisitos de una dote', () => {
    expect(cumple(kyra, 'trained in Athletics').ok).toBe(true);
    expect(cumple(kyra, 'expert in Athletics')).toEqual({ ok: false, falta: 'necesitas expert en Athletics' });
    expect(cumple(kyra, 'Power Attack')).toEqual({ ok: false, falta: 'necesitas la dote Power Attack' });
    expect(cumple({ ...kyra, dotes: [{ id: 'power-attack', nombre: 'Power Attack', tipo: 'class', nivel: 1 }] }, 'Power Attack').ok).toBe(true);
    expect(cumple(kyra, 'you worship a deity of fire').ok).toBe(null);
  });

  it('sugiere con razones: la dote de su mejor skill primero, las que no cumple al final', () => {
    const indice: Indice[] = [
      { id: 'quick-jump', nombre: 'Quick Jump', nivel: 1, rasgos: ['general', 'skill'], rareza: 'common', fuente: 'Pathfinder Player Core', resumen: 'skill', trozo: 0, requisitos: ['trained in Athletics'] },
      { id: 'cat-fall', nombre: 'Cat Fall', nivel: 1, rasgos: ['general', 'skill'], rareza: 'common', fuente: 'Pathfinder Player Core', resumen: 'skill', trozo: 0, requisitos: ['trained in Acrobatics'] },
      { id: 'battle-medicine', nombre: 'Battle Medicine', nivel: 1, rasgos: ['general', 'healing', 'skill'], rareza: 'common', fuente: 'Pathfinder Player Core', resumen: 'skill', trozo: 0, requisitos: ['trained in Medicine'] },
    ];
    const grupo = grupoDe(kyra, []);
    const s = sugerirDotes(kyra, 'skill', 2, indice, grupo);
    expect(s[0]!.item.id).toBe('quick-jump');
    expect(s[0]!.razones).toContain('Usa tu mejor skill (Athletics)');
    expect(s.at(-1)!.falta).toMatch(/necesitas trained/);
    expect(sugerirAtributos(kyra, ['str'])[0]!.item).toBe('str');
    expect(sugerirSkills(kyra, 3, grupo)[0]!.item).toBe('athletics');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EntradaCompendio, Indice, TipoCompendio } from './compendio';
import { buscadorDe, desdePathbuilder, leerPathbuilder, type BuildPathbuilder } from './pathbuilder';
import { calcular, esPersonajeValido } from './pf2e';

// El compendio de verdad, leído de public/compendio como lo pide el navegador (las pruebas corren desde la raíz)
const leer = (ruta: string) => JSON.parse(readFileSync(`public/compendio/${ruta}`, 'utf8'));
const indice = async (tipo: TipoCompendio) => leer(`${tipo}/indice.json`) as Indice[];
const entrada = async (tipo: TipoCompendio, id: string) => {
  const fila = (await indice(tipo)).find((x) => x.id === id);
  return fila ? ((leer(`${tipo}/${fila.trozo}.json`) as Record<string, EntradaCompendio>)[id] ?? null) : null;
};
const buscar = buscadorDe(indice, entrada);

const ceros = Object.fromEntries(['acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine', 'nature',
  'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery', 'castingArcane', 'castingDivine', 'castingOccult', 'castingPrimal'].map((k) => [k, 0]));

// Como lo devuelve json.php
const valeros = {
  success: true,
  build: {
    name: 'Valeros', class: 'Fighter', dualClass: null, level: 3, ancestry: 'Human', heritage: 'Skilled Human', background: 'Warrior',
    deity: 'Not set', keyability: 'str', languages: ['Common', 'Dwarven'],
    attributes: { ancestryhp: 8, classhp: 10, bonushp: 0, bonushpPerLevel: 1, speed: 25, speedBonus: 0 },
    abilities: { str: 18, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
    proficiencies: {
      ...ceros, classDC: 2, perception: 4, fortitude: 4, reflex: 4, will: 2, heavy: 2, medium: 2, light: 2, unarmored: 2,
      advanced: 2, martial: 4, simple: 4, unarmed: 4, athletics: 4, intimidation: 2, acrobatics: 2, survival: 2,
    },
    feats: [
      ['Reactive Strike', null, 'Class Feat', 1], ['Sudden Charge', null, 'Class Feat', 2], ['Toughness', null, 'General Feat', 3],
      ['Shield Block', null, 'Awarded Feat', 1], ['Assurance', 'Athletics', 'Skill Feat', 2], ['Totally Made Up Feat', null, 'Ancestry Feat', 1],
    ],
    specials: ['Reactive Strike', 'Shield Block', 'Bravery'],
    lores: [['Warfare', 2]],
    equipment: [['Steel Shield', 1], ['Healing Potion (Minor)', 2], ['Torch', 5]],
    weapons: [
      { name: 'Longsword', qty: 1, prof: 'martial', die: 'd8', pot: 1, str: '', display: '+1 Longsword', runes: [], damageType: 'S', attack: 12, damageBonus: 4 },
      { name: 'Composite Shortbow', qty: 1, prof: 'martial', die: 'd6', pot: 0, str: 'striking', display: 'Striking Composite Shortbow', runes: [], damageType: 'P', attack: 9, damageBonus: 2 },
    ],
    armor: [{ name: 'Chain Mail', qty: 1, prof: 'medium', pot: 0, worn: true }],
    money: { pp: 1, gp: 12, sp: 5, cp: 3 },
    spellCasters: [], focusPoints: 0, focus: {},
    acTotal: { acProfBonus: 5, acAbilityBonus: 1, acItemBonus: 4, acTotal: 20, shieldBonus: '2' },
  },
};

const kyra = {
  name: 'Kyra', class: 'Cleric', level: 1, ancestry: 'Dwarf', heritage: 'Ancient-Blooded Dwarf', background: 'Acolyte', keyability: 'wis',
  attributes: { ancestryhp: 10, classhp: 8, bonushp: 0, bonushpPerLevel: 0, speed: 20, speedBonus: 0 },
  abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 18, cha: 12 },
  proficiencies: { ...ceros, classDC: 2, perception: 2, fortitude: 2, reflex: 2, will: 4, light: 0, unarmored: 2, simple: 2, unarmed: 2, castingDivine: 2, religion: 2, medicine: 2 },
  feats: [['Ancient-Blooded Dwarf', null, 'Heritage', 1]],
  weapons: [], armor: [],
  spellCasters: [{
    name: 'Cleric', magicTradition: 'divine', spellcastingType: 'prepared', ability: 'wis', proficiency: 2, innate: false,
    perDay: [5, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    spells: [{ spellLevel: 0, list: ['Shield', 'Light'] }, { spellLevel: 1, list: ['Heal', 'Bless'] }],
    prepared: [{ spellLevel: 0, list: ['Shield'] }, { spellLevel: 1, list: ['Heal', 'Heal'] }],
  }],
  focusPoints: 1,
  focus: { divine: { wis: { focusCantrips: [], focusSpells: ['Lay on Hands'] } } },
  acTotal: { acTotal: 14 },
};

describe('importar de Pathbuilder 2e', () => {
  it('reconoce el JSON de json.php o el build solo, y rechaza lo demás', () => {
    expect(leerPathbuilder(JSON.stringify(valeros))?.name).toBe('Valeros');
    expect(leerPathbuilder(JSON.stringify(kyra))?.class).toBe('Cleric');
    expect(leerPathbuilder('{"name":"x"}')).toBeNull();
    expect(leerPathbuilder('no es json')).toBeNull();
  });

  it('un guerrero: números, golpes con runas, armadura, escudo, dotes y lo que no cuadra', async () => {
    const { personaje: p, avisos, sinEncontrar } = await desdePathbuilder(leerPathbuilder(JSON.stringify(valeros))!, 'valeros', buscar);
    expect(esPersonajeValido(p)).toBe(true);
    expect(p.ascendencia).toBe('Human (Skilled Human)');
    expect(p.atributos).toEqual({ str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 });
    const ficha = calcular(p);
    // 8 + (10 + 1 de Toughness + 2 de Con) × 3
    expect(ficha.pgMax.total).toBe(47);
    expect(ficha.ca.total).toBe(20);
    expect(ficha.percepcion.total).toBe(1 + 4 + 3);
    expect(p.habilidades.athletics).toBe(2);
    // El ataque es el mismo que en Pathbuilder
    expect(ficha.golpes.map((g) => g.ataque.total)).toEqual([12, 9]);
    expect(p.golpes[0]).toMatchObject({ nombre: '+1 Longsword', atributo: 'str', rango: 2, bonoObjeto: 1, dados: '1d8', tipoDano: 'slashing', sumarFuerza: true });
    expect(p.golpes[1]).toMatchObject({ atributo: 'dex', dados: '2d6', sumarFuerza: false, distancia: 60 });
    // Propulsive suma media Fuerza en Pathbuilder y aquí no: se avisa
    expect(avisos.some((a) => a.includes('Striking Composite Shortbow'))).toBe(true);
    expect(p.escudo).toMatchObject({ nombre: 'Steel Shield', ca: 2, dureza: 5 });
    expect(p.dotes?.map((d) => d.nombre)).toContain('Assurance (Athletics)');
    expect(p.dotes?.find((d) => d.nombre === 'Toughness')).toMatchObject({ id: 'toughness', tipo: 'general', nivel: 3 });
    // Las dotes que se usan llegan como acción (Reactive Strike es una reacción)
    expect(p.aptitudes?.find((a) => a.nombre === 'Reactive Strike')?.costo).toBe('reaccion');
    expect(p.aptitudes?.filter((a) => a.nombre === 'Reactive Strike')).toHaveLength(1);
    expect(sinEncontrar).toEqual(['Totally Made Up Feat']);
    expect(p.saberes).toEqual(['Warfare Lore']);
    expect(p.monedas).toEqual({ oro: 22, plata: 5, cobre: 3 });
    expect(p.claseCD).toEqual({ atributo: 'str', rango: 1 });
    expect(p.origen).toMatchObject({ clase: 'fighter', ascendencia: 'human', herencia: 'skilled-human' });
    expect(p.inventario?.find((x) => x.nombre === 'Healing Potion (Minor)')?.cantidad).toBe(2);
  });

  it('una clériga: conjuros preparados, espacios, foco, herencia y darkvision', async () => {
    const { personaje: p, avisos } = await desdePathbuilder(kyra as unknown as BuildPathbuilder, 'kyra', buscar);
    expect(esPersonajeValido(p)).toBe(true);
    expect(p.ascendencia).toBe('Dwarf (Ancient-Blooded Dwarf)');
    expect(p.sentidos).toBe('Darkvision');
    expect(p.lanzador).toEqual({ tradicion: 'divine', atributo: 'wis', rango: 1 });
    expect(p.recursos?.espacios).toEqual([{ rango: 1, max: 2, usados: 0 }]);
    expect(p.recursos?.foco).toEqual({ max: 1, actual: 1 });
    const nombres = p.aptitudes?.map((a) => a.nombre) ?? [];
    // Lo preparado, no todo lo que sabe; Heal dos veces es una sola acción
    expect(nombres.filter((n) => n === 'Heal')).toHaveLength(1);
    expect(nombres).toContain('Shield');
    expect(nombres).not.toContain('Bless');
    expect(p.aptitudes?.find((a) => a.nombre === 'Lay on Hands')?.recuperacion).toEqual({ tipo: 'foco' });
    // Sin armas: el puño
    expect(p.golpes).toMatchObject([{ nombre: 'Fist', dados: '1d4', agil: true }]);
    expect(calcular(p).ca.total).toBe(14);
    expect(avisos).toEqual([]);
  });

  it('un conjuro preparado en un rango más alto gasta ese espacio', async () => {
    const alto = { ...kyra, level: 5, spellCasters: [{ ...kyra.spellCasters[0]!, perDay: [5, 3, 3, 2], prepared: [{ spellLevel: 3, list: ['Heal'] }] }] };
    const { personaje: p } = await desdePathbuilder(alto as unknown as BuildPathbuilder, 'k', buscar);
    expect(p.aptitudes?.find((a) => a.nombre === 'Heal (rango 3)')?.recuperacion).toEqual({ tipo: 'espacio', rango: 3 });
    expect(p.recursos?.espacios.map((e) => e.max)).toEqual([3, 3, 2]);
  });
});

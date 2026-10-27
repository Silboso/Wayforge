import { describe, expect, it } from 'vitest';
import { calcular, esPersonajeValido, leerExpresion, type Atributo } from './pf2e';
import { ASCENDENCIAS } from './datos/ascendencias';
import { TRASFONDOS } from './datos/trasfondos';
import { CLASES } from './datos/clases';
import { DOTES, doteDe } from './datos/dotes';
import { CONJUROS } from './datos/conjuros';
import { ARMAS } from './datos/equipo';
import {
  atributosDe, conjurosAElegir, conjurosDisponibles, construir, ELECCION_VACIA, gastoDe, habilidadesAElegir, pendientes, type Eleccion,
} from './creador';

const unicos = (ids: string[]) => new Set(ids).size === ids.length;

describe('la base de datos', () => {
  it('no repite ids', () => {
    expect(unicos(ASCENDENCIAS.map((x) => x.id))).toBe(true);
    expect(unicos(TRASFONDOS.map((x) => x.id))).toBe(true);
    expect(unicos(CLASES.map((x) => x.id))).toBe(true);
    expect(unicos(DOTES.map((x) => x.id))).toBe(true);
    expect(unicos(CONJUROS.map((x) => x.id))).toBe(true);
    expect(unicos(ARMAS.map((x) => x.id))).toBe(true);
  });

  it('cada trasfondo regala una dote que existe', () => {
    for (const t of TRASFONDOS) expect(doteDe(t.dote), t.id).toBeDefined();
  });

  it('cada ascendencia y clase tiene dotes de nivel 1 para elegir', () => {
    for (const a of ASCENDENCIAS) expect(DOTES.filter((d) => d.de === a.id).length, a.id).toBeGreaterThanOrEqual(3);
    for (const c of CLASES) expect(DOTES.filter((d) => d.de === c.id).length, c.id).toBeGreaterThanOrEqual(3);
  });

  it('los daños de los conjuros se pueden tirar', () => {
    for (const x of CONJUROS) if (x.dano) expect(leerExpresion(x.dano), x.id).not.toBeNull();
  });

  it('cada tradición tiene trucos y conjuros de rango 1 de sobra', () => {
    for (const t of ['arcane', 'divine', 'occult', 'primal'] as const) {
      expect(CONJUROS.filter((x) => x.rango === 0 && x.tradiciones.includes(t)).length, t).toBeGreaterThanOrEqual(5);
      expect(CONJUROS.filter((x) => x.rango === 1 && x.tradiciones.includes(t)).length, t).toBeGreaterThanOrEqual(4);
    }
  });
});

// Una elección completa y razonable para cualquier clase (para probar que todo combina)
function completa(ascendencia: string, clase: string): Eleccion {
  const c = CLASES.find((x) => x.id === clase)!;
  const a = ASCENDENCIAS.find((x) => x.id === ascendencia)!;
  const clave = c.atributoClave[0]!;
  const otros = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as Atributo[]).filter((x) => x !== clave);
  let e: Eleccion = {
    ...ELECCION_VACIA,
    ascendencia, herencia: a.herencias[0]!.id,
    mejorasAscendencia: a.mejoras.filter((m) => m === 'libre').map((_, i) => (['str', 'dex', 'con', 'int', 'wis', 'cha'] as Atributo[]).filter((x) => !a.mejoras.includes(x))[i]!),
    trasfondo: 'warrior', mejorasTrasfondo: ['con', clave === 'con' ? 'str' : clave],
    clase, subclase: c.subclase?.opciones[0]!.id ?? null, atributoClave: clave,
    mejorasLibres: [clave, ...otros.slice(0, 3)],
    doteAscendencia: DOTES.find((d) => d.de === ascendencia && d.id !== 'general-training' && d.id !== 'natural-skill')!.id,
    doteClase: DOTES.find((d) => d.de === clase)?.id ?? null,
    armas: ['dagger'],
    armadura: 'none',
  };
  if (a.herencias[0]!.id === 'versatile') e = { ...e, doteGeneral: 'toughness' };
  const libres = habilidadesAElegir(e);
  const candidatas = ['acrobatics', 'athletics', 'arcana', 'crafting', 'deception', 'diplomacy', 'medicine', 'nature', 'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery', 'intimidation'] as const;
  e = { ...e, habilidades: candidatas.filter((h) => !['intimidation', ...c.habilidadesFijas].includes(h)).slice(0, libres) };
  const pide = conjurosAElegir(e);
  e = { ...e, trucos: conjurosDisponibles(e, 0).slice(0, pide.trucos).map((x) => x.id), conjuros: conjurosDisponibles(e, 1).slice(0, pide.rango1).map((x) => x.id) };
  return e;
}

describe('el creador', () => {
  it('un Dwarf Fighter con Longsword y Chain Mail sale con los números del libro', () => {
    const e: Eleccion = {
      ...completa('dwarf', 'fighter'),
      mejorasAscendencia: ['str'], mejorasTrasfondo: ['str', 'con'], atributoClave: 'str', mejorasLibres: ['str', 'dex', 'con', 'wis'],
      armas: ['longsword'], armadura: 'chain-mail', escudo: 'wooden-shield',
    };
    const attr = atributosDe(e);
    // Dwarf: Con, Wis, libre (Str), defecto Cha; Warrior: Str, Con; clave Str; libres Str, Dex, Con, Wis
    expect(attr).toEqual({ str: 4, dex: 1, con: 3, int: 0, wis: 2, cha: -1 });
    const p = construir(e, { id: 'k', nombre: 'Kyra' });
    expect(esPersonajeValido(p)).toBe(true);
    const f = calcular(p);
    expect(f.pgMax.total).toBe(10 + 10 + 3);
    // 10 + Dex 1 (tope 1) + Trained 3 + armadura 4
    expect(f.ca.total).toBe(18);
    // Str 4 + Expert (4 + 1)
    expect(f.golpes[0]!.ataque.total).toBe(9);
    expect(f.golpes[0]!.dano).toBe('1d8+4 slashing');
    expect(f.percepcion.total).toBe(2 + 5);
    // Chain Mail frena 5 ft, pero con la Fuerza que pide (Str 3) no frena: Dwarf sigue en 20
    expect(p.velocidad).toBe(20);
    // Con menos Fuerza, sí frena
    expect(construir({ ...e, mejorasLibres: ['dex', 'int', 'con', 'wis'], mejorasTrasfondo: ['wis', 'con'] }, { id: 'k', nombre: 'K' }).velocidad).toBe(15);
    expect(p.aptitudes!.some((a) => a.nombre === 'Reactive Strike')).toBe(true);
    expect(p.idiomas).toContain('Dwarven');
    expect(p.escudo?.dureza).toBe(3);
    expect(pendientes(e)).toEqual([]);
  });

  it('todas las clases con todas las ascendencias dan una ficha válida', () => {
    for (const a of ASCENDENCIAS) {
      for (const c of CLASES) {
        const e = completa(a.id, c.id);
        const p = construir(e, { id: `${a.id}-${c.id}`, nombre: 'Prueba' });
        expect(esPersonajeValido(p), `${a.id} ${c.id}`).toBe(true);
        expect(pendientes(e).filter((x) => x.paso !== 'habilidades'), `${a.id} ${c.id}`).toEqual([]);
      }
    }
  });

  it('el mago lanza conjuros arcanos con Int y tiene su espacio extra de escuela', () => {
    const e = completa('elf', 'wizard');
    const p = construir(e, { id: 'e', nombre: 'Ezren' });
    expect(p.lanzador).toEqual({ tradicion: 'arcane', atributo: 'int', rango: 1 });
    expect(p.recursos!.espacios).toEqual([{ rango: 1, max: 3, usados: 0 }]);
    expect(p.aptitudes!.filter((a) => a.categoria === 'truco')).toHaveLength(5);
    expect(calcular(p).conjuros!.cd.total).toBe(10 + atributosDe(e).int + 3);
  });

  it('la tradición del sorcerer sale de su linaje', () => {
    const e = { ...completa('human', 'sorcerer'), subclase: 'angelic' };
    expect(conjurosDisponibles(e, 0).every((x) => x.tradiciones.includes('divine'))).toBe(true);
  });

  it('una skill repetida entre trasfondo y clase deja elegir otra', () => {
    const base = completa('human', 'rogue');
    const sinRepetir = habilidadesAElegir({ ...base, trasfondo: 'acrobat' });
    const repetida = habilidadesAElegir({ ...base, trasfondo: 'criminal' });
    expect(repetida).toBe(sinRepetir + 1);
  });

  it('no se puede gastar más de 15 po, y la daga del clan es gratis para los enanos', () => {
    const e = { ...completa('dwarf', 'fighter'), armas: ['clan-dagger'], armadura: 'full-plate' };
    expect(gastoDe(e)).toBe(300);
    expect(pendientes(e).some((x) => x.paso === 'equipo')).toBe(true);
    expect(gastoDe({ ...e, armadura: 'none' })).toBe(0);
  });

  it('lo elegido del compendio llena el hueco y llega a la ficha', () => {
    const base = completa('elf', 'wizard');
    const truco = CONJUROS.find((x) => x.id === base.trucos[0])!;
    const e: Eleccion = {
      ...base,
      doteClase: null,
      trucos: base.trucos.slice(1),
      delCompendio: [
        { ranura: 'clase', id: 'reach-spell', nombre: 'Reach Spell', categoria: 'class', nivel: 1, aptitud: null },
        { ranura: 'truco', id: 'ancient-dust', nombre: 'Ancient Dust', categoria: 'conjuro', nivel: 1,
          aptitud: { id: 'compendio:conjuro:ancient-dust', nombre: 'Ancient Dust', verbo: 'Ancient Dust', categoria: 'truco', costo: 2, recuperacion: { tipo: 'siempre' }, descripcion: 'Polvo.', rasgos: ['cantrip'] } },
      ],
    };
    expect(pendientes(e)).toEqual([]);
    expect(pendientes({ ...e, delCompendio: [] }).map((x) => x.paso)).toEqual(['dotes', 'conjuros']);
    const p = construir(e, { id: 'e', nombre: 'Ezren' });
    expect(esPersonajeValido(p)).toBe(true);
    expect(p.dotes!.some((d) => d.id === 'reach-spell' && d.tipo === 'class')).toBe(true);
    expect(p.aptitudes!.some((a) => a.id === 'compendio:conjuro:ancient-dust')).toBe(true);
    expect(p.aptitudes!.some((a) => a.nombre === truco.nombre)).toBe(false);
  });

  it('pide lo que falta, paso por paso', () => {
    const faltas = pendientes(ELECCION_VACIA).map((x) => x.paso);
    expect(faltas).toContain('ascendencia');
    expect(faltas).toContain('clase');
    expect(faltas).toContain('atributos');
  });
});

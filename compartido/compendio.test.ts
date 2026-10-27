/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  conjuroAAptitud, criaturaDeCompendio, doteAAptitud, type ConjuroCompendio, type CriaturaCompendio, type DoteCompendio,
} from '../reglas/compendio';
import { esAptitudValida } from '../reglas/aptitudes';
import { HABILIDADES, leerExpresion } from '../reglas/pf2e';
import { esAccionValida, estadoInicial, type Token } from './sala';

// Todo el compendio importado (si está generado): cada entrada tiene que poder entrar a la mesa
const dir = 'public/compendio';
const todas = <T,>(tipo: string): T[] => {
  if (!existsSync(`${dir}/${tipo}`)) return [];
  return readdirSync(`${dir}/${tipo}`).filter((f) => /^\d+\.json$/.test(f))
    .flatMap((f) => Object.values(JSON.parse(readFileSync(`${dir}/${tipo}/${f}`, 'utf8')) as Record<string, T>));
};
const aptitudValida = (a: unknown) => esAptitudValida(a, (c) => HABILIDADES.some((h) => h.clave === c), (e) => leerExpresion(e) !== null);

describe.skipIf(!existsSync(dir))('el compendio importado', () => {
  it('cada criatura se puede poner en el tablero', () => {
    const criaturas = todas<CriaturaCompendio>('criaturas');
    expect(criaturas.length).toBeGreaterThan(1000);
    const malas: string[] = [];
    for (const c of criaturas) {
      const d = criaturaDeCompendio(c);
      const token: Token = { id: 't', nombre: c.nombre.slice(0, 60), tipo: 'enemigo', tamano: d.tamano, x: 0, y: 0, color: '#c8392b', ca: d.ca, pg: { actual: d.pg, max: d.pg }, percepcion: d.percepcion, criatura: d.criatura };
      if (!esAccionValida({ tipo: 'crear-token', token }, estadoInicial())) malas.push(c.id);
    }
    expect(malas.slice(0, 10)).toEqual([]);
  });

  it('cada conjuro se puede agregar a una ficha', () => {
    const conjuros = todas<ConjuroCompendio>('conjuros');
    expect(conjuros.length).toBeGreaterThan(1000);
    const malos = conjuros.filter((c) => !aptitudValida(conjuroAAptitud(c))).map((c) => c.id);
    expect(malos.slice(0, 10)).toEqual([]);
  });

  it('cada dote con acciones se puede agregar a una ficha', () => {
    const dotes = todas<DoteCompendio>('dotes');
    expect(dotes.length).toBeGreaterThan(1000);
    const malas = dotes.map((d) => [d.id, doteAAptitud(d)] as const).filter(([, a]) => a && !aptitudValida(a)).map(([id]) => id);
    expect(malas.slice(0, 10)).toEqual([]);
  });

  it('Fireball llega con sus números', () => {
    const fireball = todas<ConjuroCompendio>('conjuros').find((c) => c.id === 'fireball')!;
    const a = conjuroAAptitud(fireball);
    expect(a).toMatchObject({ categoria: 'conjuro', costo: 2, recuperacion: { tipo: 'espacio', rango: 3 }, dano: '6d6', distancia: 500 });
  });
});

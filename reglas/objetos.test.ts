import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EquipoCompendio, Indice } from './compendio';
import { disponibilidad, usar } from './aptitudes';
import {
  agregarObjeto, bultoDe, cambiarCantidad, cargado, comprarObjeto, consumibleDeCompendio, golpeDeBomba, objetoDeCompendio, pagar,
  rangoBombas, textoPrecio, venderObjeto,
} from './objetos';
import { calcular, personajeNuevo, type Personaje } from './pf2e';
import { aplicar, estadoInicial, velocidadDe } from '../compartido/sala';

// Del compendio de verdad (las pruebas corren desde la raíz)
function equipo(id: string): EquipoCompendio {
  const indice = JSON.parse(readFileSync('public/compendio/equipo/indice.json', 'utf8')) as Indice[];
  const fila = indice.find((x) => x.id === id)!;
  return JSON.parse(readFileSync(`public/compendio/equipo/${fila.trozo}.json`, 'utf8'))[id];
}

const kyra = (): Personaje => ({
  ...personajeNuevo('kyra'), nombre: 'Kyra', clase: 'Fighter', atributos: { str: 2, dex: 3, con: 1, int: 0, wis: 0, cha: 0 },
  golpes: [{ id: 'g', nombre: 'Longsword', atributo: 'str', rango: 2, bonoObjeto: 0, dados: '1d8', tipoDano: 'slashing', sumarFuerza: true, agil: false }],
  monedas: { oro: 15, plata: 0, cobre: 0 },
});

describe('monedas', () => {
  it('paga rompiendo monedas solo si hace falta, y dice el precio en po/pp/pc', () => {
    expect(pagar({ oro: 15, plata: 0, cobre: 0 }, 4)).toEqual({ oro: 14, plata: 6, cobre: 0 });
    expect(pagar({ oro: 1, plata: 3, cobre: 5 }, 0.5)).toEqual({ oro: 1, plata: 3, cobre: 0 });
    expect(pagar({ oro: 0, plata: 2, cobre: 0 }, 4)).toBeNull();
    expect(textoPrecio(40)).toBe('4 po');
    expect(textoPrecio(15)).toBe('1 po 5 pp');
    expect(textoPrecio(0.3)).toBe('3 pc');
  });
});

describe('Bulk', () => {
  it('lo ligero cuenta de a 10, las monedas de a 1000; pasar 5 + Str es Encumbered', () => {
    const p = { ...kyra(), inventario: [
      { id: 'a', nombre: 'Chain Mail', cantidad: 1, bulto: 2 },
      { id: 'b', nombre: 'Torch', cantidad: 12, bulto: 0.1 },
      { id: 'c', nombre: 'Anillo', cantidad: 1, bulto: 0 },
    ], monedas: { oro: 1500, plata: 0, cobre: 0 } };
    expect(bultoDe(p)).toEqual({ total: 2 + 1 + 1, ligeros: 2 });
    expect(cargado(p)).toBe(false);
    const pesado = { ...p, inventario: [...p.inventario!, { id: 'd', nombre: 'Yunque', cantidad: 1, bulto: 4 }] };
    expect(cargado(pesado)).toBe(true);
    // Clumsy 1 en lo que usa Dex, y −10 ft al moverse
    expect(calcular(pesado).ca.total).toBe(calcular(p).ca.total - 1);
    let e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: pesado, x: 2, y: 2 });
    expect(velocidadDe(e, e.tokens.kyra!)).toBe(15);
    e = aplicar(e, { tipo: 'editar-personaje', id: 'kyra', cambios: { inventario: p.inventario } });
    expect(velocidadDe(e, e.tokens.kyra!)).toBe(25);
  });
});

describe('consumibles conectados a la mochila', () => {
  it('una poción cura a quien la bebe; una bomba es un Strike con su daño', () => {
    const pocion = consumibleDeCompendio(equipo('healing-potion-minor'))!;
    expect(pocion).toMatchObject({ verbo: 'Beber poción', costo: 1, categoria: 'objeto', interaccion: { objetivos: { tipo: 'yo' }, curacion: '1d8' } });
    const bomba = consumibleDeCompendio(equipo('alchemist-s-fire-lesser'))!;
    expect(bomba).toMatchObject({ verbo: 'Lanzar bomba', distancia: 20, interaccion: { modo: { tipo: 'ataque' }, dano: { formula: '1d8', tipo: 'fire' } } });
    expect(consumibleDeCompendio(equipo('arrows'))).toBeNull();
    // El guerrero es Expert en marciales: la bomba usa Dex + Expert
    const p = kyra();
    expect(rangoBombas(p)).toBe(2);
    expect(calcular({ ...p, golpes: [golpeDeBomba(p, bomba)] }).golpes[0]!.ataque.total).toBe(3 + 4 + 1);
  });

  it('agregar, usar y quitar: la mochila y la acción llevan la misma cuenta', () => {
    const e = equipo('healing-potion-minor');
    let p = kyra();
    p = { ...p, ...agregarObjeto(p, objetoDeCompendio(e), consumibleDeCompendio(e), 2) };
    p = { ...p, ...agregarObjeto(p, objetoDeCompendio(e), consumibleDeCompendio(e)) };
    expect(p.inventario).toEqual([{ id: 'compendio:healing-potion-minor', nombre: 'Healing Potion (Minor)', cantidad: 3, bulto: 0.1, precio: 40, aptitudId: 'objeto:healing-potion-minor' }]);
    const accion = () => p.aptitudes!.find((a) => a.id === 'objeto:healing-potion-minor');
    expect(disponibilidad(p, accion()!).texto).toBe('quedan 3');
    p = { ...p, ...usar(p, 'objeto:healing-potion-minor')! };
    expect(p.inventario![0]!.cantidad).toBe(2);
    expect(accion()!.recuperacion).toEqual({ tipo: 'consumible', cantidad: 2 });
    p = { ...p, ...cambiarCantidad(p, 0, 1) };
    expect(accion()!.recuperacion).toEqual({ tipo: 'consumible', cantidad: 1 });
    // La última: se va de la mochila y de la hoja
    p = { ...p, ...usar(p, 'objeto:healing-potion-minor')! };
    expect(p.inventario).toEqual([]);
    expect(accion()).toBeUndefined();
  });

  it('comprar paga con sus monedas; vender devuelve la mitad', () => {
    const e = equipo('healing-potion-minor');
    let p = kyra();
    p = { ...p, ...comprarObjeto(p, objetoDeCompendio(e), consumibleDeCompendio(e), e.precio)! };
    expect(p.monedas).toEqual({ oro: 11, plata: 0, cobre: 0 });
    expect(comprarObjeto({ ...p, monedas: { oro: 1, plata: 0, cobre: 0 } }, objetoDeCompendio(e), null, e.precio)).toBeNull();
    p = { ...p, ...venderObjeto(p, 0) };
    expect(p.monedas).toEqual({ oro: 13, plata: 0, cobre: 0 });
    expect(p.inventario).toEqual([]);
    expect(p.aptitudes?.some((a) => a.id === 'objeto:healing-potion-minor')).toBe(false);
  });

  it('en la mesa: usar la poción la descuenta de la mochila', () => {
    const e = equipo('healing-potion-minor');
    const p = kyra();
    let s = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: { ...p, ...agregarObjeto(p, objetoDeCompendio(e), consumibleDeCompendio(e), 2) }, x: 2, y: 2 });
    s = aplicar(s, { tipo: 'usar-aptitud', personajeId: 'kyra', aptitudId: 'objeto:healing-potion-minor' });
    expect(s.personajes.kyra!.inventario![0]!.cantidad).toBe(1);
  });
});

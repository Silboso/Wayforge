import { describe, expect, it } from 'vitest';
import { personajeNuevo } from '../reglas/pf2e';
import { aMascara, alLadoDe, casillasVisibles, cruzaMuro, deMascara, explorar, habitacion, vistaJugadores, type Muro } from './vision';
import { aplicar, esAccionValida, estadoInicial, planMovimiento, type EstadoSala, type Token } from './sala';

let n = 0;
const id = () => `m${n++}`;
const goblin = (tid: string, x: number, y: number): Token => ({ id: tid, nombre: tid, tipo: 'enemigo', tamano: 'Small', x, y, color: '#c8392b', pg: { actual: 10, max: 10 } });

// Una habitación de (6,2) a (12,8) con su puerta abajo en x 9–10; Kyra afuera, en (9,10); un goblin adentro
function mesa(): EstadoSala {
  let e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: { ...personajeNuevo('kyra'), nombre: 'Kyra' }, x: 9, y: 10 });
  e = aplicar(e, { tipo: 'crear-token', token: goblin('goblin', 8, 4) });
  e = aplicar(e, { tipo: 'crear-token', token: goblin('afuera', 15, 10) });
  return aplicar(e, { tipo: 'editar-mapa', cambios: { muros: habitacion({ x: 6, y: 2 }, { x: 12, y: 8 }, id) } });
}
const puerta = (e: EstadoSala) => e.mapa.muros!.find((m) => m.tipo === 'puerta')!;

describe('muros y puertas', () => {
  it('una habitación son cuatro muros con una puerta cerrada en el medio de abajo', () => {
    const muros = habitacion({ x: 6, y: 2 }, { x: 12, y: 8 }, id);
    // Tres lados enteros y el de abajo partido en dos alrededor de la puerta
    expect(muros.filter((m) => m.tipo === 'muro')).toHaveLength(5);
    expect(muros.find((m) => m.tipo === 'puerta')).toMatchObject({ a: { x: 9, y: 8 }, b: { x: 10, y: 8 }, abierta: false });
  });

  it('los muros y las ventanas frenan el paso; una puerta abierta, no', () => {
    const muro: Muro = { id: 'a', a: { x: 1, y: 0 }, b: { x: 1, y: 3 }, tipo: 'muro' };
    expect(cruzaMuro([muro], { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(true);
    expect(cruzaMuro([muro], { x: 0, y: 1 }, { x: 0, y: 2 })).toBe(false);
    // Tampoco se cuela en diagonal por la punta
    expect(cruzaMuro([muro], { x: 0, y: 2 }, { x: 1, y: 3 })).toBe(true);
    expect(cruzaMuro([{ ...muro, tipo: 'ventana' }], { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(true);
    expect(cruzaMuro([{ ...muro, tipo: 'puerta', abierta: true }], { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it('para entrar hay que pasar por la puerta: cerrada, no se llega', () => {
    let e = mesa();
    const kyra = e.tokens.kyra!;
    expect(planMovimiento(e, kyra, { x: 9, y: 6 }, 3)).toHaveProperty('motivo');
    e = aplicar(e, { tipo: 'alternar-puerta', id: puerta(e).id, abierta: true });
    const plan = planMovimiento(e, e.tokens.kyra!, { x: 9, y: 6 }, 3);
    expect(plan).toHaveProperty('camino');
  });

  it('se abre estando al lado', () => {
    const e = mesa();
    expect(alLadoDe({ ...e.tokens.kyra!, y: 8 }, puerta(e))).toBe(true);
    expect(alLadoDe(e.tokens.kyra!, puerta(e))).toBe(false);
  });
});

describe('visión y niebla', () => {
  it('con la puerta cerrada no se ve adentro; abierta, se ve por el hueco', () => {
    let e = mesa();
    let ve = casillasVisibles(e);
    expect(ve.has('9,5')).toBe(false);
    expect(ve.has('15,10')).toBe(true);
    e = aplicar(e, { tipo: 'alternar-puerta', id: puerta(e).id, abierta: true });
    ve = casillasVisibles(e);
    expect(ve.has('9,5')).toBe(true);
    // Las esquinas de adentro siguen tapadas por la pared
    expect(ve.has('6,2')).toBe(false);
  });

  it('las ventanas dejan ver', () => {
    const e = aplicar(mesa(), { tipo: 'editar-mapa', cambios: { muros: mesa().mapa.muros!.map((m) => (m.tipo === 'puerta' ? { ...m, tipo: 'ventana' as const } : m)) } });
    expect(casillasVisibles(e).has('9,5')).toBe(true);
  });

  it('al jugador no le llega el goblin de adentro ni los muros que no conoce; al abrir, sí', () => {
    let e = mesa();
    let vista = vistaJugadores(e).estado;
    expect(Object.keys(vista.tokens).sort()).toEqual(['afuera', 'kyra']);
    // El muro de arriba (y 2) todavía no lo vio nadie
    expect(vista.mapa.muros!.some((m) => m.a.y === 2 && m.b.y === 2)).toBe(false);
    expect(vista.mapa.muros!.some((m) => m.tipo === 'puerta')).toBe(true);
    e = aplicar(e, { tipo: 'alternar-puerta', id: puerta(e).id, abierta: true });
    vista = vistaJugadores(e).estado;
    expect(vista.tokens.goblin).toBeDefined();
  });

  it('lo visto queda explorado; la firma cambia cuando cambia lo que ven', () => {
    let e = mesa();
    const antes = vistaJugadores(e).firma;
    const mascara = explorar(e)!;
    e = aplicar(e, { tipo: 'explorar', mascara });
    expect(explorar(e)).toBeNull();
    expect(deMascara(e.mapa.exploradas, 24, 16).has('15,10')).toBe(true);
    e = aplicar(e, { tipo: 'alternar-puerta', id: puerta(e).id, abierta: true });
    expect(vistaJugadores(e).firma).not.toBe(antes);
  });

  it('la máscara ida y vuelta', () => {
    const casillas = new Set(['0,0', '3,1', '23,15']);
    expect(deMascara(aMascara(casillas, 24, 16), 24, 16)).toEqual(casillas);
    expect(deMascara('abc', 24, 16).size).toBe(0);
  });

  it('el GM edita muros; nadie puede mandar lo visible', () => {
    const e = mesa();
    expect(esAccionValida({ tipo: 'editar-mapa', cambios: { muros: [{ id: 'x', a: { x: 0, y: 0 }, b: { x: 0, y: 3 }, tipo: 'muro' }] } }, e)).toBe(true);
    expect(esAccionValida({ tipo: 'editar-mapa', cambios: { muros: [{ id: 'x', a: { x: 1, y: 1 }, b: { x: 1, y: 1 }, tipo: 'muro' }] } }, e)).toBe(false);
    expect(esAccionValida({ tipo: 'editar-mapa', cambios: { visibles: 'ff' } }, e)).toBe(false);
  });
});

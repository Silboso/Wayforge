import { describe, expect, it } from 'vitest';
import { alcanzables, caminoA, clave, distanciaEntre, type OpcionesMovimiento } from './movimiento';

const libre: OpcionesMovimiento = { lado: 1, bloqueadas: new Set(), ocupadas: new Set(), columnas: Infinity, filas: Infinity };

describe('alcanzables', () => {
  it('25 ft en línea recta son 5 casillas', () => {
    const m = alcanzables({ x: 10, y: 10 }, 25, libre);
    expect(m.get('15,10')?.pies).toBe(25);
    expect(m.has('16,10')).toBe(false);
  });

  it('las diagonales alternan 5 y 10 ft', () => {
    const m = alcanzables({ x: 10, y: 10 }, 30, libre);
    expect(m.get('11,11')?.pies).toBe(5);
    expect(m.get('12,12')?.pies).toBe(15);
    expect(m.get('13,13')?.pies).toBe(20);
    expect(m.get('14,14')?.pies).toBe(30);
  });

  it('no atraviesa enemigos y rodea', () => {
    // Una pared de enemigos en x=11, de y=9 a y=11
    const bloqueadas = new Set(['11,9', '11,10', '11,11']);
    const m = alcanzables({ x: 10, y: 10 }, 25, { ...libre, bloqueadas });
    expect(m.has('11,10')).toBe(false);
    expect(m.get('12,10')!.pies).toBeGreaterThan(10);
    const camino = caminoA({ x: 12, y: 10 }, m)!;
    expect(camino.every((c) => !bloqueadas.has(clave(c)))).toBe(true);
  });

  it('pasa entre aliados pero no termina encima', () => {
    const ocupadas = new Set(['11,10']);
    const m = alcanzables({ x: 10, y: 10 }, 15, { ...libre, ocupadas });
    expect(m.has('11,10')).toBe(false);
    expect(m.get('12,10')?.pies).toBe(10);
  });

  it('respeta los bordes del tablero', () => {
    const m = alcanzables({ x: 0, y: 0 }, 10, { ...libre, columnas: 2, filas: 2 });
    expect([...m.keys()].sort()).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });
});

describe('distanciaEntre', () => {
  it('al lado son 5 ft, también en diagonal', () => {
    expect(distanciaEntre({ x: 0, y: 0 }, 1, { x: 1, y: 0 }, 1)).toBe(5);
    expect(distanciaEntre({ x: 0, y: 0 }, 1, { x: 1, y: 1 }, 1)).toBe(5);
  });

  it('cuenta las diagonales de PF2e y el tamaño', () => {
    expect(distanciaEntre({ x: 0, y: 0 }, 1, { x: 3, y: 0 }, 1)).toBe(15);
    expect(distanciaEntre({ x: 0, y: 0 }, 1, { x: 2, y: 2 }, 1)).toBe(15);
    // Un Large (2×2) que empieza en x=2: su borde está a 1 casilla
    expect(distanciaEntre({ x: 0, y: 0 }, 1, { x: 2, y: 0 }, 2)).toBe(10);
  });
});

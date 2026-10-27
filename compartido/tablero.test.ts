import { describe, expect, it } from 'vitest';
import { aplicar, casillaLibre, dentroDelTablero, esAccionValida, estadoInicial, planMovimiento, type Token } from './sala';
import { personajeNuevo } from '../reglas/pf2e';

const token = (id: string, x: number, y: number): Token => ({ id, nombre: id, tipo: 'enemigo', tamano: 'Medium', x, y, color: '#c8392b' });

describe('el tablero', () => {
  it('una sala nueva trae terreno (el claro del bosque) y el GM lo puede cambiar o quitar', () => {
    const e = estadoInicial();
    expect(e.mapa.terreno).toBe('claro');
    expect(esAccionValida({ tipo: 'editar-mapa', cambios: { terreno: 'ninguno' } }, e)).toBe(true);
    expect(esAccionValida({ tipo: 'editar-mapa', cambios: { terreno: 'mazmorra' } }, e)).toBe(true);
    expect(esAccionValida({ tipo: 'editar-mapa', cambios: { terreno: 'volcan' as never } }, e)).toBe(false);
    expect(aplicar(e, { tipo: 'editar-mapa', cambios: { terreno: 'ninguno' } }).mapa.terreno).toBe('ninguno');
  });

  it('los tokens nuevos aparecen a la izquierda, a media altura, sin pisarse', () => {
    let e = estadoInicial();
    expect(casillaLibre(e)).toEqual({ x: 2, y: 6 });
    e = aplicar(e, { tipo: 'crear-token', token: token('a', 2, 6) });
    expect(casillaLibre(e)).toEqual({ x: 2, y: 7 });
    // Un token grande ocupa todas sus casillas
    e = aplicar(e, { tipo: 'crear-token', token: { ...token('ogro', 2, 7), tamano: 'Large' } });
    expect(casillaLibre(e)).toEqual({ x: 2, y: 9 });
  });

  it('sin imagen de mapa, el tablero tiene borde: columnas × filas', () => {
    const { mapa } = estadoInicial();
    expect(dentroDelTablero(mapa, { x: 23, y: 15 })).toBe(true);
    expect(dentroDelTablero(mapa, { x: 24, y: 0 })).toBe(false);
    expect(dentroDelTablero(mapa, { x: -1, y: 3 })).toBe(false);
    expect(dentroDelTablero(mapa, { x: 23, y: 15 }, 2)).toBe(false);
    expect(dentroDelTablero({ ...mapa, imagen: 'mapa.webp' }, { x: 90, y: 90 })).toBe(true);
  });
});

describe('Sneak', () => {
  it('se mueve hasta la mitad de su Velocidad sin gastar más acciones', () => {
    const e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: { ...personajeNuevo('kyra'), nombre: 'Kyra', velocidad: 25 }, x: 2, y: 6 });
    const t = e.tokens.kyra!;
    expect(planMovimiento(e, t, { x: 4, y: 6 }, 2, true)).toMatchObject({ pies: 10, acciones: 0 });
    expect(planMovimiento(e, t, { x: 5, y: 6 }, 2, true)).toEqual({ motivo: 'Con Sneak llegas hasta 10 ft (la mitad de tu Velocidad).' });
  });
});

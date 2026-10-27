import { describe, expect, it } from 'vitest';
import { personajeNuevo, type Personaje } from '../reglas/pf2e';
import { conDying, curarHeridas, dyingMortal, NIVELES_CURAR, recuperacion } from '../reglas/muerte';
import { crearEfecto } from '../reglas/efectos';
import { aplicar, esAccionValida, estadoInicial, motivoParaActuar, preparacionDe, relojTexto, type EstadoSala } from './sala';

const kyra: Personaje = { ...personajeNuevo('kyra'), nombre: 'Kyra', nivel: 3, atributos: { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 } };
const ezren: Personaje = { ...personajeNuevo('ezren'), nombre: 'Ezren' };
function mesa(): EstadoSala {
  let e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: kyra, x: 2, y: 6 });
  return aplicar(e, { tipo: 'crear-personaje', personaje: ezren, x: 2, y: 7 });
}

describe('morir en PF2e', () => {
  it('la salvación de recuperación: CD 10 + Dying; éxito baja, fallo sube, crítico de a dos', () => {
    const dying2 = [{ clave: 'dying' as const, valor: 2 }];
    expect(recuperacion(dying2, 12)).toEqual({ cd: 12, grado: 'exito', dying: 1 });
    expect(recuperacion(dying2, 20)).toMatchObject({ grado: 'critico', dying: 0 });
    expect(recuperacion(dying2, 5)).toMatchObject({ grado: 'fallo', dying: 3 });
    expect(recuperacion(dying2, 1)).toMatchObject({ grado: 'pifia', dying: 4 });
  });

  it('a 0 se estabiliza con Wounded +1; al máximo (4 menos Doomed) muere', () => {
    expect(conDying([{ clave: 'dying', valor: 1 }, { clave: 'unconscious', valor: 1 }], 0)).toEqual([{ clave: 'unconscious', valor: 1 }, { clave: 'wounded', valor: 1 }]);
    const condenado = [{ clave: 'dying' as const, valor: 2 }, { clave: 'doomed' as const, valor: 1 }];
    expect(dyingMortal(condenado)).toBe(3);
    expect(conDying(condenado, 3).some((c) => c.clave === 'dead')).toBe(true);
    // La recuperación heroica no suma Wounded
    expect(conDying([{ clave: 'dying', valor: 3 }], 0, true)).toEqual([]);
  });

  it('inconsciente o muerto no se actúa', () => {
    const e = aplicar(mesa(), { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'unconscious', valor: 1 });
    expect(motivoParaActuar(e, 'kyra', 1)).toBe('Estás inconsciente: no puedes actuar.');
    expect(motivoParaActuar(aplicar(mesa(), { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'dead', valor: 1 }), 'kyra', 'reaccion')).toBe('Estás muerto.');
  });
});

describe('Treat Wounds', () => {
  it('cura según el grado y la dificultad elegida', () => {
    const experto = NIVELES_CURAR[1]!;
    expect(curarHeridas('exito', experto)).toEqual({ cura: '2d8+10' });
    expect(curarHeridas('critico', NIVELES_CURAR[0]!)).toEqual({ cura: '4d8' });
    expect(curarHeridas('fallo', experto)).toEqual({});
    expect(curarHeridas('pifia', experto)).toEqual({ dana: '1d8' });
  });
});

describe('el tiempo y los descansos', () => {
  it('pasar el tiempo cuenta los efectos (1 minuto = 10 rondas) y vence lo que tiene hora', () => {
    let e = aplicar(mesa(), { tipo: 'poner-efecto', tokenId: 'kyra', efecto: crearEfecto({ clave: 'bless', nombre: 'Bless', beneficioso: true, modificadores: [], rondas: 10 }, 'b', undefined, undefined, undefined) });
    e = aplicar(e, { tipo: 'poner-efecto', tokenId: 'kyra', efecto: { id: 'tw', clave: 'inmune:treat-wounds', nombre: 'Ya atendido', beneficioso: true, modificadores: [], inmuneA: 'treat-wounds', duracion: { tipo: 'minutos', hasta: 60 } } });
    e = aplicar(e, { tipo: 'pasar-tiempo', minutos: 10 });
    expect(e.reloj).toBe(10);
    expect(e.tokens.kyra!.efectos!.map((x) => x.id)).toEqual(['tw']);
    e = aplicar(e, { tipo: 'pasar-tiempo', minutos: 60 });
    expect(e.tokens.kyra!.efectos).toEqual([]);
    expect(relojTexto(e.reloj!)).toBe('1 h 10 min');
  });

  it('la noche: vida, Doomed −1, sin fatiga ni Wounded; 8 horas en el reloj', () => {
    let e = aplicar(mesa(), { tipo: 'editar-personaje', id: 'kyra', cambios: { pgActual: 1 } });
    e = aplicar(e, { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'doomed', valor: 2 });
    e = aplicar(e, { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'fatigued', valor: 1 });
    e = aplicar(e, { tipo: 'descanso-grupo', descanso: 'noche' });
    expect(e.personajes.kyra!.pgActual).toBeGreaterThan(1);
    expect(e.tokens.kyra!.condiciones).toEqual([{ clave: 'doomed', valor: 1 }]);
    expect(e.reloj).toBe(480);
  });

  it('Hero Points: entre 0 y 3', () => {
    let e = aplicar(mesa(), { tipo: 'dar-heroico', personajeId: 'kyra', cantidad: 3 });
    e = aplicar(e, { tipo: 'dar-heroico', personajeId: 'kyra', cantidad: 2 });
    expect(e.personajes.kyra!.puntosHeroicos).toBe(3);
    expect(esAccionValida({ tipo: 'dar-heroico', personajeId: 'kyra', cantidad: 9 }, e)).toBe(false);
  });
});

describe('actividades de exploración', () => {
  it('Avoid Notice tira la iniciativa con Stealth; Scout da +1 a los aliados', () => {
    let e = aplicar(mesa(), { tipo: 'editar-personaje', id: 'kyra', cambios: { exploracion: 'avoid-notice' } });
    e = aplicar(e, { tipo: 'editar-personaje', id: 'ezren', cambios: { exploracion: 'scout' } });
    e = aplicar(e, { tipo: 'preparar-combate', tokens: ['kyra', 'ezren'] });
    expect(preparacionDe(e, 'kyra')?.clave).toBe('stealth');
    expect(preparacionDe(e, 'ezren')?.clave).toBe('percepcion');
    expect(e.tokens.kyra!.efectos?.[0]?.modificadores).toEqual([{ blanco: 'iniciativa', tipo: 'circunstancia', valor: 1 }]);
    expect(e.tokens.ezren!.efectos ?? []).toEqual([]);
  });
});

describe('curarse estando estable', () => {
  it('a 0 PG e inconsciente, al recibir curación se despierta', () => {
    let e = aplicar(mesa(), { tipo: 'editar-personaje', id: 'kyra', cambios: { pgActual: 0 } });
    e = aplicar(e, { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'unconscious', valor: 1 });
    e = aplicar(e, { tipo: 'curar', tokenId: 'kyra', cantidad: 9 });
    expect(e.personajes.kyra!.pgActual).toBe(9);
    expect(e.tokens.kyra!.condiciones).toEqual([]);
  });
});

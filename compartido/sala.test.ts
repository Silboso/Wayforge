import { describe, expect, it } from 'vitest';
import { personajeNuevo } from '../reglas/pf2e';
import { aplicar, esAccionValida, estadoInicial, puede, type EstadoSala, type Token } from './sala';

const goblin: Token = { id: 'g1', nombre: 'Goblin', tipo: 'enemigo', tamano: 'Small', x: 0, y: 0, color: '#a8382f' };
const kyra = { ...personajeNuevo('kyra'), nombre: 'Kyra', clase: 'Fighter' };

function conKyra(): EstadoSala {
  let estado = aplicar(estadoInicial(), { tipo: 'crear-token', token: goblin });
  estado = aplicar(estado, { tipo: 'crear-personaje', personaje: kyra, x: 2, y: 0 });
  return estado;
}

describe('aplicar', () => {
  it('crea, mueve, edita y borra un token', () => {
    let estado = aplicar(estadoInicial(), { tipo: 'crear-token', token: goblin });
    estado = aplicar(estado, { tipo: 'mover-token', id: 'g1', x: 3, y: 2 });
    estado = aplicar(estado, { tipo: 'editar-token', id: 'g1', cambios: { nombre: 'Jefe goblin', tamano: 'Medium' } });
    expect(estado.tokens.g1).toMatchObject({ x: 3, y: 2, nombre: 'Jefe goblin', tamano: 'Medium' });
    estado = aplicar(estado, { tipo: 'borrar-token', id: 'g1' });
    expect(estado.tokens).toEqual({});
  });

  it('no muta el estado anterior', () => {
    const antes = aplicar(estadoInicial(), { tipo: 'crear-token', token: goblin });
    aplicar(antes, { tipo: 'mover-token', id: 'g1', x: 5, y: 5 });
    expect(antes.tokens.g1).toMatchObject({ x: 0, y: 0 });
  });

  it('ignora acciones sobre tokens que no existen', () => {
    const estado = estadoInicial();
    expect(aplicar(estado, { tipo: 'mover-token', id: 'nadie', x: 1, y: 1 })).toBe(estado);
  });

  it('editar un token no le cambia el id', () => {
    const estado = aplicar(estadoInicial(), { tipo: 'crear-token', token: goblin });
    const cambios = { id: 'otro' } as unknown as Partial<Token>;
    expect(aplicar(estado, { tipo: 'editar-token', id: 'g1', cambios }).tokens.g1?.id).toBe('g1');
  });

  it('crear un personaje pone su token; editarlo lo actualiza; borrarlo lo quita', () => {
    let estado = conKyra();
    expect(estado.tokens.kyra).toMatchObject({ personajeId: 'kyra', nombre: 'Kyra', x: 2, tipo: 'personaje' });
    estado = aplicar(estado, { tipo: 'editar-personaje', id: 'kyra', cambios: { nombre: 'Kyra la Roja', retrato: '/r.png' } });
    expect(estado.tokens.kyra).toMatchObject({ nombre: 'Kyra la Roja', imagen: '/r.png' });
    estado = aplicar(estado, { tipo: 'borrar-personaje', id: 'kyra' });
    expect(estado.personajes).toEqual({});
    expect(Object.keys(estado.tokens)).toEqual(['g1']);
  });

  it('guarda solo las últimas tiradas', () => {
    let estado = estadoInicial();
    for (let i = 0; i < 50; i++) {
      estado = aplicar(estado, {
        tipo: 'registrar-tirada',
        tirada: { id: `${i}`, quien: 'Kyra', etiqueta: 'Athletics', dados: [10], caras: 20, modificador: 0, total: 10, cuando: i },
      });
    }
    expect(estado.tiradas).toHaveLength(40);
    expect(estado.tiradas.at(-1)?.id).toBe('49');
  });
});

describe('puede', () => {
  const estado = conKyra();
  const jugadora = { rol: 'jugador', personajeId: 'kyra' } as const;

  it('el GM puede todo menos inventar tiradas', () => {
    expect(puede({ rol: 'gm' }, { tipo: 'editar-mapa', cambios: { filas: 10 } }, estado)).toBe(true);
    expect(puede({ rol: 'gm' }, { tipo: 'registrar-tirada', tirada: estado.tiradas[0]! }, estado)).toBe(false);
  });

  it('una jugadora mueve y edita solo lo suyo', () => {
    expect(puede(jugadora, { tipo: 'mover-token', id: 'kyra', x: 1, y: 1 }, estado)).toBe(true);
    expect(puede(jugadora, { tipo: 'mover-token', id: 'g1', x: 1, y: 1 }, estado)).toBe(false);
    expect(puede(jugadora, { tipo: 'editar-personaje', id: 'kyra', cambios: { pgActual: 3 } }, estado)).toBe(true);
    expect(puede(jugadora, { tipo: 'editar-mapa', cambios: { filas: 10 } }, estado)).toBe(false);
    expect(puede(jugadora, { tipo: 'borrar-personaje', id: 'kyra' }, estado)).toBe(false);
  });

  it('un visitante no puede nada', () => {
    expect(puede({ rol: 'visitante' }, { tipo: 'mover-token', id: 'kyra', x: 1, y: 1 }, estado)).toBe(false);
  });
});

describe('esAccionValida', () => {
  const estado = conKyra();

  it('acepta acciones bien formadas', () => {
    expect(esAccionValida({ tipo: 'crear-token', token: { ...goblin, id: 'g2' } }, estado)).toBe(true);
    expect(esAccionValida({ tipo: 'mover-token', id: 'g1', x: 1, y: 2 }, estado)).toBe(true);
    expect(esAccionValida({ tipo: 'editar-mapa', cambios: { tamanoCelda: 50 } }, estado)).toBe(true);
    expect(esAccionValida({ tipo: 'editar-personaje', id: 'kyra', cambios: { pgActual: 5 } }, estado)).toBe(true);
  });

  it('rechaza lo que no cuadra', () => {
    expect(esAccionValida(null, estado)).toBe(false);
    expect(esAccionValida({ tipo: 'hackear' }, estado)).toBe(false);
    expect(esAccionValida({ tipo: 'registrar-tirada', tirada: {} }, estado)).toBe(false);
    expect(esAccionValida({ tipo: 'mover-token', id: 'g1', x: 'uno', y: 2 }, estado)).toBe(false);
    expect(esAccionValida({ tipo: 'crear-token', token: { ...goblin, tamano: 'Colossal' } }, estado)).toBe(false);
    expect(esAccionValida({ tipo: 'crear-token', token: { ...goblin, personajeId: 'kyra' } }, estado)).toBe(false);
    expect(esAccionValida({ tipo: 'editar-mapa', cambios: { tamanoCelda: 5 } }, estado)).toBe(false);
    expect(esAccionValida({ tipo: 'editar-token', id: 'g1', cambios: { nombre: 'x'.repeat(61) } }, estado)).toBe(false);
    expect(esAccionValida({ tipo: 'editar-personaje', id: 'kyra', cambios: { nivel: 99 } }, estado)).toBe(false);
  });
});

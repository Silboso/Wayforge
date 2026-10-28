import { describe, expect, it } from 'vitest';
import { personajeNuevo } from '../reglas/pf2e';
import { aplicar, caDeToken, esAccionValida, estadoInicial, puede, tokenEnTurno, type EstadoSala, type Token } from './sala';

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

describe('combate', () => {
  function enCombate(): EstadoSala {
    return aplicar(conKyra(), { tipo: 'iniciar-combate', orden: [{ tokenId: 'kyra', iniciativa: 15 }, { tokenId: 'g1', iniciativa: 15 }] });
  }

  it('ordena por iniciativa y en un empate va primero el enemigo', () => {
    const estado = enCombate();
    expect(estado.combate?.orden.map((c) => c.tokenId)).toEqual(['g1', 'kyra']);
    expect(estado.combate).toMatchObject({ ronda: 1, turno: 0, acciones: 3, usadas: 0 });
  });

  it('al pasar el turno Frightened baja, y al dar la vuelta sube la ronda', () => {
    let estado = enCombate();
    estado = aplicar(estado, { tipo: 'poner-condicion', tokenId: 'g1', clave: 'frightened', valor: 2 });
    estado = aplicar(estado, { tipo: 'avanzar-turno' });
    expect(estado.tokens.g1?.condiciones).toEqual([{ clave: 'frightened', valor: 1 }]);
    expect(tokenEnTurno(estado)?.id).toBe('kyra');
    estado = aplicar(estado, { tipo: 'avanzar-turno' });
    expect(estado.combate).toMatchObject({ ronda: 2, turno: 0 });
  });

  it('Slowed quita acciones al empezar el turno y la reacción vuelve en tu turno', () => {
    let estado = aplicar(conKyra(), { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'slowed', valor: 1 });
    estado = aplicar(estado, { tipo: 'iniciar-combate', orden: [{ tokenId: 'kyra', iniciativa: 20 }, { tokenId: 'g1', iniciativa: 5 }] });
    expect(estado.combate?.acciones).toBe(2);
    estado = aplicar(estado, { tipo: 'usar-reaccion', tokenId: 'kyra', usada: true });
    estado = aplicar(estado, { tipo: 'avanzar-turno' });
    expect(estado.combate?.reacciones).toEqual(['kyra']);
    estado = aplicar(estado, { tipo: 'avanzar-turno' });
    expect(estado.combate?.reacciones).toEqual([]);
  });

  it('contar un ataque gasta una acción solo en el turno de ese token', () => {
    let estado = enCombate();
    estado = aplicar(estado, { tipo: 'contar-ataque', tokenId: 'kyra', gastaAccion: true });
    expect(estado.combate).toMatchObject({ ataques: 0, usadas: 0 });
    estado = aplicar(estado, { tipo: 'contar-ataque', tokenId: 'g1', gastaAccion: true });
    expect(estado.combate).toMatchObject({ ataques: 1, usadas: 1 });
  });

  it('borrar un token lo saca del orden sin perder el turno', () => {
    let estado = aplicar(enCombate(), { tipo: 'avanzar-turno' });
    estado = aplicar(estado, { tipo: 'borrar-token', id: 'g1' });
    expect(estado.combate?.orden.map((c) => c.tokenId)).toEqual(['kyra']);
    expect(tokenEnTurno(estado)?.id).toBe('kyra');
  });

  it('la jugadora solo pasa su propio turno y no puede empezar combates', () => {
    const estado = enCombate();
    const jugadora = { rol: 'jugador', personajeId: 'kyra' } as const;
    expect(puede(jugadora, { tipo: 'avanzar-turno' }, estado)).toBe(false);
    expect(puede(jugadora, { tipo: 'avanzar-turno' }, aplicar(estado, { tipo: 'avanzar-turno' }))).toBe(true);
    expect(puede(jugadora, { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'prone', valor: 1 }, estado)).toBe(true);
    expect(puede(jugadora, { tipo: 'poner-condicion', tokenId: 'g1', clave: 'prone', valor: 1 }, estado)).toBe(false);
    expect(puede({ rol: 'gm' }, { tipo: 'iniciar-combate', orden: [] }, estado)).toBe(false);
  });

  it('la CA de un enemigo baja con Off-guard', () => {
    let estado = aplicar(conKyra(), { tipo: 'editar-token', id: 'g1', cambios: { ca: 16 } });
    estado = aplicar(estado, { tipo: 'poner-condicion', tokenId: 'g1', clave: 'off-guard', valor: 1 });
    expect(caDeToken(estado, estado.tokens.g1!)?.total).toBe(14);
  });
});

describe('Delay (esperar)', () => {
  function tres(): EstadoSala {
    let estado = aplicar(conKyra(), { tipo: 'crear-token', token: { ...goblin, id: 'g2', nombre: 'Goblin 2', x: 5 } });
    estado = aplicar(estado, { tipo: 'iniciar-combate', orden: [{ tokenId: 'kyra', iniciativa: 20 }, { tokenId: 'g1', iniciativa: 10 }, { tokenId: 'g2', iniciativa: 5 }] });
    return estado;
  }

  it('quien espera sale del orden hasta que vuelve, y vuelve justo después del turno en curso', () => {
    let estado = aplicar(tres(), { tipo: 'demorar', tokenId: 'kyra' });
    expect(tokenEnTurno(estado)?.id).toBe('g1');
    expect(estado.combate?.demorados).toEqual(['kyra']);
    // Al dar la vuelta la ronda, la sigue saltando
    estado = aplicar(estado, { tipo: 'avanzar-turno' });
    estado = aplicar(estado, { tipo: 'avanzar-turno' });
    expect(estado.combate).toMatchObject({ ronda: 2 });
    expect(tokenEnTurno(estado)?.id).toBe('g1');
    // Vuelve: le toca apenas termine el goblin
    estado = aplicar(estado, { tipo: 'volver-de-demora', tokenId: 'kyra' });
    expect(tokenEnTurno(estado)?.id).toBe('g1');
    expect(estado.combate?.orden.map((c) => c.tokenId)).toEqual(['g1', 'kyra', 'g2']);
    estado = aplicar(estado, { tipo: 'avanzar-turno' });
    expect(tokenEnTurno(estado)?.id).toBe('kyra');
    expect(estado.combate?.demorados).toEqual([]);
  });

  it('solo se espera en el propio turno, y el jugador solo con su personaje', () => {
    const estado = tres();
    expect(aplicar(estado, { tipo: 'demorar', tokenId: 'g1' })).toBe(estado);
    expect(puede({ rol: 'jugador', personajeId: 'kyra' }, { tipo: 'demorar', tokenId: 'kyra' }, estado)).toBe(true);
    expect(puede({ rol: 'jugador', personajeId: 'kyra' }, { tipo: 'demorar', tokenId: 'g1' }, estado)).toBe(false);
  });
});

describe('terminar el combate', () => {
  it('se va lo que dura solo en la pelea; Dying, Wounded y lo largo se quedan', () => {
    let estado = aplicar(conKyra(), { tipo: 'iniciar-combate', orden: [{ tokenId: 'kyra', iniciativa: 20 }, { tokenId: 'g1', iniciativa: 5 }] });
    estado = aplicar(estado, { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'shield-raised', valor: 1, hasta: 'inicio-turno' });
    estado = aplicar(estado, { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'frightened', valor: 2 });
    estado = aplicar(estado, { tipo: 'poner-condicion', tokenId: 'kyra', clave: 'wounded', valor: 1 });
    const corto = { id: 'e1', clave: 'bless', nombre: 'Bless', beneficioso: true, modificadores: [], duracion: { tipo: 'rondas' as const, rondas: 10 } };
    const largo = { id: 'e2', clave: 'heroism', nombre: 'Heroism', beneficioso: true, modificadores: [], duracion: { tipo: 'rondas' as const, rondas: 100 } };
    estado = aplicar(estado, { tipo: 'poner-efecto', tokenId: 'kyra', efecto: corto });
    estado = aplicar(estado, { tipo: 'poner-efecto', tokenId: 'kyra', efecto: largo });
    estado = aplicar(estado, { tipo: 'terminar-combate' });
    expect(estado.combate).toBeNull();
    expect(estado.tokens.kyra?.condiciones?.map((c) => c.clave)).toEqual(['wounded']);
    expect(estado.tokens.kyra?.efectos?.map((e) => e.nombre)).toEqual(['Heroism']);
  });
});

describe('sumarse al combate', () => {
  it('quien entra con su lugar ya pasado juega desde la próxima ronda', () => {
    let estado = aplicar(conKyra(), { tipo: 'crear-token', token: { ...goblin, id: 'g2', nombre: 'Goblin 2', x: 5 } });
    estado = aplicar(estado, { tipo: 'iniciar-combate', orden: [{ tokenId: 'kyra', iniciativa: 20 }, { tokenId: 'g1', iniciativa: 5 }] });
    estado = aplicar(estado, { tipo: 'avanzar-turno' });
    estado = aplicar(estado, { tipo: 'agregar-a-combate', tokenId: 'g2', iniciativa: 25 });
    expect(tokenEnTurno(estado)?.id).toBe('g1');
    expect(estado.combate?.orden[0]).toMatchObject({ tokenId: 'g2', desde: 2 });
    estado = aplicar(estado, { tipo: 'avanzar-turno' });
    expect(tokenEnTurno(estado)?.id).toBe('g2');
  });
});

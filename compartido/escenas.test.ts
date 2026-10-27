import { describe, expect, it } from 'vitest';
import { personajeNuevo } from '../reglas/pf2e';
import { vistaDeJugador } from './vision';
import { eventosDe } from './eventos';
import { aplicar, esAccionValida, estadoInicial, type Accion, type EstadoSala, type Token } from './sala';

const goblin = (id: string, x: number, y: number): Token => ({ id, nombre: id, tipo: 'enemigo', tamano: 'Small', x, y, color: '#c8392b' });

function mesa(): EstadoSala {
  let e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: { ...personajeNuevo('kyra'), nombre: 'Kyra' }, x: 3, y: 4 });
  e = aplicar(e, { tipo: 'crear-token', token: goblin('goblin', 9, 7) });
  return aplicar(e, { tipo: 'editar-mapa', cambios: { muros: [{ id: 'm', a: { x: 5, y: 0 }, b: { x: 5, y: 3 }, tipo: 'muro' }], luz: 'tenue' } });
}
const todo = (e: EstadoSala, acciones: Accion[]) => acciones.reduce((s, a) => {
  expect(esAccionValida(a, s), a.tipo).toBe(true);
  return aplicar(s, a);
}, e);

describe('escenas', () => {
  it('una escena nueva empieza en blanco; pasar a ella guarda la actual y los personajes viajan', () => {
    let e = todo(mesa(), [{ tipo: 'crear-escena', id: 'cueva', nombre: 'La cueva' }]);
    expect(e.escenas!.map((x) => x.nombre)).toEqual(['La cueva']);
    e = aplicar(e, { tipo: 'iniciar-combate', orden: [{ tokenId: 'kyra', iniciativa: 10 }, { tokenId: 'goblin', iniciativa: 5 }] });
    e = aplicar(e, { tipo: 'cambiar-escena', id: 'cueva' });
    expect(e.escena).toEqual({ id: 'cueva', nombre: 'La cueva' });
    expect(Object.keys(e.tokens)).toEqual(['kyra']);
    expect(e.mapa.muros).toEqual([]);
    expect(e.combate).toBeNull();
    // La escena de antes quedó guardada con su goblin, sus muros y dónde estaba Kyra
    const antes = e.escenas!.find((x) => x.id === 'inicio')!;
    expect(antes.tokens.map((t) => t.id)).toEqual(['goblin']);
    expect(antes.mapa.muros).toHaveLength(1);
    expect(antes.posiciones).toEqual({ kyra: { x: 3, y: 4 } });
    // Al volver, todo vuelve a su lugar
    e = aplicar(aplicar(e, { tipo: 'mover-token', id: 'kyra', x: 10, y: 10 }), { tipo: 'cambiar-escena', id: 'inicio' });
    expect(e.tokens.goblin).toBeDefined();
    expect(e.tokens.kyra).toMatchObject({ x: 3, y: 4 });
    expect(e.escenas!.find((x) => x.id === 'cueva')!.posiciones).toEqual({ kyra: { x: 10, y: 10 } });
  });

  it('copiar la escena duplica mapa y criaturas con ids nuevos', () => {
    const e = aplicar(mesa(), { tipo: 'crear-escena', id: 'copia123', nombre: 'Copia', copiar: true });
    const copia = e.escenas![0]!;
    expect(copia.mapa.muros).toHaveLength(1);
    expect(copia.tokens[0]!.id).not.toBe('goblin');
  });

  it('renombrar la actual o una guardada; borrar una guardada', () => {
    let e = todo(mesa(), [
      { tipo: 'renombrar-escena', id: 'inicio', nombre: 'El camino' },
      { tipo: 'crear-escena', id: 'b', nombre: 'B' },
      { tipo: 'renombrar-escena', id: 'b', nombre: 'Bosque' },
    ]);
    expect(e.escena?.nombre).toBe('El camino');
    expect(e.escenas![0]!.nombre).toBe('Bosque');
    e = aplicar(e, { tipo: 'borrar-escena', id: 'b' });
    expect(e.escenas).toEqual([]);
  });

  it('pasar de escena se anuncia con su nombre', () => {
    const e = aplicar(mesa(), { tipo: 'crear-escena', id: 'cueva', nombre: 'La cueva' });
    const accion: Accion = { tipo: 'cambiar-escena', id: 'cueva' };
    expect(eventosDe(e, accion, aplicar(e, accion))).toEqual([{ tipo: 'escena', nombre: 'La cueva' }]);
  });
});

describe('lo que llega a un jugador', () => {
  it('nunca las escenas guardadas del GM', () => {
    const e = aplicar(mesa(), { tipo: 'crear-escena', id: 'sorpresa', nombre: 'El dragón' });
    expect(vistaDeJugador(e).estado.escenas).toEqual([]);
  });

  it('con el telón bajo: solo los personajes, sin muros ni luz', () => {
    const e = aplicar(mesa(), { tipo: 'telon', bajo: true });
    const vista = vistaDeJugador(e).estado;
    expect(Object.keys(vista.tokens)).toEqual(['kyra']);
    expect(vista.mapa.muros).toBeUndefined();
    expect(vista.mapa.terreno).toBe('ninguno');
    expect(vistaDeJugador(e).firma).not.toBe(vistaDeJugador(aplicar(e, { tipo: 'telon', bajo: false })).firma);
  });
});

describe('chat y tiradas secretas', () => {
  const mensaje = (id: string, extra: Partial<import('./sala').MensajeChat> = {}) => ({ id, quien: 'Kyra', rol: 'jugador' as const, personajeId: 'kyra', texto: 'hola', cuando: 1, ...extra });
  function conChat(): EstadoSala {
    let e = aplicar(mesa(), { tipo: 'crear-personaje', personaje: { ...personajeNuevo('ezren'), nombre: 'Ezren' }, x: 4, y: 4 });
    e = aplicar(e, { tipo: 'chat', mensaje: mensaje('todos') });
    e = aplicar(e, { tipo: 'chat', mensaje: mensaje('al-gm', { para: 'gm' }) });
    e = aplicar(e, { tipo: 'chat', mensaje: mensaje('a-ezren', { para: 'ezren' }) });
    e = aplicar(e, { tipo: 'registrar-tirada', tirada: { id: 'rk', quien: 'GM', etiqueta: 'Recall Knowledge', dados: [12], caras: 20, modificador: 5, total: 17, cuando: 2, secreta: true } });
    return aplicar(e, { tipo: 'registrar-tirada', tirada: { id: 'pub', quien: 'Kyra', etiqueta: 'Athletics', dados: [8], caras: 20, modificador: 7, total: 15, cuando: 3 } });
  }

  it('un susurro lo ven quien lo manda, quien lo recibe y el GM', () => {
    const e = conChat();
    const ids = (personajeId: string) => vistaDeJugador(e, personajeId).estado.chat!.map((m) => m.id);
    expect(ids('kyra')).toEqual(['todos', 'al-gm', 'a-ezren']);
    expect(ids('ezren')).toEqual(['todos', 'a-ezren']);
    expect(e.chat!.map((m) => m.id)).toEqual(['todos', 'al-gm', 'a-ezren']);
  });

  it('las tiradas secretas del GM no le llegan a ningún jugador', () => {
    const e = conChat();
    expect(vistaDeJugador(e, 'kyra').estado.tiradas.map((t) => t.id)).toEqual(['pub']);
    expect(e.tiradas.map((t) => t.id)).toEqual(['rk', 'pub']);
  });

  it('el chat guarda los últimos mensajes', () => {
    let e = mesa();
    for (let i = 0; i < 90; i++) e = aplicar(e, { tipo: 'chat', mensaje: mensaje(`m${i}`) });
    expect(e.chat).toHaveLength(80);
    expect(e.chat![0]!.id).toBe('m10');
  });
});

import { describe, expect, it } from 'vitest';
import { calcular, personajeNuevo, type Personaje } from '../reglas/pf2e';
import { penalizaciones } from '../reglas/condiciones';
import { crearEfecto, type EfectoActivo } from '../reglas/efectos';
import { casillasDeArea, leerArea } from '../reglas/areas';
import { CATALOGO_INTERACCIONES, interaccionDe, resultadoPara } from '../reglas/interacciones';
import { ACCIONES_BASICAS, type Aptitud } from '../reglas/aptitudes';
import type { Criatura } from '../reglas/criaturas';
import { motivoInmune, objetivosDe, persistenteAlTerminar, resolverUso, type Azar } from './interacciones';
import { aplicar, esAccionValida, estadoInicial, type Accion, type EstadoSala, type Token } from './sala';

// Dados cargados: devuelven lo que se les pida, en orden
function azar(...valores: number[]): Azar {
  let i = 0;
  let n = 0;
  return { dado: (caras) => Math.min(caras, valores[i++ % valores.length]!), id: () => `id${n++}`, ahora: () => 1 };
}

const criatura = (salvaciones: Criatura['salvaciones'], defensas?: Criatura['defensas']): Criatura => ({
  nivel: 1, salvaciones, velocidad: 25, ataques: [], habilidades: [], rasgos: [], notas: '', ...(defensas ? { defensas } : {}),
});
const goblin = (id: string, x: number, y: number, extra: Partial<Token> = {}): Token => ({
  id, nombre: id, tipo: 'enemigo', tamano: 'Small', x, y, color: '#c8392b', ca: 16, pg: { actual: 30, max: 30 }, percepcion: 3,
  criatura: criatura({ fortitude: 5, reflex: 7, will: 3 }), ...extra,
});

const ezren: Personaje = {
  ...personajeNuevo('ezren'), nombre: 'Ezren', clase: 'Wizard', nivel: 5,
  atributos: { str: 0, dex: 2, con: 1, int: 4, wis: 1, cha: 3 },
  habilidades: { ...personajeNuevo('x').habilidades, intimidation: 2, athletics: 1 },
  lanzador: { tradicion: 'arcane', atributo: 'int', rango: 2 },
};
const conjuro = (nombre: string, extra: Partial<Aptitud> = {}): Aptitud => ({
  id: nombre, nombre, verbo: nombre, categoria: 'conjuro', costo: 2, recuperacion: { tipo: 'siempre' }, descripcion: '', rasgos: [], distancia: 500, ...extra,
});

function mesa(...tokens: Token[]): EstadoSala {
  let e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: ezren, x: 0, y: 0 });
  for (const t of tokens) e = aplicar(e, { tipo: 'crear-token', token: t });
  return e;
}
const aplicarTodo = (e: EstadoSala, acciones: Accion[]) => acciones.reduce((s, a) => {
  const soloSala = a.tipo === 'registrar-tirada' || a.tipo === 'mostrar-area';
  expect(soloSala || esAccionValida(a, s), `${a.tipo} válida`).toBe(true);
  return aplicar(s, a);
}, e);

describe('apilar bonos y penalizaciones', () => {
  const efecto = (clave: string, mods: EfectoActivo['modificadores']) => crearEfecto({ clave, nombre: clave, beneficioso: true, modificadores: mods }, clave, undefined, undefined, undefined);

  it('del mismo tipo cuenta el mejor bono; de tipos distintos se suman', () => {
    const bless = efecto('Bless', [{ blanco: 'ataque', tipo: 'estado', valor: 1 }]);
    const heroism = efecto('Heroism', [{ blanco: 'chequeos', tipo: 'estado', valor: 2 }]);
    const flanqueo = efecto('Ayuda', [{ blanco: 'ataque', tipo: 'circunstancia', valor: 1 }]);
    const partes = penalizaciones([], { tipo: 'ataque', atributo: 'str' }, [bless, heroism, flanqueo]);
    expect(partes).toEqual([{ etiqueta: 'Heroism', valor: 2 }, { etiqueta: 'Ayuda', valor: 1 }]);
  });

  it('la peor penalización de estado gana, y las condiciones entran en la misma cuenta', () => {
    const bane = efecto('Bane', [{ blanco: 'ataque', tipo: 'estado', valor: -1 }]);
    const partes = penalizaciones([{ clave: 'frightened', valor: 2 }], { tipo: 'ataque', atributo: 'str' }, [bane]);
    expect(partes).toEqual([{ etiqueta: 'Frightened 2', valor: -2 }]);
  });

  it('un bono no cancela una penalización del mismo tipo: se ven las dos', () => {
    const bless = efecto('Bless', [{ blanco: 'ataque', tipo: 'estado', valor: 1 }]);
    const total = penalizaciones([{ clave: 'frightened', valor: 1 }], { tipo: 'ataque', atributo: 'str' }, [bless]).reduce((s, p) => s + p.valor, 0);
    expect(total).toBe(0);
  });

  it('los efectos llegan a la ficha calculada (salvaciones, CA, skills)', () => {
    const shield = efecto('Shield', [{ blanco: 'ca', tipo: 'circunstancia', valor: 1 }]);
    const heroism = efecto('Heroism', [{ blanco: 'chequeos', tipo: 'estado', valor: 1 }]);
    const base = calcular(ezren);
    const con = calcular(ezren, [], [shield, heroism]);
    expect(con.ca.total).toBe(base.ca.total + 1);
    expect(con.salvaciones.will.total).toBe(base.salvaciones.will.total + 1);
    expect(con.habilidades.arcana.total).toBe(base.habilidades.arcana.total + 1);
    expect(con.conjuros!.cd.total).toBe(base.conjuros!.cd.total + 1);
  });
});

describe('áreas', () => {
  it('una explosión de 5 ft son 4 casillas; la de 20 ft sigue la regla de las diagonales', () => {
    expect(casillasDeArea({ forma: 'explosion', tamano: 5 }, { x: 0, y: 0, lado: 1 }, { x: 5, y: 5 })).toHaveLength(4);
    const veinte = casillasDeArea({ forma: 'explosion', tamano: 20 }, { x: 0, y: 0, lado: 1 }, { x: 10, y: 10 });
    expect(veinte.some((c) => c.x === 13 && c.y === 13)).toBe(false);
    expect(veinte.some((c) => c.x === 12 && c.y === 12)).toBe(true);
    expect(veinte.some((c) => c.x === 13 && c.y === 10)).toBe(true);
  });

  it('el cono y la línea salen hacia donde se apunta', () => {
    const cono = casillasDeArea({ forma: 'cono', tamano: 15 }, { x: 5, y: 5, lado: 1 }, { x: 9, y: 5 });
    expect(cono.every((c) => c.x > 5)).toBe(true);
    expect(cono.some((c) => c.x === 8 && c.y === 5)).toBe(true);
    const linea = casillasDeArea({ forma: 'linea', tamano: 30 }, { x: 0, y: 0, lado: 1 }, { x: 0, y: 10 });
    expect(linea.map((c) => `${c.x},${c.y}`)).toEqual(['0,1', '0,2', '0,3', '0,4', '0,5', '0,6']);
  });

  it('lee las áreas como vienen en los libros', () => {
    expect(leerArea('20-foot burst')).toEqual({ forma: 'explosion', tamano: 20 });
    expect(leerArea('60-foot line')).toEqual({ forma: 'linea', tamano: 60 });
  });
});

describe('el motor de interacciones', () => {
  it('Fireball: una tirada de daño, una salvación por goblin, el daño según cómo salvó y con resistencias', () => {
    const resistente = goblin('g3', 11, 10, { criatura: criatura({ fortitude: 5, reflex: 7, will: 3 }, { inmunidades: [], resistencias: [{ tipo: 'fire', valor: 5 }], debilidades: [] }) });
    let e = mesa(goblin('g1', 10, 10), goblin('g2', 10, 11), resistente);
    const fireball = conjuro('Fireball');
    const i = interaccionDe(fireball)!;
    const alcance = objetivosDe(e, e.tokens.ezren!, fireball, i, { punto: { x: 11, y: 11 } }, 500);
    expect('tokens' in alcance && alcance.tokens.map((t) => t.id).sort()).toEqual(['g1', 'g2', 'g3']);
    if (!('tokens' in alcance)) return;
    // 6 dados de 3 = 18 de daño; CD 23 contra Reflex +7: 20 (crítico), 17 (éxito), 10 (fallo)
    const acciones = resolverUso(e, { autor: e.tokens.ezren!, personaje: ezren, aptitud: fireball, interaccion: i, objetivos: alcance.tokens, casillas: alcance.casillas!, numero: 0 }, azar(3, 3, 3, 3, 3, 3, 20, 17, 10));
    expect(Array.isArray(acciones)).toBe(true);
    if (!Array.isArray(acciones)) return;
    e = aplicarTodo(e, acciones);
    const pg = (id: string) => e.tokens[id]!.pg!.actual;
    expect([pg('g1'), pg('g2'), pg('g3')]).toEqual([30, 21, 17]);
    const notas = acciones.flatMap((a) => (a.tipo === 'registrar-tirada' && a.tirada.resultado ? [a.tirada.resultado] : []));
    expect(notas[2]).toMatchObject({ dano: 13, tipo: 'fire' });
    expect(acciones[0]).toMatchObject({ tipo: 'mostrar-area', aspecto: 'fuego' });
  });

  it('Demoralize: Intimidation contra la CD de Will, Frightened según el grado, e inmunidad para no repetirlo', () => {
    let e = mesa(goblin('g1', 1, 0));
    const demoralize = ACCIONES_BASICAS.find((a) => a.id === 'basica:demoralize')!;
    const i = interaccionDe(demoralize)!;
    const acciones = resolverUso(e, { autor: e.tokens.ezren!, personaje: ezren, aptitud: demoralize, interaccion: i, objetivos: [e.tokens.g1!], numero: 0 }, azar(11));
    if (!Array.isArray(acciones)) throw new Error('motivo');
    e = aplicarTodo(e, acciones);
    // 11 + Cha 3 + Expert (4 + 5) = 23 contra Will DC 13: crítico
    expect(e.tokens.g1!.condiciones).toEqual([{ clave: 'frightened', valor: 2 }]);
    expect(motivoInmune(demoralize, i, e.tokens.ezren!, e.tokens.g1!)).toContain('ya no cae');
  });

  it('Trip con pifia te tira a ti', () => {
    let e = mesa(goblin('g1', 1, 0, { criatura: criatura({ fortitude: 5, reflex: 30, will: 3 }) }));
    const trip = ACCIONES_BASICAS.find((a) => a.id === 'basica:trip')!;
    const acciones = resolverUso(e, { autor: e.tokens.ezren!, personaje: ezren, aptitud: trip, interaccion: interaccionDe(trip)!, objetivos: [e.tokens.g1!], numero: 0 }, azar(2));
    if (!Array.isArray(acciones)) throw new Error('motivo');
    e = aplicarTodo(e, acciones);
    expect(e.tokens.ezren!.condiciones).toEqual([{ clave: 'prone', valor: 1 }]);
    expect(e.tokens.g1!.condiciones ?? []).toEqual([]);
  });

  it('Bless sobre los aliados cercanos dura 10 rondas que se cuentan en el turno de quien lo lanzó', () => {
    const aliado: Token = { ...goblin('valeros', 1, 0), tipo: 'npc' };
    let e = mesa(aliado, goblin('lejos', 1, 1), goblin('muy-lejos', 12, 12));
    const bless = conjuro('Bless');
    const i = interaccionDe(bless)!;
    const alcance = objetivosDe(e, e.tokens.ezren!, bless, i, {}, undefined);
    if (!('tokens' in alcance)) throw new Error(alcance.motivo);
    expect(alcance.tokens.map((t) => t.id).sort()).toEqual(['ezren', 'valeros']);
    e = aplicar(e, { tipo: 'iniciar-combate', orden: [{ tokenId: 'ezren', iniciativa: 20 }, { tokenId: 'valeros', iniciativa: 10 }] });
    const acciones = resolverUso(e, { autor: e.tokens.ezren!, personaje: ezren, aptitud: bless, interaccion: i, objetivos: alcance.tokens, numero: 0 }, azar(1));
    if (!Array.isArray(acciones)) throw new Error('motivo');
    e = aplicarTodo(e, acciones);
    expect(e.tokens.valeros!.efectos?.[0]).toMatchObject({ nombre: 'Bless', duracion: { tipo: 'rondas', rondas: 10, cuentaEn: 'ezren' } });
    for (let n = 0; n < 19; n++) e = aplicar(e, { tipo: 'avanzar-turno' });
    expect(e.tokens.valeros!.efectos).toHaveLength(1);
    e = aplicar(e, { tipo: 'avanzar-turno' });
    expect(e.tokens.valeros!.efectos).toEqual([]);
  });

  it('Ignition crítico deja fuego persistente; al terminar su turno quema y con 15+ se apaga', () => {
    let e = mesa(goblin('g1', 3, 0));
    const ignition = conjuro('Ignition', { distancia: 30 });
    const acciones = resolverUso(e, { autor: e.tokens.ezren!, personaje: ezren, aptitud: ignition, interaccion: interaccionDe(ignition)!, objetivos: [e.tokens.g1!], numero: 0 }, azar(4, 4, 20));
    if (!Array.isArray(acciones)) throw new Error('motivo');
    e = aplicarTodo(e, acciones);
    // (4 + 4) × 2 = 16
    expect(e.tokens.g1!.pg!.actual).toBe(14);
    expect(e.tokens.g1!.efectos?.[0]).toMatchObject({ nombre: 'En llamas', persistente: { dano: '1d4', tipo: 'fire' } });
    const quema = persistenteAlTerminar(e, e.tokens.g1!, azar(3, 16));
    e = aplicarTodo(e, quema);
    expect(e.tokens.g1!.pg!.actual).toBe(11);
    expect(e.tokens.g1!.efectos).toEqual([]);
  });

  it('a 0 PG un personaje queda Dying (2 con un crítico) e Unconscious; curarlo lo despierta con Wounded 1', () => {
    let e = mesa();
    e = aplicar(e, { tipo: 'danar', tokenId: 'ezren', cantidad: 999, critico: true });
    expect(e.personajes.ezren!.pgActual).toBe(0);
    expect(e.tokens.ezren!.condiciones).toEqual([{ clave: 'dying', valor: 2 }, { clave: 'unconscious', valor: 1 }]);
    e = aplicar(e, { tipo: 'curar', tokenId: 'ezren', cantidad: 9 });
    expect(e.personajes.ezren!.pgActual).toBe(9);
    expect(e.tokens.ezren!.condiciones).toEqual([{ clave: 'wounded', valor: 1 }]);
  });

  it('un efecto con condiciones las pone mientras dura y las quita al irse', () => {
    let e = mesa(goblin('g1', 1, 0));
    const plantilla = resultadoPara(CATALOGO_INTERACCIONES.grease!, 'pifia').efecto!;
    const efecto = crearEfecto(plantilla, 'x', { nombre: 'Ezren' }, 'g1', undefined);
    e = aplicar(e, { tipo: 'poner-efecto', tokenId: 'g1', efecto });
    expect(e.tokens.g1!.condiciones).toEqual([{ clave: 'off-guard', valor: 1 }]);
    e = aplicar(e, { tipo: 'quitar-efecto', tokenId: 'g1', efectoId: 'x' });
    expect(e.tokens.g1!.condiciones).toEqual([]);
  });

  it('Shield (+1 CA) se va al empezar el siguiente turno de quien lo lanzó', () => {
    let e = mesa(goblin('g1', 5, 5));
    e = aplicar(e, { tipo: 'iniciar-combate', orden: [{ tokenId: 'ezren', iniciativa: 20 }, { tokenId: 'g1', iniciativa: 10 }] });
    const shield = conjuro('Shield', { costo: 1 });
    const acciones = resolverUso(e, { autor: e.tokens.ezren!, personaje: ezren, aptitud: shield, interaccion: interaccionDe(shield)!, objetivos: [e.tokens.ezren!], numero: 0 }, azar(1));
    if (!Array.isArray(acciones)) throw new Error('motivo');
    e = aplicarTodo(e, acciones);
    const ca = () => calcular(e.personajes.ezren!, e.tokens.ezren!.condiciones, e.tokens.ezren!.efectos).ca.total;
    const base = calcular(ezren).ca.total;
    expect(ca()).toBe(base + 1);
    e = aplicar(e, { tipo: 'avanzar-turno' });
    expect(ca()).toBe(base + 1);
    e = aplicar(e, { tipo: 'avanzar-turno' });
    expect(ca()).toBe(base);
  });

  it('las aptitudes viejas del compendio se leen de su texto', () => {
    const vieja = conjuro('Thunderstrike Beta', { dano: '1d12', descripcion: '20-foot burst · Salvación básica de Reflex.\nDeals 1d12 electricity damage.' });
    expect(interaccionDe(vieja)).toMatchObject({ modo: { tipo: 'salvacion', salvacion: 'reflex', basica: true }, objetivos: { tipo: 'area', area: { forma: 'explosion', tamano: 20 } }, dano: { formula: '1d12', tipo: 'electricity' } });
  });
});

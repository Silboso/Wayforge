import { describe, expect, it } from 'vitest';
import { calcular, personajeNuevo, type Personaje } from '../reglas/pf2e';
import { momentoIniciativa } from '../reglas/disparadores';
import { interaccionDe } from '../reglas/interacciones';
import { doteAAptitud } from '../reglas/compendio';
import type { Aptitud } from '../reglas/aptitudes';
import { pistaObjetivo, resolverUso, objetivosDe, type Azar } from './interacciones';
import { eventosDe } from './eventos';
import { iniciativaDe } from './tiradas';
import {
  aplicar, aptitudesDePreparacion, esAccionValida, estadoInicial, moverEnOrden, ordenar, preparacionDe, puede,
  type Accion, type EstadoSala, type Token,
} from './sala';

function azar(...valores: number[]): Azar {
  let i = 0;
  let n = 0;
  return { dado: (caras) => Math.min(caras, valores[i++ % valores.length]!), id: () => `id${n++}`, ahora: () => 1 };
}

const dote = (nombre: string, descripcion: string, extra: Partial<Aptitud> = {}): Aptitud => ({
  id: `dote:${nombre}`, nombre, verbo: nombre, categoria: 'dote', costo: 'libre', recuperacion: { tipo: 'siempre' }, descripcion, rasgos: [], ...extra,
});
const AVISO = dote('Oracular Warning', 'Trigger You are about to roll initiative.\n\n—\nYou have a premonition about impending danger.');
const POSTURA = dote('Reflexive Stance', 'Trigger You roll initiative\n\n—\nYou enter a stance without a thought.');

const oraculo: Personaje = {
  ...personajeNuevo('ora'), nombre: 'Korakai', clase: 'Oracle', nivel: 6,
  atributos: { str: 0, dex: 1, con: 1, int: 0, wis: 2, cha: 4 },
  aptitudes: [AVISO, POSTURA],
};
const guerrera: Personaje = {
  ...personajeNuevo('kyra'), nombre: 'Kyra', clase: 'Fighter', nivel: 3,
  atributos: { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
  habilidades: { ...personajeNuevo('x').habilidades, stealth: 1 },
};
const goblin = (id: string, x: number, y: number): Token => ({
  id, nombre: id, tipo: 'enemigo', tamano: 'Small', x, y, color: '#c8392b', ca: 16, pg: { actual: 20, max: 20 }, percepcion: 2,
  criatura: { nivel: 1, salvaciones: { fortitude: 5, reflex: 7, will: 3 }, velocidad: 25, ataques: [], habilidades: [{ nombre: 'Stealth', bono: 8 }], rasgos: [], notas: '' },
});

// Oráculo en (0,0), Kyra a 10 ft, un goblin al lado de los dos
function mesa(): EstadoSala {
  let e = aplicar(estadoInicial(), { tipo: 'crear-personaje', personaje: oraculo, x: 0, y: 0 });
  e = aplicar(e, { tipo: 'crear-personaje', personaje: guerrera, x: 2, y: 0 });
  return aplicar(e, { tipo: 'crear-token', token: goblin('goblin', 1, 1) });
}
const todo = (e: EstadoSala, acciones: Accion[]) => acciones.reduce(aplicar, e);

describe('aptitudes del comienzo del combate', () => {
  it('se reconocen por su Trigger: antes de tirar o al tirar', () => {
    expect(momentoIniciativa(AVISO)).toBe('antes');
    expect(momentoIniciativa(POSTURA)).toBe('al-tirar');
    expect(momentoIniciativa(dote('Power Attack', 'Haces un Strike con un dado más.'))).toBeNull();
    expect(aptitudesDePreparacion(oraculo).map((x) => x.aptitud.nombre)).toEqual(['Oracular Warning', 'Reflexive Stance']);
  });

  it('las dotes del compendio quedan marcadas para la preparación', () => {
    const a = doteAAptitud({ id: 'scout-s-warning', nombre: "Scout's Warning", nivel: 4, rasgos: [], rareza: 'common', fuente: '', licencia: 'ORC', descripcion: 'Trigger You are about to roll a Perception, Stealth, or Survival check for initiative.\n\n—\nYou warn your allies.', categoria: 'class', costo: 'libre', prerrequisitos: [], frecuencia: '' });
    expect(a?.disparadores).toEqual(['iniciativa']);
  });

  it('Oracular Warning: a los aliados a 20 ft (no a sí mismo ni al goblin) +2 de estado a la iniciativa y PG temporales', () => {
    const e = mesa();
    const autor = e.tokens.ora!;
    const inter = interaccionDe(AVISO)!;
    const alcance = objetivosDe(e, autor, AVISO, inter, {}, undefined);
    expect('tokens' in alcance && alcance.tokens.map((t) => t.id)).toEqual(['kyra']);
    const acciones = resolverUso(e, { autor, personaje: oraculo, aptitud: AVISO, interaccion: inter, objetivos: 'tokens' in alcance ? alcance.tokens : [], numero: 0 }, azar(10));
    expect(Array.isArray(acciones)).toBe(true);
    const despues = todo(e, acciones as Accion[]);
    expect(despues.personajes.kyra!.pgTemporales).toBe(3);
    const kyra = despues.tokens.kyra!;
    const sin = iniciativaDe(e.tokens.kyra!, guerrera, 'percepcion');
    const con = iniciativaDe(kyra, guerrera, 'percepcion');
    expect(con.modificador).toBe(sin.modificador + 2);
    expect(con.bono).toBe(2);
    // Al tirar la iniciativa el bono se gasta: no queda para el combate siguiente (los PG temporales sí siguen)
    const enCombate = aplicar(despues, { tipo: 'iniciar-combate', orden: [{ tokenId: 'kyra', iniciativa: 20 }, { tokenId: 'ora', iniciativa: 10 }] });
    expect(enCombate.tokens.kyra!.efectos).toEqual([]);
    expect(enCombate.personajes.kyra!.pgTemporales).toBe(3);
  });

  it('los PG temporales no se suman: queda el mayor', () => {
    let e = todo(mesa(), [{ tipo: 'dar-temporales', tokenId: 'kyra', cantidad: 5 }]);
    e = aplicar(e, { tipo: 'dar-temporales', tokenId: 'kyra', cantidad: 3 });
    expect(e.personajes.kyra!.pgTemporales).toBe(5);
  });
});

describe('la preparación', () => {
  it('el GM la abre; cada jugador elige su tirada y avisa que está listo (solo por su token)', () => {
    let e = aplicar(mesa(), { tipo: 'preparar-combate', tokens: ['ora', 'kyra', 'goblin'] });
    const jugadora = { rol: 'jugador' as const, personajeId: 'kyra' };
    const elegir: Accion = { tipo: 'elegir-iniciativa', tokenId: 'kyra', clave: 'stealth' };
    expect(esAccionValida(elegir, e) && puede(jugadora, elegir, e)).toBe(true);
    expect(puede(jugadora, { tipo: 'marcar-listo', tokenId: 'ora', listo: true }, e)).toBe(false);
    expect(esAccionValida({ tipo: 'elegir-iniciativa', tokenId: 'kyra', clave: 'cocinar' }, e)).toBe(false);
    e = todo(e, [elegir, { tipo: 'marcar-listo', tokenId: 'kyra', listo: true }]);
    expect(preparacionDe(e, 'kyra')).toEqual({ clave: 'stealth', listo: true, usadas: [], ultimo: false });
    expect(preparacionDe(e, 'ora')?.clave).toBe('percepcion');
  });

  it('avisa una sola vez cuando todos los jugadores están listos', () => {
    const e = todo(mesa(), [{ tipo: 'preparar-combate', tokens: ['ora', 'kyra', 'goblin'] }, { tipo: 'marcar-listo', tokenId: 'kyra', listo: true }]);
    const accion: Accion = { tipo: 'marcar-listo', tokenId: 'ora', listo: true };
    const despues = aplicar(e, accion);
    expect(eventosDe(e, accion, despues)).toEqual([{ tipo: 'todos-listos' }]);
    expect(eventosDe(despues, accion, aplicar(despues, accion))).toEqual([]);
  });

  it('lo usado queda anotado; quien va último también; al empezar el combate se cierra', () => {
    let e = todo(mesa(), [
      { tipo: 'preparar-combate', tokens: ['ora', 'kyra'] },
      { tipo: 'usar-preparacion', tokenId: 'ora', aptitudId: AVISO.id, nombre: AVISO.nombre },
      { tipo: 'usar-preparacion', tokenId: 'kyra', aptitudId: 'x', nombre: 'After You', ultimo: true },
    ]);
    expect(preparacionDe(e, 'ora')?.usadas).toEqual([AVISO.id]);
    expect(preparacionDe(e, 'kyra')?.ultimo).toBe(true);
    e = aplicar(e, { tipo: 'iniciar-combate', orden: [{ tokenId: 'ora', iniciativa: 12 }, { tokenId: 'kyra', iniciativa: 3 }] });
    expect(e.preparacion).toBeNull();
    expect(e.combate?.orden.map((c) => c.tokenId)).toEqual(['ora', 'kyra']);
  });

  it('la iniciativa con Stealth: el jugador con su skill, la criatura con la suya (o Perception si no la tiene)', () => {
    const e = mesa();
    expect(iniciativaDe(e.tokens.kyra!, guerrera, 'stealth').modificador).toBe(calcular(guerrera).habilidades.stealth.total);
    expect(iniciativaDe(e.tokens.goblin!, undefined, 'stealth')).toMatchObject({ modificador: 8, etiqueta: 'Iniciativa (Stealth)' });
    expect(iniciativaDe(e.tokens.goblin!, undefined, 'diplomacy')).toMatchObject({ modificador: 2, etiqueta: 'Iniciativa (Perception)' });
  });
});

describe('el orden de juego', () => {
  const tokens = mesa().tokens;

  it('en un empate van primero los enemigos', () => {
    const orden = ordenar([{ tokenId: 'kyra', iniciativa: 15 }, { tokenId: 'goblin', iniciativa: 15 }, { tokenId: 'ora', iniciativa: 20 }], tokens);
    expect(orden.map((c) => c.tokenId)).toEqual(['ora', 'goblin', 'kyra']);
  });

  it('el GM mueve a alguien y el orden queda tal cual, aunque haya que cambiarle el número', () => {
    const base = ordenar([{ tokenId: 'ora', iniciativa: 20 }, { tokenId: 'goblin', iniciativa: 15 }, { tokenId: 'kyra', iniciativa: 15 }], tokens);
    // Kyra antes que el goblin en el empate
    const empate = ordenar(moverEnOrden(base, 'kyra', 1), tokens);
    expect(empate.map((c) => c.tokenId)).toEqual(['ora', 'kyra', 'goblin']);
    expect(empate.find((c) => c.tokenId === 'kyra')!.iniciativa).toBe(15);
    // Kyra primera: toma el 20 del oráculo y va antes
    const primera = ordenar(moverEnOrden(base, 'kyra', 0), tokens);
    expect(primera.map((c) => c.tokenId)).toEqual(['kyra', 'ora', 'goblin']);
    expect(primera[0]!.iniciativa).toBe(20);
  });

  it('mover en el orden mantiene el turno en quien lo tenía', () => {
    let e = aplicar(mesa(), { tipo: 'iniciar-combate', orden: [{ tokenId: 'ora', iniciativa: 20 }, { tokenId: 'goblin', iniciativa: 15 }, { tokenId: 'kyra', iniciativa: 10 }] });
    e = aplicar(e, { tipo: 'avanzar-turno' });
    expect(e.combate!.orden[e.combate!.turno]!.tokenId).toBe('goblin');
    e = aplicar(e, { tipo: 'mover-en-orden', tokenId: 'kyra', posicion: 0 });
    expect(e.combate!.orden.map((c) => c.tokenId)).toEqual(['kyra', 'ora', 'goblin']);
    expect(e.combate!.orden[e.combate!.turno]!.tokenId).toBe('goblin');
  });
});

describe('pistas al apuntar', () => {
  const e = mesa();
  const kyra = e.tokens.kyra!;
  const demoralize = dote('Demoralize', '', { costo: 1 });

  it('dice qué se tira sin mostrar los números de la criatura', () => {
    const inter = interaccionDe(demoralize)!;
    expect(pistaObjetivo(e, kyra, demoralize, inter, e.tokens.goblin!, 30)).toEqual({ valido: true, texto: 'contra su Will · 5 ft' });
  });

  it('lo lejano, lo que no es aliado y uno mismo no sirven, con el motivo', () => {
    expect(pistaObjetivo(e, kyra, null, { modo: { tipo: 'ataque' }, objetivos: { tipo: 'uno' } }, e.tokens.ora!, 5)).toEqual({ valido: false, texto: 'lejos: a 10 ft (llegas a 5)' });
    const heal = dote('Heal', '');
    expect(pistaObjetivo(e, kyra, heal, interaccionDe(heal), e.tokens.goblin!, 30).texto).toBe('no es tu aliado');
    expect(pistaObjetivo(e, kyra, heal, interaccionDe(heal), kyra, 30)).toEqual({ valido: true, texto: 'lo curas' });
    expect(pistaObjetivo(e, kyra, demoralize, interaccionDe(demoralize), kyra, 30).valido).toBe(false);
  });
});

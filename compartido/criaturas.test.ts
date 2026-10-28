import { describe, expect, it } from 'vitest';
import { queTiraCriatura } from './tiradas';
import { aplicar, estadoInicial, motivoParaActuarToken, velocidadDe, type EstadoSala, type Token } from './sala';
import { BESTIARIO } from '../reglas/datos/bestiario';
import { danoAjustado, escribirValores, esCriaturaValida, estadoDeSalud, leerValores } from '../reglas/criaturas';

const goblin = BESTIARIO.find((b) => b.id === 'goblin-warrior')!;
const token = (extra: Partial<Token> = {}): Token => ({
  id: 'g1', nombre: 'Goblin', tipo: 'enemigo', tamano: 'Small', x: 0, y: 0, color: '#c8392b',
  ca: goblin.ca, pg: { actual: goblin.pg, max: goblin.pg }, percepcion: goblin.percepcion, criatura: goblin.criatura, ...extra,
});

describe('criaturas', () => {
  it('todo el bestiario es válido', () => {
    for (const b of BESTIARIO) expect(esCriaturaValida(b.criatura), b.id).toBe(true);
  });

  it('el ataque usa su bono, con la penalización del 2.º ataque (agile: −4)', () => {
    const t = token();
    expect(queTiraCriatura(t, { tipo: 'criatura', tokenId: 'g1', ataque: 'dogslicer', numero: 0 })!.modificador).toBe(7);
    expect(queTiraCriatura(t, { tipo: 'criatura', tokenId: 'g1', ataque: 'dogslicer', numero: 1 })!.modificador).toBe(3);
    expect(queTiraCriatura(t, { tipo: 'criatura', tokenId: 'g1', ataque: 'shortbow', numero: 1 })!.modificador).toBe(1);
    expect(queTiraCriatura(t, { tipo: 'criatura', tokenId: 'g1', ataque: 'dogslicer', numero: 0 })!.esAtaque).toBe(true);
  });

  it('las condiciones también le restan (Frightened 2)', () => {
    const t = token({ condiciones: [{ clave: 'frightened', valor: 2 }] });
    expect(queTiraCriatura(t, { tipo: 'criatura', tokenId: 'g1', ataque: 'dogslicer', numero: 0 })!.modificador).toBe(5);
    expect(queTiraCriatura(t, { tipo: 'chequeo-criatura', tokenId: 'g1', clave: 'will' })!.modificador).toBe(1);
  });

  it('el daño crítico se duplica', () => {
    const plan = queTiraCriatura(token(), { tipo: 'dano-criatura', tokenId: 'g1', ataque: 'dogslicer', critico: true })!;
    expect(plan.multiplicador).toBe(2);
    expect(plan.dados).toEqual([{ cantidad: 1, caras: 6 }]);
  });

  it('una criatura solo actúa en su turno, con acciones', () => {
    let e: EstadoSala = { ...estadoInicial(), tokens: { g1: token(), k: token({ id: 'k', nombre: 'Kyra', tipo: 'personaje' }) } };
    e = aplicar(e, { tipo: 'iniciar-combate', orden: [{ tokenId: 'k', iniciativa: 20 }, { tokenId: 'g1', iniciativa: 10 }] });
    expect(motivoParaActuarToken(e, e.tokens.g1, 1)).toBe('No es el turno de Goblin: ahora juega Kyra.');
    e = aplicar(e, { tipo: 'avanzar-turno' });
    expect(motivoParaActuarToken(e, e.tokens.g1, 1)).toBeNull();
    e = aplicar(e, { tipo: 'gastar-acciones', usadas: 3 });
    expect(motivoParaActuarToken(e, e.tokens.g1, 1)).toBe('A Goblin no le quedan acciones.');
  });

  it('se mueve a su velocidad', () => {
    const e = { ...estadoInicial(), tokens: { g1: token() } };
    expect(velocidadDe(e, e.tokens.g1)).toBe(25);
  });
});

describe('defensas de las criaturas', () => {
  const esqueleto = BESTIARIO.find((b) => b.id === 'skeleton-guard')!.criatura;
  const zombi = BESTIARIO.find((b) => b.id === 'zombie-shambler')!.criatura;

  it('la resistencia resta, la debilidad suma, la inmunidad anula', () => {
    expect(danoAjustado(esqueleto, 7, 'slashing')).toEqual({ total: 2, nota: '−5 por resistencia a slashing' });
    expect(danoAjustado(esqueleto, 3, 'piercing').total).toBe(0);
    expect(danoAjustado(esqueleto, 7, 'bludgeoning')).toEqual({ total: 7, nota: null });
    expect(danoAjustado(zombi, 6, 'slashing')).toEqual({ total: 11, nota: '+5 por debilidad a slashing' });
    expect(danoAjustado(esqueleto, 9, 'poison')).toEqual({ total: 0, nota: 'inmune a poison' });
  });

  it('"physical" cubre los tres físicos, y solo cuenta la resistencia más alta', () => {
    const c = { ...esqueleto, defensas: { inmunidades: [], resistencias: [{ tipo: 'physical', valor: 3 }, { tipo: 'slashing', valor: 5 }], debilidades: [] } };
    expect(danoAjustado(c, 10, 'bludgeoning').total).toBe(7);
    expect(danoAjustado(c, 10, 'slashing').total).toBe(5);
  });

  it('sin tipo de daño o sin defensas, el daño queda igual', () => {
    expect(danoAjustado(esqueleto, 8, null).total).toBe(8);
    expect(danoAjustado(goblin.criatura, 8, 'fire').total).toBe(8);
  });

  it('los jugadores ven el estado en palabras', () => {
    expect(estadoDeSalud({ actual: 20, max: 20 })).toBe('ileso');
    expect(estadoDeSalud({ actual: 12, max: 20 })).toBe('herido');
    expect(estadoDeSalud({ actual: 6, max: 20 })).toBe('muy herido');
    expect(estadoDeSalud({ actual: 2, max: 20 })).toBe('casi muerto');
    expect(estadoDeSalud({ actual: 0, max: 20 })).toBe('derrotado');
  });

  it('"fire 5, cold 10" se lee y se escribe igual', () => {
    expect(leerValores('fire 5, Cold 10, basura')).toEqual([{ tipo: 'fire', valor: 5 }, { tipo: 'cold', valor: 10 }]);
    expect(escribirValores([{ tipo: 'fire', valor: 5 }])).toBe('fire 5');
  });
});

describe('alcance de un ataque', () => {
  it('lo cargado, o sus rasgos (thrown, range, reach); si no, al lado', async () => {
    const { alcanceAtaque } = await import('../reglas/criaturas');
    expect(alcanceAtaque({ distancia: 60, rasgos: [] })).toBe(60);
    expect(alcanceAtaque({ rasgos: ['thrown-30'] })).toBe(30);
    expect(alcanceAtaque({ rasgos: ['deadly-d10', 'reach-10'] })).toBe(10);
    expect(alcanceAtaque({ rasgos: ['agile'] })).toBe(5);
  });
});

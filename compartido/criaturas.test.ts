import { describe, expect, it } from 'vitest';
import { queTiraCriatura } from './tiradas';
import { aplicar, estadoInicial, motivoParaActuarToken, velocidadDe, type EstadoSala, type Token } from './sala';
import { BESTIARIO } from '../reglas/datos/bestiario';
import { esCriaturaValida } from '../reglas/criaturas';

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

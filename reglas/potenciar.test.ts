import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { conjuroAAptitud, type ConjuroCompendio, type Indice } from './compendio';
import { interaccionDe, potenciar, rangoDeLanzamiento, sumarAFormula } from './interacciones';

function conjuro(id: string): ConjuroCompendio {
  const indice = JSON.parse(readFileSync('public/compendio/conjuros/indice.json', 'utf8')) as Indice[];
  const fila = indice.find((x) => x.id === id)!;
  return JSON.parse(readFileSync(`public/compendio/conjuros/${fila.trozo}.json`, 'utf8'))[id];
}

describe('conjuros potenciados', () => {
  it('suma dados del mismo tipo, agrega los distintos y suma los números', () => {
    expect(sumarAFormula('6d6', '2d6', 2)).toBe('10d6');
    expect(sumarAFormula('1d8+8', '1d8', 1)).toBe('2d8+8');
    expect(sumarAFormula('2d4', '1d6', 1)).toBe('2d4+1d6');
    expect(sumarAFormula('1d4+1', '1', 3)).toBe('1d4+4');
    expect(sumarAFormula('6d6', '2d6', 0)).toBe('6d6');
  });

  it('Fireball con un espacio de rango 5: +2d6 por cada rango de más', () => {
    const a = conjuroAAptitud(conjuro('fireball'));
    expect(a.potenciado).toEqual({ base: 3, cada: 1, mas: '2d6' });
    const i = interaccionDe(a)!;
    expect(potenciar(i, a, rangoDeLanzamiento(a, 9, 5)).dano?.formula).toBe('10d6');
    // Sin elegir espacio, el de su rango
    expect(potenciar(i, a, rangoDeLanzamiento(a, 9)).dano?.formula).toBe(i.dano?.formula);
  });

  it('los trucos suben solos con el nivel (la mitad, hacia arriba)', () => {
    const a = conjuroAAptitud(conjuro('electric-arc'));
    const i = interaccionDe(a)!;
    expect(rangoDeLanzamiento(a, 1)).toBe(1);
    expect(rangoDeLanzamiento(a, 5)).toBe(3);
    expect(potenciar(i, a, rangoDeLanzamiento(a, 5)).dano?.formula).toBe('4d4');
  });
});

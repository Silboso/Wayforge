import { describe, expect, it } from 'vitest';
import { cdDeNivel, datosDeCriatura, skillsParaRecordar } from './recordar';
import type { Criatura } from './criaturas';

const goblin: Criatura = {
  nivel: 1, salvaciones: { fortitude: 6, reflex: 8, will: 4 }, velocidad: 25, ataques: [], habilidades: [],
  rasgos: ['Goblin', 'Humanoid'], notas: 'Sentidos: darkvision. Huye si está solo.',
  defensas: { inmunidades: [], resistencias: [], debilidades: [{ tipo: 'fire', valor: 3 }] },
};

describe('Recall Knowledge', () => {
  it('la CD sale del nivel de la criatura', () => {
    expect(cdDeNivel(-1)).toBe(13);
    expect(cdDeNivel(1)).toBe(15);
    expect(cdDeNivel(3)).toBe(18);
    expect(cdDeNivel(40)).toBe(50);
  });

  it('la skill sale de sus rasgos', () => {
    expect(skillsParaRecordar(['Goblin', 'Humanoid'])).toEqual(['society']);
    expect(skillsParaRecordar(['Undead', 'Zombie'])).toEqual(['religion']);
    expect(skillsParaRecordar(['Beast'])).toEqual(['arcana', 'nature']);
    expect(skillsParaRecordar([])).toEqual(['society']);
  });

  it('los datos van de lo más útil a lo menos: debilidad primero, después su peor salvación', () => {
    const datos = datosDeCriatura(goblin);
    expect(datos[0]).toContain('débil a fire');
    expect(datos[1]).toContain('Will (+4)');
    expect(datos.at(-1)).toBe('cuidado: sentidos: darkvision.');
  });
});

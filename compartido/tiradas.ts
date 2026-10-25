import { calcular, HABILIDADES, leerDados, SALVACIONES, signo, type Personaje } from '../reglas/pf2e';
import type { QueTirar } from './sala';

export interface QueSeTira {
  etiqueta: string;
  cantidad: number;
  caras: number;
  modificador: number;
}

// Traduce "tirar Athletics" a dados y modificador usando la ficha. La sala lo usa para tirar de verdad.
export function queSeTira(p: Personaje, que: QueTirar): QueSeTira | null {
  const ficha = calcular(p);
  switch (que.tipo) {
    case 'habilidad': {
      const h = HABILIDADES.find((x) => x.clave === que.clave);
      return h ? { etiqueta: h.nombre, cantidad: 1, caras: 20, modificador: ficha.habilidades[h.clave].total } : null;
    }
    case 'salvacion': {
      const s = SALVACIONES.find((x) => x.clave === que.clave);
      return s ? { etiqueta: s.nombre, cantidad: 1, caras: 20, modificador: ficha.salvaciones[s.clave].total } : null;
    }
    case 'percepcion':
      return { etiqueta: 'Perception', cantidad: 1, caras: 20, modificador: ficha.percepcion.total };
    case 'ataque': {
      const i = p.golpes.findIndex((g) => g.id === que.golpe);
      const golpe = p.golpes[i];
      const calculado = ficha.golpes[i];
      if (!golpe || !calculado || ![0, 1, 2].includes(que.numero)) return null;
      const modificador = calculado.penalizaciones[que.numero];
      const cual = ['', ' (2.º ataque)', ' (3.º ataque)'][que.numero];
      return { etiqueta: `${golpe.nombre}${cual}`, cantidad: 1, caras: 20, modificador };
    }
    case 'dano': {
      const golpe = p.golpes.find((g) => g.id === que.golpe);
      const dados = golpe && leerDados(golpe.dados);
      if (!golpe || !dados) return null;
      return {
        etiqueta: `Daño de ${golpe.nombre}${golpe.tipoDano ? ` (${golpe.tipoDano})` : ''}`,
        ...dados,
        modificador: golpe.sumarFuerza ? p.atributos.str : 0,
      };
    }
  }
}

export function textoTirada(t: { dados: number[]; modificador: number; total: number }): string {
  const dados = t.dados.join(' + ');
  return t.modificador ? `${dados} ${signo(t.modificador).replace(/^([+-])/, '$1 ')} = ${t.total}` : `${dados} = ${t.total}`;
}

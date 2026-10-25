import { bonoDeDano, calcular, HABILIDADES, leerDados, SALVACIONES, signo, type Personaje } from '../reglas/pf2e';
import type { Condicion } from '../reglas/condiciones';
import type { QueTirar } from './sala';

export interface QueSeTira {
  etiqueta: string;
  dados: { cantidad: number; caras: number }[];
  modificador: number;
  // Los críticos de daño duplican el total
  multiplicador: number;
  // Si es un ataque: cuántos se llevan en el turno (para la penalización)
  esAtaque: boolean;
}

// Traduce "tirar Athletics" a dados y modificador usando la ficha y sus condiciones.
// La sala lo usa para tirar de verdad; las tiradas libres no pasan por aquí.
export function queSeTira(p: Personaje, que: QueTirar, condiciones: Condicion[] = []): QueSeTira | null {
  const ficha = calcular(p, condiciones);
  const d20 = (etiqueta: string, modificador: number, esAtaque = false): QueSeTira =>
    ({ etiqueta, dados: [{ cantidad: 1, caras: 20 }], modificador, multiplicador: 1, esAtaque });
  switch (que.tipo) {
    case 'habilidad': {
      const h = HABILIDADES.find((x) => x.clave === que.clave);
      return h ? d20(h.nombre, ficha.habilidades[h.clave].total) : null;
    }
    case 'salvacion': {
      const s = SALVACIONES.find((x) => x.clave === que.clave);
      return s ? d20(s.nombre, ficha.salvaciones[s.clave].total) : null;
    }
    case 'percepcion':
      return d20('Perception', ficha.percepcion.total);
    case 'ataque': {
      const i = p.golpes.findIndex((g) => g.id === que.golpe);
      const golpe = p.golpes[i];
      const calculado = ficha.golpes[i];
      if (!golpe || !calculado || ![0, 1, 2].includes(que.numero)) return null;
      const cual = ['', ' (2.º ataque)', ' (3.º ataque)'][que.numero];
      return d20(`${golpe.nombre}${cual}`, calculado.penalizaciones[que.numero], true);
    }
    case 'dano': {
      const golpe = p.golpes.find((g) => g.id === que.golpe);
      const dados = golpe && leerDados(golpe.dados);
      if (!golpe || !dados) return null;
      return {
        etiqueta: `${que.critico ? 'Daño crítico' : 'Daño'} de ${golpe.nombre}${golpe.tipoDano ? ` (${golpe.tipoDano})` : ''}`,
        dados: [dados],
        modificador: bonoDeDano(p, golpe, condiciones),
        multiplicador: que.critico ? 2 : 1,
        esAtaque: false,
      };
    }
    case 'libre':
      return null;
  }
}

export function textoTirada(t: { dados: number[]; modificador: number; total: number; etiqueta?: string }): string {
  const dados = t.dados.join(' + ');
  const suma = t.modificador ? `${dados} ${signo(t.modificador).replace(/^([+-])/, '$1 ')}` : dados;
  const critico = t.etiqueta?.startsWith('Daño crítico');
  return critico ? `(${suma}) × 2 = ${t.total}` : `${suma} = ${t.total}`;
}

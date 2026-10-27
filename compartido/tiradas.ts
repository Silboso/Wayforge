import { bonoDeDano, calcular, HABILIDADES, leerDados, leerExpresion, SALVACIONES, signo, type Personaje } from '../reglas/pf2e';
import { todasLasAptitudes } from '../reglas/aptitudes';
import { penalizaciones, type Condicion, type Contexto } from '../reglas/condiciones';
import type { EfectoActivo } from '../reglas/efectos';
import { penalizacionesAtaque } from '../reglas/criaturas';
import type { QueTirar, Token } from './sala';

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
export function queSeTira(p: Personaje, que: QueTirar, condiciones: Condicion[] = [], efectos: EfectoActivo[] = []): QueSeTira | null {
  const ficha = calcular(p, condiciones, efectos);
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
        modificador: bonoDeDano(p, golpe, condiciones, efectos),
        multiplicador: que.critico ? 2 : 1,
        esAtaque: false,
      };
    }
    case 'aptitud': {
      const a = todasLasAptitudes(p).find((x) => x.id === que.id);
      const t = a?.tirada;
      if (!a || !t) return null;
      const etiqueta = a.verbo || a.nombre;
      switch (t.tipo) {
        case 'skill': {
          const h = HABILIDADES.find((x) => x.clave === t.clave);
          return h ? d20(`${etiqueta} (${h.nombre})`, ficha.habilidades[h.clave].total) : null;
        }
        case 'percepcion':
          return d20(`${etiqueta} (Perception)`, ficha.percepcion.total);
        case 'ataque-conjuro':
          // Cuenta para la penalización por ataque múltiple, pero sus acciones las gasta el conjuro
          return ficha.conjuros ? d20(`${etiqueta} (ataque de conjuro)`, ficha.conjuros.ataque.total, true) : null;
        case 'expresion': {
          const leida = leerExpresion(t.expresion);
          return leida ? { etiqueta: `${etiqueta} (${t.expresion})`, ...leida, multiplicador: 1, esAtaque: false } : null;
        }
        case 'golpe': {
          // Con su primera arma, con la penalización que toque (fuera de su turno, la del 1.er ataque)
          const golpe = p.golpes[0];
          const calculado = ficha.golpes[0];
          if (!golpe || !calculado) return null;
          const n = que.numero ?? 0;
          return d20(`${etiqueta} (${golpe.nombre})`, calculado.penalizaciones[n], true);
        }
      }
      return null;
    }
    case 'libre':
    case 'criatura':
    case 'dano-criatura':
    case 'chequeo-criatura':
      return null;
  }
}

// Lo que tira una criatura del GM. Sus números ya vienen sumados; se agregan la penalización por ataque
// múltiple y lo que quiten sus condiciones (Frightened, Sickened…), igual que a un personaje.
export function queTiraCriatura(token: Pick<Token, 'nombre' | 'condiciones' | 'percepcion' | 'criatura' | 'efectos'>, que: QueTirar): QueSeTira | null {
  const cr = token.criatura;
  if (!cr) return null;
  const condiciones = token.condiciones ?? [];
  const resta = (contexto: Contexto) => penalizaciones(condiciones, contexto, token.efectos ?? []).reduce((s, x) => s + x.valor, 0);
  const d20 = (etiqueta: string, modificador: number, esAtaque = false): QueSeTira =>
    ({ etiqueta, dados: [{ cantidad: 1, caras: 20 }], modificador, multiplicador: 1, esAtaque });
  switch (que.tipo) {
    case 'criatura': {
      const a = cr.ataques.find((x) => x.id === que.ataque);
      if (!a || ![0, 1, 2].includes(que.numero)) return null;
      const cual = ['', ' (2.º ataque)', ' (3.º ataque)'][que.numero];
      const atributo = a.distancia && a.distancia > 10 ? 'dex' : 'str';
      return d20(`${a.nombre}${cual}`, penalizacionesAtaque(a)[que.numero] + resta({ tipo: 'ataque', atributo }), true);
    }
    case 'dano-criatura': {
      const a = cr.ataques.find((x) => x.id === que.ataque);
      const leida = a && leerExpresion(a.dano);
      if (!a || !leida) return null;
      return {
        etiqueta: `${que.critico ? 'Daño crítico' : 'Daño'} de ${a.nombre}${a.tipoDano ? ` (${a.tipoDano})` : ''}`,
        dados: leida.dados,
        modificador: leida.modificador + resta({ tipo: 'dano', conFuerza: !(a.distancia && a.distancia > 10) }),
        multiplicador: que.critico ? 2 : 1,
        esAtaque: false,
      };
    }
    case 'chequeo-criatura': {
      if (que.clave === 'percepcion') return d20('Perception', (token.percepcion ?? 0) + resta({ tipo: 'chequeo', atributo: 'wis', clase: 'percepcion' }));
      const s = SALVACIONES.find((x) => x.clave === que.clave);
      return s ? d20(s.nombre, cr.salvaciones[s.clave] + resta({ tipo: 'chequeo', atributo: s.atributo, salvacion: s.clave })) : null;
    }
    default:
      return null;
  }
}

export function textoTirada(t: { dados: number[]; modificador: number; total: number; etiqueta?: string }): string {
  const dados = t.dados.join(' + ');
  const suma = t.modificador ? `${dados} ${signo(t.modificador).replace(/^([+-])/, '$1 ')}` : dados;
  const critico = t.etiqueta?.startsWith('Daño crítico');
  return critico ? `(${suma}) × 2 = ${t.total}` : `${suma} = ${t.total}`;
}

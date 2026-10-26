import {
  ACCIONES_COMUNES, disponibilidad, GRUPOS, grupoDe, recursosDe, todasLasAptitudes,
  type Aptitud, type Disponibilidad, type Grupo,
} from '../../../reglas/aptitudes';
import { calcular, HABILIDADES, signo, type FichaCalculada, type Golpe, type Personaje, type Valor } from '../../../reglas/pf2e';
import type { Condicion } from '../../../reglas/condiciones';

// Una fila de la lista de acciones: un arma o una aptitud
export type Fila =
  | { clave: string; tipo: 'golpe'; golpe: Golpe; indice: number; nombre: string; detalle: string; valor: string; cuenta: Valor }
  | { clave: string; tipo: 'aptitud'; aptitud: Aptitud; disp: Disponibilidad; nombre: string; detalle: string; valor: string | null; cuenta: Valor | null };

export interface Seccion {
  id: 'turno' | Grupo;
  titulo: string;
  ayuda: string;
  // "1 de 2 de foco", "rango 1: 1 de 2"
  resumen: string | null;
  filas: Fila[];
}

// Lo que se tira con una aptitud, ya calculado (para mostrar el número y su cuenta)
function cuentaDe(a: Aptitud, ficha: FichaCalculada): Valor | null {
  const t = a.tirada;
  if (!t) return null;
  switch (t.tipo) {
    case 'skill': return ficha.habilidades[t.clave];
    case 'percepcion': return ficha.percepcion;
    case 'ataque-conjuro': return ficha.conjuros?.ataque ?? null;
    case 'expresion': return null;
    case 'golpe': return ficha.golpes[0]?.ataque ?? null;
  }
}

function filaAptitud(p: Personaje, a: Aptitud, ficha: FichaCalculada): Fila {
  const cuenta = cuentaDe(a, ficha);
  const habilidad = a.tirada?.tipo === 'skill' ? HABILIDADES.find((h) => h.clave === (a.tirada as { clave: string }).clave)?.nombre : null;
  const valor = cuenta
    ? signo(cuenta.total)
    : a.tirada?.tipo === 'expresion'
      ? a.tirada.expresion
      : a.id === 'basica:stride'
        ? `${p.velocidad} ft`
        : null;
  return {
    clave: a.id,
    tipo: 'aptitud',
    aptitud: a,
    disp: disponibilidad(p, a),
    nombre: a.verbo || a.nombre,
    detalle: [a.verbo ? a.nombre : null, habilidad].filter(Boolean).join(' · '),
    valor,
    cuenta,
  };
}

// Arma la hoja de acciones: primero "Tu turno" (armas y lo más común), luego cada grupo según cómo se recupera.
// `ataquesHechos` decide qué penalización por ataque múltiple se muestra (null fuera de su turno: el 1.º).
export function secciones(p: Personaje, condiciones: Condicion[], ataquesHechos: number | null): Seccion[] {
  const ficha = calcular(p, condiciones);
  const r = recursosDe(p);
  const n = Math.min(ataquesHechos ?? 0, 2);
  const ordinal = ['', ' · 2.º ataque', ' · 3.º ataque'][n];

  const golpes: Fila[] = p.golpes.map((g, i) => ({
    clave: `golpe:${g.id}`,
    tipo: 'golpe',
    golpe: g,
    indice: i,
    nombre: n === 0 ? `Atacar con ${g.nombre || 'arma'}` : 'Atacar otra vez',
    detalle: `Strike${n === 0 ? '' : ` con ${g.nombre}`}${ordinal}`,
    valor: signo(ficha.golpes[i]!.penalizaciones[n]!),
    cuenta: ficha.golpes[i]!.ataque,
  }));

  const todas = todasLasAptitudes(p);
  const comunes = ACCIONES_COMUNES.map((id) => todas.find((a) => a.id === id)).filter((a): a is Aptitud => !!a);
  const resto = todas.filter((a) => !ACCIONES_COMUNES.includes(a.id));

  const lista: Seccion[] = [{
    id: 'turno',
    titulo: 'Tu turno',
    ayuda: 'Tus armas y lo que más se usa en combate.',
    resumen: null,
    filas: [...golpes, ...comunes.map((a) => filaAptitud(p, a, ficha))],
  }];

  const orden: Grupo[] = ['siempre', 'foco', 'espacios', 'frecuencia', 'consumibles', 'reacciones', 'fuera'];
  for (const grupo of orden) {
    const delGrupo = resto.filter((a) => grupoDe(a) === grupo);
    if (delGrupo.length === 0) continue;
    // Los conjuros por rango, de menor a mayor
    if (grupo === 'espacios') delGrupo.sort((x, y) => rangoDe(x) - rangoDe(y));
    lista.push({
      id: grupo,
      titulo: GRUPOS[grupo].titulo,
      ayuda: GRUPOS[grupo].ayuda,
      resumen: grupo === 'foco'
        ? `${r.foco.actual} de ${r.foco.max} de foco`
        : grupo === 'espacios'
          ? r.espacios.map((e) => `rango ${e.rango}: ${e.max - e.usados} de ${e.max}`).join(' · ') || 'sin espacios'
          : null,
      filas: delGrupo.map((a) => filaAptitud(p, a, ficha)),
    });
  }
  return lista;
}

function rangoDe(a: Aptitud): number {
  return a.recuperacion.tipo === 'espacio' ? a.recuperacion.rango : 0;
}

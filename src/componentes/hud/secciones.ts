import {
  ACCIONES_COMUNES, disponibilidad, GRUPOS, grupoDe, recursosDe, todasLasAptitudes,
  type Aptitud, type Disponibilidad, type Grupo,
} from '../../../reglas/aptitudes';
import { calcular, HABILIDADES, signo, type FichaCalculada, type Golpe, type Personaje, type Valor } from '../../../reglas/pf2e';
import type { Condicion } from '../../../reglas/condiciones';
import { interaccionDe } from '../../../reglas/interacciones';
import type { EfectoActivo } from '../../../reglas/efectos';

// Una fila de la lista de acciones: un arma o una aptitud
export type Fila =
  | { clave: string; tipo: 'golpe'; golpe: Golpe; indice: number; nombre: string; detalle: string; valor: string; cuenta: Valor }
  | { clave: string; tipo: 'aptitud'; aptitud: Aptitud; disp: Disponibilidad; nombre: string; detalle: string; valor: string | null; cuenta: Valor | null };

// Los atajos de teclado, acomodados como en League of Legends: Q W E R las principales, D F las de apoyo y
// 1–4 para objetos. El jugador los llena como quiera (arrastrando acciones a la barra)
export const TECLAS = ['Q', 'W', 'E', 'R', 'D', 'F', '1', '2', '3', '4'];

export interface Seccion {
  id: 'turno' | 'acciones' | Grupo;
  titulo: string;
  ayuda: string;
  // "1 de 2 de foco", "rango 1: 1 de 2"
  resumen: string | null;
  filas: Fila[];
  // Solo "Tu turno": los espacios de atajo, en orden (vacío = null)
  ranuras?: (Fila | null)[];
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
export function secciones(p: Personaje, condiciones: Condicion[], ataquesHechos: number | null, efectos: EfectoActivo[] = []): Seccion[] {
  const ficha = calcular(p, condiciones, efectos);
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
  // Levantar el escudo solo si lleva uno (en la hoja, en la mochila o con Shield Block)
  const conEscudo = !!p.escudo || (p.inventario ?? []).some((o) => /\bshield\b|escudo/i.test(o.nombre))
    || (p.aptitudes ?? []).some((x) => /shield block/i.test(x.nombre));
  const comunes = ACCIONES_COMUNES.filter((id) => id !== 'basica:raise-shield' || conEscudo)
    .map((id) => todas.find((a) => a.id === id)).filter((a): a is Aptitud => !!a);
  const resto = todas.filter((a) => !ACCIONES_COMUNES.includes(a.id));

  const basicas = [...golpes, ...comunes.map((a) => filaAptitud(p, a, ficha))];
  const lista: Seccion[] = [{
    id: 'acciones',
    titulo: 'Acciones',
    ayuda: 'Tus armas y las acciones de siempre: atacar, moverte, levantar el escudo…',
    resumen: null,
    filas: basicas,
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
  // Los atajos: los que eligió el jugador, o lo primero de sus acciones si nunca los cambió
  const porClave = new Map(lista.flatMap((s) => s.filas).map((f) => [f.clave, f]));
  // Sin elegir: el arma, moverse y lo que más hace en Q W E R D F (un lanzador, sus trucos que dañan); los objetos en 1–4
  const objetos = resto.filter((a) => a.categoria === 'objeto').slice(0, 4).map((a) => a.id);
  const trucos = resto.filter((a) => (a.categoria === 'truco' || a.categoria === 'conjuro') && a.recuperacion.tipo === 'siempre' && !!interaccionDe(a)?.dano).slice(0, 2).map((a) => a.id);
  const primeras = [...basicas.slice(0, 3).map((f) => f.clave), ...trucos, ...basicas.slice(3).map((f) => f.clave)];
  const claves = p.atajos ?? [...[...new Set(primeras)].slice(0, 6), ...objetos];
  const ranuras = TECLAS.map((_, i) => (claves[i] ? porClave.get(claves[i]!) ?? null : null));
  return [{
    id: 'turno',
    titulo: 'Tu turno',
    ayuda: tactil()
      ? 'Lo que más usas, a un toque. Para cambiarlo, arrastra acciones a la barra en una pantalla grande.'
      : 'Tus atajos: Q W E R, D F y 1–4. Arrastra acciones a la barra de habilidades para cambiarlos.',
    resumen: null,
    filas: ranuras.filter((f): f is Fila => !!f),
    ranuras,
  }, ...lista];
}

// En un teléfono o tableta no hay teclas que nombrar
function tactil() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

// Los atajos con una fila puesta en el espacio `i` (si ya estaba en otro, cambian de lugar)
export function ponerAtajo(ranuras: (Fila | null)[], i: number, clave: string | null): (string | null)[] {
  const claves = ranuras.map((f) => f?.clave ?? null);
  const antes = clave ? claves.indexOf(clave) : -1;
  if (antes >= 0) claves[antes] = claves[i] ?? null;
  claves[i] = clave;
  return claves;
}

// Si una fila se usa contra alguien, y hasta dónde llega (pies; null si no tiene límite en la ficha)
export function alcanceDe(p: Personaje, fila: Fila): { pies: number | null } | null {
  if (fila.tipo === 'golpe') return { pies: fila.golpe.distancia ?? 5 };
  const a = fila.aptitud;
  const t = a.tirada;
  // Con interacción: hasta dónde llega contra alguien, dónde puede estallar un área o lo que cubre una emanación
  const i = interaccionDe(a);
  if (i && a.costo !== 'larga') {
    const o = i.objetivos;
    if (o.tipo === 'yo') return null;
    if (o.tipo === 'area') return { pies: o.area.forma === 'explosion' ? a.distancia ?? null : o.area.tamano };
    return { pies: t?.tipo === 'golpe' ? p.golpes[0]?.distancia ?? 5 : a.distancia ?? 5 };
  }
  if (!t || a.costo === 'larga') return null;
  if (t.tipo === 'golpe') return { pies: p.golpes[0]?.distancia ?? 5 };
  if (t.tipo === 'ataque-conjuro') return { pies: a.distancia ?? null };
  if (t.tipo === 'skill' && a.distancia) return { pies: a.distancia };
  return null;
}

function rangoDe(a: Aptitud): number {
  return a.recuperacion.tipo === 'espacio' ? a.recuperacion.rango : 0;
}

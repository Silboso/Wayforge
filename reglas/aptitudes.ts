// Aptitudes: todo lo que un personaje puede hacer además de atacar con sus armas.
// Se agrupan por cómo se recuperan, que es lo que más confunde al empezar: lo que se usa siempre,
// lo que gasta foco, lo que gasta un espacio de conjuro, lo que tiene frecuencia y lo que se acaba.

import type { Atributo, ClaveHabilidad, Personaje, Rango } from './pf2e';
import { CONDICIONES, type ClaveCondicion } from './condiciones';
import { MOMENTOS_VALIDOS, type Momento } from './disparadores';
import { esInteraccionValida, type Interaccion } from './interacciones';
import { gastarConsumible } from './objetos';

// ◆, ◆◆, ◆◆◆, reacción, acción libre, o una actividad que lleva minutos (fuera de combate)
export type Costo = 1 | 2 | 3 | 'reaccion' | 'libre' | 'larga';

export type Periodo = 'turno' | '10min' | 'hora' | 'dia';

export type Recuperacion =
  // A voluntad: acciones básicas, trucos (cantrips)
  | { tipo: 'siempre' }
  // Gasta 1 punto de foco; se recupera con Refocus
  | { tipo: 'foco' }
  // Gasta un espacio de conjuro de ese rango; vuelven al descansar
  | { tipo: 'espacio'; rango: number }
  // Tantas veces por período ("una vez por día", "una vez cada 10 minutos")
  | { tipo: 'frecuencia'; veces: number; periodo: Periodo }
  // Se acaba: pociones, pergaminos, flechas especiales
  | { tipo: 'consumible'; cantidad: number };

export type Categoria = 'accion' | 'truco' | 'conjuro' | 'foco' | 'dote' | 'objeto';

// Qué se tira al usarla
export type TiradaAptitud =
  | { tipo: 'skill'; clave: ClaveHabilidad }
  | { tipo: 'percepcion' }
  | { tipo: 'ataque-conjuro' }
  | { tipo: 'expresion'; expresion: string }
  // Un Strike con su primera arma (Reactive Strike, Power Attack…)
  | { tipo: 'golpe' };

export interface Aptitud {
  id: string;
  // Nombre de las reglas (en inglés) y el verbo en español que se lee primero
  nombre: string;
  verbo: string;
  categoria: Categoria;
  costo: Costo;
  recuperacion: Recuperacion;
  descripcion: string;
  rasgos: string[];
  tirada?: TiradaAptitud;
  // Daño si acierta (conjuros de ataque): "2d4"; un Strike usa el de su arma
  dano?: string;
  // Hasta dónde llega contra un objetivo, en pies (Ray of Frost: 120). Sin valor: al lado (5 ft)
  distancia?: number;
  // En qué momentos sirve: la mesa avisa entonces
  disparadores?: Momento[];
  // Solo se puede usar con esta condición puesta (Shield Block necesita el escudo levantado)
  requiere?: ClaveCondicion;
  efecto?: {
    // Bono a tu CA contra el ataque que la disparó (Nimble Dodge)
    bonoCA?: number;
    // Te pone una condición hasta el inicio de tu próximo turno (Raise a Shield)
    aplica?: ClaveCondicion;
  };
  // Conjuros que suben con el rango ("Heightened (+1): +2d6"): desde qué rango, cada cuántos y cuánto suma.
  // Los trucos y los de foco suben solos con el nivel (la mitad, redondeando hacia arriba)
  potenciado?: { base: number; cada: number; mas: string };
  // Qué hace al alcanzar a alguien: salvaciones, grados, áreas, efectos (ver reglas/interacciones.ts).
  // Sin valor, el motor la busca en su catálogo por el nombre o la lee de su texto.
  interaccion?: Interaccion;
}

export interface Lanzador {
  tradicion: 'arcane' | 'divine' | 'occult' | 'primal';
  atributo: Atributo;
  rango: Rango;
}

export interface Recursos {
  foco: { max: number; actual: number };
  espacios: { rango: number; max: number; usados: number }[];
  // Veces que se usó cada aptitud con frecuencia, en su período actual
  usos: Record<string, number>;
}

export const RECURSOS_VACIOS: Recursos = { foco: { max: 0, actual: 0 }, espacios: [], usos: {} };

export function recursosDe(p: Personaje): Recursos {
  return p.recursos ?? RECURSOS_VACIOS;
}

export const PERIODOS: Record<Periodo, string> = {
  turno: 'por turno',
  '10min': 'cada 10 minutos',
  hora: 'por hora',
  dia: 'por día',
};

export const TRADICIONES: Record<Lanzador['tradicion'], string> = {
  arcane: 'Arcane',
  divine: 'Divine',
  occult: 'Occult',
  primal: 'Primal',
};

// Las acciones básicas que todo personaje puede hacer, precargadas.
// Las del encabezado son las que más se usan en combate y salen primero en el turno.
const basica = (id: string, nombre: string, verbo: string, costo: Costo, descripcion: string, rasgos: string[] = [], tirada?: TiradaAptitud): Aptitud =>
  ({ id: `basica:${id}`, nombre, verbo, categoria: 'accion', costo, recuperacion: { tipo: 'siempre' }, descripcion, rasgos, ...(tirada ? { tirada } : {}) });

export const ACCIONES_BASICAS: Aptitud[] = [
  basica('stride', 'Stride', 'Moverte', 1, 'Te mueves hasta tu Velocidad. Pasar junto a un enemigo puede provocar su reacción.', ['move']),
  basica('step', 'Step', 'Paso corto', 1, 'Te mueves 5 ft con cuidado: no provoca reacciones. No sirve en terreno difícil.', ['move']),
  { ...basica('raise-shield', 'Raise a Shield', 'Levantar escudo', 1, 'Si llevas escudo, lo levantas: +2 a tu CA hasta tu próximo turno. Te deja usar Shield Block.'), efecto: { aplica: 'shield-raised' } },
  basica('demoralize', 'Demoralize', 'Asustar', 1, 'Asustas a un enemigo a 30 ft que te entienda. Tiras Intimidation contra su Will DC: con éxito queda Frightened 1 (Frightened 2 con crítico).', ['auditory', 'concentrate', 'emotion', 'fear', 'mental'], { tipo: 'skill', clave: 'intimidation' }),
  basica('seek', 'Seek', 'Buscar', 1, 'Buscas criaturas escondidas u objetos en un cono de 30 ft. Tiras Perception.', ['concentrate', 'secret'], { tipo: 'percepcion' }),
  basica('take-cover', 'Take Cover', 'Cubrirte', 1, 'Te pegas a una cobertura: mejora a cobertura mayor (+4 CA) o te da cobertura si estás Prone.'),
  basica('interact', 'Interact', 'Usar un objeto', 1, 'Agarras, sacas o guardas un objeto, abres una puerta, tomas una poción del cinturón…', ['manipulate']),
  basica('recall-knowledge', 'Recall Knowledge', 'Recordar', 1, 'Intentas recordar algo útil sobre una criatura o tema. El GM te dice qué skill tirar (Arcana, Nature, Religion…).', ['concentrate', 'secret']),
  basica('grapple', 'Grapple', 'Agarrar', 1, 'Agarras a un enemigo a tu alcance con una mano libre. Tiras Athletics contra su Fortitude DC: queda Grabbed (Restrained con crítico).', ['attack'], { tipo: 'skill', clave: 'athletics' }),
  basica('trip', 'Trip', 'Derribar', 1, 'Intentas tirar al suelo a un enemigo. Athletics contra su Reflex DC: queda Prone.', ['attack'], { tipo: 'skill', clave: 'athletics' }),
  basica('shove', 'Shove', 'Empujar', 1, 'Empujas a un enemigo 5 ft (10 ft con crítico). Athletics contra su Fortitude DC.', ['attack'], { tipo: 'skill', clave: 'athletics' }),
  basica('disarm', 'Disarm', 'Desarmar', 1, 'Intentas quitarle el arma. Athletics contra su Reflex DC.', ['attack'], { tipo: 'skill', clave: 'athletics' }),
  basica('escape', 'Escape', 'Escapar', 1, 'Intentas soltarte si estás Grabbed o Restrained. Athletics o Acrobatics contra la DC de quien te tiene.', ['attack'], { tipo: 'skill', clave: 'athletics' }),
  basica('hide', 'Hide', 'Esconderte', 1, 'Si tienes cobertura o estás oculto, tiras Stealth contra la Perception DC de los demás para quedar Hidden.', ['secret'], { tipo: 'skill', clave: 'stealth' }),
  basica('sneak', 'Sneak', 'Moverte sin ser visto', 1, 'Te mueves a la mitad de tu Velocidad intentando seguir escondido. Tiras Stealth.', ['move', 'secret'], { tipo: 'skill', clave: 'stealth' }),
  basica('drop-prone', 'Drop Prone', 'Tirarte al suelo', 1, 'Te tiras al suelo: quedas Prone.', ['move']),
  basica('stand', 'Stand', 'Levantarte', 1, 'Te levantas si estás Prone.', ['move']),
  basica('ready', 'Ready', 'Preparar', 2, 'Preparas una acción para un momento: "si se acerca, le pego". Cuando pasa, la usas como reacción.', ['concentrate']),
  basica('sustain', 'Sustain', 'Mantener', 1, 'Mantienes activo un conjuro o efecto que lo pida.', ['concentrate']),
  basica('aid', 'Aid', 'Ayudar', 'reaccion', 'Ayudas a un aliado con algo que preparaste antes: le das un bono a su tirada.'),
  basica('delay', 'Delay', 'Esperar', 'libre', 'Pasas tu turno para actuar más tarde en la ronda.'),
  basica('treat-wounds', 'Treat Wounds', 'Curar heridas', 'larga', 'Fuera de combate, 10 minutos: curas a un aliado con Medicine (necesitas herramientas de sanador).', ['exploration', 'healing'], { tipo: 'skill', clave: 'medicine' }),
];

// Hasta dónde llegan las que van contra alguien (en pies): Demoralize a 30 ft, las de agarre al lado
const DISTANCIAS: Record<string, number> = {
  'basica:demoralize': 30, 'basica:treat-wounds': 5, 'basica:grapple': 5, 'basica:trip': 5, 'basica:shove': 5, 'basica:disarm': 5,
};
for (const a of ACCIONES_BASICAS) if (DISTANCIAS[a.id]) a.distancia = DISTANCIAS[a.id];

// Las que salen primero en el turno; el resto queda bajo "más acciones"
export const ACCIONES_COMUNES = ['basica:stride', 'basica:step', 'basica:raise-shield', 'basica:demoralize', 'basica:seek'];

export function todasLasAptitudes(p: Personaje): Aptitud[] {
  return [...ACCIONES_BASICAS, ...(p.aptitudes ?? [])];
}

export interface Disponibilidad {
  puede: boolean;
  // "2 de 3", "1 punto de foco", "quedan 2"
  texto: string;
}

export function disponibilidad(p: Personaje, a: Aptitud): Disponibilidad {
  const r = recursosDe(p);
  const rec = a.recuperacion;
  switch (rec.tipo) {
    case 'siempre':
      return { puede: true, texto: 'a voluntad' };
    case 'foco':
      return { puede: r.foco.actual > 0, texto: `${r.foco.actual} de ${r.foco.max} de foco` };
    case 'espacio': {
      // Se puede lanzar con un espacio de su rango o mayor
      const libres = r.espacios.filter((e) => e.rango >= rec.rango).reduce((s, e) => s + Math.max(0, e.max - e.usados), 0);
      return { puede: libres > 0, texto: libres ? `${libres} espacio${libres === 1 ? '' : 's'} libre${libres === 1 ? '' : 's'}` : 'sin espacios' };
    }
    case 'frecuencia': {
      const usadas = r.usos[a.id] ?? 0;
      const quedan = Math.max(0, rec.veces - usadas);
      return { puede: quedan > 0, texto: `${quedan} de ${rec.veces} ${PERIODOS[rec.periodo]}` };
    }
    case 'consumible':
      return { puede: rec.cantidad > 0, texto: rec.cantidad ? `quedan ${rec.cantidad}` : 'se acabó' };
  }
}

// Gasta lo que cueste usarla. Devuelve los cambios a la ficha, o null si no se puede.
// `rango` elige con qué espacio se lanza un conjuro (por defecto, el más bajo que sirva).
export function usar(p: Personaje, aptitudId: string, rango?: number): Partial<Personaje> | null {
  const a = todasLasAptitudes(p).find((x) => x.id === aptitudId);
  if (!a || !disponibilidad(p, a).puede) return null;
  const r = recursosDe(p);
  const rec = a.recuperacion;
  switch (rec.tipo) {
    case 'siempre':
      return {};
    case 'foco':
      return { recursos: { ...r, foco: { ...r.foco, actual: r.foco.actual - 1 } } };
    case 'espacio': {
      const candidatos = r.espacios
        .filter((e) => e.rango >= rec.rango && e.usados < e.max && (rango === undefined || e.rango === rango))
        .sort((x, y) => x.rango - y.rango);
      const elegido = candidatos[0];
      if (!elegido) return null;
      return { recursos: { ...r, espacios: r.espacios.map((e) => (e === elegido ? { ...e, usados: e.usados + 1 } : e)) } };
    }
    case 'frecuencia':
      return { recursos: { ...r, usos: { ...r.usos, [a.id]: (r.usos[a.id] ?? 0) + 1 } } };
    case 'consumible':
      // Si viene de la mochila, se gasta de las dos; el último se va de la hoja
      return gastarConsumible(p, a);
  }
}

export type Descanso = 'refocus' | 'diario';

export const DESCANSOS: Record<Descanso, { nombre: string; ayuda: string }> = {
  refocus: { nombre: 'Refocus (10 minutos)', ayuda: 'Recuperas 1 punto de foco y lo que se usa "cada 10 minutos".' },
  diario: { nombre: 'Descanso largo (8 horas)', ayuda: 'Recuperas espacios de conjuro, foco y todo lo diario, y curas Con × nivel PG.' },
};

// Lo que vuelve con cada descanso
export function descansar(p: Personaje, tipo: Descanso, pgMax: number): Partial<Personaje> {
  const r = recursosDe(p);
  const resetear = (periodos: Periodo[]) => Object.fromEntries(
    Object.entries(r.usos).filter(([id]) => {
      const a = (p.aptitudes ?? []).find((x) => x.id === id);
      return !(a && a.recuperacion.tipo === 'frecuencia' && periodos.includes(a.recuperacion.periodo));
    }),
  );
  if (tipo === 'refocus') {
    return { recursos: { ...r, foco: { ...r.foco, actual: Math.min(r.foco.max, r.foco.actual + 1) }, usos: resetear(['turno', '10min']) } };
  }
  const curacion = Math.max(1, p.atributos.con * p.nivel);
  return {
    pgActual: Math.min(pgMax, p.pgActual + curacion),
    recursos: {
      foco: { ...r.foco, actual: r.foco.max },
      espacios: r.espacios.map((e) => ({ ...e, usados: 0 })),
      usos: {},
    },
  };
}

// Cómo se agrupan en la hoja: por cómo se recuperan
export type Grupo = 'siempre' | 'reacciones' | 'foco' | 'espacios' | 'frecuencia' | 'consumibles' | 'fuera';

export const GRUPOS: Record<Grupo, { titulo: string; ayuda: string }> = {
  siempre: { titulo: 'Siempre', ayuda: 'Acciones y trucos que puedes usar cuantas veces quieras.' },
  reacciones: { titulo: 'Reacciones', ayuda: 'Una por ronda, cuando pasa lo que piden; también en el turno de otros.' },
  foco: { titulo: 'Foco', ayuda: 'Cada uno gasta 1 punto de foco. Se recupera con Refocus (10 minutos).' },
  espacios: { titulo: 'Conjuros', ayuda: 'Cada conjuro gasta un espacio de su rango o mayor. Vuelven al descansar 8 horas.' },
  frecuencia: { titulo: 'Con límite', ayuda: 'Se pueden usar unas veces por turno, hora o día.' },
  consumibles: { titulo: 'Objetos', ayuda: 'Se gastan al usarlos: pociones, pergaminos, elixires.' },
  fuera: { titulo: 'Exploración', ayuda: 'Fuera de combate: actividades de minutos, como Treat Wounds.' },
};

export function grupoDe(a: Aptitud): Grupo {
  if (a.costo === 'larga') return 'fuera';
  if (a.costo === 'reaccion') return 'reacciones';
  switch (a.recuperacion.tipo) {
    case 'siempre': return 'siempre';
    case 'foco': return 'foco';
    case 'espacio': return 'espacios';
    case 'frecuencia': return 'frecuencia';
    case 'consumible': return 'consumibles';
  }
}

export function aptitudNueva(id: string): Aptitud {
  return {
    id, nombre: '', verbo: '', categoria: 'conjuro', costo: 2,
    recuperacion: { tipo: 'espacio', rango: 1 }, descripcion: '', rasgos: [],
  };
}

const COSTOS: unknown[] = [1, 2, 3, 'reaccion', 'libre', 'larga'];
const CATEGORIAS: unknown[] = ['accion', 'truco', 'conjuro', 'foco', 'dote', 'objeto'];
const PERIODOS_VALIDOS: unknown[] = ['turno', '10min', 'hora', 'dia'];

export function esAptitudValida(valor: unknown, esClaveHabilidad: (c: unknown) => boolean, esExpresion: (e: string) => boolean): boolean {
  if (typeof valor !== 'object' || valor === null) return false;
  const a = valor as Record<string, unknown>;
  const rec = a.recuperacion as Record<string, unknown> | undefined;
  const tirada = a.tirada as Record<string, unknown> | undefined;
  const entero = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  const texto = (t: unknown, max: number) => typeof t === 'string' && t.length <= max;
  const recValida = !!rec && (
    rec.tipo === 'siempre' || rec.tipo === 'foco'
    || (rec.tipo === 'espacio' && entero(rec.rango, 1, 10))
    || (rec.tipo === 'frecuencia' && entero(rec.veces, 1, 10) && PERIODOS_VALIDOS.includes(rec.periodo))
    || (rec.tipo === 'consumible' && entero(rec.cantidad, 0, 99)));
  const efecto = a.efecto as Record<string, unknown> | undefined;
  const efectoValido = efecto === undefined || (typeof efecto === 'object' && efecto !== null
    && (efecto.bonoCA === undefined || entero(efecto.bonoCA, 1, 4))
    && (efecto.aplica === undefined || (typeof efecto.aplica === 'string' && efecto.aplica in CONDICIONES)));
  const disparadoresValidos = a.disparadores === undefined
    || (Array.isArray(a.disparadores) && a.disparadores.length <= 9 && a.disparadores.every((m) => MOMENTOS_VALIDOS.includes(m)));
  const requiereValido = a.requiere === undefined || (typeof a.requiere === 'string' && a.requiere in CONDICIONES);
  const pot = a.potenciado as Record<string, unknown> | undefined;
  const potenciadoValido = pot === undefined || (typeof pot === 'object' && pot !== null && entero(pot.base, 0, 10) && entero(pot.cada, 1, 10)
    && typeof pot.mas === 'string' && /^(\d{1,2}d\d{1,2}|\d{1,3})$/.test(pot.mas));
  const tiradaValida = tirada === undefined || (
    (tirada.tipo === 'skill' && esClaveHabilidad(tirada.clave))
    || tirada.tipo === 'percepcion' || tirada.tipo === 'ataque-conjuro' || tirada.tipo === 'golpe'
    || (tirada.tipo === 'expresion' && typeof tirada.expresion === 'string' && esExpresion(tirada.expresion)));
  return texto(a.id, 100) && texto(a.nombre, 60) && (a.nombre as string).trim().length > 0 && texto(a.verbo, 60)
    && CATEGORIAS.includes(a.categoria) && COSTOS.includes(a.costo) && recValida && tiradaValida
    && efectoValido && disparadoresValidos && requiereValido && potenciadoValido
    && (a.interaccion === undefined || esInteraccionValida(a.interaccion, esExpresion))
    && (a.dano === undefined || (typeof a.dano === 'string' && esExpresion(a.dano)))
    && (a.distancia === undefined || entero(a.distancia, 5, 1000))
    && texto(a.descripcion, 2000) && Array.isArray(a.rasgos) && a.rasgos.length <= 12 && a.rasgos.every((r) => texto(r, 30));
}

export function esRecursosValido(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null) return false;
  const r = valor as Record<string, unknown>;
  const foco = r.foco as Record<string, unknown> | undefined;
  const entero = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  return !!foco && entero(foco.max, 0, 3) && entero(foco.actual, 0, 3)
    && Array.isArray(r.espacios) && r.espacios.length <= 10
    && r.espacios.every((e) => typeof e === 'object' && e !== null && entero(e.rango, 1, 10) && entero(e.max, 0, 9) && entero(e.usados, 0, 9))
    && typeof r.usos === 'object' && r.usos !== null && !Array.isArray(r.usos)
    && Object.values(r.usos).every((n) => entero(n, 0, 99));
}

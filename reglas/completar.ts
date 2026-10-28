// "Elegir por mí" en el creador: llena lo que falta del paso con lo que mejor le queda a la clase.
// Nunca cambia lo que el jugador ya eligió; la ascendencia, el trasfondo y la clase los elige él (son quién es).
import { HABILIDADES, type Atributo, type ClaveHabilidad } from './pf2e';
import { ASCENDENCIAS } from './datos/ascendencias';
import { TRASFONDOS } from './datos/trasfondos';
import { CLASES } from './datos/clases';
import { DOTES_GENERALES } from './datos/dotes';
import {
  atributosDe, conjurosAElegir, conjurosDisponibles, conjurosElegidos, dotesDeAscendencia, dotesDeClase, habilidadesAElegir,
  habilidadesDadas, libresDeAscendencia, necesitaDoteGeneral, tieneDote, trucosElegidos, type Eleccion, type Paso,
} from './creador';

// Qué atributos le sirven más, en orden: el clave primero; los de fuerza quieren aguante, los demás esquivar
export function prioridadAtributos(e: Eleccion): Atributo[] {
  const c = CLASES.find((x) => x.id === e.clase);
  const clave = e.atributoClave ?? c?.atributoClave[0] ?? 'str';
  const resto: Atributo[] = clave === 'str' ? ['con', 'dex', 'wis', 'int', 'cha'] : ['dex', 'con', 'wis', 'str', 'int', 'cha'];
  return [...new Set<Atributo>([clave, ...resto])];
}

// Los conjuros que más rinden al empezar, de más a menos; los demás van después, en el orden de la lista
const PREFERIDOS = [
  'electric-arc', 'shield', 'divine-lance', 'frostbite', 'ignition', 'telekinetic-projectile', 'vitality-lash', 'caustic-blast', 'daze',
  'needle-darts', 'detect-magic', 'guidance', 'stabilize', 'light',
  'heal', 'force-barrage', 'fear', 'bless', 'grease', 'sleep', 'command', 'soothe', 'runic-weapon', 'mystic-armor', 'sure-strike', 'harm',
];
const preferencia = (id: string) => { const i = PREFERIDOS.indexOf(id); return i < 0 ? PREFERIDOS.length : i; };
const mejores = (ids: string[]) => [...ids].sort((x, y) => preferencia(x) - preferencia(y));

export function completarPaso(e: Eleccion, paso: Paso): Partial<Eleccion> {
  const a = ASCENDENCIAS.find((x) => x.id === e.ascendencia);
  const c = CLASES.find((x) => x.id === e.clase);
  const t = TRASFONDOS.find((x) => x.id === e.trasfondo);
  switch (paso) {
    case 'ascendencia':
      return a && !e.herencia && a.herencias[0] ? { herencia: a.herencias[0].id } : {};
    case 'clase':
      return c?.subclase && !e.subclase && c.subclase.opciones[0] ? { subclase: c.subclase.opciones[0].id } : {};
    case 'atributos': {
      const orden = prioridadAtributos(e);
      const cambios: Partial<Eleccion> = {};
      if (c && !e.atributoClave) cambios.atributoClave = c.atributoClave.find((x) => x === orden[0]) ?? c.atributoClave[0]!;
      const conClave = { ...e, ...cambios };
      if (a) {
        const libres = libresDeAscendencia(conClave);
        const fijas = conClave.dosLibres ? [] : a.mejoras.filter((m) => m !== 'libre');
        const ya = conClave.mejorasAscendencia.slice(0, libres);
        const usadas = new Set([...fijas, ...ya.filter(Boolean)]);
        const nuevas = Array.from({ length: libres }, (_, i) => ya[i] ?? null).map((m) => {
          if (m) return m;
          const elegida = orden.find((x) => !usadas.has(x))!;
          usadas.add(elegida);
          return elegida;
        });
        if (nuevas.some((m, i) => m !== ya[i])) cambios.mejorasAscendencia = nuevas;
      }
      if (t) {
        const [t1, t2] = conClave.mejorasTrasfondo;
        // Una de las dos del trasfondo y otra libre
        const primera = t1 ?? t.mejoras.find((x) => x === orden.find((o) => t.mejoras.includes(o))) ?? t.mejoras[0];
        const segunda = t2 ?? orden.find((x) => x !== primera)!;
        if (primera !== t1 || segunda !== t2) cambios.mejorasTrasfondo = [primera, segunda];
      }
      const libres = conClave.mejorasLibres;
      if (libres.some((m) => !m)) {
        const usadas = new Set(libres.filter(Boolean));
        cambios.mejorasLibres = libres.map((m) => {
          if (m) return m;
          const elegida = orden.find((x) => !usadas.has(x))!;
          usadas.add(elegida);
          return elegida;
        });
      }
      return cambios;
    }
    case 'habilidades': {
      if (!c) return {};
      const total = habilidadesAElegir(e);
      const dadas = new Set(habilidadesDadas(e).map((h) => h.clave));
      const elegidas = [...e.habilidades];
      const tiene = (h: ClaveHabilidad) => dadas.has(h) || elegidas.includes(h);
      const valor = atributosDe(e);
      const porAtributo = (h: ClaveHabilidad) => valor[HABILIDADES.find((x) => x.clave === h)!.atributo as Atributo];
      // Primero, una de cada grupo de la clase (la del mejor atributo); después las demás, también por atributo
      for (const grupo of c.habilidadesAElegir) {
        if (elegidas.length >= total || grupo.some(tiene)) continue;
        elegidas.push([...grupo].sort((x, y) => porAtributo(y) - porAtributo(x))[0]!);
      }
      const resto = HABILIDADES.map((h) => h.clave as ClaveHabilidad).filter((h) => !tiene(h)).sort((x, y) => porAtributo(y) - porAtributo(x));
      while (elegidas.length < total && resto.length) elegidas.push(resto.shift()!);
      return elegidas.length !== e.habilidades.length ? { habilidades: elegidas } : {};
    }
    case 'dotes': {
      const cambios: Partial<Eleccion> = {};
      if (a && !tieneDote(e, 'ascendencia')) {
        const d = dotesDeAscendencia(e)[0];
        if (d) cambios.doteAscendencia = d.id;
      }
      if (c && !tieneDote(e, 'clase')) {
        const d = dotesDeClase(e)[0];
        if (d) cambios.doteClase = d.id;
      }
      if (necesitaDoteGeneral({ ...e, ...cambios }) && !tieneDote(e, 'general') && DOTES_GENERALES[0]) cambios.doteGeneral = DOTES_GENERALES[0].id;
      return cambios;
    }
    case 'conjuros': {
      const pide = conjurosAElegir(e);
      const cambios: Partial<Eleccion> = {};
      const faltanTrucos = pide.trucos - trucosElegidos(e);
      if (faltanTrucos > 0) {
        cambios.trucos = [...e.trucos, ...mejores(conjurosDisponibles(e, 0).map((x) => x.id).filter((id) => !e.trucos.includes(id))).slice(0, faltanTrucos)];
      }
      const faltan1 = pide.rango1 - conjurosElegidos(e);
      if (faltan1 > 0) {
        cambios.conjuros = [...e.conjuros, ...mejores(conjurosDisponibles(e, 1).map((x) => x.id).filter((id) => !e.conjuros.includes(id))).slice(0, faltan1)];
      }
      return cambios;
    }
    default:
      return {};
  }
}

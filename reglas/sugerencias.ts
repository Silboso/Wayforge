// Sugerencias para subir de nivel: ordena lo que se puede elegir y dice por qué, en palabras.
// Mira la ficha (atributo clave, skills, lo que ya usa en la mesa), los requisitos de cada dote y al grupo
// (lo que a nadie más le toca: curar, Thievery, Perception alta…). No decide: propone y explica.

import type { Indice } from './compendio';
import { CATALOGO_INTERACCIONES, claveDe } from './interacciones';
import { ascendenciaDe, claseDe, rangoMaximoSkill, type HuecoDote } from './nivel';
import { ATRIBUTOS, HABILIDADES, type Atributo, type ClaveHabilidad, type Personaje, type Rango } from './pf2e';

export interface Sugerencia<T> {
  item: T;
  puntos: number;
  razones: string[];
  // Por qué no se puede todavía (requisito que no cumple)
  falta?: string;
}

// Lo que el grupo ya cubre, para sugerir lo que falta
export interface Grupo {
  // Cuántos otros personajes tienen cada skill en Trained o más
  skills: Partial<Record<ClaveHabilidad, number>>;
  // Alguien más cura (conjuros de curación o Medicine en Expert)
  cura: boolean;
  tamano: number;
}

export function grupoDe(p: Personaje, otros: Personaje[]): Grupo {
  const skills: Partial<Record<ClaveHabilidad, number>> = {};
  for (const o of otros) for (const h of HABILIDADES) if (o.habilidades[h.clave] > 0) skills[h.clave] = (skills[h.clave] ?? 0) + 1;
  const cura = otros.some((o) => o.habilidades.medicine >= 2 || (o.aptitudes ?? []).some((a) => /heal|cura|soothe|vitality/i.test(`${a.nombre} ${a.rasgos.join(' ')}`)));
  return { skills, cura, tamano: otros.length + 1 };
}

const LIBROS_BASICOS = /Player Core|Core Rulebook|Beginner Box/;
const RANGOS_TEXTO: Record<string, Rango> = { trained: 1, expert: 2, master: 3, legendary: 4 };

// ¿Cumple un requisito? true / false, o null si no se puede saber (se le pregunta al GM)
export function cumple(p: Personaje, requisito: string): { ok: boolean | null; falta?: string } {
  const r = requisito.trim();
  const rango = /^(trained|expert|master|legendary) in (.+)$/i.exec(r);
  if (rango) {
    const pide = RANGOS_TEXTO[rango[1]!.toLowerCase()]!;
    const que = rango[2]!.toLowerCase();
    const h = HABILIDADES.find((x) => x.nombre.toLowerCase() === que);
    const tiene = h ? p.habilidades[h.clave] : que === 'perception' ? p.percepcion : que.includes('lore') ? ((p.saberes ?? []).some((s) => s.toLowerCase().includes(que.replace(/ lore$/, ''))) ? 1 : 0) : null;
    if (tiene === null) return { ok: null };
    return tiene >= pide ? { ok: true } : { ok: false, falta: `necesitas ${rango[1]} en ${rango[2]}` };
  }
  // El nombre de una dote: hay que tenerla
  const tieneDote = (p.dotes ?? []).some((d) => claveDe(d.nombre) === claveDe(r)) || (p.aptitudes ?? []).some((a) => claveDe(a.nombre) === claveDe(r));
  if (tieneDote) return { ok: true };
  if (/^[A-Z][\w' -]+$/.test(r) && r.split(' ').length <= 5 && !/\b(you|your|level|ability|spell|deity|focus|class|heritage)\b/i.test(r)) {
    return { ok: false, falta: `necesitas la dote ${r}` };
  }
  return { ok: null };
}

// Qué dotes caben en un hueco del nivel nuevo
export function dotesParaHueco(p: Personaje, hueco: HuecoDote, nivel: number, indice: Indice[]): Indice[] {
  const clase = claseDe(p);
  const ascendencia = ascendenciaDe(p);
  const tomadas = new Set([...(p.dotes ?? []).map((d) => d.id), ...(p.dotes ?? []).map((d) => claveDe(d.nombre))]);
  return indice.filter((x) => {
    if ((x.nivel ?? 1) > nivel || (x.nivel ?? 1) < 1 || tomadas.has(x.id) || tomadas.has(claveDe(x.nombre))) return false;
    if (hueco === 'clase') return x.resumen === 'class' && (x.rasgos.includes(clase) || (x.rasgos.includes('archetype') && (x.nivel ?? 0) >= 2));
    if (hueco === 'ascendencia') return x.resumen === 'ancestry' && x.rasgos.includes(ascendencia);
    if (hueco === 'skill') return x.resumen === 'skill';
    return x.resumen === 'general' || x.resumen === 'skill';
  });
}

// Los rasgos de lo que ya usa en la mesa (para buscar dotes que combinan)
function rasgosPropios(p: Personaje): Set<string> {
  const genericos = new Set(['concentrate', 'manipulate', 'move', 'attack', 'general', 'skill', 'class', 'cantrip', p.clase.toLowerCase()]);
  return new Set((p.aptitudes ?? []).flatMap((a) => a.rasgos).filter((r) => !genericos.has(r)));
}

const ACCION_EN_COMBATE = ['flourish', 'press', 'open', 'stance', 'reaction', 'aura', 'rage', 'composition', 'metamagic'];

export function sugerirDotes(p: Personaje, hueco: HuecoDote, nivel: number, indice: Indice[], grupo: Grupo): Sugerencia<Indice>[] {
  const propios = rasgosPropios(p);
  const mejorSkill = HABILIDADES.reduce((m, h) => (p.habilidades[h.clave] > p.habilidades[m.clave] || (p.habilidades[h.clave] === p.habilidades[m.clave] && p.atributos[h.atributo] > p.atributos[m.atributo]) ? h : m), HABILIDADES[0]);
  return dotesParaHueco(p, hueco, nivel, indice).map((x) => {
    const razones: string[] = [];
    let puntos = 0;
    let falta: string | undefined;
    for (const req of x.requisitos ?? []) {
      const c = cumple(p, req);
      if (c.ok === false) { falta = c.falta; break; }
    }
    if (!falta && x.requisitos?.length) { puntos += 2; razones.push('Cumples sus requisitos'); }
    if ((x.nivel ?? 1) >= nivel - 1) { puntos += 2; razones.push('De tu nivel: de las más fuertes'); }
    const combina = x.rasgos.filter((r) => propios.has(r));
    if (combina.length) { puntos += 3; razones.push(`Combina con lo tuyo (${combina.slice(0, 2).join(', ')})`); }
    if (x.rasgos.some((r) => ACCION_EN_COMBATE.includes(r))) { puntos += 1; razones.push('Se usa en combate'); }
    const habla = (x.requisitos ?? []).join(' ').toLowerCase();
    if (habla.includes(mejorSkill.nombre.toLowerCase())) { puntos += 3; razones.push(`Usa tu mejor skill (${mejorSkill.nombre})`); }
    if (!grupo.cura && (x.rasgos.includes('healing') || /medicine/.test(habla))) { puntos += 3; razones.push('Nadie más en el grupo cura'); }
    if (x.rasgos.includes('archetype')) { puntos -= 2; razones.push('De arquetipo: abre otra rama'); }
    if (x.rareza === 'common') puntos += 1;
    else { puntos -= x.rareza === 'uncommon' ? 1 : 3; razones.push(`${x.rareza === 'uncommon' ? 'Poco común' : 'Rara'}: pídela al GM`); }
    if (LIBROS_BASICOS.test(x.fuente)) { puntos += 1; razones.push('De los libros básicos'); }
    return { item: x, puntos: falta ? puntos - 100 : puntos, razones, ...(falta ? { falta } : {}) };
  }).sort((a, b) => b.puntos - a.puntos || (b.item.nivel ?? 0) - (a.item.nivel ?? 0) || a.item.nombre.localeCompare(b.item.nombre));
}

// La skill para subir: la de su mejor atributo, la que usa en sus acciones, la que al grupo le falta
export function sugerirSkills(p: Personaje, nivel: number, grupo: Grupo): Sugerencia<ClaveHabilidad>[] {
  const tope = rangoMaximoSkill(nivel);
  const usadas = new Map<ClaveHabilidad, string>();
  for (const a of p.aptitudes ?? []) if (a.tirada?.tipo === 'skill') usadas.set(a.tirada.clave, a.verbo || a.nombre);
  const clave = (p.claseCD?.atributo ?? p.lanzador?.atributo) as Atributo | undefined;
  return HABILIDADES.filter((h) => p.habilidades[h.clave] < tope).map((h) => {
    const razones: string[] = [];
    const rango = p.habilidades[h.clave];
    let puntos = p.atributos[h.atributo] * 1.5;
    if (p.atributos[h.atributo] >= 3) razones.push(`Con tu ${ATRIBUTOS[h.atributo].abrev} ${p.atributos[h.atributo] >= 0 ? '+' : ''}${p.atributos[h.atributo]}`);
    if (usadas.has(h.clave)) { puntos += 4; razones.push(`La usas en ${usadas.get(h.clave)}`); }
    if (rango >= 1) { puntos += 2; razones.push(`Pasa a ${['', 'Expert', 'Master', 'Legendary'][rango]}: abre dotes nuevas`); }
    if (!grupo.skills[h.clave] && grupo.tamano > 1) { puntos += 2; razones.push('Nadie más en el grupo la tiene'); }
    if (clave && h.atributo === clave) { puntos += 1; razones.push('Va con tu atributo clave'); }
    return { item: h.clave as ClaveHabilidad, puntos, razones };
  }).sort((a, b) => b.puntos - a.puntos);
}

// Los cuatro atributos para mejorar: el clave primero, luego lo que más le rinde
export function sugerirAtributos(p: Personaje, claves: string[]): Sugerencia<Atributo>[] {
  const clave = (claves.find((c) => c in ATRIBUTOS) ?? p.claseCD?.atributo ?? p.lanzador?.atributo) as Atributo | undefined;
  const golpeStr = p.golpes.some((g) => g.atributo === 'str');
  const golpeDex = p.golpes.some((g) => g.atributo === 'dex');
  const cabeDex = p.armadura.topeDex === null || p.atributos.dex < p.armadura.topeDex;
  return (Object.keys(ATRIBUTOS) as Atributo[]).map((a) => {
    const razones: string[] = [];
    let puntos = 0;
    if (a === clave) { puntos += 6; razones.push('Tu atributo clave: aciertas más y tu CD sube'); }
    if (a === 'con') { puntos += 3; razones.push('Más PG en cada nivel y mejor Fortitude'); }
    if (a === 'dex' && cabeDex) { puntos += 2; razones.push('Más CA y Reflex (tu armadura lo deja)'); }
    if (a === 'wis') { puntos += 2; razones.push('Mejor Perception (iniciativa) y Will'); }
    if (a === 'str' && golpeStr && a !== clave) { puntos += 2; razones.push('Tus golpes pegan más'); }
    if (a === 'dex' && golpeDex && a !== clave) { puntos += 2; razones.push('Tus golpes aciertan más'); }
    if (p.atributos[a] >= 4 && a !== clave) { puntos -= 3; razones.push('Ya está alto: este aumento cuenta la mitad'); }
    if (p.atributos[a] < 0) { puntos += 1; razones.push('Tapa un punto débil'); }
    return { item: a, puntos, razones };
  }).sort((a, b) => b.puntos - a.puntos);
}

const RASGOS_DANO = ['fire', 'cold', 'electricity', 'acid', 'force', 'sonic', 'void', 'vitality', 'spirit', 'mental', 'poison'];

// Conjuros nuevos: de su tradición, de su rango más alto, que la mesa automatiza, lo que al grupo le falta
export function sugerirConjuros(p: Personaje, rangoMax: number, indice: Indice[], grupo: Grupo): Sugerencia<Indice>[] {
  const tradicion = p.lanzador?.tradicion;
  if (!tradicion) return [];
  const ya = new Set((p.aptitudes ?? []).flatMap((a) => [a.id.replace(/^compendio:conjuro:/, ''), claveDe(a.nombre)]));
  return indice.filter((x) => x.resumen.startsWith('conjuro') && x.resumen.includes(tradicion) && (x.nivel ?? 1) >= 1 && (x.nivel ?? 1) <= rangoMax && !ya.has(x.id) && !ya.has(claveDe(x.nombre)))
    .map((x) => {
      const razones: string[] = [];
      let puntos = 0;
      if (x.nivel === rangoMax) { puntos += 3; razones.push('De tu rango más alto'); }
      if (CATALOGO_INTERACCIONES[claveDe(x.nombre)]) { puntos += 3; razones.push('La mesa lo resuelve sola'); }
      if (x.rasgos.some((r) => RASGOS_DANO.includes(r))) { puntos += 1; razones.push('Hace daño'); }
      if (!grupo.cura && x.rasgos.includes('healing')) { puntos += 4; razones.push('Nadie más en el grupo cura'); }
      if (x.rareza === 'common') puntos += 1;
      else { puntos -= 2; razones.push('Poco común: pídelo al GM'); }
      if (LIBROS_BASICOS.test(x.fuente)) { puntos += 1; razones.push('De los libros básicos'); }
      return { item: x, puntos, razones };
    }).sort((a, b) => b.puntos - a.puntos || (b.item.nivel ?? 0) - (a.item.nivel ?? 0));
}

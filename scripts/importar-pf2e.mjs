// Importa el contenido del sistema PF2e de Foundry (github.com/foundryvtt/pf2e, packs/pf2e) al compendio de Wayforge.
// Lee solo JSON (no ejecuta nada de la fuente) y escribe public/compendio/<tipo>/indice.json y sus trozos.
//
// Uso:
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/foundryvtt/pf2e.git ../pf2e-fuente
//   (cd ../pf2e-fuente && git sparse-checkout set packs/pf2e)
//   npm run compendio            # o: node scripts/importar-pf2e.mjs <carpeta packs/pf2e>
//
// El contenido es de Paizo bajo las licencias ORC y OGL; cada entrada guarda su licencia y su libro.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const fuente = process.argv[2] ?? '../pf2e-fuente/packs/pf2e';
const salida = 'public/compendio';
const POR_TROZO = 300;

if (!existsSync(fuente)) {
  console.error(`No encuentro ${fuente}. Mira el comentario de arriba para bajar los datos.`);
  process.exit(1);
}

// Todos los JSON de un paquete (con sus subcarpetas), salvo los de carpetas de Foundry
function leerPaquete(nombre) {
  const dir = join(fuente, nombre);
  if (!existsSync(dir)) return [];
  const docs = [];
  const recorrer = (d) => {
    for (const f of readdirSync(d)) {
      const ruta = join(d, f);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (f.endsWith('.json') && !f.startsWith('_')) {
        try { docs.push(JSON.parse(readFileSync(ruta, 'utf8'))); } catch { /* archivo raro: se salta */ }
      }
    }
  };
  recorrer(dir);
  return docs;
}

// ---------- Texto: de HTML de Foundry a texto legible ----------
const entidades = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&hellip;': '…', '&rsquo;': '’', '&lsquo;': '‘', '&rdquo;': '”', '&ldquo;': '“', '&times;': '×' };
export function limpiar(html) {
  if (!html || typeof html !== 'string') return '';
  let t = html;
  // @UUID[Compendium.pf2e.x.Item.Y]{Nombre} → Nombre ; sin etiqueta → el último trozo del enlace
  t = t.replace(/@(?:UUID|Compendium)\[([^\]]+)\](?:\{([^}]*)\})?/g, (_, ref, etiqueta) => etiqueta ?? ref.split('.').pop());
  // @Damage[2d6[fire]] o @Damage[(2d6+4)[slashing],1d6[fire]]{etiqueta}
  t = t.replace(/@Damage\[((?:[^[\]]|\[[^\]]*\])*)\](?:\{([^}]*)\})?/g, (_, cuerpo, etiqueta) => etiqueta ?? cuerpo.replace(/\[([^\],]+)(?:,[^\]]*)?\]/g, ' $1').replace(/[()]/g, '').replace(/\|.*$/, ''));
  // @Check[fortitude|dc:20|basic] → basic Fortitude DC 20
  t = t.replace(/@Check\[([^\]]+)\](?:\{([^}]*)\})?/g, (_, cuerpo, etiqueta) => {
    if (etiqueta) return etiqueta;
    const partes = cuerpo.split('|');
    const stat = partes[0].replace(/^type:/, '');
    const dc = partes.find((p) => p.startsWith('dc:'))?.slice(3);
    const basica = partes.includes('basic');
    return `${basica ? 'basic ' : ''}${stat[0].toUpperCase()}${stat.slice(1)}${dc && /^\d+$/.test(dc) ? ` DC ${dc}` : ''}`;
  });
  // @Template[emanation|distance:30]{30-foot emanation}
  t = t.replace(/@Template\[([^\]]+)\](?:\{([^}]*)\})?/g, (_, cuerpo, etiqueta) => {
    if (etiqueta) return etiqueta;
    const [forma, ...resto] = cuerpo.split('|');
    const dist = resto.find((p) => p.startsWith('distance:'))?.slice(9);
    return dist ? `${dist}-foot ${forma.replace('type:', '')}` : forma;
  });
  t = t.replace(/@Localize\[[^\]]+\]/g, '');
  // [[/r 1d4]]{etiqueta} o [[/br 2d6 #fuego]]
  t = t.replace(/\[\[\/b?r\s+([^\]#]+?)(?:\s*#[^\]]*)?\]\](?:\{([^}]*)\})?/g, (_, dados, etiqueta) => etiqueta ?? dados.replace(/\[([^\]]+)\]/g, ' $1').trim());
  t = t.replace(/\[\[[^\]]*\]\]/g, '');
  t = t.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d|tr|div)>/gi, '\n').replace(/<hr\s*\/?>/gi, '\n—\n').replace(/<li>/gi, '• ');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/&[a-z#0-9]+;/gi, (e) => entidades[e] ?? e);
  return t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------- Utilidades ----------
const rasgosDe = (s) => (s?.traits?.value ?? []).filter((x) => typeof x === 'string');
const rarezaDe = (s) => s?.traits?.rarity ?? 'common';
// Los PNJ y peligros guardan nivel y libro en details; los objetos, conjuros y dotes, arriba
const publicacion = (s) => s?.publication ?? s?.details?.publication;
const fuenteDe = (s) => publicacion(s)?.title || s?.source?.value || '';
const licenciaDe = (s) => publicacion(s)?.license || 'OGL';
const nivelDe = (s) => {
  const v = s?.level?.value ?? s?.details?.level?.value;
  return typeof v === 'number' ? v : null;
};
// Unos pocos datos de la fuente traen dados que no existen (1d41, 2d18): se lleva cada uno al dado válido más cercano
const DADOS = [2, 4, 6, 8, 10, 12, 20, 100];
const arreglarDados = (formula) => formula.replace(/(\d*)d(\d+)/g, (_, n, caras) => {
  const c = Number(caras);
  const mejor = DADOS.includes(c) ? c : DADOS.reduce((a, b) => (Math.abs(b - c) < Math.abs(a - c) ? b : a));
  return `${n}d${mejor}`;
});
const slug = (d) => (d.system?.slug || d.name || d._id).toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Foundry: actionType action/reaction/free/passive y actions 1-3
function costoDe(s) {
  const tipo = s?.actionType?.value;
  if (tipo === 'reaction') return 'reaccion';
  if (tipo === 'free') return 'libre';
  if (tipo === 'action') return Math.min(3, Math.max(1, Number(s?.actions?.value) || 1));
  return null;
}

// "2" → 2, "reaction" → reacción, "1 to 3" → 2 (lo más común) con el texto aparte, "10 minutes" → larga
function costoDeTiempo(valor) {
  const v = String(valor ?? '').trim().toLowerCase();
  if (/^[123]$/.test(v)) return { costo: Number(v), tiempo: '' };
  if (v === 'reaction') return { costo: 'reaccion', tiempo: '' };
  if (v === 'free') return { costo: 'libre', tiempo: '' };
  const rango = /^(\d)\s*(?:to|-)\s*(\d)$/.exec(v);
  if (rango) return { costo: Number(rango[1]) === 1 && Number(rango[2]) === 3 ? 2 : Number(rango[2]), tiempo: `${rango[1]} a ${rango[2]} acciones` };
  return { costo: v ? 'larga' : null, tiempo: v };
}

const pies = (texto) => {
  const v = String(texto ?? '').toLowerCase();
  if (!v) return null;
  if (v.includes('touch')) return 0;
  const m = /(\d+)\s*(?:feet|foot|ft)/.exec(v);
  return m ? Number(m[1]) : null;
};

// Precio en piezas de plata
const precioDe = (s) => {
  const p = s?.price?.value ?? {};
  return Math.round(((p.pp ?? 0) * 100 + (p.gp ?? 0) * 10 + (p.sp ?? 0) + (p.cp ?? 0) / 10) * 10) / 10;
};
const bultoDe = (s) => {
  const b = s?.bulk?.value;
  if (typeof b === 'number') return b;
  if (b === 'L') return 0.1;
  return Number(b) || 0;
};

const TAMANOS = { tiny: 'Tiny', sm: 'Small', med: 'Medium', lg: 'Large', huge: 'Huge', grg: 'Gargantuan' };
const base = (d) => ({
  id: slug(d), nombre: d.name, nivel: nivelDe(d.system), rasgos: rasgosDe(d.system), rareza: rarezaDe(d.system),
  fuente: fuenteDe(d.system), licencia: licenciaDe(d.system), descripcion: limpiar(d.system?.description?.value),
});

// ---------- Criaturas ----------
function criatura(d) {
  const s = d.system;
  const ataques = [];
  const aptitudes = [];
  for (const it of d.items ?? []) {
    const is = it.system ?? {};
    if (it.type === 'melee') {
      const rolls = Object.values(is.damageRolls ?? {});
      const dano = rolls.map((r) => String(r.damage).replace(/\s/g, '')).join('+') || '1';
      const rasgos = rasgosDe(is);
      const alcance = rasgos.map((r) => /^reach-(\d+)$/.exec(r)?.[1]).find(Boolean);
      const distancia = is.range?.increment ?? (typeof is.range === 'number' ? is.range : null) ?? (alcance ? Number(alcance) : null);
      ataques.push({
        id: slug(it) || it._id, nombre: it.name, bono: Number(is.bonus?.value) || 0,
        dano: arreglarDados(/^[\dd+\-]+$/i.test(dano) ? dano : dano.replace(/[^\dd+\-]/gi, '') || '1'),
        tipoDano: rolls[0]?.damageType ?? '', agil: rasgos.includes('agile'), rasgos,
        ...(distancia && distancia > 5 ? { distancia } : {}),
        ...(rolls.length > 1 ? { extra: rolls.slice(1).map((r) => `${r.damage} ${r.damageType}`).join(', ') } : {}),
        ...(is.attackEffects?.value?.length ? { efectos: is.attackEffects.value } : {}),
      });
    } else if (it.type === 'action') {
      aptitudes.push({ nombre: it.name, costo: costoDe(is), texto: limpiar(is.description?.value) });
    } else if (it.type === 'spellcastingEntry') {
      aptitudes.push({ nombre: it.name, costo: null, texto: `${is.tradition?.value ?? ''} ${is.prepared?.value ?? ''} · DC ${is.spelldc?.dc ?? '—'}, ataque +${is.spelldc?.value ?? '—'}`.trim() });
    }
  }
  const conjuros = (d.items ?? []).filter((it) => it.type === 'spell').map((it) => `${it.name} (${it.system?.traits?.value?.includes('cantrip') ? 'truco' : `rango ${it.system?.location?.heightenedLevel ?? it.system?.level?.value}`})`);
  if (conjuros.length) aptitudes.push({ nombre: 'Conjuros', costo: null, texto: conjuros.join(', ') });
  const defensa = (xs) => (xs ?? []).map((x) => ({ tipo: String(x.type ?? '').replace(/-/g, ' '), valor: Number(x.value) || 0 }));
  return {
    ...base(d),
    descripcion: limpiar(s.details?.publicNotes),
    tamano: TAMANOS[s.traits?.size?.value] ?? 'Medium',
    ca: s.attributes?.ac?.value ?? 10,
    pg: s.attributes?.hp?.max ?? 1,
    percepcion: s.perception?.mod ?? 0,
    sentidos: (s.perception?.senses ?? []).map((x) => [x.type, x.acuity, x.range].filter(Boolean).join(' ')),
    idiomas: s.details?.languages?.value ?? [],
    velocidad: s.attributes?.speed?.value ?? 25,
    otrasVelocidades: (s.attributes?.speed?.otherSpeeds ?? []).map((x) => `${x.type} ${x.value} ft`),
    salvaciones: { fortitude: s.saves?.fortitude?.value ?? 0, reflex: s.saves?.reflex?.value ?? 0, will: s.saves?.will?.value ?? 0 },
    habilidades: Object.entries(s.skills ?? {}).map(([k, v]) => ({ nombre: k[0].toUpperCase() + k.slice(1), bono: v.base ?? v.value ?? 0 })),
    ataques,
    defensas: {
      inmunidades: (s.attributes?.immunities ?? []).map((x) => String(x.type ?? '').replace(/-/g, ' ')),
      resistencias: defensa(s.attributes?.resistances),
      debilidades: defensa(s.attributes?.weaknesses),
    },
    aptitudes,
  };
}

// ---------- Conjuros ----------
function conjuro(d) {
  const s = d.system;
  const rasgos = rasgosDe(s);
  const truco = rasgos.includes('cantrip');
  const { costo, tiempo } = costoDeTiempo(s.time?.value);
  const save = s.defense?.save;
  const defensa = save?.statistic ?? (rasgos.includes('attack') ? 'ataque' : null);
  const hz = s.heightening;
  let potenciado = '';
  if (hz?.type === 'interval') {
    const dmg = Object.values(hz.damage ?? {}).join(' y ');
    potenciado = `Cada ${hz.interval === 1 ? 'rango' : `${hz.interval} rangos`} más: ${dmg ? `+${dmg} al daño` : 'mejora'}`;
  } else if (hz?.type === 'fixed') {
    potenciado = `Mejora en ${Object.keys(hz.levels ?? {}).map((n) => `rango ${n}`).join(', ')}`;
  }
  return {
    ...base(d),
    nivel: truco ? 0 : nivelDe(s),
    rango: truco ? 0 : nivelDe(s) ?? 1,
    tradiciones: s.traits?.traditions ?? [],
    costo, tiempo,
    distancia: pies(s.range?.value),
    area: s.area ? `${s.area.value}-foot ${s.area.type}` : '',
    objetivos: s.target?.value ?? '',
    duracion: s.duration?.value ?? '',
    defensa, basica: !!save?.basic,
    dano: Object.values(s.damage ?? {}).map((x) => ({ formula: String(x.formula ?? ''), tipo: x.type ?? '' })).filter((x) => x.formula),
    potenciado,
    clase: s.ritual ? 'ritual' : rasgos.includes('focus') ? 'foco' : truco ? 'truco' : 'conjuro',
  };
}

// ---------- Dotes y acciones ----------
const dote = (d) => ({
  ...base(d),
  categoria: d.system.category ?? '',
  costo: costoDe(d.system),
  prerrequisitos: (d.system.prerequisites?.value ?? []).map((p) => p.value).filter(Boolean),
  frecuencia: d.system.frequency ? `${d.system.frequency.max ?? 1}/${d.system.frequency.per ?? ''}` : '',
});
const accion = (d) => ({ ...base(d), costo: costoDe(d.system), categoria: d.system.category ?? '' });

// ---------- Equipo ----------
function equipo(d) {
  const s = d.system;
  const e = { ...base(d), clase: d.type, precio: precioDe(s), bulto: bultoDe(s) };
  if (d.type === 'weapon') {
    e.arma = {
      categoria: s.category ?? '', grupo: s.group ?? '',
      dados: s.damage?.dice && s.damage?.die ? `${s.damage.dice}${s.damage.die}` : '',
      tipoDano: s.damage?.damageType ?? '',
      manos: String(s.usage?.value ?? '').includes('two') ? 2 : 1,
      distancia: typeof s.range === 'number' ? s.range : null,
      recarga: s.reload?.value ?? null,
    };
  } else if (d.type === 'armor') {
    e.armadura = { categoria: s.category ?? '', ca: s.acBonus ?? 0, topeDex: s.dexCap ?? null, penalizacion: s.checkPenalty ?? 0, velocidad: s.speedPenalty ?? 0, fuerza: s.strength ?? 0 };
  } else if (d.type === 'shield') {
    e.escudo = { ca: s.acBonus ?? 0, dureza: s.hardness ?? 0, pg: s.hp?.max ?? 0 };
  }
  return e;
}

// ---------- Subir de nivel: lo que da cada clase en cada nivel ----------
// Los rasgos de clase, por nombre, para leer su texto ("Your proficiency rank for Will saves increases to master")
const RASGOS_POR_NOMBRE = new Map(leerPaquete('class-features').map((d) => [d.name, d]));
const RANGOS_TEXTO = { trained: 1, expert: 2, master: 3, legendary: 4 };

// De qué habla una frase de competencias: "Fortitude saves", "simple and martial weapons", "spell DC"…
function queSube(sujeto) {
  const s = sujeto.toLowerCase();
  const salen = [];
  if (/perception/.test(s)) salen.push('percepcion');
  if (/fortitude/.test(s)) salen.push('fortitude');
  if (/reflex/.test(s)) salen.push('reflex');
  if (/will/.test(s)) salen.push('will');
  if (/all saving throws|all saves/.test(s)) salen.push('fortitude', 'reflex', 'will');
  if (/weapon|unarmed attack/.test(s)) salen.push('armas');
  if (/armor|unarmored defense/.test(s)) salen.push('armadura');
  if (/spell attack|spell dc|spellcasting/.test(s)) salen.push('conjuros');
  if (/class dc/.test(s)) salen.push('claseCD');
  return [...new Set(salen)];
}

// Las competencias que sube un rasgo, leídas de su texto
export function mejorasDeTexto(texto) {
  const salen = new Map();
  const frases = texto.split(/(?<=[.!?])\s+/);
  for (const f of frases) {
    // "Your proficiency rank for Will saves increases to master" / "you gain master proficiency with simple weapons"
    const sube = /(?:proficiency ranks? (?:for|in|with) |your )([^.]*?)\s+(?:increases?|are increased|is increased) to (expert|master|legendary)/i.exec(f);
    const gana = /(?:gain|become) (expert|master|legendary) (?:proficiency )?(?:in|with) ([^.]*)/i.exec(f);
    const [sujeto, nombre] = sube ? [sube[1], sube[2]] : gana ? [gana[2], gana[1]] : [null, null];
    if (!sujeto) continue;
    const rango = RANGOS_TEXTO[nombre.toLowerCase()];
    for (const q of queSube(sujeto)) salen.set(q, Math.max(salen.get(q) ?? 0, rango));
  }
  return [...salen].map(([que, rango]) => ({ que, rango }));
}

// Los que no lo dicen con esas palabras (su texto sale de una traducción de Foundry, o lo hace una regla)
const MEJORAS_POR_NOMBRE = {
  'Expert Spellcaster': [{ que: 'conjuros', rango: 2 }], 'Master Spellcaster': [{ que: 'conjuros', rango: 3 }],
  'Legendary Spellcaster': [{ que: 'conjuros', rango: 4 }], 'Fighter Weapon Mastery': [{ que: 'armas', rango: 3 }],
};

function progresionDe(d) {
  const s = d.system;
  const niveles = (x) => (x?.value ?? []).filter((n) => Number.isInteger(n));
  const rasgos = Object.values(s.items ?? {})
    .map((it) => {
      const r = RASGOS_POR_NOMBRE.get(it.name);
      const texto = limpiar(r?.system?.description?.value ?? '');
      const sube = mejorasDeTexto(texto);
      return { nivel: it.level, nombre: it.name, texto: texto.length > 700 ? `${texto.slice(0, 699)}…` : texto, sube: sube.length ? sube : MEJORAS_POR_NOMBRE[it.name] ?? [] };
    })
    .filter((x) => Number.isInteger(x.nivel))
    .sort((a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre));
  return {
    dotes: { clase: niveles(s.classFeatLevels), skill: niveles(s.skillFeatLevels), general: niveles(s.generalFeatLevels), ascendencia: niveles(s.ancestryFeatLevels) },
    mejorasSkill: niveles(s.skillIncreaseLevels),
    rasgos,
  };
}

// ---------- Lo demás, con sus datos útiles ----------
const elegirMejoras = (b) => Object.values(b ?? {}).map((x) => (x?.value?.length === 6 ? 'libre' : (x?.value ?? []).join(' o '))).filter(Boolean);
const genericos = {
  ascendencias: (d) => ({ ...base(d), datos: {
    pg: d.system.hp, tamano: TAMANOS[d.system.size] ?? d.system.size, velocidad: d.system.speed,
    mejoras: elegirMejoras(d.system.boosts), defectos: elegirMejoras(d.system.flaws),
    idiomas: d.system.languages?.value ?? [], idiomasExtra: d.system.additionalLanguages?.count ?? 0, vision: d.system.vision ?? 'normal',
  } }),
  herencias: (d) => ({ ...base(d), datos: { ascendencia: d.system.ancestry?.name ?? 'versátil' } }),
  trasfondos: (d) => ({ ...base(d), datos: {
    mejoras: elegirMejoras(d.system.boosts), habilidades: d.system.trainedSkills?.value ?? [], saberes: d.system.trainedSkills?.lore ?? [],
    dote: Object.values(d.system.items ?? {}).map((x) => x.name).join(', '),
  } }),
  clases: (d) => ({ ...base(d), datos: {
    pg: d.system.hp, atributoClave: d.system.keyAbility?.value ?? [], percepcion: d.system.perception,
    salvaciones: d.system.savingThrows, habilidades: d.system.trainedSkills?.value ?? [], habilidadesExtra: d.system.trainedSkills?.additional ?? 0,
    armas: d.system.attacks, defensas: d.system.defenses, cdClase: d.system.classDC,
    progresion: progresionDe(d),
  } }),
  'rasgos-de-clase': (d) => ({ ...base(d), datos: { categoria: d.system.category ?? '' } }),
  deidades: (d) => ({ ...base(d), datos: {
    dominios: d.system.domains?.primary ?? [], alternos: d.system.domains?.alternate ?? [], fuente: d.system.font ?? [],
    habilidad: d.system.skill ?? [], armas: d.system.weapons ?? [], santificacion: d.system.sanctification ?? null,
  } }),
  condiciones: (d) => ({ ...base(d), datos: { conValor: !!d.system.value?.isValued } }),
  peligros: (d) => ({ ...base(d), descripcion: limpiar(d.system.details?.description || d.system.description?.value), datos: {
    ca: d.system.attributes?.ac?.value ?? null, pg: d.system.attributes?.hp?.max ?? null, dureza: d.system.attributes?.hardness ?? null,
    sigilo: d.system.attributes?.stealth?.value ?? null, desactivar: limpiar(d.system.details?.disable), rutina: limpiar(d.system.details?.routine),
    reinicio: limpiar(d.system.details?.reset), complejo: !!d.system.details?.isComplex,
  } }),
};

// ---------- Qué paquete va a qué tipo ----------
const paquetes = readdirSync(fuente).filter((p) => statSync(join(fuente, p)).isDirectory());
const deCriaturas = paquetes.filter((p) => p.endsWith('-bestiary') || p.startsWith('pathfinder-bestiary') || p.startsWith('pathfinder-monster-core')
  || ['npc-gallery', 'pathfinder-npc-core', 'pathfinder-dark-archive', 'fall-of-plaguestone', 'standalone-adventures', 'blog-bestiary', 'iconics', 'paizo-pregens'].includes(p));

const tipos = {
  criaturas: { paquetes: deCriaturas, tipos: ['npc'], convertir: criatura, resumen: (e) => `${e.tamano} · CA ${e.ca} · PG ${e.pg}` },
  peligros: { paquetes: deCriaturas, tipos: ['hazard'], convertir: genericos.peligros, resumen: (e) => (e.datos.complejo ? 'complejo' : 'simple') },
  conjuros: { paquetes: ['spells'], tipos: ['spell'], convertir: conjuro, resumen: (e) => [e.clase, e.tradiciones.join(', ')].filter(Boolean).join(' · ') },
  // Los requisitos van también en el índice: subir de nivel filtra con ellos sin bajar cada dote
  dotes: { paquetes: ['feats'], tipos: ['feat'], convertir: dote, resumen: (e) => e.categoria, extra: (e) => (e.prerrequisitos.length ? { requisitos: e.prerrequisitos.slice(0, 4) } : {}) },
  equipo: { paquetes: ['equipment'], tipos: null, convertir: equipo, resumen: (e) => e.clase },
  acciones: { paquetes: ['actions'], tipos: ['action'], convertir: accion, resumen: (e) => e.categoria },
  condiciones: { paquetes: ['conditions'], tipos: ['condition'], convertir: genericos.condiciones, resumen: () => '' },
  ascendencias: { paquetes: ['ancestries'], tipos: ['ancestry'], convertir: genericos.ascendencias, resumen: (e) => `PG ${e.datos.pg} · ${e.datos.tamano}` },
  herencias: { paquetes: ['heritages'], tipos: ['heritage'], convertir: genericos.herencias, resumen: (e) => e.datos.ascendencia },
  trasfondos: { paquetes: ['backgrounds'], tipos: ['background'], convertir: genericos.trasfondos, resumen: (e) => e.datos.habilidades.join(', ') },
  clases: { paquetes: ['classes'], tipos: ['class'], convertir: genericos.clases, resumen: (e) => `PG ${e.datos.pg}` },
  'rasgos-de-clase': { paquetes: ['class-features'], tipos: null, convertir: genericos['rasgos-de-clase'], resumen: (e) => e.rasgos.slice(0, 3).join(', ') },
  deidades: { paquetes: ['deities'], tipos: ['deity'], convertir: genericos.deidades, resumen: (e) => e.datos.dominios.join(', ') },
};

rmSync(salida, { recursive: true, force: true });
const totales = {};
for (const [tipo, def] of Object.entries(tipos)) {
  const vistos = new Set();
  const entradas = [];
  for (const p of def.paquetes) {
    for (const d of leerPaquete(p)) {
      if (def.tipos && !def.tipos.includes(d.type)) continue;
      if (!d.name || !d.system) continue;
      let e;
      try { e = def.convertir(d); } catch (err) { console.warn(`  (se saltó ${p}/${d.name}: ${err.message})`); continue; }
      // Mismo nombre en dos libros: se distinguen por su libro
      let id = e.id;
      if (vistos.has(id)) id = `${id}--${slug({ name: e.fuente || p })}`;
      if (vistos.has(id)) continue;
      vistos.add(id);
      entradas.push({ ...e, id });
    }
  }
  entradas.sort((a, b) => (a.nivel ?? 0) - (b.nivel ?? 0) || a.nombre.localeCompare(b.nombre));
  const dir = join(salida, tipo);
  mkdirSync(dir, { recursive: true });
  const indice = [];
  for (let i = 0; i < entradas.length; i += POR_TROZO) {
    const trozo = i / POR_TROZO;
    const parte = entradas.slice(i, i + POR_TROZO);
    writeFileSync(join(dir, `${trozo}.json`), JSON.stringify(Object.fromEntries(parte.map((e) => [e.id, e]))));
    for (const e of parte) {
      indice.push({ id: e.id, nombre: e.nombre, nivel: e.nivel, rasgos: e.rasgos, rareza: e.rareza, fuente: e.fuente, resumen: def.resumen(e), trozo, ...def.extra?.(e) });
    }
  }
  writeFileSync(join(dir, 'indice.json'), JSON.stringify(indice));
  totales[tipo] = entradas.length;
  console.log(`${tipo.padEnd(16)} ${String(entradas.length).padStart(6)}`);
}
writeFileSync(join(salida, 'version.json'), JSON.stringify({ generado: new Date().toISOString(), totales, origen: 'github.com/foundryvtt/pf2e (packs/pf2e) · ORC / OGL' }));

// ---------- Íconos: solo los SVG de game-icons.net (CC BY 3.0) que trae el sistema ----------
// Los demás íconos de Foundry (los .webp) son de Rexard y no se pueden redistribuir: no se copian.
const estatico = join(fuente, '../../static/icons');
if (existsSync(join(estatico, 'default-icons'))) {
  const iconos = 'public/iconos';
  rmSync(iconos, { recursive: true, force: true });
  // Sin la sombra de Foundry: aquí se usan como máscara y toman el color de la tinta
  const limpio = (svg) => svg.replace(/<\?xml[^>]*>\s*/, '').replace(/<filter[\s\S]*?<\/filter>\s*/g, '').replace(/\sfilter="[^"]*"/g, '');
  let n = 0;
  for (const [desde, hacia] of [['default-icons', 'tipos'], ['default-icons/alternatives/ancestries', 'ascendencias']]) {
    const dir = join(estatico, desde);
    mkdirSync(join(iconos, hacia), { recursive: true });
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.svg'))) {
      writeFileSync(join(iconos, hacia, f), limpio(readFileSync(join(dir, f), 'utf8')));
      n++;
    }
  }
  writeFileSync(join(iconos, 'LICENCIA.txt'), [
    'Íconos de Lorc, Delapouite y colaboradores (https://game-icons.net/), bajo Creative Commons Attribution 3.0',
    '(http://creativecommons.org/licenses/by/3.0/). Tomados del sistema PF2e de Foundry (github.com/foundryvtt/pf2e,',
    'static/icons), que modificó azarketi, grippli, halfling, ratfolk y shisk. Aquí se les quitó la sombra.',
  ].join('\n'));
  console.log(`iconos           ${String(n).padStart(6)}`);
}

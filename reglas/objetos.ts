// Los objetos: la mochila, el Bulk, las monedas y los consumibles.
// La mochila es la cuenta de verdad: un consumible (poción, bomba, pergamino) está en la mochila y además
// tiene su acción en la hoja, ligada por `aptitudId`; usarla gasta de los dos y al acabarse desaparecen juntos.

import type { Aptitud, Costo } from './aptitudes';
import type { EquipoCompendio } from './compendio';
import type { Interaccion } from './interacciones';
import type { Golpe, Personaje, Rango } from './pf2e';
import { CLASES } from './datos/clases';
import { ESCUDOS } from './datos/equipo';

export type Objeto = NonNullable<Personaje['inventario']>[number];
export type Monedas = NonNullable<Personaje['monedas']>;

const SIN_MONEDAS: Monedas = { oro: 0, plata: 0, cobre: 0 };
const corto = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

// ---------- Bulk ----------

// Lo ligero (L) cuenta de a 10 por Bulk; lo que pesa menos (—) no cuenta; 1000 monedas son 1 Bulk
export function bultoDe(p: Personaje): { total: number; ligeros: number } {
  let enteros = 0;
  let ligeros = 0;
  for (const x of p.inventario ?? []) {
    if (x.bulto >= 1) enteros += x.bulto * x.cantidad;
    else if (x.bulto > 0) ligeros += Math.round(x.bulto * 10) * x.cantidad;
  }
  const m = p.monedas ?? SIN_MONEDAS;
  const monedas = Math.floor((m.oro + m.plata + m.cobre) / 1000);
  return { total: Math.floor(enteros) + Math.floor(ligeros / 10) + monedas, ligeros: ligeros % 10 };
}

// Más de 5 + Str: Encumbered (Clumsy 1 y −10 ft). Más de 10 + Str ya no puede cargarlo
export const limiteCarga = (p: Personaje) => 5 + p.atributos.str;
export const maximoCarga = (p: Personaje) => 10 + p.atributos.str;
export const cargado = (p: Personaje) => bultoDe(p).total > limiteCarga(p);

// ---------- Monedas (los precios van en piezas de plata, como en el compendio) ----------

export const enCobre = (m: Monedas) => m.oro * 100 + m.plata * 10 + m.cobre;

// "1 po 5 pp", "3 pc"
export function textoPrecio(plata: number): string {
  const cobre = Math.round(plata * 10);
  const po = Math.floor(cobre / 100);
  const pp = Math.floor((cobre % 100) / 10);
  const pc = cobre % 10;
  return [po && `${po} po`, pp && `${pp} pp`, pc && `${pc} pc`].filter(Boolean).join(' ') || 'gratis';
}

// Paga con lo que tenga, rompiendo monedas grandes solo si hace falta. null si no le alcanza
export function pagar(m: Monedas, plata: number): Monedas | null {
  const precio = Math.round(plata * 10);
  const queda = enCobre(m) - precio;
  if (precio < 0 || queda < 0) return null;
  const oro = Math.min(m.oro, Math.floor(queda / 100));
  const resto = queda - oro * 100;
  const platas = Math.min(m.plata + (m.oro - oro) * 10, Math.floor(resto / 10));
  return { oro, plata: platas, cobre: resto - platas * 10 };
}

export function cobrar(m: Monedas, plata: number): Monedas {
  const cobre = Math.max(0, Math.round(plata * 10));
  return { oro: m.oro + Math.floor(cobre / 100), plata: m.plata + Math.floor((cobre % 100) / 10), cobre: m.cobre + (cobre % 10) };
}

// ---------- Consumibles del compendio ----------

// "Activate A (manipulate)": cuántas acciones cuesta
function costoDe(texto: string): Costo {
  const m = /Activate\s+(AAA|AA|A|R|F)\b/.exec(texto);
  return m?.[1] === 'AAA' ? 3 : m?.[1] === 'AA' ? 2 : m?.[1] === 'R' ? 'reaccion' : m?.[1] === 'F' ? 'libre' : 1;
}

const esFormula = (t: string) => /^\d+d\d+(\+\d+)?$/.test(t);

// La acción de un consumible: las pociones y elixires que curan te curan; las bombas son un Strike con su daño;
// el resto (pergaminos, antídotos…) se gasta y deja su texto en la mesa. La munición no tiene acción.
export function consumibleDeCompendio(e: EquipoCompendio, cantidad = 1): Aptitud | null {
  if (!e.rasgos.includes('consumable') || e.clase === 'ammo') return null;
  const cura = /regain (\d+d\d+(?:\s*\+\s*\d+)?) (?:healing )?Hit Points/i.exec(e.descripcion)?.[1]?.replace(/\s+/g, '');
  const bomba = e.rasgos.includes('bomb') && e.arma && esFormula(e.arma.dados) ? e.arma : null;
  const r = e.rasgos;
  const verbo = bomba ? 'Lanzar bomba' : r.includes('potion') ? 'Beber poción' : r.includes('elixir') ? 'Tomar elixir'
    : r.includes('scroll') ? 'Leer pergamino' : r.includes('talisman') ? 'Activar talismán' : r.includes('oil') ? 'Aplicar aceite' : 'Usar';
  const interaccion: Interaccion | null = bomba
    ? { modo: { tipo: 'ataque' }, objetivos: { tipo: 'uno' }, dano: { formula: bomba.dados, tipo: bomba.tipoDano.slice(0, 30) } }
    : cura && esFormula(cura) ? { modo: { tipo: 'ninguna' }, objetivos: { tipo: 'yo' }, curacion: cura } : null;
  // El texto sin la línea de "Activate" (el costo ya se ve aparte)
  const texto = e.descripcion.replace(/^Activate[^\n]*\n+(—\n+)?/, '').trim();
  return {
    id: `objeto:${e.id}`.slice(0, 100),
    nombre: corto(e.nombre, 60),
    verbo,
    categoria: 'objeto',
    costo: bomba ? 1 : costoDe(e.descripcion),
    recuperacion: { tipo: 'consumible', cantidad: Math.min(99, Math.max(0, cantidad)) },
    descripcion: corto(`${bomba ? 'Strike a distancia con Dex: la mesa usa tu competencia con armas marciales. ' : ''}${texto}`, 2000),
    rasgos: e.rasgos.slice(0, 12).map((x) => x.slice(0, 30)),
    ...(bomba ? { dano: bomba.dados, distancia: Math.min(1000, Math.max(5, bomba.distancia ?? 20)) } : {}),
    ...(interaccion ? { interaccion } : {}),
  };
}

// Un objeto del compendio a la mochila (con su precio, para venderlo después)
export function objetoDeCompendio(e: EquipoCompendio): Objeto {
  return { id: `compendio:${e.id}`.slice(0, 80), nombre: corto(e.nombre, 80), cantidad: 1, bulto: Math.min(50, Math.max(0, e.bulto)), ...(e.precio > 0 ? { precio: Math.min(1e7, e.precio) } : {}) };
}

// El escudo que se puede embrazar: el del compendio trae sus números; uno de la mochila se reconoce por su nombre
export function escudoDe(x: { nombre: string; escudo?: { ca: number; dureza: number; pg: number } }): Personaje['escudo'] | null {
  const datos = x.escudo ?? ESCUDOS.find((e) => e.nombre.toLowerCase() === x.nombre.trim().toLowerCase());
  if (!datos) return null;
  const n = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));
  return { nombre: corto(x.nombre, 60), ca: n(datos.ca, 4), dureza: n(datos.dureza, 50), pg: n(datos.pg, 500), pgActual: n(datos.pg, 500) };
}

// ---------- Cambios a la mochila ----------

// Mete `cantidad` de un objeto; si es consumible, su acción queda ligada con la misma cantidad
export function agregarObjeto(p: Personaje, item: Objeto, aptitud: Aptitud | null = null, cantidad = 1): Partial<Personaje> {
  const inventario = p.inventario ?? [];
  const ya = inventario.find((x) => x.id === item.id);
  const total = Math.min(9999, (ya?.cantidad ?? 0) + cantidad);
  const aptitudes = p.aptitudes ?? [];
  const ligada = aptitud && (aptitudes.some((a) => a.id === aptitud.id) || aptitudes.length < 80) ? aptitud.id : ya?.aptitudId;
  const nuevo: Objeto = { ...(ya ?? item), cantidad: total, ...(ligada ? { aptitudId: ligada } : {}) };
  const cambios: Partial<Personaje> = {
    inventario: ya ? inventario.map((x) => (x === ya ? nuevo : x)) : [...inventario, nuevo].slice(0, 200),
  };
  if (ligada) cambios.aptitudes = conCantidadLigada(aptitudes.some((a) => a.id === ligada) ? aptitudes : [...aptitudes, aptitud!], ligada, total);
  return cambios;
}

function conCantidadLigada(aptitudes: Aptitud[], id: string, cantidad: number): Aptitud[] {
  return aptitudes.map((a) => (a.id === id ? { ...a, recuperacion: { tipo: 'consumible' as const, cantidad: Math.min(99, Math.max(0, cantidad)) } } : a));
}

// Cambia cuántos hay (0 lo saca de la mochila, y a su acción con él)
export function cambiarCantidad(p: Personaje, indice: number, cantidad: number): Partial<Personaje> {
  const inventario = p.inventario ?? [];
  const x = inventario[indice];
  if (!x) return {};
  const n = Math.min(9999, Math.max(0, Math.round(cantidad)));
  const cambios: Partial<Personaje> = {
    inventario: n === 0 ? inventario.filter((_, i) => i !== indice) : inventario.map((y, i) => (i === indice ? { ...y, cantidad: n } : y)),
  };
  const ligada = x.aptitudId && (p.aptitudes ?? []).some((a) => a.id === x.aptitudId) ? x.aptitudId : null;
  if (ligada) {
    cambios.aptitudes = n === 0 ? (p.aptitudes ?? []).filter((a) => a.id !== ligada) : conCantidadLigada(p.aptitudes ?? [], ligada, n);
  }
  return cambios;
}

// Al usar un consumible: uno menos en la acción y en la mochila; el último se va de las dos
export function gastarConsumible(p: Personaje, a: Aptitud): Partial<Personaje> {
  const queda = (a.recuperacion.tipo === 'consumible' ? a.recuperacion.cantidad : 0) - 1;
  const inventario = p.inventario ?? [];
  const indice = inventario.findIndex((x) => x.aptitudId === a.id);
  if (indice >= 0) return cambiarCantidad(p, indice, queda);
  return { aptitudes: conCantidadLigada(p.aptitudes ?? [], a.id, queda) };
}

// Vender uno: la mitad de su precio (los objetos de tesoro, a precio completo)
export function precioDeVenta(x: Objeto, tesoro = false): number {
  return (x.precio ?? 0) * (tesoro ? 1 : 0.5);
}

export function venderObjeto(p: Personaje, indice: number): Partial<Personaje> {
  const x = (p.inventario ?? [])[indice];
  if (!x || !x.precio) return {};
  return { ...cambiarCantidad(p, indice, x.cantidad - 1), monedas: cobrar(p.monedas ?? SIN_MONEDAS, precioDeVenta(x)) };
}

// Comprar: paga y lo mete. null si no le alcanza
export function comprarObjeto(p: Personaje, item: Objeto, aptitud: Aptitud | null, precio: number): Partial<Personaje> | null {
  const monedas = pagar(p.monedas ?? SIN_MONEDAS, precio);
  if (!monedas) return null;
  return { ...agregarObjeto(p, item, aptitud), monedas };
}

// ---------- Bombas ----------

// Con qué competencia lanza una bomba (son armas marciales): la de su clase, subida como sus otras armas
export function rangoBombas(p: Personaje): Rango {
  const mejor = Math.max(0, ...p.golpes.map((g) => g.rango)) as Rango;
  const clase = CLASES.find((c) => c.id === (p.origen?.clase || p.clase.toLowerCase()));
  if (!clase) return mejor;
  const base = clase.armas.extra?.some((n) => /bomb/i.test(n)) ? Math.max(1, clase.armas.marciales) : clase.armas.marciales;
  return base === 0 ? 0 : (Math.max(base, mejor) as Rango);
}

// El Strike de una bomba, como si fuera un arma más: Dex, sin Str al daño, su distancia
export function golpeDeBomba(p: Personaje, a: Aptitud): Golpe {
  return {
    id: a.id.slice(0, 100), nombre: a.nombre, atributo: 'dex', rango: rangoBombas(p), bonoObjeto: 0,
    dados: a.dano && /^\d+d\d+$/.test(a.dano) ? a.dano : '1d4', tipoDano: a.interaccion?.dano?.tipo ?? '',
    sumarFuerza: false, agil: false, distancia: a.distancia ?? 20,
  };
}

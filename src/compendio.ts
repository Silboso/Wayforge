import { useEffect, useState } from 'react';
import type { EntradaCompendio, Indice, TipoCompendio } from '../reglas/compendio';

// El compendio se pide por partes: el índice de un tipo la primera vez que se busca en él,
// y cada trozo de detalle cuando se abre una entrada. Todo queda en memoria mientras dure la pestaña.
const indices = new Map<TipoCompendio, Promise<Indice[]>>();
const trozos = new Map<string, Promise<Record<string, EntradaCompendio>>>();

export function indiceDe(tipo: TipoCompendio): Promise<Indice[]> {
  let p = indices.get(tipo);
  if (!p) {
    p = fetch(`/compendio/${tipo}/indice.json`).then((r) => (r.ok ? (r.json() as Promise<Indice[]>) : []));
    p.catch(() => indices.delete(tipo));
    indices.set(tipo, p);
  }
  return p;
}

export async function entradaDe<T extends EntradaCompendio = EntradaCompendio>(tipo: TipoCompendio, id: string): Promise<T | null> {
  const fila = (await indiceDe(tipo)).find((x) => x.id === id);
  if (!fila) return null;
  const clave = `${tipo}/${fila.trozo}`;
  let p = trozos.get(clave);
  if (!p) {
    p = fetch(`/compendio/${clave}.json`).then((r) => (r.ok ? (r.json() as Promise<Record<string, EntradaCompendio>>) : {}));
    p.catch(() => trozos.delete(clave));
    trozos.set(clave, p);
  }
  return ((await p)[id] as T | undefined) ?? null;
}

// "Bôggard" y "boggard" son lo mismo para buscar
export const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface Filtro {
  texto?: string;
  nivelMin?: number;
  nivelMax?: number;
  rasgo?: string;
  // Busca también en el resumen (tradiciones, categoría)
  resumen?: string;
  rareza?: string;
}

// Las mejores coincidencias primero: nombre que empieza igual, luego que lo contiene, luego por rasgo
export function buscar(indice: Indice[], f: Filtro, limite = 120): Indice[] {
  const q = normalizar(f.texto?.trim() ?? '');
  const palabras = q.split(/\s+/).filter(Boolean);
  const rasgo = f.rasgo ? normalizar(f.rasgo) : null;
  const resumen = f.resumen ? normalizar(f.resumen) : null;
  const puntuadas: { x: Indice; p: number }[] = [];
  for (const x of indice) {
    if (f.nivelMin !== undefined && (x.nivel ?? 0) < f.nivelMin) continue;
    if (f.nivelMax !== undefined && (x.nivel ?? 0) > f.nivelMax) continue;
    if (rasgo && !x.rasgos.some((r) => normalizar(r) === rasgo)) continue;
    if (resumen && !normalizar(x.resumen).includes(resumen)) continue;
    if (f.rareza && x.rareza !== f.rareza) continue;
    if (!q) { puntuadas.push({ x, p: 0 }); continue; }
    const n = normalizar(x.nombre);
    // Las palabras en cualquier orden: "young red dragon" encuentra "Red Dragon (Young)"
    const resto = `${x.rasgos.map(normalizar).join(' ')} ${normalizar(x.resumen)}`;
    const p = n === q ? 5 : n.startsWith(q) ? 4 : n.includes(q) ? 3
      : palabras.every((w) => n.includes(w)) ? 2 : palabras.every((w) => n.includes(w) || resto.includes(w)) ? 1 : 0;
    if (p) puntuadas.push({ x, p });
  }
  puntuadas.sort((a, b) => b.p - a.p || (a.x.nivel ?? 0) - (b.x.nivel ?? 0) || a.x.nombre.localeCompare(b.x.nombre));
  return puntuadas.slice(0, limite).map((y) => y.x);
}

// El índice de un tipo como estado de React (null mientras carga)
export function useIndice(tipo: TipoCompendio | null): Indice[] | null {
  const [indice, setIndice] = useState<Indice[] | null>(null);
  useEffect(() => {
    if (!tipo) return;
    let vivo = true;
    setIndice(null);
    indiceDe(tipo).then((i) => vivo && setIndice(i)).catch(() => vivo && setIndice([]));
    return () => { vivo = false; };
  }, [tipo]);
  return indice;
}

export function useEntrada<T extends EntradaCompendio>(tipo: TipoCompendio | null, id: string | null): T | null | undefined {
  // undefined: cargando; null: no está
  const [e, setE] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    if (!tipo || !id) return setE(null);
    let vivo = true;
    setE(undefined);
    entradaDe<T>(tipo, id).then((x) => vivo && setE(x)).catch(() => vivo && setE(null));
    return () => { vivo = false; };
  }, [tipo, id]);
  return e;
}

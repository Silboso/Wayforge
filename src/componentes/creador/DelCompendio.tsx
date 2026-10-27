import { useMemo, useState } from 'react';
import { BooksIcon, CaretDownIcon, CheckIcon, XIcon } from '@phosphor-icons/react';
import { conjuroAAptitud, doteAAptitud, type ConjuroCompendio, type DoteCompendio, type Indice } from '../../../reglas/compendio';
import { delCompendio, type ElegidoCompendio, type RanuraCompendio } from '../../../reglas/creador';
import { buscar, entradaDe, useEntrada, useIndice } from '../../compendio';
import { CostoAccion } from '../hud/piezas';
import { claseEntrada } from '../ui';
import { Chip } from './piezas';
import type { PropsPaso } from './pasos';

// Elegir del compendio completo (todas las dotes y conjuros de Pathfinder) para un hueco del creador.
// Se abre a pedido: la lista corta de arriba alcanza para empezar.
export function DelCompendio({ e, cambiar, tipo, ranura, filtro, max, ocupados, titulo, alElegir }: PropsPaso & {
  tipo: 'conjuros' | 'dotes';
  ranura: RanuraCompendio;
  // Qué entradas sirven para este hueco (nivel, tradición, rasgo de ascendencia o clase)
  filtro: (x: Indice) => boolean;
  // Cuántas caben en el hueco, y cuántas ya ocupa la lista corta
  max: number;
  ocupados: number;
  titulo: string;
  // Lo que se limpia de la lista corta al elegir aquí (la dote de ascendencia de la lista, por ejemplo)
  alElegir?: () => void;
}) {
  const [abierto, setAbierto] = useState(delCompendio(e, ranura).length > 0);
  const [texto, setTexto] = useState('');
  const [visto, setVisto] = useState<string | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const indice = useIndice(abierto ? tipo : null);
  const aptas = useMemo(() => (indice ?? []).filter(filtro), [indice, filtro]);
  const resultados = useMemo(() => buscar(aptas, { texto }, 40), [aptas, texto]);
  const elegidos = delCompendio(e, ranura);
  // Un hueco de una sola dote se reemplaza; los de conjuros se llenan hasta el tope
  const unico = max === 1;
  const lleno = !unico && ocupados + elegidos.length >= max;

  async function alternar(x: Indice) {
    if (elegidos.some((y) => y.id === x.id)) {
      cambiar((a) => ({ delCompendio: (a.delCompendio ?? []).filter((y) => !(y.ranura === ranura && y.id === x.id)) }));
      return;
    }
    if (lleno) return;
    setCargando(x.id);
    const entrada = await entradaDe(tipo, x.id);
    setCargando(null);
    if (!entrada) return;
    const nuevo: ElegidoCompendio = tipo === 'conjuros'
      ? { ranura, id: x.id, nombre: x.nombre, categoria: 'conjuro', nivel: Math.max(1, x.nivel ?? 1), aptitud: conjuroAAptitud(entrada as ConjuroCompendio) }
      : { ranura, id: x.id, nombre: x.nombre, categoria: (entrada as DoteCompendio).categoria, nivel: Math.max(1, x.nivel ?? 1), aptitud: doteAAptitud(entrada as DoteCompendio) };
    alElegir?.();
    cambiar((a) => {
      const otros = (a.delCompendio ?? []).filter((y) => !(y.ranura === ranura && (unico || y.id === x.id)));
      return { delCompendio: [...otros, nuevo] };
    });
  }

  return (
    <div className="mt-3 rounded-lg border-[1.5px] border-dashed border-borde bg-superficie/60">
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}
        className="flex w-full items-center gap-2 px-3 py-2 text-left font-titulo text-[15px] font-semibold text-texto-suave hover:text-texto">
        <BooksIcon size={18} aria-hidden />
        {titulo}
        {elegidos.length > 0 && <span className="text-acento">· {elegidos.map((x) => x.nombre).join(', ')}</span>}
        <CaretDownIcon size={15} aria-hidden className={`ml-auto transition ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="border-t border-borde/70 px-3 pt-2 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <input value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder="Buscar por nombre o rasgo…" aria-label={titulo}
              className={`${claseEntrada} min-w-0 flex-1`} />
            <span className="font-titulo text-[13px] text-texto-suave">
              {indice ? `${aptas.length} que te sirven` : 'Cargando el compendio…'}
            </span>
          </div>
          {elegidos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {elegidos.map((x) => (
                <button key={x.id} type="button" onClick={() => cambiar((a) => ({ delCompendio: (a.delCompendio ?? []).filter((y) => !(y.ranura === ranura && y.id === x.id)) }))}
                  className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-acento bg-acento/10 px-2.5 py-0.5 font-titulo text-[13.5px] font-semibold">
                  {x.nombre} <XIcon size={12} weight="bold" aria-label="Quitar" />
                </button>
              ))}
            </div>
          )}
          <ul className="mt-2 max-h-[22rem] divide-y divide-borde/60 overflow-y-auto">
            {resultados.map((x) => {
              const elegida = elegidos.some((y) => y.id === x.id);
              return (
                <li key={x.id} className="py-1.5">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setVisto(visto === x.id ? null : x.id)} aria-expanded={visto === x.id}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <CaretDownIcon size={13} aria-hidden className={`shrink-0 text-texto-suave transition ${visto === x.id ? 'rotate-180' : ''}`} />
                      <span className={`truncate font-titulo text-[15.5px] font-semibold ${elegida ? 'marcatextos' : ''}`}>{x.nombre}</span>
                      {x.rareza !== 'common' && <Chip tono="acento">{x.rareza}</Chip>}
                      <span className="hidden truncate text-[12.5px] text-texto-suave sm:inline">{x.rasgos.slice(0, 4).join(', ')}</span>
                    </button>
                    <button type="button" onClick={() => void alternar(x)} disabled={(!elegida && lleno) || cargando === x.id} aria-pressed={elegida}
                      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border-[1.5px] px-2.5 font-titulo text-[13.5px] font-semibold transition disabled:opacity-45 ${elegida ? 'border-acento bg-acento text-sobre-acento' : 'border-borde hover:border-acento/60'}`}>
                      {elegida ? <><CheckIcon size={14} weight="bold" aria-hidden /> Elegida</> : cargando === x.id ? '…' : 'Elegir'}
                    </button>
                  </div>
                  {visto === x.id && <Detalle tipo={tipo} id={x.id} />}
                </li>
              );
            })}
            {indice && resultados.length === 0 && <li className="py-3 text-[14px] text-texto-suave">Nada con ese nombre.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function Detalle({ tipo, id }: { tipo: 'conjuros' | 'dotes'; id: string }) {
  const x = useEntrada<ConjuroCompendio | DoteCompendio>(tipo, id);
  if (x === undefined) return <p className="py-1 pl-5 text-[13px] text-texto-suave">Cargando…</p>;
  if (!x) return null;
  const costo = 'costo' in x ? x.costo : null;
  return (
    <div className="mt-1 ml-5 rounded-md bg-superficie-2/50 px-3 py-2 text-[13.5px] leading-snug">
      <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-texto-suave">
        {costo !== null && <CostoAccion costo={costo} />}
        {'prerrequisitos' in x && x.prerrequisitos.length > 0 && <span>Requiere: {x.prerrequisitos.join('; ')}</span>}
        {'tiempo' in x && x.tiempo && <span>{x.tiempo}</span>}
        <span className="italic">{x.fuente}</span>
      </p>
      <p className="whitespace-pre-line">{x.descripcion.length > 900 ? `${x.descripcion.slice(0, 899)}…` : x.descripcion}</p>
    </div>
  );
}

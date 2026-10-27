import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { signo } from '../../../reglas/pf2e';
import type { Costo } from '../../../reglas/aptitudes';
import {
  TIPOS_COMPENDIO, type AccionCompendio, type ConjuroCompendio, type CriaturaCompendio, type DoteCompendio, type EntradaCompendio,
  type EquipoCompendio, type GenericoCompendio, type Indice, type TipoCompendio,
} from '../../../reglas/compendio';
import { precioTexto } from '../../../reglas/datos/equipo';
import { buscar, useEntrada, useIndice } from '../../compendio';
import { CostoAccion } from '../hud/piezas';
import { IconoJuego, rutaAscendencia, rutaTipo, type TipoIcono } from '../Iconos';

// Lo que se puede hacer con una entrada desde la mesa (según quién mira)
export interface AccionesCompendio {
  // GM: poner la criatura en el tablero
  onPonerCriatura?: (c: CriaturaCompendio) => void;
  // Jugador: agregar a su hoja
  onAgregarConjuro?: (c: ConjuroCompendio) => void;
  onAgregarDote?: (d: DoteCompendio) => void;
  onAgregarObjeto?: (e: EquipoCompendio) => void;
}

// Todo Pathfinder 2e para consultar: buscar por nombre o rasgo, filtrar por nivel y abrir el detalle
export function PanelCompendio({ acciones = {}, tipoInicial = 'criaturas' }: { acciones?: AccionesCompendio; tipoInicial?: TipoCompendio }) {
  const [tipo, setTipo] = useState<TipoCompendio>(tipoInicial);
  const [texto, setTexto] = useState('');
  const [nivelMin, setNivelMin] = useState('');
  const [nivelMax, setNivelMax] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const indice = useIndice(tipo);
  const resultados = useMemo(() => (indice ? buscar(indice, {
    texto, ...(nivelMin !== '' ? { nivelMin: Number(nivelMin) } : {}), ...(nivelMax !== '' ? { nivelMax: Number(nivelMax) } : {}),
  }, 150) : []), [indice, texto, nivelMin, nivelMax]);
  const total = useMemo(() => (indice ? buscar(indice, {
    texto, ...(nivelMin !== '' ? { nivelMin: Number(nivelMin) } : {}), ...(nivelMax !== '' ? { nivelMax: Number(nivelMax) } : {}),
  }, Infinity).length : 0), [indice, texto, nivelMin, nivelMax]);

  if (abierta) return <Detalle tipo={tipo} id={abierta} acciones={acciones} onVolver={() => setAbierta(null)} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Tipo de contenido">
        {TIPOS_COMPENDIO.map((t) => (
          <button key={t.tipo} role="tab" aria-selected={tipo === t.tipo} title={t.ayuda} onClick={() => { setTipo(t.tipo); setAbierta(null); }}
            className={`shrink-0 rounded-md border-[1.5px] px-2.5 py-1 font-titulo text-[13.5px] transition ${tipo === t.tipo ? 'border-acento bg-acento text-sobre-acento' : 'border-borde hover:border-acento/60'}`}>
            {t.nombre}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <label className="relative block min-w-0 flex-1">
          <MagnifyingGlassIcon size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" aria-hidden />
          <input className="h-10 w-full rounded-lg border border-borde bg-superficie pr-3 pl-9" value={texto} autoFocus
            placeholder={`Buscar en ${TIPOS_COMPENDIO.find((t) => t.tipo === tipo)!.nombre.toLowerCase()} (nombre o rasgo)`} aria-label="Buscar" onChange={(e) => setTexto(e.target.value)} />
        </label>
        <input className="h-10 w-14 rounded-lg border border-borde bg-superficie text-center" inputMode="numeric" value={nivelMin} placeholder="Nv ≥" aria-label="Nivel mínimo"
          onChange={(e) => setNivelMin(e.target.value.replace(/[^\d-]/g, '').slice(0, 3))} />
        <input className="h-10 w-14 rounded-lg border border-borde bg-superficie text-center" inputMode="numeric" value={nivelMax} placeholder="Nv ≤" aria-label="Nivel máximo"
          onChange={(e) => setNivelMax(e.target.value.replace(/[^\d-]/g, '').slice(0, 3))} />
      </div>
      <p className="font-titulo text-[13px] text-texto-suave">
        {indice === null ? 'Abriendo el compendio…' : total === 0 ? 'Nada con eso.' : `${total.toLocaleString('es')} resultado${total === 1 ? '' : 's'}${total > resultados.length ? ` · se ven los primeros ${resultados.length}, afina la búsqueda` : ''}`}
      </p>
      <ul className="flex flex-col">
        {resultados.map((x) => <Fila key={x.id} x={x} tipo={tipo} onAbrir={() => setAbierta(x.id)} />)}
      </ul>
      <p className="text-[11.5px] leading-snug text-texto-suave">Contenido de Pathfinder 2e de Paizo, importado del sistema PF2e de Foundry (licencias ORC y OGL). Los textos van en inglés, como en los libros. Íconos de Lorc, Delapouite y colaboradores en game-icons.net (CC BY 3.0).</p>
    </div>
  );
}

// El ícono de cada tipo de entrada (las ascendencias, el suyo propio)
const ICONO_TIPO: Record<TipoCompendio, TipoIcono> = {
  criaturas: 'npc', conjuros: 'spell', dotes: 'feat', equipo: 'equipment', acciones: 'action', condiciones: 'condition',
  ascendencias: 'ancestry', herencias: 'heritage', trasfondos: 'background', clases: 'class', 'rasgos-de-clase': 'class', deidades: 'deity', peligros: 'hazard',
};

function Fila({ x, tipo, onAbrir }: { x: Indice; tipo: TipoCompendio; onAbrir: () => void }) {
  return (
    <li>
      <button className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 border-b border-dashed border-borde px-1 py-1.5 text-left transition hover:bg-acento/[0.06]" onClick={onAbrir}>
        <IconoJuego ruta={tipo === 'ascendencias' ? rutaAscendencia(x.id) : rutaTipo(ICONO_TIPO[tipo])} className="size-6 text-texto-suave" />
        <span className="min-w-0">
          <span className={`block truncate font-titulo text-[15.5px] font-semibold ${x.rareza === 'uncommon' ? 'text-[#b06d1a]' : x.rareza === 'rare' ? 'text-acento' : x.rareza === 'unique' ? 'text-[#8a4fd0]' : ''}`}>{x.nombre}</span>
          <span className="block truncate text-[12px] text-texto-suave">{[x.resumen, x.fuente].filter(Boolean).join(' · ')}</span>
        </span>
        {x.nivel !== null && <span className="rounded-sm border border-texto-suave/40 px-1.5 font-titulo text-[12.5px] text-texto-suave">{x.nivel === 0 && x.resumen.startsWith('truco') ? 'truco' : `nv ${x.nivel}`}</span>}
      </button>
    </li>
  );
}

function Detalle({ tipo, id, acciones, onVolver }: { tipo: TipoCompendio; id: string; acciones: AccionesCompendio; onVolver: () => void }) {
  const e = useEntrada<EntradaCompendio>(tipo, id);
  const [hecho, setHecho] = useState('');
  const hacer = (texto: string, f: () => void) => { f(); setHecho(texto); };
  return (
    <div className="flex flex-col gap-3">
      <button className="flex items-center gap-1.5 self-start font-titulo text-[14px] text-texto-suave hover:text-acento" onClick={onVolver}>
        <ArrowLeftIcon size={16} aria-hidden /> Volver a la lista
      </button>
      {e === undefined && <p className="font-titulo text-texto-suave">Abriendo…</p>}
      {e === null && <p className="font-titulo text-texto-suave">No está en el compendio.</p>}
      {e && (
        <article className="flex flex-col gap-3">
          <header>
            <h2 className="font-titulo text-[24px] leading-tight font-bold">{e.nombre}</h2>
            <p className="font-titulo text-[13.5px] text-texto-suave">
              {TIPOS_COMPENDIO.find((t) => t.tipo === tipo)!.nombre.replace(/s$/, '')}{e.nivel !== null ? ` · nivel ${e.nivel}` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {e.rareza !== 'common' && <Chip tono="acento">{e.rareza}</Chip>}
              {e.rasgos.map((r) => <Chip key={r}>{r}</Chip>)}
            </div>
          </header>

          {tipo === 'criaturas' && <VerCriatura c={e as CriaturaCompendio} />}
          {tipo === 'conjuros' && <VerConjuro c={e as ConjuroCompendio} />}
          {tipo === 'dotes' && <VerDote d={e as DoteCompendio} />}
          {tipo === 'equipo' && <VerEquipo x={e as EquipoCompendio} />}
          {tipo === 'acciones' && <Datos filas={[['Costo', <CostoTexto key="c" costo={(e as AccionCompendio).costo} />]]} />}
          {'datos' in e && <VerGenerico g={e as GenericoCompendio} />}

          {e.descripcion && <p className="text-[14px] leading-relaxed whitespace-pre-line">{e.descripcion}</p>}

          <div className="flex flex-wrap gap-2">
            {tipo === 'criaturas' && acciones.onPonerCriatura && (
              <Boton onClick={() => hacer('La pusimos en el tablero.', () => acciones.onPonerCriatura!(e as CriaturaCompendio))}>Poner en el tablero</Boton>
            )}
            {tipo === 'conjuros' && acciones.onAgregarConjuro && (
              <Boton onClick={() => hacer('Agregado a tu hoja.', () => acciones.onAgregarConjuro!(e as ConjuroCompendio))}>Agregar a mi hoja</Boton>
            )}
            {tipo === 'dotes' && acciones.onAgregarDote && (
              <Boton onClick={() => hacer('Agregada a tu hoja.', () => acciones.onAgregarDote!(e as DoteCompendio))}>Agregar a mi hoja</Boton>
            )}
            {tipo === 'equipo' && acciones.onAgregarObjeto && (
              <Boton onClick={() => hacer('Está en tu mochila.', () => acciones.onAgregarObjeto!(e as EquipoCompendio))}>Agregar a mi mochila</Boton>
            )}
          </div>
          {hecho && <p className="font-titulo text-[14px] text-exito" role="status">{hecho}</p>}
          <p className="text-[12px] text-texto-suave">{e.fuente || 'Sin libro'} · {e.licencia}</p>
        </article>
      )}
    </div>
  );
}

function VerCriatura({ c }: { c: CriaturaCompendio }) {
  const def = c.defensas;
  return (
    <>
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-superficie-2/70 px-2 py-2 text-center font-titulo">
        {[['CA', c.ca], ['PG', c.pg], ['Perc', signo(c.percepcion)], ['Vel', `${c.velocidad}`], ['Fort', signo(c.salvaciones.fortitude)], ['Ref', signo(c.salvaciones.reflex)], ['Will', signo(c.salvaciones.will)], ['Tamaño', c.tamano]].map(([k, v]) => (
          <div key={k}><span className="block text-[11.5px] text-texto-suave">{k}</span><b className="text-[17px]">{v}</b></div>
        ))}
      </div>
      <Datos filas={[
        ['Sentidos', c.sentidos.join(', ')],
        ['Idiomas', c.idiomas.join(', ')],
        ['Otras velocidades', c.otrasVelocidades.join(', ')],
        ['Skills', c.habilidades.map((h) => `${h.nombre} ${signo(h.bono)}`).join(', ')],
        ['Inmune', def.inmunidades.join(', ')],
        ['Resiste', def.resistencias.map((x) => `${x.tipo} ${x.valor}`).join(', ')],
        ['Débil', def.debilidades.map((x) => `${x.tipo} ${x.valor}`).join(', ')],
      ]} />
      {c.ataques.length > 0 && (
        <section>
          <h3 className="font-titulo text-[16px] font-bold">Ataques</h3>
          <ul className="text-[13.5px]">
            {c.ataques.map((a) => (
              <li key={a.id} className="border-b border-dashed border-borde py-1">
                <b className="font-titulo">{a.distancia && a.distancia > 5 && !a.rasgos.some((r) => r.startsWith('reach')) ? 'A distancia' : 'Cuerpo a cuerpo'}: {a.nombre}</b> <span className="font-titulo text-peligro">{signo(a.bono)}</span>
                <span className="text-texto-suave"> · {a.dano} {a.tipoDano}{a.distancia ? ` · ${a.distancia} ft` : ''}{a.rasgos.length ? ` · ${a.rasgos.join(', ')}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {c.aptitudes.length > 0 && (
        <section>
          <h3 className="font-titulo text-[16px] font-bold">Habilidades especiales</h3>
          <ul className="text-[13.5px]">
            {c.aptitudes.map((a, i) => (
              <li key={i} className="border-b border-dashed border-borde py-1.5">
                <b className="font-titulo">{a.nombre}</b> {a.costo && <CostoAccion costo={a.costo} className="align-middle" />}
                {a.texto && <span className="block whitespace-pre-line text-texto-suave">{a.texto}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function VerConjuro({ c }: { c: ConjuroCompendio }) {
  return (
    <Datos filas={[
      ['Clase', c.clase === 'truco' ? 'Truco' : c.clase === 'foco' ? 'Conjuro de foco' : c.clase === 'ritual' ? 'Ritual' : `Conjuro de rango ${c.rango}`],
      ['Tradiciones', c.tradiciones.join(', ')],
      ['Lanzar', c.tiempo ? c.tiempo : <CostoTexto key="c" costo={c.costo} />],
      ['Distancia', c.distancia === null ? '' : c.distancia === 0 ? 'toque' : `${c.distancia} ft`],
      ['Área', c.area],
      ['Objetivos', c.objetivos],
      ['Duración', c.duracion],
      ['Defensa', c.defensa === 'ataque' ? 'ataque de conjuro contra la CA' : c.defensa ? `${c.basica ? 'básica de ' : ''}${c.defensa}` : ''],
      ['Daño', c.dano.map((d) => `${d.formula} ${d.tipo}`).join(' + ')],
      ['Más fuerte', c.potenciado],
    ]} />
  );
}

function VerDote({ d }: { d: DoteCompendio }) {
  return <Datos filas={[['Tipo', d.categoria], ['Costo', d.costo === null ? 'pasiva' : <CostoTexto key="c" costo={d.costo} />], ['Requisitos', d.prerrequisitos.join('; ')], ['Frecuencia', d.frecuencia]]} />;
}

function VerEquipo({ x }: { x: EquipoCompendio }) {
  return (
    <Datos filas={[
      ['Tipo', x.clase],
      ['Precio', precioTexto(x.precio)],
      ['Bulk', x.bulto === 0 ? '—' : x.bulto < 1 ? 'L' : String(x.bulto)],
      ...(x.arma ? [['Arma', `${x.arma.categoria} · ${x.arma.grupo} · ${x.arma.dados} ${x.arma.tipoDano} · ${x.arma.manos === 2 ? 'dos manos' : 'una mano'}${x.arma.distancia ? ` · ${x.arma.distancia} ft` : ''}`] as [string, string]] : []),
      ...(x.armadura ? [['Armadura', `${x.armadura.categoria} · +${x.armadura.ca} CA · Dex ${x.armadura.topeDex ?? '—'} · Str ${x.armadura.fuerza}`] as [string, string]] : []),
      ...(x.escudo ? [['Escudo', `+${x.escudo.ca} CA · Dureza ${x.escudo.dureza} · ${x.escudo.pg} PG`] as [string, string]] : []),
    ]} />
  );
}

function VerGenerico({ g }: { g: GenericoCompendio }) {
  const texto = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '';
    if (Array.isArray(v)) return v.map(texto).filter(Boolean).join(', ');
    if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k} ${texto(x)}`).join(', ');
    return String(v);
  };
  return <Datos filas={Object.entries(g.datos).map(([k, v]) => [k, texto(v)] as [string, string])} />;
}

function Datos({ filas }: { filas: [string, ReactNode][] }) {
  const visibles = filas.filter(([, v]) => v !== '' && v !== null && v !== undefined);
  if (!visibles.length) return null;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13.5px]">
      {visibles.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-titulo text-texto-suave">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CostoTexto({ costo }: { costo: Costo | null }) {
  if (costo === null) return <>—</>;
  return <span className="inline-flex items-center gap-1.5"><CostoAccion costo={costo} /> {typeof costo === 'number' ? `${costo} acción${costo > 1 ? 'es' : ''}` : costo === 'reaccion' ? 'reacción' : costo === 'libre' ? 'libre' : 'actividad'}</span>;
}

function Chip({ children, tono }: { children: ReactNode; tono?: 'acento' }) {
  return <span className={`rounded-sm border px-1.5 font-titulo text-[12px] ${tono ? 'border-acento/60 text-acento' : 'border-texto-suave/40 text-texto-suave'}`}>{children}</span>;
}

function Boton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="boli flex h-10 items-center gap-1.5 bg-acento px-4 font-titulo text-[14.5px] font-bold text-sobre-acento" onClick={onClick}>
      <PlusIcon size={16} weight="bold" aria-hidden /> {children}
    </button>
  );
}

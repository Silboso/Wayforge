import { useEffect, useRef, useState } from 'react';
import { CopySimpleIcon, FilmSlateIcon, PencilSimpleIcon, PlayIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { Accion, EstadoSala } from '../../compartido/sala';
import type { Evento } from '../../compartido/eventos';
import { useConfirmar } from './hud/Modal';
import { claseBotonIcono, claseBotonPrincipal, claseBotonSecundario, claseEntrada, Seccion } from './ui';

// Las escenas del GM: la que se juega, las guardadas, crear, pasar de una a otra y el telón
export function PanelEscenas({ estado, enviar }: { estado: EstadoSala; enviar: (accion: Accion) => void }) {
  const confirmar = useConfirmar();
  const [editando, setEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const actual = estado.escena ?? { id: 'inicio', nombre: 'Primera escena' };
  const guardadas = estado.escenas ?? [];
  const nueva = (copiar: boolean) => {
    const n = guardadas.length + 2;
    enviar({ tipo: 'crear-escena', id: crypto.randomUUID().slice(0, 12), nombre: copiar ? `${actual.nombre} (copia)`.slice(0, 60) : `Escena ${n}`, ...(copiar ? { copiar } : {}) });
  };
  const renombrar = (id: string) => {
    const limpio = nombre.trim();
    if (limpio) enviar({ tipo: 'renombrar-escena', id, nombre: limpio.slice(0, 60) });
    setEditando(null);
  };
  const fila = (id: string, n: string, activa: boolean, detalle: string) => (
    <li key={id} className={`flex items-center gap-2 rounded-lg border-[1.5px] px-2 py-1.5 ${activa ? 'border-acento bg-acento/[0.06]' : 'border-borde'}`}>
      <FilmSlateIcon size={18} className={activa ? 'text-acento' : 'text-texto-suave'} aria-hidden />
      {editando === id ? (
        <input autoFocus className={`${claseEntrada} h-8! flex-1 text-sm`} value={nombre} maxLength={60} aria-label="Nombre de la escena"
          onChange={(e) => setNombre(e.target.value)} onBlur={() => renombrar(id)} onKeyDown={(e) => { if (e.key === 'Enter') renombrar(id); if (e.key === 'Escape') setEditando(null); }} />
      ) : (
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{n}</div>
          <div className="truncate text-xs text-texto-suave">{activa ? 'Se está jugando' : detalle}</div>
        </div>
      )}
      <button className={claseBotonIcono} aria-label={`Renombrar ${n}`} onClick={() => { setEditando(id); setNombre(n); }}><PencilSimpleIcon size={15} aria-hidden /></button>
      {!activa && (
        <>
          <button className={claseBotonIcono} aria-label={`Borrar ${n}`}
            onClick={() => confirmar.pedir({ titulo: `¿Borrar "${n}"?`, texto: 'Se pierden su mapa, sus muros y sus criaturas.', si: 'Borrar', hacer: () => enviar({ tipo: 'borrar-escena', id }) })}>
            <TrashIcon size={15} aria-hidden />
          </button>
          <button className="flex h-8 items-center gap-1 rounded-lg border-[1.5px] border-acento px-2 text-xs font-semibold text-acento hover:bg-acento/10"
            onClick={() => confirmar.pedir({
              titulo: `¿Ir a "${n}"?`,
              texto: `Los personajes pasan a esa escena${estado.combate ? ' y el combate termina' : ''}. Lo de esta queda guardado tal cual.${estado.telon ? '' : ' Si todavía la estás armando, baja el telón antes.'}`,
              si: 'Ir', hacer: () => enviar({ tipo: 'cambiar-escena', id }),
            })}>
            <PlayIcon size={12} weight="fill" aria-hidden /> Ir
          </button>
        </>
      )}
    </li>
  );
  return (
    <Seccion titulo="Escenas">
      <p className="text-sm text-texto-suave">
        Cada escena tiene su mapa, sus muros, su luz y sus criaturas. Para prepararla sin que la vean: baja el telón, ve a la escena,
        ármala y súbelo.
      </p>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border-[1.5px] border-dashed border-borde px-3 py-2 text-sm">
        <input type="checkbox" className="size-4 accent-acento" checked={!!estado.telon} onChange={(e) => enviar({ tipo: 'telon', bajo: e.target.checked })} />
        <span><b>Telón bajo</b>: los jugadores no ven el tablero</span>
      </label>
      <ul className="flex flex-col gap-1.5">
        {fila(actual.id, actual.nombre, true, '')}
        {guardadas.map((e) => fila(e.id, e.nombre, false, `${e.tokens.length} criaturas · ${(e.mapa.muros ?? []).length} muros`))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <button className={claseBotonPrincipal} onClick={() => nueva(false)}><PlusIcon size={16} aria-hidden /> Nueva</button>
        <button className={claseBotonSecundario} onClick={() => nueva(true)}><CopySimpleIcon size={16} aria-hidden /> Copiar esta</button>
      </div>
      {confirmar.ventana}
    </Seccion>
  );
}

// Lo que ven los jugadores con el telón bajo: el tablero tapado por una cortina
export function Telon() {
  return (
    <div className="absolute inset-0 z-[5] flex items-center justify-center overflow-hidden"
      style={{ background: 'repeating-linear-gradient(90deg, #6e1f22 0 34px, #85272b 34px 52px, #5e1a1d 52px 70px)', paddingBottom: 'var(--alto-hoja, 0px)' }} role="status">
      <div aria-hidden className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(#3d1012,transparent)]" />
      <div className="tarjeta-cae max-w-sm rounded-xl border-2 border-borde bg-superficie px-6 py-5 text-center font-titulo shadow-[0_20px_40px_-18px_rgba(0,0,0,0.6)]">
        <FilmSlateIcon size={32} className="mx-auto text-acento" aria-hidden />
        <h2 className="mt-2 text-xl font-bold">El GM está preparando la escena</h2>
        <p className="mt-1 text-sm text-texto-suave">Cuando suba el telón, aparece el tablero. Mientras, puedes mirar tu hoja.</p>
      </div>
    </div>
  );
}

// Al pasar de escena, el nombre de la nueva aparece grande un momento, como el título de un capítulo
export function TituloEscena({ eventos }: { eventos: { id: number; evento: Evento }[] }) {
  const [titulo, setTitulo] = useState<string | null>(null);
  const visto = useRef(eventos.at(-1)?.id ?? 0);
  useEffect(() => {
    const nuevos = eventos.filter((e) => e.id > visto.current);
    if (!nuevos.length) return;
    visto.current = nuevos.at(-1)!.id;
    const escena = nuevos.findLast((e) => e.evento.tipo === 'escena');
    if (escena?.evento.tipo === 'escena') setTitulo(escena.evento.nombre);
  }, [eventos]);
  useEffect(() => {
    if (!titulo) return;
    const t = setTimeout(() => setTitulo(null), 3800);
    return () => clearTimeout(t);
  }, [titulo]);
  if (!titulo) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[28%] z-40 flex justify-center px-4" aria-live="polite">
      <div className="nivel-sello rounded-lg border-[3px] border-texto bg-superficie px-8 py-4 text-center font-titulo shadow-[0_20px_40px_-18px_var(--sombra)]">
        <p className="text-sm tracking-[0.2em] text-texto-suave uppercase">Escena</p>
        <p className="text-3xl font-bold">{titulo}</p>
      </div>
    </div>
  );
}

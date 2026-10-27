import { useEffect, useMemo, useRef, useState } from 'react';
import { EyeSlashIcon, PaperPlaneRightIcon } from '@phosphor-icons/react';
import type { EstadoSala, MensajeChat, Sesion, Tirada } from '../../compartido/sala';
import { textoTirada } from '../../compartido/tiradas';
import { claseEntrada } from './ui';

type Renglon = { tipo: 'mensaje'; m: MensajeChat } | { tipo: 'tirada'; t: Tirada };

// El chat de la mesa: los mensajes y las tiradas en el mismo registro, por orden de llegada. Se puede hablar a
// todos o susurrar (al GM, a un personaje); los susurros y las tiradas secretas del GM se ven distintos.
export function PanelChat({ estado, quien, onDecir }: { estado: EstadoSala; quien: Sesion; onDecir: (texto: string, para?: string) => void }) {
  const [texto, setTexto] = useState('');
  const [para, setPara] = useState('');
  const final = useRef<HTMLDivElement>(null);
  const renglones = useMemo<Renglon[]>(() => [
    ...(estado.chat ?? []).map((m) => ({ tipo: 'mensaje' as const, m, cuando: m.cuando })),
    ...estado.tiradas.map((t) => ({ tipo: 'tirada' as const, t, cuando: t.cuando })),
  ].sort((a, b) => a.cuando - b.cuando), [estado.chat, estado.tiradas]);
  useEffect(() => { final.current?.scrollIntoView({ block: 'end' }); }, [renglones.length]);
  const miId = quien.rol === 'jugador' ? quien.personajeId : null;
  // 'al GM', 'a Kyra', 'a ti'
  const aQuien = (id: string) => (id === miId ? 'a ti' : id === 'gm' ? 'al GM' : `a ${estado.personajes[id]?.nombre ?? '¿?'}`);
  const destinos = [
    ...(quien.rol === 'jugador' ? [['gm', 'Susurrar al GM']] : []),
    ...Object.values(estado.personajes).filter((p) => p.id !== miId).map((p) => [p.id, `Susurrar a ${p.nombre}`]),
  ] as [string, string][];
  const mandar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    onDecir(limpio, para || undefined);
    setTexto('');
  };
  const hora = (n: number) => new Date(n).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex h-full min-h-[60vh] flex-col gap-3">
      <ol className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1 font-titulo" aria-label="Chat de la mesa" aria-live="polite">
        {renglones.length === 0 && <li className="text-sm text-texto-suave">Todavía nadie dijo nada. Lo que se escriba y se tire en la mesa queda aquí.</li>}
        {renglones.map((r) => r.tipo === 'mensaje' ? (
          <li key={r.m.id} className={`rounded-lg px-2.5 py-1.5 ${r.m.para ? 'border border-dashed border-acento/60 bg-acento/[0.05] italic' : r.m.personajeId === miId || (r.m.rol === 'gm' && quien.rol === 'gm') ? 'bg-superficie-2' : ''}`}>
            <div className="flex items-baseline gap-2 text-[12.5px] text-texto-suave">
              <b className={r.m.rol === 'gm' ? 'text-peligro' : 'text-acento'}>{r.m.quien}</b>
              {r.m.para && <span>susurra {aQuien(r.m.para)}</span>}
              <span className="ml-auto">{hora(r.m.cuando)}</span>
            </div>
            <p className="text-[15px] leading-snug whitespace-pre-wrap not-italic">{r.m.texto}</p>
          </li>
        ) : (
          <li key={r.t.id} className={`flex items-baseline gap-2 border-b border-dashed border-borde px-1 py-1 text-[13.5px] ${r.t.secreta ? 'bg-texto/[0.04]' : ''}`}>
            {r.t.secreta && <EyeSlashIcon size={14} className="shrink-0 translate-y-0.5 text-texto-suave" aria-label="En secreto" />}
            <span className="min-w-0 flex-1 truncate"><b>{r.t.quien}</b> · {r.t.etiqueta}{r.t.objetivo ? ` → ${r.t.objetivo.nombre}` : ''}</span>
            <span className="shrink-0 text-[12px] text-texto-suave">{textoTirada(r.t)}</span>
            <b className="shrink-0 text-[17px] text-acento">{r.t.total}</b>
          </li>
        ))}
        <div ref={final} />
      </ol>
      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); mandar(); }}>
        <select className={`${claseEntrada} text-sm`} value={para} onChange={(e) => setPara(e.target.value)} aria-label="A quién">
          <option value="">A toda la mesa</option>
          {destinos.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <div className="flex gap-2">
          <input className={claseEntrada} value={texto} maxLength={500} aria-label="Mensaje"
            placeholder={para ? `Susurro ${aQuien(para)}…` : 'Escribe a la mesa…'} onChange={(e) => setTexto(e.target.value)} />
          <button className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-acento text-sobre-acento disabled:opacity-50" disabled={!texto.trim()} aria-label="Mandar">
            <PaperPlaneRightIcon size={18} weight="fill" aria-hidden />
          </button>
        </div>
      </form>
    </div>
  );
}

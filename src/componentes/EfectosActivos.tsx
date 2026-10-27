import { XIcon } from '@phosphor-icons/react';
import { duracionTexto, modificadorTexto, type EfectoActivo } from '../../reglas/efectos';
import { IconoAspecto, tintaDe } from './aspectos';

// Lo que una criatura tiene puesto por aptitudes: su nombre, qué suma o resta, cuánto dura y quién lo puso.
// Se ve como una tira de papel del color de su elemento; quien puede, lo quita con la cruz.
export function EfectosActivos({ efectos, onQuitar, compacto = false }: {
  efectos: EfectoActivo[];
  onQuitar?: (id: string) => void;
  compacto?: boolean;
}) {
  const visibles = efectos.filter((e) => !e.inmuneA);
  const inmunidades = efectos.filter((e) => e.inmuneA);
  if (visibles.length === 0 && inmunidades.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Efectos">
      {visibles.map((e) => {
        const tinta = tintaDe(e.aspecto ?? (e.beneficioso ? 'bendicion' : 'marca'));
        const que = [
          ...e.modificadores.map(modificadorTexto),
          ...(e.persistente ? [`${e.persistente.dano} ${e.persistente.tipo} persistente`] : []),
          ...(e.condiciones ?? []).map((c) => `${c.clave}${c.valor > 1 ? ` ${c.valor}` : ''}`),
        ].join(' · ');
        return (
          <li key={e.id} className="flex items-start gap-2 rounded-md border-l-4 bg-superficie-2/60 py-1 pr-1 pl-2" style={{ borderColor: tinta }}>
            <span className="mt-0.5 shrink-0" style={{ color: tinta }}><IconoAspecto aspecto={e.aspecto ?? (e.beneficioso ? 'bendicion' : 'marca')} size={15} /></span>
            <span className="min-w-0 flex-1 leading-tight">
              <b className="font-titulo text-[14px]">{e.nombre}</b>
              {!compacto && que && <span className="block text-[12.5px] text-texto">{que}</span>}
              <span className="block text-[12px] text-texto-suave">{duracionTexto(e.duracion)}{e.origen ? ` · de ${e.origen.nombre}` : ''}</span>
            </span>
            {onQuitar && (
              <button className="flex size-7 shrink-0 items-center justify-center rounded-md text-texto-suave hover:bg-superficie hover:text-peligro" onClick={() => onQuitar(e.id)}
                aria-label={`Quitar ${e.nombre}`} title="Quitar">
                <XIcon size={14} aria-hidden />
              </button>
            )}
          </li>
        );
      })}
      {inmunidades.length > 0 && !compacto && (
        <li className="text-[12px] text-texto-suave">{inmunidades.map((e) => e.nombre).join(' · ')}</li>
      )}
    </ul>
  );
}

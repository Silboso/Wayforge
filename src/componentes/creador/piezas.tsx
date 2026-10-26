import type { ReactNode } from 'react';
import { CheckIcon } from '@phosphor-icons/react';

// Piezas del creador de personajes: tarjetas para elegir, chips de datos y títulos de paso

// Una opción como ficha de cuaderno: al elegirla queda marcada con resaltador y un check
export function Opcion({ elegida, onElegir, titulo, subtitulo, children, chips, deshabilitada = false, motivo }: {
  elegida: boolean;
  onElegir: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  children?: ReactNode;
  chips?: ReactNode;
  deshabilitada?: boolean;
  // Por qué no se puede elegir (se muestra en lugar de deshabilitar en silencio)
  motivo?: string;
}) {
  return (
    <button type="button" onClick={onElegir} disabled={deshabilitada} aria-pressed={elegida}
      className={`group relative flex h-full w-full flex-col gap-1.5 rounded-lg border-[1.5px] p-3 text-left transition ${elegida
        ? 'border-acento bg-acento/[0.07] shadow-[0_4px_14px_-8px_var(--acento)]'
        : 'border-borde bg-superficie hover:border-acento/60 hover:bg-superficie-2/50'} disabled:cursor-not-allowed disabled:opacity-50`}>
      <span className="flex items-start gap-2">
        <span className={`font-titulo text-[17px] leading-tight font-bold ${elegida ? 'marcatextos' : ''}`}>{titulo}</span>
        {elegida && <CheckIcon size={18} weight="bold" className="ml-auto shrink-0 text-acento" aria-hidden />}
      </span>
      {subtitulo && <span className="text-[13px] leading-snug text-texto-suave">{subtitulo}</span>}
      {children}
      {chips && <span className="mt-auto flex flex-wrap gap-1 pt-1">{chips}</span>}
      {motivo && <span className="text-[12px] text-peligro">{motivo}</span>}
    </button>
  );
}

export function Chip({ children, tono = 'normal' }: { children: ReactNode; tono?: 'normal' | 'bueno' | 'malo' | 'acento' }) {
  const color = {
    normal: 'border-texto-suave/35 text-texto-suave',
    bueno: 'border-exito/50 text-exito',
    malo: 'border-peligro/50 text-peligro',
    acento: 'border-acento/50 text-acento',
  }[tono];
  return <span className={`inline-flex items-center rounded-sm border px-1.5 py-px font-titulo text-[12px] whitespace-nowrap ${color}`}>{children}</span>;
}

export function TituloPaso({ titulo, ayuda, derecha }: { titulo: string; ayuda: ReactNode; derecha?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="font-titulo text-[26px] leading-tight font-bold">{titulo}</h2>
        <p className="mt-0.5 max-w-prose text-[14px] text-texto-suave">{ayuda}</p>
      </div>
      {derecha}
    </header>
  );
}

// Un contador "3 de 5": en tinta cuando falta, en verde cuando está completo
export function Cuenta({ llevas, de, que }: { llevas: number; de: number; que: string }) {
  const listo = llevas >= de;
  return (
    <span className={`rounded-sm border-[1.5px] px-2 py-0.5 font-titulo text-[14px] font-semibold ${listo ? 'border-exito/60 text-exito' : 'border-acento/60 text-acento'}`}>
      {llevas} de {de} {que}
    </span>
  );
}

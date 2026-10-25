import { useId, useRef, useState, type ReactNode } from 'react';
import { ImageIcon, InfoIcon, MinusIcon, PlusIcon } from '@phosphor-icons/react';
import { RANGOS, signo, type Rango, type Valor } from '../../reglas/pf2e';

// Piezas pequeñas que se repiten en toda la interfaz

export const claseEntrada = 'h-10 w-full rounded-lg border border-borde bg-superficie px-3 text-texto placeholder:text-texto-suave/70';
export const claseBotonPrincipal = 'flex h-11 items-center justify-center gap-2 rounded-lg bg-acento px-4 font-medium text-sobre-acento transition active:scale-[0.98] disabled:opacity-60';
export const claseBotonSecundario = 'flex h-10 items-center justify-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm transition hover:bg-superficie-2 active:scale-[0.98]';
export const claseBotonIcono = 'flex size-9 shrink-0 items-center justify-center rounded-lg text-texto-suave transition hover:bg-superficie-2';

export function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="truncate font-titulo text-lg font-bold">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-texto-suave">{etiqueta}</label>
      {children(id)}
      {ayuda && <p className="text-xs text-texto-suave">{ayuda}</p>}
    </div>
  );
}

export function ElegirImagen({ etiqueta, onArchivo }: { etiqueta: string; onArchivo: (archivo: File | null) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={`${claseBotonSecundario} min-w-0 flex-1`} onClick={() => entrada.current?.click()}>
        <ImageIcon size={18} aria-hidden className="shrink-0" />
        <span className="truncate">{etiqueta}</span>
      </button>
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => {
          onArchivo(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
    </>
  );
}

export function Deslizador({ etiqueta, valor, min, max, unidad = '', onCambio }: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  unidad?: string;
  onCambio: (valor: number) => void;
}) {
  return (
    <Campo etiqueta={`${etiqueta}: ${valor}${unidad}`}>
      {(id) => (
        <input
          id={id}
          type="range"
          className="w-full accent-acento"
          min={min}
          max={max}
          step={1}
          value={valor}
          onChange={(e) => onCambio(Number(e.target.value))}
        />
      )}
    </Campo>
  );
}

// − 3 + : para números pequeños, más cómodo que un campo de texto en el teléfono
export function Contador({ valor, min, max, onCambio, conSigno = false, etiqueta }: {
  valor: number;
  min: number;
  max: number;
  onCambio: (valor: number) => void;
  conSigno?: boolean;
  etiqueta: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={etiqueta}>
      <button type="button" className={claseBotonIcono} aria-label={`Bajar ${etiqueta}`} disabled={valor <= min}
        onClick={() => onCambio(Math.max(min, valor - 1))}>
        <MinusIcon size={16} weight="bold" aria-hidden />
      </button>
      <span className="w-10 text-center text-lg font-medium tabular-nums">{conSigno ? signo(valor) : valor}</span>
      <button type="button" className={claseBotonIcono} aria-label={`Subir ${etiqueta}`} disabled={valor >= max}
        onClick={() => onCambio(Math.min(max, valor + 1))}>
        <PlusIcon size={16} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

// U T E M L: el rango de competencia
export function SelectorRango({ valor, onCambio, etiqueta }: { valor: Rango; onCambio: (r: Rango) => void; etiqueta: string }) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-borde bg-superficie-2 p-0.5" role="radiogroup" aria-label={etiqueta}>
      {RANGOS.map((r, i) => (
        <button
          key={r.letra}
          type="button"
          role="radio"
          aria-checked={valor === i}
          title={r.nombre}
          className={`h-8 w-8 rounded-md text-sm transition ${valor === i ? 'bg-acento font-bold text-sobre-acento' : 'text-texto-suave hover:bg-superficie'}`}
          onClick={() => onCambio(i as Rango)}
        >
          {r.letra}
        </button>
      ))}
    </div>
  );
}

export function LetraRango({ rango }: { rango: Rango }) {
  const r = RANGOS[rango]!;
  return (
    <span
      title={r.nombre}
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${rango === 0 ? 'bg-superficie-2 text-texto-suave' : 'bg-acento text-sobre-acento'}`}
    >
      {r.letra}
    </span>
  );
}

// Un número que se puede abrir para ver de dónde sale
export function Desglose({ valor }: { valor: Valor }) {
  return (
    <ul className="flex flex-col gap-0.5 rounded-lg bg-superficie-2 px-3 py-2 text-sm">
      {valor.partes.map((p, i) => (
        <li key={i} className="flex justify-between gap-3">
          <span className="text-texto-suave">{p.etiqueta}</span>
          <span className="tabular-nums">{i === 0 ? p.valor : signo(p.valor)}</span>
        </li>
      ))}
      <li className="mt-1 flex justify-between gap-3 border-t border-borde pt-1 font-medium">
        <span>Total</span>
        <span className="tabular-nums">{valor.total}</span>
      </li>
    </ul>
  );
}

export function BotonExplicar({ abierto, onClick, que }: { abierto: boolean; onClick: () => void; que: string }) {
  return (
    <button
      type="button"
      className={`${claseBotonIcono} size-8 ${abierto ? 'text-acento' : ''}`}
      aria-label={`De dónde sale ${que}`}
      aria-expanded={abierto}
      onClick={onClick}
    >
      <InfoIcon size={18} aria-hidden />
    </button>
  );
}

export function useAbierto() {
  const [abierto, setAbierto] = useState<string | null>(null);
  return { abierto, alternar: (clave: string) => setAbierto((a) => (a === clave ? null : clave)) };
}

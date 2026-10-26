import type { CSSProperties, ReactNode } from 'react';
import { ArrowBendUpLeftIcon, ClockIcon } from '@phosphor-icons/react';
import type { Costo } from '../../../reglas/aptitudes';
import { CONDICIONES, type Condicion } from '../../../reglas/condiciones';

// Rombo de acción, trazado a mano (un poco torcido a propósito)
export function Rombo({ lleno = true, tachado = false, className = 'size-4' }: { lleno?: boolean; tachado?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <path d="M10 2.2 L17.7 10.3 L9.8 17.8 L2.3 9.6 Z" strokeLinejoin="round" strokeWidth={1.7}
        className={lleno ? 'fill-acento stroke-acento' : 'fill-none stroke-texto-suave'} />
      {tachado && <path d="M5.5 5.8 L14.4 14.3 M14.2 5.6 L5.8 14.4" strokeWidth={1.6} strokeLinecap="round" className="stroke-texto-suave" />}
    </svg>
  );
}

// Lo que cuesta: ◆, ◆◆, ◆◆◆, reacción, libre o "minutos"
export function CostoAccion({ costo, tachado = false, className = '' }: { costo: Costo; tachado?: boolean; className?: string }) {
  const etiqueta = typeof costo === 'number'
    ? `${costo} ${costo === 1 ? 'acción' : 'acciones'}`
    : costo === 'reaccion' ? 'reacción' : costo === 'libre' ? 'acción libre' : 'actividad de minutos';
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 text-acento ${className}`} title={etiqueta} aria-label={etiqueta}>
      {typeof costo === 'number' && Array.from({ length: costo }, (_, i) => <Rombo key={i} className="size-3.5" lleno={!tachado} tachado={tachado} />)}
      {costo === 'reaccion' && <ArrowBendUpLeftIcon size={17} weight="bold" aria-hidden />}
      {costo === 'libre' && <Rombo lleno={false} className="size-3.5" />}
      {costo === 'larga' && <ClockIcon size={17} weight="bold" aria-hidden className="text-texto-suave" />}
    </span>
  );
}

// El retrato como foto pegada con cinta
export function FotoPegada({ src, inicial, tamano = 'size-[72px]' }: { src?: string; inicial: string; tamano?: string }) {
  return (
    <div className="relative shrink-0">
      <div className={`${tamano} -rotate-3 overflow-hidden rounded-[3px] border-4 border-white bg-superficie-2 shadow-[0_5px_12px_-4px_var(--sombra)]`}>
        {src
          ? <img src={src} alt="" className="size-full object-cover" />
          : <span className="flex size-full items-center justify-center font-titulo text-2xl font-bold text-acento">{inicial}</span>}
      </div>
      <span aria-hidden className="absolute -top-2 left-3 h-4 w-11 -rotate-[8deg] bg-[var(--cinta)]" />
    </div>
  );
}

// PG como una barra rayada a lápiz: se lee de un vistazo y no parece una barra de videojuego
export function BarraPG({ actual, max, temporales = 0, alto = 'h-3.5' }: { actual: number; max: number; temporales?: number; alto?: string }) {
  const porcion = max ? Math.max(0, Math.min(1, actual / max)) : 0;
  const tinta = porcion > 0.5 ? '#3f8f57' : porcion > 0.2 ? '#d69a2d' : 'var(--peligro)';
  return (
    <div className={`relative ${alto} bg-superficie`} role="progressbar"
      aria-valuenow={actual} aria-valuemin={0} aria-valuemax={max} aria-label={`${actual} de ${max} PG`}>
      <div className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
        style={{ width: `${porcion * 100}%`, background: `repeating-linear-gradient(-55deg, ${tinta} 0 2.5px, transparent 2.5px 6px)` }} />
      {temporales > 0 && (
        <div className="absolute inset-y-0 right-0 border-l border-texto-suave bg-acento/25"
          style={{ width: `${Math.min(40, (temporales / Math.max(1, max)) * 100)}%` }} />
      )}
      {/* El marco, trazado a mano: esquinas que no cierran del todo parejo */}
      <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute -inset-[2px] h-[calc(100%+4px)] w-[calc(100%+4px)] overflow-visible text-texto">
        <path d="M1.5 1.8 C 50 1.1, 120 2.4, 198.6 1.4 L 198.2 10.6 C 140 11.2, 70 10.1, 1.2 10.8 Z" fill="none" stroke="currentColor"
          strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

// Una condición como post-it, con su explicación corta
export function PostitCondicion({ condicion, compacto = false, giro = 2 }: { condicion: Condicion; compacto?: boolean; giro?: number }) {
  const def = CONDICIONES[condicion.clave];
  const nombre = `${def.nombre}${def.conValor ? ` ${condicion.valor}` : ''}`;
  // La explicación usa "X" por el número de la condición: se reemplaza por el real
  const ayuda = def.conValor ? def.ayuda.replaceAll('X', String(condicion.valor)) : def.ayuda;
  if (compacto) {
    return (
      <span className="postit inline-block px-2 py-0.5 font-titulo text-[13px]" style={{ '--giro': `${giro}deg` } as CSSProperties} title={ayuda}>
        {nombre}
      </span>
    );
  }
  return (
    <div className="postit px-3.5 py-2.5 font-titulo" style={{ '--giro': `${giro}deg` } as CSSProperties}>
      <div className="text-[17px] font-bold leading-tight">{nombre}</div>
      <p className="mt-1 text-[13px] leading-snug">{ayuda}</p>
    </div>
  );
}

// Una raya hecha a mano, para totales y separadores
export function RayaAMano({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 6" preserveAspectRatio="none" aria-hidden className={`block overflow-visible ${className}`}>
      <path d="M0.5 3.4 C 40 2.1, 80 4.2, 120 2.9 S 175 2.2, 199.5 3.6" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Una tecla de atajo, dibujada como una cajita a lápiz
export function Tecla({ children, sobreTinta = false }: { children: ReactNode; sobreTinta?: boolean }) {
  return (
    <kbd className={`inline-flex h-5 min-w-5 items-center justify-center rounded border-[1.3px] px-1 font-titulo text-[11px] ${sobreTinta ? 'border-sobre-acento/85 text-sobre-acento' : 'border-texto-suave/50 text-texto-suave'}`}>
      {children}
    </kbd>
  );
}

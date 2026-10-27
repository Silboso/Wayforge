import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MagnifyingGlassIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { CostoAccion, Rombo, Tecla } from './piezas';
import { TECLAS, type Fila, type Seccion } from './secciones';

// Una ventana encima de todo: una hoja de cuaderno con cinta, que se cierra con Esc, con la X o tocando afuera.
// En el teléfono sube desde abajo, como un cajón.
export function Modal({ titulo, subtitulo, onCerrar, children, ancho = 'max-w-lg' }: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  // Siempre la última versión de onCerrar (el efecto se registra una sola vez)
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      // Con una ventana encima de otra, solo cuenta la de arriba
      const abiertas = document.querySelectorAll('[aria-modal]');
      if (abiertas[abiertas.length - 1] !== caja.current) return;
      // Tab no se escapa de la ventana: da la vuelta entre lo que se puede tocar
      if (e.key === 'Tab' && caja.current) {
        const tocables = [...caja.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((x) => x.offsetParent !== null);
        const primero = tocables[0];
        const ultimo = tocables[tocables.length - 1];
        if (!primero || !ultimo) return;
        const dentro = caja.current.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === primero || !dentro)) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && (document.activeElement === ultimo || !dentro)) { e.preventDefault(); primero.focus(); }
        return;
      }
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      cerrar.current();
    };
    addEventListener('keydown', alPulsar, true);
    // Al abrir, el foco entra a la ventana (y vuelve a donde estaba al cerrar)
    const antes = document.activeElement as HTMLElement | null;
    const primero = caja.current?.querySelector<HTMLElement>('input, button:not([aria-label="Cerrar"])');
    primero?.focus();
    return () => { removeEventListener('keydown', alPulsar, true); antes?.focus?.(); };
  }, []);
  return (
    <div className="modal-fondo fixed inset-0 z-50 flex items-end justify-center bg-[rgba(20,24,32,0.38)] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={caja} role="dialog" aria-modal aria-label={typeof titulo === 'string' ? titulo : undefined}
        className={`modal-caja hoja relative flex max-h-[88vh] w-full ${ancho} flex-col rounded-t-xl sm:rounded-xl`}>
        <span aria-hidden className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 -rotate-2 bg-[var(--cinta)]" />
        <header className="flex items-start gap-3 border-b border-dashed border-borde px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-titulo text-[23px] leading-tight font-bold">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-[13.5px] text-texto-suave">{subtitulo}</p>}
          </div>
          <button className="-mt-1 -mr-2 flex size-10 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={onCerrar} aria-label="Cerrar">
            <XIcon size={20} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[max(env(safe-area-inset-bottom),16px)]">{children}</div>
      </div>
    </div>
  );
}

// Una pregunta de sí o no, con el estilo de la mesa (en lugar del confirm() del navegador)
export function Confirmar({ titulo, texto, si, no = 'Cancelar', peligro = false, onSi, onNo }: {
  titulo: string;
  texto: ReactNode;
  si: string;
  no?: string;
  peligro?: boolean;
  onSi: () => void;
  onNo: () => void;
}) {
  return (
    <Modal titulo={titulo} onCerrar={onNo} ancho="max-w-md">
      <div className="text-[15px] leading-snug">{texto}</div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="boli h-11 border-[1.5px] border-borde px-4 font-titulo text-[15px] hover:bg-superficie-2" onClick={onNo}>{no}</button>
        <button className={`boli h-11 px-5 font-titulo text-[15px] font-bold text-white shadow-[0_6px_12px_-6px_var(--sombra)] ${peligro ? 'bg-peligro' : 'bg-acento text-sobre-acento'}`}
          onClick={onSi}>{si}</button>
      </div>
    </Modal>
  );
}

// Para pedir una confirmación desde cualquier botón: `pedir({...})` muestra la ventana y `ventana` va en el árbol
export function useConfirmar() {
  const [pedido, setPedido] = useState<{ titulo: string; texto: ReactNode; si: string; peligro?: boolean; hacer: () => void } | null>(null);
  const ventana = pedido && (
    <Confirmar titulo={pedido.titulo} texto={pedido.texto} si={pedido.si} peligro={pedido.peligro}
      onSi={() => { setPedido(null); pedido.hacer(); }} onNo={() => setPedido(null)} />
  );
  return { pedir: setPedido, ventana };
}

// Elegir qué va en un atajo: todo lo que el personaje sabe hacer, agrupado y con buscador
export function ElegirAtajo({ ranura, lista, ranuras, onElegir, onCerrar }: {
  ranura: number;
  lista: Seccion[];
  ranuras: (Fila | null)[];
  onElegir: (clave: string | null) => void;
  onCerrar: () => void;
}) {
  const [busca, setBusca] = useState('');
  const vistas = new Set<string>();
  const grupos = lista.filter((s) => s.id !== 'turno').map((s) => ({
    ...s,
    filas: s.filas.filter((f) => {
      if (vistas.has(f.clave)) return false;
      vistas.add(f.clave);
      return `${f.nombre} ${f.detalle}`.toLowerCase().includes(busca.toLowerCase());
    }),
  })).filter((s) => s.filas.length > 0);
  const actual = ranuras[ranura];
  return (
    <Modal onCerrar={onCerrar} ancho="max-w-xl"
      titulo={<span className="flex items-center gap-2">Atajo <Tecla>{TECLAS[ranura]}</Tecla></span>}
      subtitulo={actual ? <>Ahora: <b>{actual.nombre}</b>. Elige otra cosa o déjalo vacío.</> : 'Elige qué quieres tener a mano en esta tecla.'}>
      <div className="mb-3 flex gap-2">
        <label className="relative block flex-1">
          <MagnifyingGlassIcon size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" aria-hidden />
          <input className="h-10 w-full rounded-lg border border-borde bg-superficie pr-3 pl-9" value={busca} placeholder="Buscar acción, conjuro, objeto…"
            aria-label="Buscar" onChange={(e) => setBusca(e.target.value)} />
        </label>
        {actual && (
          <button className="flex h-10 items-center gap-1.5 rounded-lg border border-borde px-3 text-[13.5px] text-texto-suave hover:text-peligro" onClick={() => onElegir(null)}>
            <TrashIcon size={16} aria-hidden /> Vaciar
          </button>
        )}
      </div>
      {grupos.map((s) => (
        <section key={s.id} className="mb-3">
          <h3 className="border-b-[1.5px] border-texto/60 font-titulo text-[16px] font-bold">{s.titulo}</h3>
          <ul>
            {s.filas.map((f) => {
              const en = ranuras.findIndex((r) => r?.clave === f.clave);
              return (
                <li key={f.clave}>
                  <button className={`grid min-h-11 w-full grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-dashed border-borde px-1 text-left transition hover:bg-acento/[0.07] ${en === ranura ? 'bg-acento/[0.08]' : ''}`}
                    onClick={() => onElegir(f.clave)}>
                    <span className="flex justify-center">{f.tipo === 'golpe' ? <Rombo className="size-3.5" /> : <CostoAccion costo={f.aptitud.costo} />}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-titulo text-[15.5px] font-semibold">{f.nombre}</span>
                      {f.detalle && <span className="block truncate text-[12px] text-texto-suave">{f.detalle}</span>}
                    </span>
                    <span className="font-titulo text-[16px] font-bold text-acento">{f.valor}</span>
                    <span className="w-6 text-right">{en >= 0 && <Tecla>{TECLAS[en]}</Tecla>}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {grupos.length === 0 && <p className="py-6 text-center font-titulo text-texto-suave">Nada con ese nombre.</p>}
    </Modal>
  );
}

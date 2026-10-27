import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Una tarjeta que aparece al dejar el cursor encima un momento (o al enfocar con el teclado). Va en un portal,
// así no la cortan las listas con scroll, y se acomoda arriba o abajo según el lugar que haya en la pantalla.
export function ConFlotante({ contenido, children, retraso = 280, className = '', lado = 'arriba', desactivado = false }: {
  contenido: ReactNode;
  children: ReactNode;
  retraso?: number;
  className?: string;
  lado?: 'arriba' | 'derecha';
  desactivado?: boolean;
}) {
  const ancla = useRef<HTMLSpanElement>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const mostrar = () => {
    // En pantallas táctiles no hay "pasar el cursor": un toque la dejaría abierta
    if (desactivado || matchMedia('(pointer: coarse)').matches) return;
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(() => setVisible(true), retraso);
  };
  const ocultar = () => {
    if (espera.current) clearTimeout(espera.current);
    setVisible(false);
    setPos(null);
  };
  useEffect(() => () => { if (espera.current) clearTimeout(espera.current); }, []);
  useEffect(() => { if (desactivado) ocultar(); }, [desactivado]);

  // Se mide la tarjeta ya dibujada y se coloca sin salirse de la pantalla
  useLayoutEffect(() => {
    if (!visible || !ancla.current || !tarjeta.current) return;
    const a = ancla.current.getBoundingClientRect();
    const t = tarjeta.current.getBoundingClientRect();
    const margen = 10;
    let x: number;
    let y: number;
    if (lado === 'derecha') {
      x = a.right + margen;
      y = Math.min(window.innerHeight - t.height - margen, Math.max(margen, a.top + a.height / 2 - t.height / 2));
      if (x + t.width > window.innerWidth - margen) x = a.left - t.width - margen;
    } else {
      x = Math.min(window.innerWidth - t.width - margen, Math.max(margen, a.left + a.width / 2 - t.width / 2));
      y = a.top - t.height - margen;
      if (y < margen) y = a.bottom + margen;
    }
    setPos({ x, y });
  }, [visible, lado]);

  return (
    <span ref={ancla} className={className} onMouseEnter={mostrar} onMouseLeave={ocultar} onFocus={mostrar} onBlur={ocultar}
      onDragStart={ocultar} onMouseDown={ocultar}>
      {children}
      {visible && createPortal(
        <div ref={tarjeta} role="tooltip"
          className="pointer-events-none fixed z-[60] w-[300px] rounded-xl border-2 border-borde bg-superficie p-3 font-titulo shadow-[0_18px_40px_-16px_var(--sombra)] transition-opacity duration-150"
          style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, opacity: pos ? 1 : 0 }}>
          {contenido}
        </div>,
        document.body,
      )}
    </span>
  );
}

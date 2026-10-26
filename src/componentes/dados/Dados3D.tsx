import { useEffect, useRef, useState } from 'react';
import type { DadoPedido } from './motor';

// Los dados que sabe dibujar en 3D (los demás, y si no hay WebGL, van dibujados a mano en 2D)
const CARAS_3D = [4, 6, 8, 10, 12, 20];
const MAX_DADOS = 4;

type Escena = ReturnType<typeof import('./motor').crearEscena>;

// Dados girando en 3D. Sin `valor` siguen rodando; cuando llega el valor, caen en esa cara.
// El motor (three.js) se carga recién la primera vez que alguien tira.
export function Dados3D({ dados, tamano = 84 }: { dados: DadoPedido[]; tamano?: number }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escena = useRef<Escena | null>(null);
  const [falla, setFalla] = useState(false);
  const visibles = dados.slice(0, MAX_DADOS);
  const sobran = dados.length - visibles.length;
  const usable = visibles.length > 0 && visibles.every((d) => CARAS_3D.includes(d.caras));
  // Mismo encuadre que la cámara del motor: cada dado ocupa 2.4 unidades de ancho y la vista 2.6 de alto
  const n = Math.max(1, visibles.length);
  const tam = n > 2 ? tamano * 0.75 : tamano;
  const ancho = Math.round((tam * (2.4 * n + 0.4)) / 2.6);
  const firma = JSON.stringify(visibles);

  useEffect(() => {
    if (!usable) return;
    let vivo = true;
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    import('./motor')
      .then((m) => {
        if (!vivo || !lienzo.current) return;
        escena.current = m.crearEscena(lienzo.current, quieto);
        escena.current.poner(visibles, ancho, tam);
      })
      .catch(() => vivo && setFalla(true));
    return () => {
      vivo = false;
      escena.current?.destruir();
      escena.current = null;
    };
  }, [usable]);

  useEffect(() => {
    escena.current?.poner(visibles, ancho, tam);
  }, [firma, ancho, tam]);

  if (!usable || falla) {
    return (
      <span className="flex gap-1.5">
        {visibles.map((d, i) => <DadoPlano key={i} valor={d.valor ?? '?'} caras={d.caras} rueda={d.valor === undefined} />)}
      </span>
    );
  }
  return (
    <span className="relative inline-flex shrink-0">
      <canvas ref={lienzo} style={{ width: ancho, height: tam }} aria-hidden />
      {sobran > 0 && <span className="absolute right-0 bottom-0 rounded-sm bg-superficie px-1 font-titulo text-[12px] text-texto-suave">+{sobran}</span>}
    </span>
  );
}

// El dado dibujado a mano en 2D: un d20 es un hexágono con su triángulo; los demás, un cuadrado con esquinas blandas
export function DadoPlano({ valor, caras, rueda = false }: { valor: number | string; caras: number; rueda?: boolean }) {
  return (
    <span className={`relative flex size-12 items-center justify-center text-acento ${rueda ? 'dado-rueda' : ''}`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0" aria-hidden>
        {caras === 20 ? (
          <>
            <path d="M24 2.5 L43.5 13.4 L43.2 35.2 L24.3 45.6 L4.6 34.9 L4.4 13.1 Z" fill="var(--superficie)" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
            <path d="M24 9 L37 31.5 L11 31.5 Z" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" opacity={0.55} />
          </>
        ) : (
          <rect x={5} y={5} width={38} height={38} rx={8} fill="var(--superficie)" stroke="currentColor" strokeWidth={2.2} />
        )}
      </svg>
      <span className="relative font-titulo text-[17px] font-bold tabular-nums text-texto">{valor}</span>
    </span>
  );
}

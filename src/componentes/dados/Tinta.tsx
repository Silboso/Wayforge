import type { ReactNode } from 'react';

// Piezas "a tinta" para los resultados: un círculo hecho a mano, un sello, una mancha y una flecha.
// Todo es SVG con trazos un poco irregulares, para que se sienta escrito en el cuaderno.

// Números al azar pero repetibles: la misma semilla da la misma mancha (no tiembla al volver a dibujar)
function azar(semilla: number) {
  let s = semilla || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function semillaDe(texto: string): number {
  let h = 7;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) % 2147483647;
  return h;
}

// Un círculo a mano alrededor de lo importante (el total): no cierra parejo y se dibuja solo
export function CirculoTinta({ children, color = 'var(--acento)', className = '' }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center px-3 ${className}`}>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute -inset-x-1 -inset-y-1.5 h-[calc(100%+12px)] w-[calc(100%+8px)] overflow-visible">
        <path className="trazo-dibuja" pathLength={100} fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" vectorEffect="non-scaling-stroke"
          d="M62 4 C 30 2, 4 12, 5 31 C 6 50, 34 58, 58 56 C 84 54, 97 42, 95 27 C 93 11, 70 3, 42 6 C 36 7, 31 9, 27 11" />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

// Un sello de tinta: doble borde, girado, cae con un golpe
export function Estampa({ children, color, giro = -6 }: { children: ReactNode; color: string; giro?: number }) {
  return (
    <span className="estampa inline-block" style={{ ['--giro' as string]: `${giro}deg` }}>
      <span className="inline-block rounded-[3px] border-[2.5px] border-double px-2 py-0.5 font-titulo text-[14px] font-bold tracking-wide uppercase"
        style={{ color, borderColor: color }}>
        {children}
      </span>
    </span>
  );
}

// Una mancha de tinta con gotitas alrededor, para el daño
export function Salpicadura({ semilla, color = 'var(--peligro)', className = '' }: { semilla: number; color?: string; className?: string }) {
  const r = azar(semilla);
  const puntos = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const d = 30 + r() * 12 + (i % 3 === 0 ? r() * 9 : 0);
    return [50 + Math.cos(a) * d, 50 + Math.sin(a) * d * 0.82] as const;
  });
  // Curva suave que pasa cerca de cada punto
  const camino = puntos.map((p, i) => {
    const q = puntos[(i + 1) % puntos.length]!;
    return `${i === 0 ? `M${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}` : ''} Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
  }).join(' ');
  const gotas = Array.from({ length: 7 }, () => {
    const a = r() * Math.PI * 2;
    const d = 46 + r() * 16;
    return { x: 50 + Math.cos(a) * d, y: 50 + Math.sin(a) * d * 0.82, r: 1.5 + r() * 3.5 };
  });
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={`overflow-visible ${className}`}>
      <path d={`${camino} Z`} fill={color} opacity={0.92} />
      {gotas.map((g, i) => <circle key={i} cx={g.x} cy={g.y} r={g.r} fill={color} opacity={0.85} />)}
    </svg>
  );
}

// Una flechita de lápiz (para las notas al margen)
export function FlechaTinta({ className = '', color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 40 24" aria-hidden className={`overflow-visible ${className}`}>
      <path className="trazo-dibuja" pathLength={100} d="M38 4 C 28 3, 14 8, 5 18" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <path d="M4 10 L5 18 L13 17" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Un garabato debajo de una palabra
export function Subrayado({ color = 'currentColor', className = '' }: { color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden className={`block h-2 w-full overflow-visible ${className}`}>
      <path className="trazo-dibuja" pathLength={100} d="M2 6 C 20 3, 35 8, 52 5 S 82 3, 98 6 M10 8.5 C 30 7, 60 9.5, 90 7.5" fill="none" stroke={color}
        strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

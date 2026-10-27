import { piesEntre, type Casilla } from '../../reglas/movimiento';

// La regla para medir: una línea a lápiz de casilla a casilla, con la distancia de PF2e (diagonales 5/10)
// en pies y en casillas. La propia se dibuja en tinta; la de otro, con su color y su nombre.
export function DibujoRegla({ a, b, vista, celda, origen, color = 'var(--acento)', nombre }: {
  a: Casilla;
  b: Casilla;
  vista: { x: number; y: number; escala: number };
  celda: number;
  origen: { x: number; y: number };
  color?: string;
  nombre?: string;
}) {
  const centro = (c: Casilla) => ({
    x: (origen.x + (c.x + 0.5) * celda) * vista.escala + vista.x,
    y: (origen.y + (c.y + 0.5) * celda) * vista.escala + vista.y,
  });
  const p = centro(a);
  const q = centro(b);
  const pies = piesEntre(a, b);
  const lado = celda * vista.escala;
  return (
    <div className="pointer-events-none absolute inset-0 z-[8] overflow-hidden" aria-live="polite">
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        {/* Las dos casillas, marcadas */}
        {[a, b].map((c, i) => {
          const m = centro(c);
          return <rect key={i} x={m.x - lado / 2} y={m.y - lado / 2} width={lado} height={lado} fill={color} fillOpacity={0.14} stroke={color} strokeWidth={1.5} rx={3} />;
        })}
        <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--fondo)" strokeWidth={6} strokeLinecap="round" opacity={0.7} />
        <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={color} strokeWidth={2.5} strokeDasharray="9 6" strokeLinecap="round" />
        <circle cx={p.x} cy={p.y} r={4} fill={color} />
        <circle cx={q.x} cy={q.y} r={5} fill="none" stroke={color} strokeWidth={2} />
      </svg>
      <div className="absolute -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-md border-[1.5px] bg-superficie px-2 py-0.5 text-center font-titulo whitespace-nowrap shadow-[0_6px_14px_-8px_var(--sombra)]"
        style={{ left: q.x, top: q.y, borderColor: color }}>
        <b className="text-[17px] leading-tight">{pies} ft</b>
        <span className="ml-1.5 text-[12.5px] text-texto-suave">{pies / 5} {pies === 5 ? 'casilla' : 'casillas'}{nombre ? ` · ${nombre}` : ''}</span>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { TAMANOS, type EstadoSala } from '../../compartido/sala';
import type { PunteroAjeno, Senal } from '../conexion';

// Tintas para distinguir a cada quien en el tablero (se leen sobre papel claro y oscuro)
const TINTAS = ['#2f7de1', '#2f9e6a', '#8a55d6', '#dc7f24', '#0f9bb0', '#c8448d', '#6f8f1f'];
const TINTA_GM = '#a8743a';

// Siempre la misma tinta para la misma persona
export function tintaDe(p: { nombre: string; rol?: string; personajeId?: string }): string {
  if (p.rol === 'gm' || (!p.personajeId && p.nombre === 'GM')) return TINTA_GM;
  const semilla = p.personajeId ?? p.nombre;
  let h = 0;
  for (const c of semilla) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTAS[h % TINTAS.length]!;
}

// Un puntero quieto se va apagando: a los 5 s deja de verse
const QUIETO_MS = 5000;

// Los demás en el tablero: sus punteros con su nombre, la marca sobre el token al que apuntan, y sus señales.
// Capa HTML encima del lienzo, ubicada con la misma vista (posición y zoom) del tablero.
export function PresenciaTablero({ estado, vista, celda, origen, punteros, senales }: {
  estado: EstadoSala;
  vista: { x: number; y: number; escala: number };
  celda: number;
  origen: { x: number; y: number };
  punteros: PunteroAjeno[];
  senales: Senal[];
}) {
  // Un latido por segundo mientras haya punteros, para apagar los que se quedan quietos
  const [, setLatido] = useState(0);
  useEffect(() => {
    if (punteros.length === 0) return;
    const t = setInterval(() => setLatido((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [punteros.length]);

  const enPantalla = (x: number, y: number) => ({
    x: (origen.x + x * celda) * vista.escala + vista.x,
    y: (origen.y + y * celda) * vista.escala + vista.y,
  });

  // Quiénes apuntan a cada token
  const marcas = new Map<string, PunteroAjeno[]>();
  for (const p of punteros) {
    if (!p.apunta || !estado.tokens[p.apunta]) continue;
    marcas.set(p.apunta, [...(marcas.get(p.apunta) ?? []), p]);
  }
  const ahora = Date.now();

  return (
    <div className="pointer-events-none absolute inset-0 z-[7] overflow-hidden" aria-hidden>
      {[...marcas].map(([tokenId, quienes]) => {
        const t = estado.tokens[tokenId]!;
        const lado = TAMANOS[t.tamano] * celda * vista.escala;
        const esquina = enPantalla(t.x, t.y);
        const r = lado / 2;
        return (
          <div key={tokenId} className="absolute" style={{ left: esquina.x, top: esquina.y, width: lado, height: lado }}>
            {quienes.map((p, i) => (
              <svg key={p.idConexion} className="marca-objetivo absolute inset-0 overflow-visible" viewBox={`0 0 ${lado} ${lado}`}
                style={{ color: tintaDe(p), animationDelay: `${i * -1.2}s` }}>
                <circle cx={r} cy={r} r={r + 5 + i * 5} fill="none" stroke="currentColor" strokeWidth={2.5} strokeDasharray="10 6" />
                {/* Las cuatro muescas de mira */}
                {[0, 90, 180, 270].map((g) => (
                  <line key={g} x1={r} y1={-3 - i * 5} x2={r} y2={6 - i * 5} stroke="currentColor" strokeWidth={3} strokeLinecap="round"
                    transform={`rotate(${g} ${r} ${r})`} />
                ))}
              </svg>
            ))}
            <div className="absolute left-full ml-1 flex flex-col gap-0.5" style={{ top: -6 }}>
              {quienes.map((p) => (
                <span key={p.idConexion} className="whitespace-nowrap rounded-sm px-1.5 py-px font-titulo text-[12px] font-semibold text-white shadow-sm"
                  style={{ background: tintaDe(p) }}>
                  {p.nombre} apunta
                </span>
              ))}
            </div>
          </div>
        );
      })}

      {punteros.map((p) => {
        if (p.x === null || p.y === null) return null;
        const s = enPantalla(p.x, p.y);
        const tinta = tintaDe(p);
        const quieto = ahora - p.cuando > QUIETO_MS;
        return (
          <div key={p.idConexion} className="absolute top-0 left-0 transition-[transform,opacity] duration-100 ease-linear"
            style={{ transform: `translate(${s.x}px, ${s.y}px)`, opacity: quieto ? 0 : 1 }}>
            <svg width="20" height="22" viewBox="0 0 20 22" className="-translate-x-[2px] -translate-y-[2px] drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.35)]">
              <path d="M2 2 L2 18 L6.6 13.8 L9.8 20.4 L12.9 19 L9.8 12.5 L16 12.2 Z" fill={tinta} stroke="white" strokeWidth={1.6} strokeLinejoin="round" />
            </svg>
            <span className="absolute top-[18px] left-[12px] whitespace-nowrap rounded-sm px-1.5 py-px font-titulo text-[12.5px] font-semibold text-white shadow-sm"
              style={{ background: tinta }}>
              {p.nombre}
            </span>
          </div>
        );
      })}

      {senales.map((sn) => {
        const s = enPantalla(sn.x, sn.y);
        const tinta = tintaDe(sn);
        return (
          <div key={sn.id} className="absolute top-0 left-0" style={{ transform: `translate(${s.x}px, ${s.y}px)` }} role="status">
            {[0, 1, 2].map((i) => (
              <span key={i} className="senal-onda absolute -top-8 -left-8 size-16 rounded-full border-[3px]"
                style={{ borderColor: tinta, animationDelay: `${i * 0.35}s` }} />
            ))}
            <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full" style={{ background: tinta }} />
            <span className="senal-nombre absolute top-3 left-3 whitespace-nowrap rounded-sm px-1.5 py-px font-titulo text-[13px] font-bold text-white shadow-sm"
              style={{ background: tinta }}>
              ¡{sn.nombre} señala aquí!
            </span>
          </div>
        );
      })}
    </div>
  );
}

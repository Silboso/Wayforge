import { useEffect, useRef, useState } from 'react';
import { TAMANOS, type EstadoSala } from '../../compartido/sala';
import type { Evento } from '../../compartido/eventos';
import type { Grado } from '../../reglas/pf2e';

interface Efecto {
  id: number;
  desde?: string;
  hasta: string;
  // Ataque con grado, o daño (número)
  grado?: Grado;
  dano?: number;
}

const DURA_MS = 1700;

// Lo que se ve en el tablero cuando alguien tira contra alguien: el trazo del golpe, el impacto y el número.
// Es una capa HTML/SVG encima del lienzo, ubicada con la misma vista (posición y zoom) del tablero.
export function EfectosTablero({ eventos, estado, vista, celda }: {
  eventos: { id: number; evento: Evento }[];
  estado: EstadoSala;
  vista: { x: number; y: number; escala: number };
  celda: number;
}) {
  const [efectos, setEfectos] = useState<Efecto[]>([]);
  const [sello, setSello] = useState<{ id: number; nombre: string; ronda: number } | null>(null);
  const [rastros, setRastros] = useState<{ id: number; camino: { x: number; y: number }[]; tokenId: string }[]>([]);
  const visto = useRef(eventos.at(-1)?.id ?? 0);

  useEffect(() => {
    const nuevos = eventos.filter((e) => e.id > visto.current);
    if (nuevos.length === 0) return;
    visto.current = nuevos.at(-1)!.id;
    const creados: Efecto[] = [];
    for (const { id, evento } of nuevos) {
      // Cambio de turno: un sello sobre el tablero, para que nadie se pierda de quién juega
      if (evento.tipo === 'turno') {
        const t = estado.tokens[evento.tokenId];
        if (t) setSello({ id, nombre: t.nombre, ronda: evento.ronda });
        continue;
      }
      // Un movimiento deja su huella punteada un momento
      if (evento.tipo === 'movimiento' && evento.camino && evento.camino.length > 1) {
        const rastro = { id, camino: evento.camino, tokenId: evento.tokenId };
        setRastros((prev) => [...prev, rastro]);
        setTimeout(() => setRastros((prev) => prev.filter((r) => r.id !== id)), 2200);
        continue;
      }
      if (evento.tipo !== 'tirada' || !evento.tirada.objetivo?.tokenId) continue;
      const t = evento.tirada;
      creados.push({
        id, hasta: t.objetivo!.tokenId!, ...(t.autorTokenId ? { desde: t.autorTokenId } : {}),
        ...(t.objetivo!.grado ? { grado: t.objetivo!.grado } : { dano: t.total }),
      });
    }
    if (creados.length === 0) return;
    setEfectos((prev) => [...prev, ...creados]);
    const ids = new Set(creados.map((c) => c.id));
    const temporizador = setTimeout(() => setEfectos((prev) => prev.filter((e) => !ids.has(e.id))), DURA_MS);
    return () => clearTimeout(temporizador);
  }, [eventos]);

  const centro = (tokenId: string) => {
    const t = estado.tokens[tokenId];
    if (!t) return null;
    const lado = TAMANOS[t.tamano] * celda;
    const ox = estado.mapa.desplazamientoX % celda;
    const oy = estado.mapa.desplazamientoY % celda;
    return {
      x: (ox + t.x * celda + lado / 2) * vista.escala + vista.x,
      y: (oy + t.y * celda + lado / 2) * vista.escala + vista.y,
      r: (lado / 2) * vista.escala,
    };
  };

  useEffect(() => {
    if (!sello) return;
    const t = setTimeout(() => setSello(null), 1800);
    return () => clearTimeout(t);
  }, [sello]);

  const enCasilla = (c: { x: number; y: number }, tokenId: string) => {
    const t = estado.tokens[tokenId];
    const lado = (t ? TAMANOS[t.tamano] : 1) * celda;
    const ox = estado.mapa.desplazamientoX % celda;
    const oy = estado.mapa.desplazamientoY % celda;
    return { x: (ox + c.x * celda + lado / 2) * vista.escala + vista.x, y: (oy + c.y * celda + lado / 2) * vista.escala + vista.y };
  };

  if (efectos.length === 0 && !sello && rastros.length === 0) return null;
  return (
    <>
    {sello && (
      <div key={sello.id} className="pointer-events-none absolute inset-x-0 top-[22%] z-[6] flex justify-center" role="status">
        <div className="sello-turno rounded-md border-[3px] border-double border-acento bg-superficie/90 px-6 py-2 text-center text-acento">
          <p className="font-titulo text-[13px] tracking-wide">Ronda {sello.ronda}</p>
          <p className="font-titulo text-[30px] leading-tight font-bold">Turno de {sello.nombre}</p>
        </div>
      </div>
    )}
    <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible" aria-hidden>
      {rastros.map((r) => {
        const puntos = r.camino.map((c) => enCasilla(c, r.tokenId));
        return (
          <g key={r.id} className="efecto-rastro">
            <polyline points={puntos.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--acento)" strokeWidth={2.5}
              strokeDasharray="2 8" strokeLinecap="round" strokeLinejoin="round" />
            {puntos.slice(1, -1).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--acento)" />)}
          </g>
        );
      })}
      {efectos.map((e) => {
        const b = centro(e.hasta);
        if (!b) return null;
        const a = e.desde ? centro(e.desde) : null;
        const acierta = e.grado === 'exito' || e.grado === 'critico';
        const critico = e.grado === 'critico';
        const texto = e.dano !== undefined ? `−${e.dano}` : critico ? '¡Crítico!' : acierta ? '¡Le diste!' : e.grado === 'pifia' ? 'Pifia' : 'Falló';
        const tinta = e.dano !== undefined || critico ? 'var(--peligro)' : acierta ? 'var(--acento)' : 'var(--texto-suave)';
        // El trazo para antes del borde del objetivo, como un tajo de pluma
        const fin = a ? acercar(a, b, b.r * 0.6) : null;
        return (
          <g key={e.id}>
            {a && fin && e.grado && (
              <path d={`M${a.x} ${a.y} Q ${(a.x + fin.x) / 2 + (fin.y - a.y) * 0.12} ${(a.y + fin.y) / 2 - (fin.x - a.x) * 0.12} ${fin.x} ${fin.y}`}
                className="efecto-trazo" fill="none" stroke={tinta} strokeWidth={critico ? 4 : acierta ? 3 : 2} strokeLinecap="round"
                opacity={acierta ? 1 : 0.7} pathLength={100} />
            )}
            {(acierta || e.dano !== undefined) && (
              <g className="efecto-impacto" style={{ transformOrigin: `${b.x}px ${b.y}px` }}>
                <circle cx={b.x} cy={b.y} r={b.r + 6} fill="none" stroke={tinta} strokeWidth={2.5} />
                {Array.from({ length: critico ? 10 : 7 }, (_, i) => {
                  const ang = (i / (critico ? 10 : 7)) * Math.PI * 2 + 0.3;
                  const r0 = b.r + 10;
                  const r1 = b.r + (critico ? 30 : 22) + (i % 2) * 6;
                  return <line key={i} x1={b.x + Math.cos(ang) * r0} y1={b.y + Math.sin(ang) * r0} x2={b.x + Math.cos(ang) * r1} y2={b.y + Math.sin(ang) * r1}
                    stroke={tinta} strokeWidth={2.5} strokeLinecap="round" />;
                })}
              </g>
            )}
            <text x={b.x} y={b.y - b.r - 14} textAnchor="middle" className="efecto-sube font-titulo font-bold"
              style={{ fontSize: e.dano !== undefined || critico ? 30 : 22, fill: tinta, stroke: 'var(--fondo)', strokeWidth: 5, paintOrder: 'stroke' }}>
              {texto}
            </text>
          </g>
        );
      })}
    </svg>
    </>
  );
}

function acercar(a: { x: number; y: number }, b: { x: number; y: number }, margen: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo = Math.hypot(dx, dy) || 1;
  const k = Math.max(0, (largo - margen) / largo);
  return { x: a.x + dx * k, y: a.y + dy * k };
}

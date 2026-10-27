import { useEffect, useRef, useState } from 'react';
import { TAMANOS, type EstadoSala } from '../../compartido/sala';
import type { Evento } from '../../compartido/eventos';
import type { Grado } from '../../reglas/pf2e';
import type { Aspecto } from '../../reglas/efectos';
import { Salpicadura, semillaDe, Subrayado } from './dados/Tinta';
import { IconoAspecto, tintaDe } from './aspectos';

interface Efecto {
  id: number;
  desde?: string;
  hasta: string;
  // Ataque con grado, o daño (número)
  grado?: Grado;
  dano?: number;
  // Nota a lápiz junto al número: el tipo de daño, "×2 crítico"
  nota?: string;
  // El grado es de una salvación del objetivo (se lee al revés: un éxito es que resistió)
  salvacion?: boolean;
  curacion?: number;
  // Llega justo después del sello de la tirada
  despues?: boolean;
  // Un efecto que alguien recibe o pierde
  etiqueta?: { nombre: string; beneficioso: boolean; aspecto?: Aspecto; quitado: boolean };
  // Quedó a 0 PG
  cayo?: boolean;
}

interface Estallido {
  id: number;
  casillas: { x: number; y: number }[];
  tinta: string;
}

const DURA_MS = 2600;

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
  const [estallidos, setEstallidos] = useState<Estallido[]>([]);
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
      // Un área: sus casillas se llenan con la tinta del elemento
      if (evento.tipo === 'area') {
        const estallido = { id, casillas: evento.casillas, tinta: tintaDe(evento.aspecto, evento.tipoDano) };
        setEstallidos((prev) => [...prev, estallido]);
        setTimeout(() => setEstallidos((prev) => prev.filter((r) => r.id !== id)), 2000);
        continue;
      }
      if (evento.tipo === 'dano') {
        creados.push({ id, hasta: evento.tokenId, dano: evento.cantidad, despues: true, cayo: evento.cayo, ...(evento.critico ? { nota: '×2 crítico' } : {}) });
        continue;
      }
      if (evento.tipo === 'curacion') {
        creados.push({ id, hasta: evento.tokenId, curacion: evento.cantidad, despues: true });
        continue;
      }
      if (evento.tipo === 'efecto') {
        creados.push({ id, hasta: evento.tokenId, etiqueta: { nombre: evento.nombre, beneficioso: evento.beneficioso, quitado: evento.quitado, ...(evento.aspecto ? { aspecto: evento.aspecto } : {}) } });
        continue;
      }
      if (evento.tipo !== 'tirada' || !evento.tirada.objetivo?.tokenId) continue;
      const t = evento.tirada;
      // Lo que resolvió el motor: el sello del grado y nada más (el número llega con el daño aplicado)
      if (t.resultado) {
        if (t.objetivo!.grado) {
          creados.push({
            id, hasta: t.objetivo!.tokenId!, grado: t.objetivo!.grado, ...(t.objetivo!.salvacion ? { salvacion: true } : {}),
            ...(t.autorTokenId && !t.objetivo!.salvacion ? { desde: t.autorTokenId } : {}),
          });
        }
        continue;
      }
      const tipo = /\(([^)]+)\)/.exec(t.etiqueta)?.[1];
      const nota = [t.etiqueta.startsWith('Daño crítico') ? '×2 crítico' : null, tipo].filter(Boolean).join(' · ');
      creados.push({
        id, hasta: t.objetivo!.tokenId!, ...(t.autorTokenId ? { desde: t.autorTokenId } : {}),
        ...(t.objetivo!.grado ? { grado: t.objetivo!.grado } : { dano: t.total }),
        ...(nota ? { nota } : {}),
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

  const esquina = (c: { x: number; y: number }) => {
    const ox = estado.mapa.desplazamientoX % celda;
    const oy = estado.mapa.desplazamientoY % celda;
    return { x: (ox + c.x * celda) * vista.escala + vista.x, y: (oy + c.y * celda) * vista.escala + vista.y };
  };

  if (efectos.length === 0 && !sello && rastros.length === 0 && estallidos.length === 0) return null;
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
      {estallidos.map((s) => {
        const lado = celda * vista.escala;
        // Centro del área, para que el estallido crezca desde ahí y las salpicaduras salgan hacia afuera
        const cx = s.casillas.reduce((n, c) => n + c.x + 0.5, 0) / Math.max(1, s.casillas.length);
        const cy = s.casillas.reduce((n, c) => n + c.y + 0.5, 0) / Math.max(1, s.casillas.length);
        const centroArea = esquina({ x: cx, y: cy });
        const radio = Math.sqrt(s.casillas.length) * lado * 0.6;
        const semilla = semillaDe(String(s.id));
        return (
          <g key={s.id}>
            <g className="area-tinta" style={{ transformOrigin: `${centroArea.x}px ${centroArea.y}px` }}>
              {s.casillas.map((c) => {
                const p = esquina(c);
                return <rect key={`${c.x},${c.y}`} x={p.x + 1} y={p.y + 1} width={lado - 2} height={lado - 2} rx={lado * 0.18} fill={s.tinta} fillOpacity={0.45} stroke={s.tinta} strokeOpacity={0.7} strokeWidth={1.5} />;
              })}
            </g>
            {Array.from({ length: 14 }, (_, i) => {
              const ang = (i / 14) * Math.PI * 2 + (semilla % 7) * 0.2;
              const lejos = radio * (0.9 + ((semilla >> i) % 5) * 0.12);
              return (
                <circle key={i} className="area-chispa" cx={centroArea.x} cy={centroArea.y} r={3 + (i % 3) * 2} fill={s.tinta}
                  style={{ ['--dx' as string]: `${Math.cos(ang) * lejos}px`, ['--dy' as string]: `${Math.sin(ang) * lejos}px`, animationDelay: `${(i % 4) * 40}ms` }} />
              );
            })}
          </g>
        );
      })}
      {efectos.filter((e) => e.curacion !== undefined).map((e) => {
        const b = centro(e.hasta);
        if (!b) return null;
        return (
          <g key={`c${e.id}`}>
            {Array.from({ length: 9 }, (_, i) => (
              <path key={i} className="curacion-chispa" d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#3f9b52"
                transform={`translate(${b.x + Math.cos(i * 0.7) * b.r * 0.9} ${b.y + Math.sin(i * 1.3) * b.r * 0.6})`} style={{ animationDelay: `${i * 70}ms` }} />
            ))}
          </g>
        );
      })}
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
      {efectos.filter((e) => e.grado || e.dano !== undefined).map((e) => {
        const b = centro(e.hasta);
        if (!b) return null;
        const a = e.desde ? centro(e.desde) : null;
        // En una salvación, "le diste" es que el objetivo falló
        const acierta = e.salvacion ? e.grado === 'fallo' || e.grado === 'pifia' : e.grado === 'exito' || e.grado === 'critico';
        const critico = e.salvacion ? e.grado === 'pifia' : e.grado === 'critico';
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
          </g>
        );
      })}
    </svg>
    {/* Las notas a tinta sobre el objetivo: el daño sobre una mancha roja, el resultado escrito a mano */}
    {efectos.map((e) => {
      const b = centro(e.hasta);
      if (!b) return null;
      const acierta = e.grado === 'exito' || e.grado === 'critico';
      const giro = (semillaDe(String(e.id)) % 11) - 5;
      if (e.etiqueta) {
        const tinta = e.etiqueta.beneficioso ? tintaDe(e.etiqueta.aspecto ?? 'bendicion') : tintaDe(e.etiqueta.aspecto ?? 'marca');
        return (
          <div key={e.id} className="etiqueta-efecto pointer-events-none absolute z-[6] flex items-center gap-1 rounded-full border-[1.5px] bg-fondo/90 px-2 py-0.5 font-titulo text-[14px] font-bold whitespace-nowrap"
            style={{ left: b.x, top: b.y + b.r + 4, borderColor: tinta, color: tinta }} aria-hidden>
            <IconoAspecto aspecto={e.etiqueta.aspecto ?? (e.etiqueta.beneficioso ? 'bendicion' : 'marca')} size={14} />
            <span className={e.etiqueta.quitado ? 'line-through decoration-2' : ''}>{e.etiqueta.nombre}</span>
          </div>
        );
      }
      if (e.curacion !== undefined) {
        return (
          <div key={e.id} className="nota-tinta despues pointer-events-none absolute z-[6] flex flex-col items-center"
            style={{ left: b.x, top: b.y + 16, ['--giro' as string]: `${giro}deg` }} aria-hidden>
            <b className="rounded-md bg-fondo/85 px-2 font-titulo text-[32px] leading-none text-[#2f8a44]">+{e.curacion}</b>
          </div>
        );
      }
      if (e.salvacion && e.grado) {
        // Lo que se lee sobre quien salvó: resistió, a medias, falló
        const texto = { critico: 'Resiste', exito: 'A medias', fallo: 'Falla', pifia: '¡Falla feo!' }[e.grado];
        const malo = e.grado === 'fallo' || e.grado === 'pifia';
        return (
          <div key={e.id} className="nota-tinta pointer-events-none absolute z-[6] flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ left: b.x, top: b.y - b.r - 4, ['--giro' as string]: `${giro}deg` }} aria-hidden>
            <span className={`rounded-sm bg-fondo/80 px-1.5 font-titulo font-bold ${e.grado === 'pifia' ? 'text-[26px] text-peligro' : malo ? 'text-[22px] text-peligro' : e.grado === 'critico' ? 'text-[22px] text-exito' : 'text-[21px] text-texto-suave'}`}>
              {texto}
            </span>
          </div>
        );
      }
      return (
        // El daño aplicado cae sobre el token (la animación ya lo centra); el sello de la tirada queda arriba
        <div key={e.id} className={`nota-tinta pointer-events-none absolute z-[6] flex flex-col items-center ${e.despues ? 'despues' : '-translate-x-1/2 -translate-y-full'}`}
          style={{ left: b.x, top: e.despues ? b.y + 34 : b.y - b.r - 4, ['--giro' as string]: `${giro}deg` }} aria-hidden>
          {e.dano !== undefined ? (
            <>
              <span className="relative flex h-[62px] min-w-[74px] items-center justify-center px-3">
                <Salpicadura semilla={semillaDe(String(e.id))} className="absolute inset-0 h-full w-full" />
                <b className="relative font-titulo text-[32px] leading-none text-white">−{e.dano}</b>
              </span>
              {e.nota && <span className="mt-0.5 rounded-sm bg-fondo/85 px-1.5 font-titulo text-[13px] text-texto-suave italic">{e.nota}</span>}
              {e.cayo && <span className="mt-0.5 rotate-[-4deg] rounded-sm border-2 border-peligro bg-fondo/90 px-1.5 font-titulo text-[17px] font-bold text-peligro">¡Cae!</span>}
            </>
          ) : (
            <span className={`flex flex-col items-center rounded-sm bg-fondo/80 px-1.5 font-titulo font-bold ${e.grado === 'critico' ? 'text-[28px] text-peligro' : acierta ? 'text-[24px] text-acento' : e.grado === 'pifia' ? 'text-[22px] text-peligro' : 'text-[21px] text-texto-suave'}`}>
              <span className={acierta ? '' : 'line-through decoration-2'}>
                {e.grado === 'critico' ? '¡Crítico!' : acierta ? '¡Le diste!' : e.grado === 'pifia' ? 'Pifia' : 'Falló'}
              </span>
              {acierta && <Subrayado className="-mt-1" />}
            </span>
          )}
        </div>
      );
    })}
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

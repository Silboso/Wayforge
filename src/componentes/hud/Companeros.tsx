import { useState } from 'react';
import { HeartbeatIcon, ShieldIcon, StarIcon, WifiSlashIcon } from '@phosphor-icons/react';
import { calcular, signo } from '../../../reglas/pf2e';
import { CONDICIONES } from '../../../reglas/condiciones';
import { duracionTexto, modificadorTexto } from '../../../reglas/efectos';
import { tokenEnTurno, type EstadoSala, type Presente } from '../../../compartido/sala';
import { IconoAspecto, TINTA_ASPECTO } from '../aspectos';
import { BarraPG, PostitCondicion } from './piezas';

const tintaVida = (f: number) => (f > 0.5 ? 'var(--exito)' : f > 0.2 ? '#d69a2d' : 'var(--peligro)');

// Los compañeros de mesa, en miniatura a la izquierda del tablero: su retrato con un anillo de vida y marquitas
// de lo que tienen encima. Al pasar el cursor (o tocar, en pantalla táctil) se ve el detalle: PG, condiciones y
// efectos con su duración. Tocar el retrato lleva la vista a su token.
export function Companeros({ estado, presentes, excluir, onEnfocar, className = '', horizontal = false }: {
  estado: EstadoSala;
  presentes: Presente[];
  // El personaje de quien mira: él ya tiene su hoja abajo
  excluir?: string;
  onEnfocar: (tokenId: string) => void;
  className?: string;
  horizontal?: boolean;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const conectados = new Set(presentes.map((x) => x.nombre));
  const enTurno = tokenEnTurno(estado);
  const personajes = Object.values(estado.personajes).filter((p) => p.id !== excluir);
  if (personajes.length === 0) return null;
  return (
    <nav aria-label="Compañeros" className={`flex gap-4 ${horizontal ? 'flex-row' : 'flex-col'} ${className}`}>
      {personajes.map((p) => {
        const token = Object.values(estado.tokens).find((t) => t.personajeId === p.id);
        const condiciones = token?.condiciones ?? [];
        const efectos = (token?.efectos ?? []).filter((e) => !e.inmuneA);
        const f = calcular(p, condiciones, efectos);
        const max = f.pgMax.total;
        const fraccion = max ? Math.max(0, Math.min(1, p.pgActual / max)) : 0;
        const leToca = !!token && enTurno?.id === token.id;
        const enLinea = conectados.has(p.nombre);
        const cayendo = condiciones.find((c) => c.clave === 'dying');
        // Las marquitas: primero los efectos (con su ícono y tinta), después las condiciones (post-it con su inicial)
        const marcas = [
          ...efectos.map((e) => ({ id: e.id, tipo: 'efecto' as const, e })),
          ...condiciones.filter((c) => c.clave !== 'dying' && c.clave !== 'unconscious').map((c) => ({ id: c.clave, tipo: 'condicion' as const, c })),
        ];
        const visibles = marcas.slice(0, 3);
        const resto = marcas.length - visibles.length;
        const radio = 25;
        const vuelta = 2 * Math.PI * radio;
        const verDetalle = abierto === p.id;
        return (
          <div key={p.id} className="group relative"
            onMouseEnter={() => setAbierto(p.id)} onMouseLeave={() => setAbierto((x) => (x === p.id ? null : x))}>
            <button
              onClick={() => (token ? onEnfocar(token.id) : undefined)}
              onFocus={() => setAbierto(p.id)} onBlur={() => setAbierto((x) => (x === p.id ? null : x))}
              onTouchStart={() => setAbierto((x) => (x === p.id ? null : p.id))}
              aria-label={`${p.nombre}: ${p.pgActual} de ${max} PG${condiciones.length ? `, ${condiciones.length} condiciones` : ''}${efectos.length ? `, ${efectos.length} efectos` : ''}. Ver su token.`}
              aria-describedby={verDetalle ? `detalle-${p.id}` : undefined}
              className={`relative flex size-[58px] items-center justify-center rounded-full transition hover:scale-105 ${enLinea ? '' : 'opacity-75'}`}>
              {/* El anillo de vida: lleno de verde, se va vaciando y cambia a ámbar y rojo */}
              <svg viewBox="0 0 58 58" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="29" cy="29" r={radio} fill="var(--superficie)" stroke="var(--borde)" strokeWidth="4" />
                <circle cx="29" cy="29" r={radio} fill="none" stroke={tintaVida(fraccion)} strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${vuelta * fraccion} ${vuelta}`} className="transition-[stroke-dasharray] duration-500" />
                {p.pgTemporales > 0 && (
                  <circle cx="29" cy="29" r={radio + 3.5} fill="none" stroke="var(--acento)" strokeWidth="1.6" strokeDasharray={`${Math.min(1, p.pgTemporales / max) * vuelta} ${vuelta * 2}`} />
                )}
              </svg>
              <span className={`relative flex size-[42px] items-center justify-center overflow-hidden rounded-full border-2 ${leToca ? 'border-acento' : 'border-superficie'} bg-superficie-2`}>
                {p.retrato
                  ? <img src={p.retrato} alt="" className="size-full object-cover" />
                  : <span className="font-titulo text-lg font-bold text-acento">{p.nombre.slice(0, 1).toUpperCase()}</span>}
              </span>
              {leToca && (
                <span className="absolute -top-1 -left-1 flex size-5 items-center justify-center rounded-full bg-marca text-sobre-marca shadow" title="Le toca">
                  <StarIcon size={12} weight="fill" aria-hidden />
                </span>
              )}
              {cayendo && (
                <span className="absolute -top-1 -right-1 flex h-5 items-center gap-0.5 rounded-full bg-peligro px-1 text-[10px] font-bold text-sobre-acento shadow" title={`Dying ${cayendo.valor}`}>
                  <HeartbeatIcon size={11} weight="bold" aria-hidden />{cayendo.valor}
                </span>
              )}
              {!enLinea && (
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-superficie text-texto-suave shadow" title="Sin conexión">
                  <WifiSlashIcon size={11} aria-hidden />
                </span>
              )}
              {visibles.length > 0 && (
                <span className="absolute -right-1.5 -bottom-1 flex items-center -space-x-1">
                  {visibles.map((m) => m.tipo === 'efecto' ? (
                    <span key={m.id} className="flex size-[18px] items-center justify-center rounded-full border-[1.5px] border-superficie text-white shadow-sm"
                      style={{ background: m.e.aspecto ? TINTA_ASPECTO[m.e.aspecto] : m.e.beneficioso ? 'var(--exito)' : 'var(--peligro)' }}>
                      <IconoAspecto aspecto={m.e.aspecto} size={10} />
                    </span>
                  ) : (
                    <span key={m.id} className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] border-[1.5px] border-superficie bg-[var(--postit)] px-0.5 font-titulo text-[10px] font-bold text-[#5a2a3a] shadow-sm">
                      {CONDICIONES[m.c.clave].nombre.slice(0, 1)}{CONDICIONES[m.c.clave].conValor ? m.c.valor : ''}
                    </span>
                  ))}
                  {resto > 0 && <span className="flex size-[18px] items-center justify-center rounded-full border-[1.5px] border-superficie bg-texto text-[9.5px] font-bold text-fondo">+{resto}</span>}
                </span>
              )}
            </button>

            {verDetalle && (
              <div id={`detalle-${p.id}`} role="tooltip"
                className={`tarjeta-cae absolute z-40 w-72 rounded-xl border-2 border-borde bg-superficie p-3 font-titulo shadow-[0_16px_34px_-16px_var(--sombra)] ${horizontal ? 'top-[calc(100%+8px)] left-0' : 'top-0 left-[calc(100%+10px)]'}`}>
                <div className="flex items-baseline gap-2">
                  <b className="truncate text-[17px]">{p.nombre}</b>
                  {leToca && <span className="marcatextos text-[12px]">le toca</span>}
                  {!enLinea && <span className="text-[12px] text-texto-suave">sin conexión</span>}
                </div>
                <p className="truncate text-[12.5px] text-texto-suave">{[p.ascendencia, p.clase].filter(Boolean).join(' · ')} · nivel {p.nivel}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1"><BarraPG actual={p.pgActual} max={max} temporales={p.pgTemporales} alto="h-2.5" /></div>
                  <span className="text-[14px] tabular-nums"><b>{p.pgActual}</b>/{max}{p.pgTemporales > 0 && <span className="text-acento"> +{p.pgTemporales}</span>}</span>
                </div>
                <p className="mt-1 flex gap-3 text-[13px] text-texto-suave">
                  <span className="flex items-center gap-1"><ShieldIcon size={13} aria-hidden /> CA {f.ca.total}</span>
                  <span>Perc {signo(f.percepcion.total)}</span>
                  <span>Vel {p.velocidad} ft</span>
                </p>
                {condiciones.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {condiciones.map((c, i) => <PostitCondicion key={c.clave} condicion={c} compacto giro={i % 2 ? -2 : 2} />)}
                  </div>
                )}
                {efectos.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1.5 border-t border-dashed border-borde pt-2">
                    {efectos.map((e) => (
                      <li key={e.id} className="flex items-start gap-2">
                        <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full text-white"
                          style={{ background: e.aspecto ? TINTA_ASPECTO[e.aspecto] : e.beneficioso ? 'var(--exito)' : 'var(--peligro)' }}>
                          <IconoAspecto aspecto={e.aspecto} size={10} />
                        </span>
                        <span className="min-w-0 text-[13px] leading-snug">
                          <b className={e.beneficioso ? '' : 'text-peligro'}>{e.nombre}</b>
                          <span className="text-texto-suave"> · {duracionTexto(e.duracion)}</span>
                          {(e.modificadores.length > 0 || e.persistente) && (
                            <span className="block text-[12px] text-texto-suave">
                              {[...e.modificadores.map(modificadorTexto), e.persistente ? `${e.persistente.dano} ${e.persistente.tipo} al final de su turno` : ''].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {condiciones.length === 0 && efectos.length === 0 && <p className="mt-2 text-[13px] text-texto-suave">Sin condiciones ni efectos.</p>}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

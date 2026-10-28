import { useState } from 'react';
import { CaretDownIcon, CaretUpIcon, FootprintsIcon, PencilSimpleIcon, ShieldIcon, StickerIcon, XIcon, HourglassMediumIcon } from '@phosphor-icons/react';
import { calcular, signo } from '../../../reglas/pf2e';
import { penalizacionesAtaque, type AtaqueCriatura } from '../../../reglas/criaturas';
import { alcanzables, desdeClave, distanciaEntre, type Casilla } from '../../../reglas/movimiento';
import {
  caDeToken, ladoDe, motivoAlcance, motivoParaActuarToken, opcionesMovimiento, tokenEnTurno, velocidadDe, type EstadoSala, type Token,
} from '../../../compartido/sala';
import { BarraPG, CostoAccion, FotoPegada, PostitCondicion, Rombo, Tecla } from '../hud/piezas';
import { TECLAS } from '../hud/secciones';
import { EfectosActivos } from '../EfectosActivos';

type Chequeo = 'fortitude' | 'reflex' | 'will' | 'percepcion';

// La hoja del token que maneja el GM, apoyada abajo como la del jugador: quién es, qué puede hacer y su estado
export function HojaCriatura({ estado, actor, plegada, onPlegar, numero, onAtacar, onAsomar, onDano, onChequeo, onPG, onCondiciones, onEditar, onTerminar, onEsperar, onVolver, onCerrar, onQuitarEfecto }: {
  // Quitar un efecto que le dejó una aptitud (el GM manda)
  onQuitarEfecto?: (efectoId: string) => void;
  estado: EstadoSala;
  actor: Token;
  plegada: boolean;
  onPlegar: () => void;
  // Qué ataque del turno toca (0, 1, 2)
  numero: 0 | 1 | 2;
  onAtacar: (a: AtaqueCriatura) => void;
  onAsomar: (a: AtaqueCriatura | null) => void;
  onDano: (a: AtaqueCriatura, critico: boolean) => void;
  onChequeo: (clave: Chequeo) => void;
  // Restar (negativo) o sumar PG
  onPG: (delta: number) => void;
  onCondiciones: () => void;
  onEditar: () => void;
  onTerminar: () => void;
  // Delay: dejar su turno para más tarde, y volver
  onEsperar: () => void;
  onVolver: () => void;
  onCerrar: () => void;
}) {
  const [cantidad, setCantidad] = useState('');
  const n = Math.max(0, Math.floor(Number(cantidad) || 0));
  const c = estado.combate;
  const suTurno = !!c && tokenEnTurno(estado)?.id === actor.id;
  const espera = !!c && (c.demorados ?? []).includes(actor.id);
  const libres = suTurno ? c!.acciones - c!.usadas : null;
  const personaje = actor.personajeId ? estado.personajes[actor.personajeId] : undefined;
  const ficha = personaje ? calcular(personaje, actor.condiciones ?? [], actor.efectos ?? []) : null;
  const cr = actor.criatura;
  const pg = personaje ? { actual: personaje.pgActual, max: ficha!.pgMax.total } : actor.pg;
  const ca = caDeToken(estado, actor)?.total ?? null;
  const salvaciones: [Chequeo, string, number | null][] = personaje && ficha
    ? [['fortitude', 'Fort', ficha.salvaciones.fortitude.total], ['reflex', 'Ref', ficha.salvaciones.reflex.total], ['will', 'Will', ficha.salvaciones.will.total], ['percepcion', 'Perc', ficha.percepcion.total]]
    : [['fortitude', 'Fort', cr?.salvaciones.fortitude ?? null], ['reflex', 'Ref', cr?.salvaciones.reflex ?? null], ['will', 'Will', cr?.salvaciones.will ?? null], ['percepcion', 'Perc', actor.percepcion ?? null]];
  const condiciones = actor.condiciones ?? [];

  return (
    <section aria-label={`Hoja de ${actor.nombre}`}
      className={`hoja absolute inset-x-2 bottom-2 z-10 transition-transform duration-300 ease-out lg:inset-x-5 lg:bottom-5 ${plegada ? 'translate-y-[calc(100%-56px)]' : ''}`}>
      <div className="absolute -top-9 right-6 flex gap-1">
        <button className="flex h-9 items-center gap-1.5 rounded-t-lg bg-superficie px-3 font-titulo text-[13px] text-texto-suave shadow-[0_-4px_10px_-6px_var(--sombra)] hover:text-acento"
          onClick={onPlegar} aria-expanded={!plegada}>
          {plegada ? <CaretUpIcon size={16} aria-hidden /> : <CaretDownIcon size={16} aria-hidden />}
          {plegada ? `Mostrar a ${actor.nombre}` : 'Bajar la hoja'}
        </button>
        <button className="flex h-9 items-center rounded-t-lg bg-superficie px-2.5 text-texto-suave shadow-[0_-4px_10px_-6px_var(--sombra)] hover:text-acento"
          onClick={onCerrar} aria-label="Soltar este token"><XIcon size={16} aria-hidden /></button>
      </div>
      <div className="grid max-h-[58vh] grid-cols-1 overflow-y-auto lg:max-h-none lg:min-h-[250px] lg:grid-cols-[290px_minmax(0,1fr)_250px] lg:overflow-visible xl:grid-cols-[310px_minmax(0,1fr)_270px]">
        {/* Quién es */}
        <div className="flex flex-col gap-3 px-5 pt-4 pb-4">
          <div className="flex items-center gap-3.5">
            <FotoPegada src={actor.imagen || undefined} inicial={actor.nombre.slice(0, 1)} nombre={actor.nombre} onEditar={onEditar} />
            <div className="min-w-0">
              <h2 className={`truncate font-titulo text-[26px] leading-none font-bold ${actor.personajeId ? 'text-acento' : 'text-peligro'}`}>{actor.nombre}</h2>
              <p className="mt-1 truncate font-titulo text-[14px] text-texto-suave">
                {personaje ? `${personaje.clase} · nivel ${personaje.nivel} · jugador` : cr ? `${actor.tipo === 'npc' ? 'NPC' : 'Criatura'} · nivel ${cr.nivel}` : 'Sin números todavía'}
              </p>
            </div>
          </div>
          {pg && (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-titulo text-[34px] leading-none font-bold">{pg.actual}</span>
                <span className="font-titulo text-[16px] text-texto-suave">/ {pg.max} PG</span>
              </div>
              <div className="mt-1.5"><BarraPG actual={pg.actual} max={pg.max} /></div>
              <div className="mt-2 flex gap-1.5">
                <input className="h-9 w-16 rounded-lg border border-borde bg-superficie text-center font-titulo text-[16px]" inputMode="numeric" placeholder="0" aria-label="Cantidad de PG"
                  value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && n) { onPG(-n); setCantidad(''); } }} />
                <button className="boli h-9 flex-1 border-[1.5px] border-peligro/60 font-titulo text-[14px] font-semibold text-peligro hover:bg-peligro/10" disabled={!n} onClick={() => { onPG(-n); setCantidad(''); }}>Daño</button>
                <button className="boli h-9 flex-1 border-[1.5px] border-exito/60 font-titulo text-[14px] font-semibold text-exito hover:bg-exito/10" disabled={!n} onClick={() => { onPG(n); setCantidad(''); }}>Curar</button>
              </div>
            </div>
          )}
          <div className="flex gap-1 font-titulo">
            <div className="flex-1 py-1 text-center">
              <span className="flex items-center justify-center gap-1 text-[12px] text-texto-suave"><ShieldIcon size={12} aria-hidden />CA</span>
              <b className="text-[20px] text-acento">{ca ?? "—"}</b>
            </div>
            {salvaciones.map(([clave, etiqueta, valor]) => (
              <button key={clave} className="flex-1 rounded-lg py-1 transition hover:bg-acento/10 disabled:opacity-40" disabled={valor === null}
                onClick={() => onChequeo(clave)} title={`Tirar ${etiqueta}`}>
                <span className="block text-[12px] text-texto-suave">{etiqueta}</span>
                <b className="text-[20px]">{valor === null ? '—' : signo(valor)}</b>
              </button>
            ))}
          </div>
        </div>

        {/* Qué puede hacer */}
        <div className="relative border-dashed border-borde px-5 pt-3 pb-4 lg:border-x">
          <h3 className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-titulo text-[20px] font-semibold">
            {suTurno ? (
              <>
                <span className="marcatextos whitespace-nowrap">Turno de {actor.nombre}</span>
                <span className="inline-flex gap-1" aria-label={`${c!.usadas} de ${c!.acciones} acciones usadas`}>
                  {Array.from({ length: c!.acciones }, (_, i) => (
                    <span key={`${i}-${i < c!.usadas}`} className={i < c!.usadas ? 'rombo-gastado' : 'rombo-libre'}>
                      <Rombo lleno={i >= c!.usadas} tachado={i < c!.usadas} className="size-5" />
                    </span>
                  ))}
                </span>
                <span className="text-[14px] font-normal text-texto-suave">{libres === 0 ? 'sin acciones' : `le ${libres === 1 ? 'queda 1' : `quedan ${libres}`}`}</span>
              </>
            ) : (
              <span>{actor.nombre} <span className="text-[14px] font-normal text-texto-suave">· {espera ? 'esperando (Delay)' : c ? 'fuera de su turno' : 'fuera de combate'}</span></span>
            )}
          </h3>
          {personaje ? (
            <p className="mt-2 max-w-prose text-[14px] text-texto-suave">Es el personaje de un jugador: lo maneja su dueño. Desde aquí puedes curarlo, hacerle daño, ponerle condiciones o abrir su ficha.</p>
          ) : !cr ? (
            <div className="mt-2 flex flex-col items-start gap-2">
              <p className="text-[14px] text-texto-suave">Este token todavía no tiene ataques ni salvaciones. Ponle sus números (o usa el bestiario).</p>
              <button className="boli h-10 bg-acento px-4 font-titulo text-[15px] font-bold text-sobre-acento" onClick={onEditar}>Ponerle números</button>
            </div>
          ) : (
            <ul className="mt-1 max-h-[180px] overflow-y-auto pr-1" onMouseLeave={() => onAsomar(null)}>
              {cr.ataques.map((a, i) => {
                const sinAcciones = libres !== null && libres < 1;
                const valor = penalizacionesAtaque(a)[numero];
                return (
                  <li key={a.id} className="flex items-center border-b border-dashed border-borde">
                    <button className="grid min-h-[38px] flex-1 grid-cols-[44px_minmax(0,1fr)_auto_auto] items-center gap-2 px-1 text-left transition hover:bg-acento/[0.06] disabled:opacity-50"
                      disabled={sinAcciones} onClick={() => onAtacar(a)} onMouseEnter={() => onAsomar(a)} onFocus={() => onAsomar(a)}>
                      <span className="flex justify-center"><Rombo className="size-3.5" lleno={!sinAcciones} tachado={sinAcciones} /></span>
                      <span className="min-w-0 truncate">
                        <span className="font-titulo text-[16px] font-semibold">{numero ? 'Otra vez con' : 'Atacar con'} {a.nombre}</span>
                        <span className="ml-2 text-[12.5px] text-texto-suave">{a.dano} {a.tipoDano}{a.distancia && a.distancia > 5 ? ` · ${a.distancia} ft` : ''}{a.rasgos.length ? ` · ${a.rasgos.join(', ')}` : ''}</span>
                      </span>
                      <span className="font-titulo text-[19px] font-bold text-peligro">{signo(valor)}</span>
                      <span className="w-6 text-right">{TECLAS[i] && <Tecla>{TECLAS[i]}</Tecla>}</span>
                    </button>
                    <button className="ml-1 h-8 rounded-md px-2 font-titulo text-[12.5px] text-texto-suave hover:bg-superficie-2 hover:text-peligro" title={`Tirar daño de ${a.nombre}`} onClick={() => onDano(a, false)}>Daño</button>
                  </li>
                );
              })}
              <li className="flex min-h-[36px] items-center gap-2 px-1 font-titulo text-[14.5px] text-texto-suave">
                <FootprintsIcon size={17} className="ml-3.5" aria-hidden /> Moverse: arrastra su token ({velocidadDe(estado, actor)} ft por Stride)
              </li>
              {cr.habilidades.length > 0 && <li className="px-1 pt-1 text-[12.5px] text-texto-suave">Skills: {cr.habilidades.map((h) => `${h.nombre} ${signo(h.bono)}`).join(' · ')}</li>}
              {cr.defensas && (
                <li className="px-1 pt-1 text-[12.5px]">
                  {cr.defensas.resistencias.length > 0 && <span className="mr-3"><b className="font-titulo">Resiste</b> {cr.defensas.resistencias.map((x) => `${x.tipo} ${x.valor}`).join(', ')}</span>}
                  {cr.defensas.debilidades.length > 0 && <span className="mr-3 text-peligro"><b className="font-titulo">Débil</b> {cr.defensas.debilidades.map((x) => `${x.tipo} ${x.valor}`).join(', ')}</span>}
                  {cr.defensas.inmunidades.length > 0 && <span><b className="font-titulo">Inmune</b> {cr.defensas.inmunidades.join(', ')}</span>}
                </li>
              )}
              {cr.notas && <li className="px-1 pt-1 text-[12.5px] text-texto-suave">{cr.notas}</li>}
            </ul>
          )}
        </div>

        {/* Su estado y la acción grande */}
        <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
          <div className="flex max-h-[140px] flex-col gap-2 overflow-y-auto pt-1 pr-1">
            {condiciones.length === 0
              ? <p className="font-titulo text-[14px] text-texto-suave">Sin condiciones.</p>
              : condiciones.map((x, i) => (
                <button key={x.clave} className="text-left" onClick={onCondiciones}><PostitCondicion condicion={x} compacto giro={i % 2 ? -1.5 : 2} /></button>
              ))}
          </div>
          <button className="flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 font-titulo text-[13.5px] text-texto-suave hover:text-acento" onClick={onCondiciones}>
            <StickerIcon size={16} aria-hidden /> {condiciones.length ? 'Cambiar condiciones' : 'Pegar una condición'}
          </button>
          {(actor.efectos?.length ?? 0) > 0 && (
            <div className="max-h-[140px] overflow-y-auto pr-1">
              <EfectosActivos efectos={actor.efectos ?? []} onQuitar={onQuitarEfecto} />
            </div>
          )}
          {!personaje && (
            <button className="flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 font-titulo text-[13.5px] text-texto-suave hover:text-acento" onClick={onEditar}>
              <PencilSimpleIcon size={16} aria-hidden /> Editar sus números
            </button>
          )}
          {suTurno && (
            <div className="mt-auto flex gap-2">
              <button className="boli flex size-12 shrink-0 items-center justify-center border-[1.5px] border-borde text-texto-suave hover:text-texto"
                onClick={onEsperar} aria-label="Esperar (Delay)" title="Esperar (Delay): deja su turno para más tarde; vuelve cuando quieras, después de cualquier turno">
                <HourglassMediumIcon size={22} aria-hidden />
              </button>
              <button className="boli flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap bg-acento font-titulo text-[17px] font-bold text-sobre-acento shadow-[0_6px_12px_-6px_var(--acento)] active:scale-[0.97]"
                onClick={onTerminar}>
                Terminar turno <Tecla sobreTinta>F</Tecla>
              </button>
            </div>
          )}
          {espera && (
            <button className="boli mt-auto flex h-12 items-center justify-center gap-2 bg-acento font-titulo text-[16px] font-bold text-sobre-acento" onClick={onVolver}>
              Actuar ahora (después de este turno)
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// Lo que una criatura puede hacerle a un token tocado: sus ataques con su número, o por qué no llega
export function MenuCriatura({ estado, actor, objetivo, numero, onAtacar, onAcercar, onCerrar }: {
  estado: EstadoSala;
  actor: Token;
  objetivo: Token;
  numero: 0 | 1 | 2;
  onAtacar: (a: AtaqueCriatura) => void;
  onAcercar: (c: Casilla) => void;
  onCerrar: () => void;
}) {
  const pies = distanciaEntre(actor, ladoDe(actor), objetivo, ladoDe(objetivo));
  const turno = motivoParaActuarToken(estado, actor, 1);
  const c = estado.combate;
  const libres = c ? c.acciones - c.usadas : null;
  const ataques = actor.criatura?.ataques ?? [];
  const alcanceMax = Math.max(5, ...ataques.map((a) => a.distancia ?? 5));
  const acercarse = (() => {
    if (pies <= 5 || turno || !libres) return null;
    const zona = alcanzables({ x: actor.x, y: actor.y }, velocidadDe(estado, actor), opcionesMovimiento(estado, actor));
    let mejor: { c: Casilla; pies: number } | null = null;
    for (const [k, paso] of zona) {
      const casilla = desdeClave(k);
      if (distanciaEntre(casilla, ladoDe(actor), objetivo, ladoDe(objetivo)) > 5) continue;
      if (!mejor || paso.pies < mejor.pies) mejor = { c: casilla, pies: paso.pies };
    }
    return mejor;
  })();
  return (
    <div className="tarjeta aviso-entra px-3.5 py-3" role="dialog" aria-label={`${actor.nombre} contra ${objetivo.nombre}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-titulo text-[18px] leading-tight font-bold"><span className="text-peligro">{actor.nombre}</span> contra {objetivo.nombre}</p>
          <p className="text-[12.5px] text-texto-suave">A {pies} ft · CA {caDeToken(estado, objetivo)?.total ?? '¿?'}</p>
        </div>
        <button className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={onCerrar} aria-label="Cerrar">
          <XIcon size={16} aria-hidden />
        </button>
      </div>
      {turno && <p className="mt-1.5 rounded-sm bg-superficie-2 px-2 py-1 font-titulo text-[13.5px] text-peligro">{turno}</p>}
      {acercarse && pies > alcanceMax && (
        <button className="boli mt-2 flex h-10 w-full items-center justify-center gap-2 border-[1.5px] border-acento font-titulo text-[14.5px] font-semibold text-acento hover:bg-acento/10"
          onClick={() => onAcercar(acercarse.c)}>
          <FootprintsIcon size={18} aria-hidden /> Acercarse ({acercarse.pies} ft, 1 acción)
        </button>
      )}
      <ul className="mt-2 flex flex-col gap-1">
        {ataques.length === 0 && <li className="text-[13.5px] text-texto-suave">No tiene ataques cargados.</li>}
        {ataques.map((a) => {
          const motivo = turno ?? motivoAlcance(actor, objetivo, a.distancia ?? 5);
          return (
            <li key={a.id}>
              <button className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-acento/10 disabled:hover:bg-transparent"
                disabled={!!motivo} onClick={() => onAtacar(a)}>
                <span className={`w-6 ${motivo ? 'opacity-50' : ''}`}><CostoAccion costo={1} tachado={!!motivo} /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-titulo text-[15px] font-semibold ${motivo ? 'text-texto-suave' : ''}`}>{a.nombre}</span>
                  {motivo && !turno && <span className="block text-[12px] leading-snug text-peligro">{motivo.replace('tienes que estar', 'tiene que estar').replace('Acércate', 'Acércalo').replace('tu alcance', 'su alcance')}</span>}
                </span>
                <span className={`font-titulo text-[18px] font-bold ${motivo ? 'text-texto-suave' : 'text-peligro'}`}>{signo(penalizacionesAtaque(a)[numero])}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


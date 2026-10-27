import { useEffect, useRef, useState } from 'react';
import { CaretDownIcon, CaretUpIcon, CheckIcon, SwordIcon, XIcon } from '@phosphor-icons/react';
import { disponibilidad, type Aptitud } from '../../reglas/aptitudes';
import type { MomentoIniciativa } from '../../reglas/disparadores';
import { interaccionDe, resumenInteraccion } from '../../reglas/interacciones';
import { signo, type Personaje } from '../../reglas/pf2e';
import { aptitudesDePreparacion, preparacionDe, type EstadoSala, type Token } from '../../compartido/sala';
import { iniciativaDe, opcionesIniciativa, type ClaveIniciativa } from '../../compartido/tiradas';
import type { Evento } from '../../compartido/eventos';
import { CostoAccion } from './hud/piezas';
import { claseBotonPrincipal, claseBotonSecundario, claseEntrada } from './ui';

const MOMENTO: Record<MomentoIniciativa, string> = {
  antes: 'antes de tirar',
  'al-tirar': 'al tirar',
};

// Lo que hace, en una línea: lo que sabe el motor o la primera frase del libro (después del Trigger)
export function resumenCorto(a: Aptitud): string {
  const inter = interaccionDe(a);
  if (inter && (inter.efecto || inter.temporales || inter.dano || inter.curacion)) return resumenInteraccion(inter).join(' · ');
  const cuerpo = a.descripcion.split('—').at(-1)!.trim();
  const frase = /^[^.]*\.?/.exec(cuerpo)?.[0] ?? cuerpo;
  return frase.length > 150 ? `${frase.slice(0, 149)}…` : frase;
}

// La hoja que le llega a cada jugador cuando el GM prepara un combate: con qué tira la iniciativa,
// lo que puede usar antes de tirar (Oracular Warning, Scout's Warning…) y "¡Listo!".
export function PreparacionJugador({ estado, p, token, onElegir, onListo, onUsar, className = '' }: {
  estado: EstadoSala;
  p: Personaje;
  token: Token;
  onElegir: (clave: ClaveIniciativa) => void;
  onListo: (listo: boolean) => void;
  onUsar: (a: Aptitud) => void;
  className?: string;
}) {
  const [plegada, setPlegada] = useState(false);
  const prep = preparacionDe(estado, token.id);
  if (!prep) return null;
  const opciones = opcionesIniciativa(token, p);
  const elegida = opciones.find((o) => o.clave === prep.clave) ?? opciones[0]!;
  const { bono } = iniciativaDe(token, p, prep.clave);
  const aptitudes = aptitudesDePreparacion(p);
  const sinUsar = aptitudes.filter((x) => !prep.usadas.includes(x.aptitud.id));
  const chips: { clave: ClaveIniciativa; ayuda: string }[] = [
    { clave: 'percepcion', ayuda: 'lo normal' },
    { clave: 'stealth', ayuda: 'si venías escondido' },
  ];
  const otras = opciones.filter((o) => !chips.some((c) => c.clave === o.clave));

  if (plegada) {
    return (
      <button onClick={() => setPlegada(false)}
        className={`tarjeta-cae pointer-events-auto flex items-center gap-2 rounded-full border-2 border-peligro bg-superficie px-4 py-2 font-titulo text-[15px] shadow-[0_8px_20px_-12px_var(--sombra)] ${className}`}>
        <SwordIcon size={18} weight="bold" className="text-peligro" aria-hidden />
        <span>Se viene un combate · {prep.listo ? 'estás listo' : 'prepárate'}</span>
        {sinUsar.length > 0 && !prep.listo && <span className="rounded-full bg-peligro px-2 text-[12px] text-sobre-acento">{sinUsar.length}</span>}
        <CaretDownIcon size={16} aria-hidden />
      </button>
    );
  }

  return (
    <section aria-label="Preparación del combate"
      className={`tarjeta-cae pointer-events-auto w-[min(560px,calc(100vw-32px))] rounded-xl border-2 border-borde bg-superficie p-4 font-titulo shadow-[0_18px_40px_-18px_var(--sombra)] ${className}`}>
      <header className="flex items-start gap-3">
        <span className="nivel-sello flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-peligro text-peligro">
          <SwordIcon size={22} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-tight">¡Se viene un combate!</h2>
          <p className="text-sm text-texto-suave">Prepárate antes de que la mesa tire la iniciativa.</p>
        </div>
        <button className="flex size-9 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" aria-label="Plegar" onClick={() => setPlegada(true)}>
          <CaretUpIcon size={18} aria-hidden />
        </button>
      </header>

      <h3 className="mt-4 text-[15px] font-semibold">1 · Tiras iniciativa con</h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {chips.map((c) => {
          const o = opciones.find((x) => x.clave === c.clave)!;
          const activa = prep.clave === c.clave;
          return (
            <button key={c.clave} disabled={prep.listo} aria-pressed={activa} onClick={() => onElegir(c.clave)}
              className={`flex flex-col items-start rounded-lg border-2 px-3 py-1.5 text-left transition disabled:opacity-70 ${activa ? 'border-acento bg-acento/10' : 'border-borde hover:bg-superficie-2'}`}>
              <span className="text-[15px] font-semibold">{o.nombre} {signo(o.modificador)}</span>
              <span className="text-[12px] text-texto-suave">{c.ayuda}</span>
            </button>
          );
        })}
        <select className={`${claseEntrada} h-auto! w-auto! py-2 text-sm`} disabled={prep.listo} aria-label="Otra skill para la iniciativa"
          value={otras.some((o) => o.clave === prep.clave) ? prep.clave : ''}
          onChange={(e) => e.target.value && onElegir(e.target.value as ClaveIniciativa)}>
          <option value="">Otra skill (si el GM la acepta)…</option>
          {otras.map((o) => <option key={o.clave} value={o.clave}>{o.nombre} {signo(o.modificador)}</option>)}
        </select>
      </div>
      <p className="mt-1.5 text-sm">
        Vas a tirar <b>d20 {signo(elegida.modificador)}</b> ({elegida.nombre})
        {bono !== 0 && <span className="text-exito"> · incluye {signo(bono)} de lo que te dieron</span>}
        {prep.ultimo && <span className="text-acento"> · no tiras: vas último</span>}
      </p>

      <h3 className="mt-4 text-[15px] font-semibold">2 · Antes de tirar</h3>
      {aptitudes.length === 0 ? (
        <p className="mt-1 text-sm text-texto-suave">No tienes nada para el comienzo del combate. Si alguien del grupo avisa (Oracular Warning, Scout's Warning), su bono te llega solo.</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-2">
          {aptitudes.map(({ aptitud: a, momento }) => {
            const usada = prep.usadas.includes(a.id);
            const disp = disponibilidad(p, a);
            return (
              <li key={a.id} className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2 ${usada ? 'border-exito/60 bg-exito/5' : 'border-dashed border-borde'}`}>
                <CostoAccion costo={a.costo} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{a.verbo || a.nombre}</span>
                    <span className="text-[12px] text-texto-suave">{MOMENTO[momento]}</span>
                  </div>
                  <p className="text-[13px] leading-snug text-texto-suave">{resumenCorto(a)}</p>
                </div>
                {usada ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-exito"><CheckIcon size={16} weight="bold" aria-hidden /> Usada</span>
                ) : (
                  <button className={`${claseBotonSecundario} shrink-0`} disabled={!disp.puede || prep.listo} title={disp.puede ? undefined : disp.texto}
                    onClick={() => onUsar(a)}>
                    Usar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-3">
        {prep.listo ? (
          <>
            <span className="flex flex-1 items-center gap-2 text-[15px] font-semibold text-exito"><CheckIcon size={18} weight="bold" aria-hidden /> Listo: espera a que el GM tire</span>
            <button className={claseBotonSecundario} onClick={() => onListo(false)}>Cambiar algo</button>
          </>
        ) : (
          <button className={`${claseBotonPrincipal} flex-1`} onClick={() => onListo(true)}>
            ¡Listo!{sinUsar.length > 0 && <span className="text-[13px] font-normal opacity-80">(sin usar {sinUsar.length === 1 ? sinUsar[0]!.aptitud.nombre : `${sinUsar.length} aptitudes`})</span>}
          </button>
        )}
      </div>
    </section>
  );
}

// Al empezar el combate, a todos: el orden de juego escrito renglón por renglón. Se va solo.
export function OrdenRevelado({ estado, eventos, miTokenId, className = '' }: {
  estado: EstadoSala;
  eventos: { id: number; evento: Evento }[];
  miTokenId?: string;
  className?: string;
}) {
  const [orden, setOrden] = useState<{ tokenId: string; iniciativa: number }[] | null>(null);
  const visto = useRef(eventos.at(-1)?.id ?? 0);
  useEffect(() => {
    const nuevos = eventos.filter((e) => e.id > visto.current);
    if (!nuevos.length) return;
    visto.current = nuevos.at(-1)!.id;
    const combate = nuevos.findLast((e) => e.evento.tipo === 'combate');
    if (combate?.evento.tipo === 'combate') setOrden(combate.evento.orden);
  }, [eventos]);
  useEffect(() => {
    if (!orden) return;
    const t = setTimeout(() => setOrden(null), 4500 + orden.length * 250);
    return () => clearTimeout(t);
  }, [orden]);
  if (!orden) return null;
  const mio = miTokenId ? orden.findIndex((c) => c.tokenId === miTokenId) : -1;
  return (
    <section aria-label="Orden de juego" aria-live="polite"
      className={`tarjeta-cae pointer-events-auto w-[min(380px,calc(100vw-32px))] rounded-xl border-2 border-borde bg-superficie p-4 font-titulo shadow-[0_18px_40px_-18px_var(--sombra)] ${className}`}>
      <header className="flex items-center gap-2">
        <SwordIcon size={20} weight="bold" className="text-peligro" aria-hidden />
        <h2 className="flex-1 text-lg font-bold">¡Empieza el combate!</h2>
        <button className="flex size-8 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" aria-label="Cerrar" onClick={() => setOrden(null)}>
          <XIcon size={16} aria-hidden />
        </button>
      </header>
      {mio >= 0 && <p className="text-sm text-texto-suave">{mio === 0 ? 'Empiezas tú.' : `Juegas ${mio + 1}.º.`}</p>}
      <ol className="mt-2 flex flex-col">
        {orden.map((c, i) => {
          const t = estado.tokens[c.tokenId];
          if (!t) return null;
          const empate = orden.some((x, j) => j !== i && x.iniciativa === c.iniciativa);
          return (
            <li key={c.tokenId} className={`orden-renglon flex items-center gap-3 border-b-[1.5px] border-dashed border-borde py-1.5 ${c.tokenId === miTokenId ? 'marcatextos' : ''}`}
              style={{ animationDelay: `${150 + i * 220}ms` }}>
              <span className="w-6 text-right text-[15px] text-texto-suave">{i + 1}.</span>
              <span className={`flex-1 truncate text-[16px] ${t.personajeId ? '' : 'text-peligro'}`}>{t.nombre}</span>
              {empate && <span className="text-[11.5px] text-texto-suave">empate</span>}
              <b className="text-[20px] leading-none text-acento">{c.iniciativa}</b>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

import { useState } from 'react';
import { ArrowsClockwiseIcon, SwordIcon, TrashIcon } from '@phosphor-icons/react';
import { tokenEnTurno, type Accion, type Combate, type EstadoSala, type Sesion, type Token } from '../../compartido/sala';
import { resumenCondiciones } from './Condiciones';
import { claseBotonIcono, claseBotonPrincipal, claseBotonSecundario, claseEntrada, Seccion } from './ui';

// Barra con el orden de iniciativa, encima del tablero. La ven todos.
export function OrdenIniciativa({ estado, combate }: { estado: EstadoSala; combate: Combate }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-2">
      <ol className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-borde bg-superficie/95 p-1.5 shadow-sm">
        <li className="shrink-0 px-2 text-xs text-texto-suave">Ronda {combate.ronda}</li>
        {combate.orden.map((c, i) => {
          const token = estado.tokens[c.tokenId];
          if (!token) return null;
          const enTurno = i === combate.turno;
          return (
            <li key={c.tokenId} title={`${token.nombre} · iniciativa ${c.iniciativa}${token.condiciones?.length ? ` · ${resumenCondiciones(token.condiciones)}` : ''}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 ${enTurno ? 'bg-acento text-sobre-acento' : ''}`}>
              <Avatar token={token} />
              <span className={`max-w-24 truncate text-sm ${enTurno ? 'font-medium' : 'hidden sm:inline'}`}>{token.nombre}</span>
              <span className="text-xs tabular-nums opacity-80">{c.iniciativa}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Avatar({ token }: { token: Token }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-xs font-bold"
      style={{ borderColor: token.color, background: token.color, color: '#fff8ec' }}>
      {token.imagen ? <img src={token.imagen} alt="" className="size-full object-cover" /> : token.nombre.slice(0, 1)}
    </span>
  );
}

// El turno en curso: las 3 acciones (◆◆◆), la reacción y "Terminar turno".
// Lo manejan el GM y quien tiene el turno; el resto solo lo ve.
export function PanelTurno({ estado, combate, quien, enviar }: {
  estado: EstadoSala;
  combate: Combate;
  quien: Sesion;
  enviar: (accion: Accion) => void;
}) {
  const token = tokenEnTurno(estado);
  if (!token) return null;
  const esMiTurno = quien.rol === 'jugador' && token.personajeId === quien.personajeId;
  const manda = esMiTurno || quien.rol === 'gm';
  const libres = combate.acciones - combate.usadas;
  // La reacción se usa en el turno de otro: el jugador siempre ve y marca la suya; el GM, la de quien tiene el turno
  const miToken = quien.rol === 'jugador' ? Object.values(estado.tokens).find((t) => t.personajeId === quien.personajeId) : undefined;
  const conReaccion = quien.rol === 'jugador' && miToken && combate.orden.some((c) => c.tokenId === miToken.id) ? miToken : token;
  const reaccionUsada = combate.reacciones.includes(conReaccion.id);
  const puedeReaccion = quien.rol === 'gm' || conReaccion === miToken;

  return (
    <section className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${esMiTurno ? 'border-acento bg-superficie' : 'border-borde bg-superficie'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-titulo text-lg font-bold">{esMiTurno ? '¡Es tu turno!' : `Turno de ${token.nombre}`}</h2>
        <span className="text-sm text-texto-suave">Ronda {combate.ronda}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Acciones del turno">
          {Array.from({ length: combate.acciones }, (_, i) => {
            const gastada = i < combate.usadas;
            return (
              <button key={i}
                disabled={!manda}
                aria-label={gastada ? `Acción ${i + 1} gastada: devolver` : `Gastar acción ${i + 1}`}
                className="flex size-10 items-center justify-center rounded-lg transition hover:bg-superficie-2 disabled:hover:bg-transparent"
                onClick={() => enviar({ tipo: 'gastar-acciones', usadas: gastada ? i : i + 1 })}>
                <span className={`block size-5 rotate-45 rounded-[3px] border-2 border-acento ${gastada ? '' : 'bg-acento'}`} />
              </button>
            );
          })}
          <button
            disabled={!puedeReaccion}
            aria-label={reaccionUsada ? 'Reacción usada: devolver' : 'Usar reacción'}
            title="Reacción: una por ronda, en el turno de otro (por ejemplo, Shield Block)"
            className={`flex size-10 items-center justify-center rounded-lg transition hover:bg-superficie-2 disabled:hover:bg-transparent ${reaccionUsada ? 'text-texto-suave opacity-40' : 'text-acento'}`}
            onClick={() => enviar({ tipo: 'usar-reaccion', tokenId: conReaccion.id, usada: !reaccionUsada })}>
            <ArrowsClockwiseIcon size={24} weight="bold" aria-hidden />
          </button>
        </div>
        <span className="text-sm text-texto-suave">
          {libres === 0 ? 'Sin acciones' : `${libres} ${libres === 1 ? 'acción libre' : 'acciones libres'}`}
          {conReaccion !== token && <><br />Tu reacción: {reaccionUsada ? 'usada' : 'disponible'}</>}
        </span>
      </div>
      {esMiTurno && (
        <p className="text-sm text-texto-suave">
          Toca un ◆ cuando hagas algo: moverte (Stride), atacar (Strike), levantar el escudo… Los ataques los gasta solos.
        </p>
      )}
      {manda && (
        <button className={claseBotonPrincipal} onClick={() => enviar({ tipo: 'avanzar-turno' })}>
          Terminar turno
        </button>
      )}
    </section>
  );
}

// Controles del GM: empezar el combate eligiendo quién entra, ajustar el orden y terminarlo
export function PanelCombateGM({ estado, quien, enviar, onIniciar }: {
  estado: EstadoSala;
  quien: Sesion;
  enviar: (accion: Accion) => void;
  onIniciar: (tokens: string[]) => void;
}) {
  const tokens = Object.values(estado.tokens);
  // Se guardan los que NO pelean, para que un token nuevo entre marcado
  const [fuera, setFuera] = useState<Set<string>>(() => new Set());
  const elegidos = tokens.filter((t) => !fuera.has(t.id));
  const combate = estado.combate;

  if (!combate) {
    return (
      <Seccion titulo="Empezar combate">
        <p className="text-sm text-texto-suave">
          Marca quién pelea. La mesa tira la iniciativa de todos (Perception) y los ordena.
        </p>
        {tokens.length === 0 && <p className="text-sm text-texto-suave">Primero pon tokens en el tablero.</p>}
        <ul className="flex flex-col gap-1">
          {tokens.map((t) => (
            <li key={t.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-superficie-2">
                <input type="checkbox" className="size-4 accent-acento" checked={!fuera.has(t.id)}
                  onChange={(e) => {
                    const nuevo = new Set(fuera);
                    if (e.target.checked) nuevo.delete(t.id); else nuevo.add(t.id);
                    setFuera(nuevo);
                  }} />
                <Avatar token={t} />
                <span className="flex-1">{t.nombre}</span>
                {!t.personajeId && (
                  <span className="text-xs text-texto-suave">{t.percepcion === undefined ? 'Perception +0' : `Perception ${t.percepcion >= 0 ? '+' : ''}${t.percepcion}`}</span>
                )}
              </label>
            </li>
          ))}
        </ul>
        <button className={claseBotonPrincipal} disabled={elegidos.length === 0}
          onClick={() => onIniciar(elegidos.map((t) => t.id))}>
          <SwordIcon size={18} aria-hidden /> Tirar iniciativa y empezar
        </button>
      </Seccion>
    );
  }

  const sinCombate = tokens.filter((t) => !combate.orden.some((c) => c.tokenId === t.id));
  return (
    <div className="flex flex-col gap-4">
      <PanelTurno estado={estado} combate={combate} quien={quien} enviar={enviar} />
      <Seccion titulo="Orden de iniciativa">
        <p className="text-sm text-texto-suave">Cambia un número para reordenar.</p>
        <ol className="flex flex-col gap-1">
          {combate.orden.map((c, i) => {
            const token = estado.tokens[c.tokenId];
            if (!token) return null;
            return (
              <li key={c.tokenId} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${i === combate.turno ? 'bg-superficie-2' : ''}`}>
                <Avatar token={token} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{token.nombre}</div>
                  {token.condiciones?.length ? <div className="truncate text-xs text-texto-suave">{resumenCondiciones(token.condiciones)}</div> : null}
                </div>
                <input
                  key={c.iniciativa}
                  className={`${claseEntrada} h-9 w-16! shrink-0 text-center`}
                  inputMode="numeric"
                  aria-label={`Iniciativa de ${token.nombre}`}
                  defaultValue={c.iniciativa}
                  onBlur={(e) => {
                    const valor = Number(e.target.value);
                    if (Number.isInteger(valor) && valor !== c.iniciativa) enviar({ tipo: 'fijar-iniciativa', tokenId: c.tokenId, valor });
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
                <button className={claseBotonIcono} aria-label={`Sacar a ${token.nombre} del combate`}
                  onClick={() => enviar({ tipo: 'quitar-de-combate', tokenId: c.tokenId })}>
                  <TrashIcon size={16} aria-hidden />
                </button>
              </li>
            );
          })}
        </ol>
        {sinCombate.length > 0 && (
          <select className={claseEntrada} value="" aria-label="Sumar al combate"
            onChange={(e) => e.target.value && enviar({ tipo: 'agregar-a-combate', tokenId: e.target.value, iniciativa: 10 })}>
            <option value="">+ Sumar al combate (iniciativa 10)…</option>
            {sinCombate.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        )}
      </Seccion>
      <button className={`${claseBotonSecundario} text-peligro`}
        onClick={() => confirm('¿Terminar el combate?') && enviar({ tipo: 'terminar-combate' })}>
        Terminar combate
      </button>
    </div>
  );
}

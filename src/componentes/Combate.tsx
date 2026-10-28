import { useState } from 'react';
import { ArrowsClockwiseIcon, CaretDownIcon, CaretUpIcon, CheckIcon, HourglassIcon, SwordIcon, TrashIcon } from '@phosphor-icons/react';
import {
  aptitudesDePreparacion, preparacionDe, tokenEnTurno, type Accion, type Combate, type EstadoSala, type Sesion, type Token,
} from '../../compartido/sala';
import { opcionesIniciativa, type ClaveIniciativa } from '../../compartido/tiradas';
import { signo } from '../../reglas/pf2e';
import { resumenCondiciones } from './Condiciones';
import { useConfirmar } from './hud/Modal';
import { claseBotonIcono, claseBotonPrincipal, claseBotonSecundario, claseEntrada, Seccion } from './ui';

// El retrato chiquito de un token (o su inicial sobre su color)
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
function PanelTurno({ estado, combate, quien, enviar }: {
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

// La preparación vista por el GM: con qué tira cada uno, quién está listo y qué usó antes de tirar.
// El GM elige por sus criaturas (Stealth si estaban emboscadas) y tira cuando quiera, aunque falte alguien.
function PreparacionGM({ estado, enviar, onIniciar }: {
  estado: EstadoSala;
  enviar: (accion: Accion) => void;
  onIniciar: (tokens: string[]) => void;
}) {
  const pr = estado.preparacion!;
  const tokens = pr.tokens.map((id) => estado.tokens[id]).filter((t): t is Token => !!t);
  const jugadores = tokens.filter((t) => t.personajeId);
  const listos = jugadores.filter((t) => pr.listos.includes(t.id)).length;
  const faltan = jugadores.length - listos;
  return (
    <Seccion titulo="Preparando el combate">
      <p className="text-sm text-texto-suave">
        A cada jugador le llegó su hoja: elige con qué tira y usa lo que sirve antes de tirar. Tú eliges por tus criaturas.
      </p>
      <ul className="flex flex-col gap-1.5">
        {tokens.map((t) => {
          const p = t.personajeId ? estado.personajes[t.personajeId] : undefined;
          const prep = preparacionDe(estado, t.id)!;
          const opciones = opcionesIniciativa(t, p);
          const pendientes = p ? aptitudesDePreparacion(p).filter((x) => !prep.usadas.includes(x.aptitud.id)) : [];
          const usadas = p ? aptitudesDePreparacion(p).filter((x) => prep.usadas.includes(x.aptitud.id)) : [];
          return (
            <li key={t.id} className="flex flex-col gap-1 rounded-lg border border-borde px-2 py-1.5">
              <div className="flex items-center gap-2">
                <Avatar token={t} />
                <span className="min-w-0 flex-1 truncate">{t.nombre}</span>
                {p ? (
                  prep.listo
                    ? <span className="flex items-center gap-1 text-xs font-semibold text-exito"><CheckIcon size={14} weight="bold" aria-hidden /> listo</span>
                    : <span className="flex items-center gap-1 text-xs text-texto-suave"><HourglassIcon size={14} aria-hidden /> eligiendo</span>
                ) : null}
                <select className={`${claseEntrada} h-8! w-auto! px-2 text-xs`} aria-label={`Iniciativa de ${t.nombre}`}
                  value={prep.clave} disabled={prep.ultimo}
                  onChange={(e) => enviar({ tipo: 'elegir-iniciativa', tokenId: t.id, clave: e.target.value as ClaveIniciativa })}>
                  {opciones.map((o) => <option key={o.clave} value={o.clave}>{o.nombre} {signo(o.modificador)}</option>)}
                </select>
              </div>
              {(usadas.length > 0 || pendientes.length > 0 || prep.ultimo) && (
                <p className="pl-9 text-xs text-texto-suave">
                  {usadas.length > 0 && <span className="text-exito">Usó {usadas.map((x) => x.aptitud.nombre).join(', ')}. </span>}
                  {prep.ultimo && <span className="text-acento">Va último (no tira). </span>}
                  {pendientes.length > 0 && <span>Tiene sin usar: {pendientes.map((x) => x.aptitud.nombre).join(', ')}.</span>}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <button className={claseBotonPrincipal} onClick={() => onIniciar(pr.tokens)}>
        <SwordIcon size={18} aria-hidden /> Tirar iniciativa{faltan > 0 ? ` (faltan ${faltan} por estar listos)` : ''}
      </button>
      <button className={claseBotonSecundario} onClick={() => enviar({ tipo: 'cancelar-preparacion' })}>
        Cancelar: no hay combate
      </button>
    </Seccion>
  );
}

// Controles del GM: empezar el combate eligiendo quién entra, ajustar el orden y terminarlo
export function PanelCombateGM({ estado, quien, enviar, onIniciar, onSumar }: {
  estado: EstadoSala;
  quien: Sesion;
  enviar: (accion: Accion) => void;
  onIniciar: (tokens: string[]) => void;
  onSumar: (tokenId: string) => void;
}) {
  const confirmar = useConfirmar();
  const tokens = Object.values(estado.tokens);
  // Se guardan los que NO pelean, para que un token nuevo entre marcado
  const [fuera, setFuera] = useState<Set<string>>(() => new Set());
  const elegidos = tokens.filter((t) => !fuera.has(t.id));
  const combate = estado.combate;

  if (!combate && estado.preparacion) {
    return <PreparacionGM estado={estado} enviar={enviar} onIniciar={onIniciar} />;
  }

  if (!combate) {
    return (
      <Seccion titulo="Empezar combate">
        <p className="text-sm text-texto-suave">
          Marca quién pelea y prepara el combate: a cada jugador le llega una hoja para elegir con qué tira la iniciativa
          y usar lo que sirve antes de tirar (Oracular Warning, Scout's Warning…). Después tiras y la mesa los ordena.
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
          onClick={() => enviar({ tipo: 'preparar-combate', tokens: elegidos.map((t) => t.id) })}>
          <SwordIcon size={18} aria-hidden /> Preparar combate
        </button>
        <button className={claseBotonSecundario} disabled={elegidos.length === 0}
          onClick={() => onIniciar(elegidos.map((t) => t.id))}>
          Tirar ya, sin preparar (todos con Perception)
        </button>
      </Seccion>
    );
  }

  const sinCombate = tokens.filter((t) => !combate.orden.some((c) => c.tokenId === t.id));
  return (
    <div className="flex flex-col gap-4">
      <PanelTurno estado={estado} combate={combate} quien={quien} enviar={enviar} />
      <Seccion titulo="Orden de iniciativa">
        <p className="text-sm text-texto-suave">Cambia un número o usa las flechas para reordenar. En un empate van primero los enemigos, salvo que muevas a alguien.</p>
        <ol className="flex flex-col gap-1">
          {combate.orden.map((c, i) => {
            const token = estado.tokens[c.tokenId];
            if (!token) return null;
            const empate = combate.orden.some((x, j) => j !== i && x.iniciativa === c.iniciativa);
            return (
              <li key={c.tokenId} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${i === combate.turno ? 'bg-superficie-2' : ''}`}>
                <div className="flex flex-col">
                  <button className="flex h-4 w-6 items-center justify-center rounded text-texto-suave hover:bg-superficie-2 disabled:opacity-30" disabled={i === 0}
                    aria-label={`Subir a ${token.nombre} en el orden`} onClick={() => enviar({ tipo: 'mover-en-orden', tokenId: c.tokenId, posicion: i - 1 })}>
                    <CaretUpIcon size={13} weight="bold" aria-hidden />
                  </button>
                  <button className="flex h-4 w-6 items-center justify-center rounded text-texto-suave hover:bg-superficie-2 disabled:opacity-30" disabled={i === combate.orden.length - 1}
                    aria-label={`Bajar a ${token.nombre} en el orden`} onClick={() => enviar({ tipo: 'mover-en-orden', tokenId: c.tokenId, posicion: i + 1 })}>
                    <CaretDownIcon size={13} weight="bold" aria-hidden />
                  </button>
                </div>
                <Avatar token={token} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{token.nombre}{empate && <span className="ml-1.5 text-xs text-texto-suave">empate</span>}</div>
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
            onChange={(e) => e.target.value && onSumar(e.target.value)}>
            <option value="">+ Sumar al combate (la mesa tira su iniciativa)…</option>
            {sinCombate.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        )}
      </Seccion>
      <button className={`${claseBotonSecundario} text-peligro`}
        onClick={() => confirmar.pedir({ titulo: '¿Terminar el combate?', texto: 'Se borra el orden de iniciativa y todos vuelven a moverse libres.', si: 'Terminar', hacer: () => enviar({ tipo: 'terminar-combate' }) })}>
        Terminar combate
      </button>
      {confirmar.ventana}
    </div>
  );
}

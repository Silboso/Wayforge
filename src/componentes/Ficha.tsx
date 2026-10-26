import { useState, type ReactNode } from 'react';
import { CrosshairIcon, DiceFiveIcon, HeartIcon, PencilSimpleIcon, ShieldIcon } from '@phosphor-icons/react';
import { ATRIBUTOS, calcular, HABILIDADES, SALVACIONES, signo, type Personaje } from '../../reglas/pf2e';
import type { ClaveCondicion, Condicion } from '../../reglas/condiciones';
import type { QueTirar } from '../../compartido/sala';
import { EditorCondiciones } from './Condiciones';
import { BotonExplicar, claseBotonSecundario, claseEntrada, Desglose, LetraRango, useAbierto } from './ui';

interface Props {
  personaje: Personaje;
  // Las condiciones viven en su token
  condiciones: Condicion[];
  puedeEditar: boolean;
  // El token que se tocó en el tablero, si no es el propio: los ataques van contra su CA
  objetivo: { id: string; nombre: string } | null;
  // En combate, en su turno: qué ataque toca (0, 1 o 2) según cuántos lleva
  siguienteAtaque: number | null;
  onCambiar: (cambios: Partial<Personaje>) => void;
  onPonerCondicion: (clave: ClaveCondicion, valor: number) => void;
  onTirar: (que: QueTirar) => void;
  onAbrirEditor: () => void;
}

// La ficha en juego. Pensada para el teléfono: lo que más se usa arriba y botones grandes para tirar.
export function Ficha({
  personaje: p, condiciones, puedeEditar, objetivo, siguienteAtaque, onCambiar, onPonerCondicion, onTirar, onAbrirEditor,
}: Props) {
  const ficha = calcular(p, condiciones);
  const { abierto, alternar } = useAbierto();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-full border-2 border-acento bg-superficie-2">
          {p.retrato
            ? <img src={p.retrato} alt="" className="size-full object-cover" />
            : <span className="flex size-full items-center justify-center font-titulo text-2xl font-bold">{p.nombre.slice(0, 1)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-titulo text-2xl font-bold">{p.nombre}</h2>
          <p className="truncate text-sm text-texto-suave">
            {[p.ascendencia, p.clase].filter(Boolean).join(' ')} · Nivel {p.nivel}
          </p>
        </div>
        {puedeEditar && (
          <button className={claseBotonSecundario} onClick={onAbrirEditor}>
            <PencilSimpleIcon size={18} aria-hidden /> Editar
          </button>
        )}
      </div>

      <PuntosDeGolpe p={p} pgMax={ficha.pgMax.total} puedeEditar={puedeEditar} onCambiar={onCambiar}
        explicar={abierto === 'pg'} onExplicar={() => alternar('pg')} desglose={<Desglose valor={ficha.pgMax} />} />

      <Bloque titulo="Condiciones" ayuda="Tócala para ver qué hace">
        <EditorCondiciones condiciones={condiciones} puedeEditar={puedeEditar} onPoner={onPonerCondicion} />
      </Bloque>

      <div className="grid grid-cols-3 gap-2">
        <Tarjeta etiqueta="CA" valor={`${ficha.ca.total}`} icono={<ShieldIcon size={16} aria-hidden />}
          onExplicar={() => alternar('ca')} explicando={abierto === 'ca'} />
        <Tarjeta etiqueta="Perception" valor={signo(ficha.percepcion.total)} onTirar={() => onTirar({ tipo: 'percepcion' })}
          onExplicar={() => alternar('percepcion')} explicando={abierto === 'percepcion'} />
        <Tarjeta etiqueta="Velocidad" valor={`${p.velocidad} ft`} />
      </div>
      {abierto === 'ca' && <Desglose valor={ficha.ca} />}
      {abierto === 'percepcion' && <Desglose valor={ficha.percepcion} />}

      <Bloque titulo="Salvaciones">
        <div className="grid grid-cols-3 gap-2">
          {SALVACIONES.map((s) => (
            <Tarjeta key={s.clave} etiqueta={s.nombre} valor={signo(ficha.salvaciones[s.clave].total)}
              onTirar={() => onTirar({ tipo: 'salvacion', clave: s.clave })}
              onExplicar={() => alternar(s.clave)} explicando={abierto === s.clave} />
          ))}
        </div>
        {SALVACIONES.map((s) => abierto === s.clave && <Desglose key={s.clave} valor={ficha.salvaciones[s.clave]} />)}
      </Bloque>

      {p.golpes.length > 0 && (
        <Bloque titulo="Ataques" ayuda="1.º, 2.º y 3.º ataque del turno: cada uno es más difícil">
          <p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${objetivo ? 'bg-superficie-2' : 'text-texto-suave'}`}>
            <CrosshairIcon size={18} aria-hidden className="shrink-0" />
            {objetivo
              ? <span>Atacas a <strong>{objetivo.nombre}</strong>: la mesa te dice si le das.</span>
              : 'Toca un enemigo en el tablero para atacarlo; la mesa te dirá si le das.'}
          </p>
          {p.golpes.map((g, i) => {
            const calculado = ficha.golpes[i]!;
            return (
              <div key={g.id} className="flex flex-col gap-2 rounded-lg border border-borde p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{g.nombre || 'Arma'}</span>
                  <BotonExplicar que={`el ataque con ${g.nombre}`} abierto={abierto === g.id} onClick={() => alternar(g.id)} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {calculado.penalizaciones.map((mod, n) => {
                    // En su turno se marca el ataque que toca; los otros quedan más tenues
                    const toca = siguienteAtaque === null || Math.min(siguienteAtaque, 2) === n;
                    return (
                      <button key={n}
                        className={`flex h-11 items-center justify-center gap-1 rounded-lg font-medium transition active:scale-[0.97] ${toca ? 'bg-acento text-sobre-acento' : 'border border-borde text-texto-suave'}`}
                        aria-label={`Tirar ${n + 1}.º ataque con ${g.nombre}: ${signo(mod)}`}
                        onClick={() => onTirar({ tipo: 'ataque', golpe: g.id, numero: n as 0 | 1 | 2, ...(objetivo ? { objetivo: objetivo.id } : {}) })}>
                        <DiceFiveIcon size={16} aria-hidden /> {signo(mod)}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className={claseBotonSecundario} onClick={() => onTirar({ tipo: 'dano', golpe: g.id })}>
                    Daño {calculado.dano}
                  </button>
                  <button className={claseBotonSecundario} onClick={() => onTirar({ tipo: 'dano', golpe: g.id, critico: true })}>
                    Crítico ×2
                  </button>
                </div>
                {abierto === g.id && <Desglose valor={calculado.ataque} />}
              </div>
            );
          })}
        </Bloque>
      )}

      <Bloque titulo="Skills" ayuda="Toca una para tirarla">
        <ul className="flex flex-col divide-y divide-borde">
          {HABILIDADES.map((h) => {
            const v = ficha.habilidades[h.clave];
            return (
              <li key={h.clave} className="flex flex-col">
                <div className="flex items-center gap-2 py-1">
                  <button className="flex min-h-10 flex-1 items-center gap-2 rounded-lg px-1 text-left transition hover:bg-superficie-2"
                    onClick={() => onTirar({ tipo: 'habilidad', clave: h.clave })}>
                    <LetraRango rango={p.habilidades[h.clave]} />
                    <span className="flex-1">{h.nombre}</span>
                    <span className="text-xs text-texto-suave">{ATRIBUTOS[h.atributo].abrev}</span>
                    <span className="w-10 text-right font-medium tabular-nums">{signo(v.total)}</span>
                  </button>
                  <BotonExplicar que={h.nombre} abierto={abierto === h.clave} onClick={() => alternar(h.clave)} />
                </div>
                {abierto === h.clave && <div className="pb-2"><Desglose valor={v} /></div>}
              </li>
            );
          })}
        </ul>
      </Bloque>

      <Bloque titulo="Atributos">
        <div className="grid grid-cols-6 gap-1 text-center">
          {(Object.keys(ATRIBUTOS) as (keyof typeof ATRIBUTOS)[]).map((a) => (
            <div key={a} className="rounded-lg bg-superficie-2 py-2" title={ATRIBUTOS[a].ayuda}>
              <div className="text-xs text-texto-suave">{ATRIBUTOS[a].abrev}</div>
              <div className="font-medium tabular-nums">{signo(p.atributos[a])}</div>
            </div>
          ))}
        </div>
        {ficha.claseCD && <p className="text-sm text-texto-suave">CD de clase <b className="text-texto">{ficha.claseCD.total}</b></p>}
      </Bloque>

      <LoQueTrae p={p} />
    </div>
  );
}

// Lo que dejó el creador: dotes, idiomas, Lores, escudo, mochila y monedas
function LoQueTrae({ p }: { p: Personaje }) {
  const hay = p.dotes?.length || p.idiomas?.length || p.inventario?.length || p.saberes?.length || p.escudo || p.monedas;
  if (!hay) return null;
  const monedas = p.monedas ? [p.monedas.oro && `${p.monedas.oro} po`, p.monedas.plata && `${p.monedas.plata} pp`, p.monedas.cobre && `${p.monedas.cobre} pc`].filter(Boolean).join(' · ') : '';
  return (
    <Bloque titulo="Lo que trae">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        {p.dotes && p.dotes.length > 0 && (<><dt className="text-texto-suave">Dotes</dt><dd>{p.dotes.map((d) => d.nombre).join(' · ')}</dd></>)}
        {p.saberes && p.saberes.length > 0 && (<><dt className="text-texto-suave">Lore (Trained)</dt><dd>{p.saberes.join(' · ')}</dd></>)}
        {p.idiomas && p.idiomas.length > 0 && (<><dt className="text-texto-suave">Idiomas</dt><dd>{p.idiomas.join(', ')}</dd></>)}
        {p.sentidos && (<><dt className="text-texto-suave">Sentidos</dt><dd>{p.sentidos}</dd></>)}
        {p.escudo && (<><dt className="text-texto-suave">Escudo</dt><dd>{p.escudo.nombre}: +{p.escudo.ca} CA levantado · Dureza {p.escudo.dureza} · {p.escudo.pgActual}/{p.escudo.pg} PG</dd></>)}
        {p.inventario && p.inventario.length > 0 && (
          <><dt className="text-texto-suave">Mochila</dt><dd>{p.inventario.map((x) => (x.cantidad > 1 ? `${x.nombre} ×${x.cantidad}` : x.nombre)).join(' · ')}</dd></>
        )}
        {monedas && (<><dt className="text-texto-suave">Monedas</dt><dd>{monedas}</dd></>)}
      </dl>
    </Bloque>
  );
}

// PG: barra grande y "recibir daño / curar" con un número, como se usa en la mesa
function PuntosDeGolpe({ p, pgMax, puedeEditar, onCambiar, explicar, onExplicar, desglose }: {
  p: Personaje;
  pgMax: number;
  puedeEditar: boolean;
  onCambiar: (cambios: Partial<Personaje>) => void;
  explicar: boolean;
  onExplicar: () => void;
  desglose: ReactNode;
}) {
  const [cantidad, setCantidad] = useState('');
  const n = Math.max(0, Math.floor(Number(cantidad) || 0));
  const porcentaje = pgMax ? Math.min(100, (p.pgActual / pgMax) * 100) : 0;
  const color = porcentaje > 50 ? 'bg-[#3f7d4e]' : porcentaje > 20 ? 'bg-[#c08a2b]' : 'bg-peligro';

  // El daño se come primero los PG temporales
  function recibirDano() {
    if (!n) return;
    const deTemporales = Math.min(p.pgTemporales, n);
    onCambiar({ pgTemporales: p.pgTemporales - deTemporales, pgActual: Math.max(0, p.pgActual - (n - deTemporales)) });
    setCantidad('');
  }

  function curar() {
    if (!n) return;
    onCambiar({ pgActual: Math.min(pgMax, p.pgActual + n) });
    setCantidad('');
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-borde bg-superficie p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-texto-suave">
          <HeartIcon size={18} aria-hidden /> Puntos de golpe
        </div>
        <BotonExplicar que="tus PG máximos" abierto={explicar} onClick={onExplicar} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-titulo text-4xl font-bold tabular-nums">{p.pgActual}</span>
        <span className="text-xl text-texto-suave">/ {pgMax}</span>
        {p.pgTemporales > 0 && <span className="ml-auto rounded-full bg-superficie-2 px-2 py-0.5 text-sm">+{p.pgTemporales} temporales</span>}
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-valuenow={p.pgActual} aria-valuemin={0} aria-valuemax={pgMax}>
        <div className={`h-full transition-all ${color}`} style={{ width: `${porcentaje}%` }} />
      </div>
      {p.pgActual === 0 && <p className="text-sm font-medium text-peligro">Con 0 PG quedas inconsciente (Dying). Avísale al GM.</p>}
      {explicar && desglose}
      {puedeEditar && (
        <div className="flex gap-2">
          <input className={`${claseEntrada} w-20 text-center`} inputMode="numeric" placeholder="0" aria-label="Cantidad de PG"
            value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onKeyDown={(e) => e.key === 'Enter' && recibirDano()} />
          <button className={`${claseBotonSecundario} flex-1 text-peligro`} onClick={recibirDano}>Daño</button>
          <button className={`${claseBotonSecundario} flex-1`} onClick={curar}>Curar</button>
          <button className={claseBotonSecundario} title="Agregar PG temporales" onClick={() => { if (n) { onCambiar({ pgTemporales: n }); setCantidad(''); } }}>
            Temp
          </button>
        </div>
      )}
    </div>
  );
}

function Tarjeta({ etiqueta, valor, icono, onTirar, onExplicar, explicando }: {
  etiqueta: string;
  valor: string;
  icono?: ReactNode;
  onTirar?: () => void;
  onExplicar?: () => void;
  explicando?: boolean;
}) {
  const contenido = (
    <>
      <span className="flex items-center gap-1 text-xs text-texto-suave">{icono}{etiqueta}</span>
      <span className="font-titulo text-2xl font-bold tabular-nums">{valor}</span>
    </>
  );
  return (
    <div className={`relative flex flex-col rounded-xl border bg-superficie ${explicando ? 'border-acento' : 'border-borde'}`}>
      {onTirar ? (
        <button className="flex flex-col items-center gap-0.5 rounded-xl px-1 pt-2 pb-1 transition hover:bg-superficie-2 active:scale-[0.97]"
          onClick={onTirar} aria-label={`Tirar ${etiqueta}: ${valor}`}>
          {contenido}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-0.5 px-1 pt-2 pb-1">{contenido}</div>
      )}
      {onExplicar && (
        <button className="pb-1 text-xs text-texto-suave underline-offset-2 hover:underline" onClick={onExplicar} aria-expanded={explicando}>
          {explicando ? 'Ocultar' : '¿De dónde sale?'}
        </button>
      )}
    </div>
  );
}

function Bloque({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-titulo text-lg font-bold">{titulo}</h3>
        {ayuda && <span className="text-xs text-texto-suave">{ayuda}</span>}
      </div>
      {children}
    </section>
  );
}

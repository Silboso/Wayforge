import { useState } from 'react';
import { CaretDownIcon, CaretRightIcon, TrashIcon } from '@phosphor-icons/react';
import {
  aptitudNueva, GRUPOS, grupoDe, PERIODOS, recursosDe, TRADICIONES,
  type Aptitud, type Costo, type Periodo, type Recuperacion, type TiradaAptitud,
} from '../../reglas/aptitudes';
import { ATRIBUTOS, HABILIDADES, leerExpresion, type Atributo, type ClaveHabilidad, type Personaje } from '../../reglas/pf2e';
import { Campo, claseBotonIcono, claseBotonSecundario, claseEntrada, Contador, SelectorRango } from './ui';
import { CostoAccion } from './hud/piezas';
import { CATALOGO, MOMENTOS, type Momento } from '../../reglas/disparadores';
import { CONDICIONES, type ClaveCondicion } from '../../reglas/condiciones';

// Plantillas para agregar rápido: cada una ya trae cómo se recupera
const PLANTILLAS: { etiqueta: string; ayuda: string; base: Partial<Aptitud> }[] = [
  { etiqueta: 'Truco', ayuda: 'Cantrip: a voluntad', base: { categoria: 'truco', costo: 2, recuperacion: { tipo: 'siempre' } } },
  { etiqueta: 'Conjuro', ayuda: 'Gasta un espacio', base: { categoria: 'conjuro', costo: 2, recuperacion: { tipo: 'espacio', rango: 1 } } },
  { etiqueta: 'Conjuro de foco', ayuda: 'Gasta 1 de foco', base: { categoria: 'foco', costo: 1, recuperacion: { tipo: 'foco' } } },
  { etiqueta: 'Dote o aptitud', ayuda: 'Siempre o con límite', base: { categoria: 'dote', costo: 1, recuperacion: { tipo: 'frecuencia', veces: 1, periodo: 'dia' } } },
  { etiqueta: 'Consumible', ayuda: 'Poción, pergamino…', base: { categoria: 'objeto', costo: 1, recuperacion: { tipo: 'consumible', cantidad: 1 } } },
];

const COSTOS: { valor: Costo; etiqueta: string }[] = [
  { valor: 1, etiqueta: '1 acción' },
  { valor: 2, etiqueta: '2 acciones' },
  { valor: 3, etiqueta: '3 acciones' },
  { valor: 'reaccion', etiqueta: 'Reacción' },
  { valor: 'libre', etiqueta: 'Acción libre' },
  { valor: 'larga', etiqueta: 'Minutos (fuera de combate)' },
];

export function EditorAptitudes({ p, onCambio }: { p: Personaje; onCambio: (cambios: Partial<Personaje>) => void }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const aptitudes = p.aptitudes ?? [];
  const r = recursosDe(p);
  const editarApt = (id: string, cambios: Partial<Aptitud>) =>
    onCambio({ aptitudes: aptitudes.map((a) => (a.id === id ? { ...a, ...cambios } : a)) });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-texto-suave">
        Las acciones básicas (Stride, Step, Demoralize…) ya vienen cargadas. Aquí agregas lo propio de tu
        personaje. Lo importante es <b>cómo se recupera</b>: así la hoja sabe cuándo te queda y cuándo no.
      </p>

      <section className="flex flex-col gap-3">
        <h3 className="font-titulo text-lg font-bold">Conjuros</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={!!p.lanzador}
            onChange={(e) => onCambio({ lanzador: e.target.checked ? { tradicion: 'arcane', atributo: 'int', rango: 1 } : null })} />
          Mi personaje lanza conjuros
        </label>
        {p.lanzador && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Tradición">
              {(id) => (
                <select id={id} className={claseEntrada} value={p.lanzador!.tradicion}
                  onChange={(e) => onCambio({ lanzador: { ...p.lanzador!, tradicion: e.target.value as keyof typeof TRADICIONES } })}>
                  {Object.entries(TRADICIONES).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                </select>
              )}
            </Campo>
            <Campo etiqueta="Atributo para conjuros" ayuda="Wizard Int, Cleric Wis, Sorcerer Cha…">
              {(id) => (
                <select id={id} className={claseEntrada} value={p.lanzador!.atributo}
                  onChange={(e) => onCambio({ lanzador: { ...p.lanzador!, atributo: e.target.value as Atributo } })}>
                  {(Object.keys(ATRIBUTOS) as Atributo[]).map((a) => <option key={a} value={a}>{ATRIBUTOS[a].nombre}</option>)}
                </select>
              )}
            </Campo>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-texto-suave">Competencia con conjuros</span>
              <SelectorRango etiqueta="Competencia con conjuros" valor={p.lanzador.rango}
                onCambio={(rango) => onCambio({ lanzador: { ...p.lanzador!, rango } })} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm text-texto-suave">Espacios de conjuro por rango (cuántos tienes por día)</span>
          <ul className="flex flex-wrap gap-2">
            {r.espacios.map((e) => (
              <li key={e.rango} className="flex items-center gap-1 rounded-lg border border-borde bg-superficie px-2">
                <span className="font-titulo text-sm">Rango {e.rango}</span>
                <Contador etiqueta={`espacios de rango ${e.rango}`} valor={e.max} min={0} max={9}
                  onCambio={(max) => onCambio({ recursos: { ...r, espacios: r.espacios.map((x) => (x.rango === e.rango ? { ...x, max, usados: Math.min(x.usados, max) } : x)) } })} />
              </li>
            ))}
            {r.espacios.length < 10 && (
              <li>
                <button type="button" className={claseBotonSecundario}
                  onClick={() => onCambio({ recursos: { ...r, espacios: [...r.espacios, { rango: r.espacios.length + 1, max: 1, usados: 0 }] } })}>
                  + Rango {r.espacios.length + 1}
                </button>
              </li>
            )}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Puntos de foco</div>
            <div className="text-xs text-texto-suave">Para conjuros de foco y algunas aptitudes de clase (máximo 3)</div>
          </div>
          <Contador etiqueta="puntos de foco" valor={r.foco.max} min={0} max={3}
            onCambio={(max) => onCambio({ recursos: { ...r, foco: { max, actual: Math.min(max, Math.max(r.foco.actual, max)) } } })} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-titulo text-lg font-bold">Tus aptitudes</h3>
        {aptitudes.length === 0 && <p className="text-sm text-texto-suave">Aún no agregaste ninguna.</p>}
        <ul className="flex flex-col gap-2">
          {aptitudes.map((a) => (
            <li key={a.id} className="rounded-lg border border-borde bg-superficie">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setAbierta(abierta === a.id ? null : a.id)} aria-expanded={abierta === a.id}>
                  {abierta === a.id ? <CaretDownIcon size={16} aria-hidden /> : <CaretRightIcon size={16} aria-hidden />}
                  <CostoAccion costo={a.costo} />
                  <span className="truncate font-titulo font-semibold">{a.verbo || a.nombre || 'Sin nombre'}</span>
                  <span className="truncate text-xs text-texto-suave">{GRUPOS[grupoDe(a)].titulo}</span>
                </button>
                <button type="button" className={claseBotonIcono} aria-label={`Quitar ${a.nombre || 'aptitud'}`}
                  onClick={() => onCambio({ aptitudes: aptitudes.filter((x) => x.id !== a.id) })}>
                  <TrashIcon size={17} aria-hidden />
                </button>
              </div>
              {abierta === a.id && <FormularioAptitud a={a} onCambio={(c) => editarApt(a.id, c)} />}
            </li>
          ))}
        </ul>
        <select className={claseEntrada} value="" aria-label="Agregar del catálogo"
          onChange={(e) => {
            const base = CATALOGO.find((c) => c.id === e.target.value);
            if (!base) return;
            const nueva: Aptitud = { ...base, id: crypto.randomUUID() };
            onCambio({ aptitudes: [...aptitudes, nueva] });
            setAbierta(nueva.id);
          }}>
          <option value="">+ Del catálogo: reacciones y dotes comunes…</option>
          {CATALOGO.filter((c) => !aptitudes.some((a) => a.nombre === c.nombre)).map((c) => (
            <option key={c.id} value={c.id}>{c.nombre} · {c.verbo}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          {PLANTILLAS.map((pl) => (
            <button key={pl.etiqueta} type="button" className={`${claseBotonSecundario} flex-col items-start gap-0 py-1.5 text-left`}
              onClick={() => {
                const nueva: Aptitud = { ...aptitudNueva(crypto.randomUUID()), ...pl.base } as Aptitud;
                onCambio({ aptitudes: [...aptitudes, nueva] });
                setAbierta(nueva.id);
              }}>
              <span className="font-semibold">+ {pl.etiqueta}</span>
              <span className="text-[11px] text-texto-suave">{pl.ayuda}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function FormularioAptitud({ a, onCambio }: { a: Aptitud; onCambio: (c: Partial<Aptitud>) => void }) {
  const rec = a.recuperacion;
  const tirada = a.tirada;
  const [rasgos, setRasgos] = useState(a.rasgos.join(', '));
  const expresionMala = tirada?.tipo === 'expresion' && !leerExpresion(tirada.expresion);

  return (
    <div className="flex flex-col gap-3 border-t border-dashed border-borde px-3 pt-3 pb-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre (como en el libro)">
          {(id) => <input id={id} className={claseEntrada} value={a.nombre} maxLength={60} placeholder="Force Barrage" onChange={(e) => onCambio({ nombre: e.target.value })} />}
        </Campo>
        <Campo etiqueta="Cómo lo dirías tú" ayuda="Se lee primero en tu hoja">
          {(id) => <input id={id} className={claseEntrada} value={a.verbo} maxLength={60} placeholder="Disparar proyectiles" onChange={(e) => onCambio({ verbo: e.target.value })} />}
        </Campo>
        <Campo etiqueta="Cuánto cuesta">
          {(id) => (
            <select id={id} className={claseEntrada} value={String(a.costo)}
              onChange={(e) => { const v = e.target.value; onCambio({ costo: (/^\d$/.test(v) ? Number(v) : v) as Costo }); }}>
              {COSTOS.map((c) => <option key={String(c.valor)} value={String(c.valor)}>{c.etiqueta}</option>)}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Cómo se recupera">
          {(id) => (
            <select id={id} className={claseEntrada} value={rec.tipo}
              onChange={(e) => {
                const tipo = e.target.value as Recuperacion['tipo'];
                const nueva: Recuperacion = tipo === 'espacio' ? { tipo, rango: 1 }
                  : tipo === 'frecuencia' ? { tipo, veces: 1, periodo: 'dia' }
                    : tipo === 'consumible' ? { tipo, cantidad: 1 } : { tipo };
                onCambio({ recuperacion: nueva });
              }}>
              <option value="siempre">Siempre (a voluntad)</option>
              <option value="foco">Gasta 1 punto de foco</option>
              <option value="espacio">Gasta un espacio de conjuro</option>
              <option value="frecuencia">Tiene un límite de usos</option>
              <option value="consumible">Se gasta (consumible)</option>
            </select>
          )}
        </Campo>
      </div>

      {rec.tipo === 'espacio' && (
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Rango del conjuro</span>
          <Contador etiqueta="rango" valor={rec.rango} min={1} max={10} onCambio={(rango) => onCambio({ recuperacion: { tipo: 'espacio', rango } })} />
        </div>
      )}
      {rec.tipo === 'frecuencia' && (
        <div className="flex flex-wrap items-center gap-3">
          <Contador etiqueta="veces" valor={rec.veces} min={1} max={10} onCambio={(veces) => onCambio({ recuperacion: { ...rec, veces } })} />
          <span>{rec.veces === 1 ? 'vez' : 'veces'}</span>
          <select className={`${claseEntrada} w-auto`} value={rec.periodo} aria-label="Período"
            onChange={(e) => onCambio({ recuperacion: { ...rec, periodo: e.target.value as Periodo } })}>
            {Object.entries(PERIODOS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </div>
      )}
      {rec.tipo === 'consumible' && (
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Cuántos tienes</span>
          <Contador etiqueta="cantidad" valor={rec.cantidad} min={0} max={99} onCambio={(cantidad) => onCambio({ recuperacion: { tipo: 'consumible', cantidad } })} />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Qué se tira al usarlo">
          {(id) => (
            <select id={id} className={claseEntrada} value={tirada?.tipo ?? 'nada'}
              onChange={(e) => {
                const tipo = e.target.value;
                const nueva: TiradaAptitud | undefined = tipo === 'skill' ? { tipo, clave: 'athletics' }
                  : tipo === 'expresion' ? { tipo, expresion: '2d4+4' }
                    : tipo === 'percepcion' || tipo === 'ataque-conjuro' || tipo === 'golpe' ? { tipo } : undefined;
                const { tirada: _quitar, ...resto } = a;
                onCambio(nueva ? { tirada: nueva } : { ...resto, tirada: undefined });
              }}>
              <option value="nada">Nada</option>
              <option value="golpe">Un Strike con tu arma</option>
              <option value="ataque-conjuro">Ataque de conjuro (contra la CA)</option>
              <option value="skill">Una skill</option>
              <option value="percepcion">Perception</option>
              <option value="expresion">Dados (daño, curación…)</option>
            </select>
          )}
        </Campo>
        {tirada?.tipo === 'ataque-conjuro' && (
          <Campo etiqueta="Daño si acierta" ayuda={a.dano && !leerExpresion(a.dano) ? 'Escribe dados como 2d4' : 'La mesa te ofrece tirarlo al acertar'}>
            {(id) => <input id={id} className={`${claseEntrada} font-mono`} value={a.dano ?? ''} maxLength={40} placeholder="2d4"
              onChange={(e) => onCambio({ dano: e.target.value || undefined })} />}
          </Campo>
        )}
        {tirada?.tipo === 'skill' && (
          <Campo etiqueta="Skill">
            {(id) => (
              <select id={id} className={claseEntrada} value={tirada.clave} onChange={(e) => onCambio({ tirada: { tipo: 'skill', clave: e.target.value as ClaveHabilidad } })}>
                {HABILIDADES.map((h) => <option key={h.clave} value={h.clave}>{h.nombre}</option>)}
              </select>
            )}
          </Campo>
        )}
        {tirada?.tipo === 'expresion' && (
          <Campo etiqueta="Dados" ayuda={expresionMala ? 'Escribe dados como 2d4+4' : undefined}>
            {(id) => <input id={id} className={`${claseEntrada} font-mono ${expresionMala ? 'border-peligro' : ''}`} value={tirada.expresion} maxLength={40}
              onChange={(e) => onCambio({ tirada: { tipo: 'expresion', expresion: e.target.value } })} />}
          </Campo>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-texto-suave">Cuándo te avisa la mesa</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {(Object.keys(MOMENTOS) as Momento[]).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm" title={MOMENTOS[m].ayuda}>
              <input type="checkbox" className="size-4" checked={a.disparadores?.includes(m) ?? false}
                onChange={(e) => {
                  const actuales = a.disparadores ?? [];
                  onCambio({ disparadores: e.target.checked ? [...actuales, m] : actuales.filter((x) => x !== m) });
                }} />
              {MOMENTOS[m].titulo}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Solo se puede usar si tienes" ayuda="Shield Block necesita el escudo levantado">
          {(id) => (
            <select id={id} className={claseEntrada} value={a.requiere ?? ''}
              onChange={(e) => onCambio({ requiere: (e.target.value || undefined) as ClaveCondicion | undefined })}>
              <option value="">Nada en especial</option>
              {(Object.keys(CONDICIONES) as ClaveCondicion[]).map((c) => <option key={c} value={c}>{CONDICIONES[c].nombre}</option>)}
            </select>
          )}
        </Campo>
        {a.disparadores?.includes('te-apuntan') && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm">Bono a tu CA contra ese ataque</span>
            <Contador etiqueta="bono a la CA" valor={a.efecto?.bonoCA ?? 0} min={0} max={4}
              onCambio={(bonoCA) => onCambio({ efecto: { ...a.efecto, bonoCA: bonoCA || undefined } })} />
          </div>
        )}
      </div>

      <Campo etiqueta="Qué hace, en tus palabras">
        {(id) => <textarea id={id} className={`${claseEntrada} h-24 py-2`} value={a.descripcion} maxLength={2000}
          placeholder="Tres proyectiles de fuerza que no fallan: 1d4+1 cada uno."
          onChange={(e) => onCambio({ descripcion: e.target.value })} />}
      </Campo>
      <Campo etiqueta="Rasgos (separados por coma)" ayuda="Los del libro: concentrate, manipulate, force…">
        {(id) => <input id={id} className={claseEntrada} value={rasgos} maxLength={300}
          onChange={(e) => setRasgos(e.target.value)}
          onBlur={() => onCambio({ rasgos: rasgos.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12).map((x) => x.slice(0, 30)) })} />}
      </Campo>
    </div>
  );
}

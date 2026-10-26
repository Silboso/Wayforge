import { useState, type ReactNode } from 'react';
import { MagnifyingGlassIcon, MinusIcon, PlusIcon, SparkleIcon } from '@phosphor-icons/react';
import { ATRIBUTOS, HABILIDADES, signo, type Atributo, type ClaveHabilidad } from '../../../reglas/pf2e';
import { ASCENDENCIAS, IDIOMAS } from '../../../reglas/datos/ascendencias';
import { TRASFONDOS } from '../../../reglas/datos/trasfondos';
import { CLASES } from '../../../reglas/datos/clases';
import { DOTES_GENERALES, doteDe } from '../../../reglas/datos/dotes';
import { NOMBRES_TRADICION } from '../../../reglas/datos/conjuros';
import { ARMADURAS, ARMAS, DINERO_INICIAL, EQUIPO, ESCUDOS, precioTexto } from '../../../reglas/datos/equipo';
import type { Arma, Conjuro, Dote } from '../../../reglas/datos/tipos';
import {
  atributosDe, conjurosAElegir, conjurosDisponibles, dotesDeAscendencia, dotesDeClase, fuentesDeMejoras, gastoDe, habilidadesAElegir,
  habilidadesDadas, idiomasAElegir, libresDeAscendencia, necesitaDoteGeneral, rangoConArma, tradicionDe, type Eleccion,
} from '../../../reglas/creador';
import { CostoAccion } from '../hud/piezas';
import { claseEntrada } from '../ui';
import { Chip, Cuenta, Opcion, TituloPaso } from './piezas';

export interface PropsPaso {
  e: Eleccion;
  // Los cambios, o una función del estado actual (para clics seguidos que dependen del anterior)
  cambiar: (cambios: Partial<Eleccion> | ((actual: Eleccion) => Partial<Eleccion>)) => void;
}

const LETRAS: Atributo[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const abrev = (a: Atributo) => ATRIBUTOS[a].abrev;
const rejilla = 'grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3';

export function PasoAscendencia({ e, cambiar }: PropsPaso) {
  const elegida = ASCENDENCIAS.find((a) => a.id === e.ascendencia);
  return (
    <>
      <TituloPaso titulo="Ascendencia" ayuda="Tu pueblo de origen: decide tus PG base, tu tamaño, tu Velocidad y cómo ves en la oscuridad." />
      <div className={rejilla}>
        {ASCENDENCIAS.map((a) => (
          <Opcion key={a.id} elegida={e.ascendencia === a.id} titulo={a.nombre} subtitulo={a.descripcion}
            onElegir={() => cambiar({ ascendencia: a.id, herencia: null, mejorasAscendencia: [], doteAscendencia: null, idiomas: [] })}
            chips={<>
              <Chip>PG {a.pg}</Chip><Chip>{a.tamano === 'small' ? 'Small' : 'Medium'}</Chip><Chip>Vel {a.velocidad} ft</Chip>
              {a.sentidos !== 'Visión normal' && <Chip>{a.sentidos}</Chip>}
              {a.mejoras.map((m, i) => <Chip key={i} tono="bueno">+{m === 'libre' ? 'libre' : abrev(m)}</Chip>)}
              {a.defecto && <Chip tono="malo">−{abrev(a.defecto)}</Chip>}
            </>} />
        ))}
      </div>
      {elegida && (
        <section className="mt-6">
          <h3 className="mb-1 font-titulo text-[20px] font-bold">Herencia de {elegida.nombre}</h3>
          <p className="mb-3 text-[14px] text-texto-suave">Una variante de tu pueblo: de dónde viene tu familia o qué rasgo heredaste.</p>
          {elegida.especial && <p className="mb-3 rounded-sm border-l-4 border-acento/60 bg-acento/5 px-3 py-2 text-[14px]">{elegida.especial}</p>}
          <div className={rejilla}>
            {elegida.herencias.map((h) => (
              <Opcion key={h.id} elegida={e.herencia === h.id} titulo={h.nombre} subtitulo={h.descripcion}
                onElegir={() => cambiar({ herencia: h.id, ...(h.id !== 'versatile' && e.doteGeneral ? { doteGeneral: null } : {}) })} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function PasoTrasfondo({ e, cambiar }: PropsPaso) {
  const [busca, setBusca] = useState('');
  const lista = TRASFONDOS.filter((t) => `${t.nombre} ${t.descripcion} ${t.habilidad}`.toLowerCase().includes(busca.toLowerCase()));
  return (
    <>
      <TituloPaso titulo="Trasfondo" ayuda="Qué hacías antes de aventurar. Te da dos mejoras, una skill, un Lore y una dote de skill."
        derecha={<Buscador valor={busca} onCambio={setBusca} />} />
      <div className={rejilla}>
        {lista.map((t) => {
          const dote = doteDe(t.dote);
          return (
            <Opcion key={t.id} elegida={e.trasfondo === t.id} titulo={t.nombre} subtitulo={t.descripcion}
              onElegir={() => cambiar({ trasfondo: t.id, mejorasTrasfondo: [null, null] })}
              chips={<>
                <Chip tono="bueno">+{abrev(t.mejoras[0])} o {abrev(t.mejoras[1])}</Chip><Chip tono="bueno">+libre</Chip>
                <Chip tono="acento">{HABILIDADES.find((h) => h.clave === t.habilidad)!.nombre}</Chip>
                <Chip>{t.saber}</Chip>
                {dote && <Chip>{dote.nombre}</Chip>}
              </>} />
          );
        })}
      </div>
    </>
  );
}

export function PasoClase({ e, cambiar }: PropsPaso) {
  const elegida = CLASES.find((c) => c.id === e.clase);
  return (
    <>
      <TituloPaso titulo="Clase" ayuda="Lo que haces en la aventura. Es la decisión más grande: define tus PG, tus defensas y lo que haces en tu turno." />
      <div className={rejilla}>
        {CLASES.map((c) => (
          <Opcion key={c.id} elegida={e.clase === c.id} titulo={c.nombre} subtitulo={c.rol}
            onElegir={() => cambiar({ clase: c.id, subclase: null, atributoClave: c.atributoClave.length === 1 ? c.atributoClave[0]! : null, habilidades: [], doteClase: null, trucos: [], conjuros: [] })}
            chips={<>
              <Chip>PG {c.pg}/nivel</Chip>
              <Chip tono="bueno">clave {c.atributoClave.map(abrev).join(' o ')}</Chip>
              {c.lanzador && c.lanzador.espacios > 0 && <Chip tono="acento">conjuros {c.lanzador.tradicion === 'segun-eleccion' ? 'según tu elección' : NOMBRES_TRADICION[c.lanzador.tradicion]}</Chip>}
              {c.defensa.pesada > 0 ? <Chip>armadura pesada</Chip> : c.defensa.media > 0 ? <Chip>armadura media</Chip> : c.defensa.ligera > 0 ? <Chip>armadura ligera</Chip> : <Chip>sin armadura</Chip>}
            </>} />
        ))}
      </div>
      {elegida && (
        <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            <h3 className="mb-2 font-titulo text-[20px] font-bold">Lo que trae un {elegida.nombre}</h3>
            <p className="mb-3 text-[14px]">{elegida.descripcion}</p>
            <ul className="flex flex-col gap-2">
              {elegida.rasgos.map((r) => (
                <li key={r.nombre} className="border-b border-dashed border-borde pb-2">
                  <b className="font-titulo text-[15.5px]">{r.nombre}</b>
                  <p className="text-[13.5px] text-texto-suave">{r.descripcion}</p>
                </li>
              ))}
            </ul>
          </div>
          {elegida.subclase && (
            <div>
              <h3 className="mb-2 font-titulo text-[20px] font-bold">{elegida.subclase.titulo}</h3>
              <div className="grid gap-2">
                {elegida.subclase.opciones.map((o) => (
                  <Opcion key={o.id} elegida={e.subclase === o.id} titulo={o.nombre} subtitulo={o.descripcion}
                    onElegir={() => cambiar({ subclase: o.id, ...(o.tradicion !== undefined ? { trucos: [], conjuros: [] } : {}) })}
                    chips={<>
                      {o.tradicion && <Chip tono="acento">{NOMBRES_TRADICION[o.tradicion]}</Chip>}
                      {o.habilidad && <Chip>{HABILIDADES.find((h) => h.clave === o.habilidad)!.nombre}</Chip>}
                    </>} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export function PasoAtributos({ e, cambiar }: PropsPaso) {
  const asc = ASCENDENCIAS.find((a) => a.id === e.ascendencia);
  const tras = TRASFONDOS.find((t) => t.id === e.trasfondo);
  const cla = CLASES.find((c) => c.id === e.clase);
  const attr = atributosDe(e);
  const fuentes = fuentesDeMejoras(e);
  const libresAsc = libresDeAscendencia(e);
  const fijasAsc = e.dosLibres ? [] : (asc?.mejoras.filter((m) => m !== 'libre') as Atributo[] ?? []);

  const ponerEn = (lista: (Atributo | null)[], i: number, a: Atributo) => {
    const nueva = [...lista];
    nueva[i] = nueva[i] === a ? null : a;
    return nueva;
  };
  const alternarLibre = (a: Atributo) => cambiar((x) => {
    const actuales = x.mejorasLibres.filter(Boolean) as Atributo[];
    const siguientes = actuales.includes(a) ? actuales.filter((y) => y !== a) : actuales.length < 4 ? [...actuales, a] : actuales;
    return { mejorasLibres: [...siguientes, null, null, null, null].slice(0, 4) };
  });

  return (
    <>
      <TituloPaso titulo="Atributos" ayuda="Cada mejora suma +1 al modificador. Empiezan en +0; a nivel 1 lo máximo es +4. Tu atributo clave es el que más importa para tu clase." />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {LETRAS.map((a) => (
          <div key={a} className={`hoja flex flex-col items-center px-2 py-2.5 ${e.atributoClave === a ? 'ring-2 ring-acento/60' : ''}`}>
            <span className="font-titulo text-[13px] text-texto-suave">{ATRIBUTOS[a].nombre}</span>
            <b className={`font-titulo text-[30px] leading-none ${attr[a] > 0 ? 'text-acento' : attr[a] < 0 ? 'text-peligro' : ''}`}>{signo(attr[a])}</b>
            <span className="mt-1 text-center text-[11px] leading-tight text-texto-suave" title={fuentes.filter((f) => f.atributo === a).map((f) => `${f.valor > 0 ? '+' : '−'} ${f.fuente}`).join(', ')}>
              {fuentes.filter((f) => f.atributo === a).length ? fuentes.filter((f) => f.atributo === a).map((f) => (f.valor > 0 ? '+' : '−')).join('') : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {asc && (
          <FilaMejoras titulo={`${asc.nombre}`} ayuda={e.dosLibres ? 'Dos mejoras libres, sin defecto.' : `Fijas: ${fijasAsc.map(abrev).join(', ') || 'ninguna'}${asc.defecto ? ` · defecto: −${abrev(asc.defecto)}` : ''}. Elige ${libresAsc} libre${libresAsc === 1 ? '' : 's'}.`}
            extra={(
              <label className="flex items-center gap-2 text-[13px] text-texto-suave">
                <input type="checkbox" className="size-4 accent-acento" checked={e.dosLibres} onChange={(ev) => cambiar({ dosLibres: ev.target.checked, mejorasAscendencia: [] })} />
                Usar dos mejoras libres (sin defecto)
              </label>
            )}>
            {Array.from({ length: libresAsc }, (_, i) => (
              <Selector key={i} etiqueta={`Libre ${i + 1}`} valor={e.mejorasAscendencia[i] ?? null}
                bloqueados={[...fijasAsc, ...(e.mejorasAscendencia.filter((m, j) => m && j !== i) as Atributo[])]}
                onElegir={(a) => cambiar({ mejorasAscendencia: ponerEn(e.mejorasAscendencia, i, a) })} />
            ))}
          </FilaMejoras>
        )}
        {tras && (
          <FilaMejoras titulo={tras.nombre} ayuda={`Una entre ${abrev(tras.mejoras[0])} y ${abrev(tras.mejoras[1])}, y otra libre (distinta).`}>
            <Selector etiqueta="Del trasfondo" valor={e.mejorasTrasfondo[0]} opciones={tras.mejoras}
              bloqueados={e.mejorasTrasfondo[1] ? [e.mejorasTrasfondo[1]] : []}
              onElegir={(a) => cambiar({ mejorasTrasfondo: [e.mejorasTrasfondo[0] === a ? null : a, e.mejorasTrasfondo[1]] })} />
            <Selector etiqueta="Libre" valor={e.mejorasTrasfondo[1]} bloqueados={e.mejorasTrasfondo[0] ? [e.mejorasTrasfondo[0]] : []}
              onElegir={(a) => cambiar({ mejorasTrasfondo: [e.mejorasTrasfondo[0], e.mejorasTrasfondo[1] === a ? null : a] })} />
          </FilaMejoras>
        )}
        {cla && (
          <FilaMejoras titulo={`${cla.nombre}: atributo clave`} ayuda="Suma +1 y es el que usa tu clase para sus CD y, si lanzas conjuros, para tu magia.">
            <Selector etiqueta="Clave" valor={e.atributoClave} opciones={cla.atributoClave} bloqueados={[]}
              onElegir={(a) => cambiar({ atributoClave: a })} />
          </FilaMejoras>
        )}
        <FilaMejoras titulo="Nivel 1: cuatro mejoras libres" ayuda="Cuatro atributos distintos. Consejo: tu clave, Con (PG) y Dex o Wis (defensa).">
          <div className="flex flex-wrap gap-1.5">
            {LETRAS.map((a) => {
              const puesta = e.mejorasLibres.includes(a);
              return (
                <button key={a} type="button" aria-pressed={puesta} onClick={() => alternarLibre(a)}
                  className={`h-10 min-w-14 rounded-md border-[1.5px] px-2 font-titulo text-[15px] font-semibold transition ${puesta ? 'border-acento bg-acento text-sobre-acento' : 'border-borde hover:border-acento/60'}`}>
                  {abrev(a)}
                </button>
              );
            })}
            <Cuenta llevas={e.mejorasLibres.filter(Boolean).length} de={4} que="mejoras" />
          </div>
        </FilaMejoras>
      </div>
    </>
  );
}

function FilaMejoras({ titulo, ayuda, extra, children }: { titulo: string; ayuda: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-dashed border-borde px-3.5 py-3">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-titulo text-[17px] font-bold">{titulo}</h3>
          <p className="text-[13px] text-texto-suave">{ayuda}</p>
        </div>
        {extra}
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

function Selector({ etiqueta, valor, opciones = LETRAS, bloqueados, onElegir }: {
  etiqueta: string;
  valor: Atributo | null;
  opciones?: Atributo[];
  bloqueados: Atributo[];
  onElegir: (a: Atributo) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={etiqueta}>
      <span className="mr-1 font-titulo text-[13px] text-texto-suave">{etiqueta}:</span>
      {opciones.map((a) => (
        <button key={a} type="button" aria-pressed={valor === a} disabled={bloqueados.includes(a) && valor !== a} onClick={() => onElegir(a)}
          className={`h-9 min-w-12 rounded-md border-[1.5px] px-2 font-titulo text-[14px] font-semibold transition disabled:opacity-35 ${valor === a ? 'border-acento bg-acento text-sobre-acento' : 'border-borde hover:border-acento/60'}`}>
          {abrev(a)}
        </button>
      ))}
    </div>
  );
}

export function PasoHabilidades({ e, cambiar }: PropsPaso) {
  const cla = CLASES.find((c) => c.id === e.clase);
  const dadas = habilidadesDadas(e);
  const total = habilidadesAElegir(e);
  const attr = atributosDe(e);
  const alternar = (h: ClaveHabilidad) => cambiar((x) => ({
    habilidades: x.habilidades.includes(h) ? x.habilidades.filter((y) => y !== h) : x.habilidades.length < total ? [...x.habilidades, h] : x.habilidades,
  }));
  const grupos = cla?.habilidadesAElegir ?? [];
  return (
    <>
      <TituloPaso titulo="Skills" ayuda={<>Las que tienes en Trained suman +2 + tu nivel. Tu clase da algunas, tu trasfondo una, y eliges el resto (más tu Int).
        {grupos.length > 0 && <> Tu clase pide: <b>{grupos.map((g) => g.map((h) => HABILIDADES.find((x) => x.clave === h)!.nombre).join(' o ')).join(', ')}</b>.</>}</>}
        derecha={<Cuenta llevas={e.habilidades.length} de={total} que="elegidas" />} />
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {HABILIDADES.map((h) => {
          const dada = dadas.find((d) => d.clave === h.clave);
          const elegida = e.habilidades.includes(h.clave);
          const trained = !!dada || elegida;
          const mod = attr[h.atributo] + (trained ? 3 : 0);
          return (
            <li key={h.clave}>
              <button type="button" disabled={!!dada || (!elegida && e.habilidades.length >= total)} onClick={() => alternar(h.clave)} aria-pressed={trained}
                className="flex min-h-11 w-full items-center gap-3 border-b border-dashed border-borde px-1 text-left transition hover:bg-acento/5 disabled:cursor-default disabled:hover:bg-transparent">
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-sm border-[1.5px] font-titulo text-[12px] font-bold ${trained ? 'border-acento bg-acento text-sobre-acento' : 'border-texto-suave/60'}`}>{trained ? 'T' : ''}</span>
                <span className="min-w-0 flex-1">
                  <span className={`font-titulo text-[16px] ${trained ? 'font-bold' : ''}`}>{h.nombre}</span>
                  <span className="ml-2 text-[12px] text-texto-suave">{abrev(h.atributo)}{dada ? ` · por ${dada.fuente}` : ''}</span>
                </span>
                <b className={`font-titulo text-[18px] ${trained ? 'text-acento' : 'text-texto-suave'}`}>{signo(mod)}</b>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function TarjetaDote({ d, elegida, onElegir }: { d: Dote; elegida: boolean; onElegir: () => void }) {
  return (
    <Opcion elegida={elegida} onElegir={onElegir} titulo={d.nombre} subtitulo={d.descripcion}
      chips={d.aptitud ? <Chip tono="acento"><span className="mr-1 inline-flex"><CostoAccion costo={d.aptitud.costo} /></span> se usa en la mesa</Chip> : undefined} />
  );
}

export function PasoDotes({ e, cambiar }: PropsPaso) {
  const tras = TRASFONDOS.find((t) => t.id === e.trasfondo);
  const doteTras = tras ? doteDe(tras.dote) : undefined;
  const deClase = dotesDeClase(e);
  return (
    <>
      <TituloPaso titulo="Dotes" ayuda="Talentos especiales. A nivel 1 tienes una de ascendencia y una de clase; tu trasfondo ya te regaló una de skill." />
      {doteTras && (
        <p className="mb-4 rounded-sm border-l-4 border-exito/60 bg-exito/5 px-3 py-2 text-[14px]">
          De tu trasfondo: <b className="font-titulo">{doteTras.nombre}</b> — {doteTras.descripcion}
        </p>
      )}
      <h3 className="mb-2 font-titulo text-[20px] font-bold">De ascendencia</h3>
      <div className={rejilla}>
        {dotesDeAscendencia(e).map((d) => (
          <TarjetaDote key={d.id} d={d} elegida={e.doteAscendencia === d.id}
            onElegir={() => cambiar({ doteAscendencia: d.id, ...(d.id !== 'general-training' && e.herencia !== 'versatile' ? { doteGeneral: null } : {}) })} />
        ))}
      </div>
      {deClase.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 font-titulo text-[20px] font-bold">De clase</h3>
          <div className={rejilla}>
            {deClase.map((d) => <TarjetaDote key={d.id} d={d} elegida={e.doteClase === d.id} onElegir={() => cambiar({ doteClase: d.id })} />)}
          </div>
        </>
      )}
      {necesitaDoteGeneral(e) && (
        <>
          <h3 className="mt-6 mb-2 font-titulo text-[20px] font-bold">General</h3>
          <div className={rejilla}>
            {DOTES_GENERALES.map((d) => <TarjetaDote key={d.id} d={d} elegida={e.doteGeneral === d.id} onElegir={() => cambiar({ doteGeneral: d.id })} />)}
          </div>
        </>
      )}
    </>
  );
}

function TarjetaConjuro({ x, elegida, onElegir, lleno }: { x: Conjuro; elegida: boolean; onElegir: () => void; lleno: boolean }) {
  const defensa = x.defensa === 'ataque' ? 'ataque contra CA' : x.defensa ? `${x.defensa[0]!.toUpperCase()}${x.defensa.slice(1)}` : null;
  return (
    <Opcion elegida={elegida} onElegir={onElegir} deshabilitada={!elegida && lleno} titulo={<span className="inline-flex items-center gap-2">{x.nombre} <CostoAccion costo={x.costo} /></span>}
      subtitulo={x.descripcion}
      chips={<>
        {x.distancia !== null && <Chip>{x.distancia === 0 ? 'toque' : `${x.distancia} ft`}</Chip>}
        {x.area && <Chip>{x.area}</Chip>}
        {defensa && <Chip tono="acento">{defensa}</Chip>}
        {x.dano && <Chip tono={x.tipoDano === 'healing' ? 'bueno' : 'malo'}>{x.dano} {x.tipoDano === 'healing' ? 'curación' : x.tipoDano}</Chip>}
      </>} />
  );
}

export function PasoConjuros({ e, cambiar }: PropsPaso) {
  const tradicion = tradicionDe(e);
  const pide = conjurosAElegir(e);
  const cla = CLASES.find((c) => c.id === e.clase);
  const alternar = (lista: 'trucos' | 'conjuros', id: string, max: number) => cambiar((x) => {
    const actual = x[lista];
    return { [lista]: actual.includes(id) ? actual.filter((y) => y !== id) : actual.length < max ? [...actual, id] : actual };
  });
  if (!tradicion) {
    return <TituloPaso titulo="Conjuros" ayuda="Tu tradición de magia sale de tu subclase: elígela primero en el paso Clase." />;
  }
  return (
    <>
      <TituloPaso titulo={`Conjuros ${NOMBRES_TRADICION[tradicion]}`}
        ayuda={cla?.lanzador?.tipo === 'espontaneo'
          ? 'Lanzas espontáneamente: estos son los conjuros que conoces y los lanzas con cualquier espacio libre.'
          : 'Preparas cada día: estos son los que tienes en tu libro (o tu familiar). Los trucos se usan sin gastar nada.'} />
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-titulo text-[20px] font-bold">Trucos <span className="text-[14px] font-normal text-texto-suave">· sin límite</span></h3>
          <Cuenta llevas={e.trucos.length} de={pide.trucos} que="trucos" />
        </div>
        <div className={rejilla}>
          {conjurosDisponibles(e, 0).map((x) => (
            <TarjetaConjuro key={x.id} x={x} elegida={e.trucos.includes(x.id)} lleno={e.trucos.length >= pide.trucos} onElegir={() => alternar('trucos', x.id, pide.trucos)} />
          ))}
        </div>
      </section>
      {pide.rango1 > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-titulo text-[20px] font-bold">Rango 1 <span className="text-[14px] font-normal text-texto-suave">· gastan un espacio</span></h3>
            <Cuenta llevas={e.conjuros.length} de={pide.rango1} que="conjuros" />
          </div>
          <div className={rejilla}>
            {conjurosDisponibles(e, 1).map((x) => (
              <TarjetaConjuro key={x.id} x={x} elegida={e.conjuros.includes(x.id)} lleno={e.conjuros.length >= pide.rango1} onElegir={() => alternar('conjuros', x.id, pide.rango1)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// Lo de siempre por clase: un punto de partida que se puede cambiar
const KITS: Record<string, Partial<Eleccion>> = {
  fighter: { armas: ['longsword', 'javelin'], armadura: 'chain-mail', escudo: 'wooden-shield', equipo: [{ id: 'adventurers-pack', cantidad: 1 }] },
  barbarian: { armas: ['greataxe', 'javelin'], armadura: 'hide', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }] },
  bard: { armas: ['rapier', 'dagger'], armadura: 'leather', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'musical-instrument', cantidad: 1 }] },
  champion: { armas: ['longsword'], armadura: 'chain-mail', escudo: 'steel-shield', equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'religious-symbol', cantidad: 1 }] },
  cleric: { armas: ['mace'], armadura: 'none', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'religious-symbol', cantidad: 1 }, { id: 'minor-healing-potion', cantidad: 1 }] },
  druid: { armas: ['spear'], armadura: 'hide', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'material-pouch', cantidad: 1 }] },
  monk: { armas: [], armadura: 'none', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'minor-healing-potion', cantidad: 2 }] },
  ranger: { armas: ['longbow', 'shortsword'], armadura: 'leather', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'arrows', cantidad: 2 }] },
  rogue: { armas: ['rapier', 'shortbow'], armadura: 'leather', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'thieves-toolkit', cantidad: 1 }, { id: 'arrows', cantidad: 1 }] },
  sorcerer: { armas: ['dagger', 'staff'], armadura: 'none', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'material-pouch', cantidad: 1 }] },
  witch: { armas: ['staff', 'dagger'], armadura: 'none', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'material-pouch', cantidad: 1 }] },
  wizard: { armas: ['staff', 'crossbow'], armadura: 'none', escudo: null, equipo: [{ id: 'adventurers-pack', cantidad: 1 }, { id: 'spellbook', cantidad: 1 }, { id: 'bolts', cantidad: 1 }] },
};

export function PasoEquipo({ e, cambiar }: PropsPaso) {
  const cla = CLASES.find((c) => c.id === e.clase);
  const [todas, setTodas] = useState(false);
  const gasto = gastoDe(e);
  const queda = DINERO_INICIAL - gasto;
  const attr = atributosDe(e);
  const armas = ARMAS.filter((a) => a.id !== 'fist' && (todas || !cla || rangoConArma(cla, a, e) > 0 || (a.id === 'clan-dagger' && e.ascendencia === 'dwarf')));
  const alternarArma = (a: Arma) => cambiar((x) => ({ armas: x.armas.includes(a.id) ? x.armas.filter((y) => y !== a.id) : [...x.armas, a.id] }));
  const cantidad = (id: string) => e.equipo.find((x) => x.id === id)?.cantidad ?? 0;
  const ponerCantidad = (id: string, n: number) => cambiar((x) => ({ equipo: n <= 0 ? x.equipo.filter((y) => y.id !== id) : [...x.equipo.filter((y) => y.id !== id), { id, cantidad: n }] }));
  const defensa = cla?.defensa;
  const rangoArmadura = (cat: string) => !defensa ? 1 : cat === 'sin-armadura' ? defensa.sinArmadura : cat === 'ligera' ? defensa.ligera : cat === 'media' ? defensa.media : defensa.pesada;

  return (
    <>
      <TituloPaso titulo="Equipo" ayuda="Empiezas con 15 po para armas, armadura y lo que lleves en la mochila."
        derecha={(
          <div className="flex flex-wrap items-center gap-2">
            {cla && KITS[cla.id] && (
              <button type="button" className="boli flex h-9 items-center gap-1.5 border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10"
                onClick={() => cambiar(KITS[cla.id]!)}>
                <SparkleIcon size={16} aria-hidden /> Kit recomendado
              </button>
            )}
            <span className={`rounded-sm border-[1.5px] px-2 py-0.5 font-titulo text-[15px] font-bold ${queda < 0 ? 'border-peligro text-peligro' : 'border-exito/60 text-exito'}`}>
              {queda < 0 ? `Te pasas por ${precioTexto(-queda)}` : `Te quedan ${precioTexto(queda) === 'gratis' ? 'nada' : precioTexto(queda)}`}
            </span>
          </div>
        )} />

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-titulo text-[20px] font-bold">Armas</h3>
          <label className="flex items-center gap-2 text-[13px] text-texto-suave">
            <input type="checkbox" className="size-4 accent-acento" checked={todas} onChange={(ev) => setTodas(ev.target.checked)} />
            Ver también las que no sabes usar
          </label>
        </div>
        <div className={rejilla}>
          {armas.map((a) => {
            const rango = cla ? rangoConArma(cla, a, e) : 1;
            return (
              <Opcion key={a.id} elegida={e.armas.includes(a.id)} onElegir={() => alternarArma(a)}
                titulo={a.nombre} subtitulo={`${a.dados} ${({ B: 'contundente', P: 'perforante', S: 'cortante' })[a.tipoDano]} · ${a.manos === 2 ? 'dos manos' : 'una mano'}${a.distancia ? ` · ${a.distancia} ft` : ''}`}
                motivo={rango === 0 ? 'No tienes entrenamiento: −2 y sin nivel al atacar' : undefined}
                chips={<>
                  <Chip>{a.id === 'clan-dagger' && e.ascendencia === 'dwarf' ? 'regalo de tu clan' : precioTexto(a.precio)}</Chip>
                  <Chip tono="acento">{a.categoria}</Chip>
                  {a.rasgos.slice(0, 4).map((r) => <Chip key={r}>{r}</Chip>)}
                </>} />
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 font-titulo text-[20px] font-bold">Armadura</h3>
        <div className={rejilla}>
          {ARMADURAS.map((a) => {
            const rango = rangoArmadura(a.categoria);
            const frena = a.velocidad < 0 && attr.str < a.fuerza;
            return (
              <Opcion key={a.id} elegida={e.armadura === a.id} onElegir={() => cambiar({ armadura: a.id })} titulo={a.nombre}
                subtitulo={a.categoria === 'sin-armadura' ? 'Ropa de viaje: sin protección extra.' : `+${a.ca} a la CA · Dex hasta +${a.topeDex}${a.penalizacion ? ` · ${a.penalizacion} a skills de Str y Dex` : ''}`}
                motivo={rango === 0 ? 'Tu clase no la sabe usar' : frena ? `Te frena ${-a.velocidad} ft (pide Str +${a.fuerza})` : undefined}
                chips={<><Chip>{precioTexto(a.precio)}</Chip><Chip tono="acento">{a.categoria}</Chip></>} />
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 font-titulo text-[20px] font-bold">Escudo</h3>
        <div className={rejilla}>
          <Opcion elegida={!e.escudo} onElegir={() => cambiar({ escudo: null })} titulo="Sin escudo" subtitulo="Las dos manos libres." />
          {ESCUDOS.map((s) => (
            <Opcion key={s.id} elegida={e.escudo === s.id} onElegir={() => cambiar({ escudo: s.id })} titulo={s.nombre} subtitulo={s.descripcion}
              chips={<><Chip>+{s.ca} CA levantado</Chip><Chip>Dureza {s.dureza}</Chip><Chip>{precioTexto(s.precio)}</Chip></>} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 font-titulo text-[20px] font-bold">Mochila</h3>
        <ul className="grid gap-x-6 sm:grid-cols-2">
          {EQUIPO.map((x) => {
            const n = cantidad(x.id);
            return (
              <li key={x.id} className="flex min-h-12 items-center gap-3 border-b border-dashed border-borde py-1">
                <span className="min-w-0 flex-1">
                  <span className={`font-titulo text-[15.5px] ${n ? 'font-bold' : ''}`}>{x.nombre}</span>
                  <span className="block truncate text-[12px] text-texto-suave">{x.descripcion}</span>
                </span>
                <span className="font-titulo text-[13px] text-texto-suave">{precioTexto(x.precio)}</span>
                <span className="flex items-center gap-1">
                  <button type="button" className="flex size-8 items-center justify-center rounded-md border border-borde disabled:opacity-30" disabled={n === 0}
                    onClick={() => ponerCantidad(x.id, n - 1)} aria-label={`Quitar ${x.nombre}`}><MinusIcon size={14} /></button>
                  <span className="w-5 text-center font-titulo text-[15px] font-bold">{n}</span>
                  <button type="button" className="flex size-8 items-center justify-center rounded-md border border-borde" onClick={() => ponerCantidad(x.id, n + 1)}
                    aria-label={`Agregar ${x.nombre}`}><PlusIcon size={14} /></button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

export function PasoDetalles({ e, cambiar, nombre, setNombre, retrato, onRetrato, subiendo }: PropsPaso & {
  nombre: string;
  setNombre: (n: string) => void;
  retrato: string;
  onRetrato: (archivo: File | null) => void;
  subiendo: boolean;
}) {
  const asc = ASCENDENCIAS.find((a) => a.id === e.ascendencia);
  const cuantos = idiomasAElegir(e);
  const opciones = IDIOMAS.filter((i) => !asc?.idiomas.includes(i));
  const alternar = (i: string) => cambiar((x) => ({ idiomas: x.idiomas.includes(i) ? x.idiomas.filter((y) => y !== i) : x.idiomas.length < cuantos ? [...x.idiomas, i] : x.idiomas }));
  return (
    <>
      <TituloPaso titulo="Quién es" ayuda="El nombre, su cara y los idiomas que habla." />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <label className="group relative flex size-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[3px] border-4 border-white bg-superficie-2 shadow-[0_6px_16px_-6px_var(--sombra)] -rotate-2">
          {retrato ? <img src={retrato} alt="" className="size-full object-cover" /> : <span className="px-2 text-center font-titulo text-[14px] text-texto-suave">{subiendo ? 'Subiendo…' : 'Toca para poner su retrato'}</span>}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="sr-only" onChange={(ev) => { onRetrato(ev.target.files?.[0] ?? null); ev.target.value = ''; }} />
        </label>
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="nombre-personaje" className="font-titulo text-[15px] text-texto-suave">Nombre</label>
          <input id="nombre-personaje" className={`${claseEntrada} h-12 font-titulo text-[20px]`} value={nombre} maxLength={60} placeholder="Kyra"
            onChange={(ev) => setNombre(ev.target.value)} />
        </div>
      </div>
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-titulo text-[20px] font-bold">Idiomas</h3>
          {cuantos > 0 && <Cuenta llevas={e.idiomas.length} de={cuantos} que="extra" />}
        </div>
        <p className="mb-2 text-[14px] text-texto-suave">Hablas {asc?.idiomas.join(', ') ?? 'Common'}.{cuantos > 0 ? ` Por tu Int${e.ascendencia === 'human' ? ' y por ser humano' : ''}, aprendes ${cuantos} más.` : ''}</p>
        {cuantos > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {opciones.map((i) => (
              <button key={i} type="button" aria-pressed={e.idiomas.includes(i)} onClick={() => alternar(i)}
                disabled={!e.idiomas.includes(i) && e.idiomas.length >= cuantos}
                className={`h-9 rounded-md border-[1.5px] px-2.5 font-titulo text-[14px] transition disabled:opacity-35 ${e.idiomas.includes(i) ? 'border-acento bg-acento text-sobre-acento' : 'border-borde hover:border-acento/60'}`}>
                {i}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function Buscador({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="relative block w-full sm:w-64">
      <MagnifyingGlassIcon size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" aria-hidden />
      <input className={`${claseEntrada} pl-9`} value={valor} placeholder="Buscar…" aria-label="Buscar" onChange={(ev) => onCambio(ev.target.value)} />
    </label>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRightIcon, CaretDownIcon, CheckIcon, MagicWandIcon, MagnifyingGlassIcon, SparkleIcon, StarIcon } from '@phosphor-icons/react';
import { ATRIBUTOS, calcular, HABILIDADES, signo, type Atributo, type ClaveHabilidad, type Personaje } from '../../../reglas/pf2e';
import { conjuroAAptitud, doteAAptitud, type ConjuroCompendio, type DoteCompendio, type GenericoCompendio, type Indice } from '../../../reglas/compendio';
import {
  ascendenciaDe, claseDe, ELECCION_NIVEL_VACIA, faltaElegir, NOMBRES_HUECO, NOMBRES_SUBE, nombreRango, queTrae, rangoMaximoSkill, subirNivel,
  type DatosClase, type EleccionNivel, type HuecoDote, type QueTrae,
} from '../../../reglas/nivel';
import { grupoDe, sugerirAtributos, sugerirConjuros, sugerirDotes, sugerirSkills, type Sugerencia } from '../../../reglas/sugerencias';
import { buscar, entradaDe, useEntrada, useIndice } from '../../compendio';
import { Modal } from '../hud/Modal';
import { CostoAccion } from '../hud/piezas';
import { claseEntrada } from '../ui';
import { Chip, Cuenta } from '../creador/piezas';
import { IconoJuego, rutaAscendencia, rutaTipo } from '../Iconos';

// Subir de nivel: lo que trae el nivel nuevo, lo que hay que elegir (con sugerencias y sus razones)
// y cómo queda la ficha antes de confirmar. Al confirmar, un sello de "¡Nivel N!".
export function SubirNivel({ p, otros, onSubir, onCerrar }: {
  p: Personaje;
  // Los demás personajes de la mesa: para sugerir lo que al grupo le falta
  otros: Personaje[];
  onSubir: (nuevo: Personaje) => void;
  onCerrar: () => void;
}) {
  const clase = useEntrada<GenericoCompendio>('clases', claseDe(p));
  const indiceDotes = useIndice('dotes');
  const indiceConjuros = useIndice(p.lanzador ? 'conjuros' : null);
  const [e, setE] = useState<EleccionNivel>(ELECCION_NIVEL_VACIA);
  const [cargando, setCargando] = useState<string | null>(null);
  // Al confirmar se guarda cómo era antes: la ficha que llega después ya viene subida
  const [hecho, setHecho] = useState<{ antes: Personaje; despues: Personaje } | null>(null);

  const datos = clase && (clase.datos as unknown as DatosClase).progresion ? clase.datos as unknown as DatosClase : null;
  const trae = useMemo(() => (datos && p.nivel < 20 ? queTrae(p, datos) : null), [datos, p]);
  const grupo = useMemo(() => grupoDe(p, otros), [p, otros]);
  const sugeridas = useMemo(() => {
    if (!trae) return null;
    const dotes = Object.fromEntries(trae.dotes.map((h) => [h, indiceDotes ? sugerirDotes(p, h, trae.nivel, indiceDotes, grupo) : []])) as Record<HuecoDote, Sugerencia<Indice>[]>;
    return {
      atributos: sugerirAtributos(p, datos?.atributoClave ?? []),
      skills: sugerirSkills(p, trae.nivel, grupo),
      dotes,
      conjuros: trae.conjuros && indiceConjuros ? sugerirConjuros(p, trae.conjuros.rangoMax, indiceConjuros, grupo) : [],
    };
  }, [trae, indiceDotes, indiceConjuros, grupo, p, datos]);

  const titulo = `Subir a nivel ${p.nivel + 1}`;
  if (hecho) return <Celebracion antes={hecho.antes} despues={hecho.despues} onCerrar={onCerrar} />;
  if (p.nivel >= 20) return <Modal titulo={titulo} onCerrar={onCerrar}><p>Ya estás en nivel 20: el máximo.</p></Modal>;
  if (clase === undefined) return <Modal titulo={titulo} onCerrar={onCerrar}><p className="font-titulo text-texto-suave">Abriendo el libro de tu clase…</p></Modal>;
  if (!trae || !sugeridas) {
    return (
      <Modal titulo={titulo} onCerrar={onCerrar}>
        <p>No encuentro la clase <b>{p.clase}</b> en el compendio. Puedes subir de nivel a mano desde el editor de tu ficha.</p>
      </Modal>
    );
  }

  const despues = subirNivel(p, trae, e);
  const falta = faltaElegir(trae, e);

  const elegirDote = async (hueco: HuecoDote, x: Indice) => {
    if (e.dotes[hueco]?.id === x.id) return setE((a) => ({ ...a, dotes: { ...a.dotes, [hueco]: undefined } }));
    setCargando(x.id);
    const d = await entradaDe<DoteCompendio>('dotes', x.id);
    setCargando(null);
    if (!d) return;
    setE((a) => ({ ...a, dotes: { ...a.dotes, [hueco]: { id: d.id, nombre: d.nombre, categoria: d.categoria, nivel: d.nivel ?? 1, aptitud: doteAAptitud(d) } } }));
  };
  const elegirConjuro = async (x: Indice) => {
    if (e.conjuros.some((c) => c.id === x.id)) return setE((a) => ({ ...a, conjuros: a.conjuros.filter((c) => c.id !== x.id) }));
    if (trae.conjuros && e.conjuros.length >= trae.conjuros.aprender) return;
    setCargando(x.id);
    const c = await entradaDe<ConjuroCompendio>('conjuros', x.id);
    setCargando(null);
    if (!c) return;
    setE((a) => ({ ...a, conjuros: [...a.conjuros, { id: c.id, nombre: c.nombre, aptitud: conjuroAAptitud(c) }] }));
  };
  // Llena todo lo que falta con lo primero de cada lista de sugerencias
  const usarSugerido = async () => {
    const atributos = trae.mejorasAtributo && e.atributos.length < 4
      ? [...new Set([...e.atributos, ...sugeridas.atributos.map((s) => s.item)])].slice(0, 4) : e.atributos;
    const skill = trae.mejoraSkill ? e.skill ?? sugeridas.skills[0]?.item ?? null : null;
    setE((a) => ({ ...a, atributos, skill }));
    for (const h of trae.dotes) {
      if (e.dotes[h]) continue;
      const primera = sugeridas.dotes[h].find((s) => !s.falta);
      if (primera) await elegirDote(h, primera.item);
    }
    if (trae.conjuros) {
      const faltan = trae.conjuros.aprender - e.conjuros.length;
      const nuevos: EleccionNivel['conjuros'] = [];
      for (const s of sugeridas.conjuros.slice(0, Math.max(0, faltan))) {
        const c = await entradaDe<ConjuroCompendio>('conjuros', s.item.id);
        if (c) nuevos.push({ id: c.id, nombre: c.nombre, aptitud: conjuroAAptitud(c) });
      }
      setE((a) => ({ ...a, conjuros: [...a.conjuros, ...nuevos].slice(0, trae.conjuros!.aprender) }));
    }
  };
  const confirmar = () => {
    if (falta.length) return;
    setHecho({ antes: p, despues });
    onSubir(despues);
  };

  return (
    <Modal ancho="max-w-6xl" onCerrar={onCerrar}
      titulo={<span className="flex items-center gap-2"><IconoJuego ruta={rutaAscendencia(ascendenciaDe(p))} className="size-7 text-acento" /> {titulo}</span>}
      subtitulo={`${p.nombre} · ${p.ascendencia} ${p.clase} · elige lo nuevo; las sugerencias dicen por qué`}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-6">
          <LoNuevo trae={trae} />

          {trae.mejorasAtributo && (
            <Seccion titulo="Mejoras de atributo" ayuda="Cuatro atributos distintos suben 1 (desde +4, cada mejora cuenta la mitad)."
              derecha={<Cuenta llevas={new Set(e.atributos).size} de={4} que="elegidos" />}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {sugeridas.atributos.map((s, i) => {
                  const a = s.item;
                  const elegido = e.atributos.includes(a);
                  return (
                    <button key={a} type="button" aria-pressed={elegido}
                      onClick={() => setE((x) => ({ ...x, atributos: elegido ? x.atributos.filter((y) => y !== a) : x.atributos.length < 4 ? [...x.atributos, a] : x.atributos }))}
                      className={`flex flex-col gap-0.5 rounded-lg border-[1.5px] p-2.5 text-left transition ${elegido ? 'border-acento bg-acento/[0.07]' : 'border-borde hover:border-acento/60'}`}>
                      <span className="flex items-center gap-1.5 font-titulo text-[16px] font-bold">
                        {ATRIBUTOS[a].abrev} <span className="text-texto-suave">{signo(p.atributos[a])}</span>
                        {elegido && <><ArrowRightIcon size={13} aria-hidden /> <span className="text-acento">{signo(despues.atributos[a])}</span></>}
                        {i < 4 && <StarIcon size={13} weight="fill" className="ml-auto text-[#d39b1c]" aria-label="Sugerido" />}
                      </span>
                      <span className="text-[12px] leading-snug text-texto-suave">{s.razones[0] ?? ATRIBUTOS[a].ayuda}</span>
                    </button>
                  );
                })}
              </div>
            </Seccion>
          )}

          {trae.mejoraSkill && (
            <Seccion titulo="Una skill sube" ayuda={`Sube un rango (hasta ${nombreRango(rangoMaximoSkill(trae.nivel))} en este nivel).`}>
              <div className="grid gap-2 sm:grid-cols-2">
                {sugeridas.skills.slice(0, 6).map((s, i) => (
                  <Tarjeta key={s.item} elegida={e.skill === s.item} sugerida={i === 0} onElegir={() => setE((x) => ({ ...x, skill: x.skill === s.item ? null : s.item }))}
                    titulo={<>{HABILIDADES.find((h) => h.clave === s.item)!.nombre} <span className="font-normal text-texto-suave">{nombreRango(p.habilidades[s.item])} → {nombreRango(p.habilidades[s.item] + 1)}</span></>}
                    razones={s.razones} />
                ))}
              </div>
              <select className={`${claseEntrada} mt-2 max-w-xs`} value={e.skill ?? ''} aria-label="Otra skill"
                onChange={(ev) => setE((x) => ({ ...x, skill: (ev.target.value || null) as ClaveHabilidad | null }))}>
                <option value="">Otra skill…</option>
                {sugeridas.skills.map((s) => <option key={s.item} value={s.item}>{HABILIDADES.find((h) => h.clave === s.item)!.nombre}</option>)}
              </select>
            </Seccion>
          )}

          {trae.dotes.map((h) => (
            <HuecoDotes key={h} hueco={h} nivel={trae.nivel} sugerencias={sugeridas.dotes[h]} cargando={cargando} elegida={e.dotes[h]?.id ?? null}
              listo={!!indiceDotes} onElegir={(x) => void elegirDote(h, x)} />
          ))}

          {trae.conjuros && (
            <Seccion titulo="Conjuros nuevos" ayuda={`Tus espacios llegan a rango ${trae.conjuros.rangoMax}. Elige ${trae.conjuros.aprender} para tu ${p.clase === 'Wizard' ? 'libro' : 'repertorio'}.`}
              derecha={<Cuenta llevas={e.conjuros.length} de={trae.conjuros.aprender} que="conjuros" />}>
              <ListaSugerida tipo="conjuros" sugerencias={sugeridas.conjuros} elegidas={e.conjuros.map((c) => c.id)} cargando={cargando} listo={!!indiceConjuros}
                lleno={e.conjuros.length >= trae.conjuros.aprender} onElegir={(x) => void elegirConjuro(x)} />
            </Seccion>
          )}
        </div>

        <aside className="lg:sticky lg:top-0 lg:self-start">
          <AsiQueda antes={p} despues={despues} />
          <div className="mt-3 flex flex-col gap-2">
            {falta.length > 0 && (
              <button className="boli flex h-10 items-center justify-center gap-2 border-[1.5px] border-acento px-3 font-titulo text-[14.5px] font-bold text-acento hover:bg-acento/10" onClick={() => void usarSugerido()}>
                <MagicWandIcon size={18} aria-hidden /> Elegir lo sugerido
              </button>
            )}
            <button className="boli flex h-11 items-center justify-center gap-2 bg-acento px-4 font-titulo text-[16px] font-bold text-sobre-acento disabled:opacity-45" disabled={falta.length > 0} onClick={confirmar}>
              <SparkleIcon size={18} weight="fill" aria-hidden /> {titulo}
            </button>
            {falta.length > 0 && <p className="text-[12.5px] leading-snug text-texto-suave">Falta: {falta.join(' · ')}</p>}
          </div>
        </aside>
      </div>
    </Modal>
  );
}

function Seccion({ titulo, ayuda, derecha, children }: { titulo: string; ayuda: string; derecha?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2 border-b-[1.5px] border-texto/70 pb-1">
        <div>
          <h3 className="font-titulo text-[20px] leading-tight font-bold">{titulo}</h3>
          <p className="text-[13px] text-texto-suave">{ayuda}</p>
        </div>
        {derecha}
      </div>
      {children}
    </section>
  );
}

// Lo que trae el nivel sin elegir nada: PG, rasgos de clase y las competencias que suben
function LoNuevo({ trae }: { trae: QueTrae }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <Seccion titulo={`Lo que trae el nivel ${trae.nivel}`} ayuda="Esto llega solo, sin elegir.">
      <div className="flex flex-wrap gap-1.5">
        <Chip tono="bueno">+{trae.pg} PG</Chip>
        {trae.sube.map((s) => <Chip key={s.que} tono="acento">{NOMBRES_SUBE[s.que]} → {nombreRango(s.rango)}</Chip>)}
        {trae.conjuros && <Chip tono="acento">espacios hasta rango {trae.conjuros.rangoMax}</Chip>}
      </div>
      {trae.rasgos.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-borde/60">
          {trae.rasgos.map((r) => (
            <li key={r.nombre} className="py-1.5">
              <button type="button" className="flex w-full items-center gap-2 text-left" onClick={() => setAbierto(abierto === r.nombre ? null : r.nombre)} aria-expanded={abierto === r.nombre}>
                <IconoJuego ruta={rutaTipo('class')} className="size-5 text-acento" />
                <span className="font-titulo text-[16px] font-semibold">{r.nombre}</span>
                <CaretDownIcon size={13} aria-hidden className={`ml-auto text-texto-suave transition ${abierto === r.nombre ? 'rotate-180' : ''}`} />
              </button>
              {abierto === r.nombre && <p className="mt-1 ml-7 text-[13.5px] leading-snug whitespace-pre-line">{r.texto || 'Sin texto.'}</p>}
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  );
}

function Tarjeta({ titulo, razones, elegida, sugerida, onElegir, falta, cargando, children }: {
  titulo: ReactNode;
  razones: string[];
  elegida: boolean;
  sugerida?: boolean;
  onElegir: () => void;
  falta?: string;
  cargando?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-lg border-[1.5px] p-2.5 transition ${elegida ? 'border-acento bg-acento/[0.07] shadow-[0_4px_14px_-8px_var(--acento)]' : 'border-borde bg-superficie'} ${falta ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        <span className={`min-w-0 flex-1 font-titulo text-[16px] leading-tight font-bold ${elegida ? 'marcatextos' : ''}`}>{titulo}</span>
        {sugerida && !falta && <StarIcon size={15} weight="fill" className="mt-0.5 shrink-0 text-[#d39b1c]" aria-label="La más sugerida" />}
        <button type="button" onClick={onElegir} disabled={!!falta || cargando} aria-pressed={elegida}
          className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border-[1.5px] px-2.5 font-titulo text-[13.5px] font-semibold transition disabled:opacity-45 ${elegida ? 'border-acento bg-acento text-sobre-acento' : 'border-borde hover:border-acento/60'}`}>
          {elegida ? <><CheckIcon size={14} weight="bold" aria-hidden /> Elegida</> : cargando ? '…' : 'Elegir'}
        </button>
      </div>
      {falta ? <p className="text-[12.5px] text-peligro">No todavía: {falta}</p> : razones.length > 0 && (
        <span className="flex flex-wrap gap-1">{razones.slice(0, 3).map((r) => <Chip key={r} tono="acento">{r}</Chip>)}</span>
      )}
      {children}
    </div>
  );
}

function HuecoDotes({ hueco, nivel, sugerencias, elegida, cargando, listo, onElegir }: {
  hueco: HuecoDote;
  nivel: number;
  sugerencias: Sugerencia<Indice>[];
  elegida: string | null;
  cargando: string | null;
  listo: boolean;
  onElegir: (x: Indice) => void;
}) {
  return (
    <Seccion titulo={NOMBRES_HUECO[hueco]} ayuda={`De nivel ${nivel} o menos. ${sugerencias.length} que te sirven; arriba, las que mejor te quedan.`}
      derecha={elegida ? <Chip tono="bueno">elegida</Chip> : undefined}>
      <ListaSugerida tipo="dotes" sugerencias={sugerencias} elegidas={elegida ? [elegida] : []} cargando={cargando} listo={listo} lleno={false} onElegir={onElegir} />
    </Seccion>
  );
}

// Las 6 más sugeridas como tarjetas, y un buscador para todas las demás
function ListaSugerida({ tipo, sugerencias, elegidas, cargando, listo, lleno, onElegir }: {
  tipo: 'dotes' | 'conjuros';
  sugerencias: Sugerencia<Indice>[];
  elegidas: string[];
  cargando: string | null;
  listo: boolean;
  lleno: boolean;
  onElegir: (x: Indice) => void;
}) {
  const [texto, setTexto] = useState('');
  const [todas, setTodas] = useState(false);
  const [visto, setVisto] = useState<string | null>(null);
  if (!listo) return <p className="font-titulo text-[14px] text-texto-suave">Abriendo el compendio…</p>;
  const porId = new Map(sugerencias.map((s) => [s.item.id, s]));
  const encontradas = texto.trim() ? buscar(sugerencias.map((s) => s.item), { texto }, 30).map((x) => porId.get(x.id)!) : sugerencias.slice(6, todas ? 60 : 6);
  const tarjeta = (s: Sugerencia<Indice>, i: number) => {
    const elegida = elegidas.includes(s.item.id);
    return (
      <Tarjeta key={s.item.id} elegida={elegida} sugerida={i === 0} razones={s.razones} {...(s.falta ? { falta: s.falta } : {})} cargando={cargando === s.item.id}
        onElegir={() => (!elegida && lleno ? undefined : onElegir(s.item))}
        titulo={<span className="flex items-center gap-1.5">
          <IconoJuego ruta={rutaTipo(tipo === 'dotes' ? 'feat' : 'spell')} className="size-4 text-texto-suave" />
          {s.item.nombre} <span className="font-normal text-texto-suave">nv {s.item.nivel}</span>
        </span>}>
        <button type="button" className="self-start font-titulo text-[12.5px] text-texto-suave underline decoration-dotted hover:text-texto" onClick={() => setVisto(visto === s.item.id ? null : s.item.id)}>
          {visto === s.item.id ? 'Ocultar' : 'Qué hace'}
        </button>
        {visto === s.item.id && <Detalle tipo={tipo} id={s.item.id} />}
      </Tarjeta>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 md:grid-cols-2">{sugerencias.slice(0, 6).map(tarjeta)}</div>
      <div className="flex items-center gap-2">
        <span className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon size={16} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-texto-suave" aria-hidden />
          <input className={`${claseEntrada} w-full pl-8`} value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder={`Buscar entre las ${sugerencias.length}…`} aria-label={`Buscar ${tipo}`} />
        </span>
        {!texto && sugerencias.length > 6 && (
          <button className="font-titulo text-[13.5px] text-texto-suave hover:text-acento" onClick={() => setTodas(!todas)}>{todas ? 'Ver menos' : 'Ver más'}</button>
        )}
      </div>
      {encontradas.length > 0 && <div className="grid gap-2 md:grid-cols-2">{encontradas.map((s, i) => tarjeta(s, i + 6))}</div>}
    </div>
  );
}

function Detalle({ tipo, id }: { tipo: 'dotes' | 'conjuros'; id: string }) {
  const x = useEntrada<DoteCompendio | ConjuroCompendio>(tipo, id);
  if (x === undefined) return <p className="text-[12.5px] text-texto-suave">Cargando…</p>;
  if (!x) return null;
  return (
    <div className="rounded-md bg-superficie-2/50 px-2.5 py-1.5 text-[13px] leading-snug">
      <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[12px] text-texto-suave">
        {x.costo !== null && <CostoAccion costo={x.costo} />}
        {'prerrequisitos' in x && x.prerrequisitos.length > 0 && <span>Requiere: {x.prerrequisitos.join('; ')}</span>}
        <span className="italic">{x.fuente}</span>
      </p>
      <p className="whitespace-pre-line">{x.descripcion.length > 700 ? `${x.descripcion.slice(0, 699)}…` : x.descripcion}</p>
    </div>
  );
}

// Antes → después de los números que más se miran
function AsiQueda({ antes, despues }: { antes: Personaje; despues: Personaje }) {
  const a = calcular(antes);
  const d = calcular(despues);
  const filas: [string, number, number, boolean?][] = [
    ['PG máximos', a.pgMax.total, d.pgMax.total],
    ['CA', a.ca.total, d.ca.total],
    ['Fortitude', a.salvaciones.fortitude.total, d.salvaciones.fortitude.total, true],
    ['Reflex', a.salvaciones.reflex.total, d.salvaciones.reflex.total, true],
    ['Will', a.salvaciones.will.total, d.salvaciones.will.total, true],
    ['Perception', a.percepcion.total, d.percepcion.total, true],
    ...(a.golpes[0] && d.golpes[0] ? [[`Ataque (${antes.golpes[0]!.nombre})`, a.golpes[0].ataque.total, d.golpes[0].ataque.total, true] as [string, number, number, boolean]] : []),
    ...(a.conjuros && d.conjuros ? [['CD de conjuros', a.conjuros.cd.total, d.conjuros.cd.total] as [string, number, number]] : []),
  ];
  return (
    <div className="tarjeta px-3 py-2.5">
      <p className="font-titulo text-[15px] font-bold">Así queda</p>
      <p className="text-[12.5px] text-texto-suave">Nivel {antes.nivel} → {despues.nivel}</p>
      <dl className="mt-1.5 flex flex-col gap-0.5 text-[14px]">
        {filas.map(([nombre, x, y, conSigno]) => (
          <div key={nombre} className="flex items-baseline justify-between gap-2 border-b border-dashed border-borde/70 py-0.5">
            <dt className="text-texto-suave">{nombre}</dt>
            <dd className="font-titulo">
              <span className="text-texto-suave">{conSigno ? signo(x) : x}</span>
              {y !== x && <> → <b className="text-exito">{conSigno ? signo(y) : y}</b></>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// El sello de "¡Nivel N!", con estrellitas de tinta y la lista de lo nuevo
function Celebracion({ antes, despues, onCerrar }: { antes: Personaje; despues: Personaje; onCerrar: () => void }) {
  const nuevas = (despues.dotes ?? []).filter((d) => !(antes.dotes ?? []).some((x) => x.id === d.id)).map((d) => d.nombre);
  const conjuros = (despues.aptitudes ?? []).filter((x) => x.categoria !== 'dote' && !(antes.aptitudes ?? []).some((y) => y.id === x.id)).map((x) => x.nombre);
  const atributos = (Object.keys(ATRIBUTOS) as Atributo[]).filter((k) => despues.atributos[k] !== antes.atributos[k]).map((k) => `${ATRIBUTOS[k].abrev} ${signo(despues.atributos[k])}`);
  const pg = calcular(despues).pgMax.total - calcular(antes).pgMax.total;
  return (
    <Modal titulo={`${despues.nombre} sube de nivel`} onCerrar={onCerrar}>
      <div className="relative flex flex-col items-center gap-4 py-4">
        <div className="relative">
          {Array.from({ length: 12 }, (_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            return (
              <SparkleIcon key={i} size={14 + (i % 3) * 6} weight="fill" aria-hidden
                className="nivel-estrella absolute top-1/2 left-1/2 -mt-2 -ml-2 text-[#d39b1c]"
                style={{ ['--dx' as string]: `${Math.cos(ang) * (90 + (i % 2) * 30)}px`, ['--dy' as string]: `${Math.sin(ang) * (60 + (i % 2) * 25)}px`, animationDelay: `${0.35 + (i % 4) * 0.05}s` }} />
            );
          })}
          <div className="nivel-sello rounded-md border-[3px] border-double border-acento bg-superficie px-7 py-3 text-center text-acento">
            <p className="font-titulo text-[14px] tracking-wide">{antes.clase}</p>
            <p className="font-titulo text-[44px] leading-none font-bold">¡Nivel {despues.nivel}!</p>
          </div>
        </div>
        <ul className="w-full max-w-sm list-disc pl-5 text-[14.5px] leading-relaxed">
          <li>+{pg} PG máximos</li>
          {atributos.length > 0 && <li>Atributos: {atributos.join(', ')}</li>}
          {nuevas.length > 0 && <li>Dotes nuevas: {nuevas.join(', ')}</li>}
          {conjuros.length > 0 && <li>Conjuros nuevos: {conjuros.join(', ')}</li>}
          <li>Lo que se usa en la mesa ya está en tu lista de acciones.</li>
        </ul>
        <button className="boli h-11 bg-acento px-5 font-titulo text-[16px] font-bold text-sobre-acento" onClick={onCerrar}>Seguir jugando</button>
      </div>
    </Modal>
  );
}

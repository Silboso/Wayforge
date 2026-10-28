import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, CaretUpIcon, CheckIcon, PencilSimpleLineIcon, XIcon } from '@phosphor-icons/react';
import { calcular, HABILIDADES, signo, ATRIBUTOS, type Atributo, type Personaje } from '../../../reglas/pf2e';
import {
  atributosDe, conjurosAElegir, construir, ELECCION_VACIA, pendientes, type Eleccion, type Paso,
} from '../../../reglas/creador';
import { CLASES } from '../../../reglas/datos/clases';
import { subirImagen } from '../../imagenes';
import { EntradaCodigo } from '../EditorFicha';
import {
  PasoAscendencia, PasoAtributos, PasoClase, PasoConjuros, PasoDetalles, PasoDotes, PasoEquipo, PasoHabilidades, PasoTrasfondo,
} from './pasos';

const NOMBRES: Record<Paso | 'codigo', string> = {
  ascendencia: 'Ascendencia', trasfondo: 'Trasfondo', clase: 'Clase', atributos: 'Atributos', habilidades: 'Skills',
  dotes: 'Dotes', conjuros: 'Conjuros', equipo: 'Equipo', detalles: 'Quién es', codigo: 'Código',
};

const BORRADOR = 'wayforge:borrador-creador';

function leerBorrador(): { e: Eleccion; nombre: string; retrato: string } | null {
  try {
    const texto = localStorage.getItem(BORRADOR);
    return texto ? { ...JSON.parse(texto), e: { ...ELECCION_VACIA, ...JSON.parse(texto).e } } : null;
  } catch { return null; }
}

// El creador de personajes paso a paso: cada elección se ve al instante en la ficha de la derecha.
// Guarda un borrador en este navegador, por si se cierra la pestaña a la mitad.
export function Creador({ salaId, id, error, onGuardar, onCancelar, onAMano, onImportar }: {
  salaId: string;
  id: string;
  error?: string | null;
  onGuardar: (p: Personaje, codigo: string) => void;
  onCancelar: () => void;
  // Para quien ya tiene la ficha hecha (en Foundry o en papel) y prefiere copiar los números
  onAMano?: () => void;
  // Para quien ya lo tiene en Pathbuilder 2e
  onImportar?: () => void;
}) {
  const borrador = useMemo(leerBorrador, []);
  const [e, setE] = useState<Eleccion>(borrador?.e ?? ELECCION_VACIA);
  const [nombre, setNombre] = useState(borrador?.nombre ?? '');
  const [retrato, setRetrato] = useState(borrador?.retrato ?? '');
  const [paso, setPaso] = useState<Paso | 'codigo'>('ascendencia');
  const [codigo, setCodigo] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [aviso, setAviso] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [fichaAbierta, setFichaAbierta] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(BORRADOR, JSON.stringify({ e, nombre, retrato })); } catch { /* sin almacenamiento */ }
  }, [e, nombre, retrato]);

  const cambiar = (cambios: Partial<Eleccion> | ((actual: Eleccion) => Partial<Eleccion>)) => {
    setAviso('');
    setE((x) => ({ ...x, ...(typeof cambios === 'function' ? cambios(x) : cambios) }));
  };
  // Un paso se marca listo solo después de pasar por él y sin nada pendiente
  const [visitados, setVisitados] = useState<Set<string>>(() => new Set(['ascendencia']));
  useEffect(() => setVisitados((v) => (v.has(paso) ? v : new Set([...v, paso]))), [paso]);
  const lanza = !!CLASES.find((c) => c.id === e.clase)?.lanzador && conjurosAElegir(e).trucos > 0;
  const pasos: (Paso | 'codigo')[] = [
    'ascendencia', 'trasfondo', 'clase', 'atributos', 'habilidades', 'dotes', ...(lanza ? ['conjuros' as const] : []), 'equipo', 'detalles', 'codigo',
  ];
  const faltas = pendientes(e);
  const faltaDe = (p: Paso | 'codigo') => (p === 'codigo'
    ? (codigo.length === 4 && codigo === confirmacion ? [] : [{ paso: 'detalles' as Paso, falta: 'Escribe tu código' }])
    : p === 'detalles' && !nombre.trim() ? [{ paso: p, falta: 'Ponle un nombre' }, ...faltas.filter((f) => f.paso === p)]
    : faltas.filter((f) => f.paso === p));
  const listo = (p: Paso | 'codigo') => visitados.has(p) && faltaDe(p).length === 0;
  const i = pasos.indexOf(paso);
  const personaje = useMemo(() => construir(e, { id, nombre: nombre.trim() || 'Sin nombre', ...(retrato ? { retrato } : {}) }), [e, id, nombre, retrato]);

  async function subirRetrato(archivo: File | null) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      setRetrato(await subirImagen(salaId, archivo));
    } catch (err) {
      setAviso(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  }

  function terminar() {
    const primera = faltas[0];
    if (primera) { setPaso(primera.paso); return setAviso(primera.falta); }
    if (!nombre.trim()) { setPaso('detalles'); return setAviso('Ponle un nombre a tu personaje'); }
    if (!/^\d{4}$/.test(codigo)) return setAviso('El código son 4 números');
    if (codigo !== confirmacion) return setAviso('Los dos códigos no coinciden');
    try { localStorage.removeItem(BORRADOR); } catch { /* nada */ }
    onGuardar({ ...personaje, nombre: nombre.trim() }, codigo);
  }

  const props = { e, cambiar };
  return (
    <div className="flex min-h-full flex-col bg-fondo">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-dashed border-borde bg-fondo/95 px-4 py-2.5 backdrop-blur-sm lg:px-6">
        <PencilSimpleLineIcon size={22} className="text-acento" aria-hidden />
        <h1 className="font-titulo text-[21px] font-bold">Nuevo personaje</h1>
        <span className="hidden truncate font-titulo text-[15px] text-texto-suave sm:inline">
          {[nombre.trim(), personaje.ascendencia, personaje.clase].filter(Boolean).join(' · ') || 'nivel 1'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {onImportar && <button type="button" className="hidden h-9 rounded-md px-3 text-[13px] text-texto-suave hover:text-texto sm:block" onClick={onImportar}>Importar de Pathbuilder</button>}
          {onAMano && <button type="button" className="hidden h-9 rounded-md px-3 text-[13px] text-texto-suave hover:text-texto sm:block" onClick={onAMano}>Prefiero copiar mi ficha a mano</button>}
          <button type="button" className="flex size-10 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={onCancelar} aria-label="Cancelar">
            <XIcon size={20} aria-hidden />
          </button>
        </div>
      </header>

      {/* Pasos: pestañas al costado en PC, en fila en el teléfono */}
      <nav aria-label="Pasos" className="sticky top-[57px] z-10 flex gap-1 overflow-x-auto border-b border-dashed border-borde bg-fondo/95 px-3 py-2 lg:hidden">
        {pasos.map((p, n) => <PestanaPaso key={p} n={n + 1} nombre={NOMBRES[p]} activa={paso === p} lista={listo(p)} onIr={() => setPaso(p)} />)}
      </nav>

      <div className="mx-auto grid w-full max-w-[1500px] flex-1 lg:grid-cols-[210px_minmax(0,1fr)_320px]">
        <nav aria-label="Pasos" className="sticky top-[57px] hidden h-[calc(100vh-57px)] flex-col gap-1 overflow-y-auto border-r border-dashed border-borde px-3 py-5 lg:flex">
          {pasos.map((p, n) => <PestanaPaso key={p} n={n + 1} nombre={NOMBRES[p]} activa={paso === p} lista={listo(p)} onIr={() => setPaso(p)} vertical />)}
        </nav>

        <main className="min-w-0 px-4 pt-5 pb-32 lg:px-8 lg:pb-12">
          {paso === 'ascendencia' && <PasoAscendencia {...props} />}
          {paso === 'trasfondo' && <PasoTrasfondo {...props} />}
          {paso === 'clase' && <PasoClase {...props} />}
          {paso === 'atributos' && <PasoAtributos {...props} />}
          {paso === 'habilidades' && <PasoHabilidades {...props} />}
          {paso === 'dotes' && <PasoDotes {...props} />}
          {paso === 'conjuros' && <PasoConjuros {...props} />}
          {paso === 'equipo' && <PasoEquipo {...props} />}
          {paso === 'detalles' && <PasoDetalles {...props} nombre={nombre} setNombre={(n) => { setAviso(''); setNombre(n); }} retrato={retrato} onRetrato={subirRetrato} subiendo={subiendo} />}
          {paso === 'codigo' && (
            <>
              <h2 className="font-titulo text-[26px] font-bold">Tu código</h2>
              <p className="mb-4 max-w-prose text-[14px] text-texto-suave">Cuatro números que te pediremos cada vez que entres a la mesa con este personaje. Anótalos.</p>
              <div className="grid max-w-md gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[14px] text-texto-suave">Código<EntradaCodigo valor={codigo} largo={4} onCambio={(v) => { setCodigo(v); setAviso(''); }} /></label>
                <label className="flex flex-col gap-1 text-[14px] text-texto-suave">Repítelo<EntradaCodigo valor={confirmacion} largo={4} onCambio={(v) => { setConfirmacion(v); setAviso(''); }} /></label>
              </div>
              {faltas.length > 0 && (
                <div className="mt-5 max-w-md rounded-sm border-l-4 border-peligro/70 bg-peligro/5 px-3 py-2">
                  <p className="font-titulo text-[15px] font-bold text-peligro">Antes de terminar, falta:</p>
                  <ul className="mt-1 text-[14px]">
                    {faltas.slice(0, 6).map((f) => (
                      <li key={f.falta}><button type="button" className="text-left underline decoration-dotted hover:text-acento" onClick={() => setPaso(f.paso)}>{NOMBRES[f.paso]}: {f.falta}</button></li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {(aviso || error) && <p className="mt-4 font-titulo text-[15px] text-peligro" role="alert">{aviso || error}</p>}
          {faltaDe(paso).length > 0 && paso !== 'codigo' && (
            <p className="mt-4 font-titulo text-[14px] text-texto-suave">Falta: {faltaDe(paso).map((f) => f.falta).join(' · ')}</p>
          )}

          {/* Atrás y Siguiente quedan a la vista abajo, aunque el paso sea largo */}
          <div className="sticky bottom-[60px] z-10 -mx-4 mt-6 flex justify-between gap-2 border-t lg:bottom-0 border-dashed border-borde bg-fondo/95 px-4 py-3 backdrop-blur-sm lg:-mx-8 lg:px-8">
            <button type="button" className="boli flex h-11 items-center gap-2 border-[1.5px] border-borde px-4 font-titulo text-[15px] disabled:opacity-40"
              disabled={i === 0} onClick={() => setPaso(pasos[i - 1]!)}>
              <ArrowLeftIcon size={18} aria-hidden /> Atrás
            </button>
            {paso === 'codigo' ? (
              <button type="button" className="boli flex h-11 items-center gap-2 bg-acento px-5 font-titulo text-[16px] font-bold text-sobre-acento shadow-[0_6px_12px_-6px_var(--acento)]" onClick={terminar}>
                <CheckIcon size={18} weight="bold" aria-hidden /> Crear y entrar
              </button>
            ) : (
              <button type="button" className="boli flex h-11 items-center gap-2 bg-acento px-5 font-titulo text-[16px] font-bold text-sobre-acento shadow-[0_6px_12px_-6px_var(--acento)]"
                onClick={() => setPaso(pasos[i + 1]!)}>
                Siguiente <ArrowRightIcon size={18} aria-hidden />
              </button>
            )}
          </div>
        </main>

        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] overflow-y-auto border-l border-dashed border-borde px-4 py-5 lg:block">
          <FichaEnVivo p={personaje} e={e} />
        </aside>
      </div>

      {/* En el teléfono, la ficha en vivo es una barra que se abre */}
      <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        {fichaAbierta && (
          <div className="max-h-[70vh] overflow-y-auto border-t border-dashed border-borde bg-fondo px-4 pt-3 pb-4 shadow-[0_-12px_30px_-16px_var(--sombra)]">
            <FichaEnVivo p={personaje} e={e} />
          </div>
        )}
        <button type="button" className="flex w-full items-center gap-3 border-t border-borde bg-superficie px-4 py-2.5 pb-[max(env(safe-area-inset-bottom),10px)] font-titulo text-[15px]"
          onClick={() => setFichaAbierta(!fichaAbierta)} aria-expanded={fichaAbierta}>
          <ResumenCorto p={personaje} />
          <CaretUpIcon size={18} className={`ml-auto transition ${fichaAbierta ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      </div>
    </div>
  );
}

function PestanaPaso({ n, nombre, activa, lista, onIr, vertical = false }: { n: number; nombre: string; activa: boolean; lista: boolean; onIr: () => void; vertical?: boolean }) {
  // En la fila del teléfono, el paso activo siempre queda a la vista
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (activa && !vertical) ref.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activa, vertical]);
  return (
    <button ref={ref} type="button" onClick={onIr} aria-current={activa ? 'step' : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-titulo text-[15px] transition ${vertical ? 'w-full' : ''} ${activa ? 'bg-acento/10 font-bold text-acento' : 'text-texto-suave hover:text-texto'}`}>
      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[12px] ${lista ? 'border-exito bg-exito text-white' : activa ? 'border-acento' : 'border-texto-suave/50'}`}>
        {lista ? <CheckIcon size={13} weight="bold" aria-hidden /> : n}
      </span>
      {nombre}
    </button>
  );
}

function ResumenCorto({ p }: { p: Personaje }) {
  const f = calcular(p);
  return (
    <span className="flex items-center gap-3">
      <b>{f.pgMax.total} PG</b><b>CA {f.ca.total}</b><span className="text-texto-suave">Perc {signo(f.percepcion.total)} · {p.velocidad} ft</span>
    </span>
  );
}

// La ficha que se va llenando: lo que importa en la mesa, con la cuenta a la vista
function FichaEnVivo({ p, e }: { p: Personaje; e: Eleccion }) {
  const f = calcular(p);
  const attr = atributosDe(e);
  const entrenadas = HABILIDADES.filter((h) => p.habilidades[h.clave] > 0);
  return (
    <div className="hoja flex flex-col gap-3 px-4 py-4">
      <div>
        <p className="font-titulo text-[13px] text-texto-suave">Así va tu ficha</p>
        <h3 className="truncate font-titulo text-[22px] leading-tight font-bold text-acento">{p.nombre}</h3>
        <p className="font-titulo text-[13.5px] text-texto-suave">{[p.ascendencia, p.clase].filter(Boolean).join(' · ') || 'Elige ascendencia y clase'} · nivel 1</p>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center font-titulo">
        <Dato etiqueta="PG" valor={String(f.pgMax.total)} />
        <Dato etiqueta="CA" valor={String(f.ca.total)} />
        <Dato etiqueta="Vel" valor={`${p.velocidad}`} />
        <Dato etiqueta="Perc" valor={signo(f.percepcion.total)} />
        <Dato etiqueta="Fort" valor={signo(f.salvaciones.fortitude.total)} />
        <Dato etiqueta="Ref" valor={signo(f.salvaciones.reflex.total)} />
        <Dato etiqueta="Will" valor={signo(f.salvaciones.will.total)} />
        {f.conjuros && <Dato etiqueta="CD conj." valor={String(f.conjuros.cd.total)} />}
        {f.claseCD && <Dato etiqueta="CD clase" valor={String(f.claseCD.total)} />}
      </div>
      <div className="grid grid-cols-6 gap-0.5 text-center font-titulo">
        {(Object.keys(ATRIBUTOS) as Atributo[]).map((a) => (
          <div key={a}>
            <span className="block text-[11px] text-texto-suave">{ATRIBUTOS[a].abrev}</span>
            <b className={`text-[16px] ${attr[a] > 0 ? 'text-acento' : attr[a] < 0 ? 'text-peligro' : ''}`}>{signo(attr[a])}</b>
          </div>
        ))}
      </div>
      {p.golpes.length > 0 && (
        <div>
          <p className="font-titulo text-[13px] text-texto-suave">Ataques</p>
          {p.golpes.map((g, i) => (
            <p key={g.id} className="flex justify-between gap-2 font-titulo text-[14.5px]">
              <span className="truncate">{g.nombre}</span>
              <span><b className="text-acento">{signo(f.golpes[i]!.ataque.total)}</b> · {f.golpes[i]!.dano}</span>
            </p>
          ))}
        </div>
      )}
      {entrenadas.length > 0 && (
        <div>
          <p className="font-titulo text-[13px] text-texto-suave">Skills en Trained</p>
          <p className="text-[13.5px] leading-snug">{entrenadas.map((h) => `${h.nombre} ${signo(f.habilidades[h.clave].total)}`).join(' · ')}</p>
        </div>
      )}
      {(p.aptitudes?.length ?? 0) > 0 && (
        <div>
          <p className="font-titulo text-[13px] text-texto-suave">Para usar en la mesa</p>
          <p className="text-[13.5px] leading-snug">{p.aptitudes!.map((a) => a.verbo || a.nombre).join(' · ')}</p>
        </div>
      )}
      {p.sentidos && <p className="text-[13px] text-texto-suave">Sentidos: {p.sentidos} · Idiomas: {p.idiomas?.join(', ')}</p>}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-sm py-0.5">
      <span className="block text-[11.5px] text-texto-suave">{etiqueta}</span>
      <b className="text-[19px] leading-none">{valor}</b>
    </div>
  );
}

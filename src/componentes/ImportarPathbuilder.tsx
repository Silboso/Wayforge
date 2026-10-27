import { useState } from 'react';
import { ArrowLeftIcon, CheckIcon, FileArrowUpIcon, PencilSimpleLineIcon, WarningIcon, XIcon } from '@phosphor-icons/react';
import { buscadorDe, desdePathbuilder, leerPathbuilder, type Importado } from '../../reglas/pathbuilder';
import { calcular, signo, type Personaje } from '../../reglas/pf2e';
import { entradaDe, indiceDe } from '../compendio';
import { EntradaCodigo } from './EditorFicha';
import { claseBotonPrincipal, claseBotonSecundario } from './ui';

const buscar = buscadorDe(indiceDe, entradaDe);

// Traer un personaje hecho en Pathbuilder 2e: se pega el JSON (o se sube el archivo), se ve cómo queda y se le pone código
export function ImportarPathbuilder({ id, error, onGuardar, onRevisar, onCancelar }: {
  id: string;
  error?: string | null;
  onGuardar: (p: Personaje, codigo: string) => void;
  // Abrir la ficha importada en el editor a mano, para corregir algo antes de guardarla
  onRevisar: (p: Personaje) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [hecho, setHecho] = useState<Importado | null>(null);
  const [codigo, setCodigo] = useState('');
  const [confirmacion, setConfirmacion] = useState('');

  async function importar(contenido: string) {
    setAviso('');
    const build = leerPathbuilder(contenido);
    if (!build) return setAviso('Eso no parece el JSON de Pathbuilder. Copia todo lo que aparece al exportar, desde la primera llave { hasta la última }.');
    setLeyendo(true);
    try {
      setHecho(await desdePathbuilder(build, id, buscar));
    } catch {
      setAviso('No se pudo leer el compendio. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setLeyendo(false);
    }
  }

  async function subir(archivo: File | null) {
    if (!archivo) return;
    if (archivo.size > 2_000_000) return setAviso('Ese archivo es demasiado grande para ser una ficha de Pathbuilder.');
    const contenido = await archivo.text();
    setTexto(contenido);
    void importar(contenido);
  }

  function guardar() {
    if (!hecho) return;
    if (!/^\d{4}$/.test(codigo)) return setAviso('El código son 4 números');
    if (codigo !== confirmacion) return setAviso('Los dos códigos no coinciden');
    onGuardar(hecho.personaje, codigo);
  }

  return (
    <div className="flex min-h-full flex-col bg-fondo">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-dashed border-borde bg-fondo/95 px-4 py-2.5 backdrop-blur-sm lg:px-6">
        <FileArrowUpIcon size={22} className="text-acento" aria-hidden />
        <h1 className="font-titulo text-[21px] font-bold">Importar de Pathbuilder 2e</h1>
        <button type="button" className="ml-auto flex size-10 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={onCancelar} aria-label="Cancelar">
          <XIcon size={20} aria-hidden />
        </button>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16">
        {!hecho ? (
          <>
            <ol className="mb-4 flex flex-col gap-1.5 text-[15px]">
              <li><b>1.</b> En Pathbuilder abre tu personaje, el menú de arriba a la derecha y <b>Export JSON</b>.</li>
              <li><b>2.</b> Abre el enlace que te da (termina en <span className="font-mono text-[13px]">json.php?id=…</span>) y copia todo el texto.</li>
              <li><b>3.</b> Pégalo aquí abajo, o sube el archivo si lo guardaste.</li>
            </ol>
            <textarea
              className="h-56 w-full rounded-lg border border-borde bg-superficie p-3 font-mono text-[12px] text-texto placeholder:text-texto-suave/70"
              placeholder='{"success":true,"build":{"name":"…'
              value={texto}
              onChange={(e) => { setTexto(e.target.value); setAviso(''); }}
              aria-label="JSON de Pathbuilder"
            />
            {aviso && <p className="mt-2 text-sm text-peligro">{aviso}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className={claseBotonPrincipal} disabled={!texto.trim() || leyendo} onClick={() => importar(texto)}>
                {leyendo ? 'Buscando dotes y conjuros…' : 'Importar'}
              </button>
              <label className={`${claseBotonSecundario} cursor-pointer`}>
                <FileArrowUpIcon size={16} aria-hidden /> Subir archivo .json
                <input type="file" accept=".json,.txt,application/json" className="sr-only" onChange={(e) => subir(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </>
        ) : (
          <Vista hecho={hecho} />
        )}

        {hecho && (
          <section className="mt-6 border-t border-dashed border-borde pt-5">
            <h2 className="font-titulo text-[20px] font-bold">Tu código</h2>
            <p className="mb-3 text-[14px] text-texto-suave">Cuatro números que te pediremos cada vez que entres a la mesa con este personaje.</p>
            <div className="grid max-w-md gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[14px] text-texto-suave">Código<EntradaCodigo valor={codigo} largo={4} onCambio={(v) => { setCodigo(v); setAviso(''); }} /></label>
              <label className="flex flex-col gap-1 text-[14px] text-texto-suave">Repítelo<EntradaCodigo valor={confirmacion} largo={4} onCambio={(v) => { setConfirmacion(v); setAviso(''); }} /></label>
            </div>
            {(aviso || error) && <p className="mt-2 text-sm text-peligro">{aviso || error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={claseBotonPrincipal} onClick={guardar}><CheckIcon size={18} weight="bold" aria-hidden /> Guardar personaje</button>
              <button className={claseBotonSecundario} onClick={() => onRevisar(hecho.personaje)}><PencilSimpleLineIcon size={16} aria-hidden /> Revisar a mano antes</button>
              <button className={claseBotonSecundario} onClick={() => { setHecho(null); setAviso(''); }}><ArrowLeftIcon size={16} aria-hidden /> Otro JSON</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

// Cómo quedó: lo esencial de la ficha, y lo que conviene revisar
function Vista({ hecho: { personaje: p, avisos, sinEncontrar } }: { hecho: Importado }) {
  const ficha = calcular(p);
  const aptitudes = p.aptitudes ?? [];
  const conjuros = aptitudes.filter((a) => a.categoria === 'conjuro' || a.categoria === 'truco' || a.categoria === 'foco');
  const acciones = aptitudes.filter((a) => !conjuros.includes(a));
  const numeros: [string, string][] = [
    ['PG', String(ficha.pgMax.total)], ['CA', String(ficha.ca.total)], ['Perception', signo(ficha.percepcion.total)],
    ['Fortitude', signo(ficha.salvaciones.fortitude.total)], ['Reflex', signo(ficha.salvaciones.reflex.total)], ['Will', signo(ficha.salvaciones.will.total)],
    ['Velocidad', `${p.velocidad} ft`],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-titulo text-[28px] font-bold leading-tight">{p.nombre}</h2>
        <p className="font-titulo text-[16px] text-texto-suave">{p.ascendencia} · {p.clase} · nivel {p.nivel}{p.sentidos ? ` · ${p.sentidos}` : ''}</p>
      </div>
      <dl className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {numeros.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-borde bg-superficie px-2 py-1.5 text-center">
            <dt className="text-[11px] text-texto-suave">{k}</dt>
            <dd className="font-titulo text-[20px] font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      {p.golpes.length > 0 && (
        <ul className="flex flex-col gap-1 text-[14px]">
          {p.golpes.map((g, i) => (
            <li key={g.id}><b className="font-titulo">{g.nombre}</b> {signo(ficha.golpes[i]!.ataque.total)} · {ficha.golpes[i]!.dano}</li>
          ))}
        </ul>
      )}
      <p className="text-[14px] text-texto-suave">
        {p.dotes?.length ?? 0} dotes · {acciones.length} acciones y reacciones · {conjuros.length} conjuros · {p.inventario?.length ?? 0} objetos
        {p.lanzador ? ` · lanza ${p.lanzador.tradicion}` : ''}
      </p>
      {avisos.length > 0 && (
        <div className="rounded-lg border-2 border-[#c48a16]/50 bg-[#c48a16]/8 p-3">
          <p className="mb-1 flex items-center gap-1.5 font-titulo text-[15px] font-semibold"><WarningIcon size={17} aria-hidden /> Para revisar</p>
          <ul className="list-disc pl-5 text-[14px]">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      {sinEncontrar.length > 0 && (
        <p className="text-[13px] text-texto-suave">No están en el compendio (quedan anotadas, sin botón en la mesa): {sinEncontrar.join(', ')}.</p>
      )}
    </div>
  );
}

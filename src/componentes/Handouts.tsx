import { useEffect, useRef, useState } from 'react';
import { EyeIcon, EyeSlashIcon, PencilSimpleIcon, ScrollIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import type { Accion, EstadoSala, Handout } from '../../compartido/sala';
import type { Evento } from '../../compartido/eventos';
import { subirImagen } from '../imagenes';
import { Modal } from './hud/Modal';
import { claseBotonPrincipal, claseBotonSecundario, claseEntrada, ElegirImagen, Seccion } from './ui';

// Handouts: lo que el GM prepara (una carta, un mapa, el retrato de un PNJ) y muestra a todos o a algunos.
// Al jugador solo le llega lo que le mostraron; cuando el GM se lo muestra, se le abre en la pantalla.

const aQuien = (h: Handout, estado: EstadoSala) => h.para === 'nadie' ? 'Sin mostrar'
  : h.para === 'todos' ? 'Lo ven todos'
  : `Lo ve ${h.para.map((id) => estado.personajes[id]?.nombre ?? '¿?').join(', ')}`;

// El panel del GM: la lista, a quién se muestra cada uno, y el formulario para crear o editar
export function SeccionHandouts({ salaId, estado, enviar }: { salaId: string; estado: EstadoSala; enviar: (a: Accion) => void }) {
  const handouts = estado.handouts ?? [];
  const personajes = Object.values(estado.personajes);
  const [editando, setEditando] = useState<Pick<Handout, 'id' | 'titulo' | 'texto' | 'imagen'> | null>(null);
  const [viendo, setViendo] = useState<Handout | null>(null);
  const mostrar = (h: Handout, para: Handout['para']) => enviar({ tipo: 'mostrar-handout', id: h.id, para, cuando: Date.now() });
  // A uno: lo suma a los que ya lo ven (o lo saca si ya lo veía)
  const alternar = (h: Handout, id: string) => {
    const actuales = Array.isArray(h.para) ? h.para : [];
    const nuevos = actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id];
    mostrar(h, nuevos.length ? nuevos : 'nadie');
  };
  return (
    <Seccion titulo="Handouts" accion={
      <button className="font-titulo text-[14px] font-semibold text-acento hover:underline" onClick={() => setEditando({ id: crypto.randomUUID(), titulo: '', texto: '' })}>+ Nuevo</button>
    }>
      {handouts.length === 0 && <p className="text-sm text-texto-suave">Cartas, mapas, retratos: prepáralos y muéstralos cuando llegue el momento, a todos o a uno.</p>}
      <ul className="flex flex-col gap-2">
        {handouts.map((h) => (
          <li key={h.id} className="rounded-lg border border-borde bg-superficie p-2.5">
            <div className="flex items-start gap-2">
              {h.imagen ? <img src={h.imagen} alt="" className="size-11 shrink-0 rounded object-cover" /> : <ScrollIcon size={26} className="mt-1 shrink-0 text-texto-suave" aria-hidden />}
              <button className="min-w-0 flex-1 text-left" onClick={() => setViendo(h)} title="Verlo como lo ven ellos">
                <span className="block truncate font-titulo text-[16px] font-bold">{h.titulo}</span>
                <span className={`block text-[12.5px] ${h.para === 'nadie' ? 'text-texto-suave' : 'text-exito'}`}>{aQuien(h, estado)}</span>
              </button>
              <button className="flex size-8 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-2" onClick={() => setEditando(h)} aria-label={`Editar ${h.titulo}`}><PencilSimpleIcon size={16} /></button>
              <button className="flex size-8 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-2 hover:text-peligro" onClick={() => enviar({ tipo: 'borrar-handout', id: h.id })} aria-label={`Borrar ${h.titulo}`}><TrashIcon size={16} /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button className={`rounded-md border px-2 py-1 font-titulo text-[13px] ${h.para === 'todos' ? 'border-acento bg-acento text-sobre-acento' : 'border-borde hover:border-acento'}`}
                onClick={() => mostrar(h, 'todos')} title={h.para === 'todos' ? 'Volver a abrírselo a todos' : 'Mostrárselo a todos'}>
                <EyeIcon size={14} className="mr-1 inline" aria-hidden />A todos
              </button>
              {personajes.map((p) => {
                const ve = Array.isArray(h.para) && h.para.includes(p.id);
                return (
                  <button key={p.id} className={`rounded-md border px-2 py-1 font-titulo text-[13px] ${ve ? 'border-acento bg-acento/15 font-semibold text-acento' : 'border-borde hover:border-acento'}`}
                    onClick={() => alternar(h, p.id)} aria-pressed={ve} title={ve ? `Ocultárselo a ${p.nombre}` : `Mostrárselo solo a ${p.nombre}`}>
                    {p.nombre}
                  </button>
                );
              })}
              {h.para !== 'nadie' && (
                <button className="rounded-md border border-borde px-2 py-1 font-titulo text-[13px] text-texto-suave hover:border-peligro hover:text-peligro" onClick={() => mostrar(h, 'nadie')}>
                  <EyeSlashIcon size={14} className="mr-1 inline" aria-hidden />Ocultar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editando && <EditorHandout salaId={salaId} inicial={editando} onCerrar={() => setEditando(null)} onGuardar={(h) => { enviar({ tipo: 'guardar-handout', handout: h }); setEditando(null); }} />}
      {viendo && <VerHandout h={viendo} onCerrar={() => setViendo(null)} />}
    </Seccion>
  );
}

function EditorHandout({ salaId, inicial, onGuardar, onCerrar }: {
  salaId: string;
  inicial: Pick<Handout, 'id' | 'titulo' | 'texto' | 'imagen'>;
  onGuardar: (h: Pick<Handout, 'id' | 'titulo' | 'texto' | 'imagen'>) => void;
  onCerrar: () => void;
}) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [texto, setTexto] = useState(inicial.texto);
  const [imagen, setImagen] = useState(inicial.imagen ?? '');
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  async function subir(archivo: File | null) {
    if (!archivo) return;
    setSubiendo(true);
    setAviso('');
    try { setImagen(await subirImagen(salaId, archivo)); } catch (e) { setAviso(e instanceof Error ? e.message : 'No se pudo subir la imagen'); } finally { setSubiendo(false); }
  }
  return (
    <Modal titulo={inicial.titulo ? 'Editar handout' : 'Nuevo handout'} subtitulo="Nadie lo ve hasta que lo muestres." onCerrar={onCerrar} ancho="max-w-lg">
      <form className="flex flex-col gap-3" onSubmit={(e) => {
        e.preventDefault();
        if (!titulo.trim()) return setAviso('Ponle un título');
        onGuardar({ id: inicial.id, titulo: titulo.trim(), texto, ...(imagen ? { imagen } : {}) });
      }}>
        <label className="flex flex-col gap-1 text-sm text-texto-suave">Título
          <input className={claseEntrada} value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder="La carta del alcalde" autoFocus />
        </label>
        <label className="flex flex-col gap-1 text-sm text-texto-suave">Texto
          <textarea className="min-h-[150px] w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-texto" value={texto} maxLength={4000}
            onChange={(e) => setTexto(e.target.value)} placeholder="Lo que dice la carta, lo que se lee en la lápida…" />
        </label>
        <div className="flex items-center gap-2">
          <ElegirImagen etiqueta={subiendo ? 'Subiendo…' : imagen ? 'Cambiar la imagen' : 'Agregar una imagen'} onArchivo={subir} />
          {imagen && <button type="button" className={claseBotonSecundario} onClick={() => setImagen('')}><XIcon size={14} aria-hidden /> Quitar</button>}
        </div>
        {imagen && <img src={imagen} alt="" className="max-h-48 w-full rounded-lg object-contain" />}
        {aviso && <p className="text-sm text-peligro">{aviso}</p>}
        <button className={claseBotonPrincipal} disabled={subiendo}>Guardar</button>
      </form>
    </Modal>
  );
}

// El handout abierto, como hoja de papel: la imagen grande y el texto debajo
export function VerHandout({ h, onCerrar }: { h: Handout; onCerrar: () => void }) {
  return (
    <Modal titulo={h.titulo} onCerrar={onCerrar} ancho="max-w-2xl">
      {h.imagen && <img src={h.imagen} alt={h.titulo} className="mb-3 max-h-[60vh] w-full rounded-lg object-contain" />}
      {h.texto && <p className="font-titulo text-[17px] leading-relaxed whitespace-pre-line">{h.texto}</p>}
    </Modal>
  );
}

// Lo que el GM le mostró a este jugador (para volver a verlo cuando quiera)
export function ListaHandouts({ estado }: { estado: EstadoSala }) {
  const [viendo, setViendo] = useState<Handout | null>(null);
  const handouts = [...(estado.handouts ?? [])].sort((a, b) => b.cuando - a.cuando);
  if (!handouts.length) return null;
  return (
    <section>
      <h3 className="mb-1 font-titulo text-[17px] font-bold">Lo que te mostró el GM</h3>
      <ul className="flex flex-col">
        {handouts.map((h) => (
          <li key={h.id}>
            <button className="flex w-full items-center gap-2.5 border-b border-dashed border-borde py-2 text-left hover:text-acento" onClick={() => setViendo(h)}>
              {h.imagen ? <img src={h.imagen} alt="" className="size-10 shrink-0 rounded object-cover" /> : <ScrollIcon size={24} className="shrink-0 text-texto-suave" aria-hidden />}
              <span className="min-w-0 flex-1 truncate font-titulo text-[15.5px] font-semibold">{h.titulo}</span>
            </button>
          </li>
        ))}
      </ul>
      {viendo && <VerHandout h={viendo} onCerrar={() => setViendo(null)} />}
    </section>
  );
}

// Cuando el GM muestra un handout a este jugador, se le abre solo
export function HandoutRecibido({ estado, eventos }: { estado: EstadoSala; eventos: { id: number; evento: Evento }[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const visto = useRef(eventos.at(-1)?.id ?? 0);
  useEffect(() => {
    const nuevos = eventos.filter((e) => e.id > visto.current);
    if (!nuevos.length) return;
    visto.current = nuevos.at(-1)!.id;
    const ultimo = nuevos.findLast((e) => e.evento.tipo === 'handout');
    if (ultimo?.evento.tipo === 'handout') setAbierto(ultimo.evento.id);
  }, [eventos]);
  const h = abierto ? (estado.handouts ?? []).find((x) => x.id === abierto) : undefined;
  if (!h) return null;
  return <VerHandout h={h} onCerrar={() => setAbierto(null)} />;
}

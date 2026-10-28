import { useState, type ReactNode } from 'react';
import { CopyIcon, DownloadSimpleIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { descargarMesa } from '../campanas';
import { COLORES_TOKEN, TAMANOS, casillaLibre, type Accion, type EstadoSala, type MesaExportada, type Tamano, type Terreno, type TipoToken, type Token } from '../../compartido/sala';
import { TERRENOS } from './Terreno';
import { ElegirLuz } from './Luz';
import { SeccionTiempo } from './Descanso';
import { SeccionHandouts } from './Handouts';
import { subirImagen } from '../imagenes';
import { EditorCondiciones } from './Condiciones';
import {
  Campo, claseBotonIcono, claseBotonPrincipal, claseBotonSecundario, claseEntrada, Deslizador, ElegirImagen, Seccion,
} from './ui';

interface Props {
  salaId: string;
  codigoGM: string | null;
  estado: EstadoSala;
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
  enviar: (accion: Accion) => void;
  // Abre el editor de la ficha de un personaje (desde su token)
  onEditarPersonaje?: (personajeId: string) => void;
  // Muros y niebla: la sección la arma la mesa del GM (necesita el editor del tablero)
  murosNiebla?: ReactNode;
  // Escenas: van primero
  escenas?: ReactNode;
  // Pide a la sala la mesa entera (para el archivo de la campaña)
  onExportar?: () => Promise<MesaExportada>;
}

const TIPOS: { valor: TipoToken; etiqueta: string }[] = [
  { valor: 'personaje', etiqueta: 'Personaje' },
  { valor: 'enemigo', etiqueta: 'Enemigo' },
  { valor: 'npc', etiqueta: 'NPC' },
];

// Herramientas del GM: tokens, mapa y códigos de la mesa
export function HerramientasGM({ salaId, codigoGM, estado, seleccionado, onSeleccionar, enviar, onEditarPersonaje, murosNiebla, escenas, onExportar }: Props) {
  const token = seleccionado ? estado.tokens[seleccionado] : undefined;
  const [aMano, setAMano] = useState(false);
  // Atajos a cada parte: el panel es largo y así no hay que bajar buscando
  const partes: [string, string][] = [['escenas', 'Escenas'], ['handouts', 'Handouts'], ['tiempo', 'Tiempo'], ['mapa', 'Mapa'], ['niebla', 'Niebla y luz'], ['campana', 'Campaña']];
  const ir = (id: string) => document.getElementById(`mesa-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Partes de la mesa" className="sticky -top-4 z-10 -mx-4 -mt-4 flex flex-wrap gap-1.5 border-b border-dashed border-borde bg-fondo px-4 py-2.5">
        {partes.map(([id, nombre]) => (
          <button key={id} onClick={() => ir(id)} className="rounded-full border border-borde px-2.5 py-1 font-titulo text-[13px] hover:border-acento hover:text-acento">{nombre}</button>
        ))}
      </nav>
      <div id="mesa-escenas" className="scroll-mt-14">{escenas}</div>
      {token ? (
        <EditorToken key={token.id} salaId={salaId} token={token} enviar={enviar} onCerrar={() => onSeleccionar(null)}
          onEditarPersonaje={token.personajeId && onEditarPersonaje ? () => onEditarPersonaje(token.personajeId!) : undefined} />
      ) : aMano ? (
        <NuevoToken salaId={salaId} estado={estado} enviar={enviar} onCreado={(id) => { onSeleccionar(id); setAMano(false); }} />
      ) : (
        <button className={claseBotonSecundario} onClick={() => setAMano(true)} title="Las criaturas con su ficha completa se ponen desde el Compendio">
          <PlusIcon size={16} aria-hidden /> Poner un token a mano
        </button>
      )}
      <div id="mesa-handouts" className="scroll-mt-14"><SeccionHandouts salaId={salaId} estado={estado} enviar={enviar} /></div>
      <div id="mesa-tiempo" className="scroll-mt-14"><SeccionTiempo estado={estado} enviar={enviar} /></div>
      <div id="mesa-mapa" className="scroll-mt-14"><EditorMapa salaId={salaId} estado={estado} enviar={enviar} /></div>
      <div id="mesa-niebla" className="scroll-mt-14">{murosNiebla}</div>
      <div id="mesa-campana" className="scroll-mt-14 flex flex-col gap-4">
        <Campana estado={estado} enviar={enviar} {...(onExportar ? { onExportar } : {})} />
        <Codigos salaId={salaId} codigoGM={codigoGM} />
      </div>
    </div>
  );
}

// La campaña: el nombre de la mesa (sale en la lista de mesas) y guardarla entera en un archivo
function Campana({ estado, enviar, onExportar }: { estado: EstadoSala; enviar: (accion: Accion) => void; onExportar?: () => Promise<MesaExportada> }) {
  const [nombre, setNombre] = useState(estado.nombre ?? '');
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function exportar() {
    if (!onExportar) return;
    setError('');
    setProgreso('Preparando…');
    try {
      await descargarMesa(await onExportar(), (n, total) => setProgreso(`Juntando imágenes ${n + 1} de ${total}…`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setProgreso(null);
    }
  }
  return (
    <Seccion titulo="Campaña">
      <label className="flex flex-col gap-1 text-sm text-texto-suave">Nombre de la mesa
        <input className={claseEntrada} value={nombre} maxLength={60} placeholder="La maldición del molino"
          onChange={(e) => setNombre(e.target.value)} onBlur={() => { if (nombre.trim() !== (estado.nombre ?? '')) enviar({ tipo: 'nombrar-mesa', nombre: nombre.trim() }); }} />
      </label>
      <p className="text-sm text-texto-suave">Exporta la mesa a un archivo (escenas, personajes con sus códigos, handouts e imágenes) para guardarla o abrirla en otra mesa desde la página de inicio.</p>
      <button className={claseBotonSecundario} disabled={!!progreso || !onExportar} onClick={exportar}>
        <DownloadSimpleIcon size={18} aria-hidden /> {progreso ?? 'Exportar la mesa'}
      </button>
      {error && <p className="text-sm text-peligro">{error}</p>}
    </Seccion>
  );
}

function Codigos({ salaId, codigoGM }: { salaId: string; codigoGM: string | null }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Seccion titulo="Códigos">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm text-texto-suave">Código de la mesa</div>
          <div className="font-mono text-2xl font-bold tracking-widest">{salaId.toUpperCase()}</div>
        </div>
        <button className={claseBotonSecundario} onClick={async () => {
          await navigator.clipboard.writeText(`${location.origin}/sala/${salaId}`);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        }}>
          <CopyIcon size={18} aria-hidden /> {copiado ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
      <p className="text-sm text-texto-suave">Dáselo a tus jugadores: con él entran, eligen su personaje y escriben su código.</p>
      {codigoGM && (
        <div className="rounded-lg bg-superficie-2 p-3">
          <div className="text-sm text-texto-suave">Tu código de GM</div>
          <div className="font-mono text-2xl font-bold tracking-widest">{codigoGM}</div>
          <p className="text-xs text-texto-suave">Guárdalo: lo necesitas para volver a entrar como GM si sales o cambias de dispositivo.</p>
        </div>
      )}
    </Seccion>
  );
}

function NuevoToken({ salaId, estado, enviar, onCreado }: {
  salaId: string;
  estado: EstadoSala;
  enviar: (accion: Accion) => void;
  onCreado: (id: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoToken>('enemigo');
  const [tamano, setTamano] = useState<Tamano>('Medium');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');

  async function agregar() {
    if (!nombre.trim()) {
      setError('Ponle un nombre al token');
      return;
    }
    setSubiendo(true);
    setError('');
    try {
      const imagen = archivo ? await subirImagen(salaId, archivo) : undefined;
      const nuevo: Token = {
        id: crypto.randomUUID(),
        nombre: nombre.trim(),
        tipo,
        tamano,
        ...casillaLibre(estado),
        color: COLORES_TOKEN[tipo],
        ...(imagen ? { imagen } : {}),
      };
      enviar({ tipo: 'crear-token', token: nuevo });
      setNombre('');
      setArchivo(null);
      onCreado(nuevo.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <Seccion titulo="Agregar enemigo o NPC">
      <Campo etiqueta="Nombre">
        {(id) => (
          <input id={id} className={claseEntrada} value={nombre} placeholder="Goblin arquero" maxLength={60}
            onChange={(e) => { setNombre(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && agregar()} />
        )}
      </Campo>
      <SelectorTipo valor={tipo} onCambio={setTipo} />
      <SelectorTamano valor={tamano} onCambio={setTamano} />
      <ElegirImagen etiqueta={archivo ? archivo.name : 'Imagen (opcional)'} onArchivo={setArchivo} />
      {error && <p className="text-sm text-peligro">{error}</p>}
      <button className={claseBotonPrincipal} onClick={agregar} disabled={subiendo}>
        <PlusIcon size={18} weight="bold" aria-hidden />
        {subiendo ? 'Subiendo imagen…' : 'Agregar al tablero'}
      </button>
    </Seccion>
  );
}

function EditorToken({ salaId, token, enviar, onCerrar, onEditarPersonaje }: {
  salaId: string;
  token: Token;
  enviar: (accion: Accion) => void;
  onCerrar: () => void;
  onEditarPersonaje?: () => void;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const editar = (cambios: Partial<Omit<Token, 'id' | 'personajeId'>>) => enviar({ tipo: 'editar-token', id: token.id, cambios });
  // El nombre y la imagen de un personaje jugador se cambian desde su ficha
  const dePersonaje = !!token.personajeId;

  async function cambiarImagen(archivo: File | null) {
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    try {
      editar({ imagen: await subirImagen(salaId, archivo) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <Seccion
      titulo={token.nombre}
      accion={
        <button className={claseBotonIcono} onClick={onCerrar} aria-label="Cerrar">
          <XIcon size={18} aria-hidden />
        </button>
      }
    >
      {dePersonaje ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto-suave">Es el token de un personaje: su nombre y su imagen salen de la ficha.</p>
          {onEditarPersonaje && <button className={claseBotonSecundario} onClick={onEditarPersonaje}>Editar ficha y retrato</button>}
        </div>
      ) : (
        <>
          <Campo etiqueta="Nombre">
            {(id) => (
              <input id={id} className={claseEntrada} defaultValue={token.nombre} maxLength={60}
                onBlur={(e) => e.target.value.trim() && e.target.value !== token.nombre && editar({ nombre: e.target.value.trim() })}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            )}
          </Campo>
          <SelectorTipo valor={token.tipo} onCambio={(tipo) => editar({ tipo, color: COLORES_TOKEN[tipo] })} />
        </>
      )}
      <SelectorTamano valor={token.tamano} onCambio={(tamano) => editar({ tamano })} />
      <Campo etiqueta="Color del borde">
        {(id) => (
          <input id={id} type="color" className="h-10 w-full cursor-pointer rounded-lg border border-borde bg-superficie"
            value={token.color} onChange={(e) => editar({ color: e.target.value })} />
        )}
      </Campo>
      {!dePersonaje && (
        <div className="grid grid-cols-2 gap-3">
          <CampoNumero etiqueta="CA" valor={token.ca} min={0} max={80} onCambio={(ca) => editar({ ca })} />
          <CampoNumero etiqueta="Perception" ayuda="Para la iniciativa" valor={token.percepcion} min={-10} max={60}
            onCambio={(percepcion) => editar({ percepcion })} />
          <CampoNumero etiqueta="PG actuales" valor={token.pg?.actual} min={0} max={9999}
            onCambio={(actual) => editar({ pg: { actual, max: Math.max(1, token.pg?.max ?? actual) } })} />
          <CampoNumero etiqueta="PG máximos" valor={token.pg?.max} min={1} max={9999}
            onCambio={(max) => editar({ pg: { max, actual: Math.min(token.pg?.actual ?? max, max) } })} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-sm text-texto-suave">Luz que lleva</span>
        <ElegirLuz luz={token.luz} onCambiar={(luz) => enviar({ tipo: 'llevar-luz', tokenId: token.id, ...(luz ? { luz } : {}) })} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-texto-suave">Condiciones</span>
        <EditorCondiciones condiciones={token.condiciones ?? []} puedeEditar
          onPoner={(clave, valor) => enviar({ tipo: 'poner-condicion', tokenId: token.id, clave, valor })} />
      </div>
      {!dePersonaje && (
        <div className="flex gap-2">
          <ElegirImagen etiqueta={subiendo ? 'Subiendo…' : token.imagen ? 'Cambiar imagen' : 'Poner imagen'} onArchivo={cambiarImagen} />
          {token.imagen && <button className={claseBotonSecundario} onClick={() => editar({ imagen: '' })}>Quitar</button>}
        </div>
      )}
      {error && <p className="text-sm text-peligro">{error}</p>}
      {!dePersonaje && (
        <button className={`${claseBotonSecundario} text-peligro`} onClick={() => { enviar({ tipo: 'borrar-token', id: token.id }); onCerrar(); }}>
          <TrashIcon size={18} aria-hidden /> Quitar del tablero
        </button>
      )}
    </Seccion>
  );
}

function EditorMapa({ salaId, estado, enviar }: {
  salaId: string;
  estado: EstadoSala;
  enviar: (accion: Accion) => void;
}) {
  const { mapa } = estado;
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const editar = (cambios: Partial<typeof mapa>) => enviar({ tipo: 'editar-mapa', cambios });

  async function cambiarImagen(archivo: File | null) {
    if (!archivo) return;
    setSubiendo(true);
    setError('');
    try {
      editar({ imagen: await subirImagen(salaId, archivo, 'mapa') });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <Seccion titulo="Mapa">
      <div className="flex gap-2">
        <ElegirImagen etiqueta={subiendo ? 'Subiendo…' : mapa.imagen ? 'Cambiar mapa' : 'Subir imagen de mapa'} onArchivo={cambiarImagen} />
        {mapa.imagen && <button className={claseBotonSecundario} onClick={() => editar({ imagen: '' })}>Quitar</button>}
      </div>
      {error && <p className="text-sm text-peligro">{error}</p>}
      <Deslizador etiqueta="Tamaño de casilla" valor={mapa.tamanoCelda} min={20} max={200} unidad="px"
        onCambio={(tamanoCelda) => editar({ tamanoCelda })} />
      <Deslizador etiqueta="Mover cuadrícula →" valor={mapa.desplazamientoX} min={0} max={mapa.tamanoCelda - 1} unidad="px"
        onCambio={(desplazamientoX) => editar({ desplazamientoX })} />
      <Deslizador etiqueta="Mover cuadrícula ↓" valor={mapa.desplazamientoY} min={0} max={mapa.tamanoCelda - 1} unidad="px"
        onCambio={(desplazamientoY) => editar({ desplazamientoY })} />
      {!mapa.imagen && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Terreno de fondo</span>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Terreno de fondo">
              {(Object.keys(TERRENOS) as Terreno[]).map((t) => {
                const activo = (mapa.terreno ?? 'claro') === t;
                return (
                  <button key={t} role="radio" aria-checked={activo} title={TERRENOS[t].ayuda} onClick={() => editar({ terreno: t })}
                    className={`rounded-lg border-2 px-2 py-1.5 text-left text-xs transition ${activo ? 'border-acento bg-acento/10 font-semibold' : 'border-borde hover:bg-superficie-2'}`}>
                    {TERRENOS[t].nombre}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-texto-suave">Es solo dibujo: no bloquea ni cuesta movimiento. Si subes una imagen de mapa, se usa la imagen.</p>
          </div>
          <Deslizador etiqueta="Columnas" valor={mapa.columnas} min={4} max={80} onCambio={(columnas) => editar({ columnas })} />
          <Deslizador etiqueta="Filas" valor={mapa.filas} min={4} max={80} onCambio={(filas) => editar({ filas })} />
        </>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-acento" checked={mapa.mostrarCuadricula}
          onChange={(e) => editar({ mostrarCuadricula: e.target.checked })} />
        Mostrar cuadrícula
      </label>
    </Seccion>
  );
}

function SelectorTipo({ valor, onCambio }: { valor: TipoToken; onCambio: (tipo: TipoToken) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-texto-suave">Tipo</span>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-borde bg-superficie-2 p-1" role="radiogroup">
        {TIPOS.map((t) => (
          <button key={t.valor} role="radio" aria-checked={valor === t.valor}
            className={`h-8 rounded-md text-sm transition ${valor === t.valor ? 'bg-superficie font-medium shadow-sm' : 'text-texto-suave'}`}
            onClick={() => onCambio(t.valor)}>
            {t.etiqueta}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectorTamano({ valor, onCambio }: { valor: Tamano; onCambio: (tamano: Tamano) => void }) {
  return (
    <Campo etiqueta="Tamaño">
      {(id) => (
        <select id={id} className={claseEntrada} value={valor} onChange={(e) => onCambio(e.target.value as Tamano)}>
          {(Object.keys(TAMANOS) as Tamano[]).map((t) => (
            <option key={t} value={t}>
              {t} · {TAMANOS[t] < 1 ? '½ casilla' : `${TAMANOS[t]}×${TAMANOS[t]}`}
            </option>
          ))}
        </select>
      )}
    </Campo>
  );
}

// Número que se guarda al salir del campo (o con Enter), para no mandar un cambio por cada tecla
function CampoNumero({ etiqueta, ayuda, valor, min, max, onCambio }: {
  etiqueta: string;
  ayuda?: string;
  valor: number | undefined;
  min: number;
  max: number;
  onCambio: (valor: number) => void;
}) {
  return (
    <Campo etiqueta={etiqueta} ayuda={ayuda}>
      {(id) => (
        <input
          id={id}
          key={valor ?? 'vacio'}
          className={claseEntrada}
          // Con negativos posibles, el teclado numérico del teléfono no sirve (no tiene el signo menos)
          inputMode={min < 0 ? 'text' : 'numeric'}
          placeholder="—"
          defaultValue={valor ?? ''}
          onBlur={(e) => {
            const n = Number(e.target.value);
            if (e.target.value.trim() !== '' && Number.isInteger(n) && n >= min && n <= max && n !== valor) onCambio(n);
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      )}
    </Campo>
  );
}

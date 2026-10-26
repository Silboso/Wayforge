import { useEffect, useState, type ReactNode } from 'react';
import {
  CrownSimpleIcon, DiceFiveIcon, MapTrifoldIcon, ScrollIcon, SignOutIcon, SwordIcon, UsersIcon, WrenchIcon,
} from '@phosphor-icons/react';
import { personajeNuevo, type Personaje } from '../../reglas/pf2e';
import { tokenEnTurno, type EstadoSala, type Sesion, type Token } from '../../compartido/sala';
import { almacen, leer, useSala, type Sala } from '../conexion';
import { leerColoresTablero, type useTema } from '../tema';
import { BotonTema } from '../componentes/BotonTema';
import { EditorFicha } from '../componentes/EditorFicha';
import { Entrada, mensajeRechazo } from '../componentes/Entrada';
import { Ficha } from '../componentes/Ficha';
import { HerramientasGM } from '../componentes/Panel';
import { Tablero } from '../componentes/Tablero';
import { AvisoTirada, ListaTiradas, TiradaLibre } from '../componentes/Tiradas';
import { OrdenIniciativa, PanelCombateGM, PanelTurno } from '../componentes/Combate';
import { claseBotonSecundario } from '../componentes/ui';
import { MesaJugador } from './MesaJugador';
import { PilaAvisos, useAvisos, type Aviso } from '../componentes/hud/Avisos';
import type { Evento } from '../../compartido/eventos';

type Tema = ReturnType<typeof useTema>;

export function PaginaSala({ salaId, tema }: { salaId: string; tema: Tema }) {
  const [existe, setExiste] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(`/api/salas/${salaId}`)
      .then((r) => r.json() as Promise<{ existe: boolean }>)
      .then((r) => setExiste(r.existe))
      .catch(() => setExiste(false));
  }, [salaId]);

  if (existe === null) return <Centro>Buscando la mesa…</Centro>;
  if (!existe) {
    return (
      <Centro>
        <h1 className="font-titulo text-2xl font-bold">No encontramos la mesa {salaId.toUpperCase()}</h1>
        <p className="text-texto-suave">Revisa el código con tu GM.</p>
        <a href="/" className={claseBotonSecundario}>Volver al inicio</a>
      </Centro>
    );
  }
  return <MesaConectada salaId={salaId} tema={tema} />;
}

function MesaConectada({ salaId, tema }: { salaId: string; tema: Tema }) {
  const sala = useSala(salaId);
  if (sala.fase === 'entrada') {
    return (
      <div className="min-h-full">
        <div className="flex justify-between px-4 pt-4">
          <a href="/" className="font-titulo text-xl font-bold">Wayforge</a>
          <BotonTema tema={tema} />
        </div>
        <Entrada salaId={salaId} sala={sala} />
      </div>
    );
  }
  if (sala.fase === 'conectando' || !sala.estado) return <Centro>Entrando a la mesa…</Centro>;
  const quien = sala.quien;
  const personaje = quien.rol === 'jugador' ? sala.estado.personajes[quien.personajeId] : undefined;
  if (personaje) return <MesaJugador salaId={salaId} sala={sala} estado={sala.estado} personaje={personaje} tema={tema} />;
  return <Mesa salaId={salaId} sala={sala} estado={sala.estado} tema={tema} />;
}

type Pestana = 'tablero' | 'ficha' | 'herramientas' | 'personajes' | 'combate' | 'tiradas';

const PESTANAS: Record<Sesion['rol'], { clave: Pestana; nombre: string; icono: ReactNode }[]> = {
  visitante: [],
  jugador: [
    { clave: 'tablero', nombre: 'Tablero', icono: <MapTrifoldIcon size={22} aria-hidden /> },
    { clave: 'ficha', nombre: 'Mi ficha', icono: <ScrollIcon size={22} aria-hidden /> },
    { clave: 'tiradas', nombre: 'Tiradas', icono: <DiceFiveIcon size={22} aria-hidden /> },
  ],
  gm: [
    { clave: 'tablero', nombre: 'Tablero', icono: <MapTrifoldIcon size={22} aria-hidden /> },
    { clave: 'herramientas', nombre: 'Mesa', icono: <WrenchIcon size={22} aria-hidden /> },
    { clave: 'personajes', nombre: 'Personajes', icono: <UsersIcon size={22} aria-hidden /> },
    { clave: 'combate', nombre: 'Combate', icono: <SwordIcon size={22} aria-hidden /> },
    { clave: 'tiradas', nombre: 'Tiradas', icono: <DiceFiveIcon size={22} aria-hidden /> },
  ],
};

function Mesa({ salaId, sala, estado, tema }: { salaId: string; sala: Sala; estado: EstadoSala; tema: Tema }) {
  const { quien } = sala;
  const pestanas = PESTANAS[quien.rol];
  // En el teléfono se ve una pestaña a la vez; en pantalla grande el tablero siempre está y la pestaña va al lado
  const [pestana, setPestana] = useState<Pestana>(quien.rol === 'jugador' ? 'ficha' : 'tablero');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [editando, setEditando] = useState<Personaje | null>(null);
  const [modoEditor, setModoEditor] = useState<'crear' | 'editar'>('editar');
  const [colores, setColores] = useState(leerColoresTablero);
  const codigoGM = quien.rol === 'gm' ? leer(almacen.gmCodigo(salaId)) : null;
  const panel = pestana === 'tablero' ? (quien.rol === 'gm' ? 'herramientas' : 'ficha') : pestana;

  // Avisos del GM: el daño que los jugadores le hacen a sus enemigos, para restarlo de un toque
  const generar = (e: Evento): Aviso[] => {
    if (e.tipo !== 'tirada') return [];
    const t = e.tirada;
    const objetivo = t.objetivo?.tokenId ? estado.tokens[t.objetivo.tokenId] : undefined;
    if (!objetivo || objetivo.personajeId || t.objetivo?.grado || !objetivo.pg) return [];
    const pg = objetivo.pg;
    return [{
      id: crypto.randomUUID(), tono: 'peligro', titulo: `${t.quien} le hace ${t.total} de daño a ${objetivo.nombre}`,
      cuerpo: `${objetivo.nombre} tiene ${pg.actual} de ${pg.max} PG.`,
      botones: [{
        etiqueta: `Restar ${t.total} PG`, principal: true,
        hacer: () => sala.enviar({ tipo: 'editar-token', id: objetivo.id, cambios: { pg: { ...pg, actual: Math.max(0, pg.actual - t.total) } } }),
      }],
    }];
  };
  const { avisos, cerrar: cerrarAviso } = useAvisos(sala.eventos, generar);

  useEffect(() => setColores(leerColoresTablero()), [tema.tema]);

  // Si otra persona borra el token que tenía seleccionado, se deselecciona
  useEffect(() => {
    if (seleccionado && !estado.tokens[seleccionado]) setSeleccionado(null);
  }, [estado, seleccionado]);

  // El GM creó un personaje: cuando aparece en la mesa, se cierra el editor
  useEffect(() => {
    if (modoEditor === 'crear' && editando && estado.personajes[editando.id]) setEditando(null);
  }, [estado, editando, modoEditor]);

  // Al tocar un token en el tablero, el GM ve sus herramientas
  function seleccionar(id: string | null) {
    setSeleccionado(id);
    if (id && quien.rol === 'gm' && pestana !== 'tablero') setPestana('herramientas');
  }

  if (editando) {
    return (
      <div className="h-full overflow-y-auto">
        <EditorFicha
          salaId={salaId}
          inicial={editando}
          modo={modoEditor}
          error={mensajeRechazo(sala.rechazo)}
          onCancelar={() => { setEditando(null); sala.limpiarRechazo(); }}
          onGuardar={(p, codigo) => {
            if (modoEditor === 'crear') return sala.nuevoPersonaje(p, codigo);
            const { id, ...cambios } = p;
            sala.enviar({ tipo: 'editar-personaje', id, cambios });
            setEditando(null);
          }}
        />
      </div>
    );
  }

  const miPersonaje = quien.rol === 'jugador' ? estado.personajes[quien.personajeId] : undefined;
  const miToken = miPersonaje ? tokenDe(estado, miPersonaje.id) : undefined;
  // El token tocado en el tablero es el objetivo de ataques y tiradas, salvo que sea el propio
  const tokenElegido = seleccionado ? estado.tokens[seleccionado] : undefined;
  const objetivo = tokenElegido && tokenElegido.id !== miToken?.id ? { id: tokenElegido.id, nombre: tokenElegido.nombre } : null;
  const combate = estado.combate;
  const miTurno = !!combate && !!miToken && tokenEnTurno(estado)?.id === miToken.id;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-borde bg-superficie px-3 py-2 sm:gap-3 sm:px-4">
        <a href="/" className="font-titulo text-xl font-bold">Wayforge</a>
        <span className="hidden font-mono text-sm tracking-wider text-texto-suave sm:inline">{salaId.toUpperCase()}</span>
        <span className={`size-2 shrink-0 rounded-full ${sala.conectado ? 'bg-[#3f7d4e]' : 'bg-peligro'}`}
          title={sala.conectado ? 'Conectado' : 'Reconectando…'} />
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm text-texto-suave" title={sala.presentes.map((p) => p.nombre).join(', ')}>
            <UsersIcon size={18} aria-hidden />
            <span className="hidden md:inline">{sala.presentes.map((p) => p.nombre).join(', ')}</span>
            <span className="md:hidden">{sala.presentes.length}</span>
          </div>
          {quien.rol === 'gm' && <CrownSimpleIcon size={18} className="text-acento" aria-label="Eres el GM" />}
          <BotonTema tema={tema} />
          <button
            className="flex h-10 items-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm transition hover:bg-superficie-2"
            onClick={() => {
              const aviso = quien.rol === 'gm'
                ? '¿Salir de la mesa? Para volver como GM necesitarás tu código de GM.'
                : '¿Salir de la mesa? Para volver necesitarás el código de tu personaje.';
              if (confirm(aviso)) sala.salir();
            }}
          >
            <SignOutIcon size={18} aria-hidden />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className={`relative min-h-0 min-w-0 flex-1 ${pestana === 'tablero' ? 'flex' : 'hidden'} lg:flex`}>
          {combate && <OrdenIniciativa estado={estado} combate={combate} />}
          <Tablero
            estado={estado}
            colores={colores}
            quien={quien}
            eventos={sala.eventos}
            seleccionado={seleccionado}
            onSeleccionar={seleccionar}
            onMover={(id, x, y) => sala.mover(id, x, y)}
            onNegar={sala.negarLocal}
          />
          {!sala.conectado && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-lg bg-peligro px-3 py-1 text-sm text-white">Reconectando…</div>
          )}
        </div>

        <aside className={`min-h-0 flex-1 flex-col border-borde bg-fondo lg:w-96 lg:flex-none lg:border-l ${pestana === 'tablero' ? 'hidden' : 'flex'} lg:flex`}>
          <nav className="hidden gap-1 border-b border-borde p-2 lg:flex">
            {pestanas.filter((p) => p.clave !== 'tablero').map((p) => (
              <button key={p.clave}
                className={`flex-1 rounded-lg px-2 py-1.5 text-sm transition ${panel === p.clave ? 'bg-superficie font-medium' : 'text-texto-suave hover:bg-superficie'}`}
                onClick={() => setPestana(p.clave)}>
                {p.nombre}
              </button>
            ))}
          </nav>
          <div className="flex-1 overflow-y-auto p-4">
            {panel === 'ficha' && miPersonaje && (
              <div className="flex flex-col gap-4">
                {combate && <PanelTurno estado={estado} combate={combate} quien={quien} enviar={sala.enviar} />}
                <Ficha
                  personaje={miPersonaje}
                  condiciones={miToken?.condiciones ?? []}
                  puedeEditar
                  objetivo={objetivo}
                  siguienteAtaque={miTurno ? combate!.ataques : null}
                  onCambiar={(cambios) => sala.enviar({ tipo: 'editar-personaje', id: miPersonaje.id, cambios })}
                  onPonerCondicion={(clave, valor) => miToken && sala.enviar({ tipo: 'poner-condicion', tokenId: miToken.id, clave, valor })}
                  onTirar={(que) => sala.tirar(miPersonaje.id, que)}
                  onAbrirEditor={() => { setModoEditor('editar'); setEditando(miPersonaje); }}
                />
              </div>
            )}
            {panel === 'herramientas' && (
              <HerramientasGM salaId={salaId} codigoGM={codigoGM} estado={estado} seleccionado={seleccionado}
                onSeleccionar={setSeleccionado} enviar={sala.enviar} />
            )}
            {panel === 'personajes' && (
              <PersonajesGM
                estado={estado}
                sala={sala}
                objetivo={objetivo}
                onCrear={() => { setModoEditor('crear'); setEditando(personajeNuevo(crypto.randomUUID())); }}
                onEditar={(p) => { setModoEditor('editar'); setEditando(p); }}
              />
            )}
            {panel === 'combate' && (
              <PanelCombateGM estado={estado} quien={quien} enviar={sala.enviar} onIniciar={sala.iniciarCombate} />
            )}
            {panel === 'tiradas' && (
              <div className="flex flex-col gap-4">
                <TiradaLibre esGM={quien.rol === 'gm'} objetivo={objetivo}
                  onTirar={(que) => sala.tirar(miPersonaje?.id, que)} />
                <ListaTiradas tiradas={estado.tiradas} verCd={quien.rol === 'gm'} />
              </div>
            )}
          </div>
        </aside>
      </div>

      <nav className="grid border-t border-borde bg-superficie lg:hidden" style={{ gridTemplateColumns: `repeat(${pestanas.length}, 1fr)` }}>
        {pestanas.map((p) => (
          <button key={p.clave}
            className={`flex flex-col items-center gap-0.5 py-2 text-xs transition ${pestana === p.clave ? 'text-acento' : 'text-texto-suave'}`}
            aria-current={pestana === p.clave ? 'page' : undefined}
            onClick={() => setPestana(p.clave)}>
            {p.icono}
            {p.nombre}
          </button>
        ))}
      </nav>

      <AvisoTirada tiradas={estado.tiradas} verCd={quien.rol === 'gm'} />
      <PilaAvisos avisos={avisos} onCerrar={cerrarAviso}
        className="fixed inset-x-3 top-[60px] z-30 lg:inset-x-auto lg:top-[64px] lg:right-[400px] lg:w-[340px]" />
      {/* Un jugador está decidiendo si reacciona: el GM lo ve y puede seguir sin esperar */}
      {estado.esperas.map((e) => (
        <div key={e.id} className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4" role="status">
          <div className="tarjeta flex items-center gap-3 px-4 py-2.5">
            <p className="font-titulo text-[15px]">
              {e.atacante} ataca a {estado.tokens[e.objetivoTokenId]?.nombre}: esperando si reacciona…
            </p>
            <button className="boli h-9 border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10"
              onClick={() => sala.responder(e.id, null)}>
              Seguir sin reacción
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// El GM ve y maneja todas las fichas
function PersonajesGM({ estado, sala, objetivo, onCrear, onEditar }: {
  estado: EstadoSala;
  sala: Sala;
  objetivo: { id: string; nombre: string } | null;
  onCrear: () => void;
  onEditar: (p: Personaje) => void;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const personajes = Object.values(estado.personajes);
  const abiertoP = abierto ? estado.personajes[abierto] : undefined;
  const tokenAbierto = abiertoP ? tokenDe(estado, abiertoP.id) : undefined;

  if (abiertoP) {
    return (
      <div className="flex flex-col gap-4">
        <button className={`${claseBotonSecundario} self-start`} onClick={() => setAbierto(null)}>← Todos los personajes</button>
        <Ficha
          personaje={abiertoP}
          condiciones={tokenAbierto?.condiciones ?? []}
          puedeEditar
          objetivo={objetivo && objetivo.id !== tokenAbierto?.id ? objetivo : null}
          siguienteAtaque={estado.combate && tokenAbierto && tokenEnTurno(estado)?.id === tokenAbierto.id ? estado.combate.ataques : null}
          onPonerCondicion={(clave, valor) => tokenAbierto && sala.enviar({ tipo: 'poner-condicion', tokenId: tokenAbierto.id, clave, valor })}
          onCambiar={(cambios) => sala.enviar({ tipo: 'editar-personaje', id: abiertoP.id, cambios })}
          onTirar={(que) => sala.tirar(abiertoP.id, que)}
          onAbrirEditor={() => onEditar(abiertoP)}
        />
        <button
          className={`${claseBotonSecundario} text-peligro`}
          onClick={() => {
            if (!confirm(`¿Quitar a ${abiertoP.nombre} de la mesa? Se borra su ficha y su token.`)) return;
            sala.enviar({ tipo: 'borrar-personaje', id: abiertoP.id });
            setAbierto(null);
          }}
        >
          Quitar personaje de la mesa
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {personajes.length === 0 && (
        <p className="text-sm text-texto-suave">
          Aún no hay personajes. Tus jugadores los crean al entrar con el código de la mesa, o puedes crearlos tú.
        </p>
      )}
      {personajes.map((p) => (
        <button key={p.id} className="flex items-center gap-3 rounded-xl border border-borde bg-superficie p-3 text-left transition hover:bg-superficie-2"
          onClick={() => setAbierto(p.id)}>
          <div className="size-12 shrink-0 overflow-hidden rounded-full border-2 border-borde bg-superficie-2">
            {p.retrato
              ? <img src={p.retrato} alt="" className="size-full object-cover" />
              : <span className="flex size-full items-center justify-center font-titulo text-lg font-bold">{p.nombre.slice(0, 1)}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{p.nombre}</div>
            <div className="truncate text-sm text-texto-suave">{[p.ascendencia, p.clase].filter(Boolean).join(' ')} · Nivel {p.nivel}</div>
          </div>
          <span className="text-sm tabular-nums text-texto-suave">{p.pgActual} PG</span>
        </button>
      ))}
      <button className={claseBotonSecundario} onClick={onCrear}>Crear un personaje para un jugador</button>
    </div>
  );
}

function Centro({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-texto-suave">{children}</div>;
}

function tokenDe(estado: EstadoSala, personajeId: string): Token | undefined {
  return Object.values(estado.tokens).find((t) => t.personajeId === personajeId);
}

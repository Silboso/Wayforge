import { useEffect, useState, type ReactNode } from 'react';
import { CrownSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import { personajeNuevo, type Personaje } from '../../reglas/pf2e';
import type { ResumenPersonaje } from '../../compartido/sala';
import type { Sala } from '../conexion';
import { EditorFicha, EntradaCodigo } from './EditorFicha';
import { Creador } from './creador/Creador';
import { claseBotonPrincipal } from './ui';

const MENSAJES: Record<string, string> = {
  codigo: 'Ese código no es. Revísalo y vuelve a intentar.',
  bloqueado: 'Demasiados intentos. Espera un minuto antes de probar otra vez.',
  'no-existe': 'Ese personaje ya no está en la mesa.',
  'ficha-invalida': 'Algo en la ficha no cuadra. Revisa los campos e inténtalo otra vez.',
};

export function mensajeRechazo(motivo: string | null): string | null {
  return motivo ? MENSAJES[motivo] ?? 'No se pudo entrar. Inténtalo otra vez.' : null;
}

// La puerta de la mesa: elegir personaje y escribir su código, crear uno nuevo, o entrar como GM.
export function Entrada({ salaId, sala }: { salaId: string; sala: Sala }) {
  const [elegido, setElegido] = useState<string | null>(null);
  const [creando, setCreando] = useState<Personaje | null>(null);
  // Con el creador guiado, o copiando una ficha que ya existe (a mano)
  const [aMano, setAMano] = useState(false);
  const [codigo, setCodigo] = useState('');
  const error = mensajeRechazo(sala.rechazo);

  // Cambiar de personaje (o de GM a jugador) empieza de cero
  useEffect(() => {
    setCodigo('');
    sala.limpiarRechazo();
  }, [elegido]); // eslint-disable-line react-hooks/exhaustive-deps

  if (creando && !aMano) {
    return (
      <Creador salaId={salaId} id={creando.id} error={error}
        onCancelar={() => { setCreando(null); sala.limpiarRechazo(); }}
        onAMano={() => setAMano(true)}
        onGuardar={(p, codigoNuevo) => sala.nuevoPersonaje(p, codigoNuevo)} />
    );
  }
  if (creando) {
    return (
      <EditorFicha
        salaId={salaId}
        inicial={creando}
        modo="crear"
        error={error}
        onCancelar={() => { setCreando(null); setAMano(false); sala.limpiarRechazo(); }}
        onGuardar={(p, codigoNuevo) => sala.nuevoPersonaje(p, codigoNuevo)}
      />
    );
  }

  function entrar() {
    if (elegido === 'gm' ? codigo.length !== 6 : codigo.length !== 4) return;
    if (elegido === 'gm') sala.entrarComoGM(codigo);
    else if (elegido) sala.entrarComoJugador(elegido, codigo);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="text-center">
        <p className="text-sm text-texto-suave">Mesa <span className="font-mono font-medium tracking-wider text-texto">{salaId.toUpperCase()}</span></p>
        <h1 className="font-titulo text-3xl font-bold">¿Con quién juegas?</h1>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {sala.lobby.map((p) => (
          <li key={p.id}>
            <TarjetaPersonaje p={p} elegido={elegido === p.id} onElegir={() => setElegido(elegido === p.id ? null : p.id)}>
              <FormularioCodigo largo={4} codigo={codigo} setCodigo={setCodigo} error={error} onEntrar={entrar} />
            </TarjetaPersonaje>
          </li>
        ))}
        <li>
          <button
            className="flex h-full min-h-24 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-borde p-4 text-texto-suave transition hover:border-acento hover:text-texto"
            onClick={() => setCreando(personajeNuevo(crypto.randomUUID()))}
          >
            <PlusIcon size={22} aria-hidden /> Crear un personaje nuevo
          </button>
        </li>
      </ul>

      <div className="flex flex-col items-center gap-3 border-t border-borde pt-6">
        {elegido === 'gm' ? (
          <div className="flex w-full max-w-xs flex-col gap-3">
            <p className="text-center text-sm text-texto-suave">Escribe el código de GM de 6 números que te dimos al crear la partida.</p>
            <FormularioCodigo largo={6} codigo={codigo} setCodigo={setCodigo} error={error} onEntrar={entrar} />
            <button className="text-sm text-texto-suave underline" onClick={() => setElegido(null)}>Cancelar</button>
          </div>
        ) : (
          <button className="flex items-center gap-2 text-texto-suave transition hover:text-texto" onClick={() => setElegido('gm')}>
            <CrownSimpleIcon size={18} aria-hidden /> Soy el GM
          </button>
        )}
      </div>
    </main>
  );
}

function TarjetaPersonaje({ p, elegido, onElegir, children }: {
  p: ResumenPersonaje;
  elegido: boolean;
  onElegir: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border-2 bg-superficie p-4 transition ${elegido ? 'border-acento' : 'border-borde'}`}>
      <button className="flex items-center gap-3 text-left" onClick={onElegir} aria-expanded={elegido}>
        <div className="size-14 shrink-0 overflow-hidden rounded-full border-2 border-borde bg-superficie-2">
          {p.retrato
            ? <img src={p.retrato} alt="" className="size-full object-cover" />
            : <span className="flex size-full items-center justify-center font-titulo text-xl font-bold">{p.nombre.slice(0, 1)}</span>}
        </div>
        <div className="min-w-0">
          <div className="truncate font-titulo text-lg font-bold">{p.nombre}</div>
          <div className="truncate text-sm text-texto-suave">{[p.ascendencia, p.clase].filter(Boolean).join(' ')} · Nivel {p.nivel}</div>
        </div>
      </button>
      {elegido && children}
    </div>
  );
}

function FormularioCodigo({ largo, codigo, setCodigo, error, onEntrar }: {
  largo: number;
  codigo: string;
  setCodigo: (c: string) => void;
  error: string | null;
  onEntrar: () => void;
}) {
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); onEntrar(); }}>
      <EntradaCodigo autoFocus valor={codigo} largo={largo} onCambio={setCodigo} />
      {error && <p className="text-sm text-peligro">{error}</p>}
      <button className={claseBotonPrincipal} disabled={codigo.length !== largo}>Entrar</button>
    </form>
  );
}

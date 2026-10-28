import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { useSala } from '../conexion';
import type { useTema } from '../tema';
import { BotonTema } from '../componentes/BotonTema';
import { Entrada } from '../componentes/Entrada';
import { claseBotonSecundario } from '../componentes/ui';
// Cada mesa se descarga solo cuando hace falta: un jugador no baja la del GM (ni el inicio, ninguna de las dos)
const MesaJugador = lazy(() => import('./MesaJugador').then((m) => ({ default: m.MesaJugador })));
const MesaGM = lazy(() => import('./MesaGM').then((m) => ({ default: m.MesaGM })));

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
  return (
    <Suspense fallback={<Centro>Abriendo la mesa…</Centro>}>
      {personaje
        ? <MesaJugador salaId={salaId} sala={sala} estado={sala.estado} personaje={personaje} tema={tema} />
        : <MesaGM salaId={salaId} sala={sala} estado={sala.estado} tema={tema} />}
    </Suspense>
  );
}

function Centro({ children }: { children: ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-texto-suave">{children}</div>;
}

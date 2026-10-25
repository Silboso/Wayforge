import { useState } from 'react';
import { BotonTema } from '../componentes/BotonTema';
import { claseBotonSecundario, claseEntrada } from '../componentes/ui';
import { almacen, guardar } from '../conexion';
import type { useTema } from '../tema';

export function Inicio({ tema }: { tema: ReturnType<typeof useTema> }) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [codigo, setCodigo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState('');

  async function crearPartida() {
    setCreando(true);
    setError('');
    try {
      const respuesta = await fetch('/api/salas', { method: 'POST' });
      if (!respuesta.ok) throw new Error();
      const { codigo: sala, codigoGM } = (await respuesta.json()) as { codigo: string; codigoGM: string };
      // Quien crea la partida entra como GM sin escribir el código; se le muestra en la mesa para que lo guarde
      guardar(almacen.gmNuevo(sala), codigoGM);
      location.assign(`/sala/${sala}`);
    } catch {
      setError('No se pudo crear la partida. Revisa tu conexión e inténtalo otra vez.');
      setCreando(false);
    }
  }

  function unirse() {
    const limpio = codigo.trim().toLowerCase();
    if (!/^[a-z0-9]{6}$/.test(limpio)) {
      setErrorCodigo('El código de la mesa tiene 6 letras y números');
      return;
    }
    location.assign(`/sala/${limpio}`);
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div className="absolute top-4 right-4">
        <BotonTema tema={tema} />
      </div>
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl text-acento" aria-hidden>◆◆◆</span>
        <h1 className="font-titulo text-5xl font-bold">Wayforge</h1>
        <p className="max-w-md text-lg text-texto-suave">La mesa de Pathfinder 2e que hace las cuentas por ti.</p>
      </div>

      <form className="flex w-full max-w-xs flex-col gap-2" onSubmit={(e) => { e.preventDefault(); unirse(); }}>
        <label htmlFor="codigo-mesa" className="text-sm text-texto-suave">¿Te invitaron? Escribe el código de la mesa</label>
        <div className="flex gap-2">
          <input
            id="codigo-mesa"
            className={`${claseEntrada} h-12 text-center font-mono text-xl tracking-[0.3em] uppercase`}
            maxLength={6}
            autoComplete="off"
            placeholder="K7M2QX"
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value.replace(/[^a-z0-9]/gi, '')); setErrorCodigo(''); }}
          />
          <button className="h-12 rounded-lg bg-acento px-5 font-medium text-sobre-acento transition active:scale-[0.98]">Entrar</button>
        </div>
        {errorCodigo && <p className="text-sm text-peligro">{errorCodigo}</p>}
      </form>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-texto-suave">¿Eres el GM?</p>
        <button onClick={crearPartida} disabled={creando} className={`${claseBotonSecundario} h-11 px-6`}>
          {creando ? 'Preparando la mesa…' : 'Crear partida nueva'}
        </button>
        {error && <p className="text-peligro">{error}</p>}
      </div>
    </main>
  );
}

import { useRef, useState } from 'react';
import { CrownSimpleIcon, FileArrowUpIcon, UserIcon, XIcon } from '@phosphor-icons/react';
import { abrirComoGM, codigoGMDe, importarMesa, misMesas, olvidarMesa, type MesaGuardada } from '../campanas';
import { BotonTema } from '../componentes/BotonTema';
import { claseBotonSecundario, claseEntrada } from '../componentes/ui';
import { almacen, guardar } from '../conexion';
import type { useTema } from '../tema';

export function Inicio({ tema }: { tema: ReturnType<typeof useTema> }) {
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [codigo, setCodigo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState('');
  const [mesas, setMesas] = useState<MesaGuardada[]>(misMesas);
  const [importando, setImportando] = useState(false);
  const [errorImportar, setErrorImportar] = useState('');
  const archivo = useRef<HTMLInputElement>(null);

  async function importar(f: File | null) {
    if (!f) return;
    setImportando(true);
    setErrorImportar('');
    try {
      location.assign(`/sala/${await importarMesa(f)}`);
    } catch (e) {
      setErrorImportar(e instanceof Error ? e.message : 'No se pudo abrir la mesa');
      setImportando(false);
    }
  }

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
        <button onClick={() => archivo.current?.click()} disabled={importando} className="mt-1 flex items-center gap-1.5 text-sm text-texto-suave underline decoration-dotted hover:text-acento">
          <FileArrowUpIcon size={16} aria-hidden /> {importando ? 'Abriendo la mesa…' : 'Importar una mesa exportada (.json)'}
        </button>
        <input ref={archivo} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { importar(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        {errorImportar && <p className="text-sm text-peligro">{errorImportar}</p>}
      </div>

      {/* Las mesas de este navegador: para volver a abrirlas */}
      {mesas.length > 0 && (
        <section className="w-full max-w-md text-left">
          <h2 className="mb-2 text-center font-titulo text-[20px] font-bold">Tus mesas</h2>
          <ul className="flex flex-col gap-2">
            {mesas.map((m) => (
              <li key={`${m.rol}-${m.codigo}`} className="flex items-center gap-3 rounded-xl border border-borde bg-superficie px-3 py-2.5">
                {m.rol === 'gm' ? <CrownSimpleIcon size={20} className="shrink-0 text-acento" aria-label="GM" /> : <UserIcon size={20} className="shrink-0 text-texto-suave" aria-label="Jugador" />}
                <button className="min-w-0 flex-1 text-left" onClick={() => (m.rol === 'gm' ? abrirComoGM(m.codigo) : location.assign(`/sala/${m.codigo}`))}>
                  <span className="block truncate font-titulo text-[16px] font-bold">{m.nombre || `Mesa ${m.codigo.toUpperCase()}`}</span>
                  <span className="block text-[12.5px] text-texto-suave">
                    {m.rol === 'gm' ? (codigoGMDe(m.codigo) ? 'GM · entras directo' : 'GM · con tu código') : `Juegas con ${m.personaje ?? 'tu personaje'}`} · {m.codigo.toUpperCase()} · {new Date(m.cuando).toLocaleDateString()}
                  </span>
                </button>
                <button className="flex size-8 shrink-0 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-2" title="Quitar de la lista (la mesa sigue existiendo)"
                  aria-label={`Quitar ${m.nombre || m.codigo} de la lista`} onClick={() => { olvidarMesa(m.codigo, m.rol); setMesas(misMesas()); }}>
                  <XIcon size={15} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

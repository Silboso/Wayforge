import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowBendUpLeftIcon, LightningIcon, ShieldWarningIcon, SwordIcon, TargetIcon, XIcon } from '@phosphor-icons/react';
import type { Aptitud } from '../../../reglas/aptitudes';
import type { Espera } from '../../../compartido/sala';
import type { Evento } from '../../../compartido/eventos';
import { CostoAccion } from './piezas';

export type Tono = 'turno' | 'bueno' | 'malo' | 'peligro' | 'nota';

export interface BotonAviso {
  etiqueta: string;
  hacer: () => void;
  principal?: boolean;
}

export interface Aviso {
  id: string;
  tono: Tono;
  titulo: string;
  cuerpo?: ReactNode;
  botones?: BotonAviso[];
  // Se va solo después de estos ms; sin valor, queda hasta que lo cierres o lo uses
  dura?: number;
}

const ICONOS: Record<Tono, ReactNode> = {
  turno: <LightningIcon size={20} weight="fill" aria-hidden />,
  bueno: <TargetIcon size={20} weight="bold" aria-hidden />,
  malo: <SwordIcon size={20} weight="bold" aria-hidden />,
  peligro: <ShieldWarningIcon size={20} weight="bold" aria-hidden />,
  nota: <ArrowBendUpLeftIcon size={20} weight="bold" aria-hidden />,
};

const COLOR: Record<Tono, string> = {
  turno: 'text-acento',
  bueno: 'text-exito',
  malo: 'text-texto-suave',
  peligro: 'text-peligro',
  nota: 'text-acento',
};

// Convierte los eventos nuevos en avisos con `generar`, y quita los que vencen.
// Cada evento se procesa una sola vez aunque el componente se vuelva a dibujar.
// "Ezren entró a la mesa" / "Ezren salió": un aviso corto cuando cambia quién está (sin contarse a uno mismo).
// Se avisa unos segundos después: quien se reconecta (sale y vuelve enseguida) no genera ruido
export function useLlegadas(presentes: { nombre: string }[], miNombre: string, agregar: (a: Aviso) => void) {
  const antes = useRef<Set<string> | null>(null);
  const pendientes = useRef(new Map<string, { tipo: 'entro' | 'salio'; espera: ReturnType<typeof setTimeout> }>());
  useEffect(() => {
    const ahora = new Set(presentes.map((x) => x.nombre));
    const previos = antes.current;
    antes.current = ahora;
    // La primera lista es la de los que ya estaban: no se anuncia
    if (!previos) return;
    const anunciar = (n: string, tipo: 'entro' | 'salio') => {
      if (n === miNombre) return;
      const ya = pendientes.current.get(n);
      // Salió y volvió (o al revés) antes de avisar: no pasó nada
      if (ya && ya.tipo !== tipo) { clearTimeout(ya.espera); pendientes.current.delete(n); return; }
      if (ya) return;
      const espera = setTimeout(() => {
        pendientes.current.delete(n);
        agregar({ id: crypto.randomUUID(), tono: 'nota', titulo: tipo === 'entro' ? `${n} entró a la mesa` : `${n} salió de la mesa`, cuerpo: '', dura: 3000 });
      }, 4000);
      pendientes.current.set(n, { tipo, espera });
    };
    for (const n of ahora) if (!previos.has(n)) anunciar(n, 'entro');
    for (const n of previos) if (!ahora.has(n)) anunciar(n, 'salio');
  }, [presentes]);
}

export function useAvisos(eventos: { id: number; evento: Evento }[], generar: (e: Evento) => Aviso[]) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const visto = useRef(eventos.at(-1)?.id ?? 0);
  const generarRef = useRef(generar);
  generarRef.current = generar;

  useEffect(() => {
    const nuevos = eventos.filter((e) => e.id > visto.current);
    if (nuevos.length === 0) return;
    visto.current = nuevos.at(-1)!.id;
    const creados = nuevos.flatMap((e) => generarRef.current(e.evento));
    if (creados.length) setAvisos((prev) => sumar(prev, creados.reverse()));
  }, [eventos]);

  useEffect(() => {
    const temporizadores = avisos.filter((a) => a.dura).map((a) =>
      setTimeout(() => setAvisos((prev) => prev.filter((x) => x.id !== a.id)), a.dura));
    return () => temporizadores.forEach(clearTimeout);
  }, [avisos]);

  const cerrar = (id: string) => setAvisos((prev) => prev.filter((a) => a.id !== id));
  // Avisos que no vienen de un evento (la sala dijo que no, una indicación)
  const agregar = (a: Aviso) => setAvisos((prev) => sumar(prev, [a]));
  return { avisos, cerrar, agregar };
}

// Los nuevos arriba; uno con el mismo id reemplaza al viejo, y un turno nuevo saca el aviso del turno anterior
function sumar(prev: Aviso[], nuevos: Aviso[]): Aviso[] {
  const ids = new Set(nuevos.map((a) => a.id));
  const turno = nuevos.some((a) => a.tono === 'turno');
  return [...nuevos, ...prev.filter((a) => !ids.has(a.id) && !(turno && a.tono === 'turno'))].slice(0, 5);
}

export function PilaAvisos({ avisos, onCerrar, className = '' }: { avisos: Aviso[]; onCerrar: (id: string) => void; className?: string }) {
  if (avisos.length === 0) return null;
  return (
    // En el teléfono se ve solo el más reciente: los demás esperan debajo sin tapar la hoja
    <ol className={`flex flex-col gap-2.5 max-lg:[&>li:nth-child(n+2)]:hidden ${className}`} aria-live="polite" aria-label="Avisos">
      {avisos.map((a) => (
        <li key={a.id} className="tarjeta aviso-entra relative px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className={`mt-0.5 shrink-0 ${COLOR[a.tono]}`}>{ICONOS[a.tono]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-titulo text-[16.5px] leading-snug font-bold">{a.titulo}</p>
              {a.cuerpo && <div className="mt-0.5 text-[13.5px] leading-snug text-texto-suave">{a.cuerpo}</div>}
              {a.botones && a.botones.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.botones.map((b) => (
                    <button key={b.etiqueta}
                      className={`boli h-9 px-3 font-titulo text-[14px] font-semibold transition active:scale-[0.97] ${b.principal ? 'bg-acento text-sobre-acento' : 'border-[1.5px] border-acento text-acento hover:bg-acento/10'}`}
                      onClick={() => { b.hacer(); onCerrar(a.id); }}>
                      {b.etiqueta}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="-mt-1 -mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={() => onCerrar(a.id)} aria-label="Cerrar aviso">
              <XIcon size={16} aria-hidden />
            </button>
          </div>
          {a.dura && <span aria-hidden className="aviso-tiempo absolute inset-x-3 bottom-1 h-[2px] origin-left bg-borde" style={{ animationDuration: `${a.dura}ms` }} />}
        </li>
      ))}
    </ol>
  );
}

// "¡El Goblin te ataca!": la mesa está esperando tu respuesta antes de tirar
export function PanelEspera({ espera, aptitudes, onResponder }: {
  espera: Espera;
  aptitudes: Aptitud[];
  onResponder: (aptitudId: string | null) => void;
}) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const quedan = Math.max(0, Math.ceil((espera.vence - ahora) / 1000));
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center bg-texto/10 px-4 pt-[14vh]">
      <section role="alertdialog" aria-labelledby="espera-titulo" className="tarjeta aviso-entra pointer-events-auto w-full max-w-[440px] px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="espera-titulo" className="font-titulo text-[24px] leading-tight font-bold text-peligro">¡{espera.atacante} te ataca!</h2>
          <span className="font-titulo text-[15px] text-texto-suave tabular-nums">{quedan}s</span>
        </div>
        <p className="mt-1 text-[14px]">Con {espera.etiqueta}. Antes de que tire, puedes usar tu reacción:</p>
        <ul className="mt-3 flex flex-col gap-2">
          {aptitudes.map((a) => (
            <li key={a.id}>
              <button className="boli flex w-full items-start gap-3 bg-acento px-4 py-3 text-left text-sobre-acento shadow-[0_6px_12px_-6px_var(--acento)] transition active:scale-[0.98]"
                onClick={() => onResponder(a.id)}>
                <CostoAccion costo={a.costo} className="mt-1 !text-sobre-acento" />
                <span>
                  <span className="block font-titulo text-[18px] font-bold">{a.verbo || a.nombre}{a.efecto?.bonoCA ? ` (+${a.efecto.bonoCA} CA)` : ''}</span>
                  <span className="block text-[13px] opacity-90">{a.descripcion}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button className="mt-2 h-10 w-full font-titulo text-[15px] text-texto-suave hover:text-texto" onClick={() => onResponder(null)}>
          No reacciono
        </button>
        <span aria-hidden className="aviso-tiempo mt-1 block h-[3px] origin-left bg-peligro/60"
          style={{ animationDuration: `${Math.max(0, espera.vence - Date.now())}ms` }} />
      </section>
    </div>
  );
}

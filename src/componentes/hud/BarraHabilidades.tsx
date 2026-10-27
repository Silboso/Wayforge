import { useEffect, useRef, useState } from 'react';
import type { Fila } from './secciones';
import { IconoHabilidad } from './IconoHabilidad';
import { TarjetaHabilidad } from './TarjetaHabilidad';
import { ConFlotante } from './Flotante';
import { Rombo } from './piezas';

// Lo que viaja al arrastrar una acción (de una lista o de otro espacio de la barra)
export const TIPO_ARRASTRE = 'application/x-wayforge-accion';

// ¿Le faltan acciones para usarla ahora?
export function sinAccionesPara(fila: Fila, libres: number | null): boolean {
  if (libres === null) return false;
  const costo = fila.tipo === 'golpe' ? 1 : fila.aptitud.costo;
  return typeof costo === 'number' && costo > libres;
}

// Cuántos usos le quedan, si tiene un límite que se agota (consumibles, frecuencia)
function usosDe(fila: Fila): string | null {
  if (fila.tipo !== 'aptitud') return null;
  const r = fila.aptitud.recuperacion;
  if (r.tipo === 'consumible') return String(r.cantidad);
  if (r.tipo === 'frecuencia') return /^(\d+)/.exec(fila.disp.texto)?.[1] ?? null;
  return null;
}

// La barra de habilidades, acomodada como en League of Legends: Q W E R grandes, D F al lado (lo de apoyo) y
// 1–4 para objetos. Se arrastra una acción de las listas a un espacio; entre espacios se intercambian; arrastrar
// una afuera de la barra la saca. Pasar el cursor muestra qué hace.
export function BarraHabilidades({ ranuras, teclas, libres, elegida, alcanceDe, onElegir, onAsignar, onAsomar, incrustada = false }: {
  ranuras: (Fila | null)[];
  teclas: string[];
  libres: number | null;
  elegida: string | null;
  alcanceDe: (f: Fila) => number | null;
  onElegir: (f: Fila) => void;
  onAsignar: (i: number, clave: string | null) => void;
  onAsomar: (f: Fila | null) => void;
  // Dentro de la hoja (sin tarjeta propia)
  incrustada?: boolean;
}) {
  const [sobre, setSobre] = useState<number | null>(null);
  // Mientras se arrastra una acción por la pantalla, los espacios se marcan para recibirla
  const [recibiendo, setRecibiendo] = useState(false);
  const origen = useRef<number | null>(null);
  useEffect(() => {
    const empieza = (e: DragEvent) => { if (e.dataTransfer?.types.includes(TIPO_ARRASTRE)) setRecibiendo(true); };
    const termina = () => { setRecibiendo(false); setSobre(null); };
    addEventListener('dragstart', empieza);
    addEventListener('dragend', termina);
    addEventListener('drop', termina);
    return () => { removeEventListener('dragstart', empieza); removeEventListener('dragend', termina); removeEventListener('drop', termina); };
  }, []);

  const espacio = (i: number, tamano: number) => {
    const f = ranuras[i] ?? null;
    const tecla = teclas[i]!;
    const agotada = !!f && ((f.tipo === 'aptitud' && !f.disp.puede) || sinAccionesPara(f, libres));
    const usos = f ? usosDe(f) : null;
    const costo = f ? (f.tipo === 'golpe' ? 1 : f.aptitud.costo) : null;
    return (
      <ConFlotante key={i} contenido={f
        ? <TarjetaHabilidad fila={f} alcance={alcanceDe(f)} tecla={tecla} />
        : <p className="text-[13.5px]"><b>{tecla}</b> está vacío. Arrastra aquí una acción de tu hoja (o de la lista de abajo).</p>}>
        <button
          draggable={!!f}
          aria-label={f ? `${tecla}: ${f.nombre}` : `${tecla}: vacío`}
          aria-pressed={!!f && elegida === f.clave}
          onClick={() => f && onElegir(f)}
          onMouseEnter={() => onAsomar(f)}
          onMouseLeave={() => onAsomar(null)}
          onDragStart={(e) => {
            if (!f) return;
            origen.current = i;
            e.dataTransfer.setData(TIPO_ARRASTRE, f.clave);
            e.dataTransfer.setData('text/plain', f.nombre);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={(e) => {
            // Soltada fuera de la barra: se saca de ese espacio
            if (origen.current === i && e.dataTransfer.dropEffect === 'none') onAsignar(i, null);
            origen.current = null;
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(TIPO_ARRASTRE)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (sobre !== i) setSobre(i);
          }}
          onDragLeave={() => setSobre((x) => (x === i ? null : x))}
          onDrop={(e) => {
            const clave = e.dataTransfer.getData(TIPO_ARRASTRE);
            e.preventDefault();
            setSobre(null);
            if (clave) onAsignar(i, clave);
          }}
          className={`group relative block rounded-[11px] p-[3px] transition ${sobre === i ? 'scale-110 bg-acento/30' : recibiendo ? 'bg-acento/10' : ''} ${f && elegida === f.clave ? 'ring-[3px] ring-acento' : ''}`}>
          {f ? (
            <IconoHabilidad fila={f} tamano={tamano} apagada={agotada}>
              {costo !== null && typeof costo === 'number' && tamano >= 40 && (
                <span className="absolute top-0.5 left-0.5 flex gap-px rounded-sm bg-black/35 px-0.5 py-px">
                  {Array.from({ length: costo }, (_, k) => <Rombo key={k} className="size-[7px] [&_path]:fill-white! [&_path]:stroke-white!" />)}
                </span>
              )}
              {usos !== null && (
                <span className="absolute top-0.5 right-0.5 min-w-[15px] rounded-sm bg-black/55 px-0.5 text-center text-[10px] leading-[14px] font-bold">{usos}</span>
              )}
            </IconoHabilidad>
          ) : (
            <span className={`flex items-center justify-center rounded-[9px] border-2 border-dashed ${recibiendo ? 'border-acento' : 'border-borde'} bg-superficie-2/60`}
              style={{ width: tamano, height: tamano }} />
          )}
          <span className={`absolute -right-1 -bottom-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border-[1.5px] border-borde bg-superficie px-1 font-titulo text-[11.5px] font-bold leading-none ${f ? 'text-texto' : 'text-texto-suave'}`}>
            {tecla}
          </span>
        </button>
      </ConFlotante>
    );
  };

  return (
    <div className={`flex items-end gap-3 ${incrustada ? '' : 'rounded-2xl border-2 border-borde bg-superficie/95 px-3 py-2 shadow-[0_12px_28px_-16px_var(--sombra)]'}`} role="toolbar" aria-label="Barra de habilidades">
      <div className="flex gap-1.5">{[0, 1, 2, 3].map((i) => espacio(i, 52))}</div>
      <span aria-hidden className="h-10 w-px self-center bg-borde" />
      <div className="flex gap-1.5">{[4, 5].map((i) => espacio(i, 42))}</div>
      <span aria-hidden className="h-10 w-px self-center bg-borde" />
      <div className="grid grid-cols-2 gap-1">{[6, 7, 8, 9].map((i) => espacio(i, 26))}</div>
    </div>
  );
}

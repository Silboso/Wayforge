import { useEffect, useRef, useState } from 'react';
import type { Tirada } from '../../compartido/sala';
import { textoTirada } from '../../compartido/tiradas';

function natural(t: Tirada): 'critico' | 'pifia' | null {
  if (t.caras !== 20 || t.dados.length !== 1) return null;
  if (t.dados[0] === 20) return 'critico';
  if (t.dados[0] === 1) return 'pifia';
  return null;
}

export function ListaTiradas({ tiradas }: { tiradas: Tirada[] }) {
  if (tiradas.length === 0) {
    return <p className="text-sm text-texto-suave">Las tiradas de todos aparecen aquí. Toca una skill, salvación o ataque en tu ficha para tirar.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {[...tiradas].reverse().map((t) => <FilaTirada key={t.id} t={t} />)}
    </ul>
  );
}

function FilaTirada({ t }: { t: Tirada }) {
  const nat = natural(t);
  return (
    <li className={`flex items-center gap-3 rounded-lg border bg-superficie px-3 py-2 ${nat === 'critico' ? 'border-acento' : 'border-borde'}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm"><span className="font-medium">{t.quien}</span> · {t.etiqueta}</div>
        <div className="text-xs text-texto-suave tabular-nums">
          {textoTirada(t)}
          {nat === 'critico' && <span className="ml-2 font-medium text-acento">20 natural</span>}
          {nat === 'pifia' && <span className="ml-2 font-medium text-peligro">1 natural</span>}
        </div>
      </div>
      <span className="font-titulo text-2xl font-bold tabular-nums">{t.total}</span>
    </li>
  );
}

// Aviso flotante con la última tirada, para que todos la vean aunque estén mirando el tablero
export function AvisoTirada({ tiradas }: { tiradas: Tirada[] }) {
  const ultima = tiradas.at(-1);
  const [visible, setVisible] = useState<Tirada | null>(null);
  const vista = useRef(ultima?.id);

  useEffect(() => {
    if (!ultima || ultima.id === vista.current) return;
    vista.current = ultima.id;
    setVisible(ultima);
    const temporizador = setTimeout(() => setVisible(null), 4500);
    return () => clearTimeout(temporizador);
  }, [ultima]);

  if (!visible) return null;
  const nat = natural(visible);
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center px-4 lg:bottom-6">
      <div className={`flex items-center gap-4 rounded-2xl border-2 bg-superficie px-5 py-3 shadow-lg ${nat === 'critico' ? 'border-acento' : nat === 'pifia' ? 'border-peligro' : 'border-borde'}`}>
        <div>
          <div className="text-sm"><span className="font-medium">{visible.quien}</span> · {visible.etiqueta}</div>
          <div className="text-xs text-texto-suave tabular-nums">{textoTirada(visible)}</div>
        </div>
        <span className="font-titulo text-4xl font-bold tabular-nums">{visible.total}</span>
      </div>
    </div>
  );
}

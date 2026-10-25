import { useEffect, useRef, useState } from 'react';
import { GRADOS, leerExpresion, type Grado } from '../../reglas/pf2e';
import type { QueTirar, Tirada } from '../../compartido/sala';
import { textoTirada } from '../../compartido/tiradas';
import { claseBotonPrincipal, claseEntrada, Seccion } from './ui';

function natural(t: Tirada): 'critico' | 'pifia' | null {
  if (t.caras !== 20 || t.dados.length !== 1) return null;
  if (t.dados[0] === 20) return 'critico';
  if (t.dados[0] === 1) return 'pifia';
  return null;
}

const COLOR_GRADO: Record<Grado, string> = {
  critico: 'bg-acento text-sobre-acento',
  exito: 'bg-[#3f7d4e] text-white',
  fallo: 'bg-superficie-2 text-texto',
  pifia: 'bg-peligro text-white',
};

// "Éxito contra Goblin". La CA solo la ve el GM: para los jugadores es un secreto de los enemigos.
function Resultado({ t, verCd }: { t: Tirada; verCd: boolean }) {
  if (!t.objetivo) return null;
  return (
    <span className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className={`rounded-full px-2 py-0.5 font-medium ${COLOR_GRADO[t.objetivo.grado]}`}>{GRADOS[t.objetivo.grado]}</span>
      <span className="text-texto-suave">contra {t.objetivo.nombre}{verCd ? ` (CA ${t.objetivo.cd})` : ''}</span>
    </span>
  );
}

export function ListaTiradas({ tiradas, verCd }: { tiradas: Tirada[]; verCd: boolean }) {
  if (tiradas.length === 0) {
    return <p className="text-sm text-texto-suave">Las tiradas de todos aparecen aquí. Toca una skill, salvación o ataque en tu ficha para tirar.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {[...tiradas].reverse().map((t) => <FilaTirada key={t.id} t={t} verCd={verCd} />)}
    </ul>
  );
}

function FilaTirada({ t, verCd }: { t: Tirada; verCd: boolean }) {
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
        <Resultado t={t} verCd={verCd} />
      </div>
      <span className="font-titulo text-2xl font-bold tabular-nums">{t.total}</span>
    </li>
  );
}

// Tirar lo que sea: "1d20+7", "2d6+3". El GM puede decir de quién es (el goblin) y contra quién.
export function TiradaLibre({ esGM, objetivo, onTirar }: {
  esGM: boolean;
  objetivo: { id: string; nombre: string } | null;
  onTirar: (que: QueTirar) => void;
}) {
  const [expresion, setExpresion] = useState('1d20');
  const [etiqueta, setEtiqueta] = useState('');
  const [error, setError] = useState('');

  function tirar() {
    if (!leerExpresion(expresion)) {
      setError('Escribe dados como 1d20+7 o 2d6+3');
      return;
    }
    onTirar({ tipo: 'libre', expresion, ...(etiqueta.trim() ? { etiqueta: etiqueta.trim() } : {}), ...(objetivo ? { objetivo: objetivo.id } : {}) });
  }

  return (
    <Seccion titulo="Tirada libre">
      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); tirar(); }}>
        <div className="flex gap-2">
          <input className={`${claseEntrada} font-mono`} value={expresion} aria-label="Dados" placeholder="1d20+7" maxLength={40}
            onChange={(e) => { setExpresion(e.target.value); setError(''); }} />
          <button className={claseBotonPrincipal}>Tirar</button>
        </div>
        <input className={claseEntrada} value={etiqueta} maxLength={40} aria-label={esGM ? 'Quién tira' : 'Para qué es'}
          placeholder={esGM ? 'Quién tira (Goblin arquero)' : 'Para qué es (opcional)'}
          onChange={(e) => setEtiqueta(e.target.value)} />
        {error && <p className="text-sm text-peligro">{error}</p>}
        <p className="text-xs text-texto-suave">
          {objetivo ? `Si es un d20, se compara con la CA de ${objetivo.nombre}.` : 'Toca un token en el tablero para tirar contra su CA.'}
        </p>
      </form>
    </Seccion>
  );
}

// Aviso flotante con la última tirada, para que todos la vean aunque estén mirando el tablero
export function AvisoTirada({ tiradas, verCd }: { tiradas: Tirada[]; verCd: boolean }) {
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
          <Resultado t={visible} verCd={verCd} />
        </div>
        <span className="font-titulo text-4xl font-bold tabular-nums">{visible.total}</span>
      </div>
    </div>
  );
}

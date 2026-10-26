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
  // Daño u otra tirada sin CA: solo a quién iba
  if (!t.objetivo.grado) return <span className="mt-1 block text-xs text-texto-suave">a {t.objetivo.nombre}</span>;
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

const RUEDA_MS = 700;

// Aviso flotante con la última tirada, para que todos la vean aunque estén mirando el tablero.
// Primero el dado rueda y sus números cambian; luego cae el resultado.
// `lugar`: dónde flota la tarjeta (en la mesa del jugador, en escritorio, arriba para no tapar la hoja)
export function AvisoTirada({ tiradas, verCd, pendiente = null, lugar = 'bottom-[156px] lg:bottom-6' }: {
  tiradas: Tirada[]; verCd: boolean; pendiente?: { etiqueta: string; desde: number } | null; lugar?: string;
}) {
  const ultima = tiradas.at(-1);
  const [visible, setVisible] = useState<Tirada | null>(null);
  const [rodando, setRodando] = useState(false);
  const [caras, setCaras] = useState<number[]>([]);
  const vista = useRef(ultima?.id);
  const rodandoDesde = useRef(0);
  const [carasPendientes, setCarasPendientes] = useState(20);
  // Mientras la sala responde, el dado ya rueda: se siente la tirada en el mismo instante del clic
  useEffect(() => {
    if (!pendiente || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    rodandoDesde.current = pendiente.desde;
    const t = setInterval(() => setCarasPendientes(1 + Math.floor(Math.random() * 20)), 70);
    return () => clearInterval(t);
  }, [pendiente]);

  useEffect(() => {
    if (!ultima || ultima.id === vista.current) return;
    vista.current = ultima.id;
    setVisible(ultima);
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Si ya venía rodando desde que se apretó, cae enseguida (lo justo para que el giro se vea)
    const yaRodo = rodandoDesde.current ? Date.now() - rodandoDesde.current : 0;
    rodandoDesde.current = 0;
    setRodando(!quieto);
    const lados = ultima.caras || 6;
    const cambio = quieto ? undefined : setInterval(() => setCaras(ultima.dados.map(() => 1 + Math.floor(Math.random() * lados))), 70);
    const fin = setTimeout(() => { clearInterval(cambio); setRodando(false); }, quieto ? 0 : Math.max(250, RUEDA_MS - yaRodo));
    const ocultar = setTimeout(() => setVisible(null), 4500 + RUEDA_MS);
    return () => { clearInterval(cambio); clearTimeout(fin); clearTimeout(ocultar); };
  }, [ultima]);

  if (pendiente && (!visible || visible.cuando < pendiente.desde)) {
    return (
      <div role="status" className={`pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 ${lugar}`}>
        <div className="tarjeta flex items-center gap-4 px-5 py-3">
          <div className="font-titulo text-[15px]">{pendiente.etiqueta}…</div>
          <Dado valor={carasPendientes} caras={20} />
        </div>
      </div>
    );
  }
  if (!visible) return null;
  const nat = natural(visible);
  if (rodando) {
    return (
      <div role="status" className={`pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 ${lugar}`}>
        <div className="tarjeta flex items-center gap-4 px-5 py-3">
          <div className="text-sm"><span className="font-medium">{visible.quien}</span> · {visible.etiqueta}</div>
          <div className="flex gap-1.5">
            {visible.dados.slice(0, 4).map((_, i) => <Dado key={i} valor={caras[i] ?? '?'} caras={visible.caras} />)}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div role="status" className={`pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 ${lugar}`}>
      <div className={`flex items-center gap-4 rounded-2xl border-2 bg-superficie px-5 py-3 shadow-lg ${nat === 'critico' ? 'border-acento' : nat === 'pifia' ? 'border-peligro' : 'border-borde'}`}>
        <div>
          <div className="text-sm"><span className="font-medium">{visible.quien}</span> · {visible.etiqueta}</div>
          <div className="text-xs text-texto-suave tabular-nums">{textoTirada(visible)}</div>
          <Resultado t={visible} verCd={verCd} />
        </div>
        <span className="resultado-pop font-titulo text-4xl font-bold tabular-nums">{visible.total}</span>
      </div>
    </div>
  );
}

// Un dado dibujado a mano que rueda: un d20 es un hexágono con su triángulo; los demás, un cuadrado con esquinas blandas
function Dado({ valor, caras }: { valor: number | string; caras: number }) {
  return (
    <span className="dado-rueda relative flex size-12 items-center justify-center text-acento">
      <svg viewBox="0 0 48 48" className="absolute inset-0" aria-hidden>
        {caras === 20 ? (
          <>
            <path d="M24 2.5 L43.5 13.4 L43.2 35.2 L24.3 45.6 L4.6 34.9 L4.4 13.1 Z" fill="var(--superficie)" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
            <path d="M24 9 L37 31.5 L11 31.5 Z" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round" opacity={0.55} />
          </>
        ) : (
          <rect x={5} y={5} width={38} height={38} rx={8} fill="var(--superficie)" stroke="currentColor" strokeWidth={2.2} />
        )}
      </svg>
      <span className="relative font-titulo text-[17px] font-bold tabular-nums text-texto">{valor}</span>
    </span>
  );
}

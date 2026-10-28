import { useEffect, useRef, useState } from 'react';
import { GRADOS, leerExpresion, type Grado } from '../../reglas/pf2e';
import type { QueTirar, Tirada } from '../../compartido/sala';
import { textoTirada } from '../../compartido/tiradas';
import { claseBotonPrincipal, claseEntrada, Seccion } from './ui';
import { Dados3D } from './dados/Dados3D';
import type { DadoPedido } from './dados/motor';
import { CirculoTinta, Estampa, FlechaTinta, Salpicadura, semillaDe } from './dados/Tinta';

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
// Contra qué se tiró: una CD si fue con una skill ("Treat Wounds (Medicine)", "Recall Knowledge (Society)"); si no, la CA
const CON_SKILL = /\((Acrobatics|Arcana|Athletics|Crafting|Deception|Diplomacy|Intimidation|Medicine|Nature|Occultism|Performance|Religion|Society|Stealth|Survival|Thievery|Perception)\)/;
function siglaDe(t: Tirada) {
  return CON_SKILL.test(t.etiqueta) ? 'CD' : 'CA';
}

// La CD de una salvación contra tu propio conjuro la conoces (es tuya); la CA y la CD de los demás, solo el GM
function cdVisible(t: Tirada, verCd: boolean, mio?: string) {
  return verCd || (!!mio && !!t.objetivo?.salvacion && t.autorTokenId === mio);
}

function Resultado({ t, verCd }: { t: Tirada; verCd: boolean }) {
  if (!t.objetivo) return null;
  // Daño u otra tirada sin CA: solo a quién iba
  if (!t.objetivo.grado) return <span className="mt-1 block text-xs text-texto-suave">a {t.objetivo.nombre}</span>;
  return (
    <span className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className={`rounded-full px-2 py-0.5 font-medium ${COLOR_GRADO[t.objetivo.grado]}`}>{t.objetivo.salvacion ? SELLO_SALVACION[t.objetivo.grado].texto : GRADOS[t.objetivo.grado]}</span>
      <span className="text-texto-suave">{t.objetivo.salvacion ? `salvación${verCd ? ` contra CD ${t.objetivo.cd}` : ''}` : `contra ${t.objetivo.nombre}${verCd ? ` (${siglaDe(t)} ${t.objetivo.cd})` : ''}`}</span>
      {t.resultado && <span className="font-medium text-peligro">{textoResultado(t.resultado)}</span>}
    </span>
  );
}

export function ListaTiradas({ tiradas, verCd, mio }: { tiradas: Tirada[]; verCd: boolean; mio?: string }) {
  if (tiradas.length === 0) {
    return <p className="text-sm text-texto-suave">Las tiradas de todos aparecen aquí. Toca una skill, salvación o ataque en tu ficha para tirar.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {[...tiradas].reverse().map((t) => <FilaTirada key={t.id} t={t} verCd={cdVisible(t, verCd, mio)} />)}
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
  onTirar: (que: QueTirar, secreto?: boolean) => void;
}) {
  const [expresion, setExpresion] = useState('1d20');
  // Solo el GM: una tirada que nadie más ve (Recall Knowledge, Perception contra una trampa)
  const [secreto, setSecreto] = useState(false);
  const [etiqueta, setEtiqueta] = useState('');
  const [error, setError] = useState('');

  function tirar() {
    if (!leerExpresion(expresion)) {
      setError('Escribe dados como 1d20+7 o 2d6+3');
      return;
    }
    onTirar({ tipo: 'libre', expresion, ...(etiqueta.trim() ? { etiqueta: etiqueta.trim() } : {}), ...(objetivo ? { objetivo: objetivo.id } : {}) }, esGM && secreto);
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
        {esGM && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-acento" checked={secreto} onChange={(e) => setSecreto(e.target.checked)} />
            En secreto: solo tú ves el resultado
          </label>
        )}
        <p className="text-xs text-texto-suave">
          {objetivo ? `Si es un d20, se compara con la CA de ${objetivo.nombre}.` : 'Toca un token en el tablero para tirar contra su CA.'}
        </p>
      </form>
    </Seccion>
  );
}

// Lo que tarda el dado en caer (igual que el motor 3D) y cuánto queda a la vista la tarjeta
const CAIDA_MS = 800;
const DURA_MS = 5400;

// Tarjeta flotante con la última tirada, para que todos la vean aunque estén mirando el tablero.
// El dado 3D empieza a girar al apretar (la tirada viene en camino), cae en su cara y entonces
// la cuenta se escribe a tinta: el total en un círculo a mano y el resultado como un sello.
// `lugar`: dónde flota la tarjeta (en la mesa del jugador, en escritorio, arriba para no tapar la hoja)
export function AvisoTirada({ tiradas, verCd, mio, pendiente = null, lugar = 'bottom-[156px] lg:bottom-6' }: {
  tiradas: Tirada[];
  verCd: boolean;
  mio?: string;
  pendiente?: { etiqueta: string; desde: number; caras?: number } | null;
  lugar?: string;
}) {
  const ultima = tiradas.at(-1);
  const [visible, setVisible] = useState<Tirada | null>(null);
  // Ya cayó el dado: se escribe la cuenta
  const [asentada, setAsentada] = useState(false);
  const vista = useRef(ultima?.id);

  // El motor 3D se trae en cuanto la mesa está tranquila: así el primer dado ya gira al apretar
  useEffect(() => {
    const t = setTimeout(() => void import('./dados/motor').catch(() => undefined), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ultima || ultima.id === vista.current) return;
    vista.current = ultima.id;
    setVisible(ultima);
    setAsentada(false);
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cae = setTimeout(() => setAsentada(true), quieto ? 0 : CAIDA_MS + 120 + Math.min(3, ultima.dados.length - 1) * 90);
    const ocultar = setTimeout(() => setVisible(null), DURA_MS);
    return () => { clearTimeout(cae); clearTimeout(ocultar); };
  }, [ultima]);

  const esperando = !!pendiente && (!visible || visible.cuando < pendiente.desde);
  if (!esperando && !visible) return null;
  const dados: DadoPedido[] = esperando || !visible
    ? [{ caras: pendiente?.caras ?? 20 }]
    : visible.dados.map((valor) => ({ caras: visible.caras, valor }));
  const nat = visible && !esperando ? natural(visible) : null;

  return (
    <div role="status" className={`pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 ${lugar}`}>
      <div className={`tarjeta relative flex max-w-full items-center gap-2 py-2 pr-5 pl-2 ${nat === 'critico' && asentada ? 'ring-2 ring-acento/60' : ''}`}>
        <span aria-hidden className="absolute -top-2 left-9 h-4 w-14 -rotate-3 bg-[var(--cinta)]" />
        <Dados3D dados={dados} tamano={92} />
        <div className="min-w-0">
          <p className="truncate font-titulo text-[14px] text-texto-suave">
            {esperando || !visible ? `${pendiente!.etiqueta}…` : <><span className="text-texto">{visible.quien}</span> · {visible.etiqueta}</>}
          </p>
          {visible && !esperando && (asentada
            ? <NotaTirada t={visible} verCd={cdVisible(visible, verCd, mio)} nat={nat} />
            : <p className="font-titulo text-[15px] text-texto-suave">rodando…</p>)}
        </div>
      </div>
    </div>
  );
}

const SELLO: Record<Grado, { texto: string; color: string }> = {
  critico: { texto: '¡Crítico!', color: 'var(--acento)' },
  exito: { texto: '¡Le diste!', color: 'var(--exito)' },
  fallo: { texto: 'Falló', color: 'var(--texto-suave)' },
  pifia: { texto: 'Pifia', color: 'var(--peligro)' },
};
// En una salvación quien tiró es el objetivo: el sello dice cómo resistió
const SELLO_SALVACION: Record<Grado, { texto: string; color: string }> = {
  critico: { texto: 'Resiste', color: 'var(--exito)' },
  exito: { texto: 'A medias', color: 'var(--texto-suave)' },
  fallo: { texto: 'No salva', color: 'var(--peligro)' },
  pifia: { texto: '¡Falla feo!', color: 'var(--peligro)' },
};

// Verde lo que salió bien sin hacer daño: una curación, o un chequeo propio logrado (te sueltas, recuerdas algo)
function bueno(t: Tirada) {
  const r = t.resultado;
  if (!r || r.dano) return false;
  return !!r.curacion || (!t.objetivo?.salvacion && (t.objetivo?.grado === 'exito' || t.objetivo?.grado === 'critico'));
}

// Lo que el motor ya aplicó: "−9 acid · resistencia…", "+12 PG", "queda Frightened 2"
function textoResultado(r: NonNullable<Tirada['resultado']>): string {
  return [r.dano !== undefined ? (r.dano ? `−${r.dano} PG${r.tipo ? ` (${r.tipo})` : ''}` : 'sin daño') : null, r.curacion ? `+${r.curacion} PG` : null, r.nota].filter(Boolean).join(' · ');
}

// La cuenta a tinta: los dados y el modificador a lápiz, el total en un círculo; el daño, sobre una mancha roja
function NotaTirada({ t, verCd, nat }: { t: Tirada; verCd: boolean; nat: 'critico' | 'pifia' | null }) {
  const dano = !t.objetivo?.grado && t.etiqueta.startsWith('Daño');
  const critico = t.etiqueta.startsWith('Daño crítico');
  const suma = t.modificador ? `${t.dados.join(' + ')} ${t.modificador > 0 ? '+' : '−'} ${Math.abs(t.modificador)}` : t.dados.join(' + ');
  const cuenta = critico ? `(${suma}) × 2` : suma;
  const sello = t.objetivo?.grado ? (t.objetivo.salvacion ? SELLO_SALVACION : SELLO)[t.objetivo.grado] : null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-titulo text-[15px] whitespace-nowrap text-texto-suave tabular-nums">{cuenta} =</span>
        {dano ? (
          <span className="relative inline-flex items-center justify-center px-2">
            <Salpicadura semilla={semillaDe(t.id)} className="absolute -inset-x-1 -inset-y-3 h-[calc(100%+24px)] w-[calc(100%+8px)]" />
            <b className="resultado-pop relative font-titulo text-[30px] leading-none text-white tabular-nums">{t.total}</b>
          </span>
        ) : (
          <CirculoTinta color={nat === 'pifia' ? 'var(--peligro)' : 'var(--acento)'}>
            <b className="resultado-pop font-titulo text-[32px] leading-none tabular-nums">{t.total}</b>
          </CirculoTinta>
        )}
        {nat && (
          <span className={`flex items-center gap-0.5 font-titulo text-[13px] font-semibold ${nat === 'critico' ? 'text-acento' : 'text-peligro'}`}>
            <FlechaTinta className="h-3.5 w-6" />
            {nat === 'critico' ? '¡20 natural!' : '1 natural'}
          </span>
        )}
      </div>
      {sello && (
        <div className="flex flex-wrap items-center gap-2">
          <Estampa color={sello.color}>{sello.texto}</Estampa>
          <span className="font-titulo text-[13px] text-texto-suave">
            {t.objetivo!.salvacion ? (verCd && t.objetivo!.cd ? `contra CD ${t.objetivo!.cd}` : 'en su salvación') : `contra ${t.objetivo!.nombre}${verCd && t.objetivo!.cd ? ` (${siglaDe(t)} ${t.objetivo!.cd})` : ''}`}
          </span>
        </div>
      )}
      {!sello && t.objetivo && <span className="font-titulo text-[13px] text-texto-suave">{dano ? 'de daño a' : t.resultado?.curacion ? 'curación a' : 'contra'} {t.objetivo.nombre}</span>}
      {/* Lo que cura, en verde; lo que daña o pasa, en rojo */}
      {t.resultado && <span className={`font-titulo text-[13px] font-semibold ${bueno(t) ? 'text-exito' : 'text-peligro'}`}>{textoResultado(t.resultado)}</span>}
    </div>
  );
}

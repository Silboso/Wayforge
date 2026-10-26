import { CrosshairIcon, XIcon } from '@phosphor-icons/react';
import { GRUPOS, grupoDe } from '../../../reglas/aptitudes';
import { signo, type Valor } from '../../../reglas/pf2e';
import type { Fila, Seccion } from './secciones';
import { CostoAccion, RayaAMano, Rombo, Tecla } from './piezas';

// Cuántas acciones le faltan para poder usar una fila en su turno (0 si le alcanza o si no es su turno)
export function faltan(fila: Fila, libres: number | null): number {
  if (libres === null) return 0;
  const costo = fila.tipo === 'golpe' ? 1 : fila.aptitud.costo;
  return typeof costo === 'number' ? Math.max(0, costo - libres) : 0;
}

// La lista de una sección, como renglones de cuaderno. La fila que probablemente toca va con marcatextos.
export function ListaAcciones({ seccion, elegida, marcada, teclas, libres = null, onElegir }: {
  seccion: Seccion;
  elegida: string | null;
  marcada: string | null;
  teclas?: string[];
  // Acciones que le quedan en su turno; null fuera de su turno
  libres?: number | null;
  onElegir: (fila: Fila) => void;
}) {
  return (
    <ul className="flex flex-col">
      {seccion.filas.map((fila, i) => {
        const sinAcciones = faltan(fila, libres) > 0;
        const agotada = (fila.tipo === 'aptitud' && !fila.disp.puede) || sinAcciones;
        const abierta = elegida === fila.clave;
        return (
          <li key={fila.clave}>
            <button
              className={`group grid min-h-[44px] w-full items-center gap-2 border-b border-dashed border-borde px-1 py-1 text-left transition-colors hover:bg-acento/[0.06] pointer-fine:min-h-[34px] pointer-fine:py-0.5 ${teclas ? 'grid-cols-[52px_minmax(0,1fr)_auto_auto]' : 'grid-cols-[48px_minmax(0,1fr)_auto]'} ${abierta ? 'bg-acento/[0.08]' : ''}`}
              aria-expanded={abierta}
              onClick={() => onElegir(fila)}
            >
              <span className="flex justify-center">
                {fila.tipo === 'golpe' ? <Rombo className="size-3.5" tachado={sinAcciones} lleno={!sinAcciones} /> : <CostoAccion costo={fila.aptitud.costo} tachado={sinAcciones} />}
              </span>
              <span className={`min-w-0 pointer-fine:flex pointer-fine:items-baseline pointer-fine:gap-2 ${agotada ? 'opacity-55' : ''}`}>
                <span className={`font-titulo text-[16px] font-semibold ${marcada === fila.clave ? 'marcatextos' : ''} ${agotada ? 'line-through decoration-texto decoration-2' : ''}`}>
                  {fila.nombre}
                </span>
                <span className="block truncate text-[12.5px] text-texto-suave pointer-fine:min-w-0 pointer-fine:flex-1">
                  {fila.tipo === 'aptitud' && fila.aptitud.recuperacion.tipo !== 'siempre' ? `${fila.disp.texto}${fila.detalle ? ` · ${fila.detalle}` : ''}` : fila.detalle}
                </span>
              </span>
              <span className={`whitespace-nowrap font-titulo text-[19px] font-bold text-acento ${agotada ? 'opacity-55' : ''}`}>{fila.valor}</span>
              {teclas && <span className="w-6 text-right">{teclas[i] && <Tecla>{teclas[i]}</Tecla>}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// La cuenta escrita: suma, restas en rojo y una raya con el total
export function Cuenta({ valor, total }: { valor: Valor; total?: string }) {
  return (
    <div className="font-titulo text-[14.5px] leading-relaxed">
      {valor.partes.map((p, i) => (
        <div key={i} className={`flex justify-between gap-4 ${p.valor < 0 ? 'text-peligro' : ''}`}>
          <span>{p.etiqueta}</span>
          <span className="tabular-nums">{i === 0 && p.valor >= 0 ? p.valor : signo(p.valor)}</span>
        </div>
      ))}
      <RayaAMano className="mt-1 h-1.5 w-full text-texto" />
      <div className="flex justify-between gap-4 text-[17px] font-bold text-acento">
        <span>{total ?? 'Total'}</span>
        <span className="tabular-nums">{valor.partes[0]?.etiqueta === 'Base' ? valor.total : signo(valor.total)}</span>
      </div>
    </div>
  );
}

export interface AccionesDetalle {
  onAtacar: (numero: 0 | 1 | 2) => void;
  onDano: (critico: boolean) => void;
  onUsar: () => void;
  onCerrar: () => void;
}

// Lo que se ve al tocar una acción: qué hace, cuánto cuesta, cómo se recupera, la cuenta y los botones
export function Detalle({ fila, ataquesHechos, libres = null, objetivo, dano, enCombate, acciones, antes = [], onAbrir }: {
  fila: Fila;
  // Lo que se puede hacer en lugar de un Strike normal (Power Attack, Sudden Charge…)
  antes?: Fila[];
  onAbrir?: (clave: string) => void;
  ataquesHechos: number | null;
  // Acciones que le quedan en su turno; null fuera de su turno
  libres?: number | null;
  objetivo: { nombre: string } | null;
  // Texto del daño del arma, como "1d8+4 slashing"
  dano: string | null;
  enCombate: boolean;
  acciones: AccionesDetalle;
}) {
  const n = Math.min(ataquesHechos ?? 0, 2) as 0 | 1 | 2;
  const agotada = fila.tipo === 'aptitud' && !fila.disp.puede;
  // No se ofrece lo que no alcanza a pagar en su turno
  const falta = faltan(fila, libres);
  const textoFalta = libres === 0 ? 'Sin acciones este turno' : `Te ${falta === 1 ? 'falta 1 acción' : `faltan ${falta} acciones`}`;
  const apuntable = fila.tipo === 'golpe' || fila.aptitud.tirada?.tipo === 'ataque-conjuro';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-1.5">{fila.tipo === 'golpe' ? <Rombo className="size-4" /> : <CostoAccion costo={fila.aptitud.costo} />}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-titulo text-[22px] font-bold leading-tight">{fila.nombre}</h3>
          {fila.detalle && <p className="text-[13px] text-texto-suave">{fila.detalle}</p>}
        </div>
        <button className="-mr-1 -mt-1 flex size-9 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={acciones.onCerrar} aria-label="Cerrar">
          <XIcon size={18} aria-hidden />
        </button>
      </div>

      {fila.tipo === 'golpe' && n > 0 && (
        <p className="text-[14px] leading-snug">Es tu {n + 1}.º ataque del turno: cuesta más acertar ({fila.golpe.agil ? `−${n * 4}` : `−${n * 5}`}{fila.golpe.agil ? ', es agile' : ''}).</p>
      )}
      {fila.tipo === 'aptitud' && (
        <>
          <p className="text-[14px] leading-snug">{fila.aptitud.descripcion || 'Sin descripción.'}</p>
          {fila.aptitud.rasgos.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {fila.aptitud.rasgos.map((r) => (
                <li key={r} className="rounded-sm border border-texto-suave/40 px-1.5 font-titulo text-[12px] lowercase text-texto-suave">{r}</li>
              ))}
            </ul>
          )}
          {fila.aptitud.recuperacion.tipo !== 'siempre' && (
            <p className={`text-[13px] ${agotada ? 'text-peligro' : 'text-texto-suave'}`}>
              <span className="font-semibold">{fila.disp.texto}.</span> {GRUPOS[grupoDe(fila.aptitud)].ayuda}
            </p>
          )}
        </>
      )}

      {apuntable && (
        <p className={`flex items-center gap-2 text-[13.5px] ${objetivo ? '' : 'text-texto-suave'}`}>
          <CrosshairIcon size={17} aria-hidden className="shrink-0" />
          {objetivo ? <span>Contra <strong>{objetivo.nombre}</strong>: la mesa te dice si le das.</span> : 'Toca un enemigo en el tablero para apuntarle.'}
        </p>
      )}

      {fila.tipo === 'golpe' && antes.length > 0 && onAbrir && (
        <div className="rounded-sm border border-dashed border-acento/50 px-3 py-2">
          <p className="font-titulo text-[13.5px] font-semibold text-acento">En vez de un Strike normal, también puedes:</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {antes.map((f) => (
              <li key={f.clave}>
                <button className="flex items-center gap-1.5 rounded-md bg-acento/10 px-2 py-1 font-titulo text-[13.5px] font-semibold text-acento hover:bg-acento/20"
                  onClick={() => onAbrir(f.clave)}>
                  {f.tipo === 'aptitud' && <CostoAccion costo={f.aptitud.costo} />}
                  {f.nombre}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fila.cuenta && (
        <div className="rounded-sm bg-superficie-2/70 px-3 py-2">
          <Cuenta valor={fila.cuenta} total={fila.tipo === 'golpe' ? `Tiras 1d20${n ? ` (${n + 1}.º ataque ${signo(-(fila.golpe.agil ? 4 : 5) * n)})` : ''}` : 'Tiras 1d20'} />
        </div>
      )}

      {fila.tipo === 'golpe' ? (
        <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
          <button className="boli h-12 bg-acento font-titulo text-[17px] font-bold text-sobre-acento shadow-[0_6px_12px_-6px_var(--acento)] transition active:scale-[0.97] disabled:bg-superficie-2 disabled:text-[15px] disabled:text-texto-suave disabled:shadow-none"
            disabled={falta > 0} onClick={() => acciones.onAtacar(n)}>
            {falta > 0 ? 'Sin acciones' : `Atacar ${fila.valor}`}
          </button>
          <button className="boli h-12 border-2 border-acento font-titulo text-[15px] font-semibold text-acento transition hover:bg-acento/10 active:scale-[0.97]"
            onClick={() => acciones.onDano(false)} title={dano ?? undefined}>
            Daño
          </button>
          <button className="boli h-12 border-2 border-acento font-titulo text-[15px] font-semibold text-acento transition hover:bg-acento/10 active:scale-[0.97]"
            onClick={() => acciones.onDano(true)}>
            Crítico ×2
          </button>
        </div>
      ) : (
        <button
          className="boli h-12 bg-acento font-titulo text-[17px] font-bold text-sobre-acento shadow-[0_6px_12px_-6px_var(--acento)] transition active:scale-[0.97] disabled:bg-superficie-2 disabled:text-texto-suave disabled:shadow-none"
          disabled={agotada || falta > 0}
          onClick={acciones.onUsar}
        >
          {agotada
            ? 'No te quedan usos'
            : falta > 0
              ? textoFalta
            : fila.aptitud.tirada
              ? `Usar y tirar${fila.valor ? ` ${fila.valor}` : ''}`
              : enCombate && typeof fila.aptitud.costo === 'number'
                ? `Usar (gasta ${fila.aptitud.costo} ${fila.aptitud.costo === 1 ? 'acción' : 'acciones'})`
                : 'Usar'}
        </button>
      )}
      {fila.tipo === 'golpe' && dano && <p className="-mt-1 text-center text-[12.5px] text-texto-suave">Daño: {dano}</p>}
    </div>
  );
}

import { FootprintsIcon, XIcon } from '@phosphor-icons/react';
import type { Personaje } from '../../../reglas/pf2e';
import { alcanzables, desdeClave, distanciaEntre, type Casilla } from '../../../reglas/movimiento';
import {
  ladoDe, motivoAlcance, motivoParaActuar, opcionesMovimiento, velocidadDe, type EstadoSala, type Token,
} from '../../../compartido/sala';
import type { Aptitud } from '../../../reglas/aptitudes';
import { estadoDeSalud } from '../../../reglas/criaturas';
import type { Fila } from './secciones';
import { CostoAccion, Rombo } from './piezas';

interface Opcion {
  clave: string;
  nombre: string;
  costo: Aptitud['costo'];
  valor: string | null;
  // Por qué no se puede ahora (null: se puede)
  motivo: string | null;
  hacer: () => void;
}

// Lo que se puede hacer contra un token tocado en el tablero: atacar, asustar, agarrar…
// Cada opción muestra su número; lo que no se puede, dice por qué. Si está lejos, ofrece acercarse.
export function MenuObjetivo({ estado, p, miToken, objetivo, filas, ataquesHechos, onAtacar, onUsar, onAcercar, onCerrar }: {
  estado: EstadoSala;
  p: Personaje;
  miToken: Token;
  objetivo: Token;
  filas: Fila[];
  ataquesHechos: number | null;
  onAtacar: (golpeId: string, numero: 0 | 1 | 2) => void;
  onUsar: (a: Aptitud) => void;
  onAcercar: (c: Casilla) => void;
  onCerrar: () => void;
}) {
  const pies = distanciaEntre(miToken, ladoDe(miToken), objetivo, ladoDe(objetivo));
  const n = Math.min(ataquesHechos ?? 0, 2) as 0 | 1 | 2;
  const turno = motivoParaActuar(estado, p.id, 1);

  const opciones: Opcion[] = [];
  for (const f of filas) {
    if (f.tipo === 'golpe') {
      opciones.push({
        clave: f.clave, nombre: `${n === 0 ? 'Atacar' : 'Atacar otra vez'} con ${f.golpe.nombre}`, costo: 1, valor: f.valor,
        motivo: turno ?? motivoAlcance(miToken, objetivo, f.golpe.distancia ?? 5),
        hacer: () => onAtacar(f.golpe.id, n),
      });
      continue;
    }
    const a = f.aptitud;
    const apuntable = a.tirada && (a.tirada.tipo === 'golpe' || a.tirada.tipo === 'ataque-conjuro' || (a.tirada.tipo === 'skill' && a.distancia));
    if (!apuntable || a.costo === 'reaccion' || a.costo === 'larga') continue;
    const distancia = a.tirada?.tipo === 'golpe' ? (p.golpes[0]?.distancia ?? 5) : a.distancia;
    opciones.push({
      clave: f.clave, nombre: f.nombre, costo: a.costo, valor: f.valor,
      motivo: motivoParaActuar(estado, p.id, a.costo)
        ?? (f.disp.puede ? null : `${f.disp.texto}.`)
        ?? (distancia !== undefined ? motivoAlcance(miToken, objetivo, distancia) : null),
      hacer: () => onUsar(a),
    });
  }

  // Si no llega cuerpo a cuerpo y le quedan acciones: la casilla al lado más cerca para un Stride
  const libres = estado.combate ? estado.combate.acciones - estado.combate.usadas : null;
  const acercarse = (() => {
    if (pies <= 5 || turno || !libres) return null;
    const zona = alcanzables({ x: miToken.x, y: miToken.y }, velocidadDe(estado, miToken), opcionesMovimiento(estado, miToken));
    let mejor: { c: Casilla; pies: number } | null = null;
    for (const [k, paso] of zona) {
      const c = desdeClave(k);
      if (distanciaEntre(c, ladoDe(miToken), objetivo, ladoDe(objetivo)) > 5) continue;
      if (!mejor || paso.pies < mejor.pies) mejor = { c, pies: paso.pies };
    }
    return mejor;
  })();

  return (
    <div className="tarjeta aviso-entra px-3.5 py-3" role="dialog" aria-label={`Opciones contra ${objetivo.nombre}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-titulo text-[18px] leading-tight font-bold">{objetivo.nombre}</p>
          <p className="text-[12.5px] text-texto-suave">A {pies} ft de ti{objetivo.pg && !objetivo.personajeId ? ` · se ve ${estadoDeSalud(objetivo.pg)}` : ''}{objetivo.condiciones?.length ? ` · ${objetivo.condiciones.map((c) => c.clave).join(', ')}` : ''}</p>
        </div>
        <button className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={onCerrar} aria-label="Cerrar">
          <XIcon size={16} aria-hidden />
        </button>
      </div>
      {turno && <p className="mt-1.5 rounded-sm bg-superficie-2 px-2 py-1 font-titulo text-[13.5px] text-peligro">{turno}</p>}
      {/* Si no llega, lo primero que se ofrece es acercarse */}
      {acercarse && (
        <button className="boli mt-2 flex h-10 w-full items-center justify-center gap-2 border-[1.5px] border-acento font-titulo text-[14.5px] font-semibold text-acento hover:bg-acento/10"
          onClick={() => onAcercar(acercarse.c)}>
          <FootprintsIcon size={18} aria-hidden /> Acercarte ({acercarse.pies} ft, 1 acción)
        </button>
      )}
      <ul className="mt-2 flex flex-col gap-1">
        {opciones.map((o) => (
          <li key={o.clave}>
            <button
              className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-acento/10 disabled:hover:bg-transparent"
              disabled={!!o.motivo}
              onClick={o.hacer}
            >
              <span className={`w-8 shrink-0 ${o.motivo ? 'opacity-50' : ''}`}>
                {typeof o.costo === 'number' ? <CostoAccion costo={o.costo} tachado={!!o.motivo} /> : <Rombo className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-titulo text-[15px] font-semibold ${o.motivo ? 'text-texto-suave' : ''}`}>{o.nombre}</span>
                {o.motivo && !turno && <span className="block text-[12px] leading-snug text-peligro">{o.motivo}</span>}
              </span>
              {o.valor && <span className={`font-titulo text-[18px] font-bold ${o.motivo ? 'text-texto-suave' : 'text-acento'}`}>{o.valor}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

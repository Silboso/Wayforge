import { useState } from 'react';
import { MinusIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { CONDICIONES, type ClaveCondicion, type Condicion } from '../../reglas/condiciones';
import { claseBotonIcono, claseEntrada } from './ui';

// Condiciones activas de un token: cada una con su explicación, su número y cómo quitarla
export function EditorCondiciones({ condiciones, puedeEditar, onPoner }: {
  condiciones: Condicion[];
  puedeEditar: boolean;
  onPoner: (clave: ClaveCondicion, valor: number) => void;
}) {
  const [abierta, setAbierta] = useState<ClaveCondicion | null>(null);
  const disponibles = (Object.keys(CONDICIONES) as ClaveCondicion[]).filter((c) => !condiciones.some((x) => x.clave === c));

  return (
    <div className="flex flex-col gap-2">
      {condiciones.length === 0 && <p className="text-sm text-texto-suave">Sin condiciones.</p>}
      <ul className="flex flex-col gap-1.5">
        {condiciones.map((c) => {
          const def = CONDICIONES[c.clave];
          return (
            <li key={c.clave} className="rounded-lg border border-borde bg-superficie">
              <div className="flex items-center gap-1 pl-3">
                <button className="flex-1 py-2 text-left font-medium" aria-expanded={abierta === c.clave}
                  onClick={() => setAbierta(abierta === c.clave ? null : c.clave)}>
                  {def.nombre}{def.conValor ? ` ${c.valor}` : ''}
                </button>
                {puedeEditar && def.conValor && (
                  <>
                    <button className={claseBotonIcono} aria-label={`Bajar ${def.nombre}`} onClick={() => onPoner(c.clave, c.valor - 1)}>
                      <MinusIcon size={16} weight="bold" aria-hidden />
                    </button>
                    <button className={claseBotonIcono} aria-label={`Subir ${def.nombre}`} onClick={() => onPoner(c.clave, c.valor + 1)}>
                      <PlusIcon size={16} weight="bold" aria-hidden />
                    </button>
                  </>
                )}
                {puedeEditar && (
                  <button className={claseBotonIcono} aria-label={`Quitar ${def.nombre}`} onClick={() => onPoner(c.clave, 0)}>
                    <XIcon size={16} aria-hidden />
                  </button>
                )}
              </div>
              {abierta === c.clave && <p className="px-3 pb-2 text-sm text-texto-suave">{def.ayuda}</p>}
            </li>
          );
        })}
      </ul>
      {puedeEditar && (
        <select
          className={claseEntrada}
          value=""
          aria-label="Agregar condición"
          onChange={(e) => e.target.value && onPoner(e.target.value as ClaveCondicion, 1)}
        >
          <option value="">+ Agregar condición…</option>
          {disponibles.map((c) => <option key={c} value={c}>{CONDICIONES[c].nombre}</option>)}
        </select>
      )}
    </div>
  );
}

// "Frightened 1 · Prone": para mostrar bajo el token y en el orden de iniciativa
export function resumenCondiciones(condiciones: Condicion[] = []): string {
  return condiciones.map((c) => `${CONDICIONES[c.clave].nombre}${CONDICIONES[c.clave].conValor ? ` ${c.valor}` : ''}`).join(' · ');
}

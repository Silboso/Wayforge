import { useState } from 'react';
import { MagnifyingGlassIcon, MinusIcon, PlusIcon } from '@phosphor-icons/react';
import { signo } from '../../../reglas/pf2e';
import { penalizacionesAtaque } from '../../../reglas/criaturas';
import { BESTIARIO, type Plantilla } from '../../../reglas/datos/bestiario';
import { COLORES_TOKEN, TAMANOS, type Accion, type EstadoSala, type Token } from '../../../compartido/sala';

// Dónde poner criaturas nuevas: cerca de la casilla pedida, sin pisar a nadie
function casillasLibres(estado: EstadoSala, cerca: { x: number; y: number }, cuantas: number): { x: number; y: number }[] {
  const ocupadas = new Set<string>();
  for (const t of Object.values(estado.tokens)) {
    const n = Math.max(1, TAMANOS[t.tamano]);
    for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) ocupadas.add(`${t.x + dx},${t.y + dy}`);
  }
  const libres: { x: number; y: number }[] = [];
  for (let r = 0; r < 30 && libres.length < cuantas; r++) {
    for (let dy = -r; dy <= r && libres.length < cuantas; dy++) {
      for (let dx = -r; dx <= r && libres.length < cuantas; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const c = { x: cerca.x + dx, y: cerca.y + dy };
        if (c.x < 0 || c.y < 0 || ocupadas.has(`${c.x},${c.y}`)) continue;
        ocupadas.add(`${c.x},${c.y}`);
        libres.push(c);
      }
    }
  }
  return libres;
}

// El bestiario: criaturas listas para el tablero, con sus números a la vista
export function PanelBestiario({ estado, enviar, cerca, onCreados }: {
  estado: EstadoSala;
  enviar: (accion: Accion) => void;
  // La casilla alrededor de la cual aparecen (el centro de lo que mira el GM)
  cerca: { x: number; y: number };
  onCreados: (ids: string[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const [cuantos, setCuantos] = useState<Record<string, number>>({});
  const lista = BESTIARIO.filter((b) => `${b.nombre} ${b.descripcion} ${b.criatura.rasgos.join(' ')}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => a.criatura.nivel - b.criatura.nivel);

  function agregar(b: Plantilla) {
    const n = cuantos[b.id] ?? 1;
    const lugares = casillasLibres(estado, cerca, n);
    const existentes = Object.values(estado.tokens).filter((t) => t.nombre.startsWith(b.nombre)).length;
    const ids: string[] = [];
    lugares.forEach((c, i) => {
      const token: Token = {
        id: crypto.randomUUID(),
        // Varios iguales se numeran para no confundirlos: Goblin Warrior 2, 3…
        nombre: n > 1 || existentes ? `${b.nombre} ${existentes + i + 1}` : b.nombre,
        tipo: 'enemigo', tamano: b.tamano, x: c.x, y: c.y, color: COLORES_TOKEN.enemigo,
        ca: b.ca, pg: { actual: b.pg, max: b.pg }, percepcion: b.percepcion, criatura: b.criatura,
      };
      enviar({ tipo: 'crear-token', token });
      ids.push(token.id);
    });
    onCreados(ids);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <MagnifyingGlassIcon size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" aria-hidden />
        <input className="h-10 w-full rounded-lg border border-borde bg-superficie pr-3 pl-9" value={busca} placeholder="Buscar (goblin, undead, animal…)" aria-label="Buscar criatura" onChange={(e) => setBusca(e.target.value)} />
      </label>
      <p className="text-[12.5px] text-texto-suave">Valores de referencia del Monster Core. Después de ponerlas, toca una para ajustar sus números.</p>
      <ul className="flex flex-col gap-2.5">
        {lista.map((b) => {
          const n = cuantos[b.id] ?? 1;
          return (
            <li key={b.id} className="rounded-lg border border-borde bg-superficie px-3 py-2.5">
              <div className="flex items-baseline gap-2">
                <b className="font-titulo text-[17px] text-peligro">{b.nombre}</b>
                <span className="font-titulo text-[13px] text-texto-suave">nivel {b.criatura.nivel}</span>
                <span className="ml-auto font-titulo text-[13.5px]">CA <b>{b.ca}</b> · PG <b>{b.pg}</b></span>
              </div>
              <p className="text-[12.5px] text-texto-suave">{b.descripcion}</p>
              <p className="mt-1 text-[12.5px]">
                {b.criatura.ataques.map((a) => `${a.nombre} ${signo(penalizacionesAtaque(a)[0])} (${a.dano})`).join(' · ')}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <button className="flex size-8 items-center justify-center rounded-md border border-borde" aria-label="Menos" onClick={() => setCuantos({ ...cuantos, [b.id]: Math.max(1, n - 1) })}><MinusIcon size={13} /></button>
                  <span className="w-6 text-center font-titulo text-[15px] font-bold">{n}</span>
                  <button className="flex size-8 items-center justify-center rounded-md border border-borde" aria-label="Más" onClick={() => setCuantos({ ...cuantos, [b.id]: Math.min(8, n + 1) })}><PlusIcon size={13} /></button>
                </span>
                <button className="boli ml-auto h-9 bg-acento px-3 font-titulo text-[14px] font-bold text-sobre-acento" onClick={() => agregar(b)}>
                  Poner {n > 1 ? `${n} en` : 'en'} el tablero
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

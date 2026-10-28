import { useState } from 'react';
import { criaturaDeCompendio, type CriaturaCompendio } from '../../../reglas/compendio';
import { COLORES_TOKEN, TAMANOS, type Accion, type EstadoSala, type Token } from '../../../compartido/sala';
import { PanelCompendio } from '../compendio/PanelCompendio';
import { agregarObjeto, consumibleDeCompendio, escudoDe, objetoDeCompendio } from '../../../reglas/objetos';

// Dónde poner criaturas nuevas: cerca de la casilla pedida, sin pisar a nadie (todas las casillas que ocupa si es grande)
export function casillasLibres(estado: EstadoSala, cerca: { x: number; y: number }, cuantas: number, lado = 1): { x: number; y: number }[] {
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
        const pisa: string[] = [];
        for (let ox = 0; ox < lado; ox++) for (let oy = 0; oy < lado; oy++) pisa.push(`${c.x + ox},${c.y + oy}`);
        if (c.x < 0 || c.y < 0 || pisa.some((k) => ocupadas.has(k))) continue;
        pisa.forEach((k) => ocupadas.add(k));
        libres.push(c);
      }
    }
  }
  return libres;
}

// El compendio del GM: todo Pathfinder para consultar, y cualquier criatura de los bestiarios al tablero (1 a 6 iguales)
export function PanelBestiario({ estado, enviar, cerca, onCreados, onDecir }: {
  estado: EstadoSala;
  enviar: (accion: Accion) => void;
  // Para avisarle al jugador lo que le dio (un susurro)
  onDecir?: (texto: string, para?: string) => void;
  // La casilla alrededor de la cual aparecen
  cerca: { x: number; y: number };
  onCreados: (ids: string[]) => void;
}) {
  const [cuantas, setCuantas] = useState(1);

  function poner(c: CriaturaCompendio) {
    const d = criaturaDeCompendio(c);
    const lugares = casillasLibres(estado, cerca, cuantas, Math.max(1, TAMANOS[d.tamano]));
    const existentes = Object.values(estado.tokens).filter((t) => t.nombre.startsWith(c.nombre)).length;
    const ids: string[] = [];
    lugares.forEach((lugar, i) => {
      const token: Token = {
        id: crypto.randomUUID(),
        // Varias iguales se numeran para no confundirlas: Goblin Warrior 2, 3…
        nombre: (cuantas > 1 || existentes ? `${c.nombre} ${existentes + i + 1}` : c.nombre).slice(0, 60),
        tipo: 'enemigo', tamano: d.tamano, x: lugar.x, y: lugar.y, color: COLORES_TOKEN.enemigo,
        ca: d.ca, pg: { actual: d.pg, max: d.pg }, percepcion: d.percepcion, criatura: d.criatura,
      };
      enviar({ tipo: 'crear-token', token });
      ids.push(token.id);
    });
    onCreados(ids);
  }

  const deACuantas = (
      <div className="flex items-center gap-2 font-titulo text-[13.5px] text-texto-suave">
        Poner de a:
        {[1, 2, 3, 4, 6].map((n) => (
          <button key={n} aria-pressed={cuantas === n} onClick={() => setCuantas(n)}
            className={`h-8 min-w-8 rounded-md border-[1.5px] px-1.5 font-semibold transition ${cuantas === n ? 'border-acento bg-acento text-sobre-acento' : 'border-borde hover:border-acento/60'}`}>
            {n}
          </button>
        ))}
      </div>
  );
  return (
      <PanelCompendio tipoInicial="criaturas" conCriaturas={deACuantas} acciones={{
        onPonerCriatura: poner,
        darA: Object.values(estado.personajes).map((p) => ({ id: p.id, nombre: p.nombre })),
        // El botín va a la mochila (los consumibles con su acción; un escudo, embrazado si no tenía) y se le avisa
        onDarObjeto: (e, personajeId) => {
          const p = estado.personajes[personajeId];
          if (!p) return;
          const escudo = !p.escudo && e.escudo ? escudoDe(e) : null;
          enviar({ tipo: 'editar-personaje', id: p.id, cambios: { ...agregarObjeto(p, objetoDeCompendio(e), consumibleDeCompendio(e)), ...(escudo ? { escudo } : {}) } });
          onDecir?.(`Te doy ${e.nombre}: ya está en tu mochila.`, p.id);
        },
      }} />
  );
}

// La luz sobre el tablero: la oscuridad (azul de noche, más espesa donde no llega ninguna luz), los braseros que
// pone el GM y el control de la antorcha que lleva un token.

import { useMemo } from 'react';
import { Group, Circle, Image as ImagenKonva, Shape } from 'react-konva';
import { FlameIcon } from '@phosphor-icons/react';
import { FUENTES, type Brillo, type Luz } from '../../compartido/vision';
import type { ColoresTablero } from '../tema';

const NOCHE = '#0b1226';

// La oscuridad por casilla (0 nada, 1 del todo), pintada a baja resolución y difuminada
export function CapaOscuridad({ sombra, columnas, filas, celda, origen }: {
  sombra: (k: string) => number;
  columnas: number;
  filas: number;
  celda: number;
  origen: { x: number; y: number };
}) {
  // La firma decide cuándo repintar: el mismo mapa de sombras no se vuelve a dibujar
  const valores: number[] = [];
  for (let y = 0; y < filas; y++) for (let x = 0; x < columnas; x++) valores.push(sombra(`${x},${y}`));
  const firma = valores.join(',');
  const lienzo = useMemo(() => {
    if (typeof document === 'undefined' || valores.every((v) => v === 0)) return null;
    const K = 10;
    const base = document.createElement('canvas');
    base.width = columnas * K;
    base.height = filas * K;
    const c = base.getContext('2d');
    if (!c) return null;
    c.fillStyle = NOCHE;
    valores.forEach((v, i) => {
      if (!v) return;
      c.globalAlpha = v;
      c.fillRect((i % columnas) * K, Math.floor(i / columnas) * K, K, K);
    });
    const suave = document.createElement('canvas');
    suave.width = base.width;
    suave.height = base.height;
    const s = suave.getContext('2d');
    if (!s || !('filter' in s)) return base;
    s.filter = `blur(${K * 0.45}px)`;
    s.drawImage(base, 0, 0);
    return suave;
  }, [firma, columnas, filas]);
  if (!lienzo) return null;
  return <ImagenKonva image={lienzo} x={origen.x} y={origen.y} width={columnas * celda} height={filas * celda} listening={false} />;
}

// Los braseros: una llamita con su resplandor en el centro de la casilla
export function DibujoLuces({ luces, celda, origen, escala, colores }: {
  luces: Luz[];
  celda: number;
  origen: { x: number; y: number };
  escala: number;
  colores: ColoresTablero;
}) {
  return (
    <>
      {luces.map((l) => {
        const x = origen.x + (l.x + 0.5) * celda;
        const y = origen.y + (l.y + 0.5) * celda;
        const r = celda * 0.3;
        return (
          <Group key={l.id} listening={false}>
            <Circle x={x} y={y} radius={r * 1.6} fillRadialGradientStartPoint={{ x: 0, y: 0 }} fillRadialGradientEndPoint={{ x: 0, y: 0 }}
              fillRadialGradientStartRadius={0} fillRadialGradientEndRadius={r * 1.6}
              fillRadialGradientColorStops={[0, 'rgba(255,200,80,0.75)', 1, 'rgba(255,200,80,0)']} />
            <Circle x={x} y={y + r * 0.55} radius={r * 0.55} fill={colores.texto} opacity={0.75} />
            <Shape
              sceneFunc={(ctx) => {
                const c = ctx._context;
                c.save();
                c.fillStyle = '#f08a24';
                c.strokeStyle = colores.texto;
                c.lineWidth = Math.max(1.2 / escala, celda * 0.02);
                c.beginPath();
                c.moveTo(x, y - r);
                c.bezierCurveTo(x + r * 0.7, y - r * 0.2, x + r * 0.55, y + r * 0.5, x, y + r * 0.5);
                c.bezierCurveTo(x - r * 0.55, y + r * 0.5, x - r * 0.7, y - r * 0.2, x, y - r);
                c.fill();
                c.stroke();
                c.restore();
              }}
            />
          </Group>
        );
      })}
    </>
  );
}

// Encender o apagar lo que lleva un token: antorcha, linterna, vela o nada
export function ElegirLuz({ luz, onCambiar, compacto = false }: { luz?: Brillo; onCambiar: (luz: Brillo | undefined) => void; compacto?: boolean }) {
  const actual = (Object.keys(FUENTES) as (keyof typeof FUENTES)[]).find((k) => luz && FUENTES[k].brillante === luz.brillante && FUENTES[k].tenue === luz.tenue);
  if (compacto) {
    const encendida = !!luz;
    return (
      <button onClick={() => onCambiar(encendida ? undefined : { brillante: FUENTES.antorcha.brillante, tenue: FUENTES.antorcha.tenue })}
        aria-pressed={encendida}
        className={`flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 font-titulo text-[13.5px] transition ${encendida ? 'text-[#c96a12]' : 'text-texto-suave hover:text-acento'}`}
        title={encendida ? 'Apagar la antorcha' : 'Encender una antorcha: 20 ft de luz brillante y 20 más de tenue'}>
        <FlameIcon size={16} weight={encendida ? 'fill' : 'regular'} aria-hidden /> {encendida ? `${actual ? FUENTES[actual].nombre : 'Luz'} encendida` : 'Encender antorcha'}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Luz que lleva">
      {([['', 'Sin luz'], ...Object.entries(FUENTES).map(([k, f]) => [k, `${f.nombre} (${f.brillante}/${f.tenue} ft)`])] as [string, string][]).map(([k, nombre]) => {
        const activa = (k || undefined) === actual || (!k && !luz);
        return (
          <button key={k || 'nada'} role="radio" aria-checked={activa}
            onClick={() => onCambiar(k ? { brillante: FUENTES[k as keyof typeof FUENTES].brillante, tenue: FUENTES[k as keyof typeof FUENTES].tenue } : undefined)}
            className={`rounded-lg border-2 px-2 py-1 text-xs transition ${activa ? 'border-acento bg-acento/10 font-semibold' : 'border-borde hover:bg-superficie-2'}`}>
            {nombre}
          </button>
        );
      })}
    </div>
  );
}

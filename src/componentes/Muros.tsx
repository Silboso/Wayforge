// Muros, puertas y ventanas sobre el tablero, y la niebla de guerra encima del terreno.

import { useMemo } from 'react';
import { Image as ImagenKonva, Shape } from 'react-konva';
import type { Muro } from '../../compartido/vision';
import type { ColoresTablero } from '../tema';

const MADERA = '#9a6a3c';

// Los muros a tinta gruesa; las ventanas, doble línea fina; las puertas, una hoja de madera (abierta, girada sobre
// su bisagra con el arco punteado); las cerradas con llave llevan un candado rojo
export function DibujoMuros({ muros, celda, origen, escala, colores, resaltado }: {
  muros: Muro[];
  celda: number;
  origen: { x: number; y: number };
  escala: number;
  colores: ColoresTablero;
  // El que se borraría con la goma (en el editor)
  resaltado?: string | null;
}) {
  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        const c = ctx._context;
        const P = (p: { x: number; y: number }) => ({ x: origen.x + p.x * celda, y: origen.y + p.y * celda });
        c.save();
        c.lineCap = 'round';
        c.lineJoin = 'round';
        for (const m of muros) {
          const a = P(m.a);
          const b = P(m.b);
          const largo = Math.hypot(b.x - a.x, b.y - a.y);
          const ux = (b.x - a.x) / largo;
          const uy = (b.y - a.y) / largo;
          const nx = -uy;
          const ny = ux;
          const marcado = m.id === resaltado;
          if (m.tipo === 'muro') {
            c.strokeStyle = marcado ? colores.peligro : colores.texto;
            c.globalAlpha = 0.92;
            c.lineWidth = Math.max(4 / escala, celda * 0.1);
            c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
          } else if (m.tipo === 'ventana') {
            const d = Math.max(2.5 / escala, celda * 0.05);
            c.strokeStyle = marcado ? colores.peligro : colores.acento;
            c.globalAlpha = 0.9;
            c.lineWidth = Math.max(1.5 / escala, celda * 0.025);
            c.beginPath();
            for (const s of [-1, 1]) { c.moveTo(a.x + nx * d * s, a.y + ny * d * s); c.lineTo(b.x + nx * d * s, b.y + ny * d * s); }
            for (let t = 0.25; t < 1; t += 0.25) { const px = a.x + (b.x - a.x) * t; const py = a.y + (b.y - a.y) * t; c.moveTo(px - nx * d, py - ny * d); c.lineTo(px + nx * d, py + ny * d); }
            c.stroke();
          } else {
            const grosor = Math.max(5 / escala, celda * 0.16);
            // Los marcos de la puerta: dos topes cortos a tinta
            c.strokeStyle = colores.texto;
            c.globalAlpha = 0.92;
            c.lineWidth = Math.max(4 / escala, celda * 0.1);
            c.beginPath();
            c.moveTo(a.x - nx * grosor * 0.5, a.y - ny * grosor * 0.5); c.lineTo(a.x + nx * grosor * 0.5, a.y + ny * grosor * 0.5);
            c.moveTo(b.x - nx * grosor * 0.5, b.y - ny * grosor * 0.5); c.lineTo(b.x + nx * grosor * 0.5, b.y + ny * grosor * 0.5);
            c.stroke();
            c.lineWidth = Math.max(1.5 / escala, celda * 0.022);
            if (m.abierta) {
              // La hoja abierta: girada 90° sobre la bisagra en `a`, con el arco del recorrido punteado
              const fin = { x: a.x + nx * largo, y: a.y + ny * largo };
              c.globalAlpha = 0.5;
              c.setLineDash([4 / escala, 4 / escala]);
              c.beginPath();
              const ang0 = Math.atan2(uy, ux);
              c.arc(a.x, a.y, largo, ang0, ang0 + Math.PI / 2);
              c.stroke();
              c.setLineDash([]);
              c.globalAlpha = 0.95;
              c.fillStyle = MADERA;
              c.strokeStyle = marcado ? colores.peligro : colores.texto;
              c.beginPath();
              c.moveTo(a.x - ux * grosor * 0.3, a.y - uy * grosor * 0.3);
              c.lineTo(fin.x - ux * grosor * 0.3, fin.y - uy * grosor * 0.3);
              c.lineTo(fin.x + ux * grosor * 0.3, fin.y + uy * grosor * 0.3);
              c.lineTo(a.x + ux * grosor * 0.3, a.y + uy * grosor * 0.3);
              c.closePath();
              c.fill(); c.stroke();
            } else {
              c.globalAlpha = 0.95;
              c.fillStyle = MADERA;
              c.strokeStyle = marcado ? colores.peligro : colores.texto;
              c.beginPath();
              c.moveTo(a.x + nx * grosor / 2, a.y + ny * grosor / 2);
              c.lineTo(b.x + nx * grosor / 2, b.y + ny * grosor / 2);
              c.lineTo(b.x - nx * grosor / 2, b.y - ny * grosor / 2);
              c.lineTo(a.x - nx * grosor / 2, a.y - ny * grosor / 2);
              c.closePath();
              c.fill(); c.stroke();
              // Las vetas
              c.globalAlpha = 0.45;
              c.beginPath();
              c.moveTo(a.x + ux * largo * 0.15, a.y + uy * largo * 0.15); c.lineTo(b.x - ux * largo * 0.15, b.y - uy * largo * 0.15);
              c.stroke();
            }
            if (m.conLlave) {
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              c.globalAlpha = 1;
              c.fillStyle = colores.peligro;
              c.beginPath(); c.arc(mx, my, Math.max(3.5 / escala, celda * 0.07), 0, Math.PI * 2); c.fill();
            }
          }
        }
        c.restore();
      }}
    />
  );
}

// La niebla: papel tapando lo que nadie vio (con un rayado suave) y penumbra sobre lo explorado que ahora no se ve.
// Se pinta a baja resolución y se estira con suavizado: los bordes quedan difuminados como lápiz corrido.
// `opaca`: así la ven los jugadores; si no (el GM mirando lo que ven ellos), apenas un velo.
export function CapaNiebla({ visibles, exploradas, columnas, filas, celda, origen, colores, opaca }: {
  visibles: Set<string>;
  exploradas: Set<string>;
  columnas: number;
  filas: number;
  celda: number;
  origen: { x: number; y: number };
  colores: ColoresTablero;
  opaca: boolean;
}) {
  const lienzo = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const K = 10;
    const base = document.createElement('canvas');
    base.width = columnas * K;
    base.height = filas * K;
    const c = base.getContext('2d');
    if (!c) return null;
    for (let y = 0; y < filas; y++) {
      for (let x = 0; x < columnas; x++) {
        const k = `${x},${y}`;
        if (visibles.has(k)) continue;
        const explorada = exploradas.has(k);
        // Para los jugadores: papel encima (tapa del todo lo que nadie vio). Para el GM, solo el velo gris.
        if (opaca) {
          c.globalAlpha = explorada ? 0.55 : 1;
          c.fillStyle = colores.tablero;
          c.fillRect(x * K, y * K, K, K);
        }
        c.globalAlpha = explorada ? 0.08 : opaca ? 0.13 : 0.2;
        c.fillStyle = colores.texto;
        c.fillRect(x * K, y * K, K, K);
      }
    }
    // El rayado de "sin explorar", a lápiz
    c.globalAlpha = opaca ? 0.4 : 0.3;
    c.strokeStyle = colores.textoSuave;
    c.lineWidth = 0.7;
    c.beginPath();
    for (let y = 0; y < filas; y++) {
      for (let x = 0; x < columnas; x++) {
        if (exploradas.has(`${x},${y}`) || visibles.has(`${x},${y}`)) continue;
        for (let d = 0; d < K; d += 3) { c.moveTo(x * K + d, y * K + K); c.lineTo(x * K + K, y * K + d); }
        for (let d = 0; d < K; d += 3) { c.moveTo(x * K, y * K + d); c.lineTo(x * K + d, y * K); }
      }
    }
    c.stroke();
    // Bordes difuminados (donde el navegador sabe desenfocar)
    const suave = document.createElement('canvas');
    suave.width = base.width;
    suave.height = base.height;
    const s = suave.getContext('2d');
    if (!s || !('filter' in s)) return base;
    s.filter = `blur(${K * 0.35}px)`;
    s.drawImage(base, 0, 0);
    return suave;
  }, [visibles, exploradas, columnas, filas, colores, opaca]);
  if (!lienzo) return null;
  return <ImagenKonva image={lienzo} x={origen.x} y={origen.y} width={columnas * celda} height={filas * celda} listening={false} />;
}

export { distanciaAMuro } from '../../compartido/vision';

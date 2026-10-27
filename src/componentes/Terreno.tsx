// El terreno de fondo cuando el GM no subió un mapa: dibujado a tinta, como un boceto en el cuaderno.
// Es solo decoración (no bloquea ni cuesta movimiento) y sale siempre igual para el mismo tamaño de tablero.
// Se pinta una vez en un canvas aparte y el tablero lo usa como imagen, así moverse y hacer zoom no lo redibuja.

import { useMemo } from 'react';
import { Image as ImagenKonva } from 'react-konva';
import type { Terreno } from '../../compartido/sala';
import type { ColoresTablero } from '../tema';

export const TERRENOS: Record<Terreno, { nombre: string; ayuda: string }> = {
  claro: { nombre: 'Claro del bosque', ayuda: 'Un sendero entre árboles, rocas y pasto.' },
  mazmorra: { nombre: 'Sala de mazmorra', ayuda: 'Losas de piedra, columnas y escombros.' },
  ninguno: { nombre: 'Papel en blanco', ayuda: 'Solo la cuadrícula, para dibujar con tokens.' },
};

// Dados con semilla: el mismo tablero sale siempre con los mismos árboles
function semilla(n: number) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Un contorno a mano alzada: un círculo (o polígono) con el radio temblando un poco
function contorno(c: CanvasRenderingContext2D, azar: () => number, x: number, y: number, r: number, puntos: number, temblor: number) {
  c.beginPath();
  for (let i = 0; i <= puntos; i++) {
    const a = (i / puntos) * Math.PI * 2;
    const rr = r * (1 + (i === puntos ? 0 : (azar() - 0.5) * temblor));
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
  }
  c.closePath();
}

function claro(c: CanvasRenderingContext2D, columnas: number, filas: number, k: number, colores: ColoresTablero) {
  const azar = semilla(columnas * 131 + filas * 7 + 1);
  const W = columnas * k;
  const H = filas * k;
  // Suelo: un verde muy suave
  c.globalAlpha = 0.07;
  c.fillStyle = colores.exito;
  c.fillRect(0, 0, W, H);

  // Un sendero que cruza de lado a lado, serpenteando por el medio
  const fase = azar() * Math.PI * 2;
  const centro = (x: number) => H * 0.52 + Math.sin((x / W) * Math.PI * 1.7 + fase) * H * 0.13;
  const ancho = k * 1.5;
  const paso = k / 4;
  c.beginPath();
  for (let x = 0; x <= W; x += paso) c.lineTo(x, centro(x) - ancho / 2);
  for (let x = W; x >= 0; x -= paso) c.lineTo(x, centro(x) + ancho / 2);
  c.closePath();
  c.globalAlpha = 0.18;
  c.fillStyle = colores.marca;
  c.fill();
  c.globalAlpha = 0.45;
  c.strokeStyle = colores.textoSuave;
  c.lineWidth = Math.max(1, k * 0.022);
  c.setLineDash([k * 0.5, k * 0.12]);
  for (const lado of [-1, 1]) {
    c.beginPath();
    for (let x = 0; x <= W; x += paso) c.lineTo(x, centro(x) + (lado * ancho) / 2 + (azar() - 0.5) * k * 0.05);
    c.stroke();
  }
  c.setLineDash([]);
  const enSendero = (x: number, y: number, holgura = 0) => Math.abs(y - centro(x)) < ancho / 2 + holgura;

  // Pasto: matitas de tres trazos
  c.globalAlpha = 0.42;
  c.strokeStyle = colores.exito;
  c.lineWidth = Math.max(1, k * 0.018);
  for (let i = 0; i < columnas * filas * 0.35; i++) {
    const x = azar() * W;
    const y = azar() * H;
    if (enSendero(x, y, k * 0.1)) continue;
    const t = k * (0.08 + azar() * 0.06);
    c.beginPath();
    for (const d of [-0.7, 0, 0.7]) {
      c.moveTo(x, y);
      c.lineTo(x + d * t, y - t * (d === 0 ? 1.3 : 1));
    }
    c.stroke();
  }

  // Rocas sueltas en el medio, fuera del sendero
  for (let i = 0, puestas = 0; i < 40 && puestas < Math.round(columnas * filas / 70); i++) {
    const x = (0.15 + azar() * 0.7) * W;
    const y = (0.2 + azar() * 0.6) * H;
    if (enSendero(x, y, k * 0.5)) continue;
    puestas++;
    const r = k * (0.22 + azar() * 0.22);
    contorno(c, azar, x, y, r, 7, 0.45);
    c.globalAlpha = 0.14;
    c.fillStyle = colores.textoSuave;
    c.fill();
    c.globalAlpha = 0.75;
    c.strokeStyle = colores.textoSuave;
    c.lineWidth = Math.max(1, k * 0.025);
    c.stroke();
    c.beginPath();
    c.moveTo(x - r * 0.3, y - r * 0.1);
    c.lineTo(x + r * 0.2, y + r * 0.25);
    c.globalAlpha = 0.4;
    c.stroke();
  }

  // Árboles: bordes arriba y abajo, y matorrales en las esquinas de los costados (el sendero entra libre)
  const arbol = (x: number, y: number, r: number) => {
    c.globalAlpha = 0.17;
    c.fillStyle = colores.exito;
    contorno(c, azar, x, y, r, 18, 0.22);
    c.fill();
    c.globalAlpha = 0.8;
    c.strokeStyle = colores.exito;
    c.lineWidth = Math.max(1, k * 0.03);
    contorno(c, azar, x, y, r, 18, 0.22);
    c.stroke();
    c.globalAlpha = 0.35;
    contorno(c, azar, x + r * 0.08, y - r * 0.05, r * 0.62, 12, 0.3);
    c.stroke();
    c.globalAlpha = 0.85;
    c.fillStyle = colores.textoSuave;
    c.beginPath();
    c.arc(x, y + r * 0.08, Math.max(1.5, r * 0.09), 0, Math.PI * 2);
    c.fill();
  };
  for (const fila of [0.55, filas - 0.55]) {
    for (let x = k * 0.4; x < W; x += k * (1.3 + azar() * 0.9)) {
      const y = fila * k + (azar() - 0.5) * k * 0.6;
      arbol(x, y, k * (0.55 + azar() * 0.35));
    }
  }
  for (const x of [0.5, columnas - 0.5]) {
    for (let y = k * 1.6; y < H - k * 1.6; y += k * (1.2 + azar() * 0.7)) {
      if (enSendero(x * k, y, k * 0.9)) continue;
      arbol(x * k + (azar() - 0.5) * k * 0.4, y, k * (0.45 + azar() * 0.3));
    }
  }
}

function mazmorra(c: CanvasRenderingContext2D, columnas: number, filas: number, k: number, colores: ColoresTablero) {
  const azar = semilla(columnas * 97 + filas * 13 + 2);
  const W = columnas * k;
  const H = filas * k;
  c.globalAlpha = 0.07;
  c.fillStyle = colores.textoSuave;
  c.fillRect(0, 0, W, H);

  // Losas: grietas cortas y alguna losa marcada
  c.strokeStyle = colores.textoSuave;
  c.lineWidth = Math.max(1, k * 0.018);
  for (let i = 0; i < columnas * filas * 0.18; i++) {
    const x = azar() * W;
    const y = azar() * H;
    c.globalAlpha = 0.35;
    c.beginPath();
    c.moveTo(x, y);
    let px = x;
    let py = y;
    for (let j = 0; j < 3; j++) {
      px += (azar() - 0.5) * k * 0.45;
      py += (azar() - 0.5) * k * 0.45;
      c.lineTo(px, py);
    }
    c.stroke();
  }
  for (let i = 0; i < columnas * filas * 0.05; i++) {
    const x = Math.floor(azar() * columnas) * k;
    const y = Math.floor(azar() * filas) * k;
    c.globalAlpha = 0.08;
    c.fillStyle = colores.textoSuave;
    c.fillRect(x + k * 0.08, y + k * 0.08, k * 0.84, k * 0.84);
  }

  // Muros: una banda rayada pegada al borde, con puertas a los costados
  const banda = k * 0.32;
  c.save();
  c.beginPath();
  c.rect(0, 0, W, H);
  c.rect(banda, banda, W - banda * 2, H - banda * 2);
  c.clip('evenodd');
  c.globalAlpha = 0.22;
  c.fillStyle = colores.textoSuave;
  c.fillRect(0, 0, W, H);
  c.globalAlpha = 0.45;
  c.beginPath();
  for (let d = -H; d < W; d += k * 0.18) { c.moveTo(d, 0); c.lineTo(d + H, H); }
  c.stroke();
  c.restore();
  // Las puertas: un hueco en el muro de cada costado
  c.globalAlpha = 1;
  c.fillStyle = colores.tablero;
  for (const x of [0, W - banda]) {
    c.fillRect(x, H / 2 - k, banda, k * 2);
  }
  c.globalAlpha = 0.8;
  c.strokeStyle = colores.texto;
  c.lineWidth = Math.max(1, k * 0.03);
  c.strokeRect(banda, banda, W - banda * 2, H - banda * 2);

  // Columnas en los cuatro tercios
  for (const fx of [0.28, 0.72]) {
    for (const fy of [0.28, 0.72]) {
      const x = Math.round(columnas * fx) * k;
      const y = Math.round(filas * fy) * k;
      c.globalAlpha = 0.2;
      c.fillStyle = colores.textoSuave;
      c.fillRect(x - k * 0.45, y - k * 0.45, k * 0.9, k * 0.9);
      c.globalAlpha = 0.85;
      c.strokeStyle = colores.texto;
      c.strokeRect(x - k * 0.45, y - k * 0.45, k * 0.9, k * 0.9);
      c.beginPath();
      c.arc(x, y, k * 0.28, 0, Math.PI * 2);
      c.stroke();
    }
  }
  // Escombros
  c.fillStyle = colores.textoSuave;
  for (let i = 0; i < columnas * filas * 0.06; i++) {
    c.globalAlpha = 0.5;
    c.beginPath();
    c.arc(banda + azar() * (W - banda * 2), banda + azar() * (H - banda * 2), k * (0.03 + azar() * 0.05), 0, Math.PI * 2);
    c.fill();
  }
}

// El terreno como imagen, del tamaño del tablero (a menos resolución si el tablero es enorme)
export function FondoTerreno({ terreno, columnas, filas, celda, x, y, colores }: {
  terreno: Terreno;
  columnas: number;
  filas: number;
  celda: number;
  x: number;
  y: number;
  colores: ColoresTablero;
}) {
  const lienzo = useMemo(() => {
    if (terreno === 'ninguno' || typeof document === 'undefined') return null;
    const k = Math.min(celda, 3600 / Math.max(columnas, filas));
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(columnas * k);
    canvas.height = Math.ceil(filas * k);
    const c = canvas.getContext('2d');
    if (!c) return null;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    (terreno === 'mazmorra' ? mazmorra : claro)(c, columnas, filas, k, colores);
    return canvas;
  }, [terreno, columnas, filas, celda, colores]);
  if (!lienzo) return null;
  return <ImagenKonva image={lienzo} x={x} y={y} width={columnas * celda} height={filas * celda} listening={false} />;
}

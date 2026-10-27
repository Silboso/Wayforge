// Áreas de PF2e sobre la cuadrícula: explosión (desde una esquina), emanación (alrededor de quien la lanza),
// cono y línea (desde quien la lanza hacia un punto). Devuelven las casillas que cubren.

import { distanciaEntre, type Casilla } from './movimiento';

export type Forma = 'explosion' | 'emanacion' | 'cono' | 'linea';

export const FORMAS: Record<Forma, string> = {
  explosion: 'explosión', emanacion: 'emanación', cono: 'cono', linea: 'línea',
};

export interface Area {
  forma: Forma;
  // En pies: el radio de la explosión o la emanación, el largo del cono o la línea
  tamano: number;
}

export interface Origen { x: number; y: number; lado: number }

// Distancia de PF2e en casillas (cada segunda diagonal cuesta doble), en pies
const pies = (a: number, b: number) => (Math.max(a, b) + Math.floor(Math.min(a, b) / 2)) * 5;

// Las casillas que cubre un área. `punto`: la esquina de la explosión, o hacia dónde apunta el cono o la línea
export function casillasDeArea(area: Area, origen: Origen, punto: Casilla | null): Casilla[] {
  const n = Math.ceil(area.tamano / 5);
  const lado = Math.max(1, Math.ceil(origen.lado));
  const salen: Casilla[] = [];
  if (area.forma === 'explosion') {
    if (!punto) return [];
    // La explosión sale de una intersección de la cuadrícula: cuenta cuántas casillas hay hasta cada una
    for (let y = punto.y - n; y < punto.y + n; y++) {
      for (let x = punto.x - n; x < punto.x + n; x++) {
        const a = x >= punto.x ? x - punto.x + 1 : punto.x - x;
        const b = y >= punto.y ? y - punto.y + 1 : punto.y - y;
        if (pies(a, b) <= area.tamano) salen.push({ x, y });
      }
    }
    return salen;
  }
  const cx = origen.x + lado / 2;
  const cy = origen.y + lado / 2;
  const propia = (x: number, y: number) => x >= origen.x && x < origen.x + lado && y >= origen.y && y < origen.y + lado;
  const dir = punto ? { x: punto.x + 0.5 - cx, y: punto.y + 0.5 - cy } : null;
  const largo = dir ? Math.hypot(dir.x, dir.y) : 0;
  for (let y = origen.y - n; y < origen.y + lado + n; y++) {
    for (let x = origen.x - n; x < origen.x + lado + n; x++) {
      const d = distanciaEntre(origen, lado, { x, y }, 1);
      if (area.forma === 'emanacion') {
        if (propia(x, y) || d <= area.tamano) salen.push({ x, y });
        continue;
      }
      if (!dir || largo === 0 || propia(x, y) || d > area.tamano) continue;
      const vx = x + 0.5 - cx;
      const vy = y + 0.5 - cy;
      const proyeccion = (vx * dir.x + vy * dir.y) / largo;
      if (proyeccion <= 0) continue;
      if (area.forma === 'cono') {
        // Un cuarto de círculo: hasta 45° a cada lado de hacia dónde apunta
        const coseno = proyeccion / Math.hypot(vx, vy);
        if (coseno >= Math.SQRT1_2 - 1e-9) salen.push({ x, y });
      } else {
        // Línea de una casilla de ancho
        const perpendicular = Math.abs(vx * dir.y - vy * dir.x) / largo;
        if (perpendicular <= 0.5 + 1e-9) salen.push({ x, y });
      }
    }
  }
  return salen;
}

// Qué tan lejos queda la esquina de una explosión de quien la lanza (contra el alcance del conjuro)
export function distanciaAEsquina(origen: Origen, punto: Casilla): number {
  const vecinas = [punto, { x: punto.x - 1, y: punto.y }, { x: punto.x, y: punto.y - 1 }, { x: punto.x - 1, y: punto.y - 1 }];
  return Math.min(...vecinas.map((c) => distanciaEntre(origen, origen.lado, c, 1)));
}

// Los tokens que pisan alguna de esas casillas
export function tocados<T extends { x: number; y: number; lado: number }>(casillas: Casilla[], tokens: T[]): T[] {
  const set = new Set(casillas.map((c) => `${c.x},${c.y}`));
  return tokens.filter((t) => {
    const n = Math.max(1, Math.ceil(t.lado));
    for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) if (set.has(`${t.x + dx},${t.y + dy}`)) return true;
    return false;
  });
}

// "explosión de 20 ft"
export function areaTexto(a: Area): string {
  return `${FORMAS[a.forma]} de ${a.tamano} ft`;
}

// "20-foot burst", "15-foot cone" (como vienen en los libros) → área
export function leerArea(texto: string): Area | null {
  const m = /(\d+)[- ](?:foot|feet|ft)[- ](burst|cone|line|emanation)/i.exec(texto);
  if (!m) return null;
  const forma = ({ burst: 'explosion', cone: 'cono', line: 'linea', emanation: 'emanacion' } as const)[m[2]!.toLowerCase() as 'burst'];
  const tamano = Number(m[1]);
  return tamano >= 5 && tamano <= 500 ? { forma, tamano } : null;
}

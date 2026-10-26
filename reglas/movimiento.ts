// Movimiento en la cuadrícula, con las reglas de PF2e: cada casilla son 5 ft y las diagonales alternan
// 5 y 10 ft (la primera cuesta 5, la segunda 10, la tercera 5…). No se atraviesa a un enemigo y no se
// termina en una casilla ocupada.

export interface Casilla {
  x: number;
  y: number;
}

export interface OpcionesMovimiento {
  // Lado del token en casillas (Large = 2)
  lado: number;
  // Casillas que no se pueden atravesar (enemigos) ni ocupar al terminar (cualquiera)
  bloqueadas: Set<string>;
  ocupadas: Set<string>;
  // Límites del tablero (exclusivo); sin límite, Infinity
  columnas: number;
  filas: number;
}

export interface Paso {
  pies: number;
  // La casilla anterior en el camino más corto
  previa: string | null;
  // Cuántas diagonales lleva (decide si la próxima cuesta 5 o 10)
  diagonales: number;
}

export const clave = (c: Casilla) => `${c.x},${c.y}`;
export const desdeClave = (k: string): Casilla => {
  const [x, y] = k.split(',').map(Number);
  return { x: x!, y: y! };
};

// Las casillas que cubre un token de `lado` casillas con la esquina en `c`
export function huella(c: Casilla, lado: number): string[] {
  const n = Math.max(1, Math.ceil(lado));
  const lista: string[] = [];
  for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) lista.push(`${c.x + dx},${c.y + dy}`);
  return lista;
}

const VECINOS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

// Todas las casillas a las que se llega con `maxPies`, con el camino más corto a cada una (Dijkstra)
export function alcanzables(origen: Casilla, maxPies: number, o: OpcionesMovimiento): Map<string, Paso> {
  const lado = Math.max(1, Math.ceil(o.lado));
  const pasa = (c: Casilla) => c.x >= 0 && c.y >= 0 && c.x + lado <= o.columnas && c.y + lado <= o.filas
    && huella(c, lado).every((k) => !o.bloqueadas.has(k));
  const mejor = new Map<string, Paso>([[clave(origen), { pies: 0, previa: null, diagonales: 0 }]]);
  const abiertos: { c: Casilla; pies: number; diagonales: number }[] = [{ c: origen, pies: 0, diagonales: 0 }];
  while (abiertos.length) {
    // La frontera es chica (velocidades de 25–60 ft): basta con buscar el menor a mano
    let i = 0;
    for (let j = 1; j < abiertos.length; j++) if (abiertos[j]!.pies < abiertos[i]!.pies) i = j;
    const actual = abiertos.splice(i, 1)[0]!;
    for (const [dx, dy] of VECINOS) {
      const diagonal = dx !== 0 && dy !== 0;
      const costo = diagonal ? (actual.diagonales % 2 === 1 ? 10 : 5) : 5;
      const pies = actual.pies + costo;
      if (pies > maxPies) continue;
      const sig = { x: actual.c.x + dx, y: actual.c.y + dy };
      if (!pasa(sig)) continue;
      const k = clave(sig);
      const diagonales = actual.diagonales + (diagonal ? 1 : 0);
      const previo = mejor.get(k);
      // A igual costo, conviene llegar con menos diagonales impares (la próxima sale más barata)
      if (previo && (previo.pies < pies || (previo.pies === pies && previo.diagonales % 2 <= diagonales % 2))) continue;
      mejor.set(k, { pies, previa: clave(actual.c), diagonales });
      abiertos.push({ c: sig, pies, diagonales });
    }
  }
  // No se puede terminar en una casilla ocupada (se puede pasar entre aliados, no quedarse)
  for (const k of [...mejor.keys()]) {
    if (k !== clave(origen) && huella(desdeClave(k), lado).some((h) => o.ocupadas.has(h))) mejor.delete(k);
  }
  return mejor;
}

// El camino (incluye origen y destino) a una casilla ya calculada en `alcanzables`
export function caminoA(destino: Casilla, mapa: Map<string, Paso>): Casilla[] | null {
  if (!mapa.has(clave(destino))) return null;
  const camino: Casilla[] = [];
  let k: string | null = clave(destino);
  while (k) {
    camino.unshift(desdeClave(k));
    k = mapa.get(k)!.previa;
  }
  return camino;
}

// Distancia entre dos tokens en pies, de borde a borde, con la regla de diagonales de PF2e
export function distanciaEntre(a: Casilla, ladoA: number, b: Casilla, ladoB: number): number {
  const la = Math.max(1, Math.ceil(ladoA));
  const lb = Math.max(1, Math.ceil(ladoB));
  const hueco = (a0: number, na: number, b0: number, nb: number) => Math.max(0, b0 - (a0 + na - 1), a0 - (b0 + nb - 1));
  const dx = hueco(a.x, la, b.x, lb);
  const dy = hueco(a.y, la, b.y, lb);
  const diagonales = Math.min(dx, dy);
  const rectas = Math.max(dx, dy) - diagonales;
  return (rectas + diagonales + Math.floor(diagonales / 2)) * 5;
}

// Recall Knowledge sobre una criatura: qué skill sirve según sus rasgos, la CD según su nivel y qué datos ciertos
// se le cuentan al jugador (uno con éxito, dos con crítico). Player Core / GM Core (remaster). Licencia ORC.
import type { ClaveHabilidad } from './pf2e';
import type { Criatura } from './criaturas';

// La CD por nivel (de −1 a 25)
const CD_NIVEL = [13, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50];

export function cdDeNivel(nivel: number): number {
  return CD_NIVEL[Math.min(CD_NIVEL.length - 1, Math.max(0, Math.round(nivel) + 1))]!;
}

const POR_RASGO: Record<string, ClaveHabilidad[]> = {
  aberration: ['occultism'], animal: ['nature'], astral: ['occultism'], beast: ['arcana', 'nature'], celestial: ['religion'],
  construct: ['arcana', 'crafting'], dragon: ['arcana'], dream: ['occultism'], elemental: ['arcana', 'nature'], ethereal: ['occultism'],
  fey: ['nature'], fiend: ['religion'], fungus: ['nature'], giant: ['society'], humanoid: ['society'], monitor: ['religion'],
  ooze: ['occultism'], plant: ['nature'], spirit: ['occultism'], time: ['occultism'], undead: ['religion'],
};

// Las skills que sirven para esa criatura (si ningún rasgo lo dice, Society: lo que se sabe de oídas)
export function skillsParaRecordar(rasgos: string[]): ClaveHabilidad[] {
  const todas = rasgos.flatMap((r) => POR_RASGO[r.trim().toLowerCase()] ?? []);
  return todas.length ? [...new Set(todas)] : ['society'];
}

const SALVACION: Record<string, string> = { fortitude: 'Fortitude', reflex: 'Reflex', will: 'Will' };

// Lo que se puede saber de ella, de lo más útil a lo menos: debilidades, su peor salvación, resistencias, su mejor defensa
export function datosDeCriatura(c: Criatura): string[] {
  const datos: string[] = [];
  for (const d of c.defensas?.debilidades ?? []) datos.push(`es débil a ${d.tipo} (${d.valor} de daño extra).`);
  const salvaciones = Object.entries(c.salvaciones).sort((a, b) => a[1] - b[1]);
  const peor = salvaciones[0];
  const mejor = salvaciones.at(-1);
  if (peor) datos.push(`su punto débil es la ${SALVACION[peor[0]]} (+${peor[1]}): apúntale con eso.`);
  for (const r of c.defensas?.resistencias ?? []) datos.push(`resiste ${r.tipo} (le hace ${r.valor} menos).`);
  if (c.defensas?.inmunidades.length) datos.push(`es inmune a ${c.defensas.inmunidades.join(', ')}.`);
  if (mejor && mejor[0] !== peor?.[0]) datos.push(`su mejor defensa es la ${SALVACION[mejor[0]]} (+${mejor[1]}).`);
  const nota = c.notas.split(/(?<=\.)\s/)[0]?.trim();
  if (nota) datos.push(`cuidado: ${nota.charAt(0).toLowerCase()}${nota.slice(1)}`);
  return datos;
}

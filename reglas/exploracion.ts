// Actividades de exploración: lo que hace cada personaje mientras el grupo avanza. Deciden con qué se tira la
// iniciativa cuando empieza un combate (Avoid Notice → Stealth) y alguna da algo al grupo (Scout: +1 a la iniciativa).

import type { ClaveHabilidad } from './pf2e';

export type Actividad = 'avoid-notice' | 'search' | 'scout' | 'defend' | 'detect-magic' | 'investigate' | 'follow-the-expert' | 'hustle';

export const ACTIVIDADES: Record<Actividad, { nombre: string; verbo: string; ayuda: string; iniciativa?: ClaveHabilidad }> = {
  'avoid-notice': { nombre: 'Avoid Notice', verbo: 'Pasar desapercibido', ayuda: 'Avanzas a escondidas: tiras la iniciativa con Stealth.', iniciativa: 'stealth' },
  search: { nombre: 'Search', verbo: 'Buscar', ayuda: 'Revisas puertas secretas, trampas y escondites a medida que avanzan (a media velocidad).' },
  scout: { nombre: 'Scout', verbo: 'Explorar adelante', ayuda: 'Vas adelante vigilando: tus aliados ganan +1 de circunstancia a la iniciativa.' },
  defend: { nombre: 'Defend', verbo: 'Ir en guardia', ayuda: 'Avanzas con el escudo listo: empiezas el combate con el escudo levantado.' },
  'detect-magic': { nombre: 'Detect Magic', verbo: 'Detectar magia', ayuda: 'Lanzas Detect Magic una y otra vez mientras avanzan.' },
  investigate: { nombre: 'Investigate', verbo: 'Investigar', ayuda: 'Recuerdas lo que sabes sobre lo que ves (Recall Knowledge en secreto).' },
  'follow-the-expert': { nombre: 'Follow the Expert', verbo: 'Seguir al experto', ayuda: 'Imitas a un aliado más hábil para una actividad (Stealth o Survival).' },
  hustle: { nombre: 'Hustle', verbo: 'Apurarse', ayuda: 'Avanzas al doble de velocidad (un rato: después hay que descansar).' },
};

export const esActividad = (v: unknown): v is Actividad => typeof v === 'string' && v in ACTIVIDADES;

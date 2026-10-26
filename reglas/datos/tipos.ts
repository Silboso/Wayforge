// Tipos de la base de datos de Pathfinder 2e (remaster, licencia ORC). Todo es contenido como datos:
// el creador de personajes lo lee, la mesa lo usa, y el GM puede copiar y cambiar cualquiera.
// Los nombres de reglas van en inglés (como en los libros); las explicaciones, en español y con palabras propias.

import type { Aptitud, Costo } from '../aptitudes';
import type { Atributo, ClaveHabilidad, ClaveSalvacion, Rango } from '../pf2e';

export type Tamano = 'small' | 'medium';
export type Tradicion = 'arcane' | 'divine' | 'occult' | 'primal';

// Una mejora de atributo: uno fijo, o "libre" (eliges cuál)
export type Mejora = Atributo | 'libre';

export interface Herencia {
  id: string;
  nombre: string;
  descripcion: string;
  // Lo que cambia en números (si cambia algo)
  efecto?: { velocidad?: number; sentidos?: string; pg?: number };
}

export interface Ascendencia {
  id: string;
  nombre: string;
  descripcion: string;
  pg: number;
  tamano: Tamano;
  velocidad: number;
  mejoras: Mejora[];
  // Un atributo que baja (algunas ascendencias)
  defecto: Atributo | null;
  idiomas: string[];
  // Idiomas extra que puede aprender con Int
  idiomasOpcionales: string[];
  sentidos: string;
  rasgos: string[];
  // Lo que trae de nacimiento, explicado (Clan Dagger, Keen Eyes…)
  especial: string | null;
  herencias: Herencia[];
}

export interface Trasfondo {
  id: string;
  nombre: string;
  descripcion: string;
  // Una mejora entre estas dos, y otra libre
  mejoras: [Atributo, Atributo];
  habilidad: ClaveHabilidad;
  saber: string;
  // La dote de habilidad que regala (id de DOTES)
  dote: string;
}

export type TipoDote = 'ascendencia' | 'clase' | 'habilidad' | 'general';

export interface Dote {
  id: string;
  nombre: string;
  nivel: number;
  tipo: TipoDote;
  // De qué ascendencia o clase es (las de habilidad y generales no tienen dueño)
  de?: string;
  rasgos: string[];
  descripcion: string;
  // Si se usa en la mesa (tiene acciones), la aptitud que agrega a la ficha
  aptitud?: Omit<Aptitud, 'id'>;
  // Requisitos legibles ("trained in Medicine")
  requisitos?: string;
}

export interface CompetenciasArmas {
  simples: Rango;
  marciales: Rango;
  avanzadas: Rango;
  sinArmas: Rango;
  // Armas sueltas que también sabe usar (el mago: dagger, staff, crossbow…)
  extra?: string[];
}

export interface CompetenciasDefensa {
  sinArmadura: Rango;
  ligera: Rango;
  media: Rango;
  pesada: Rango;
}

export interface Clase {
  id: string;
  nombre: string;
  descripcion: string;
  // "Lo que hace en la mesa", en una línea para elegir rápido
  rol: string;
  atributoClave: Atributo[];
  pg: number;
  percepcion: Rango;
  salvaciones: Record<ClaveSalvacion, Rango>;
  habilidadesFijas: ClaveHabilidad[];
  // "Acrobatics o Athletics": elige una de cada grupo
  habilidadesAElegir: ClaveHabilidad[][];
  // Skills libres además de las anteriores (más el modificador de Int)
  habilidadesLibres: number;
  armas: CompetenciasArmas;
  defensa: CompetenciasDefensa;
  lanzador?: {
    tradicion: Tradicion | 'segun-eleccion';
    tipo: 'preparado' | 'espontaneo';
    trucos: number;
    espacios: number;
    // Conjuros espontáneos que conoce de rango 1
    repertorio?: number;
    foco: number;
  };
  // Lo que trae la clase a nivel 1, explicado
  rasgos: { nombre: string; descripcion: string }[];
  // Lo que se usa en la mesa (Rage, Reactive Strike, Hunt Prey…)
  aptitudes: Omit<Aptitud, 'id'>[];
  // Una elección de subclase (Muse, Instinct, Racket, Order…), si la hay
  subclase?: { titulo: string; opciones: { id: string; nombre: string; descripcion: string; habilidad?: ClaveHabilidad; tradicion?: Tradicion }[] };
}

export interface Conjuro {
  id: string;
  nombre: string;
  // 0 = truco (cantrip)
  rango: number;
  tradiciones: Tradicion[];
  costo: Costo;
  rasgos: string[];
  // Pies; 0 = toque
  distancia: number | null;
  area?: string;
  objetivos?: string;
  // Contra qué va: ataque de conjuro (CA) o una salvación
  defensa: 'ataque' | ClaveSalvacion | null;
  // Daño o curación a rango base
  dano?: string;
  tipoDano?: string;
  descripcion: string;
  // Qué mejora al subirlo de rango, en una línea
  potenciado?: string;
}

export type CategoriaArma = 'simple' | 'marcial' | 'avanzada' | 'sin-armas';

export interface Arma {
  id: string;
  nombre: string;
  categoria: CategoriaArma;
  // Cuerpo a cuerpo o a distancia
  tipo: 'cuerpo' | 'distancia';
  dados: string;
  tipoDano: 'B' | 'P' | 'S';
  manos: 1 | 2;
  rasgos: string[];
  // Incremento de distancia en pies (distancia y arrojadizas)
  distancia?: number;
  recarga?: number;
  // En piezas de plata (1 po = 10 pp)
  precio: number;
  bulto: number;
  grupo: string;
}

export interface Armadura {
  id: string;
  nombre: string;
  categoria: 'sin-armadura' | 'ligera' | 'media' | 'pesada';
  ca: number;
  topeDex: number | null;
  penalizacion: number;
  velocidad: number;
  fuerza: number;
  precio: number;
  bulto: number;
  rasgos: string[];
}

export interface Escudo {
  id: string;
  nombre: string;
  ca: number;
  dureza: number;
  pg: number;
  precio: number;
  bulto: number;
  descripcion: string;
}

export interface Equipo {
  id: string;
  nombre: string;
  precio: number;
  bulto: number;
  descripcion: string;
  // Si se puede usar en la mesa (una poción), la aptitud que agrega
  aptitud?: Omit<Aptitud, 'id'>;
}

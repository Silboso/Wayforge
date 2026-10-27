import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import {
  ArrowBendUpLeftIcon, ArrowDownIcon, ArrowFatLinesDownIcon, ArrowsClockwiseIcon, ArrowUpIcon, AxeIcon, BeerBottleIcon, BookOpenIcon, BrainIcon,
  ClockIcon, CrosshairIcon, DetectiveIcon, DropIcon, EyeIcon, EyeSlashIcon, FireIcon, FirstAidKitIcon, FlaskIcon, FootprintsIcon, GhostIcon,
  HandFistIcon, HandGrabbingIcon, HandPalmIcon, HandshakeIcon, HeartIcon, HourglassIcon, LeafIcon, LightningIcon, LockOpenIcon, MagicWandIcon,
  MedalIcon, PersonSimpleWalkIcon, ScrollIcon, ShieldCheckeredIcon, ShieldIcon, ShieldPlusIcon, SkullIcon, SmileyAngryIcon, SneakerMoveIcon,
  SnowflakeIcon, SparkleIcon, SpiralIcon, StarFourIcon, StarIcon, SunIcon, SwordIcon, WaveformIcon, WindIcon,
} from '@phosphor-icons/react';
import { interaccionDe } from '../../../reglas/interacciones';
import { TINTA_ASPECTO } from '../aspectos';
import type { Fila } from './secciones';

type Icono = ComponentType<IconProps>;

// Las acciones básicas tienen su dibujo propio
const BASICAS: Record<string, Icono> = {
  'basica:stride': FootprintsIcon, 'basica:step': SneakerMoveIcon, 'basica:raise-shield': ShieldIcon, 'basica:demoralize': SmileyAngryIcon,
  'basica:seek': EyeIcon, 'basica:take-cover': ShieldCheckeredIcon, 'basica:interact': HandGrabbingIcon, 'basica:recall-knowledge': BrainIcon,
  'basica:grapple': HandFistIcon, 'basica:trip': ArrowFatLinesDownIcon, 'basica:shove': HandPalmIcon, 'basica:disarm': HandGrabbingIcon,
  'basica:escape': LockOpenIcon, 'basica:hide': EyeSlashIcon, 'basica:sneak': PersonSimpleWalkIcon, 'basica:drop-prone': ArrowDownIcon,
  'basica:stand': ArrowUpIcon, 'basica:ready': HourglassIcon, 'basica:sustain': ArrowsClockwiseIcon, 'basica:aid': HandshakeIcon,
  'basica:delay': ClockIcon, 'basica:treat-wounds': FirstAidKitIcon,
};

// Por tipo de daño: el dibujo y la tinta del elemento
const POR_DANO: Record<string, [Icono, string]> = {
  fire: [FireIcon, TINTA_ASPECTO.fuego], cold: [SnowflakeIcon, TINTA_ASPECTO.frio], electricity: [LightningIcon, TINTA_ASPECTO.electricidad],
  acid: [FlaskIcon, TINTA_ASPECTO.acido], poison: [SkullIcon, TINTA_ASPECTO.veneno], mental: [SpiralIcon, TINTA_ASPECTO.mental],
  force: [StarFourIcon, '#7c5cf0'], sonic: [WaveformIcon, '#2fa7a0'], void: [GhostIcon, '#4d3a6b'], vitality: [SunIcon, '#d8a72c'],
  spirit: [GhostIcon, '#7e9cc0'], bleed: [DropIcon, TINTA_ASPECTO.sangrado], air: [WindIcon, '#6aa6c8'],
};

const ACERO = '#5f6b7a';
const MAGIA = '#6d4fc2';

// La tinta de las básicas según para qué sirven: moverse, defenderse, maniobrar, asustar, mirar, ayudar
const TINTA_BASICA: Record<string, string> = {
  'basica:stride': '#3f8f6e', 'basica:step': '#3f8f6e', 'basica:sneak': '#3f8f6e', 'basica:stand': '#3f8f6e', 'basica:drop-prone': '#3f8f6e', 'basica:escape': '#3f8f6e',
  'basica:raise-shield': '#3f74c9', 'basica:take-cover': '#3f74c9',
  'basica:grapple': '#b5523b', 'basica:trip': '#b5523b', 'basica:shove': '#b5523b', 'basica:disarm': '#b5523b',
  'basica:demoralize': '#8a4fbf',
  'basica:seek': '#c48a16', 'basica:recall-knowledge': '#c48a16', 'basica:hide': '#5b5f8a',
  'basica:aid': '#4f8fa8', 'basica:ready': '#4f8fa8', 'basica:delay': '#4f8fa8', 'basica:sustain': '#4f8fa8', 'basica:interact': '#4f8fa8',
  'basica:treat-wounds': '#3f9a5c',
};

// El dibujo y la tinta de una acción: el arma, la básica, el elemento del conjuro, o lo que sea según su tipo
export function iconoDe(fila: Fila): { Icono: Icono; tinta: string } {
  if (fila.tipo === 'golpe') {
    const lejos = (fila.golpe.distancia ?? 5) > 10;
    return { Icono: lejos ? CrosshairIcon : /axe|hacha/i.test(fila.golpe.nombre) ? AxeIcon : SwordIcon, tinta: lejos ? '#4f7a46' : '#9b3b34' };
  }
  const a = fila.aptitud;
  if (BASICAS[a.id]) return { Icono: BASICAS[a.id]!, tinta: TINTA_BASICA[a.id] ?? ACERO };
  const i = interaccionDe(a);
  if (i?.curacion) return { Icono: HeartIcon, tinta: '#3f9a5c' };
  const dano = i?.dano?.tipo ?? (/\b\d+d\d+(?:\+\d+)?\s+([a-z]+)/.exec(a.descripcion)?.[1] ?? '');
  if (POR_DANO[dano]) return { Icono: POR_DANO[dano]![0], tinta: POR_DANO[dano]![1] };
  if (i?.efecto?.beneficioso || i?.temporales) return { Icono: i.efecto?.modificadores.some((m) => m.blanco === 'ca') ? ShieldPlusIcon : SparkleIcon, tinta: TINTA_ASPECTO.bendicion };
  if (i?.efecto && !i.efecto.beneficioso) return { Icono: SpiralIcon, tinta: TINTA_ASPECTO.mental };
  if (a.tirada?.tipo === 'golpe') return { Icono: SwordIcon, tinta: ACERO };
  if (a.costo === 'reaccion') return { Icono: ArrowBendUpLeftIcon, tinta: '#a0613a' };
  switch (a.categoria) {
    case 'objeto': return { Icono: /scroll|pergamino/i.test(a.nombre) ? ScrollIcon : /potion|poción|elixir/i.test(a.nombre) ? BeerBottleIcon : FlaskIcon, tinta: '#b5762a' };
    case 'foco': return { Icono: StarIcon, tinta: '#c48a16' };
    case 'truco': return { Icono: MagicWandIcon, tinta: MAGIA };
    case 'conjuro': return { Icono: a.rasgos.includes('primal') ? LeafIcon : BookOpenIcon, tinta: MAGIA };
    case 'dote': return { Icono: a.tirada?.tipo === 'skill' ? DetectiveIcon : MedalIcon, tinta: '#8a5a2b' };
    default: return { Icono: StarFourIcon, tinta: ACERO };
  }
}

// La ficha cuadrada de una acción, como el ícono de una habilidad en un juego: el dibujo en blanco sobre su tinta
export function IconoHabilidad({ fila, tamano = 44, apagada = false, children }: {
  fila: Fila;
  tamano?: number;
  apagada?: boolean;
  children?: ReactNode;
}) {
  const { Icono, tinta } = iconoDe(fila);
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[9px] border-2 border-texto/70 text-white shadow-[inset_0_-6px_12px_-6px_rgba(0,0,0,0.45),0_3px_8px_-5px_var(--sombra)] ${apagada ? 'grayscale' : ''}`}
      style={{ width: tamano, height: tamano, background: `radial-gradient(circle at 35% 28%, color-mix(in srgb, ${tinta} 55%, white), ${tinta} 62%, color-mix(in srgb, ${tinta} 70%, black))` }}>
      <Icono size={Math.round(tamano * 0.56)} weight="fill" aria-hidden />
      {apagada && <span aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.38)_0_3px,transparent_3px_7px)]" />}
      {children}
    </span>
  );
}

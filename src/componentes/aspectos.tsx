import type { ReactNode } from 'react';
import {
  DropIcon, FireIcon, FlaskIcon, HeartIcon, LightningIcon, ShieldIcon, SkullIcon, SnowflakeIcon, SparkleIcon, SpiralIcon, TargetIcon, TimerIcon,
} from '@phosphor-icons/react';
import type { Aspecto } from '../../reglas/efectos';

export { ASPECTO_POR_DANO } from '../../reglas/efectos';

// La tinta de cada elemento: el fuego naranja, el frío azul… (para áreas, auras e íconos de efectos)
export const TINTA_ASPECTO: Record<Aspecto, string> = {
  bendicion: '#d39b1c',
  escudo: '#3f74c9',
  fuego: '#e2582a',
  frio: '#3a93d6',
  electricidad: '#d9ad12',
  acido: '#56a536',
  veneno: '#7c9a26',
  sangrado: '#b3222c',
  mental: '#9358cc',
  lento: '#5f86a8',
  marca: '#8a6a3a',
};

// Tipos de daño que no tienen aspecto propio
const TINTA_DANO: Record<string, string> = {
  force: '#7c5cf0', sonic: '#2fa7a0', void: '#4d3a6b', vitality: '#e2b93a', spirit: '#7e9cc0',
  piercing: '#7a6a58', slashing: '#7a6a58', bludgeoning: '#7a6a58',
};

export function tintaDe(aspecto?: Aspecto, tipoDano?: string): string {
  if (aspecto) return TINTA_ASPECTO[aspecto];
  return (tipoDano && TINTA_DANO[tipoDano]) || 'var(--peligro)';
}

export function IconoAspecto({ aspecto, size = 14, className }: { aspecto?: Aspecto; size?: number; className?: string }): ReactNode {
  const p = { size, weight: 'fill' as const, className, 'aria-hidden': true };
  switch (aspecto) {
    case 'bendicion': return <SparkleIcon {...p} />;
    case 'escudo': return <ShieldIcon {...p} />;
    case 'fuego': return <FireIcon {...p} />;
    case 'frio': return <SnowflakeIcon {...p} />;
    case 'electricidad': return <LightningIcon {...p} />;
    case 'acido': return <FlaskIcon {...p} />;
    case 'veneno': return <SkullIcon {...p} />;
    case 'sangrado': return <DropIcon {...p} />;
    case 'mental': return <SpiralIcon {...p} />;
    case 'lento': return <TimerIcon {...p} />;
    case 'marca': return <TargetIcon {...p} />;
    default: return <HeartIcon {...p} />;
  }
}

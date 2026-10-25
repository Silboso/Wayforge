import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import type { useTema } from '../tema';

export function BotonTema({ tema }: { tema: ReturnType<typeof useTema> }) {
  const oscuro = tema.tema === 'obsidiana';
  return (
    <button
      onClick={tema.alternar}
      className="flex size-10 items-center justify-center rounded-lg border border-borde bg-superficie text-texto-suave transition hover:bg-superficie-2"
      aria-label={oscuro ? 'Cambiar a Taberna (claro)' : 'Cambiar a Obsidiana (oscuro)'}
      title={oscuro ? 'Taberna (claro)' : 'Obsidiana (oscuro)'}
    >
      {oscuro ? <SunIcon size={20} aria-hidden /> : <MoonIcon size={20} aria-hidden />}
    </button>
  );
}

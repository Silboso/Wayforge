import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import type { useTema } from '../tema';

export function BotonTema({ tema }: { tema: ReturnType<typeof useTema> }) {
  const oscuro = tema.tema === 'noche';
  return (
    <button
      onClick={tema.alternar}
      className="flex size-10 items-center justify-center rounded-lg border border-borde bg-superficie text-texto-suave transition hover:bg-superficie-2"
      aria-label={oscuro ? 'Cambiar al cuaderno claro' : 'Cambiar al cuaderno de noche'}
      title={oscuro ? 'Cuaderno (claro)' : 'Noche (oscuro)'}
    >
      {oscuro ? <SunIcon size={20} aria-hidden /> : <MoonIcon size={20} aria-hidden />}
    </button>
  );
}

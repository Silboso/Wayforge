import { DoorIcon, EraserIcon, EyeIcon, LockIcon, SquareIcon, WallIcon, SquareSplitVerticalIcon, XIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import type { Accion, EstadoSala } from '../../../compartido/sala';
import { visionActiva } from '../../../compartido/vision';
import type { HerramientaMuros } from '../Tablero';
import { useConfirmar } from '../hud/Modal';
import { claseBotonPrincipal, claseBotonSecundario, Seccion } from '../ui';

export const HERRAMIENTAS: { clave: HerramientaMuros; nombre: string; ayuda: string; icono: ReactNode }[] = [
  { clave: 'habitacion', nombre: 'Habitación', ayuda: 'Toca dos esquinas opuestas: cuatro muros con una puerta abajo.', icono: <SquareIcon size={18} weight="bold" aria-hidden /> },
  { clave: 'muro', nombre: 'Muro', ayuda: 'Toca esquina por esquina; Esc termina el trazo.', icono: <WallIcon size={18} weight="bold" aria-hidden /> },
  { clave: 'puerta', nombre: 'Puerta', ayuda: 'Toca sus dos extremos (una casilla de ancho).', icono: <DoorIcon size={18} weight="bold" aria-hidden /> },
  { clave: 'ventana', nombre: 'Ventana', ayuda: 'Deja ver, pero no pasar.', icono: <SquareSplitVerticalIcon size={18} weight="bold" aria-hidden /> },
  { clave: 'llave', nombre: 'Llave', ayuda: 'Toca una puerta para cerrarla con llave (solo tú la abres).', icono: <LockIcon size={18} weight="bold" aria-hidden /> },
  { clave: 'borrar', nombre: 'Borrar', ayuda: 'Toca un muro, puerta o ventana para quitarlo.', icono: <EraserIcon size={18} weight="bold" aria-hidden /> },
];

// La sección de la mesa para muros y niebla: entrar al editor, prender la niebla, ver lo que ven los jugadores
export function SeccionMurosNiebla({ estado, enviar, onEditar, verNiebla, onVerNiebla }: {
  estado: EstadoSala;
  enviar: (accion: Accion) => void;
  onEditar: () => void;
  verNiebla: boolean;
  onVerNiebla: (ver: boolean) => void;
}) {
  const confirmar = useConfirmar();
  const muros = estado.mapa.muros ?? [];
  const puertas = muros.filter((m) => m.tipo === 'puerta').length;
  const activa = visionActiva(estado.mapa);
  return (
    <Seccion titulo="Muros y niebla de guerra">
      <p className="text-sm text-texto-suave">
        Los muros y las puertas cerradas tapan la vista y el paso; las ventanas dejan ver. Los jugadores ven lo que ve
        cualquiera del grupo: lo demás queda bajo la niebla, y las criaturas de ahí ni les llegan.
      </p>
      <button className={claseBotonPrincipal} onClick={onEditar}>
        <WallIcon size={18} aria-hidden /> Dibujar muros y puertas
      </button>
      <p className="text-xs text-texto-suave">{muros.length ? `${muros.length} tramos · ${puertas} ${puertas === 1 ? 'puerta' : 'puertas'}` : 'Todavía no hay muros: sin muros, la niebla no tapa nada.'}</p>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-acento" checked={activa} onChange={(e) => enviar({ tipo: 'editar-mapa', cambios: { niebla: e.target.checked } })} />
        Niebla de guerra
      </label>
      <label className={`flex cursor-pointer items-center gap-2 text-sm ${activa ? '' : 'opacity-50'}`}>
        <input type="checkbox" className="size-4 accent-acento" disabled={!activa} checked={verNiebla && activa} onChange={(e) => onVerNiebla(e.target.checked)} />
        <EyeIcon size={16} aria-hidden /> Ver lo que ven los jugadores
      </label>
      <div className="flex flex-wrap gap-2">
        <button className={claseBotonSecundario} disabled={!estado.mapa.exploradas}
          onClick={() => confirmar.pedir({ titulo: '¿Volver a cubrir todo?', texto: 'Lo que el grupo ya exploró vuelve a quedar bajo la niebla (salvo lo que ve ahora).', si: 'Cubrir', hacer: () => enviar({ tipo: 'editar-mapa', cambios: { exploradas: '' } }) })}>
          Volver a cubrir lo explorado
        </button>
        {muros.length > 0 && (
          <button className={`${claseBotonSecundario} text-peligro`}
            onClick={() => confirmar.pedir({ titulo: '¿Borrar todos los muros?', texto: 'Se quitan muros, puertas y ventanas de este mapa.', si: 'Borrar', hacer: () => enviar({ tipo: 'editar-mapa', cambios: { muros: [] } }) })}>
            Borrar todos los muros
          </button>
        )}
      </div>
      {confirmar.ventana}
    </Seccion>
  );
}

// La barra flotante del editor: elegir herramienta y terminar
export function BarraMuros({ herramienta, onElegir, onListo }: {
  herramienta: HerramientaMuros;
  onElegir: (h: HerramientaMuros) => void;
  onListo: () => void;
}) {
  const actual = HERRAMIENTAS.find((h) => h.clave === herramienta)!;
  return (
    <div className="tarjeta-cae tarjeta pointer-events-auto flex flex-col gap-1.5 px-3 py-2" role="toolbar" aria-label="Dibujar muros">
      <div className="flex flex-wrap items-center gap-1">
        {HERRAMIENTAS.map((h) => (
          <button key={h.clave} aria-pressed={h.clave === herramienta} title={h.ayuda} onClick={() => onElegir(h.clave)}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-titulo text-[14px] transition ${h.clave === herramienta ? 'bg-acento text-sobre-acento' : 'hover:bg-superficie-2'}`}>
            {h.icono}{h.nombre}
          </button>
        ))}
        <button className="ml-1 flex h-9 items-center gap-1 rounded-lg border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10" onClick={onListo}>
          <XIcon size={14} weight="bold" aria-hidden /> Listo
        </button>
      </div>
      <p className="px-1 font-titulo text-[13px] text-texto-suave">{actual.ayuda}</p>
    </div>
  );
}

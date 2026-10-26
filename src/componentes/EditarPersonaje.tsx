import { useRef, useState } from 'react';
import type { Personaje } from '../../reglas/pf2e';
import type { Sala } from '../conexion';
import { EditorFicha } from './EditorFicha';
import { mensajeRechazo } from './Entrada';
import { Confirmar, Modal } from './hud/Modal';

// Solo lo que cambió: mientras se edita, la mesa sigue (le pueden bajar los PG) y no hay que pisarlo
export function cambiosDe(antes: Personaje, despues: Personaje): Partial<Omit<Personaje, 'id'>> {
  const cambios: Record<string, unknown> = {};
  for (const k of Object.keys(despues) as (keyof Personaje)[]) {
    if (k !== 'id' && JSON.stringify(antes[k]) !== JSON.stringify(despues[k])) cambios[k] = despues[k];
  }
  return cambios as Partial<Omit<Personaje, 'id'>>;
}

// El editor de un personaje en una ventana sobre la mesa: el juego sigue a la vista detrás.
// Si se cierra con cambios sin guardar, pregunta antes de tirarlos.
export function EditarPersonaje({ salaId, sala, personaje, onCerrar }: {
  salaId: string;
  sala: Sala;
  personaje: Personaje;
  onCerrar: () => void;
}) {
  // La ficha tal como estaba al abrir: contra ella se comparan los cambios
  const [inicial] = useState(personaje);
  const borrador = useRef<Personaje>(personaje);
  const [preguntando, setPreguntando] = useState(false);

  function cerrar() {
    sala.limpiarRechazo();
    onCerrar();
  }
  function intentarCerrar() {
    if (Object.keys(cambiosDe(inicial, borrador.current)).length) setPreguntando(true);
    else cerrar();
  }

  return (
    <>
      <Modal titulo={`Editar a ${inicial.nombre}`} subtitulo="Cambia lo que quieras; la mesa sigue detrás. Guarda cuando termines." onCerrar={intentarCerrar} ancho="max-w-3xl">
        <EditorFicha
          salaId={salaId}
          inicial={inicial}
          modo="editar"
          enVentana
          error={mensajeRechazo(sala.rechazo)}
          onCambio={(p) => { borrador.current = p; }}
          onCancelar={intentarCerrar}
          onGuardar={(nueva) => {
            const cambios = cambiosDe(inicial, nueva);
            if (Object.keys(cambios).length) sala.enviar({ tipo: 'editar-personaje', id: inicial.id, cambios });
            cerrar();
          }}
        />
      </Modal>
      {preguntando && (
        <Confirmar titulo="¿Salir sin guardar?" texto="Hiciste cambios en la ficha que todavía no guardaste." si="Salir sin guardar" no="Seguir editando" peligro
          onSi={cerrar} onNo={() => setPreguntando(false)} />
      )}
    </>
  );
}

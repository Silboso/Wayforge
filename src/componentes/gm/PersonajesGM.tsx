import { useState } from 'react';
import { PuntosHeroicos } from '../Descanso';
import type { Personaje } from '../../../reglas/pf2e';
import { tokenEnTurno, type EstadoSala, type Token } from '../../../compartido/sala';
import type { Sala } from '../../conexion';
import { Ficha } from '../Ficha';
import { claseBotonSecundario } from '../ui';
import { FotoPegada } from '../hud/piezas';
import { useConfirmar } from '../hud/Modal';
import { SparkleIcon } from '@phosphor-icons/react';
import { SubirNivel } from '../nivel/SubirNivel';
import { cobrar, textoPrecio } from '../../../reglas/objetos';

// El GM ve y maneja todas las fichas
export function PersonajesGM({ estado, sala, objetivo, onCrear, onEditar }: {
  estado: EstadoSala;
  sala: Sala;
  objetivo: { id: string; nombre: string } | null;
  onCrear: () => void;
  onEditar: (p: Personaje) => void;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const confirmar = useConfirmar();
  const personajes = Object.values(estado.personajes);
  const subiendoP = subiendo ? estado.personajes[subiendo] : undefined;
  const abiertoP = abierto ? estado.personajes[abierto] : undefined;
  const tokenAbierto = abiertoP ? tokenDe(estado, abiertoP.id) : undefined;

  if (abiertoP) {
    return (
      <div className="flex flex-col gap-4">
        <button className={`${claseBotonSecundario} self-start`} onClick={() => setAbierto(null)}>← Todos los personajes</button>
        <Ficha
          personaje={abiertoP}
          condiciones={tokenAbierto?.condiciones ?? []}
          puedeEditar
          objetivo={objetivo && objetivo.id !== tokenAbierto?.id ? objetivo : null}
          siguienteAtaque={estado.combate && tokenAbierto && tokenEnTurno(estado)?.id === tokenAbierto.id ? estado.combate.ataques : null}
          onPonerCondicion={(clave, valor) => tokenAbierto && sala.enviar({ tipo: 'poner-condicion', tokenId: tokenAbierto.id, clave, valor })}
          onCambiar={(cambios) => sala.enviar({ tipo: 'editar-personaje', id: abiertoP.id, cambios })}
          onTirar={(que) => sala.tirar(abiertoP.id, que)}
          onAbrirEditor={() => onEditar(abiertoP)}
        />
        <button
          className={`${claseBotonSecundario} text-peligro`}
          onClick={() => confirmar.pedir({
            titulo: `¿Quitar a ${abiertoP.nombre}?`, texto: 'Se borran su ficha y su token de la mesa. No se puede deshacer.', si: 'Quitar', peligro: true,
            hacer: () => { sala.enviar({ tipo: 'borrar-personaje', id: abiertoP.id }); setAbierto(null); },
          })}
        >
          Quitar personaje de la mesa
        </button>
        {confirmar.ventana}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {personajes.length === 0 && (
        <p className="text-sm text-texto-suave">
          Aún no hay personajes. Tus jugadores los crean al entrar con el código de la mesa, o puedes crearlos tú.
        </p>
      )}
      {personajes.map((p) => (
        // Dos líneas: quién es (abre su ficha) y, debajo, sus Hero Points y subir de nivel; así el nombre siempre cabe
        <div key={p.id} className="flex flex-col gap-1 rounded-xl border border-borde bg-superficie py-2 pr-1 pl-3">
          <div className="flex items-center gap-3">
            <FotoPegada src={p.retrato || undefined} inicial={p.nombre.slice(0, 1)} tamano="size-12" nombre={p.nombre} onEditar={() => onEditar(p)} />
            <button className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-superficie-2" onClick={() => setAbierto(p.id)}>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.nombre}</div>
                <div className="truncate text-sm text-texto-suave">{[p.ascendencia, p.clase].filter(Boolean).join(' ')} · Nivel {p.nivel}</div>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-texto-suave">{p.pgActual} PG</span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 pl-[60px]">
            <PuntosHeroicos p={p} muriendo={false} onCambiar={(cantidad) => sala.enviar({ tipo: 'dar-heroico', personajeId: p.id, cantidad })} />
            {p.nivel < 20 && (
              <button className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 font-titulo text-[13px] text-acento hover:bg-acento/10" onClick={() => setSubiendo(p.id)}
                aria-label={`Subir a ${p.nombre} a nivel ${p.nivel + 1}`}>
                <SparkleIcon size={17} weight="fill" aria-hidden /> Nivel {p.nivel + 1}
              </button>
            )}
          </div>
        </div>
      ))}
      {personajes.length > 0 && <RepartirMonedas personajes={personajes} sala={sala} />}
      <button className={claseBotonSecundario} onClick={onCrear}>Crear un personaje para un jugador</button>
      {subiendoP && (
        <SubirNivel p={subiendoP} otros={personajes.filter((x) => x.id !== subiendoP.id)} onCerrar={() => setSubiendo(null)}
          onSubir={(nuevo) => { const { id: _id, ...cambios } = nuevo; sala.enviar({ tipo: 'editar-personaje', id: subiendoP.id, cambios }); }} />
      )}
    </div>
  );
}

// El botín en monedas: el GM escribe cuánto oro hubo y se reparte en partes iguales (el resto, en plata y cobre)
function RepartirMonedas({ personajes, sala }: { personajes: Personaje[]; sala: Sala }) {
  const [oro, setOro] = useState('');
  const [hecho, setHecho] = useState('');
  const total = Math.max(0, Number(oro.replace(',', '.')) || 0);
  // En piezas de plata: el reparto llega hasta el cobre
  const cadaUno = Math.floor((total * 100) / personajes.length) / 10;
  const repartir = () => {
    if (cadaUno <= 0) return;
    for (const p of personajes) {
      sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { monedas: cobrar(p.monedas ?? { oro: 0, plata: 0, cobre: 0 }, cadaUno) } });
    }
    sala.decir(`Repartimos ${textoPrecio(total * 10)}: ${textoPrecio(cadaUno)} para cada uno (ya está en sus mochilas).`);
    setHecho(`Listo: ${textoPrecio(cadaUno)} a cada uno.`);
    setOro('');
  };
  return (
    <form className="flex flex-col gap-1.5 rounded-xl border border-dashed border-borde px-3 py-2.5" onSubmit={(e) => { e.preventDefault(); repartir(); }}>
      <label className="font-titulo text-[14px]" htmlFor="botin-oro">Repartir monedas entre todos</label>
      <div className="flex items-center gap-2">
        <input id="botin-oro" inputMode="decimal" className="h-10 w-24 rounded-lg border border-borde bg-superficie px-3 tabular-nums" placeholder="0"
          value={oro} onChange={(e) => { setOro(e.target.value); setHecho(''); }} />
        <span className="font-titulo text-[14px] text-texto-suave">po</span>
        <button className="boli ml-auto h-10 border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10 disabled:opacity-40" disabled={cadaUno <= 0}>
          {cadaUno > 0 ? `${textoPrecio(cadaUno)} a cada uno` : 'Repartir'}
        </button>
      </div>
      {hecho && <p className="font-titulo text-[13px] text-exito" role="status">{hecho}</p>}
    </form>
  );
}

function tokenDe(estado: EstadoSala, personajeId: string): Token | undefined {
  return Object.values(estado.tokens).find((t) => t.personajeId === personajeId);
}

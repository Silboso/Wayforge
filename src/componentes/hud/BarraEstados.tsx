import { CONDICIONES, type Condicion } from '../../../reglas/condiciones';
import { duracionTexto, modificadorTexto, type EfectoActivo } from '../../../reglas/efectos';
import { IconoAspecto, TINTA_ASPECTO } from '../aspectos';
import { ConFlotante } from './Flotante';

// Las rondas que le quedan a un efecto, en corto (para la esquina del ícono)
function quedan(e: EfectoActivo): string {
  const d = e.duracion;
  if (d.tipo === 'rondas') return String(d.rondas);
  if (d.tipo === 'sostenido') return 'S';
  return '∞';
}

// Lo que tienes encima, como la barra de efectos de un juego: un ícono por efecto (con su tinta y las rondas que
// le quedan) y un post-it por condición. Con el cursor se lee qué hace; tocar una condición la cambia.
export function BarraEstados({ efectos, condiciones, onQuitarEfecto, onCondiciones }: {
  efectos: EfectoActivo[];
  condiciones: Condicion[];
  onQuitarEfecto: (id: string) => void;
  onCondiciones: () => void;
}) {
  const visibles = efectos.filter((e) => !e.inmuneA);
  if (visibles.length === 0 && condiciones.length === 0) return null;
  return (
    <section aria-label="Efectos y condiciones" className="mt-2 w-[150px] rounded-lg border border-borde bg-superficie/95 p-2 shadow-[0_4px_10px_-6px_var(--sombra)]">
      <h2 className="mb-1.5 font-titulo text-[12.5px] font-semibold text-texto-suave">Sobre ti</h2>
      <div className="flex max-h-[96px] flex-wrap gap-1.5 overflow-y-auto">
        {visibles.map((e) => {
          const tinta = e.aspecto ? TINTA_ASPECTO[e.aspecto] : e.beneficioso ? 'var(--exito)' : 'var(--peligro)';
          return (
            <ConFlotante key={e.id} lado="derecha" contenido={(
              <div className="flex flex-col gap-1">
                <b className={`text-[15px] ${e.beneficioso ? '' : 'text-peligro'}`}>{e.nombre}</b>
                <p className="text-[12.5px] text-texto-suave">{duracionTexto(e.duracion)}{e.origen ? ` · de ${e.origen.nombre}` : ''}</p>
                {e.modificadores.length > 0 && <p className="text-[13px]">{e.modificadores.map(modificadorTexto).join(', ')}</p>}
                {e.persistente && <p className="text-[13px] text-peligro">{e.persistente.dano} {e.persistente.tipo} al terminar tu turno (con 15+ en un d20 se apaga)</p>}
                {e.condiciones?.length ? <p className="text-[13px]">Trae: {e.condiciones.map((c) => `${CONDICIONES[c.clave].nombre}${CONDICIONES[c.clave].conValor ? ` ${c.valor}` : ''}`).join(', ')}</p> : null}
                <p className="text-[12px] text-texto-suave">Toca el ícono para quitártelo.</p>
              </div>
            )}>
              <button onClick={() => onQuitarEfecto(e.id)} aria-label={`${e.nombre}: ${duracionTexto(e.duracion)}. Quitar`}
                className="relative flex size-[30px] items-center justify-center rounded-[7px] border-2 border-texto/60 text-white shadow-sm transition hover:scale-110"
                style={{ background: tinta }}>
                <IconoAspecto aspecto={e.aspecto} size={16} />
                <span className="absolute -right-1.5 -bottom-1.5 min-w-[15px] rounded-[4px] border border-borde bg-superficie px-0.5 text-center font-titulo text-[10px] leading-[13px] font-bold text-texto">
                  {quedan(e)}
                </span>
              </button>
            </ConFlotante>
          );
        })}
        {condiciones.map((c) => {
          const def = CONDICIONES[c.clave];
          return (
            <ConFlotante key={c.clave} lado="derecha" contenido={(
              <div className="flex flex-col gap-1">
                <b className="text-[15px]">{def.nombre}{def.conValor ? ` ${c.valor}` : ''}</b>
                <p className="text-[13px] leading-snug">{def.ayuda}</p>
                <p className="text-[12px] text-texto-suave">Toca para cambiarla o quitarla.</p>
              </div>
            )}>
              <button onClick={onCondiciones} aria-label={`${def.nombre}${def.conValor ? ` ${c.valor}` : ''}: cambiar`}
                className="flex h-[30px] min-w-[30px] items-center justify-center rounded-[3px] bg-[var(--postit)] px-1 font-titulo text-[12px] font-bold text-[#5a2a3a] shadow-sm transition hover:scale-110">
                {def.nombre.slice(0, 1)}{def.conValor ? c.valor : ''}
              </button>
            </ConFlotante>
          );
        })}
      </div>
    </section>
  );
}

import { useState } from 'react';
import { ClockIcon, HeartbeatIcon, MedalIcon, MoonStarsIcon } from '@phosphor-icons/react';
import { relojTexto, type Accion, type EstadoSala } from '../../compartido/sala';
import { MAX_HEROICOS, NIVELES_CURAR } from '../../reglas/muerte';
import { ACTIVIDADES, esActividad, type Actividad } from '../../reglas/exploracion';
import { signo, type Personaje } from '../../reglas/pf2e';
import { Modal } from './hud/Modal';
import type { Aptitud } from '../../reglas/aptitudes';
import { interaccionDe, potenciar, rangoDeLanzamiento } from '../../reglas/interacciones';
import { claseBotonSecundario, claseEntrada, Seccion } from './ui';

// Los Hero Points en la hoja: medallitas; si estás muriendo, el botón para gastarlos todos y no morir
export function PuntosHeroicos({ p, muriendo, onRecuperar, onCambiar }: {
  p: Personaje;
  muriendo: boolean;
  onRecuperar?: () => void;
  // El GM los da o los quita
  onCambiar?: (cantidad: number) => void;
}) {
  const puntos = p.puntosHeroicos ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2 font-titulo">
      <span className="text-[13px] text-texto-suave" title="Repite una tirada tuya (1), o gástalos todos para no morir">Hero Points</span>
      <span className="flex gap-0.5" aria-label={`${puntos} de ${MAX_HEROICOS} Hero Points`}>
        {Array.from({ length: MAX_HEROICOS }, (_, i) => (
          <MedalIcon key={i} size={18} weight={i < puntos ? 'fill' : 'regular'} className={i < puntos ? 'text-[#c48a16]' : 'text-texto-suave/50'} aria-hidden />
        ))}
      </span>
      {onCambiar && (
        <span className="flex gap-1">
          <button className="h-7 w-7 rounded-md border border-borde text-sm hover:bg-superficie-2 disabled:opacity-40" disabled={puntos <= 0} onClick={() => onCambiar(-1)} aria-label="Quitar un Hero Point">−</button>
          <button className="h-7 w-7 rounded-md border border-borde text-sm hover:bg-superficie-2 disabled:opacity-40" disabled={puntos >= MAX_HEROICOS} onClick={() => onCambiar(1)} aria-label="Dar un Hero Point">+</button>
        </span>
      )}
      {muriendo && onRecuperar && puntos > 0 && (
        <button onClick={onRecuperar} className="flex items-center gap-1 rounded-md bg-peligro px-2 py-1 text-[13px] font-semibold text-sobre-acento">
          <HeartbeatIcon size={15} weight="bold" aria-hidden /> Gastarlos y no morir
        </button>
      )}
    </div>
  );
}

// El reloj de la mesa y los descansos del grupo (para el GM)
export function SeccionTiempo({ estado, enviar }: { estado: EstadoSala; enviar: (accion: Accion) => void }) {
  const enCombate = !!estado.combate;
  return (
    <Seccion titulo="Tiempo y descanso">
      <p className="flex items-center gap-2 font-titulo text-[17px]"><ClockIcon size={20} aria-hidden /> {relojTexto(estado.reloj ?? 0)}</p>
      <p className="text-sm text-texto-suave">Al pasar el tiempo se cuentan los efectos de todos (1 minuto = 10 rondas). Treat Wounds suma 10 minutos solo.</p>
      <div className="grid grid-cols-3 gap-2">
        {([[10, '+10 min'], [60, '+1 hora'], [480, '+8 horas']] as const).map(([m, t]) => (
          <button key={m} className={claseBotonSecundario} disabled={enCombate} onClick={() => enviar({ tipo: 'pasar-tiempo', minutos: m })}>{t}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className={claseBotonSecundario} disabled={enCombate} onClick={() => enviar({ tipo: 'descanso-grupo', descanso: 'diez' })}
          title="10 minutos: cada uno recupera 1 punto de foco; quien está a vida completa pierde Wounded">
          <ClockIcon size={16} aria-hidden /> Descanso corto
        </button>
        <button className={claseBotonSecundario} disabled={enCombate} onClick={() => enviar({ tipo: 'descanso-grupo', descanso: 'noche' })}
          title="8 horas: vida, espacios y foco; Doomed baja 1 y se quita la fatiga">
          <MoonStarsIcon size={16} aria-hidden /> Dormir la noche
        </button>
      </div>
      {enCombate && <p className="text-xs text-texto-suave">En combate el tiempo corre por rondas.</p>}
    </Seccion>
  );
}

// Elegir la dificultad de Treat Wounds: solo las que permite tu rango en Medicine, con lo que cura y la chance
export function ElegirCurar({ p, medicina, candidatos, inicial, onElegir, onCerrar }: {
  p: Personaje;
  medicina: number;
  // A quiénes puede curar: él mismo y los aliados a su lado
  candidatos: { id: string; nombre: string }[];
  inicial: string;
  onElegir: (objetivoId: string, nivel: number) => void;
  onCerrar: () => void;
}) {
  const rango = p.habilidades.medicine;
  const [objetivo, setObjetivo] = useState(inicial);
  return (
    <Modal titulo="Curar heridas (Treat Wounds)" subtitulo="10 minutos de atención. Después queda inmune una hora." onCerrar={onCerrar} ancho="max-w-md">
      <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="A quién">
        {candidatos.map((c) => (
          <button key={c.id} role="radio" aria-checked={objetivo === c.id} onClick={() => setObjetivo(c.id)}
            className={`rounded-lg border-2 px-3 py-1 font-titulo text-[14px] ${objetivo === c.id ? 'border-acento bg-acento/10 font-semibold' : 'border-borde hover:bg-superficie-2'}`}>
            {c.nombre}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {NIVELES_CURAR.map((n) => {
          const puede = n.rango <= rango;
          // Chance de éxito con un d20: sacar CD − modificador o más
          const chance = Math.max(5, Math.min(95, (21 - (n.cd - medicina)) * 5));
          return (
            <li key={n.rango}>
              <button disabled={!puede} onClick={() => onElegir(objetivo, n.rango)}
                className="flex w-full items-center gap-3 rounded-lg border-2 border-borde px-3 py-2 text-left transition hover:border-acento disabled:opacity-45 disabled:hover:border-borde">
                <div className="flex-1">
                  <b className="font-titulo text-[16px]">{n.nombre} · CD {n.cd}</b>
                  <p className="text-[13px] text-texto-suave">Cura 2d8{n.bono ? `+${n.bono}` : ''} (crítico 4d8{n.bono ? `+${n.bono}` : ''}); con pifia hace 1d8 de daño</p>
                </div>
                <span className="text-right font-titulo text-[13px]">{puede ? <><b className="text-[17px] text-acento">{chance}%</b><br />Medicine {signo(medicina)}</> : 'necesitas más rango'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

// La actividad de exploración (fuera de combate): decide con qué se tira la iniciativa cuando empieza uno
export function ElegirActividad({ actual, onCambiar }: { actual?: string; onCambiar: (a: Actividad | undefined) => void }) {
  const valor = esActividad(actual) ? actual : '';
  return (
    <label className="flex flex-col gap-1 font-titulo text-[13px] text-texto-suave">
      Mientras exploran
      <select className={`${claseEntrada} h-9! text-[14px] text-texto`} value={valor} title={valor ? ACTIVIDADES[valor].ayuda : 'Elige qué haces mientras el grupo avanza'}
        onChange={(e) => onCambiar(esActividad(e.target.value) ? e.target.value : undefined)}>
        <option value="">Nada en especial</option>
        {(Object.keys(ACTIVIDADES) as Actividad[]).map((a) => <option key={a} value={a}>{ACTIVIDADES[a].verbo} ({ACTIVIDADES[a].nombre})</option>)}
      </select>
    </label>
  );
}

// Con qué espacio lanzar un conjuro: cada rango libre, cuántos quedan y lo que hace ahí (si sube con el rango)
export function ElegirRango({ a, nivel, rangos, espacios, onElegir, onCerrar }: {
  a: Aptitud;
  nivel: number;
  rangos: number[];
  espacios: { rango: number; max: number; usados: number }[];
  onElegir: (rango: number) => void;
  onCerrar: () => void;
}) {
  const inter = interaccionDe(a);
  return (
    <Modal titulo={`¿En qué rango lanzas ${a.nombre}?`} subtitulo="Un espacio más alto lo potencia, si el conjuro sube con el rango." onCerrar={onCerrar} ancho="max-w-sm">
      <ul className="flex flex-col gap-2">
        {rangos.map((r) => {
          const e = espacios.find((x) => x.rango === r)!;
          const potenciada = inter ? potenciar(inter, a, rangoDeLanzamiento(a, nivel, r)) : null;
          const efecto = potenciada?.dano ? `${potenciada.dano.formula}${potenciada.dano.tipo ? ` ${potenciada.dano.tipo}` : ''}` : potenciada?.curacion ? `cura ${potenciada.curacion}` : '';
          return (
            <li key={r}>
              <button onClick={() => onElegir(r)} className="flex w-full items-center gap-3 rounded-lg border-2 border-borde px-3 py-2 text-left transition hover:border-acento">
                <b className="font-titulo text-[22px] text-acento">{r}</b>
                <span className="flex-1">
                  <span className="block font-titulo text-[15px] font-semibold">Rango {r}{efecto ? ` · ${efecto}` : ''}</span>
                  <span className="block text-[12.5px] text-texto-suave">Te quedan {e.max - e.usados} de {e.max}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

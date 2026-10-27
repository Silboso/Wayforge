import { interaccionDe, resumenInteraccion } from '../../../reglas/interacciones';
import type { Fila } from './secciones';
import { IconoHabilidad } from './IconoHabilidad';
import { CostoAccion, Tecla } from './piezas';

const corto = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

// Lo que hace una acción, en una tarjeta para mirar al pasar el cursor: costo, alcance, qué se tira, qué pasa
export function TarjetaHabilidad({ fila, alcance, tecla }: { fila: Fila; alcance?: number | null; tecla?: string }) {
  const a = fila.tipo === 'aptitud' ? fila.aptitud : null;
  const inter = a ? interaccionDe(a) : null;
  const costo = fila.tipo === 'golpe' ? 1 : a!.costo;
  const lejos = alcance == null ? null : alcance <= 5 ? 'cuerpo a cuerpo' : `${alcance} ft`;
  const descripcion = a ? a.descripcion.replace(/\n+/g, ' ') : '';
  const rasgos = fila.tipo === 'golpe' ? (fila.golpe.agil ? ['agile'] : []) : a!.rasgos;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <IconoHabilidad fila={fila} tamano={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <b className="truncate text-[16px] leading-tight">{fila.nombre}</b>
            {tecla && <span className="ml-auto"><Tecla>{tecla}</Tecla></span>}
          </div>
          {fila.detalle && <p className="truncate text-[12.5px] text-texto-suave">{fila.detalle}</p>}
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
        <CostoAccion costo={costo} />
        {lejos && <span className="text-texto-suave">· {lejos}</span>}
        {fila.valor && <span className="text-texto-suave">· tiras <b className="text-acento">{fila.valor}</b></span>}
        {a && a.recuperacion.tipo !== 'siempre' && <span className={fila.tipo === 'aptitud' && !fila.disp.puede ? 'text-peligro' : 'text-texto-suave'}>· {fila.tipo === 'aptitud' ? fila.disp.texto : ''}</span>}
      </p>
      {fila.tipo === 'golpe' && (
        <p className="text-[13px]">Strike con {fila.golpe.nombre || 'tu arma'}: {fila.golpe.dados} {fila.golpe.tipoDano}{fila.golpe.distancia && fila.golpe.distancia > 10 ? `, a distancia (${fila.golpe.distancia} ft)` : ''}.</p>
      )}
      {inter && (
        <ul className="list-disc pl-4 text-[13px] leading-snug">
          {resumenInteraccion(inter).map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      {descripcion && <p className="text-[12.5px] leading-snug text-texto-suave">{corto(descripcion, 300)}</p>}
      {rasgos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {rasgos.slice(0, 6).map((r) => <span key={r} className="rounded border border-borde px-1.5 text-[11px] uppercase tracking-wide text-texto-suave">{r}</span>)}
        </div>
      )}
    </div>
  );
}

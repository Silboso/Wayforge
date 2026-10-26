import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon, MinusIcon, PlusIcon, ShieldIcon, WifiHighIcon } from '@phosphor-icons/react';
import { calcular, signo, type Personaje } from '../../../reglas/pf2e';
import { ACCIONES_BASICAS, todasLasAptitudes, type Aptitud } from '../../../reglas/aptitudes';
import { CONDICIONES, type ClaveCondicion, type Condicion } from '../../../reglas/condiciones';
import { tokenEnTurno, type EstadoSala, type Presente } from '../../../compartido/sala';
import { BarraPG, CostoAccion, PostitCondicion, Tecla } from './piezas';
import { Modal } from './Modal';

// Paneles del cajón lateral (o del cajón de abajo en el teléfono): cosas para consultar sin salir de la mesa

// El grupo: cómo están los aliados (PG, CA, condiciones), quién está conectado y a quién le toca
export function PanelGrupo({ estado, presentes, miId }: { estado: EstadoSala; presentes: Presente[]; miId: string }) {
  const enTurno = tokenEnTurno(estado);
  const conectados = new Set(presentes.map((x) => x.nombre));
  const personajes = Object.values(estado.personajes);
  const enemigos = Object.values(estado.tokens).filter((t) => !t.personajeId && t.tipo === 'enemigo');
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {personajes.map((p) => {
          const token = Object.values(estado.tokens).find((t) => t.personajeId === p.id);
          const f = calcular(p, token?.condiciones ?? []);
          const leToca = enTurno && token && enTurno.id === token.id;
          return (
            <li key={p.id} className={`rounded-lg border-[1.5px] px-3 py-2.5 ${leToca ? 'border-acento bg-acento/[0.05]' : 'border-borde bg-superficie'}`}>
              <div className="flex items-center gap-3">
                <div className="size-11 shrink-0 overflow-hidden rounded-[3px] border-[3px] border-white bg-superficie-2 shadow-[0_3px_8px_-4px_var(--sombra)]">
                  {p.retrato ? <img src={p.retrato} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center font-titulo text-lg font-bold text-acento">{p.nombre.slice(0, 1)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-titulo text-[17px] font-bold">
                    <span className="truncate">{p.nombre}</span>
                    {p.id === miId && <span className="text-[12px] font-normal text-texto-suave">(tú)</span>}
                    {leToca && <span className="marcatextos text-[12px]">le toca</span>}
                  </p>
                  <p className="truncate text-[12.5px] text-texto-suave">{[p.ascendencia, p.clase].filter(Boolean).join(' · ')} · nivel {p.nivel}</p>
                </div>
                <span title={conectados.has(p.nombre) ? 'Conectado' : 'Sin conexión'} className={conectados.has(p.nombre) ? 'text-exito' : 'text-texto-suave/50'}>
                  <WifiHighIcon size={18} aria-label={conectados.has(p.nombre) ? 'Conectado' : 'Sin conexión'} />
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 font-titulo">
                <div className="flex-1"><BarraPG actual={p.pgActual} max={f.pgMax.total} temporales={p.pgTemporales} alto="h-2.5" /></div>
                <span className="text-[14px] tabular-nums"><b>{p.pgActual}</b>/{f.pgMax.total}</span>
                <span className="flex items-center gap-1 text-[14px]"><ShieldIcon size={14} aria-hidden /> {f.ca.total}</span>
                <span className="text-[13px] text-texto-suave">Perc {signo(f.percepcion.total)}</span>
              </div>
              {token?.condiciones && token.condiciones.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {token.condiciones.map((c, i) => <PostitCondicion key={c.clave} condicion={c} compacto giro={i % 2 ? -2 : 2} />)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {enemigos.length > 0 && (
        <section>
          <h3 className="mb-1 font-titulo text-[17px] font-bold text-peligro">Enemigos a la vista</h3>
          <ul className="flex flex-col">
            {enemigos.map((t) => (
              <li key={t.id} className="flex items-center gap-2 border-b border-dashed border-borde py-1.5">
                <span className="font-titulo text-[15px]">{t.nombre}</span>
                {enTurno?.id === t.id && <span className="marcatextos font-titulo text-[12px]">le toca</span>}
                <span className="ml-auto flex flex-wrap justify-end gap-1">
                  {(t.condiciones ?? []).map((c, i) => <PostitCondicion key={c.clave} condicion={c} compacto giro={i % 2 ? -2 : 2} />)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// La mochila: lo que lleva, cuánto pesa, sus monedas y sus consumibles para usar de un toque
export function PanelMochila({ p, onCambiar, onUsar }: {
  p: Personaje;
  onCambiar: (cambios: Partial<Personaje>) => void;
  onUsar: (a: Aptitud) => void;
}) {
  const [nuevo, setNuevo] = useState('');
  const inventario = p.inventario ?? [];
  const monedas = p.monedas ?? { oro: 0, plata: 0, cobre: 0 };
  const bulto = inventario.reduce((s, x) => s + x.bulto * x.cantidad, 0);
  // Encumbered a 5 + Str de Bulk; el máximo es 10 + Str
  const limite = 5 + p.atributos.str;
  const consumibles = todasLasAptitudes(p).filter((a) => a.recuperacion.tipo === 'consumible');
  const cambiarCantidad = (i: number, n: number) => onCambiar({
    inventario: n <= 0 ? inventario.filter((_, j) => j !== i) : inventario.map((x, j) => (j === i ? { ...x, cantidad: n } : x)),
  });
  const agregar = () => {
    const nombre = nuevo.trim();
    if (!nombre) return;
    onCambiar({ inventario: [...inventario, { id: `propio-${crypto.randomUUID().slice(0, 8)}`, nombre: nombre.slice(0, 80), cantidad: 1, bulto: 0.1 }] });
    setNuevo('');
  };
  const moneda = (clave: keyof typeof monedas, delta: number) => onCambiar({ monedas: { ...monedas, [clave]: Math.max(0, monedas[clave] + delta) } });
  return (
    <div className="flex flex-col gap-5">
      {consumibles.length > 0 && (
        <section>
          <h3 className="mb-1 font-titulo text-[17px] font-bold">Para usar</h3>
          <ul>
            {consumibles.map((a) => {
              // Usar uno descuenta de la cantidad que queda
              const quedan = a.recuperacion.tipo === 'consumible' ? a.recuperacion.cantidad : 0;
              return (
                <li key={a.id} className="flex items-center gap-3 border-b border-dashed border-borde py-2">
                  <CostoAccion costo={a.costo} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-titulo text-[15.5px] font-semibold">{a.verbo || a.nombre}</span>
                    <span className="block text-[12px] text-texto-suave">{a.descripcion}</span>
                  </span>
                  <span className="font-titulo text-[14px] text-texto-suave">×{Math.max(0, quedan)}</span>
                  <button className="boli h-9 bg-acento px-3 font-titulo text-[14px] font-bold text-sobre-acento disabled:bg-superficie-2 disabled:text-texto-suave"
                    disabled={quedan <= 0} onClick={() => onUsar(a)}>Usar</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="font-titulo text-[17px] font-bold">Mochila</h3>
          <span className={`font-titulo text-[13px] ${bulto > limite ? 'text-peligro' : 'text-texto-suave'}`}>
            Bulk {Math.floor(bulto)}{bulto % 1 >= 0.1 ? ` y ${Math.round((bulto % 1) * 10)} L` : ''} de {limite}{bulto > limite ? ' · cargado (Encumbered)' : ''}
          </span>
        </div>
        {inventario.length === 0 && <p className="text-[13.5px] text-texto-suave">Vacía. Agrega lo que vayas encontrando.</p>}
        <ul>
          {inventario.map((x, i) => (
            <li key={`${x.id}-${i}`} className="flex min-h-11 items-center gap-2 border-b border-dashed border-borde">
              <span className="min-w-0 flex-1 truncate font-titulo text-[15px]">{x.nombre}</span>
              <span className="text-[12px] text-texto-suave">{x.bulto < 1 ? 'L' : `${x.bulto} Bulk`}</span>
              <span className="flex items-center gap-1">
                <button className="flex size-8 items-center justify-center rounded-md border border-borde" onClick={() => cambiarCantidad(i, x.cantidad - 1)} aria-label={`Quitar un ${x.nombre}`}><MinusIcon size={13} /></button>
                <span className="w-6 text-center font-titulo text-[15px] font-bold">{x.cantidad}</span>
                <button className="flex size-8 items-center justify-center rounded-md border border-borde" onClick={() => cambiarCantidad(i, x.cantidad + 1)} aria-label={`Agregar un ${x.nombre}`}><PlusIcon size={13} /></button>
              </span>
            </li>
          ))}
        </ul>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); agregar(); }}>
          <input className="h-10 min-w-0 flex-1 rounded-lg border border-borde bg-superficie px-3" value={nuevo} maxLength={80} placeholder="Algo nuevo (Cuerda élfica, mapa…)" aria-label="Nuevo objeto" onChange={(e) => setNuevo(e.target.value)} />
          <button className="boli h-10 border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10">Agregar</button>
        </form>
      </section>

      <section>
        <h3 className="mb-2 font-titulo text-[17px] font-bold">Monedas</h3>
        <div className="grid grid-cols-3 gap-2">
          {([['oro', 'po', 'Oro'], ['plata', 'pp', 'Plata'], ['cobre', 'pc', 'Cobre']] as const).map(([clave, abrev, nombre]) => (
            <div key={clave} className="flex flex-col items-center rounded-lg border border-borde bg-superficie px-2 py-2">
              <span className="font-titulo text-[12.5px] text-texto-suave">{nombre}</span>
              <b className="font-titulo text-[24px] leading-tight">{monedas[clave]} <span className="text-[13px] font-normal text-texto-suave">{abrev}</span></b>
              <span className="mt-1 flex gap-1">
                <button className="flex size-8 items-center justify-center rounded-md border border-borde" onClick={() => moneda(clave, -1)} aria-label={`Quitar 1 ${abrev}`}><MinusIcon size={13} /></button>
                <button className="flex size-8 items-center justify-center rounded-md border border-borde" onClick={() => moneda(clave, 1)} aria-label={`Agregar 1 ${abrev}`}><PlusIcon size={13} /></button>
              </span>
            </div>
          ))}
        </div>
      </section>

      {p.escudo && (
        <section>
          <h3 className="mb-1 font-titulo text-[17px] font-bold">Escudo</h3>
          <p className="text-[14px]">{p.escudo.nombre}: +{p.escudo.ca} a la CA levantado · Dureza {p.escudo.dureza}</p>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="flex-1"><BarraPG actual={p.escudo.pgActual} max={p.escudo.pg} alto="h-2.5" /></div>
            <span className="font-titulo text-[14px]">{p.escudo.pgActual}/{p.escudo.pg} PG</span>
            <button className="flex size-8 items-center justify-center rounded-md border border-borde" aria-label="Escudo: −1 PG"
              onClick={() => onCambiar({ escudo: { ...p.escudo!, pgActual: Math.max(0, p.escudo!.pgActual - 1) } })}><MinusIcon size={13} /></button>
            <button className="flex size-8 items-center justify-center rounded-md border border-borde" aria-label="Escudo: +1 PG"
              onClick={() => onCambiar({ escudo: { ...p.escudo!, pgActual: Math.min(p.escudo!.pg, p.escudo!.pgActual + 1) } })}><PlusIcon size={13} /></button>
          </div>
        </section>
      )}
    </div>
  );
}

// Reglas rápidas: lo que se pregunta en la mesa, en una hoja de consulta con buscador
export function PanelReglas() {
  const [busca, setBusca] = useState('');
  const tiene = (t: string) => t.toLowerCase().includes(busca.toLowerCase());
  const condiciones = Object.values(CONDICIONES).filter((c) => tiene(`${c.nombre} ${c.ayuda}`));
  const acciones = ACCIONES_BASICAS.filter((a) => tiene(`${a.nombre} ${a.verbo} ${a.descripcion}`));
  const basicos = [
    { t: 'Tu turno', d: 'Tienes 3 acciones (◆◆◆) y 1 reacción por ronda. La reacción se recupera al empezar tu turno.' },
    { t: 'Grados de éxito', d: 'Igualar o pasar la CD es éxito; pasarla por 10 es crítico. Fallar por 10 es pifia. Un 20 natural sube un grado y un 1 lo baja.' },
    { t: 'Ataques seguidos', d: 'El 2.º ataque del turno tiene −5 (−4 con armas agile) y el 3.º, −10 (−8). Se llama Multiple Attack Penalty.' },
    { t: 'Flanquear', d: 'Si un aliado está del otro lado del enemigo, ese enemigo queda Off-guard (−2 a su CA) contra ustedes.' },
    { t: 'Moverse', d: 'Cada casilla son 5 ft. Las diagonales cuestan 5 y 10 ft, alternadas. Un Stride te mueve hasta tu Velocidad.' },
    { t: 'Cobertura', d: 'Cobertura menor +1, normal +2 y mayor +4 a la CA y a Reflex contra lo que viene del otro lado.' },
    { t: 'Caer a 0 PG', d: 'Quedas Dying 1 (Dying 2 si fue un crítico) más tu Wounded. Con Dying 4 mueres. Al curarte, ganas Wounded 1.' },
  ].filter((x) => tiene(`${x.t} ${x.d}`));
  return (
    <div className="flex flex-col gap-4">
      <label className="relative block">
        <MagnifyingGlassIcon size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" aria-hidden />
        <input className="h-10 w-full rounded-lg border border-borde bg-superficie pr-3 pl-9" value={busca} placeholder="Buscar (Prone, flanquear, Seek…)" aria-label="Buscar en las reglas" onChange={(e) => setBusca(e.target.value)} />
      </label>
      {basicos.length > 0 && (
        <section>
          <h3 className="mb-1 font-titulo text-[17px] font-bold">Lo básico</h3>
          <dl>
            {basicos.map((x) => (
              <div key={x.t} className="border-b border-dashed border-borde py-2">
                <dt className="font-titulo text-[15px] font-semibold">{x.t}</dt>
                <dd className="text-[13.5px] text-texto-suave">{x.d}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {condiciones.length > 0 && (
        <section>
          <h3 className="mb-2 font-titulo text-[17px] font-bold">Condiciones</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {condiciones.map((c, i) => (
              <div key={c.nombre} className="postit px-3 py-2 font-titulo" style={{ ['--giro' as string]: `${i % 2 ? -1 : 1}deg` }}>
                <b className="text-[15px]">{c.nombre}{c.conValor ? ' X' : ''}</b>
                <p className="mt-0.5 text-[12.5px] leading-snug">{c.ayuda}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {acciones.length > 0 && (
        <section>
          <h3 className="mb-1 font-titulo text-[17px] font-bold">Acciones de todos</h3>
          <ul>
            {acciones.map((a) => (
              <li key={a.id} className="flex gap-3 border-b border-dashed border-borde py-2">
                <span className="mt-1 w-9 shrink-0"><CostoAccion costo={a.costo} /></span>
                <span>
                  <b className="font-titulo text-[15px]">{a.verbo}</b> <span className="text-[12px] text-texto-suave">{a.nombre}</span>
                  <span className="block text-[13px] text-texto-suave">{a.descripcion}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Poner y quitar condiciones: las que tienes arriba (con su número), y todas las demás como post-its para pegar
export function ModalCondiciones({ condiciones, onPoner, onCerrar }: {
  condiciones: Condicion[];
  onPoner: (clave: ClaveCondicion, valor: number) => void;
  onCerrar: () => void;
}) {
  const tiene = (k: ClaveCondicion) => condiciones.find((c) => c.clave === k);
  const resto = (Object.keys(CONDICIONES) as ClaveCondicion[]).filter((k) => !tiene(k));
  return (
    <Modal titulo="Condiciones" subtitulo="Lo que te pasa ahora. La mesa ya aplica sus números a tus tiradas y tu CA." onCerrar={onCerrar} ancho="max-w-2xl">
      {condiciones.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 font-titulo text-[17px] font-bold">Tienes</h3>
          <ul className="flex flex-col gap-2">
            {condiciones.map((c) => {
              const def = CONDICIONES[c.clave];
              return (
                <li key={c.clave} className="flex items-center gap-3 rounded-lg border border-borde bg-superficie px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <b className="font-titulo text-[16px]">{def.nombre}{def.conValor ? ` ${c.valor}` : ''}</b>
                    <span className="block text-[12.5px] text-texto-suave">{def.conValor ? def.ayuda.replaceAll('X', String(c.valor)) : def.ayuda}</span>
                  </span>
                  {def.conValor && (
                    <span className="flex items-center gap-1">
                      <button className="flex size-8 items-center justify-center rounded-md border border-borde" onClick={() => onPoner(c.clave, c.valor - 1)} aria-label={`Bajar ${def.nombre}`}><MinusIcon size={13} /></button>
                      <button className="flex size-8 items-center justify-center rounded-md border border-borde" onClick={() => onPoner(c.clave, c.valor + 1)} aria-label={`Subir ${def.nombre}`}><PlusIcon size={13} /></button>
                    </span>
                  )}
                  <button className="h-8 rounded-md border border-borde px-2.5 font-titulo text-[13px] text-texto-suave hover:border-peligro hover:text-peligro" onClick={() => onPoner(c.clave, 0)}>Quitar</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <h3 className="mb-2 font-titulo text-[17px] font-bold">Pegar una</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {resto.map((k, i) => (
          <button key={k} onClick={() => onPoner(k, 1)} className="postit px-3 py-2 text-left font-titulo transition hover:-translate-y-0.5"
            style={{ ['--giro' as string]: `${i % 2 ? -1 : 1}deg` }}>
            <b className="text-[15px]">{CONDICIONES[k].nombre}</b>
            <span className="mt-0.5 block text-[12.5px] leading-snug">{CONDICIONES[k].ayuda}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// Las notas del personaje: lo que quiera anotar el jugador (pistas, nombres, deudas). Se guardan solas.
export function PanelNotas({ p, onGuardar }: { p: Personaje; onGuardar: (notas: string) => void }) {
  const [texto, setTexto] = useState(p.notas);
  const [estado, setEstado] = useState<'guardado' | 'escribiendo'>('guardado');
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cambiar = (v: string) => {
    setTexto(v);
    setEstado('escribiendo');
    clearTimeout(espera.current);
    espera.current = setTimeout(() => { onGuardar(v); setEstado('guardado'); }, 700);
  };
  useEffect(() => () => clearTimeout(espera.current), []);
  return (
    <div className="flex h-full flex-col gap-2">
      <p className="flex items-center justify-between font-titulo text-[13px] text-texto-suave">
        <span>Solo tú (y el GM) las ven.</span>
        <span>{estado === 'guardado' ? 'Guardado' : 'Escribiendo…'}</span>
      </p>
      <textarea value={texto} onChange={(e) => cambiar(e.target.value.slice(0, 5000))} rows={16}
        placeholder="El tabernero se llama Bruno. Le debemos 3 po al herrero. La llave dorada abre…"
        className="renglones min-h-[320px] w-full flex-1 resize-none rounded-lg border border-borde bg-superficie px-3 py-2 font-titulo text-[16px] leading-[30px]" aria-label="Notas" />
    </div>
  );
}

// Todas las teclas, para no tener que acordarse
export function AyudaTeclas({ onCerrar, filas: propias }: { onCerrar: () => void; filas?: [string, string][] }) {
  const filas: [string, string][] = propias ?? [
    ['Q W E R T Y', 'Tus atajos: abren lo que pusiste en cada uno'],
    ['Enter', 'Usa la acción abierta'],
    ['Esc', 'Cierra lo abierto o cancela "elige a quién"'],
    ['F', 'Termina tu turno'],
    ['G', 'Panel del grupo'],
    ['I', 'Mochila'],
    ['N', 'Notas'],
    ['H', 'Reglas rápidas'],
    ['?', 'Esta ayuda'],
    ['Arrastrar tu token', 'Moverte (se ve hasta dónde llegas)'],
    ['Mantener presionado', 'Señalar un punto a todos (o Alt + clic)'],
    ['Rueda del mouse', 'Acercar y alejar el tablero'],
  ];
  return (
    <Modal titulo="Atajos de la mesa" onCerrar={onCerrar} ancho="max-w-md">
      <dl className="flex flex-col">
        {filas.map(([k, d]) => (
          <div key={k} className="flex items-center gap-3 border-b border-dashed border-borde py-2">
            <dt className="flex shrink-0 flex-wrap gap-1">
              {k.length <= 11 && !k.includes(' ') || k === 'Q W E R T Y' ? k.split(' ').map((t) => <Tecla key={t}>{t}</Tecla>) : <span className="font-titulo text-[14px] font-semibold">{k}</span>}
            </dt>
            <dd className="ml-auto text-right text-[13.5px] text-texto-suave">{d}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

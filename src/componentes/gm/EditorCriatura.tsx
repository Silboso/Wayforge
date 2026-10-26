import { useState } from 'react';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { leerExpresion, signo } from '../../../reglas/pf2e';
import { CRIATURA_VACIA, type AtaqueCriatura, type Criatura } from '../../../reglas/criaturas';
import { COLORES_TOKEN, TAMANOS, type Accion, type Tamano, type TipoToken, type Token } from '../../../compartido/sala';
import { subirImagen } from '../../imagenes';
import { Modal } from '../hud/Modal';
import { ElegirImagen } from '../ui';

const campo = 'h-10 w-full rounded-lg border border-borde bg-superficie px-3';

// Los números de una criatura en una ventana: lo que el GM ajusta antes o durante la partida
export function EditorCriatura({ salaId, token, enviar, onCerrar }: {
  salaId: string;
  token: Token;
  enviar: (accion: Accion) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(token.nombre);
  const [tipo, setTipo] = useState<TipoToken>(token.tipo === 'personaje' ? 'enemigo' : token.tipo);
  const [tamano, setTamano] = useState<Tamano>(token.tamano);
  const [imagen, setImagen] = useState(token.imagen ?? '');
  const [ca, setCa] = useState(token.ca ?? 15);
  const [pgMax, setPgMax] = useState(token.pg?.max ?? 15);
  const [pgActual, setPgActual] = useState(token.pg?.actual ?? token.pg?.max ?? 15);
  const [percepcion, setPercepcion] = useState(token.percepcion ?? 3);
  const [c, setC] = useState<Criatura>(token.criatura ?? CRIATURA_VACIA);
  const [habilidades, setHabilidades] = useState((token.criatura?.habilidades ?? []).map((h) => `${h.nombre} ${signo(h.bono)}`).join(', '));
  const [aviso, setAviso] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const ataque = (i: number, cambios: Partial<AtaqueCriatura>) => setC((x) => ({ ...x, ataques: x.ataques.map((a, j) => (j === i ? { ...a, ...cambios } : a)) }));

  async function subir(archivo: File | null) {
    if (!archivo) return;
    setSubiendo(true);
    try { setImagen(await subirImagen(salaId, archivo)); } catch (e) { setAviso(e instanceof Error ? e.message : 'No se pudo subir'); } finally { setSubiendo(false); }
  }

  function guardar() {
    if (!nombre.trim()) return setAviso('Ponle un nombre');
    const malo = c.ataques.find((a) => !a.nombre.trim() || !leerExpresion(a.dano));
    if (malo) return setAviso(`Revisa el ataque "${malo.nombre || 'sin nombre'}": el daño va como 1d6+2`);
    // "Stealth +5, Athletics +7" → lista
    const hab = habilidades.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
      const m = /^(.+?)\s*([+-]\d+)$/.exec(x);
      return m ? { nombre: m[1]!.slice(0, 40), bono: Number(m[2]) } : null;
    }).filter((x) => !!x);
    const criatura: Criatura = { ...c, habilidades: hab };
    enviar({
      tipo: 'editar-token', id: token.id,
      cambios: {
        nombre: nombre.trim(), tipo, tamano, ca, percepcion, criatura,
        pg: { max: Math.max(1, pgMax), actual: Math.max(0, Math.min(pgActual, Math.max(1, pgMax))) },
        ...(imagen !== (token.imagen ?? '') ? { imagen } : {}),
        ...(tipo !== token.tipo && (!token.color || token.color === COLORES_TOKEN[token.tipo]) ? { color: COLORES_TOKEN[tipo] } : {}),
      },
    });
    onCerrar();
  }

  return (
    <Modal titulo={`Editar ${token.nombre}`} subtitulo="Los números ya sumados, como vienen en el bestiario. La mesa agrega la penalización por ataques seguidos y las condiciones."
      onCerrar={onCerrar} ancho="max-w-2xl">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div className="size-20 overflow-hidden rounded-full border-[3px] border-peligro bg-superficie-2">
              {imagen ? <img src={imagen} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center font-titulo text-3xl font-bold text-peligro">{nombre.slice(0, 1)}</span>}
            </div>
            <div className="flex w-36 gap-1"><ElegirImagen etiqueta={subiendo ? 'Subiendo…' : 'Imagen'} onArchivo={subir} /></div>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[13px] text-texto-suave sm:col-span-2">
              Nombre
              <input className={`${campo} font-titulo text-[18px] text-texto`} value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-texto-suave">
              Tipo
              <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoToken)}>
                <option value="enemigo">Enemigo</option>
                <option value="npc">NPC</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-texto-suave">
              Tamaño
              <select className={campo} value={tamano} onChange={(e) => setTamano(e.target.value as Tamano)}>
                {(Object.keys(TAMANOS) as Tamano[]).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <Numero etiqueta="Nivel" valor={c.nivel} min={-1} max={30} onCambio={(nivel) => setC({ ...c, nivel })} />
          <Numero etiqueta="CA" valor={ca} min={0} max={80} onCambio={setCa} />
          <Numero etiqueta="PG máx." valor={pgMax} min={1} max={999} onCambio={setPgMax} />
          <Numero etiqueta="PG ahora" valor={pgActual} min={0} max={999} onCambio={setPgActual} />
          <Numero etiqueta="Velocidad" valor={c.velocidad} min={0} max={200} onCambio={(velocidad) => setC({ ...c, velocidad })} />
          <Numero etiqueta="Perception" valor={percepcion} onCambio={setPercepcion} />
          <Numero etiqueta="Fortitude" valor={c.salvaciones.fortitude} onCambio={(v) => setC({ ...c, salvaciones: { ...c.salvaciones, fortitude: v } })} />
          <Numero etiqueta="Reflex" valor={c.salvaciones.reflex} onCambio={(v) => setC({ ...c, salvaciones: { ...c.salvaciones, reflex: v } })} />
          <Numero etiqueta="Will" valor={c.salvaciones.will} onCambio={(v) => setC({ ...c, salvaciones: { ...c.salvaciones, will: v } })} />
        </section>

        <section>
          <h3 className="mb-2 font-titulo text-[18px] font-bold">Ataques</h3>
          <div className="flex flex-col gap-2">
            {c.ataques.map((a, i) => (
              <div key={a.id} className="grid grid-cols-[1fr_70px_100px_auto] items-end gap-2 rounded-lg border border-dashed border-borde p-2.5 sm:grid-cols-[1.4fr_70px_100px_1fr_80px_auto_auto]">
                <label className="flex flex-col gap-1 text-[12px] text-texto-suave">Nombre
                  <input className={campo} value={a.nombre} maxLength={60} onChange={(e) => ataque(i, { nombre: e.target.value })} /></label>
                <label className="flex flex-col gap-1 text-[12px] text-texto-suave">Bono
                  <input type="number" className={campo} value={a.bono} onChange={(e) => ataque(i, { bono: Math.round(Number(e.target.value) || 0) })} /></label>
                <label className="flex flex-col gap-1 text-[12px] text-texto-suave">Daño
                  <input className={`${campo} font-mono ${leerExpresion(a.dano) ? '' : 'border-peligro'}`} value={a.dano} maxLength={20} onChange={(e) => ataque(i, { dano: e.target.value.replace(/\s/g, '') })} /></label>
                <label className="hidden flex-col gap-1 text-[12px] text-texto-suave sm:flex">Tipo
                  <input className={campo} value={a.tipoDano} maxLength={30} onChange={(e) => ataque(i, { tipoDano: e.target.value })} /></label>
                <label className="hidden flex-col gap-1 text-[12px] text-texto-suave sm:flex">Alcance ft
                  <input type="number" className={campo} value={a.distancia ?? 5} min={5} onChange={(e) => {
                    const n = Math.max(5, Math.round(Number(e.target.value) || 5));
                    // 5 ft es "al lado": no se guarda alcance
                    setC((x) => ({ ...x, ataques: x.ataques.map((y, j) => {
                      if (j !== i) return y;
                      const { distancia: _sin, ...resto } = y;
                      return n === 5 ? resto : { ...resto, distancia: n };
                    }) }));
                  }} /></label>
                <label className="flex h-10 items-center gap-1.5 text-[13px]">
                  <input type="checkbox" className="size-4 accent-acento" checked={a.agil} onChange={(e) => ataque(i, { agil: e.target.checked })} /> agile
                </label>
                <button className="flex size-10 items-center justify-center rounded-lg text-texto-suave hover:text-peligro" aria-label={`Quitar ${a.nombre}`}
                  onClick={() => setC({ ...c, ataques: c.ataques.filter((_, j) => j !== i) })}><TrashIcon size={18} /></button>
              </div>
            ))}
            <button className="boli flex h-10 items-center justify-center gap-1.5 border-[1.5px] border-dashed border-acento font-titulo text-[14px] text-acento hover:bg-acento/5"
              onClick={() => setC({ ...c, ataques: [...c.ataques, { id: crypto.randomUUID().slice(0, 8), nombre: 'Garra', bono: 6, dano: '1d6+2', tipoDano: 'slashing', agil: false, rasgos: [] }] })}>
              <PlusIcon size={16} aria-hidden /> Agregar ataque
            </button>
          </div>
        </section>

        <section className="grid gap-3">
          <label className="flex flex-col gap-1 text-[13px] text-texto-suave">Skills (separadas por coma)
            <input className={campo} value={habilidades} placeholder="Stealth +5, Athletics +7" onChange={(e) => setHabilidades(e.target.value)} /></label>
          <label className="flex flex-col gap-1 text-[13px] text-texto-suave">Lo especial (resistencias, habilidades, tácticas)
            <textarea className="min-h-20 rounded-lg border border-borde bg-superficie px-3 py-2 text-texto" value={c.notas} maxLength={2000}
              onChange={(e) => setC({ ...c, notas: e.target.value })} /></label>
        </section>

        {aviso && <p className="font-titulo text-peligro" role="alert">{aviso}</p>}
        <div className="flex justify-end gap-2">
          <button className="boli h-11 border-[1.5px] border-borde px-4 font-titulo text-[15px]" onClick={onCerrar}>Cancelar</button>
          <button className="boli h-11 bg-acento px-5 font-titulo text-[15px] font-bold text-sobre-acento" onClick={guardar}>Guardar</button>
        </div>
      </div>
    </Modal>
  );
}

// Un número con su etiqueta (fuera del componente: si no, el campo pierde el foco al escribir)
function Numero({ etiqueta, valor, onCambio, min = -10, max = 99 }: { etiqueta: string; valor: number; onCambio: (n: number) => void; min?: number; max?: number }) {
  return (
    <label className="flex flex-col gap-1 text-[13px] text-texto-suave">
      {etiqueta}
      <input type="number" className={`${campo} font-titulo text-[17px] text-texto`} value={valor} min={min} max={max}
        onChange={(e) => onCambio(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || 0))))} />
    </label>
  );
}

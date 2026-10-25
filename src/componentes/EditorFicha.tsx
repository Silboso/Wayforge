import { useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import {
  ATRIBUTOS, calcular, HABILIDADES, SALVACIONES, signo,
  type Atributo, type Golpe, type Personaje, type Rango,
} from '../../reglas/pf2e';
import { subirImagen } from '../imagenes';
import {
  Campo, claseBotonIcono, claseBotonPrincipal, claseBotonSecundario, claseEntrada, Contador, Desglose,
  ElegirImagen, SelectorRango,
} from './ui';

interface Props {
  salaId: string;
  inicial: Personaje;
  // Al crear se pide el código del personaje; al editar no
  modo: 'crear' | 'editar';
  error?: string | null;
  onGuardar: (personaje: Personaje, codigo: string) => void;
  onCancelar: () => void;
}

const PASOS = ['Quién es', 'Atributos', 'Puntos de golpe', 'Defensa', 'Skills', 'Ataques', 'Código'] as const;

// Creación de ficha paso a paso. Cada paso explica qué es lo que se pide y muestra el resultado calculado.
export function EditorFicha({ salaId, inicial, modo, error, onGuardar, onCancelar }: Props) {
  const [p, setP] = useState<Personaje>(inicial);
  const [paso, setPaso] = useState(0);
  const [codigo, setCodigo] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [aviso, setAviso] = useState('');
  const [subiendo, setSubiendo] = useState(false);

  const pasos = modo === 'crear' ? PASOS : PASOS.slice(0, -1);
  const ultimo = paso === pasos.length - 1;
  const ficha = calcular(p);
  const cambiar = (cambios: Partial<Personaje>) => {
    setAviso('');
    setP((actual) => ({ ...actual, ...cambios }));
  };

  function validarPaso(i: number): string {
    if (i === 0 && !p.nombre.trim()) return 'Ponle un nombre a tu personaje';
    if (pasos[i] === 'Código') {
      if (!/^\d{4}$/.test(codigo)) return 'El código son 4 números';
      if (codigo !== confirmacion) return 'Los dos códigos no coinciden';
    }
    return '';
  }

  function siguiente() {
    const problema = validarPaso(paso);
    if (problema) return setAviso(problema);
    if (!ultimo) return setPaso(paso + 1);
    // Al crear, los PG actuales empiezan llenos
    const final = { ...p, nombre: p.nombre.trim(), pgActual: modo === 'crear' ? ficha.pgMax.total : Math.min(p.pgActual, ficha.pgMax.total) };
    onGuardar(final, codigo);
  }

  async function subirRetrato(archivo: File | null) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      cambiar({ retrato: await subirImagen(salaId, archivo) });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-titulo text-2xl font-bold">{modo === 'crear' ? 'Nuevo personaje' : `Editar a ${inicial.nombre}`}</h1>
        <button type="button" className={claseBotonSecundario} onClick={onCancelar}>Cancelar</button>
      </div>

      <ol className="flex flex-wrap gap-1" aria-label="Pasos">
        {pasos.map((nombre, i) => (
          <li key={nombre}>
            <button
              type="button"
              aria-current={i === paso ? 'step' : undefined}
              className={`rounded-full px-3 py-1 text-sm transition ${i === paso ? 'bg-acento text-sobre-acento' : 'bg-superficie-2 text-texto-suave hover:text-texto'}`}
              onClick={() => {
                // Se puede saltar hacia atrás siempre; hacia adelante, solo si el primer paso está completo
                if (i > 0 && validarPaso(0)) return setAviso(validarPaso(0));
                setAviso('');
                setPaso(i);
              }}
            >
              {i + 1}. {nombre}
            </button>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-4 rounded-xl border border-borde bg-superficie p-4">
        {pasos[paso] === 'Quién es' && (
          <>
            <Explicacion>Lo básico. Si ya tienes el personaje en Foundry o Pathbuilder, copia los datos de ahí.</Explicacion>
            <div className="flex items-center gap-4">
              <div className="size-20 shrink-0 overflow-hidden rounded-full border-2 border-borde bg-superficie-2">
                {p.retrato && <img src={p.retrato} alt="" className="size-full object-cover" />}
              </div>
              <div className="flex flex-1 gap-2">
                <ElegirImagen etiqueta={subiendo ? 'Subiendo…' : p.retrato ? 'Cambiar retrato' : 'Subir retrato'} onArchivo={subirRetrato} />
                {p.retrato && <button type="button" className={claseBotonSecundario} onClick={() => cambiar({ retrato: '' })}>Quitar</button>}
              </div>
            </div>
            <Campo etiqueta="Nombre">
              {(id) => <input id={id} className={claseEntrada} value={p.nombre} maxLength={60} placeholder="Kyra"
                onChange={(e) => cambiar({ nombre: e.target.value })} />}
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Ascendencia" ayuda="Human, Elf, Dwarf, Goblin…">
                {(id) => <input id={id} className={claseEntrada} value={p.ascendencia} maxLength={60} placeholder="Human"
                  onChange={(e) => cambiar({ ascendencia: e.target.value })} />}
              </Campo>
              <Campo etiqueta="Clase" ayuda="Fighter, Wizard, Cleric, Rogue…">
                {(id) => <input id={id} className={claseEntrada} value={p.clase} maxLength={60} placeholder="Fighter"
                  onChange={(e) => cambiar({ clase: e.target.value })} />}
              </Campo>
            </div>
            <Fila etiqueta="Nivel">
              <Contador etiqueta="nivel" valor={p.nivel} min={1} max={20} onCambio={(nivel) => cambiar({ nivel })} />
            </Fila>
          </>
        )}

        {pasos[paso] === 'Atributos' && (
          <>
            <Explicacion>
              Los seis modificadores de atributo. A nivel 1 suelen ir de −1 a +4. Son el número con signo de tu hoja,
              no el puntaje de 10 a 18.
            </Explicacion>
            {(Object.keys(ATRIBUTOS) as Atributo[]).map((a) => (
              <Fila key={a} etiqueta={ATRIBUTOS[a].nombre} ayuda={ATRIBUTOS[a].ayuda}>
                <Contador etiqueta={ATRIBUTOS[a].nombre} conSigno valor={p.atributos[a]} min={-5} max={10}
                  onCambio={(v) => cambiar({ atributos: { ...p.atributos, [a]: v } })} />
              </Fila>
            ))}
          </>
        )}

        {pasos[paso] === 'Puntos de golpe' && (
          <>
            <Explicacion>
              Tus PG máximos se calculan solos: los de tu ascendencia, más los de tu clase y tu Con en cada nivel.
            </Explicacion>
            <Fila etiqueta="PG de ascendencia" ayuda="Human 8, Elf 6, Dwarf 10, Goblin 6…">
              <Contador etiqueta="PG de ascendencia" valor={p.pgAscendencia} min={0} max={30} onCambio={(v) => cambiar({ pgAscendencia: v })} />
            </Fila>
            <Fila etiqueta="PG de clase por nivel" ayuda="Fighter 10, Rogue 8, Wizard 6…">
              <Contador etiqueta="PG de clase" valor={p.pgClase} min={0} max={20} onCambio={(v) => cambiar({ pgClase: v })} />
            </Fila>
            <Fila etiqueta="Velocidad (pies)">
              <Contador etiqueta="velocidad" valor={p.velocidad} min={0} max={200} onCambio={(v) => cambiar({ velocidad: v })} />
            </Fila>
            <Resultado titulo={`PG máximos: ${ficha.pgMax.total}`}><Desglose valor={ficha.pgMax} /></Resultado>
          </>
        )}

        {pasos[paso] === 'Defensa' && (
          <>
            <Explicacion>
              Las letras son tu competencia: Untrained, Trained, Expert, Master, Legendary. Tu clase te dice cuál
              tienes en cada cosa. Con Trained o más sumas tu nivel.
            </Explicacion>
            <Campo etiqueta="Armadura" ayuda="Déjalo vacío si no llevas">
              {(id) => <input id={id} className={claseEntrada} value={p.armadura.nombre} maxLength={60} placeholder="Leather armor"
                onChange={(e) => cambiar({ armadura: { ...p.armadura, nombre: e.target.value } })} />}
            </Campo>
            <Fila etiqueta="Competencia con tu armadura">
              <SelectorRango etiqueta="Competencia con armadura" valor={p.armadura.rango}
                onCambio={(rango) => cambiar({ armadura: { ...p.armadura, rango } })} />
            </Fila>
            <Fila etiqueta="Bono de la armadura a la CA" ayuda="Leather +1, Chain mail +4, Full plate +6">
              <Contador etiqueta="bono de armadura" conSigno valor={p.armadura.bonoObjeto} min={0} max={10}
                onCambio={(bonoObjeto) => cambiar({ armadura: { ...p.armadura, bonoObjeto } })} />
            </Fila>
            <Fila etiqueta="Tope de Dex" ayuda="Las armaduras pesadas limitan cuánto Dex suma a la CA">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" className="size-4 accent-acento" checked={p.armadura.topeDex === null}
                    onChange={(e) => cambiar({ armadura: { ...p.armadura, topeDex: e.target.checked ? null : 2 } })} />
                  Sin tope
                </label>
                {p.armadura.topeDex !== null && (
                  <Contador etiqueta="tope de Dex" conSigno valor={p.armadura.topeDex} min={0} max={10}
                    onCambio={(topeDex) => cambiar({ armadura: { ...p.armadura, topeDex } })} />
                )}
              </div>
            </Fila>
            <Fila etiqueta="Perception">
              <SelectorRango etiqueta="Perception" valor={p.percepcion} onCambio={(percepcion) => cambiar({ percepcion })} />
            </Fila>
            {SALVACIONES.map((s) => (
              <Fila key={s.clave} etiqueta={s.nombre}>
                <SelectorRango etiqueta={s.nombre} valor={p.salvaciones[s.clave]}
                  onCambio={(r) => cambiar({ salvaciones: { ...p.salvaciones, [s.clave]: r } })} />
              </Fila>
            ))}
            <Resultado titulo={`CA ${ficha.ca.total} · Perception ${signo(ficha.percepcion.total)} · Fort ${signo(ficha.salvaciones.fortitude.total)} · Ref ${signo(ficha.salvaciones.reflex.total)} · Will ${signo(ficha.salvaciones.will.total)}`}>
              <Desglose valor={ficha.ca} />
            </Resultado>
          </>
        )}

        {pasos[paso] === 'Skills' && (
          <>
            <Explicacion>Marca las skills en las que tu personaje está entrenado. El total se calcula solo.</Explicacion>
            <ul className="flex flex-col divide-y divide-borde">
              {HABILIDADES.map((h) => (
                <li key={h.clave} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium">{h.nombre}</div>
                    <div className="text-xs text-texto-suave">{ATRIBUTOS[h.atributo].abrev} · total {signo(ficha.habilidades[h.clave].total)}</div>
                  </div>
                  <SelectorRango etiqueta={h.nombre} valor={p.habilidades[h.clave]}
                    onCambio={(r) => cambiar({ habilidades: { ...p.habilidades, [h.clave]: r } })} />
                </li>
              ))}
            </ul>
          </>
        )}

        {pasos[paso] === 'Ataques' && (
          <EditorGolpes p={p} onCambio={(golpes) => cambiar({ golpes })} />
        )}

        {pasos[paso] === 'Código' && (
          <>
            <Explicacion>
              Elige 4 números. Te los vamos a pedir cada vez que entres a la mesa con este personaje, así nadie más
              lo puede usar. Anótalos en algún lado.
            </Explicacion>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Código del personaje">
                {(id) => <EntradaCodigo id={id} valor={codigo} largo={4} onCambio={(v) => { setCodigo(v); setAviso(''); }} />}
              </Campo>
              <Campo etiqueta="Repite el código">
                {(id) => <EntradaCodigo id={id} valor={confirmacion} largo={4} onCambio={(v) => { setConfirmacion(v); setAviso(''); }} />}
              </Campo>
            </div>
          </>
        )}
      </div>

      {(aviso || error) && <p className="text-peligro">{aviso || error}</p>}

      <div className="flex justify-between gap-2">
        <button type="button" className={claseBotonSecundario} disabled={paso === 0} onClick={() => { setAviso(''); setPaso(paso - 1); }}>
          <ArrowLeftIcon size={18} aria-hidden /> Atrás
        </button>
        <div className="flex gap-2">
          {modo === 'editar' && !ultimo && (
            <button type="button" className={claseBotonSecundario} onClick={() => { const problema = validarPaso(0); if (problema) return setAviso(problema); onGuardar({ ...p, nombre: p.nombre.trim(), pgActual: Math.min(p.pgActual, ficha.pgMax.total) }, ''); }}>
              Guardar ya
            </button>
          )}
          <button type="button" className={claseBotonPrincipal} onClick={siguiente}>
            {ultimo ? <><CheckIcon size={18} weight="bold" aria-hidden /> {modo === 'crear' ? 'Crear y entrar' : 'Guardar'}</> : <>Siguiente <ArrowRightIcon size={18} aria-hidden /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

const DADOS = ['1d4', '1d6', '1d8', '1d10', '1d12', '2d4', '2d6', '2d8', '2d10', '2d12', '3d6', '3d8', '3d10', '3d12'];
const TIPOS_DANO = ['slashing', 'piercing', 'bludgeoning'];

function EditorGolpes({ p, onCambio }: { p: Personaje; onCambio: (golpes: Golpe[]) => void }) {
  const ficha = calcular(p);
  const editar = (i: number, cambios: Partial<Golpe>) => onCambio(p.golpes.map((g, j) => (j === i ? { ...g, ...cambios } : g)));

  return (
    <>
      <Explicacion>
        Tus armas. La penalización por ataque múltiple (el 2.º y 3.º ataque del turno) se calcula sola.
      </Explicacion>
      {p.golpes.map((g, i) => {
        const calculado = ficha.golpes[i]!;
        return (
          <div key={g.id} className="flex flex-col gap-3 rounded-lg border border-borde p-3">
            <div className="flex items-center gap-2">
              <input className={claseEntrada} value={g.nombre} maxLength={60} placeholder="Longsword" aria-label="Nombre del arma"
                onChange={(e) => editar(i, { nombre: e.target.value })} />
              <button type="button" className={claseBotonIcono} aria-label={`Quitar ${g.nombre || 'arma'}`}
                onClick={() => onCambio(p.golpes.filter((_, j) => j !== i))}>
                <TrashIcon size={18} aria-hidden />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Ataca con">
                {(id) => (
                  <select id={id} className={claseEntrada} value={g.atributo}
                    onChange={(e) => editar(i, { atributo: e.target.value as 'str' | 'dex' })}>
                    <option value="str">Str (cuerpo a cuerpo)</option>
                    <option value="dex">Dex (distancia o finesse)</option>
                  </select>
                )}
              </Campo>
              <Campo etiqueta="Dados de daño">
                {(id) => (
                  <select id={id} className={claseEntrada} value={g.dados} onChange={(e) => editar(i, { dados: e.target.value })}>
                    {DADOS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                )}
              </Campo>
              <Campo etiqueta="Tipo de daño">
                {(id) => (
                  <select id={id} className={claseEntrada} value={g.tipoDano} onChange={(e) => editar(i, { tipoDano: e.target.value })}>
                    {TIPOS_DANO.map((t) => <option key={t}>{t}</option>)}
                  </select>
                )}
              </Campo>
              <Campo etiqueta="Runa de potencia" ayuda="+1, +2 o +3 si el arma tiene una">
                {(id) => (
                  <select id={id} className={claseEntrada} value={g.bonoObjeto} onChange={(e) => editar(i, { bonoObjeto: Number(e.target.value) })}>
                    {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n ? `+${n}` : 'Ninguna'}</option>)}
                  </select>
                )}
              </Campo>
            </div>
            <Fila etiqueta="Competencia con el arma">
              <SelectorRango etiqueta="Competencia con el arma" valor={g.rango} onCambio={(rango) => editar(i, { rango })} />
            </Fila>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-acento" checked={g.agil} onChange={(e) => editar(i, { agil: e.target.checked })} />
                Agile (menos penalización)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-acento" checked={g.sumarFuerza} onChange={(e) => editar(i, { sumarFuerza: e.target.checked })} />
                Suma Str al daño
              </label>
            </div>
            <p className="rounded-lg bg-superficie-2 px-3 py-2 text-sm">
              Ataque <strong>{calculado.penalizaciones.map(signo).join(' / ')}</strong> · Daño <strong>{calculado.dano}</strong>
            </p>
          </div>
        );
      })}
      <button
        type="button"
        className={claseBotonSecundario}
        onClick={() => onCambio([...p.golpes, {
          id: crypto.randomUUID(), nombre: '', atributo: 'str', rango: 1 as Rango, bonoObjeto: 0,
          dados: '1d8', tipoDano: 'slashing', sumarFuerza: true, agil: false,
        }])}
      >
        <PlusIcon size={18} aria-hidden /> Agregar arma
      </button>
    </>
  );
}

export function EntradaCodigo({ id, valor, largo, onCambio, autoFocus }: {
  id?: string;
  valor: string;
  largo: number;
  onCambio: (valor: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      id={id}
      autoFocus={autoFocus}
      className={`${claseEntrada} h-12 text-center font-mono text-2xl tracking-[0.5em]`}
      inputMode="numeric"
      autoComplete="off"
      maxLength={largo}
      placeholder={'•'.repeat(largo)}
      value={valor}
      onChange={(e) => onCambio(e.target.value.replace(/\D/g, '').slice(0, largo))}
    />
  );
}

function Explicacion({ children }: { children: ReactNode }) {
  return <p className="text-sm text-texto-suave">{children}</p>;
}

function Fila({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{etiqueta}</div>
        {ayuda && <div className="text-xs text-texto-suave">{ayuda}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Resultado({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-borde pt-3">
      <div className="font-titulo text-lg font-bold">{titulo}</div>
      {children}
    </div>
  );
}


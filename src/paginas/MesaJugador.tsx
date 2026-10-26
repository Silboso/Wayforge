import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowsClockwiseIcon, BedIcon, CaretDownIcon, CaretUpIcon, CoffeeIcon, DiceFiveIcon, MapTrifoldIcon, NotebookIcon,
  SignOutIcon, SwordIcon, UsersIcon, XIcon,
} from '@phosphor-icons/react';
import { calcular, signo, type Personaje } from '../../reglas/pf2e';
import { DESCANSOS, disponibilidad, recursosDe, todasLasAptitudes, type Aptitud, type Descanso } from '../../reglas/aptitudes';
import { CONDICIONES, type Condicion } from '../../reglas/condiciones';
import { tieneMomento } from '../../reglas/disparadores';
import {
  aptitudesPara, motivoAlcance, motivoParaActuar, reaccionesPara, tokenEnTurno, type Combate, type EstadoSala, type QueTirar, type Token,
} from '../../compartido/sala';
import { MenuObjetivo } from '../componentes/hud/MenuObjetivo';
import { aAlcance, type Evento } from '../../compartido/eventos';
import { textoTirada } from '../../compartido/tiradas';
import type { Sala } from '../conexion';
import { leerColoresTablero, type useTema } from '../tema';
import { BotonTema } from '../componentes/BotonTema';
import { EditorFicha } from '../componentes/EditorFicha';
import { mensajeRechazo } from '../componentes/Entrada';
import { Ficha } from '../componentes/Ficha';
import { Tablero } from '../componentes/Tablero';
import { AvisoTirada, ListaTiradas, TiradaLibre } from '../componentes/Tiradas';
import { Detalle, ListaAcciones } from '../componentes/hud/Acciones';
import { BarraPG, FotoPegada, PostitCondicion, RayaAMano, Rombo, Tecla } from '../componentes/hud/piezas';
import { secciones, type Fila, type Seccion } from '../componentes/hud/secciones';
import { PanelEspera, PilaAvisos, useAvisos, type Aviso } from '../componentes/hud/Avisos';

type Tema = ReturnType<typeof useTema>;
type PestanaMovil = 'turno' | 'ficha' | 'tablero' | 'tiradas';

// Las primeras filas de "Tu turno" se abren con el teclado, como en un juego
const TECLAS = ['Q', 'W', 'E', 'R', 'T', 'Y'];

// La mesa vista por un jugador. En pantalla grande: el tablero entero y, apoyada abajo, la página de su
// personaje. En el teléfono: la página es el mando (el tablero suele estar en la tele) y el tablero es una pestaña.
export function MesaJugador({ salaId, sala, estado, personaje: p, tema }: {
  salaId: string;
  sala: Sala;
  estado: EstadoSala;
  personaje: Personaje;
  tema: Tema;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [elegida, setElegida] = useState<string | null>(null);
  const [seccionActiva, setSeccionActiva] = useState<Seccion['id']>('turno');
  const [cajon, setCajon] = useState<'ficha' | 'tiradas' | null>(null);
  const [plegada, setPlegada] = useState(false);
  const [pestana, setPestana] = useState<PestanaMovil>('turno');
  const [editando, setEditando] = useState(false);
  const [colores, setColores] = useState(leerColoresTablero);
  // El menú pegado a un token tocado en el tablero (las opciones contra él)
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => setColores(leerColoresTablero()), [tema.tema]);

  const miToken = Object.values(estado.tokens).find((t) => t.personajeId === p.id);
  const condiciones = miToken?.condiciones ?? [];
  const combate = estado.combate;
  const enTurno = combate ? tokenEnTurno(estado) : undefined;
  const miTurno = !!combate && !!miToken && enTurno?.id === miToken.id;
  const ataquesHechos = miTurno ? combate!.ataques : null;
  const libres = miTurno ? combate!.acciones - combate!.usadas : null;
  const ficha = calcular(p, condiciones);
  const lista = useMemo(() => secciones(p, condiciones, ataquesHechos), [p, condiciones, ataquesHechos]);
  const objetivoToken = seleccionado && seleccionado !== miToken?.id ? estado.tokens[seleccionado] : undefined;
  const objetivo = objetivoToken ? { id: objetivoToken.id, nombre: objetivoToken.nombre } : null;
  const filaElegida = lista.flatMap((s) => s.filas).find((f) => f.clave === elegida) ?? null;
  // Lo que probablemente toca: en tu turno, atacar si te quedan acciones
  const marcada = miTurno && combate!.usadas < combate!.acciones ? lista[0]?.filas[0]?.clave ?? null : null;

  // Si otra persona borra el token que tenía seleccionado, se deselecciona
  useEffect(() => {
    if (seleccionado && !estado.tokens[seleccionado]) setSeleccionado(null);
  }, [estado, seleccionado]);

  const tirar = (que: QueTirar) => sala.tirar(p.id, que);
  // Con qué fue el último ataque (un arma o un conjuro): el aviso de "¡le diste!" ofrece tirar su daño
  const ultimoGolpe = useRef<string | null>(null);
  const ultimoConjuro = useRef<Aptitud | null>(null);
  // Lo de "antes de atacar" (Power Attack…): se ofrece dentro del detalle de un Strike
  const filasAlAtacar = lista.flatMap((s) => s.filas)
    .filter((f, i, todas) => f.tipo === 'aptitud' && tieneMomento(f.aptitud, 'al-atacar') && todas.findIndex((x) => x.clave === f.clave) === i);

  // Usar una aptitud: la pantalla avisa al instante si no se puede (la sala lo vuelve a revisar y hace todo junto)
  const usarAptitud = (a: Aptitud, objetivoId?: string) => {
    if (a.id === 'basica:stride' || a.id === 'basica:step') {
      setPestana('tablero');
      setElegida(null);
      return agregarAviso({ id: crypto.randomUUID(), tono: 'nota', titulo: 'Toca la casilla a la que vas', cuerpo: 'Las que alcanzas están marcadas con resaltador. También puedes arrastrar tu token.', dura: 5000 });
    }
    const motivo = motivoParaActuar(estado, p.id, a.costo);
    if (motivo) return sala.negarLocal(motivo);
    const disp = disponibilidad(p, a);
    if (!disp.puede) return sala.negarLocal(`${a.verbo || a.nombre}: ${disp.texto}.`);
    if (a.tirada?.tipo === 'golpe' && p.golpes[0]) { ultimoGolpe.current = p.golpes[0].id; ultimoConjuro.current = null; }
    if (a.tirada?.tipo === 'ataque-conjuro') ultimoConjuro.current = a;
    const apunta = a.tirada && a.tirada.tipo !== 'expresion' && a.tirada.tipo !== 'percepcion' ? objetivoId : undefined;
    sala.usar(a.id, apunta, a.tirada ? a.verbo || a.nombre : undefined);
    setElegida(null);
    setMenuAbierto(false);
  };
  const usarReaccion = (a: Aptitud, objetivoId?: string) => usarAptitud(a, objetivoId);
  // Un Strike: en tu turno, con acciones y llegando al objetivo; si no, el aviso dice por qué
  const atacar = (golpeId: string, numero: 0 | 1 | 2, objetivoId?: string) => {
    const golpe = p.golpes.find((g) => g.id === golpeId);
    const motivo = motivoParaActuar(estado, p.id, 1);
    if (motivo) return sala.negarLocal(motivo);
    const destino = objetivoId ? estado.tokens[objetivoId] : undefined;
    const lejos = golpe && destino && miToken ? motivoAlcance(miToken, destino, golpe.distancia ?? 5) : null;
    if (lejos) return sala.negarLocal(lejos);
    ultimoGolpe.current = golpeId;
    ultimoConjuro.current = null;
    sala.tirar(p.id, { tipo: 'ataque', golpe: golpeId, numero, ...(objetivoId ? { objetivo: objetivoId } : {}) }, golpe ? `Atacando con ${golpe.nombre}` : 'Atacando');
    setElegida(null);
    setMenuAbierto(false);
  };
  const tirarDano = (golpeId: string, critico: boolean, objetivoId?: string) =>
    tirar({ tipo: 'dano', golpe: golpeId, ...(critico ? { critico } : {}), ...(objetivoId ? { objetivo: objetivoId } : {}) });
  const restarPG = (n: number) => {
    const deTemporales = Math.min(p.pgTemporales, n);
    sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { pgTemporales: p.pgTemporales - deTemporales, pgActual: Math.max(0, p.pgActual - (n - deTemporales)) } });
  };

  // Lo que pasa en la mesa, convertido en avisos para este personaje: el momento justo de cada aptitud
  const generar = (e: Evento): Aviso[] => {
    const id = () => crypto.randomUUID();
    const nombres = (as: Aptitud[]) => as.map((a) => a.verbo || a.nombre).join(', ');
    if (e.tipo === 'turno') {
      if (!miToken || e.tokenId !== miToken.id) return [];
      const notas: string[] = [];
      const c = estado.combate;
      if (c) notas.push(`Tienes ${c.acciones} ${c.acciones === 1 ? 'acción' : 'acciones'} y tu reacción está lista.`);
      for (const cond of condiciones) {
        if (cond.clave === 'dying') notas.push(`Dying ${cond.valor}: tira tu salvación de recuperación (flat check).`);
        if (cond.clave === 'frightened') notas.push(`Frightened ${cond.valor}: baja 1 al terminar este turno.`);
        if (cond.clave === 'slowed' || cond.clave === 'stunned') notas.push(`${CONDICIONES[cond.clave].nombre}: pierdes acciones este turno.`);
      }
      const recordar = aptitudesPara(p, 'inicio-turno');
      if (recordar.length) notas.push(`Recuerda: ${nombres(recordar)}.`);
      return [{ id: id(), tono: 'turno', titulo: '¡Tu turno!', cuerpo: <ul className="list-disc pl-4">{notas.map((n) => <li key={n}>{n}</li>)}</ul>, dura: 9000 }];
    }
    if (e.tipo === 'movimiento') {
      const t = estado.tokens[e.tokenId];
      if (!t || t.personajeId || !miToken || !aAlcance(miToken, t, e.desde)) return [];
      const sirven = reaccionesPara(estado, p.id, 'enemigo-se-mueve');
      if (sirven.length === 0) return [];
      return [{
        id: id(), tono: 'peligro', titulo: `${t.nombre} se mueve a tu lado`, cuerpo: 'Puedes castigarlo con tu reacción.', dura: 15000,
        botones: sirven.map((a, i) => ({ etiqueta: `Usar ${a.verbo || a.nombre}`, principal: i === 0, hacer: () => usarReaccion(a, t.id) })),
      }];
    }
    const t = e.tirada;
    const avisos: Aviso[] = [];
    // Mi ataque: cómo salió y qué sigue
    if (t.personajeId === p.id && t.objetivo?.grado) {
      const golpe = ultimoGolpe.current;
      const conjuro = ultimoConjuro.current;
      const contra = t.objetivo.nombre;
      const objetivoId = t.objetivo.tokenId;
      const tirarSuDano = (critico: boolean) => conjuro?.dano
        ? tirar({ tipo: 'libre', expresion: conjuro.dano, etiqueta: `Daño de ${conjuro.verbo || conjuro.nombre}`, ...(objetivoId ? { objetivo: objetivoId } : {}), ...(critico ? { critico } : {}) })
        : golpe && tirarDano(golpe, critico, objetivoId);
      if (t.objetivo.grado === 'critico' || t.objetivo.grado === 'exito') {
        const critico = t.objetivo.grado === 'critico';
        const extra = aptitudesPara(p, critico ? 'al-criticar' : 'al-acertar');
        avisos.push({
          id: id(), tono: 'bueno', titulo: critico ? `¡Crítico contra ${contra}!` : `¡Le diste a ${contra}!`,
          cuerpo: <>{critico ? 'Tira el daño: se duplica.' : 'Ahora tira el daño.'}{extra.length > 0 && <> También puedes: {nombres(extra)}.</>}</>,
          botones: (conjuro ? conjuro.dano : golpe)
            ? [{ etiqueta: `${critico ? 'Daño crítico ×2' : 'Tirar daño'}${conjuro?.dano ? ` (${conjuro.dano})` : ''}`, principal: true, hacer: () => tirarSuDano(critico) }]
            : [],
        });
      } else {
        const extra = aptitudesPara(p, 'al-fallar');
        avisos.push({
          id: id(), tono: 'malo', titulo: t.objetivo.grado === 'pifia' ? `Pifia contra ${contra}` : `Fallaste contra ${contra}`,
          cuerpo: <>{t.total} contra su defensa.{extra.length > 0 && <> Puedes: {nombres(extra)}.</>}</>, dura: 7000,
        });
      }
    }
    // Me atacaron o me hicieron daño
    if (miToken && t.objetivo?.tokenId === miToken.id && t.personajeId !== p.id) {
      if (t.objetivo.grado === 'critico' || t.objetivo.grado === 'exito') {
        const sirven = reaccionesPara(estado, p.id, 'te-golpean');
        avisos.push({
          id: id(), tono: 'peligro', titulo: `${t.quien} te acertó`,
          cuerpo: <>{t.total} contra tu CA {t.objetivo.cd}{t.objetivo.grado === 'critico' ? ': crítico, el daño se duplica.' : '.'}{sirven.length > 0 && <> Puedes reaccionar.</>}</>,
          botones: sirven.map((a, i) => ({ etiqueta: `Usar ${a.verbo || a.nombre}`, principal: i === 0, hacer: () => usarReaccion(a) })),
          ...(sirven.length ? {} : { dura: 8000 }),
        });
      } else if (t.objetivo.grado) {
        avisos.push({ id: id(), tono: 'bueno', titulo: `${t.quien} te atacó y falló`, cuerpo: `${t.total} contra tu CA ${t.objetivo.cd}.`, dura: 6000 });
      } else {
        avisos.push({
          id: id(), tono: 'peligro', titulo: `${t.quien} te hace ${t.total} de daño`, cuerpo: t.etiqueta,
          botones: [{ etiqueta: `Restar ${t.total} PG`, principal: true, hacer: () => restarPG(t.total) }],
        });
      }
    }
    return avisos;
  };
  const { avisos, cerrar: cerrarAviso, agregar: agregarAviso } = useAvisos(sala.eventos, generar);
  // Lo que la sala (o la propia pantalla) no dejó hacer: un aviso con el motivo
  const negacionVista = useRef(sala.negaciones.at(-1)?.id ?? 0);
  useEffect(() => {
    const nuevas = sala.negaciones.filter((n) => n.id > negacionVista.current);
    if (!nuevas.length) return;
    negacionVista.current = nuevas.at(-1)!.id;
    for (const n of nuevas) agregarAviso({ id: crypto.randomUUID(), tono: 'peligro', titulo: 'No se puede', cuerpo: n.motivo, dura: 5000 });
  }, [sala.negaciones]);
  // Ataques en pausa: si me atacan y puedo reaccionar, la mesa espera mi respuesta
  const miEspera = estado.esperas.find((x) => x.personajeId === p.id);
  const esperaAjena = estado.esperas.find((x) => x.atacante === p.nombre);

  const acciones = (fila: Fila) => ({
    onAtacar: (numero: 0 | 1 | 2) => {
      if (fila.tipo === 'golpe') atacar(fila.golpe.id, numero, objetivo?.id);
    },
    onDano: (critico: boolean) => {
      if (fila.tipo === 'golpe') tirarDano(fila.golpe.id, critico, objetivo?.id);
    },
    onUsar: () => {
      if (fila.tipo === 'aptitud') usarAptitud(fila.aptitud, objetivo?.id);
    },
    onCerrar: () => setElegida(null),
  });

  // Atajos de teclado en pantalla grande: Q W E R T abren las acciones del turno, Enter las usa, F termina el turno
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      const destino = e.target as HTMLElement;
      if (editando || e.ctrlKey || e.metaKey || e.altKey || destino.closest('input, textarea, select')) return;
      const tecla = e.key.toUpperCase();
      const i = TECLAS.indexOf(tecla);
      const turno = lista[0];
      if (i >= 0 && turno?.filas[i]) {
        setSeccionActiva('turno');
        setElegida(turno.filas[i]!.clave);
        setPlegada(false);
      } else if (tecla === 'ESCAPE') {
        setElegida(null);
      } else if (tecla === 'ENTER' && filaElegida && !destino.closest('button')) {
        const a = acciones(filaElegida);
        if (filaElegida.tipo === 'golpe') a.onAtacar(Math.min(ataquesHechos ?? 0, 2) as 0 | 1 | 2);
        else a.onUsar();
      } else if (tecla === 'F' && miTurno) {
        sala.enviar({ tipo: 'avanzar-turno' });
      }
    }
    addEventListener('keydown', alPulsar);
    return () => removeEventListener('keydown', alPulsar);
  });

  if (editando) {
    return (
      <div className="h-full overflow-y-auto">
        <EditorFicha
          salaId={salaId}
          inicial={p}
          modo="editar"
          error={mensajeRechazo(sala.rechazo)}
          onCancelar={() => { setEditando(false); sala.limpiarRechazo(); }}
          onGuardar={(nueva) => {
            const { id, ...cambios } = nueva;
            sala.enviar({ tipo: 'editar-personaje', id, cambios });
            setEditando(false);
          }}
        />
      </div>
    );
  }

  const fichaCompleta = (
    <Ficha
      personaje={p}
      condiciones={condiciones}
      puedeEditar
      objetivo={objetivo}
      siguienteAtaque={ataquesHechos}
      onCambiar={(cambios) => sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios })}
      onPonerCondicion={(clave, valor) => miToken && sala.enviar({ tipo: 'poner-condicion', tokenId: miToken.id, clave, valor })}
      onTirar={tirar}
      onAbrirEditor={() => setEditando(true)}
    />
  );
  // En su turno: su alcance de movimiento y la línea a su objetivo, dibujados en el tablero
  // En su turno se marcan las casillas a las que llega; fuera de combate se mueve libre
  const movimiento = miToken ? (miTurno ? { tokenId: miToken.id, libres: libres ?? 0 } : !combate ? { tokenId: miToken.id, libres: null } : null) : null;
  const todasFilas = lista.flatMap((s) => s.filas).filter((f, i, xs) => xs.findIndex((x) => x.clave === f.clave) === i);
  const menu = menuAbierto && objetivoToken && miToken ? {
    tokenId: objetivoToken.id,
    contenido: (
      <MenuObjetivo estado={estado} p={p} miToken={miToken} objetivo={objetivoToken} filas={todasFilas} ataquesHechos={ataquesHechos}
        onAtacar={(golpeId, numero) => atacar(golpeId, numero, objetivoToken.id)}
        onUsar={(a) => usarAptitud(a, objetivoToken.id)}
        onAcercar={(c) => { sala.mover(miToken.id, c.x, c.y); }}
        onCerrar={() => setMenuAbierto(false)} />
    ),
  } : null;
  const apunta = miToken && objetivoToken ? { desde: miToken.id, hasta: objetivoToken.id } : null;
  const tiradas = (
    <div className="flex flex-col gap-4">
      <TiradaLibre esGM={false} objetivo={objetivo} onTirar={tirar} />
      <ListaTiradas tiradas={estado.tiradas} verCd={false} />
    </div>
  );

  const tablero = (margenInferior: number) => (
    <Tablero
      estado={estado}
      colores={colores}
      quien={sala.quien}
      margenInferior={margenInferior}
      movimiento={movimiento}
      apunta={apunta}
      eventos={sala.eventos}
      menu={menu}
      onNegar={sala.negarLocal}
      seleccionado={seleccionado}
      onSeleccionar={(id) => { setSeleccionado(id); setMenuAbierto(!!id && id !== miToken?.id); }}
      onMover={(id, x, y) => sala.mover(id, x, y)}
    />
  );

  const contexto: Contexto = { estado, combate, miToken, miTurno, enTurno, p, sala, ficha };

  return (
    <div className="flex h-full flex-col">
      <Cabecera salaId={salaId} sala={sala} tema={tema} />

      {/* Pantalla grande: tablero + página apoyada encima */}
      <div className="relative hidden min-h-0 flex-1 lg:block">
        {tablero(plegada ? 70 : 320)}
        {combate && <OrdenEscrito estado={estado} combate={combate} />}
        {!filaElegida && avisos.length === 0 && <MargenTiradas estado={estado} onVerTodas={() => setCajon('tiradas')} />}

        <section aria-label={`Página de ${p.nombre}`}
          className={`hoja absolute inset-x-5 bottom-5 z-10 transition-transform duration-300 ease-out ${plegada ? 'translate-y-[calc(100%-56px)]' : ''}`}>
          <button className="absolute -top-9 right-6 flex h-9 items-center gap-1.5 rounded-t-lg bg-superficie px-3 font-titulo text-[13px] text-texto-suave shadow-[0_-4px_10px_-6px_var(--sombra)] hover:text-acento"
            onClick={() => setPlegada(!plegada)} aria-expanded={!plegada}>
            {plegada ? <CaretUpIcon size={16} aria-hidden /> : <CaretDownIcon size={16} aria-hidden />}
            {plegada ? 'Mostrar mi hoja' : 'Bajar la hoja'}
          </button>
          <div className="grid min-h-[268px] grid-cols-[290px_minmax(0,1fr)_250px] xl:grid-cols-[310px_minmax(0,1fr)_270px]">
            <ColumnaQuien contexto={contexto} onAbrirFicha={() => setCajon('ficha')} />

            <div className="relative border-x border-dashed border-borde px-5 pt-3 pb-4">
              <CabeceraTurno contexto={contexto} />
              <Pestanas lista={lista} activa={seccionActiva} onCambiar={(id) => { setSeccionActiva(id); setElegida(null); }} />
              <div className="mt-1 max-h-[200px] overflow-y-auto pr-1">
                {lista.filter((s) => s.id === seccionActiva).map((s) => (
                  <div key={s.id}>
                    {s.resumen && <p className="px-1.5 pt-1 font-titulo text-[13px] text-texto-suave">{s.resumen}</p>}
                    <ListaAcciones seccion={s} elegida={elegida} marcada={marcada} teclas={s.id === 'turno' ? TECLAS : undefined} libres={libres}
                      onElegir={(f) => setElegida(elegida === f.clave ? null : f.clave)} />
                  </div>
                ))}
              </div>
            </div>

            <ColumnaLado contexto={contexto} condiciones={condiciones} />
          </div>
          {filaElegida && (
            <div className="tarjeta absolute right-4 bottom-[calc(100%+52px)] z-20 w-[400px] px-4 py-3.5">
              <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 -rotate-2 bg-[var(--cinta)]" />
              <Detalle fila={filaElegida} ataquesHechos={ataquesHechos} libres={libres} objetivo={objetivo} enCombate={!!combate} antes={filasAlAtacar} onAbrir={setElegida}
                dano={filaElegida.tipo === 'golpe' ? ficha.golpes[filaElegida.indice]?.dano ?? null : null}
                acciones={acciones(filaElegida)} />
            </div>
          )}
        </section>

        {cajon && (
          <aside className="absolute inset-y-0 right-0 z-30 flex w-[440px] flex-col border-l border-borde bg-fondo shadow-[-20px_0_40px_-20px_var(--sombra)]">
            <div className="flex items-center gap-2 border-b border-dashed border-borde px-4 py-2">
              {(['ficha', 'tiradas'] as const).map((c) => (
                <button key={c} onClick={() => setCajon(c)}
                  className={`rounded-lg px-3 py-1.5 font-titulo text-[15px] ${cajon === c ? 'font-bold text-acento' : 'text-texto-suave hover:text-texto'}`}>
                  {c === 'ficha' ? 'Ficha completa' : 'Tiradas'}
                </button>
              ))}
              <button className="ml-auto flex size-9 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={() => setCajon(null)} aria-label="Cerrar">
                <XIcon size={18} aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{cajon === 'ficha' ? fichaCompleta : tiradas}</div>
          </aside>
        )}
      </div>

      {/* Teléfono: la página es el mando */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className={`relative min-h-0 flex-1 ${pestana === 'tablero' ? 'block' : 'hidden'}`}>
          {tablero(0)}
          {combate && <OrdenEscrito estado={estado} combate={combate} />}
        </div>
        {pestana === 'turno' && (
          <TurnoMovil contexto={contexto} condiciones={condiciones} lista={lista} elegida={elegida} marcada={marcada} libres={libres}
            onElegir={(f) => setElegida(elegida === f.clave ? null : f.clave)}
            detalle={(f) => (
              <Detalle fila={f} ataquesHechos={ataquesHechos} libres={libres} objetivo={objetivo} enCombate={!!combate} antes={filasAlAtacar} onAbrir={setElegida}
                dano={f.tipo === 'golpe' ? ficha.golpes[f.indice]?.dano ?? null : null} acciones={acciones(f)} />
            )} />
        )}
        {pestana === 'ficha' && <div className="flex-1 overflow-y-auto p-4">{fichaCompleta}</div>}
        {pestana === 'tiradas' && <div className="flex-1 overflow-y-auto p-4">{tiradas}</div>}
        <nav className="grid grid-cols-4 border-t border-dashed border-borde bg-fondo/95 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
          {([
            ['turno', 'Turno', <SwordIcon key="i" size={23} aria-hidden />],
            ['ficha', 'Ficha', <NotebookIcon key="i" size={23} aria-hidden />],
            ['tablero', 'Tablero', <MapTrifoldIcon key="i" size={23} aria-hidden />],
            ['tiradas', 'Tiradas', <DiceFiveIcon key="i" size={23} aria-hidden />],
          ] as const).map(([clave, nombre, icono]) => (
            <button key={clave} onClick={() => setPestana(clave)} aria-current={pestana === clave ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-1 font-titulo text-[12.5px] ${pestana === clave ? 'font-bold text-acento' : 'text-texto-suave'}`}>
              {icono}
              {nombre}
            </button>
          ))}
        </nav>
      </div>

      <AvisoTirada tiradas={estado.tiradas} verCd={false} pendiente={sala.pendiente} lugar="bottom-[156px] lg:bottom-auto lg:top-[124px]" />

      {/* Avisos del momento: arriba a la derecha en PC, arriba en el teléfono */}
      <PilaAvisos avisos={avisos} onCerrar={cerrarAviso}
        className="fixed inset-x-3 top-[60px] z-30 lg:inset-x-auto lg:top-[72px] lg:right-6 lg:w-[340px]" />
      {esperaAjena && (
        <div className="fixed inset-x-0 top-[60px] z-30 flex justify-center px-4" role="status">
          <p className="tarjeta px-4 py-2 font-titulo text-[15px]">
            Esperando a que {estado.tokens[esperaAjena.objetivoTokenId]?.nombre ?? 'tu objetivo'} decida si reacciona…
          </p>
        </div>
      )}
      {miEspera && (
        <PanelEspera espera={miEspera} aptitudes={todasLasAptitudes(p).filter((a) => miEspera.aptitudes.includes(a.id))}
          onResponder={(aptitudId) => sala.responder(miEspera.id, aptitudId)} />
      )}
    </div>
  );
}

interface Contexto {
  estado: EstadoSala;
  combate: Combate | null;
  miToken: Token | undefined;
  miTurno: boolean;
  enTurno: Token | undefined;
  p: Personaje;
  sala: Sala;
  ficha: ReturnType<typeof calcular>;
}

function Cabecera({ salaId, sala, tema }: { salaId: string; sala: Sala; tema: Tema }) {
  return (
    <header className="relative z-20 flex items-center gap-3 border-b border-dashed border-borde bg-fondo px-4 py-2 lg:px-6">
      <a href="/" className="font-titulo text-[22px] font-bold text-acento">Wayforge</a>
      <span className="hidden font-titulo text-sm text-texto-suave sm:inline">mesa {salaId.toUpperCase()}</span>
      <span className={`size-2 shrink-0 rounded-full ${sala.conectado ? 'bg-exito' : 'bg-peligro'}`} title={sala.conectado ? 'Conectado' : 'Reconectando…'} />
      {!sala.conectado && <span className="font-titulo text-sm text-peligro">reconectando…</span>}
      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-texto-suave" title={sala.presentes.map((x) => x.nombre).join(', ')}>
          <UsersIcon size={18} aria-hidden />
          <span className="hidden md:inline">{sala.presentes.map((x) => x.nombre).join(', ')}</span>
          <span className="md:hidden">{sala.presentes.length}</span>
        </span>
        <BotonTema tema={tema} />
        <button className="flex h-10 items-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm transition hover:bg-superficie-2"
          onClick={() => confirm('¿Salir de la mesa? Para volver necesitarás el código de tu personaje.') && sala.salir()}>
          <SignOutIcon size={18} aria-hidden />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}

// Orden de turnos escrito a mano arriba del tablero: los que ya jugaron, tachados; el actual, con marcatextos
function OrdenEscrito({ estado, combate }: { estado: EstadoSala; combate: Combate }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
    <ol className="pointer-events-auto flex max-w-full items-baseline gap-x-5 gap-y-1 overflow-x-auto rounded-sm bg-fondo/90 px-4 py-1.5 font-titulo text-[16px] shadow-[0_6px_16px_-10px_var(--sombra)]"
      aria-label={`Orden de iniciativa, ronda ${combate.ronda}`}>
      <li className="shrink-0 text-[14px] text-texto-suave">ronda {combate.ronda}:</li>
      {combate.orden.map((c, i) => {
        const t = estado.tokens[c.tokenId];
        if (!t) return null;
        const ahora = i === combate.turno;
        const hecho = i < combate.turno;
        const enemigo = !t.personajeId;
        return (
          <li key={c.tokenId} className={`shrink-0 whitespace-nowrap ${ahora ? 'marcatextos font-bold' : hecho ? 'text-texto-suave line-through decoration-[1.5px]' : enemigo ? 'text-peligro' : ''}`}>
            {t.nombre}<span className={`ml-1 text-[12.5px] ${ahora ? 'text-sobre-marca' : 'text-texto-suave'}`}>{c.iniciativa}</span>
          </li>
        );
      })}
    </ol>
    </div>
  );
}

// Las últimas tiradas, como notas al margen derecho
function MargenTiradas({ estado, onVerTodas }: { estado: EstadoSala; onVerTodas: () => void }) {
  const ultimas = estado.tiradas.slice(-3).reverse();
  if (ultimas.length === 0) return null;
  return (
    <aside className="absolute top-16 right-6 z-10 w-[260px] font-titulo">
      <h2 className="mb-1 text-[15px] font-semibold text-texto-suave">Últimas tiradas</h2>
      <ul>
        {ultimas.map((t) => (
          <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 border-b-[1.5px] border-dashed border-borde py-1.5">
            <span className="truncate text-[14.5px]">{t.quien} · {t.etiqueta}</span>
            <b className="row-span-2 text-[28px] leading-none text-acento">{t.total}</b>
            <small className="truncate text-[12.5px] text-texto-suave">
              {textoTirada(t)}
              {t.objetivo && (
                <span className={t.objetivo.grado === 'exito' || t.objetivo.grado === 'critico' ? 'font-semibold text-exito' : 'font-semibold text-peligro'}>
                  {' · '}{t.objetivo.grado === 'critico' ? '¡crítico!' : t.objetivo.grado === 'exito' ? 'le diste' : t.objetivo.grado === 'pifia' ? 'pifia' : 'falló'}
                </span>
              )}
            </small>
          </li>
        ))}
      </ul>
      <button className="mt-1 text-[13px] text-acento-suave hover:text-acento" onClick={onVerTodas}>ver todas</button>
    </aside>
  );
}

function ColumnaQuien({ contexto: { p, ficha, sala }, onAbrirFicha }: { contexto: Contexto; onAbrirFicha: () => void }) {
  const tirar = (que: QueTirar) => sala.tirar(p.id, que);
  return (
    <div className="flex flex-col gap-3 px-5 pt-4 pb-4">
      <div className="flex items-center gap-3.5">
        <FotoPegada src={p.retrato || undefined} inicial={p.nombre.slice(0, 1)} />
        <div className="min-w-0">
          <h2 className="truncate font-titulo text-[30px] leading-none font-bold text-acento">{p.nombre}</h2>
          <p className="mt-1 truncate font-titulo text-[14px] text-texto-suave">{[p.ascendencia, p.clase].filter(Boolean).join(' ')} · nivel {p.nivel}</p>
        </div>
      </div>
      <button className="text-left" onClick={onAbrirFicha} title="Abrir la ficha completa para curar o recibir daño">
        <span className="font-titulo text-[38px] leading-none font-bold">{p.pgActual}</span>
        <span className="ml-1 font-titulo text-[17px] text-texto-suave">/ {ficha.pgMax.total} PG</span>
        {p.pgTemporales > 0 && <span className="ml-2 font-titulo text-[13px] text-acento">+{p.pgTemporales} temp</span>}
        <div className="mt-1.5"><BarraPG actual={p.pgActual} max={ficha.pgMax.total} temporales={p.pgTemporales} /></div>
      </button>
      <div className="flex gap-1 font-titulo">
        {([
          ['CA', String(ficha.ca.total), null],
          ['Fort', signo(ficha.salvaciones.fortitude.total), { tipo: 'salvacion', clave: 'fortitude' }],
          ['Ref', signo(ficha.salvaciones.reflex.total), { tipo: 'salvacion', clave: 'reflex' }],
          ['Will', signo(ficha.salvaciones.will.total), { tipo: 'salvacion', clave: 'will' }],
          ['Perc', signo(ficha.percepcion.total), { tipo: 'percepcion' }],
        ] as const).map(([etiqueta, valor, que]) => (
          que ? (
            <button key={etiqueta} className="flex-1 rounded-lg py-1 transition hover:bg-acento/10" onClick={() => tirar(que)} title={`Tirar ${etiqueta}`}>
              <span className="block text-[12px] text-texto-suave">{etiqueta}</span>
              <b className="text-[20px]">{valor}</b>
            </button>
          ) : (
            <div key={etiqueta} className="flex-1 py-1">
              <span className="block text-[12px] text-texto-suave">{etiqueta}</span>
              <b className="text-[20px] text-acento">{valor}</b>
            </div>
          )
        ))}
      </div>
      {ficha.conjuros && (
        <p className="font-titulo text-[13px] text-texto-suave">
          Conjuros: ataque <b className="text-texto">{signo(ficha.conjuros.ataque.total)}</b> · CD <b className="text-texto">{ficha.conjuros.cd.total}</b>
        </p>
      )}
    </div>
  );
}

function CabeceraTurno({ contexto: { combate, miTurno, enTurno } }: { contexto: Contexto }) {
  if (!combate) {
    return <h3 className="mb-1 font-titulo text-[21px] font-semibold">Fuera de combate <span className="text-[14px] font-normal text-texto-suave">· explora, habla, descansa</span></h3>;
  }
  if (!miTurno) {
    return (
      <h3 className="mb-1 font-titulo text-[21px] font-semibold">
        Turno de <span className={enTurno?.personajeId ? 'text-acento' : 'text-peligro'}>{enTurno?.nombre ?? '…'}</span>
        <span className="text-[14px] font-normal text-texto-suave"> · prepara tu próximo turno</span>
      </h3>
    );
  }
  const libres = combate.acciones - combate.usadas;
  return (
    <h3 className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-titulo text-[19px] font-semibold lg:text-[21px]">
      <span className="marcatextos whitespace-nowrap">¡Tu turno!</span>
      <span className="inline-flex gap-1" aria-label={`${combate.usadas} acciones usadas de ${combate.acciones}`}>
        {Array.from({ length: combate.acciones }, (_, i) => (
          <span key={`${i}-${i < combate.usadas}`} className={i < combate.usadas ? 'rombo-gastado' : 'rombo-libre'}>
            <Rombo lleno={i >= combate.usadas} tachado={i < combate.usadas} className="size-5" />
          </span>
        ))}
      </span>
      <span className="whitespace-nowrap text-[14px] font-normal text-texto-suave">{libres === 0 ? 'sin acciones' : `te ${libres === 1 ? 'queda 1' : `quedan ${libres}`}`}</span>
    </h3>
  );
}

// Pestañas índice: una por cada forma de recuperar lo que usas
function Pestanas({ lista, activa, onCambiar }: { lista: Seccion[]; activa: Seccion['id']; onCambiar: (id: Seccion['id']) => void }) {
  return (
    <div className="relative flex flex-wrap gap-x-1 gap-y-1 pb-[3px]" role="tablist">
      <RayaAMano className="absolute inset-x-0 bottom-0 h-1.5 text-texto/70" />
      {lista.map((s) => (
        <button key={s.id} role="tab" aria-selected={activa === s.id} title={s.ayuda} onClick={() => onCambiar(s.id)}
          className={`relative z-[1] rounded-t-md border-[1.5px] border-b-0 px-2.5 pt-1 pb-0.5 font-titulo text-[14px] transition ${activa === s.id ? 'border-texto/60 bg-superficie font-bold text-texto' : 'border-transparent text-texto-suave hover:text-texto'}`}>
          {s.titulo}
          {s.id !== 'turno' && <span className="ml-1 text-[11.5px] text-texto-suave">{s.filas.length}</span>}
        </button>
      ))}
    </div>
  );
}

// Columna derecha: condiciones como post-its y la acción grande del momento
function ColumnaLado({ contexto, condiciones }: { contexto: Contexto; condiciones: Condicion[] }) {
  const { combate, miTurno, miToken, sala, p } = contexto;
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
      <div className="flex max-h-[150px] flex-col gap-2.5 overflow-y-auto pt-1 pr-1">
        {condiciones.length === 0
          ? <p className="font-titulo text-[14px] text-texto-suave">Sin condiciones. Si te pasa algo (Frightened, Prone…), aparece aquí con su explicación.</p>
          : condiciones.map((c, i) => <PostitCondicion key={c.clave} condicion={c} giro={i % 2 ? -1.5 : 2} />)}
      </div>
      <div className="mt-auto flex flex-col gap-2">
        {combate && miToken && <BotonReaccion combate={combate} tokenId={miToken.id} sala={sala} />}
        {combate
          ? miTurno && (
            <button className="boli flex h-12 items-center justify-center gap-2 bg-acento font-titulo text-[17px] font-bold text-sobre-acento shadow-[0_6px_12px_-6px_var(--acento)] transition active:scale-[0.97]"
              onClick={() => sala.enviar({ tipo: 'avanzar-turno' })}>
              Terminar turno <Tecla sobreTinta>F</Tecla>
            </button>
          )
          : <Descansos p={p} sala={sala} />}
      </div>
    </div>
  );
}

function BotonReaccion({ combate, tokenId, sala }: { combate: Combate; tokenId: string; sala: Sala }) {
  const usada = combate.reacciones.includes(tokenId);
  return (
    <button onClick={() => sala.enviar({ tipo: 'usar-reaccion', tokenId, usada: !usada })}
      title="Una reacción por ronda, también en el turno de otros (por ejemplo, Shield Block)"
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left font-titulo text-[14px] transition hover:bg-acento/10 ${usada ? 'text-texto-suave' : 'text-acento'}`}>
      <ArrowsClockwiseIcon size={20} weight="bold" aria-hidden />
      {usada ? 'Reacción usada (toca para devolverla)' : 'Reacción lista'}
    </button>
  );
}

function Descansos({ p, sala }: { p: Personaje; sala: Sala }) {
  const r = recursosDe(p);
  const descansar = (d: Descanso) => {
    if (confirm(`${DESCANSOS[d].nombre}: ${DESCANSOS[d].ayuda} ¿Seguro?`)) sala.enviar({ tipo: 'descansar', personajeId: p.id, descanso: d });
  };
  return (
    <div className="flex flex-col gap-1.5">
      {r.foco.max > 0 && (
        <button className="boli flex h-11 items-center justify-center gap-2 border-2 border-acento font-titulo text-[15px] font-semibold text-acento transition hover:bg-acento/10"
          onClick={() => descansar('refocus')} title={DESCANSOS.refocus.ayuda}>
          <CoffeeIcon size={18} aria-hidden /> Refocus (10 min)
        </button>
      )}
      <button className="boli flex h-11 items-center justify-center gap-2 bg-acento font-titulo text-[15px] font-bold text-sobre-acento transition active:scale-[0.97]"
        onClick={() => descansar('diario')} title={DESCANSOS.diario.ayuda}>
        <BedIcon size={18} aria-hidden /> Descansar 8 horas
      </button>
    </div>
  );
}

// El turno en el teléfono: cabecera fija, secciones una debajo de otra, la acción abierta como tarjeta,
// y la acción grande ("Terminar turno" o descansar) siempre a mano sobre la barra de pestañas
function TurnoMovil({ contexto, condiciones, lista, elegida, marcada, libres, onElegir, detalle }: {
  contexto: Contexto;
  condiciones: Condicion[];
  lista: Seccion[];
  elegida: string | null;
  marcada: string | null;
  libres: number | null;
  onElegir: (f: Fila) => void;
  detalle: (f: Fila) => ReactNode;
}) {
  const { p, ficha, combate, miTurno, miToken, sala } = contexto;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hoja mx-3 mt-2 flex flex-col gap-2.5 px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-3">
          <FotoPegada src={p.retrato || undefined} inicial={p.nombre.slice(0, 1)} tamano="size-[54px]" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-titulo text-[25px] leading-none font-bold text-acento">{p.nombre}</h2>
            <p className="mt-1 font-titulo text-[14px] text-texto-suave">
              <b className="text-[18px] text-texto">{p.pgActual}</b> / {ficha.pgMax.total} PG · CA <b className="text-texto">{ficha.ca.total}</b>
            </p>
          </div>
        </div>
        <BarraPG actual={p.pgActual} max={ficha.pgMax.total} temporales={p.pgTemporales} alto="h-3" />
        <div className="flex flex-wrap items-center gap-2">
          <CabeceraTurno contexto={contexto} />
        </div>
        {condiciones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {condiciones.map((c, i) => <PostitCondicion key={c.clave} condicion={c} compacto giro={i % 2 ? -2 : 2} />)}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        {lista.map((s) => (
          <section key={s.id} className="mb-4">
            <div className="flex items-baseline justify-between gap-2 border-b-[1.5px] border-texto/70 pb-0.5">
              <h3 className="shrink-0 font-titulo text-[18px] font-bold">{s.titulo}</h3>
              <span className="truncate font-titulo text-[12.5px] text-texto-suave">{s.resumen ?? s.ayuda}</span>
            </div>
            {s.filas.map((f) => (
              <div key={f.clave}>
                <ListaAcciones seccion={{ ...s, filas: [f] }} elegida={elegida} marcada={marcada} libres={libres} onElegir={onElegir} />
                {elegida === f.clave && <div className="tarjeta relative my-2 px-4 py-3.5">{detalle(f)}</div>}
              </div>
            ))}
          </section>
        ))}
      </div>

      <div className="border-t border-dashed border-borde bg-fondo/95 px-4 py-2.5">
        {combate ? (
          <div className="flex items-center gap-2">
            {miToken && <BotonReaccion combate={combate} tokenId={miToken.id} sala={sala} />}
            {miTurno && (
              <button className="boli ml-auto flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap bg-acento px-3 font-titulo text-[16px] font-bold text-sobre-acento shadow-[0_6px_12px_-6px_var(--acento)] active:scale-[0.97]"
                onClick={() => sala.enviar({ tipo: 'avanzar-turno' })}>
                Terminar turno
              </button>
            )}
          </div>
        ) : (
          <Descansos p={p} sala={sala} />
        )}
      </div>
    </div>
  );
}

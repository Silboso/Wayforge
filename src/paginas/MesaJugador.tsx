import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowsClockwiseIcon, BackpackIcon, BedIcon, BookOpenTextIcon, CaretDownIcon, CaretUpIcon, CoffeeIcon, CrosshairIcon, DiceFiveIcon,
  BooksIcon, DotsThreeOutlineIcon, MapTrifoldIcon, NotebookIcon, NotePencilIcon, PencilSimpleIcon, QuestionIcon, StickerIcon, SignOutIcon, SwordIcon, UsersIcon, UsersThreeIcon, XIcon,
  SparkleIcon, ChatCircleDotsIcon, MedalIcon,
} from '@phosphor-icons/react';
import { calcular, leerDados, signo, type Personaje } from '../../reglas/pf2e';
import { DESCANSOS, disponibilidad, recursosDe, todasLasAptitudes, type Aptitud, type Descanso } from '../../reglas/aptitudes';
import { CONDICIONES, type Condicion } from '../../reglas/condiciones';
import { tieneMomento } from '../../reglas/disparadores';
import { interaccionDe } from '../../reglas/interacciones';
import { EfectosActivos } from '../componentes/EfectosActivos';
import { SubirNivel } from '../componentes/nivel/SubirNivel';
import type { EfectoActivo } from '../../reglas/efectos';

const SIN_EFECTOS: EfectoActivo[] = [];
import { ASPECTO_POR_DANO, tintaDe } from '../componentes/aspectos';
import {
  aptitudesDePreparacion, aptitudesPara, motivoAlcance, motivoParaActuar, reaccionesPara, tokenEnTurno, type Combate, type EstadoSala, type QueTirar, type Token, BLOQUEO_ESCUDO } from '../../compartido/sala';
import { pistaObjetivo, type Pista } from '../../compartido/interacciones';
import { OrdenRevelado, PreparacionJugador } from '../componentes/Preparacion';
import { Companeros } from '../componentes/hud/Companeros';
import { BarraHabilidades } from '../componentes/hud/BarraHabilidades';
import { BarraEstados } from '../componentes/hud/BarraEstados';
import { Telon, TituloEscena } from '../componentes/Escenas';
import { PanelChat } from '../componentes/Chat';
import { HandoutRecibido, ListaHandouts } from '../componentes/Handouts';
import { ElegirActividad, ElegirCurar, ElegirRango, PuntosHeroicos } from '../componentes/Descanso';
import { deMascara, visionActiva } from '../../compartido/vision';
import { ElegirLuz } from '../componentes/Luz';
import { MenuObjetivo } from '../componentes/hud/MenuObjetivo';
import { aAlcance, type Evento } from '../../compartido/eventos';
import { textoTirada } from '../../compartido/tiradas';
import type { Sala } from '../conexion';
import { leerColoresTablero, type useTema } from '../tema';
import { BotonTema } from '../componentes/BotonTema';
import { EditarPersonaje } from '../componentes/EditarPersonaje';
import { Ficha } from '../componentes/Ficha';
import { Tablero } from '../componentes/Tablero';
import { AvisoTirada, ListaTiradas, TiradaLibre } from '../componentes/Tiradas';
import { Detalle, ListaAcciones } from '../componentes/hud/Acciones';
import { BarraPG, FotoPegada, PostitCondicion, RayaAMano, Rombo, Tecla } from '../componentes/hud/piezas';
import { alcanceDe, ponerAtajo, secciones, TECLAS, type Fila, type Seccion } from '../componentes/hud/secciones';
import { ElegirAtajo, Modal, useConfirmar } from '../componentes/hud/Modal';
import { AyudaTeclas, ModalCondiciones, PanelGrupo, PanelMochila, PanelNotas, PanelReglas } from '../componentes/hud/Paneles';
import { PanelCompendio, type AccionesCompendio } from '../componentes/compendio/PanelCompendio';
import { conjuroAAptitud, doteAAptitud } from '../../reglas/compendio';
import { agregarObjeto, comprarObjeto, consumibleDeCompendio, escudoDe, objetoDeCompendio, textoPrecio } from '../../reglas/objetos';
import { PanelEspera, PilaAvisos, useAvisos, useLlegadas, type Aviso } from '../componentes/hud/Avisos';

type Tema = ReturnType<typeof useTema>;
type PestanaMovil = 'turno' | 'ficha' | 'tablero' | 'tiradas';
// Lo que se abre en el cajón lateral (en el teléfono, en una ventana)
type Cajon = 'ficha' | 'chat' | 'grupo' | 'mochila' | 'notas' | 'compendio' | 'tiradas' | 'reglas';

const CAJONES: { clave: Cajon; nombre: string; tecla?: string }[] = [
  { clave: 'ficha', nombre: 'Ficha' },
  { clave: 'chat', nombre: 'Chat', tecla: 'T' },
  { clave: 'grupo', nombre: 'Grupo', tecla: 'G' },
  { clave: 'mochila', nombre: 'Mochila', tecla: 'I' },
  { clave: 'notas', nombre: 'Notas', tecla: 'N' },
  { clave: 'compendio', nombre: 'Compendio', tecla: 'K' },
  { clave: 'tiradas', nombre: 'Tiradas' },
  { clave: 'reglas', nombre: 'Reglas', tecla: 'H' },
];

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
  const [seccionActiva, setSeccionActiva] = useState<Seccion['id']>('acciones');
  const [cajon, setCajon] = useState<Cajon | null>(null);
  // En qué parte del compendio se abre (desde la mochila, en el equipo)
  const [compendioEn, setCompendioEn] = useState<'conjuros' | 'equipo'>('conjuros');
  // El atajo que se está eligiendo (abre la ventana para elegir qué va en esa tecla)
  const [eligiendoAtajo, setEligiendoAtajo] = useState<number | null>(null);
  // En el teléfono: la lista de "Más" y el panel abierto desde ahí
  const [masAbierto, setMasAbierto] = useState(false);
  const [panelMovil, setPanelMovil] = useState<Cajon | null>(null);
  const [ayuda, setAyuda] = useState(false);
  // Tocar un nombre del orden de iniciativa lleva la vista a su token
  const [enfoque, setEnfoque] = useState<{ tokenId: string; n: number } | null>(null);
  const [viendoCondiciones, setViendoCondiciones] = useState(false);
  const [plegada, setPlegada] = useState(false);
  // Lo alto de la hoja (abierta o plegada): el tablero, el menú y los avisos se acomodan encima, nunca debajo
  const hojaRef = useRef<HTMLElement>(null);
  const [altoHoja, setAltoHoja] = useState(300);
  useEffect(() => {
    const h = hojaRef.current;
    if (!h) return;
    const medir = () => setAltoHoja(Math.round(h.getBoundingClientRect().height));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(h);
    return () => ro.disconnect();
  }, []);
  // En pantallas bajas, abrir un panel pliega la hoja para que el panel tenga lugar (se vuelve a abrir con su botón)
  const plegadaPorPanel = useRef(false);
  useEffect(() => {
    if (cajon && innerHeight < 800 && !plegada) { setPlegada(true); plegadaPorPanel.current = true; }
    // Al cerrar el panel, si la plegó él, la hoja vuelve a abrirse
    if (!cajon && plegadaPorPanel.current) { setPlegada(false); plegadaPorPanel.current = false; }
  }, [cajon]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pestana, setPestana] = useState<PestanaMovil>('turno');
  const [editando, setEditando] = useState(false);
  const [colores, setColores] = useState(leerColoresTablero);
  // El menú pegado a un token tocado en el tablero (las opciones contra él)
  const [menuAbierto, setMenuAbierto] = useState(false);
  // La fila bajo el cursor: su alcance se ve en el tablero antes de elegirla
  const [asomada, setAsomada] = useState<string | null>(null);
  // Elegida una acción sin objetivo: el tablero espera a que toques a quién (con el alcance a la vista)
  const [eligiendo, setEligiendo] = useState<{ clave: string; numero: 0 | 1 | 2 } | null>(null);
  // Los objetivos ya tocados de algo que alcanza a varios (Electric Arc)
  const [marcados, setMarcados] = useState<string[]>([]);
  const [subiendoNivel, setSubiendoNivel] = useState(false);
  // Treat Wounds esperando que se elija la dificultad (a quién)
  const [curando, setCurando] = useState<string | null>(null);
  // Un conjuro esperando que se elija el rango del espacio (cuando hay libres de más de un rango)
  const [lanzando, setLanzando] = useState<{ a: Aptitud; objetivo?: string; etiqueta?: string; mas?: Parameters<typeof sala.usar>[3] } | null>(null);

  useEffect(() => setColores(leerColoresTablero()), [tema.tema]);

  const miToken = Object.values(estado.tokens).find((t) => t.personajeId === p.id);
  const condiciones = miToken?.condiciones ?? [];
  const combate = estado.combate;
  const enTurno = combate ? tokenEnTurno(estado) : undefined;
  const miTurno = !!combate && !!miToken && enTurno?.id === miToken.id;
  const ataquesHechos = miTurno ? combate!.ataques : null;
  const libres = miTurno ? combate!.acciones - combate!.usadas : null;
  const efectos = miToken?.efectos ?? SIN_EFECTOS;
  const ficha = calcular(p, condiciones, efectos);
  const lista = useMemo(() => secciones(p, condiciones, ataquesHechos, efectos), [p, condiciones, ataquesHechos, efectos]);
  const objetivoToken = seleccionado && seleccionado !== miToken?.id ? estado.tokens[seleccionado] : undefined;
  const objetivo = objetivoToken ? { id: objetivoToken.id, nombre: objetivoToken.nombre } : null;
  const filaElegida = lista.flatMap((s) => s.filas).find((f) => f.clave === elegida) ?? null;
  const todasFilas = lista.flatMap((s) => s.filas).filter((f, i, xs) => xs.findIndex((x) => x.clave === f.clave) === i);
  // Lo que probablemente toca: en tu turno, atacar si te quedan acciones
  const marcada = miTurno && combate!.usadas < combate!.acciones ? lista[0]?.filas[0]?.clave ?? null : null;

  // Los demás ven a quién apunto (en combate, solo en mi turno: fuera de él sería ruido en el tablero de todos)
  const apuntado = !combate || miTurno ? objetivoToken?.id ?? null : null;
  useEffect(() => { sala.apuntar(apuntado); }, [apuntado]);

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
  const hayOtros = Object.values(estado.tokens).some((t) => t.id !== miToken?.id);
  const elegirObjetivo = (clave: string, numero: 0 | 1 | 2 = 0) => {
    setEligiendo({ clave, numero });
    setElegida(null);
    setMenuAbierto(false);
    setPestana('tablero');
  };
  // Lanzar de verdad: si es un conjuro con espacio y hay libres de varios rangos, primero se elige en cuál
  const rangosLibres = (a: Aptitud) => a.recuperacion.tipo === 'espacio'
    ? [...new Set(recursosDe(p).espacios.filter((e) => e.rango >= (a.recuperacion as { rango: number }).rango && e.usados < e.max).map((e) => e.rango))].sort((x, y) => x - y)
    : [];
  const lanzar = (a: Aptitud, objetivo?: string, etiqueta?: string, mas?: Parameters<typeof sala.usar>[3]) => {
    if (!mas?.rango && rangosLibres(a).length > 1) return setLanzando({ a, ...(objetivo ? { objetivo } : {}), ...(etiqueta ? { etiqueta } : {}), ...(mas ? { mas } : {}) });
    sala.usar(a.id, objetivo, etiqueta, mas);
  };
  const usarAptitud = (a: Aptitud, objetivoId?: string, mas?: { objetivos?: string[]; punto?: { x: number; y: number }; nivel?: number }): boolean => {
    // Treat Wounds: a quién (de entrada, el elegido o el más herido del grupo) y con qué dificultad
    if (a.id === 'basica:treat-wounds' && !mas?.nivel) {
      const masHerido = Object.values(estado.tokens).filter((t) => t.personajeId && estado.personajes[t.personajeId])
        .map((t) => { const x = estado.personajes[t.personajeId!]!; return { t, falta: calcular(x).pgMax.total - x.pgActual }; })
        .sort((a1, a2) => a2.falta - a1.falta)[0];
      const destino = objetivoId ? estado.tokens[objetivoId] : masHerido && masHerido.falta > 0 ? masHerido.t : miToken;
      if (!destino) return false;
      if (motivoParaActuar(estado, p.id, a.costo)) return sala.negarLocal(motivoParaActuar(estado, p.id, a.costo)!), false;
      setCurando(destino.id);
      setElegida(null);
      return true;
    }
    // Delay: deja el turno para más tarde; vuelve con "Actuar ahora"
    if (a.id === 'basica:delay') {
      if (!miTurno || !miToken) return sala.negarLocal('Esperar (Delay) se elige al empezar tu turno, en combate.'), false;
      sala.enviar({ tipo: 'demorar', tokenId: miToken.id });
      setElegida(null);
      return true;
    }
    if (a.id === 'basica:stride' || a.id === 'basica:step') {
      setPestana('tablero');
      setElegida(null);
      agregarAviso({ id: crypto.randomUUID(), tono: 'nota', titulo: 'Arrastra tu token', cuerpo: 'Mientras lo llevas se marcan las casillas a las que llegas y cuánto te cuesta. Suéltalo donde quieras ir.', dura: 5000 });
      return true;
    }
    const motivo = motivoParaActuar(estado, p.id, a.costo);
    if (motivo) return sala.negarLocal(motivo), false;
    // Sneak: estando escondido, se paga la acción y después se arrastra el token (hasta la mitad de la Velocidad)
    if (a.id === 'basica:sneak') {
      if (!miToken?.condiciones?.some((c) => c.clave === 'hidden')) return sala.negarLocal('Para moverte sin ser visto primero tienes que estar escondido (Hide).'), false;
      sala.usar(a.id);
      setPestana('tablero');
      setElegida(null);
      agregarAviso({ id: crypto.randomUUID(), tono: 'nota', titulo: 'Arrastra tu token sin que te vean', cuerpo: `Hasta ${Math.max(5, Math.floor(p.velocidad / 10) * 5)} ft. Al llegar tiras Stealth contra los que miran: si fallas, o terminas a plena luz sin nada detrás, te ven.`, dura: 7000 });
      return true;
    }
    const disp = disponibilidad(p, a);
    if (!disp.puede) return sala.negarLocal(`${a.verbo || a.nombre}: ${disp.texto}.`), false;
    // Con interacción: sobre ti y las emanaciones salen ya; las áreas piden dónde, las de varios a quiénes
    const inter = interaccionDe(a);
    if (inter && miToken) {
      const o = inter.objetivos;
      const directo = o.tipo === 'yo' || (o.tipo === 'area' && o.area.forma === 'emanacion');
      if (directo || mas?.punto || mas?.objetivos) {
        // La tarjeta de "tirando…" solo si de verdad hay dados (Shield o Bless no tiran nada)
        const tira = inter.modo.tipo !== 'ninguna' || !!inter.dano || !!inter.curacion;
        lanzar(a, objetivoId, tira ? a.verbo || a.nombre : undefined, mas);
        setElegida(null);
        setMenuAbierto(false);
        return true;
      }
      if (o.tipo === 'area' || o.tipo === 'varios' || (o.tipo === 'uno' && o.aliados && !objetivoId)) {
        setMarcados(o.tipo === 'varios' && objetivoId ? [objetivoId] : []);
        return elegirObjetivo(a.id), false;
      }
    }
    // Recall Knowledge: sobre la criatura elegida (sin una, se elige en el tablero)
    const recordar = a.id === 'basica:recall-knowledge';
    if (recordar && !objetivoId && hayOtros && miToken) return elegirObjetivo(a.id), false;
    const fila = todasFilas.find((f) => f.clave === a.id);
    const alcance = fila ? alcanceDe(p, fila) : null;
    if (alcance && !objetivoId && hayOtros && miToken) return elegirObjetivo(a.id), false;
    const destino = objetivoId ? estado.tokens[objetivoId] : undefined;
    const lejos = alcance?.pies != null && destino && miToken ? motivoAlcance(miToken, destino, alcance.pies) : null;
    if (lejos) return sala.negarLocal(lejos), false;
    if (a.tirada?.tipo === 'golpe' && p.golpes[0]) { ultimoGolpe.current = p.golpes[0].id; ultimoConjuro.current = null; }
    if (a.tirada?.tipo === 'ataque-conjuro') ultimoConjuro.current = a;
    const apunta = inter || recordar || (a.tirada && a.tirada.tipo !== 'expresion' && a.tirada.tipo !== 'percepcion') ? objetivoId : undefined;
    lanzar(a, apunta, a.tirada ? a.verbo || a.nombre : undefined);
    setElegida(null);
    setMenuAbierto(false);
    return true;
  };
  const usarReaccion = (a: Aptitud, objetivoId?: string) => usarAptitud(a, objetivoId);
  // Un Strike: en tu turno, con acciones y llegando al objetivo; si no, el aviso dice por qué
  const atacar = (golpeId: string, numero: 0 | 1 | 2, objetivoId?: string): boolean => {
    const golpe = p.golpes.find((g) => g.id === golpeId);
    const motivo = motivoParaActuar(estado, p.id, 1);
    if (motivo) return sala.negarLocal(motivo), false;
    if (!objetivoId && hayOtros && miToken) return elegirObjetivo(`golpe:${golpeId}`, numero), false;
    const destino = objetivoId ? estado.tokens[objetivoId] : undefined;
    const lejos = golpe && destino && miToken ? motivoAlcance(miToken, destino, golpe.distancia ?? 5) : null;
    if (lejos) return sala.negarLocal(lejos), false;
    ultimoGolpe.current = golpeId;
    ultimoConjuro.current = null;
    sala.tirar(p.id, { tipo: 'ataque', golpe: golpeId, numero, ...(objetivoId ? { objetivo: objetivoId } : {}) }, golpe ? `Atacando con ${golpe.nombre}` : 'Atacando');
    setElegida(null);
    setMenuAbierto(false);
    return true;
  };
  // En el modo de elegir objetivo: tocar a alguien hace la acción contra él (si no llega, se queda esperando otro).
  // Las de varios objetivos van juntando a los tocados hasta que se lanzan.
  const elegirA = (tokenId: string) => {
    if (!eligiendo) return;
    const fila = todasFilas.find((f) => f.clave === eligiendo.clave);
    if (!fila) return setEligiendo(null);
    // Lo que no sirve (lejos, no es aliado, inmune) se dice ahí mismo y se sigue apuntando
    const pista = pistas?.[tokenId];
    if (pista && !pista.valido) return sala.negarLocal(`${estado.tokens[tokenId]?.nombre ?? 'Ese objetivo'}: ${pista.texto}.`);
    const inter = fila.tipo === 'aptitud' ? interaccionDe(fila.aptitud) : null;
    if (inter?.objetivos.tipo === 'varios') {
      const max = inter.objetivos.max;
      return setMarcados((xs) => (xs.includes(tokenId) ? xs.filter((x) => x !== tokenId) : xs.length < max ? [...xs, tokenId] : xs));
    }
    if (inter?.objetivos.tipo === 'area') return;
    const hecho = fila.tipo === 'golpe' ? atacar(fila.golpe.id, eligiendo.numero, tokenId) : usarAptitud(fila.aptitud, tokenId);
    if (hecho) { setEligiendo(null); setSeleccionado(tokenId); }
  };
  const tirarDano = (golpeId: string, critico: boolean, objetivoId?: string) => {
    const golpe = p.golpes.find((g) => g.id === golpeId);
    sala.tirar(p.id, { tipo: 'dano', golpe: golpeId, ...(critico ? { critico } : {}), ...(objetivoId ? { objetivo: objetivoId } : {}) },
      critico ? 'Daño crítico' : 'Daño', golpe ? leerDados(golpe.dados)?.caras : undefined);
  };
  // El daño lo aplica la sala: PG temporales primero, Shield Block si lo usaste, Dying a 0 PG
  const restarPG = (n: number, critico = false, tiradaId?: string) => {
    if (miToken) sala.enviar({ tipo: 'danar', tokenId: miToken.id, cantidad: n, ...(critico ? { critico } : {}), ...(tiradaId ? { tiradaId } : {}) });
  };

  // Lo que pasa en la mesa, convertido en avisos para este personaje: el momento justo de cada aptitud
  const generar = (e: Evento): Aviso[] => {
    const id = () => crypto.randomUUID();
    const nombres = (as: Aptitud[]) => as.map((a) => a.verbo || a.nombre).join(', ');
    if (e.tipo === 'turno') {
      if (!miToken || e.tokenId !== miToken.id) return [];
      const notas: string[] = [];
      const c = estado.combate;
      const caido = condiciones.some((x) => x.clave === 'unconscious' || x.clave === 'dying');
      if (caido) {
        const muriendo = condiciones.find((x) => x.clave === 'dying');
        const heroicos = p.puntosHeroicos ?? 0;
        return [{
          id: id(), tono: 'peligro', titulo: muriendo ? `Estás muriendo (Dying ${muriendo.valor})` : 'Estás inconsciente',
          cuerpo: muriendo
            ? `La mesa tira tu salvación de recuperación. ${heroicos ? 'Puedes gastar tus Hero Points para no morir.' : 'Tus aliados pueden curarte.'}`
            : 'No puedes actuar: termina tu turno. Con curación te despiertas.',
          ...(muriendo && heroicos ? { botones: [{ etiqueta: `Gastar ${heroicos} Hero Point${heroicos === 1 ? '' : 's'} y no morir`, principal: true, hacer: () => sala.heroico('recuperar') }] } : {}),
          dura: 8000,
        }];
      }
      if (c) notas.push(`Tienes ${c.acciones} ${c.acciones === 1 ? 'acción' : 'acciones'} y tu reacción está lista.`);
      for (const cond of condiciones) {
        if (cond.clave === 'dying') notas.push(`Dying ${cond.valor}: tira tu salvación de recuperación (flat check).`);
        if (cond.clave === 'frightened') notas.push(`Frightened ${cond.valor}: baja 1 al terminar este turno.`);
        if (cond.clave === 'slowed' || cond.clave === 'stunned') notas.push(`${CONDICIONES[cond.clave].nombre}: pierdes acciones este turno.`);
      }
      const recordar = aptitudesPara(p, 'inicio-turno');
      if (recordar.length) notas.push(`Recuerda: ${nombres(recordar)}.`);
      return [{ id: 'mi-turno', tono: 'turno', titulo: '¡Tu turno!', cuerpo: <ul className="list-disc pl-4">{notas.map((n) => <li key={n}>{n}</li>)}</ul>, dura: 4500 }];
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
    // Lo que dicen en el chat (si no lo dije yo y no lo estoy mirando)
    if (e.tipo === 'fin-combate') {
      const mios = miToken ? e.quitados[miToken.id] ?? [] : [];
      return [{ id: id(), tono: 'nota', titulo: 'Terminó el combate', cuerpo: mios.length ? `Se te fue lo que duraba solo en la pelea: ${mios.join(', ')}.` : 'Ya puedes moverte libre, descansar o curar heridas.', dura: 7000 }];
    }
    // Lo que te cuenta la mesa (Recall Knowledge): entero y sin "Responder", que no hay a quién
    if (e.tipo === 'chat' && e.mensaje.quien === 'La mesa' && e.mensaje.para === p.id) {
      return [{ id: id(), tono: 'nota', titulo: 'Recuerdas…', cuerpo: e.mensaje.texto, dura: 14000 }];
    }
    if (e.tipo === 'chat') {
      if (e.mensaje.personajeId === p.id || cajon === 'chat' || panelMovil === 'chat') return [];
      return [{
        id: id(), tono: 'nota', titulo: e.mensaje.para ? `${e.mensaje.quien} te susurra` : e.mensaje.quien,
        cuerpo: e.mensaje.texto.length > 140 ? `${e.mensaje.texto.slice(0, 139)}…` : e.mensaje.texto, dura: 7000,
        botones: [{ etiqueta: 'Responder', principal: true, hacer: () => setCajon('chat') }],
      }];
    }
    // El GM hizo descansar al grupo: qué recuperó
    if (e.tipo === 'descanso') {
      return [{
        id: id(), tono: 'bueno', titulo: e.descanso === 'noche' ? 'Durmieron la noche (8 horas)' : 'Descanso corto (10 minutos)',
        cuerpo: e.descanso === 'noche'
          ? 'Recuperas PG, espacios de conjuro y foco; Doomed baja 1 y se va la fatiga.'
          : 'Recuperas 1 punto de foco; si estás a vida completa, se va Wounded.',
        dura: 6000,
      }];
    }
    // Se viene un combate: no hace falta aviso, ya se abre la hoja de preparación con todo
    if (e.tipo === 'preparativo') {
      if (e.tokenId === miToken?.id) return [];
      const quien = estado.tokens[e.tokenId]?.nombre ?? 'Alguien';
      return [{ id: id(), tono: 'bueno', titulo: `${quien} usó ${e.nombre}`, cuerpo: e.ultimo ? 'Va último en lugar de tirar.' : 'Si te alcanza, lo que da ya cuenta en tu iniciativa.', dura: 6000 }];
    }
    // Lo que el motor me aplicó: daño, curación, un efecto
    if (e.tipo === 'dano' || e.tipo === 'curacion' || e.tipo === 'efecto') {
      if (!miToken || e.tokenId !== miToken.id) return [];
      if (e.tipo === 'dano') {
        // De dónde vino: la última tirada contra mí con ese daño (un golpe, un conjuro, el ácido que sigue)
        const fuente = [...estado.tiradas].reverse().slice(0, 8).find((t) => t.objetivo?.tokenId === miToken.id && t.resultado?.dano === e.cantidad);
        const causa = fuente ? (fuente.quien === miToken.nombre ? fuente.etiqueta.split(':')[0]! : `${fuente.quien}: ${fuente.etiqueta}`) : null;
        return [{ id: id(), tono: 'peligro', titulo: e.cayo ? `Recibes ${e.cantidad} de daño y caes` : `Recibes ${e.cantidad} de daño`,
          cuerpo: `${causa ? `${causa}. ` : ''}${e.cayo ? 'Quedas Dying e inconsciente: tus aliados pueden curarte.' : 'Ya está restado de tus PG.'}`, dura: 6000 }];
      }
      if (e.tipo === 'curacion') {
        // Quién: si fue algo tuyo (una poción), "recuperas"; si fue un aliado, su nombre
        const fuente = [...estado.tiradas].reverse().slice(0, 6).find((t) => t.objetivo?.tokenId === miToken.id && t.resultado?.curacion === e.cantidad);
        const propia = !fuente || fuente.quien === miToken.nombre;
        return [{ id: id(), tono: 'bueno', titulo: propia ? `Recuperas ${e.cantidad} PG` : `${fuente!.quien} te cura ${e.cantidad} PG`, cuerpo: 'Ya está sumado.', dura: 5000 }];
      }
      // Lo persistente no cambia tus tiradas: hace daño al terminar cada turno tuyo, hasta que salga un 15 o más
      if (e.persistente) {
        return [{ id: id(), tono: e.quitado ? 'bueno' : 'malo', titulo: e.quitado ? `Se apagó ${e.nombre}` : `Ahora tienes ${e.nombre}`,
          cuerpo: e.quitado ? 'Ya no te hace daño.' : `Al terminar cada turno tuyo te hace ${e.persistente.dano} ${e.persistente.tipo}; con 15 o más en el chequeo plano se apaga. Alguien puede ayudarte a quitártelo.`, dura: 7000 }];
      }
      return [{ id: id(), tono: e.beneficioso ? 'bueno' : 'malo', titulo: e.quitado ? `Se te acabó ${e.nombre}` : `Ahora tienes ${e.nombre}`, cuerpo: e.quitado ? 'Ya no cuenta en tus tiradas.' : 'Ya cuenta en tus tiradas: míralo en tu ficha.', dura: 5000 }];
    }
    if (e.tipo !== 'tirada') return [];
    const t = e.tirada;
    const avisos: Aviso[] = [];
    // Lo que resolvió el motor de interacciones ya está aplicado: solo se cuenta cómo salió
    if (t.resultado) {
      if (t.personajeId === p.id && t.objetivo?.grado) {
        const r = t.resultado;
        const que = [r.dano ? `${r.dano} de daño${r.tipo ? ` ${r.tipo}` : ''}` : null, r.curacion ? `cura ${r.curacion}` : null, r.nota].filter(Boolean).join(' · ');
        const bien = t.objetivo.grado === 'critico' || t.objetivo.grado === 'exito';
        avisos.push({ id: id(), tono: bien ? 'bueno' : 'malo', titulo: `${t.etiqueta} contra ${t.objetivo.nombre}`, cuerpo: que || (bien ? 'Funcionó.' : 'No funcionó.'), dura: 6000 });
      }
      return avisos;
    }
    // Mi ataque: cómo salió y qué sigue
    if (t.personajeId === p.id && t.objetivo?.grado) {
      const golpe = ultimoGolpe.current;
      const conjuro = ultimoConjuro.current;
      const contra = t.objetivo.nombre;
      const objetivoId = t.objetivo.tokenId;
      const tirarSuDano = (critico: boolean) => conjuro?.dano
        ? tirar({ tipo: 'libre', expresion: conjuro.dano, etiqueta: `Daño de ${conjuro.verbo || conjuro.nombre}`, ...(objetivoId ? { objetivo: objetivoId } : {}), ...(critico ? { critico } : {}) })
        : golpe ? tirarDano(golpe, critico, objetivoId) : undefined;
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
        const heroicos = estado.personajes[p.id]?.puntosHeroicos ?? 0;
        avisos.push({
          id: id(), tono: 'malo', titulo: t.objetivo.grado === 'pifia' ? `Pifia contra ${contra}` : `Fallaste contra ${contra}`,
          cuerpo: <>{t.total} contra su defensa.{extra.length > 0 && <> Puedes: {nombres(extra)}.</>}</>, dura: 9000,
          ...(heroicos > 0 && t.dados.length === 1 && t.caras === 20 ? { botones: [{ etiqueta: `Repetir con un Hero Point (tienes ${heroicos})`, principal: true, hacer: () => sala.heroico('repetir', t.id) }] } : {}),
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
        // Con Shield Block puesto, el escudo frena tanto como su Dureza
        const bloquea = miToken.efectos?.some((x) => x.clave === BLOQUEO_ESCUDO) && p.escudo && p.escudo.pgActual > 0 ? p.escudo : null;
        const recibe = bloquea ? Math.max(0, t.total - bloquea.dureza) : t.total;
        if (t.aplicada) return avisos;
        avisos.push({
          // Con el id de la tirada: si el GM ya lo restó, el aviso se cierra solo
          id: `dano-${t.id}`, tono: 'peligro', titulo: `${t.quien} te hace ${t.total} de daño`,
          cuerpo: bloquea ? `${t.etiqueta}. Tu escudo frena ${Math.min(t.total, bloquea.dureza)} (Dureza); recibes ${recibe}, y el escudo también.` : t.etiqueta,
          botones: [{ etiqueta: recibe ? `Restar ${recibe} PG` : 'El escudo lo frena todo', principal: true, hacer: () => restarPG(t.total, /crítico/i.test(t.etiqueta), t.id) }],
        });
      }
    }
    return avisos;
  };
  const { avisos, cerrar: cerrarAviso, agregar: agregarAviso } = useAvisos(sala.eventos, generar);
  // Al terminar mi turno, "¡Tu turno!" ya no corresponde
  useEffect(() => { if (!miTurno) cerrarAviso('mi-turno'); }, [miTurno]); // eslint-disable-line react-hooks/exhaustive-deps
  // El daño que ya restó otro (el GM o el jugador): su aviso se va
  const aplicadas = estado.tiradas.filter((t) => t.aplicada).map((t) => t.id).join(',');
  useEffect(() => { for (const id of aplicadas.split(',')) if (id) cerrarAviso(`dano-${id}`); }, [aplicadas]); // eslint-disable-line react-hooks/exhaustive-deps
  useLlegadas(sala.presentes, p.nombre, agregarAviso);
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

  // Atajos de teclado en pantalla grande: Q W E R D F y 1–4 abren las acciones del turno, Enter las usa, Espacio termina el turno
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      const destino = e.target as HTMLElement;
      // Esc cierra el panel de la derecha, aunque el foco esté en su campo (el chat)
      if (e.key === 'Escape' && cajon && !document.querySelector('[aria-modal]')) { setCajon(null); (document.activeElement as HTMLElement | null)?.blur?.(); return; }
      if (editando || e.ctrlKey || e.metaKey || e.altKey || destino.closest('input, textarea, select, [aria-modal]')) return;
      if (document.querySelector('[aria-modal]')) return;
      const tecla = e.key.toUpperCase();
      const i = TECLAS.indexOf(tecla);
      const ranura = i >= 0 ? ranuras[i] : undefined;
      const panel = CAJONES.find((c) => c.tecla === tecla);
      if (i >= 0) {
        // La tecla usa la acción, como en LoL: si pide objetivo, se elige en el tablero (o va al que ya está elegido).
        // Un atajo vacío abre la ventana para llenarlo; para ver el detalle, se toca el ícono
        if (ranura?.tipo === 'golpe') atacar(ranura.golpe.id, Math.min(ataquesHechos ?? 0, 2) as 0 | 1 | 2, objetivo?.id);
        else if (ranura?.tipo === 'aptitud') usarAptitud(ranura.aptitud, objetivo?.id);
        else setEligiendoAtajo(i);
      } else if (panel) {
        setCajon(cajon === panel.clave ? null : panel.clave);
      } else if (e.key === '?') {
        setAyuda(true);
      } else if (tecla === 'ESCAPE') {
        setElegida(null);
        setEligiendo(null);
      } else if (tecla === 'ENTER' && filaElegida && !destino.closest('button')) {
        const a = acciones(filaElegida);
        if (filaElegida.tipo === 'golpe') a.onAtacar(Math.min(ataquesHechos ?? 0, 2) as 0 | 1 | 2);
        else a.onUsar();
      } else if (e.key === ' ' && miTurno && !destino.closest('button')) {
        e.preventDefault();
        sala.enviar({ tipo: 'avanzar-turno' });
      }
    }
    addEventListener('keydown', alPulsar);
    return () => removeEventListener('keydown', alPulsar);
  });

  // Los seis atajos y cómo cambiarlos: se guardan en la ficha, así siguen al personaje en cualquier dispositivo
  const ranuras = lista[0]?.ranuras ?? [];
  const asignarAtajo = (i: number, clave: string | null) => {
    sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { atajos: ponerAtajo(ranuras, i, clave) } });
  };
  const atajoDe = (f: Fila) => ({
    actual: ranuras.findIndex((r) => r?.clave === f.clave) >= 0 ? ranuras.findIndex((r) => r?.clave === f.clave) : null,
    onAsignar: (i: number) => asignarAtajo(i, f.clave),
  });
  const usarObjeto = (a: Aptitud) => usarAptitud(a);
  // Del compendio a la hoja: conjuros y dotes como aptitudes (las pasivas, a la lista de dotes), objetos a la mochila
  const agregarAptitud = (a: Aptitud) => {
    const actuales = p.aptitudes ?? [];
    if (actuales.some((x) => x.id === a.id)) return sala.negarLocal(`${a.nombre} ya está en tu hoja.`);
    if (actuales.length >= 80) return sala.negarLocal('Tu hoja ya tiene 80 aptitudes: quita alguna primero.');
    sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { aptitudes: [...actuales, a] } });
  };
  const accionesCompendio: AccionesCompendio = {
    onAgregarConjuro: (c) => agregarAptitud(conjuroAAptitud(c)),
    onAgregarDote: (d) => {
      const dotes = p.dotes ?? [];
      if (!dotes.some((x) => x.id === d.id) && dotes.length < 60) {
        sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { dotes: [...dotes, { id: d.id.slice(0, 80), nombre: d.nombre.slice(0, 80), tipo: d.categoria.slice(0, 20), nivel: Math.min(20, Math.max(1, d.nivel ?? 1)) }] } });
      }
      const a = doteAAptitud(d);
      if (a) agregarAptitud(a);
    },
    // A la mochila (lo encontró o se lo dieron); los consumibles llegan con su acción, y el primer escudo queda embrazado
    onAgregarObjeto: (e) => {
      const escudo = !p.escudo && e.escudo ? escudoDe(e) : null;
      sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { ...agregarObjeto(p, objetoDeCompendio(e), consumibleDeCompendio(e)), ...(escudo ? { escudo } : {}) } });
    },
    // Comprarlo: paga con sus monedas
    onComprarObjeto: (e) => {
      const cambios = comprarObjeto(p, objetoDeCompendio(e), consumibleDeCompendio(e), e.precio);
      if (!cambios) { sala.negarLocal(`No te alcanza: ${e.nombre} cuesta ${textoPrecio(e.precio)}.`); return false; }
      const escudo = !p.escudo && e.escudo ? escudoDe(e) : null;
      sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { ...cambios, ...(escudo ? { escudo } : {}) } });
      return true;
    },
  };
  const panelDe = (c: Cajon) => c === 'ficha' ? fichaCompleta
    : c === 'chat' ? <PanelChat estado={estado} quien={sala.quien} onDecir={sala.decir} />
    : c === 'tiradas' ? tiradas
    : c === 'grupo' ? <PanelGrupo estado={estado} presentes={sala.presentes} miId={p.id} />
    : c === 'mochila' ? <PanelMochila p={p} onCambiar={(cambios) => sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios })} onUsar={usarObjeto} onBuscar={() => { setCompendioEn('equipo'); setCajon('compendio'); }} />
    : c === 'compendio' ? <PanelCompendio key={compendioEn} tipoInicial={compendioEn} acciones={accionesCompendio} />
    : c === 'notas' ? (
      <div className="flex h-full flex-col gap-5">
        <ListaHandouts estado={estado} />
        <PanelNotas p={p} onGuardar={(notas) => sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { notas } })} />
      </div>
    )
    : <PanelReglas />;

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
      onPegarCondicion={() => setViendoCondiciones(true)}
    />
  );
  // En su turno: su alcance de movimiento y la línea a su objetivo, dibujados en el tablero
  // En su turno se marcan las casillas a las que llega; fuera de combate se mueve libre
  // Inconsciente no se mueve: ni zona ni "arrástrame"
  const tirado = condiciones.some((c) => c.clave === 'unconscious' || c.clave === 'dying');
  const movimiento = miToken && !eligiendo && !tirado ? (miTurno ? { tokenId: miToken.id, libres: libres ?? 0 } : !combate ? { tokenId: miToken.id, libres: null } : null) : null;
  // El alcance que se ve: el de la acción que espera objetivo, la que está bajo el cursor o la abierta
  const filaRango = todasFilas.find((f) => f.clave === (eligiendo?.clave ?? asomada ?? elegida)) ?? null;
  const alcanceRango = filaRango ? alcanceDe(p, filaRango) : null;
  const rango = miToken && filaRango && alcanceRango?.pies != null
    ? { tokenId: miToken.id, pies: alcanceRango.pies, etiqueta: `${filaRango.nombre} · ${alcanceRango.pies <= 5 ? 'cuerpo a cuerpo' : `${alcanceRango.pies} ft`}` }
    : null;
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
  // Lo que se está por lanzar: su interacción decide si se elige un punto (área), varios o un aliado
  const filaEligiendo = eligiendo ? todasFilas.find((f) => f.clave === eligiendo.clave) ?? null : null;
  const aptitudEligiendo = filaEligiendo?.tipo === 'aptitud' ? filaEligiendo.aptitud : null;
  const interEligiendo = aptitudEligiendo ? interaccionDe(aptitudEligiendo) : null;
  const objetivosEligiendo = interEligiendo?.objetivos;
  const plantilla = miToken && aptitudEligiendo && objetivosEligiendo?.tipo === 'area' && objetivosEligiendo.area.forma !== 'emanacion'
    ? {
      tokenId: miToken.id, area: objetivosEligiendo.area, etiqueta: aptitudEligiendo.verbo || aptitudEligiendo.nombre,
      ...(aptitudEligiendo.distancia ? { alcance: aptitudEligiendo.distancia } : {}),
      ...(objetivosEligiendo.aliados ? { aliados: true } : {}), ...(objetivosEligiendo.soloOtros ? { soloOtros: true } : {}),
      color: tintaDe(interEligiendo?.dano ? ASPECTO_POR_DANO[interEligiendo.dano.tipo] : 'bendicion', interEligiendo?.dano?.tipo),
    }
    : null;
  // Mientras se apunta a alguien (no a un área): sobre cada token, si sirve y qué se tira contra él
  const pistas: Record<string, Pista> | null = (() => {
    if (!eligiendo || !miToken || !filaEligiendo || objetivosEligiendo?.tipo === 'area') return null;
    const distancia = filaEligiendo.tipo === 'golpe' ? filaEligiendo.golpe.distancia ?? 5 : alcanceDe(p, filaEligiendo)?.pies ?? undefined;
    const inter = filaEligiendo.tipo === 'golpe' ? { modo: { tipo: 'ataque' as const }, objetivos: { tipo: 'uno' as const } } : interEligiendo;
    const salen: Record<string, Pista> = {};
    for (const t of Object.values(estado.tokens)) {
      const pista = pistaObjetivo(estado, miToken, aptitudEligiendo, inter, t, distancia);
      // Sobre uno mismo solo se dice algo si sirve (curarse, ayudarse). Lo que daña: sobre los aliados no se dice nada
      // (se pueden tocar igual), así las etiquetas de los enemigos no se pisan con las del grupo
      const dana = filaEligiendo.tipo === 'golpe' || (!!inter && (!!inter.dano || inter.modo.tipo !== 'ninguna') && !inter.curacion && !inter.efecto?.beneficioso);
      const aliado = !!t.personajeId || t.tipo === 'personaje';
      if (dana && aliado && t.id !== miToken.id) continue;
      if (t.id !== miToken.id || pista.valido) salen[t.id] = pista;
    }
    return salen;
  })();
  // La niebla como la manda la sala: lo que el grupo ve ahora y lo ya explorado
  const { columnas, filas, visibles: mascaraVisibles, exploradas: mascaraExploradas } = estado.mapa;
  const niebla = useMemo(() => (visionActiva(estado.mapa) && mascaraVisibles
    ? { visibles: deMascara(mascaraVisibles, columnas, filas), exploradas: deMascara(mascaraExploradas, columnas, filas), opaca: true }
    : null), [mascaraVisibles, mascaraExploradas, columnas, filas, estado.mapa.niebla]);
  // Lo que el grupo ve apagado (penumbra sin low-light, u oscuridad vista con darkvision)
  const mascaraPenumbra = estado.mapa.penumbra;
  const oscuridad = useMemo(() => {
    if (!mascaraPenumbra) return null;
    const penumbra = deMascara(mascaraPenumbra, columnas, filas);
    return penumbra.size ? (k: string) => (penumbra.has(k) ? 0.32 : 0) : null;
  }, [mascaraPenumbra, columnas, filas]);
  const lanzarA = (punto?: { x: number; y: number }) => {
    if (!aptitudEligiendo) return;
    if (usarAptitud(aptitudEligiendo, undefined, punto ? { punto } : { objetivos: marcados })) { setEligiendo(null); setMarcados([]); }
  };
  const confirmar = objetivosEligiendo?.tipo === 'varios'
    ? { etiqueta: marcados.length ? `Lanzar a ${marcados.length}` : 'Toca a quiénes', hacer: () => lanzarA(), deshabilitado: marcados.length === 0 }
    : undefined;
  const textoElegir = objetivosEligiendo?.tipo === 'area'
    ? (plantilla?.area.forma === 'explosion' ? 'Mueve el área y toca dónde estalla.' : 'Apunta hacia dónde sale y toca para lanzarla.')
    : objetivosEligiendo?.tipo === 'varios' ? `Toca hasta ${objetivosEligiendo.max} objetivos y lánzalo.`
    : objetivosEligiendo?.tipo === 'uno' && objetivosEligiendo.aliados ? 'Toca a un aliado (o a ti).' : undefined;
  const tiradas = (
    <div className="flex flex-col gap-4">
      <TiradaLibre esGM={false} objetivo={objetivo} onTirar={tirar} />
      <ListaTiradas tiradas={estado.tiradas} verCd={false} mio={miToken?.id} />
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
      menu={eligiendo ? null : menu}
      rango={rango}
      enfocar={enfoque}
      seguir={miToken?.id}
      presencia={{ punteros: Object.values(sala.punteros), senales: sala.senales }}
      onPuntero={sala.moverPuntero}
      onMedir={sala.medir}
      onSenal={sala.senalar}
      onNegar={sala.negarLocal}
      seleccionado={seleccionado}
      onSeleccionar={(id) => {
        const puedeASiMismo = objetivosEligiendo?.tipo !== 'area' && !!objetivosEligiendo && 'aliados' in objetivosEligiendo && !!objetivosEligiendo.aliados;
        if (eligiendo) return id && (id !== miToken?.id || puedeASiMismo) ? elegirA(id) : undefined;
        setSeleccionado(id);
        setMenuAbierto(!!id && id !== miToken?.id);
      }}
      onMover={(id, x, y) => sala.mover(id, x, y)}
      plantilla={plantilla}
      onPunto={(c) => lanzarA(c)}
      marcados={objetivosEligiendo?.tipo === 'varios' ? marcados : []}
      pistas={pistas}
      niebla={niebla}
      oscuridad={oscuridad}
      onPuerta={sala.puerta}
    />
  );

  const contexto: Contexto = {
    estado, combate, miToken, miTurno, enTurno, p, sala, ficha, onEditar: () => setEditando(true), onCondiciones: () => setViendoCondiciones(true),
    onSubirNivel: () => setSubiendoNivel(true),
  };

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ ['--alto-hoja' as string]: `${altoHoja}px` }}>
      <Cabecera salaId={salaId} sala={sala} tema={tema} onAyuda={() => setAyuda(true)} />

      {/* Pantalla grande: tablero + página apoyada encima */}
      <div className="relative hidden min-h-0 flex-1 overflow-hidden lg:block">
        {tablero(altoHoja + 20)}
        {estado.telon && <Telon />}
        {combate && <OrdenEscrito estado={estado} combate={combate} conPanel={!!cajon} onEnfocar={(tokenId) => setEnfoque((x) => ({ tokenId, n: (x?.n ?? 0) + 1 }))} />}
        {eligiendo && filaRango && <BandaElegir fila={filaRango} rango={rango} texto={textoElegir} confirmar={confirmar} onCancelar={() => { setEligiendo(null); setMarcados([]); }} className="bottom-[calc(var(--alto-hoja)+22px)]" />}
        {!filaElegida && avisos.length === 0 && <MargenTiradas estado={estado} onVerTodas={() => setCajon('tiradas')} p={p} onRepetir={(id) => sala.heroico('repetir', id)} />}
        {/* Los compañeros en miniatura, a la izquierda; los botones de paneles se corren a su lado */}
        <div className="pointer-events-none absolute top-[96px] bottom-[calc(var(--alto-hoja)+34px)] left-3 z-20 flex gap-2">
          <Companeros estado={estado} presentes={sala.presentes} excluir={p.id} className="pointer-events-auto max-h-full overflow-hidden"
            onEnfocar={(tokenId) => setEnfoque((x) => ({ tokenId, n: (x?.n ?? 0) + 1 }))} />
          <Botonera actual={cajon} onAbrir={(c) => setCajon(cajon === c ? null : c)}>
            <BarraEstados efectos={efectos} condiciones={condiciones} onCondiciones={() => setViendoCondiciones(true)}
              onQuitarEfecto={(efectoId) => miToken && sala.enviar({ tipo: 'quitar-efecto', tokenId: miToken.id, efectoId })} />
          </Botonera>
        </div>

        <section ref={hojaRef} aria-label={`Página de ${p.nombre}`} className="hoja absolute inset-x-5 bottom-4 z-10">
          <button className="absolute -top-9 right-6 flex h-9 items-center gap-1.5 rounded-t-lg bg-superficie px-3 font-titulo text-[13px] text-texto-suave shadow-[0_-4px_10px_-6px_var(--sombra)] hover:text-acento"
            onClick={() => setPlegada(!plegada)} aria-expanded={!plegada}>
            {plegada ? <CaretUpIcon size={16} aria-hidden /> : <CaretDownIcon size={16} aria-hidden />}
            {plegada ? 'Mostrar mi hoja' : 'Bajar la hoja'}
          </button>
          {plegada ? (
            <div className="grid grid-cols-[260px_minmax(0,1fr)_minmax(200px,300px)] items-center xl:grid-cols-[290px_minmax(0,1fr)_minmax(220px,340px)]">
              <ColumnaQuien compacta contexto={contexto} onAbrirFicha={() => setCajon('ficha')} />
              <div className="flex min-w-0 items-center border-x border-dashed border-borde px-5 py-2.5">
                <BarraHabilidades incrustada ranuras={ranuras} teclas={TECLAS} libres={libres} elegida={elegida}
                  alcanceDe={(f) => alcanceDe(p, f)?.pies ?? null}
                  onElegir={(f) => { setElegida(elegida === f.clave ? null : f.clave); setPlegada(false); }}
                  onAsignar={asignarAtajo} onAsomar={(f) => setAsomada(f?.clave ?? null)} />
              </div>
              <CondicionesCompactas contexto={contexto} condiciones={condiciones} />
            </div>
          ) : (
          <div className="grid grid-cols-[270px_minmax(0,1fr)_240px] xl:grid-cols-[310px_minmax(0,1fr)_270px]">
            <ColumnaQuien contexto={contexto} onAbrirFicha={() => setCajon('ficha')} />

            <div className="relative flex min-w-0 flex-col border-x border-dashed border-borde px-5 pt-3 pb-3">
              <CabeceraTurno contexto={contexto} />
              <div className="mt-2 mb-1 flex items-end gap-4">
                <BarraHabilidades incrustada ranuras={ranuras} teclas={TECLAS} libres={libres} elegida={elegida}
                  alcanceDe={(f) => alcanceDe(p, f)?.pies ?? null}
                  onElegir={(f) => { setElegida(elegida === f.clave ? null : f.clave); setPlegada(false); }}
                  onAsignar={asignarAtajo} onAsomar={(f) => setAsomada(f?.clave ?? null)} />
                <p className="hidden max-w-[190px] shrink pb-1 font-titulo text-[12.5px] leading-snug text-texto-suave 2xl:block">
                  Arrastra acciones de las pestañas a la barra; sácalas arrastrándolas afuera.
                </p>
              </div>
              <Pestanas lista={lista.filter((s) => s.id !== 'turno')} activa={seccionActiva} onCambiar={(id) => { setSeccionActiva(id); setElegida(null); }} />
              {/* La lista llena lo que dejan las columnas de los lados (no estira la hoja); en pantallas anchas, en dos columnas */}
              <div className="mt-1 min-h-[76px] flex-1 basis-0 overflow-y-auto pr-1">
                {lista.filter((s) => s.id === seccionActiva).map((s) => (
                  <div key={s.id}>
                    {s.resumen && <p className="px-1.5 pt-1 font-titulo text-[13px] text-texto-suave">{s.resumen}</p>}
                    {s.id === 'turno' ? (
                      <ListaAtajos seccion={s} elegida={elegida} marcada={marcada} libres={libres}
                        onElegir={(f) => setElegida(elegida === f.clave ? null : f.clave)} onAsomar={(f) => setAsomada(f?.clave ?? null)}
                        onCambiar={setEligiendoAtajo} />
                    ) : (
                      <ListaAcciones seccion={s} elegida={elegida} marcada={marcada} libres={libres} arrastrable enColumnas alcance={(f) => alcanceDe(p, f)?.pies ?? null}
                        onElegir={(f) => setElegida(elegida === f.clave ? null : f.clave)} onAsomar={(f) => setAsomada(f?.clave ?? null)} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <ColumnaLado contexto={contexto} condiciones={condiciones} />
          </div>
          )}
          {filaElegida && !plegada && (
            // Sobre la lista de la que salió (no a la derecha, donde caen los avisos), con su propio scroll si es larga
            <div className="tarjeta absolute bottom-[calc(100%+14px)] left-[300px] z-20 max-h-[calc(100vh-var(--alto-hoja)-96px)] w-[400px] overflow-y-auto px-4 py-3.5 xl:left-[320px]">
              <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-16 -translate-x-1/2 -rotate-2 bg-[var(--cinta)]" />
              <Detalle fila={filaElegida} ataquesHechos={ataquesHechos} libres={libres} objetivo={objetivo} enCombate={!!combate} antes={filasAlAtacar} onAbrir={setElegida}
                dano={filaElegida.tipo === 'golpe' ? ficha.golpes[filaElegida.indice]?.dano ?? null : null}
                acciones={acciones(filaElegida)} atajo={atajoDe(filaElegida)} />
            </div>
          )}
        </section>

        {/* El panel de la derecha termina donde empieza la hoja: no la tapa */}
        {cajon && (
          <aside className="absolute top-0 right-0 bottom-[calc(var(--alto-hoja)+28px)] z-30 flex w-[440px] max-w-[45vw] flex-col rounded-bl-xl border-b border-l border-borde bg-fondo shadow-[-20px_0_40px_-20px_var(--sombra)]">
            <div className="flex items-center gap-2 px-4 pt-3">
              <h2 className="flex min-w-0 items-center gap-2 font-titulo text-[22px] font-bold text-acento">
                {iconoCajon(cajon, 22)}<span className="truncate">{CAJONES.find((c) => c.clave === cajon)?.nombre}</span>
              </h2>
              <button className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={() => setCajon(null)} aria-label="Cerrar">
                <XIcon size={18} aria-hidden />
              </button>
            </div>
            <nav aria-label="Paneles" className="flex gap-1 border-b border-dashed border-borde px-3 pt-1 pb-2">
              {CAJONES.map((c) => (
                <button key={c.clave} onClick={() => setCajon(c.clave)} aria-pressed={cajon === c.clave} aria-label={c.nombre}
                  title={`${c.nombre}${c.tecla ? ` (${c.tecla})` : ''}`}
                  className={`flex size-10 items-center justify-center rounded-lg transition ${cajon === c.clave ? 'bg-acento/12 text-acento' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'}`}>
                  {iconoCajon(c.clave, 20)}
                </button>
              ))}
            </nav>
            <div className="flex-1 overflow-y-auto p-4">{panelDe(cajon)}</div>
          </aside>
        )}
      </div>

      {/* Teléfono: la página es el mando */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className={`relative min-h-0 flex-1 ${pestana === 'tablero' ? 'block' : 'hidden'}`}>
          {tablero(0)}
          {estado.telon && <Telon />}
          {combate && <OrdenEscrito estado={estado} combate={combate} onEnfocar={(tokenId) => setEnfoque((x) => ({ tokenId, n: (x?.n ?? 0) + 1 }))} />}
          {eligiendo && filaRango && <BandaElegir fila={filaRango} rango={rango} texto={textoElegir} confirmar={confirmar} onCancelar={() => { setEligiendo(null); setMarcados([]); setPestana('turno'); }} className="bottom-3" />}
        </div>
        {pestana === 'turno' && (
          <TurnoMovil contexto={contexto} condiciones={condiciones} lista={lista} elegida={elegida} marcada={marcada} libres={libres}
            companeros={<Companeros horizontal estado={estado} presentes={sala.presentes} excluir={p.id} className="flex-wrap"
              onEnfocar={(tokenId) => { setPestana('tablero'); setEnfoque((x) => ({ tokenId, n: (x?.n ?? 0) + 1 })); }} />}
            onElegir={(f) => setElegida(elegida === f.clave ? null : f.clave)}
            detalle={(f) => (
              <Detalle fila={f} ataquesHechos={ataquesHechos} libres={libres} objetivo={objetivo} enCombate={!!combate} antes={filasAlAtacar} onAbrir={setElegida}
                dano={f.tipo === 'golpe' ? ficha.golpes[f.indice]?.dano ?? null : null} acciones={acciones(f)} atajo={atajoDe(f)} />
            )} />
        )}
        {pestana === 'ficha' && <div className="flex-1 overflow-y-auto p-4">{fichaCompleta}</div>}
        {pestana === 'tiradas' && <div className="flex-1 overflow-y-auto p-4">{tiradas}</div>}
        <nav className="grid grid-cols-5 border-t border-dashed border-borde bg-fondo/95 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
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
          <button onClick={() => setMasAbierto(true)} aria-haspopup="dialog"
            className="flex flex-col items-center gap-0.5 py-1 font-titulo text-[12.5px] text-texto-suave">
            <DotsThreeOutlineIcon size={23} aria-hidden />
            Más
          </button>
        </nav>
      </div>

      {masAbierto && (
        <Modal titulo="Más cosas" subtitulo="Para consultar sin salir de la mesa." onCerrar={() => setMasAbierto(false)}>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              ['chat', 'Chat', 'Habla con la mesa o susurra al GM', <ChatCircleDotsIcon key="i" size={26} aria-hidden />],
              ['grupo', 'Grupo', 'Cómo están tus aliados', <UsersThreeIcon key="i" size={26} aria-hidden />],
              ['mochila', 'Mochila', 'Objetos, monedas, pociones', <BackpackIcon key="i" size={26} aria-hidden />],
              ['notas', 'Notas', 'Lo que no quieres olvidar', <NotePencilIcon key="i" size={26} aria-hidden />],
              ['compendio', 'Compendio', 'Todo Pathfinder: conjuros, dotes, objetos', <BooksIcon key="i" size={26} aria-hidden />],
              ['reglas', 'Reglas', 'Condiciones y acciones', <BookOpenTextIcon key="i" size={26} aria-hidden />],
            ] as const).map(([clave, nombre, ayuda, icono]) => (
              <button key={clave} className="flex flex-col items-start gap-1 rounded-lg border-[1.5px] border-borde bg-superficie p-3 text-left hover:border-acento"
                onClick={() => { setMasAbierto(false); setPanelMovil(clave); }}>
                <span className="text-acento">{icono}</span>
                <b className="font-titulo text-[17px]">{nombre}</b>
                <span className="text-[12.5px] text-texto-suave">{ayuda}</span>
              </button>
            ))}
            <button className="flex flex-col items-start gap-1 rounded-lg border-[1.5px] border-borde bg-superficie p-3 text-left hover:border-acento"
              onClick={() => { setMasAbierto(false); setEligiendoAtajo(0); }}>
              <span className="text-acento"><PencilSimpleIcon size={26} aria-hidden /></span>
              <b className="font-titulo text-[17px]">Atajos</b>
              <span className="text-[12.5px] text-texto-suave">Elige qué va primero en tu turno</span>
            </button>
          </div>
        </Modal>
      )}
      {panelMovil && (
        <Modal titulo={CAJONES.find((c) => c.clave === panelMovil)!.nombre} onCerrar={() => setPanelMovil(null)}>
          {panelDe(panelMovil)}
        </Modal>
      )}
      {ayuda && <AyudaTeclas onCerrar={() => setAyuda(false)} />}
      {lanzando && (
        <ElegirRango a={lanzando.a} nivel={p.nivel} rangos={rangosLibres(lanzando.a)} espacios={recursosDe(p).espacios}
          onCerrar={() => setLanzando(null)}
          onElegir={(rango) => { sala.usar(lanzando.a.id, lanzando.objetivo, lanzando.etiqueta, { ...lanzando.mas, rango }); setLanzando(null); }} />
      )}
      {curando && miToken && (
        <ElegirCurar p={p} medicina={ficha.habilidades.medicine.total} inicial={curando}
          candidatos={Object.values(estado.tokens)
            // Fuera de combate, todo el grupo (hay 10 minutos para ir hasta él); en combate, los que están a tu lado
            .filter((t) => t.personajeId && estado.personajes[t.personajeId] && (t.id === miToken.id || !combate || !motivoAlcance(miToken, t, 5)))
            .map((t) => {
              const x = estado.personajes[t.personajeId!]!;
              return { id: t.id, nombre: `${t.id === miToken.id ? `${t.nombre} (tú)` : t.nombre} · ${x.pgActual}/${calcular(x).pgMax.total}` };
            })}
          onCerrar={() => setCurando(null)}
          onElegir={(objetivoId, nivel) => {
            sala.usar('basica:treat-wounds', objetivoId === miToken.id ? undefined : objetivoId, 'Curando heridas', { nivel });
            setCurando(null);
          }} />
      )}
      {viendoCondiciones && (
        <ModalCondiciones condiciones={condiciones} onCerrar={() => setViendoCondiciones(false)}
          onPoner={(clave, valor) => miToken && sala.enviar({ tipo: 'poner-condicion', tokenId: miToken.id, clave, valor: Math.max(0, valor) })} />
      )}
      {eligiendoAtajo !== null && (
        <ElegirAtajo ranura={eligiendoAtajo} lista={lista} ranuras={ranuras}
          onElegir={(clave) => { asignarAtajo(eligiendoAtajo, clave); setEligiendoAtajo(null); }}
          onCerrar={() => setEligiendoAtajo(null)} />
      )}

      {/* Se viene un combate: la hoja de preparación; al empezar, el orden de juego */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[78px] z-30 flex flex-col items-center gap-2 px-4 lg:bottom-auto lg:top-[64px]">
        {miToken && (
          <PreparacionJugador estado={estado} p={p} token={miToken} className="max-h-[calc(100dvh-170px)] overflow-y-auto"
            onElegir={(clave) => sala.enviar({ tipo: 'elegir-iniciativa', tokenId: miToken.id, clave })}
            onListo={(listo) => sala.enviar({ tipo: 'marcar-listo', tokenId: miToken.id, listo })}
            onUsar={(a) => usarAptitud(a)} />
        )}
        <OrdenRevelado estado={estado} eventos={sala.eventos} miTokenId={miToken?.id} className="lg:mt-14 lg:ml-[180px] lg:self-start" />
      </div>

      <TituloEscena eventos={sala.eventos} />
      <HandoutRecibido estado={estado} eventos={sala.eventos} />
      <AvisoTirada tiradas={estado.tiradas} verCd={false} mio={miToken?.id} pendiente={sala.pendiente}
        lugar="bottom-[156px] lg:inset-x-auto lg:right-6 lg:bottom-[calc(var(--alto-hoja)+40px)]" />

      {/* Avisos del momento: arriba a la derecha en PC, arriba en el teléfono */}
      <PilaAvisos avisos={avisos} onCerrar={cerrarAviso}
        className={`fixed inset-x-3 top-[60px] z-[60] lg:inset-x-auto lg:w-[340px] ${combate ? 'lg:top-[118px]' : 'lg:top-[72px]'} ${cajon ? 'lg:right-[464px]' : 'lg:right-6'}`} />
      {esperaAjena && (
        <div className="fixed inset-x-0 top-[60px] z-30 flex justify-center px-4" role="status">
          <p className="tarjeta px-4 py-2 font-titulo text-[15px]">
            Esperando a que {estado.tokens[esperaAjena.objetivoTokenId]?.nombre ?? 'tu objetivo'} decida si reacciona…
          </p>
        </div>
      )}
      {editando && <EditarPersonaje salaId={salaId} sala={sala} personaje={p} onCerrar={() => setEditando(false)} />}
      {subiendoNivel && (
        <SubirNivel p={p} otros={Object.values(estado.personajes).filter((x) => x.id !== p.id)} onCerrar={() => setSubiendoNivel(false)}
          onSubir={(nuevo) => { const { id: _id, ...cambios } = nuevo; sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios }); }} />
      )}
      {miEspera && (
        <PanelEspera espera={miEspera} aptitudes={todasLasAptitudes(p).filter((a) => miEspera.aptitudes.includes(a.id))}
          onResponder={(aptitudId) => sala.responder(miEspera.id, aptitudId)} />
      )}
    </div>
  );
}

// "Tu turno": los seis atajos. Los vacíos invitan a elegir; cada uno se cambia con el lápiz.
function ListaAtajos({ seccion, elegida, marcada, libres, onElegir, onAsomar, onCambiar }: {
  seccion: Seccion;
  elegida: string | null;
  marcada: string | null;
  libres: number | null;
  onElegir: (f: Fila) => void;
  onAsomar: (f: Fila | null) => void;
  onCambiar: (i: number) => void;
}) {
  return (
    <ul className="flex flex-col">
      {(seccion.ranuras ?? []).map((f, i) => (
        <li key={i} className="group/atajo relative flex items-center">
          {f ? (
            <>
              <div className="min-w-0 flex-1">
                <ListaAcciones seccion={{ ...seccion, filas: [f] }} elegida={elegida} marcada={marcada} teclas={[TECLAS[i]!]} libres={libres} arrastrable
                  onElegir={onElegir} onAsomar={onAsomar} />
              </div>
              <button onClick={() => onCambiar(i)} aria-label={`Cambiar el atajo ${TECLAS[i]}`} title={`Cambiar qué va en ${TECLAS[i]}`}
                className="absolute top-1/2 -right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-md bg-superficie text-texto-suave opacity-0 shadow-sm transition group-hover/atajo:opacity-100 hover:text-acento focus-visible:opacity-100">
                <PencilSimpleIcon size={15} aria-hidden />
              </button>
            </>
          ) : (
            <button onClick={() => onCambiar(i)}
              className="flex min-h-[34px] w-full items-center gap-2 border-b border-dashed border-borde px-1 text-left font-titulo text-[14.5px] text-texto-suave transition hover:bg-acento/[0.06] hover:text-acento">
              <span className="flex w-[52px] justify-center"><Tecla>{TECLAS[i]}</Tecla></span>
              Vacío · elige qué va aquí
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// Los paneles de consulta, como pestañas de índice pegadas al borde izquierdo del tablero
function iconoCajon(c: Cajon, size: number): ReactNode {
  const props = { size, 'aria-hidden': true } as const;
  switch (c) {
    case 'ficha': return <NotebookIcon {...props} />;
    case 'chat': return <ChatCircleDotsIcon {...props} />;
    case 'grupo': return <UsersThreeIcon {...props} />;
    case 'mochila': return <BackpackIcon {...props} />;
    case 'notas': return <NotePencilIcon {...props} />;
    case 'compendio': return <BooksIcon {...props} />;
    case 'tiradas': return <DiceFiveIcon {...props} />;
    case 'reglas': return <BookOpenTextIcon {...props} />;
  }
}

// El menú de paneles: una columna que se corta donde empieza la hoja; si no cabe, sigue en una segunda.
// En pantallas altas los botones llevan su nombre; si no, solo el icono (el nombre sale al pasar el cursor)
function Botonera({ actual, onAbrir, children }: { actual: Cajon | null; onAbrir: (c: Cajon) => void; children?: ReactNode }) {
  return (
    <nav aria-label="Paneles" className="flex max-h-full flex-col flex-wrap content-start items-start gap-1.5">
      {CAJONES.map((c) => (
        <button key={c.clave} onClick={() => onAbrir(c.clave)} aria-pressed={actual === c.clave} aria-label={c.nombre} title={`${c.nombre}${c.tecla ? ` (${c.tecla})` : ''}`}
          className={`pointer-events-auto group flex h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-2.5 font-titulo text-[14px] shadow-[0_4px_10px_-6px_var(--sombra)] transition [@media(min-height:900px)]:justify-start ${actual === c.clave ? 'border-acento bg-acento text-sobre-acento' : 'border-borde bg-superficie text-texto hover:border-acento hover:text-acento'}`}>
          {iconoCajon(c.clave, 20)}
          <span className="hidden [@media(min-height:900px)]:inline">{c.nombre}</span>
          {c.tecla && <span className="ml-0.5 hidden xl:[@media(min-height:900px)]:inline"><Tecla sobreTinta={actual === c.clave}>{c.tecla}</Tecla></span>}
        </button>
      ))}
      <div className="pointer-events-auto">{children}</div>
    </nav>
  );
}

// "Elige a quién": mientras una acción espera su objetivo, una banda sobre el tablero lo dice y deja cancelar
export function BandaElegir({ fila, rango, onCancelar, className, texto, confirmar }: {
  fila: Pick<Fila, 'nombre'>;
  rango: { pies: number } | null;
  onCancelar: () => void;
  className: string;
  // Lo que se lee abajo, si no es "toca un token" (las áreas, los de varios objetivos)
  texto?: string;
  // Para lo de varios objetivos: lanzarlo a los ya tocados
  confirmar?: { etiqueta: string; hacer: () => void; deshabilitado: boolean };
}) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-3 ${className}`} role="status">
      <div className="tarjeta pointer-events-auto flex items-center gap-3 py-2 pr-2 pl-4">
        <CrosshairIcon size={22} weight="bold" className="shrink-0 text-peligro" aria-hidden />
        <p className="font-titulo text-[15px] leading-tight">
          <b>{texto ? 'Elige' : 'Elige a quién'}</b> · {fila.nombre}
          <span className="block text-[13px] text-texto-suave">
            {texto ?? (rango ? `Llegas a ${rango.pies <= 5 ? 'lo que está a tu lado' : `${rango.pies} ft`}: lo marcado con anillo.` : 'Toca un token.')}
          </span>
        </p>
        {confirmar && (
          <button className="boli h-9 bg-acento px-3 font-titulo text-[14px] font-bold text-sobre-acento disabled:opacity-45" disabled={confirmar.deshabilitado} onClick={confirmar.hacer}>
            {confirmar.etiqueta}
          </button>
        )}
        <button className="boli h-9 border-[1.5px] border-borde px-3 font-titulo text-[14px] text-texto-suave hover:text-texto" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
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
  // Abre el editor del personaje (al tocar su retrato)
  onEditar: () => void;
  // Abre la ventana para poner o quitar condiciones
  onCondiciones: () => void;
  // Abre la ventana de subir de nivel
  onSubirNivel: () => void;
}

export function Cabecera({ salaId, sala, tema, onAyuda, extra, textoSalir = 'Para volver vas a necesitar el código de tu personaje.' }: {
  salaId: string;
  sala: Sala;
  tema: Tema;
  onAyuda: () => void;
  // Botones propios de quien mira (el GM: sus códigos)
  extra?: ReactNode;
  textoSalir?: string;
}) {
  const confirmar = useConfirmar();
  return (
    <>
    {confirmar.ventana}
    <header className="relative z-20 flex items-center gap-3 border-b border-dashed border-borde bg-fondo px-4 py-2 lg:px-6">
      <a href="/" className="font-titulo text-[22px] font-bold text-acento">Wayforge</a>
      <span className="hidden font-titulo text-sm text-texto-suave sm:inline">mesa {salaId.toUpperCase()}</span>
      <span className={`size-2 shrink-0 rounded-full ${sala.conectado ? 'bg-exito' : 'bg-peligro'}`} title={sala.conectado ? 'Conectado' : 'Reconectando…'} />
      {!sala.conectado && <span className="font-titulo text-sm text-peligro">reconectando…</span>}
      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-texto-suave" title={[...new Set(sala.presentes.map((x) => x.nombre))].join(', ')}>
          <UsersIcon size={18} aria-hidden />
          <span className="hidden md:inline">{[...new Set(sala.presentes.map((x) => x.nombre))].join(', ')}</span>
          <span className="md:hidden">{new Set(sala.presentes.map((x) => x.nombre)).size}</span>
        </span>
        {extra}
        <button className="hidden size-10 items-center justify-center rounded-lg border border-borde bg-superficie transition hover:bg-superficie-2 lg:flex"
          onClick={onAyuda} aria-label="Atajos de teclado" title="Atajos de teclado (?)">
          <QuestionIcon size={19} aria-hidden />
        </button>
        <BotonTema tema={tema} />
        <button className="flex h-10 items-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm transition hover:bg-superficie-2"
          onClick={() => confirmar.pedir({ titulo: '¿Salir de la mesa?', texto: textoSalir, si: 'Salir', peligro: true, hacer: sala.salir })}>
          <SignOutIcon size={18} aria-hidden />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
    </>
  );
}

// Orden de turnos escrito a mano arriba del tablero: los que ya jugaron, tachados; el actual, con marcatextos
// En pantalla grande va entre los botones del tablero y el panel de la derecha (si está abierto): no los tapa
export function OrdenEscrito({ estado, combate, onEnfocar, conPanel = false }: { estado: EstadoSala; combate: Combate; onEnfocar: (tokenId: string) => void; conPanel?: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4 lg:right-4 lg:left-[296px] lg:px-0 ${conPanel ? 'lg:right-[456px]' : ''}`}>
    <ol className="pointer-events-auto flex max-w-full items-baseline gap-x-5 gap-y-1 overflow-x-auto rounded-sm bg-fondo/90 px-4 py-1.5 font-titulo text-[16px] shadow-[0_6px_16px_-10px_var(--sombra)]"
      aria-label={`Orden de iniciativa, ronda ${combate.ronda}`}>
      <li className="shrink-0 text-[14px] text-texto-suave">ronda {combate.ronda}:</li>
      {combate.orden.map((c, i) => {
        const t = estado.tokens[c.tokenId];
        if (!t) return null;
        const ahora = i === combate.turno;
        const hecho = i < combate.turno;
        const enemigo = !t.personajeId;
        const espera = (combate.demorados ?? []).includes(c.tokenId);
        const llega = !!c.desde && c.desde > combate.ronda;
        return (
          <li key={c.tokenId} className="shrink-0">
            <button onClick={() => onEnfocar(c.tokenId)} title={`Ver a ${t.nombre} en el tablero`}
              className={`whitespace-nowrap rounded-sm px-0.5 transition hover:underline hover:decoration-dotted ${ahora ? 'marcatextos font-bold' : espera || llega ? 'text-texto-suave italic' : hecho ? 'text-texto-suave line-through decoration-[1.5px]' : enemigo ? 'text-peligro' : ''}`}>
              {t.nombre}<span className={`ml-1 text-[12.5px] ${ahora ? 'text-sobre-marca' : 'text-texto-suave'}`}>{espera ? 'espera' : llega ? `ronda ${c.desde}` : Math.round(c.iniciativa)}</span>
            </button>
          </li>
        );
      })}
    </ol>
    </div>
  );
}

// Las últimas tiradas, como notas al margen derecho
function MargenTiradas({ estado, onVerTodas, p, onRepetir }: { estado: EstadoSala; onVerTodas: () => void; p?: Personaje; onRepetir?: (id: string) => void }) {
  const ultimas = estado.tiradas.slice(-3).reverse();
  // La tirada propia que se puede repetir con un Hero Point: la última de un d20 que no resolvió el motor
  const repetible = p && (p.puntosHeroicos ?? 0) > 0
    ? estado.tiradas.slice(-12).reverse().find((t) => t.personajeId === p.id && t.dados.length === 1 && t.caras === 20 && !t.resultado)?.id
    : undefined;
  if (ultimas.length === 0) return null;
  return (
    // En pantallas medianas (una tableta apaisada) taparía el tablero: ahí las tiradas están en su panel
    <aside className="absolute top-16 right-6 z-10 hidden w-[260px] font-titulo xl:block">
      <h2 className="mb-1 text-[15px] font-semibold text-texto-suave">Últimas tiradas</h2>
      <ul>
        {ultimas.map((t) => (
          <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 border-b-[1.5px] border-dashed border-borde py-1.5">
            <span className="truncate text-[14.5px]">{t.quien} · {t.etiqueta}</span>
            <b className="row-span-2 text-[28px] leading-none text-acento">
              {t.total}
              {t.id === repetible && onRepetir && (
                <button onClick={() => onRepetir(t.id)} title="Repetir con un Hero Point (vale la nueva)" aria-label="Repetir con un Hero Point"
                  className="ml-1 inline-flex size-6 translate-y-[-4px] items-center justify-center rounded-full border border-[#c48a16] align-middle text-[#c48a16] hover:bg-[#c48a16]/10">
                  <MedalIcon size={13} weight="fill" aria-hidden />
                </button>
              )}
            </b>
            <small className="truncate text-[12.5px] text-texto-suave">
              {textoTirada(t)}
              {/* Solo los ataques tienen grado; el daño contra alguien dice a quién */}
              {t.objetivo && !t.objetivo.grado && <span>{' · a '}{t.objetivo.nombre}</span>}
              {t.objetivo?.grado && (
                <span className={t.objetivo.grado === 'exito' || t.objetivo.grado === 'critico' ? 'font-semibold text-exito' : 'font-semibold text-peligro'}>
                  {' · '}{t.objetivo.salvacion
                    ? ({ critico: 'resistió', exito: 'salvó a medias', fallo: 'no salvó', pifia: 'falló feo' } as const)[t.objetivo.grado]
                    : t.objetivo.grado === 'critico' ? '¡crítico!' : t.objetivo.grado === 'exito' ? 'le diste' : t.objetivo.grado === 'pifia' ? 'pifia' : 'falló'}
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

function ColumnaQuien({ contexto, onAbrirFicha, compacta = false }: { contexto: Contexto; onAbrirFicha: () => void; compacta?: boolean }) {
  const { p, ficha, sala, onEditar, onSubirNivel, combate } = contexto;
  const tirar = (que: QueTirar) => sala.tirar(p.id, que);
  if (compacta) {
    return (
      <div className="flex min-w-0 items-center gap-3 px-4 py-2.5">
        <div className="w-14 shrink-0 [&>*]:scale-[0.8] [&>*]:origin-left"><FotoPegada src={p.retrato || undefined} inicial={p.nombre.slice(0, 1)} nombre={p.nombre} onEditar={onEditar} /></div>
        <button className="min-w-0 flex-1 text-left" onClick={onAbrirFicha} title="Abrir la ficha completa">
          <span className="block truncate font-titulo text-[20px] leading-tight font-bold text-acento">{p.nombre}</span>
          <span className="font-titulo text-[18px] font-bold">{p.pgActual}</span>
          <span className="ml-1 font-titulo text-[13px] text-texto-suave">/ {ficha.pgMax.total} PG · CA {ficha.ca.total}</span>
          <div className="mt-1"><BarraPG actual={p.pgActual} max={ficha.pgMax.total} temporales={p.pgTemporales} alto="h-2" /></div>
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 px-5 pt-4 pb-4 [@media(max-height:760px)]:gap-2 [@media(max-height:760px)]:pt-3 [@media(max-height:760px)]:pb-3">
      <div className="flex items-center gap-3.5">
        <FotoPegada src={p.retrato || undefined} inicial={p.nombre.slice(0, 1)} nombre={p.nombre} onEditar={onEditar} />
        <div className="min-w-0">
          <h2 className="truncate font-titulo text-[30px] leading-none font-bold text-acento">{p.nombre}</h2>
          <p className="mt-1 truncate font-titulo text-[14px] text-texto-suave">{[p.ascendencia, p.clase].filter(Boolean).join(' ')} · nivel {p.nivel}</p>
          {p.nivel < 20 && !combate && (
            <button className="mt-1 inline-flex items-center gap-1 rounded-md px-1 font-titulo text-[13.5px] font-semibold text-acento hover:bg-acento/10" onClick={onSubirNivel}>
              <SparkleIcon size={14} weight="fill" aria-hidden /> Subir a nivel {p.nivel + 1}
            </button>
          )}
        </div>
      </div>
      <button className="text-left" onClick={onAbrirFicha} title="Abrir la ficha completa para curar o recibir daño">
        <span className="font-titulo text-[38px] leading-none font-bold [@media(max-height:760px)]:text-[30px]">{p.pgActual}</span>
        <span className="ml-1 font-titulo text-[17px] text-texto-suave">/ {ficha.pgMax.total} PG</span>
        {p.pgTemporales > 0 && <span className="ml-2 font-titulo text-[13px] text-acento">+{p.pgTemporales} temp</span>}
        <div className="mt-1.5"><BarraPG actual={p.pgActual} max={ficha.pgMax.total} temporales={p.pgTemporales} /></div>
      </button>
      <PuntosHeroicos p={p} muriendo={!!contexto.miToken?.condiciones?.some((c) => c.clave === 'dying')} onRecuperar={() => sala.heroico('recuperar')} />
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

function CabeceraTurno({ contexto: { combate, miTurno, enTurno, miToken, sala } }: { contexto: Contexto }) {
  if (combate && miToken && (combate.demorados ?? []).includes(miToken.id)) {
    return (
      <h3 className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-titulo text-[19px] font-semibold lg:text-[21px]">
        Esperando <span className="text-[14px] font-normal text-texto-suave">· actúas apenas termine el turno de {enTurno?.nombre ?? '…'}</span>
        <button className="boli h-8 bg-acento px-3 font-titulo text-[14px] font-bold text-sobre-acento" onClick={() => sala.enviar({ tipo: 'volver-de-demora', tokenId: miToken.id })}>
          Actuar ahora
        </button>
      </h3>
    );
  }
  const muriendo = miToken?.condiciones?.find((c) => c.clave === 'dying');
  const caido = muriendo || miToken?.condiciones?.some((c) => c.clave === 'unconscious');
  if (combate && miTurno && caido) {
    return (
      <h3 className="mb-1 font-titulo text-[19px] font-semibold text-peligro lg:text-[21px]">
        {muriendo ? `Muriendo (Dying ${muriendo.valor})` : 'Inconsciente'}
        <span className="text-[14px] font-normal text-texto-suave"> · {muriendo ? 'la mesa tira tu salvación de recuperación' : 'no puedes actuar: termina tu turno'}</span>
      </h3>
    );
  }
  if (!combate) {
    return <h3 className="mb-1 font-titulo text-[21px] font-semibold">Fuera de combate <span className="hidden text-[14px] font-normal text-texto-suave sm:inline">· explora, habla, descansa</span></h3>;
  }
  if (!miTurno) {
    return (
      <h3 className="mb-1 font-titulo text-[21px] font-semibold">
        Turno de <span className={enTurno?.personajeId ? 'text-acento' : 'text-peligro'}>{enTurno?.nombre ?? '…'}</span>
        <span className="hidden text-[14px] font-normal text-texto-suave sm:inline"> · prepara tu próximo turno</span>
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
    // En una sola línea: en pantallas angostas se achican y, si igual no caben, se desliza de lado
    <div className="relative flex gap-x-0.5 overflow-x-auto pb-[3px] [scrollbar-width:none] xl:gap-x-1" role="tablist">
      <RayaAMano className="absolute inset-x-0 bottom-0 h-1.5 text-texto/70" />
      {lista.map((s) => (
        <button key={s.id} role="tab" aria-selected={activa === s.id} title={s.ayuda} onClick={() => onCambiar(s.id)}
          className={`relative z-[1] shrink-0 rounded-t-md border-[1.5px] border-b-0 px-1.5 pt-1 pb-0.5 font-titulo text-[13px] whitespace-nowrap transition xl:px-2.5 xl:text-[14px] ${activa === s.id ? 'border-texto/60 bg-superficie font-bold text-texto' : 'border-transparent text-texto-suave hover:text-texto'}`}>
          {s.titulo}
          {s.id !== 'turno' && <span className="ml-1 text-[11.5px] text-texto-suave">{s.filas.length}</span>}
        </button>
      ))}
    </div>
  );
}

// Columna derecha: condiciones como post-its y la acción grande del momento
// Las condiciones en chiquito (hoja plegada); en combate y en tu turno, también el botón para terminarlo
function CondicionesCompactas({ contexto, condiciones }: { contexto: Contexto; condiciones: Condicion[] }) {
  const { combate, miTurno, sala } = contexto;
  return (
    <div className="flex min-w-0 items-center gap-2 px-4 py-2.5">
      <button className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left" onClick={contexto.onCondiciones} title="Cambiar o quitar condiciones">
        {condiciones.length === 0
          ? <span className="font-titulo text-[13.5px] text-texto-suave"><StickerIcon size={15} className="mr-1 inline" aria-hidden />Sin condiciones</span>
          : condiciones.map((c) => (
            <span key={c.clave} className="rounded-md bg-[var(--postit)] px-2 py-0.5 font-titulo text-[13px] font-semibold text-[#3a2f12]" title={CONDICIONES[c.clave].ayuda}>
              {CONDICIONES[c.clave].nombre}{CONDICIONES[c.clave].conValor ? ` ${c.valor}` : ''}
            </span>
          ))}
      </button>
      {condiciones.some((c) => c.clave === 'dying') && (contexto.p.puntosHeroicos ?? 0) > 0 && (
        <button className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-peligro px-3 font-titulo text-[13.5px] font-semibold text-sobre-acento" onClick={() => sala.heroico('recuperar')}>
          Hero Points: no morir
        </button>
      )}
      {combate && miTurno && (
        <button className="boli flex h-9 shrink-0 items-center gap-1.5 bg-acento px-3 font-titulo text-[14px] font-bold text-sobre-acento" onClick={() => sala.enviar({ tipo: 'avanzar-turno' })}>
          Terminar <Tecla sobreTinta>Espacio</Tecla>
        </button>
      )}
    </div>
  );
}

function ColumnaLado({ contexto, condiciones }: { contexto: Contexto; condiciones: Condicion[] }) {
  const { combate, miTurno, miToken, sala, p } = contexto;
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
      <div className="flex max-h-[150px] flex-col gap-2.5 overflow-y-auto pt-1 pr-1">
        {condiciones.length === 0
          ? <p className="font-titulo text-[14px] text-texto-suave">Sin condiciones. Si te pasa algo (Frightened, Prone…), aparece aquí con su explicación.</p>
          : condiciones.map((c, i) => (
            <button key={c.clave} className="text-left" onClick={contexto.onCondiciones} title="Cambiar o quitar">
              <PostitCondicion condicion={c} giro={i % 2 ? -1.5 : 2} />
            </button>
          ))}
      </div>
      <button className="flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 font-titulo text-[13.5px] text-texto-suave transition hover:text-acento"
        onClick={contexto.onCondiciones}>
        <StickerIcon size={16} aria-hidden /> {condiciones.length ? 'Cambiar condiciones' : 'Pegar una condición'}
      </button>
      {miToken && <ElegirLuz compacto luz={miToken.luz} onCambiar={(luz) => sala.enviar({ tipo: 'llevar-luz', tokenId: miToken.id, ...(luz ? { luz } : {}) })} />}
      <div className="mt-auto flex flex-col gap-2">
        {combate && miToken && <BotonReaccion combate={combate} tokenId={miToken.id} sala={sala} />}
        {combate
          ? miTurno && (
            <button className="boli flex h-12 items-center justify-center gap-2 bg-acento font-titulo text-[17px] font-bold text-sobre-acento shadow-[0_6px_12px_-6px_var(--acento)] transition active:scale-[0.97]"
              onClick={() => sala.enviar({ tipo: 'avanzar-turno' })}>
              Terminar turno <Tecla sobreTinta>Espacio</Tecla>
            </button>
          )
          : (
            <>
              <ElegirActividad actual={p.exploracion} onCambiar={(a) => sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { exploracion: a ?? '' } })} />
              <Descansos p={p} sala={sala} />
            </>
          )}
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
  const confirmar = useConfirmar();
  const descansar = (d: Descanso) => confirmar.pedir({
    titulo: `${DESCANSOS[d].nombre}`, texto: DESCANSOS[d].ayuda, si: d === 'diario' ? 'Descansar' : 'Recuperar foco',
    hacer: () => sala.enviar({ tipo: 'descansar', personajeId: p.id, descanso: d }),
  });
  return (
    <div className="flex flex-col gap-1.5">
      {confirmar.ventana}
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
// El detalle de una acción en el teléfono: al abrirse se acomoda para que se vea entero (con su botón de usar)
function TarjetaALaVista({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: reducir ? 'auto' : 'smooth' });
  }, []);
  return <div ref={ref} className="tarjeta relative my-2 scroll-mb-4 px-4 py-3.5">{children}</div>;
}

function TurnoMovil({ contexto, condiciones, lista, elegida, marcada, libres, onElegir, detalle, companeros }: {
  contexto: Contexto;
  condiciones: Condicion[];
  lista: Seccion[];
  elegida: string | null;
  marcada: string | null;
  libres: number | null;
  onElegir: (f: Fila) => void;
  detalle: (f: Fila) => ReactNode;
  // Los retratos de los compañeros, arriba (tocar uno lleva al tablero, a su token)
  companeros?: ReactNode;
}) {
  const { p, ficha, combate, miTurno, miToken, sala, onEditar } = contexto;
  // Una acción puede estar en "Tu turno" y en su sección: el detalle se abre solo donde se tocó
  const [abiertaEn, setAbiertaEn] = useState<string | null>(null);
  const seccionAbierta = elegida ? (abiertaEn && lista.find((s) => s.id === abiertaEn)?.filas.some((f) => f.clave === elegida) ? abiertaEn
    : lista.find((s) => s.filas.some((f) => f.clave === elegida))?.id) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {companeros && <div className="mx-3 mt-2">{companeros}</div>}
      <div className="hoja mx-3 mt-2 flex flex-col gap-2.5 px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-3">
          <FotoPegada src={p.retrato || undefined} inicial={p.nombre.slice(0, 1)} tamano="size-[54px]" nombre={p.nombre} onEditar={onEditar} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-titulo text-[25px] leading-none font-bold text-acento">{p.nombre}</h2>
            <p className="mt-1 font-titulo text-[14px] text-texto-suave">
              <b className="text-[18px] text-texto">{p.pgActual}</b> / {ficha.pgMax.total} PG · CA <b className="text-texto">{ficha.ca.total}</b>
            </p>
          </div>
          {p.nivel < 20 && !combate && (
            <button className="flex size-10 shrink-0 items-center justify-center rounded-lg text-acento hover:bg-acento/10" onClick={contexto.onSubirNivel}
              aria-label={`Subir a nivel ${p.nivel + 1}`} title={`Subir a nivel ${p.nivel + 1}`}>
              <SparkleIcon size={22} weight="fill" aria-hidden />
            </button>
          )}
        </div>
        <BarraPG actual={p.pgActual} max={ficha.pgMax.total} temporales={p.pgTemporales} alto="h-3" />
        <div className="flex flex-wrap items-center gap-2">
          <CabeceraTurno contexto={contexto} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {condiciones.map((c, i) => (
            <button key={c.clave} onClick={contexto.onCondiciones}><PostitCondicion condicion={c} compacto giro={i % 2 ? -2 : 2} /></button>
          ))}
          <button className="flex items-center gap-1 font-titulo text-[13px] text-texto-suave" onClick={contexto.onCondiciones}>
            <StickerIcon size={15} aria-hidden /> {condiciones.length ? 'cambiar' : 'condición'}
          </button>
        </div>
        {contexto.miToken && (contexto.miToken.efectos?.length ?? 0) > 0 && (
          <div className="mt-2"><EfectosActivos efectos={contexto.miToken.efectos ?? []} compacto /></div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        {lista.map((s) => (
          <section key={s.id} className="mb-4">
            <div className="flex items-baseline justify-between gap-2 border-b-[1.5px] border-texto/70 pb-0.5">
              <h3 className="shrink-0 font-titulo text-[18px] font-bold">{s.id === 'turno' && !combate ? 'A mano' : s.titulo}</h3>
              <span className="truncate font-titulo text-[12.5px] text-texto-suave">{s.resumen ?? s.ayuda}</span>
            </div>
            {s.filas.map((f) => (
              <div key={f.clave}>
                <ListaAcciones seccion={{ ...s, filas: [f] }} elegida={seccionAbierta === s.id ? elegida : null} marcada={marcada} libres={libres}
                  onElegir={(x) => { setAbiertaEn(s.id); onElegir(x); }} />
                {elegida === f.clave && seccionAbierta === s.id && <TarjetaALaVista>{detalle(f)}</TarjetaALaVista>}
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

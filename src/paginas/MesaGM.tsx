import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BookOpenTextIcon, ChatCircleDotsIcon, CopyIcon, DiceFiveIcon, PawPrintIcon, SwordIcon, UsersThreeIcon, WrenchIcon, XIcon,
} from '@phosphor-icons/react';
import { personajeNuevo, leerExpresion, type Personaje } from '../../reglas/pf2e';
import { alcanceAtaque, danoAjustado, type AtaqueCriatura } from '../../reglas/criaturas';
import { BLOQUEO_ESCUDO, motivoAlcance, motivoParaActuarToken, tokenEnTurno, type EstadoSala } from '../../compartido/sala';
import type { Evento } from '../../compartido/eventos';
import { almacen, guardar, leer, type Sala } from '../conexion';
import { leerColoresTablero, type useTema } from '../tema';
import { Tablero } from '../componentes/Tablero';
import { AvisoTirada, ListaTiradas, TiradaLibre } from '../componentes/Tiradas';
import { HerramientasGM } from '../componentes/Panel';
import { PanelCombateGM } from '../componentes/Combate';
import { EditorFicha } from '../componentes/EditorFicha';
import { EditarPersonaje } from '../componentes/EditarPersonaje';
import { Creador } from '../componentes/creador/Creador';
import { ImportarPathbuilder } from '../componentes/ImportarPathbuilder';
import { mensajeRechazo } from '../componentes/Entrada';
import { PilaAvisos, useAvisos, useLlegadas, type Aviso } from '../componentes/hud/Avisos';
import { AyudaTeclas, ModalCondiciones, PanelReglas } from '../componentes/hud/Paneles';
import { Modal } from '../componentes/hud/Modal';
import { Tecla } from '../componentes/hud/piezas';
import { TECLAS } from '../componentes/hud/secciones';
import { PersonajesGM } from '../componentes/gm/PersonajesGM';
import { PanelBestiario } from '../componentes/gm/Bestiario';
import { EditorCriatura } from '../componentes/gm/EditorCriatura';
import { HojaCriatura, MenuCriatura } from '../componentes/gm/HojaCriatura';
import { BandaElegir, Cabecera, OrdenEscrito } from './MesaJugador';
import { OrdenRevelado } from '../componentes/Preparacion';
import { PanelEscenas, TituloEscena } from '../componentes/Escenas';
import { PanelChat } from '../componentes/Chat';
import { BarraMuros, SeccionMurosNiebla } from '../componentes/gm/MurosNiebla';
import { aMascara, casillasVisibles, deMascara, iluminacion, visionActiva } from '../../compartido/vision';
import type { HerramientaMuros } from '../componentes/Tablero';
import { Companeros } from '../componentes/hud/Companeros';

type Tema = ReturnType<typeof useTema>;
type CajonGM = 'mesa' | 'bestiario' | 'personajes' | 'combate' | 'tiradas' | 'chat' | 'reglas';

const CAJONES: { clave: CajonGM; nombre: string; tecla: string; icono: ReactNode }[] = [
  { clave: 'combate', nombre: 'Combate', tecla: 'C', icono: <SwordIcon size={20} aria-hidden /> },
  { clave: 'bestiario', nombre: 'Compendio', tecla: 'B', icono: <PawPrintIcon size={20} aria-hidden /> },
  { clave: 'personajes', nombre: 'Personajes', tecla: 'P', icono: <UsersThreeIcon size={20} aria-hidden /> },
  { clave: 'mesa', nombre: 'Mesa', tecla: 'M', icono: <WrenchIcon size={20} aria-hidden /> },
  { clave: 'tiradas', nombre: 'Tiradas', tecla: 'D', icono: <DiceFiveIcon size={20} aria-hidden /> },
  { clave: 'chat', nombre: 'Chat', tecla: 'V', icono: <ChatCircleDotsIcon size={20} aria-hidden /> },
  { clave: 'reglas', nombre: 'Reglas', tecla: 'H', icono: <BookOpenTextIcon size={20} aria-hidden /> },
];

const TECLAS_GM: [string, string][] = [
  ['Q W E R T Y', 'Los ataques de la criatura que manejas'],
  ['Esc', 'Cierra lo abierto o cancela "elige a quién"'],
  ['F', 'Termina el turno de la criatura'],
  ['C', 'Combate (iniciativa, quién pelea)'],
  ['B', 'Compendio: las 6.500 criaturas y todo Pathfinder'],
  ['P', 'Personajes de los jugadores'],
  ['M', 'Mesa: mapa, tokens y códigos'],
  ['D', 'Tiradas (y tirada libre)'],
  ['V', 'Chat (y susurros)'],
  ['H', 'Reglas rápidas'],
  ['Tocar una criatura', 'La manejas: su hoja aparece abajo'],
  ['Tocar a un personaje', 'El menú de ataques de tu criatura contra él'],
  ['Arrastrar', 'En su turno, la criatura gasta Strides; fuera de él, la mueves libre'],
];

// La mesa del GM: el tablero entero, sus criaturas con su hoja abajo (como la del jugador) y los paneles al costado.
// En el turno de una criatura, la mesa se la pasa al GM con sus acciones, su alcance y sus ataques listos.
export function MesaGM({ salaId, sala, estado, tema }: { salaId: string; sala: Sala; estado: EstadoSala; tema: Tema }) {
  const [actorId, setActorId] = useState<string | null>(null);
  const [objetivoId, setObjetivoId] = useState<string | null>(null);
  const [eligiendo, setEligiendo] = useState<AtaqueCriatura | null>(null);
  const [asomado, setAsomado] = useState<AtaqueCriatura | null>(null);
  const [plegada, setPlegada] = useState(false);
  // Mientras elige a quién atacar, en una pantalla baja la hoja se pliega (tapa el tablero) y vuelve al terminar
  const plegoParaElegir = useRef(false);
  useEffect(() => {
    const baja = window.innerHeight < 900 || window.innerWidth < 1024;
    if (eligiendo && baja && !plegada) { plegoParaElegir.current = true; setPlegada(true); }
    if (!eligiendo && plegoParaElegir.current) { plegoParaElegir.current = false; setPlegada(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligiendo]);
  const [cajon, setCajon] = useState<CajonGM | null>(null);
  // La pista de "toca una criatura": se va al cerrarla o al tocar la primera, y no vuelve
  const [pistaVista, setPistaVista] = useState(() => leer('wayforge:pista-gm') === '1');
  const verPista = () => { setPistaVista(true); guardar('wayforge:pista-gm', '1'); };
  useEffect(() => { if (actorId && !pistaVista) verPista(); }, [actorId]); // eslint-disable-line react-hooks/exhaustive-deps
  // En pantallas bajas, abrir un panel pliega la hoja de la criatura para que el panel tenga lugar
  useEffect(() => {
    if (cajon && innerHeight < 800) setPlegada(true);
  }, [cajon]);
  const [editandoCriatura, setEditandoCriatura] = useState<string | null>(null);
  const [condicionesDe, setCondicionesDe] = useState<string | null>(null);
  const [editandoP, setEditandoP] = useState<Personaje | null>(null);
  const [creando, setCreando] = useState<Personaje | null>(null);
  const [aMano, setAMano] = useState(false);
  const [importando, setImportando] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [codigos, setCodigos] = useState(false);
  const [responderA, setResponderA] = useState('');
  // Una mesa recién creada: la bienvenida con los códigos y por dónde empezar (una sola vez por mesa)
  const [bienvenida, setBienvenida] = useState(() => leer(`wayforge:bienvenida:${salaId}`) !== '1' && Object.keys(estado.personajes).length === 0);
  const cerrarBienvenida = () => { setBienvenida(false); guardar(`wayforge:bienvenida:${salaId}`, '1'); };
  const [enfoque, setEnfoque] = useState<{ tokenId: string; n: number } | null>(null);
  // Dibujando muros (con qué herramienta) y mirando la niebla como la ven los jugadores
  const [herramientaMuros, setHerramientaMuros] = useState<HerramientaMuros | null>(null);
  const [verNiebla, setVerNiebla] = useState(false);
  // La luz real del lugar, para que el GM vea dónde está oscuro
  const oscuridadGM = useMemo(() => {
    if ((estado.mapa.luz ?? 'brillante') === 'brillante') return null;
    const luz = iluminacion(estado);
    return (k: string) => ({ 0: 0.5, 1: 0.22, 2: 0 } as const)[luz(k)];
  }, [estado.mapa, estado.tokens]);
  const nieblaGM = useMemo(() => {
    if (!verNiebla || !visionActiva(estado.mapa)) return null;
    const visibles = casillasVisibles(estado);
    const exploradas = deMascara(estado.mapa.exploradas, estado.mapa.columnas, estado.mapa.filas);
    for (const k of visibles) exploradas.add(k);
    return { visibles, exploradas, opaca: false };
  }, [verNiebla, estado.mapa, estado.tokens]);
  const [colores, setColores] = useState(leerColoresTablero);
  useEffect(() => setColores(leerColoresTablero()), [tema.tema]);
  const codigoGM = leer(almacen.gmCodigo(salaId));

  const actor = actorId ? estado.tokens[actorId] : undefined;
  const combate = estado.combate;
  const enTurno = tokenEnTurno(estado);
  const suTurno = !!combate && !!actor && enTurno?.id === actor.id;
  const numero = (suTurno ? Math.min(combate!.ataques, 2) : 0) as 0 | 1 | 2;
  const libres = suTurno ? combate!.acciones - combate!.usadas : null;

  // Si borran el token que manejaba (o el objetivo), se suelta
  useEffect(() => {
    if (actorId && !estado.tokens[actorId]) setActorId(null);
    if (objetivoId && !estado.tokens[objetivoId]) setObjetivoId(null);
  }, [estado, actorId, objetivoId]);

  // Le toca a una criatura: el GM la toma, con su hoja abierta (y lo que estaba apuntando se suelta)
  useEffect(() => {
    setObjetivoId(null);
    setEligiendo(null);
    if (enTurno && !enTurno.personajeId) {
      setActorId(enTurno.id);
      setObjetivoId(null);
      setPlegada(false);
    }
  }, [enTurno?.id, combate?.ronda]);

  // El GM creó un personaje: cuando aparece en la mesa, se cierra el creador
  useEffect(() => {
    if (creando && estado.personajes[creando.id]) { setCreando(null); setAMano(false); setImportando(false); }
  }, [estado, creando]);

  // Los jugadores ven a quién apunta el GM
  useEffect(() => { sala.apuntar(objetivoId); }, [objetivoId]);

  // El último ataque de una criatura: el aviso de "le diste" ofrece tirar su daño
  const ultimoAtaque = useRef<{ tokenId: string; ataque: AtaqueCriatura } | null>(null);

  const tirarDano = (tokenId: string, a: AtaqueCriatura, critico: boolean, objetivo?: string) => {
    const caras = leerExpresion(a.dano)?.dados[0]?.caras;
    sala.tirar(undefined, { tipo: 'dano-criatura', tokenId, ataque: a.id, ...(critico ? { critico } : {}), ...(objetivo ? { objetivo } : {}) },
      critico ? 'Daño crítico' : 'Daño', caras);
  };

  // El menú de ataques contra alguien: se abre al tocarlo; si se atacó con la tecla (eligiendo), no aparece encima
  const [menuObjetivo, setMenuObjetivo] = useState(false);
  function atacar(a: AtaqueCriatura, objetivo?: string) {
    if (!actor) return;
    const motivo = motivoParaActuarToken(estado, actor, 1);
    if (motivo) return sala.negarLocal(motivo);
    const otros = Object.values(estado.tokens).some((t) => t.id !== actor.id);
    if (!objetivo && otros) {
      setEligiendo(a);
      setObjetivoId(null);
      return;
    }
    const destino = objetivo ? estado.tokens[objetivo] : undefined;
    const lejos = destino ? motivoAlcance(actor, destino, alcanceAtaque(a)) : null;
    if (lejos) return sala.negarLocal(lejos.replace('tienes que estar', `${actor.nombre} tiene que estar`).replace('Acércate', 'Acércalo').replace('tu alcance', 'su alcance'));
    ultimoAtaque.current = { tokenId: actor.id, ataque: a };
    sala.tirar(undefined, { tipo: 'criatura', tokenId: actor.id, ataque: a.id, numero, ...(objetivo ? { objetivo } : {}) }, `${actor.nombre}: ${a.nombre}`);
    setEligiendo(null);
    setObjetivoId(objetivo ?? null);
  }

  const cambiarPG = (tokenId: string, delta: number) => {
    const t = estado.tokens[tokenId];
    if (!t) return;
    const p = t.personajeId ? estado.personajes[t.personajeId] : undefined;
    if (p) {
      // El daño lo aplica la sala: PG temporales primero, Shield Block si lo usó, Dying a 0 PG
      if (delta < 0) {
        sala.enviar({ tipo: 'danar', tokenId: t.id, cantidad: -delta });
      } else {
        sala.enviar({ tipo: 'editar-personaje', id: p.id, cambios: { pgActual: p.pgActual + delta } });
      }
      return;
    }
    if (t.pg) sala.enviar({ tipo: 'editar-token', id: t.id, cambios: { pg: { ...t.pg, actual: Math.max(0, Math.min(t.pg.max, t.pg.actual + delta)) } } });
  };

  // Avisos del GM: cómo le fue a su criatura, el daño para aplicar con un toque, y de quién es el turno
  const generar = (e: Evento): Aviso[] => {
    const id = () => crypto.randomUUID();
    if (e.tipo === 'turno') {
      const t = estado.tokens[e.tokenId];
      if (!t || t.personajeId) return [];
      return [{ id: id(), tono: 'turno', titulo: `Turno de ${t.nombre}`, cuerpo: `Tiene ${estado.combate?.acciones ?? 3} acciones. Toca a un personaje para atacarlo o arrastra su token.`, dura: 5000 }];
    }
    if (e.tipo === 'fin-combate') {
      const n = Object.values(e.quitados).reduce((s, x) => s + x.length, 0);
      return [{ id: id(), tono: 'nota', titulo: 'Terminó el combate', cuerpo: n ? `Se quitaron ${n} efectos y condiciones de la pelea (escudos levantados, lo de un minuto…). Dying y Wounded quedan.` : 'Todos vuelven a moverse libres.', dura: 7000 }];
    }
    if (e.tipo === 'efecto' && !e.quitado && e.nombre.startsWith('Shield Block')) {
      const t = estado.tokens[e.tokenId];
      return t ? [{ id: id(), tono: 'nota', titulo: `${t.nombre} bloquea con el escudo`, cuerpo: `${e.nombre.replace('Shield Block ', '')}: al aplicar el daño, la mesa resta la Dureza y daña el escudo.`, dura: 7000 }] : [];
    }
    // Lo que dicen los jugadores (si el chat no está abierto)
    if (e.tipo === 'chat') {
      if (e.mensaje.rol === 'gm' || cajon === 'chat') return [];
      return [{ id: id(), tono: 'nota', titulo: e.mensaje.para ? `${e.mensaje.quien} te susurra` : e.mensaje.quien, cuerpo: e.mensaje.texto.slice(0, 140), dura: 7000,
        // A un susurro se responde en susurro, al personaje que lo mandó
        botones: [{ etiqueta: 'Responder', principal: true, hacer: () => { setResponderA(e.mensaje.para ? e.mensaje.personajeId ?? '' : ''); setCajon('chat'); } }] }];
    }
    // La preparación del combate: lo que usan los jugadores y cuándo están todos listos
    if (e.tipo === 'preparativo') {
      const t = estado.tokens[e.tokenId];
      return [{ id: id(), tono: 'nota', titulo: `${t?.nombre ?? 'Alguien'} usó ${e.nombre}`, cuerpo: e.ultimo ? 'Va último: no tira iniciativa.' : 'Ya cuenta para la tirada de iniciativa.', dura: 5000 }];
    }
    if (e.tipo === 'todos-listos') {
      const tokens = estado.preparacion?.tokens ?? [];
      return [{
        // Con id fijo: al empezar el combate se quita solo
        id: 'todos-listos', tono: 'turno', titulo: 'Todos listos', cuerpo: 'Los jugadores eligieron su tirada y usaron lo que querían.',
        botones: tokens.length ? [{ etiqueta: 'Tirar iniciativa', principal: true, hacer: () => sala.iniciarCombate(tokens) }] : [],
      }];
    }
    // Una criatura cae por lo que hizo el motor (un Fireball, el fuego persistente)
    if (e.tipo === 'dano' && e.cayo) {
      const t = estado.tokens[e.tokenId];
      return t ? [{ id: id(), tono: 'bueno', titulo: `${t.nombre} cae`, cuerpo: `Recibió ${e.cantidad} de daño y quedó a 0 PG.`, dura: 5000 }] : [];
    }
    if (e.tipo !== 'tirada') return [];
    const t = e.tirada;
    // Lo que resolvió el motor de interacciones ya está aplicado: no hay nada que restar a mano
    if (t.resultado) return [];
    const objetivo = t.objetivo?.tokenId ? estado.tokens[t.objetivo.tokenId] : undefined;
    const autor = t.autorTokenId ? estado.tokens[t.autorTokenId] : undefined;
    const deCriatura = autor && !autor.personajeId;
    // Ataque de una criatura: si acierta, su daño a un toque
    if (deCriatura && objetivo && t.objetivo?.grado) {
      const ultimo = ultimoAtaque.current?.tokenId === autor.id ? ultimoAtaque.current.ataque : null;
      if (t.objetivo.grado === 'exito' || t.objetivo.grado === 'critico') {
        const critico = t.objetivo.grado === 'critico';
        return [{
          id: id(), tono: 'bueno', titulo: `${critico ? '¡Crítico de' : '¡Acierta'} ${autor.nombre} contra ${objetivo.nombre}!`,
          cuerpo: `${t.total} contra CA ${t.objetivo.cd}.`,
          botones: ultimo ? [{ etiqueta: `${critico ? 'Daño crítico ×2' : 'Tirar daño'} (${ultimo.dano})`, principal: true, hacer: () => tirarDano(autor.id, ultimo, critico, objetivo.id) }] : [],
        }];
      }
      return [{ id: id(), tono: 'malo', titulo: `${autor.nombre} ${t.objetivo.grado === 'pifia' ? 'pifia' : 'falla'} contra ${objetivo.nombre}`, cuerpo: `${t.total} contra CA ${t.objetivo.cd}.`, dura: 5000 }];
    }
    // Daño a alguien: restarlo de un toque (a sus enemigos o a los personajes)
    if (objetivo && !t.objetivo?.grado && t.etiqueta.startsWith('Daño')) {
      const p = objetivo.personajeId ? estado.personajes[objetivo.personajeId] : undefined;
      const pg = p ? { actual: p.pgActual } : objetivo.pg;
      if (!pg) return [];
      // Resistencias, debilidades e inmunidades de la criatura, ya aplicadas al número del botón
      const tipo = /\(([^)]+)\)/.exec(t.etiqueta)?.[1] ?? null;
      const ajuste = p ? { total: t.total, nota: null } : danoAjustado(objetivo.criatura, t.total, tipo);
      if (t.aplicada) return [];
      // Si bloqueó con el escudo, que se vea antes de restar (la mesa descuenta la Dureza al aplicar)
      const bloqueo = p?.escudo && (objetivo.efectos ?? []).some((x) => x.clave === BLOQUEO_ESCUDO)
        ? ` El escudo frena ${Math.min(p.escudo.dureza, ajuste.total)}.` : '';
      return [{
        // Con el id de la tirada: si el jugador ya lo restó, el aviso se cierra solo
        id: `dano-${t.id}`, tono: 'peligro', titulo: `${t.quien} le hace ${t.total} de daño a ${objetivo.nombre}`,
        cuerpo: `${ajuste.nota ? `Recibe ${ajuste.total} (${ajuste.nota}). ` : ''}${objetivo.nombre} tiene ${pg.actual} PG${p ? ' (también le avisamos al jugador)' : ''}.${bloqueo}`,
        botones: [{ etiqueta: ajuste.total ? `Restar ${ajuste.total} PG` : 'No le hace nada', principal: true, hacer: () => (p ? sala.enviar({ tipo: 'danar', tokenId: objetivo.id, cantidad: ajuste.total, tiradaId: t.id, ...(/crítico/i.test(t.etiqueta) ? { critico: true } : {}) }) : cambiarPG(objetivo.id, -ajuste.total)) }],
      }];
    }
    return [];
  };
  const { avisos, cerrar: cerrarAviso, agregar: agregarAviso } = useAvisos(sala.eventos, generar);
  // Un personaje que muere: el GM se entera aparte (ya no hay salvaciones que tirar)
  const muertos = Object.values(estado.tokens).filter((t) => t.personajeId && t.condiciones?.some((c) => c.clave === 'dead')).map((t) => t.id).join(',');
  const muertosAntes = useRef(muertos);
  useEffect(() => {
    const antes = new Set(muertosAntes.current.split(',').filter(Boolean));
    for (const id of muertos.split(',').filter(Boolean)) {
      if (!antes.has(id)) agregarAviso({ id: `muerte-${id}`, tono: 'peligro', titulo: `${estado.tokens[id]?.nombre ?? 'Un personaje'} muere`, cuerpo: 'Llegó a su Dying mortal. Si fue un error, quítale Dead desde sus condiciones.' });
    }
    muertosAntes.current = muertos;
  }, [muertos]); // eslint-disable-line react-hooks/exhaustive-deps
  // El daño que ya restó otro (el GM o el jugador): su aviso se va
  const aplicadas = estado.tiradas.filter((t) => t.aplicada).map((t) => t.id).join(',');
  useEffect(() => { for (const id of aplicadas.split(',')) if (id) cerrarAviso(`dano-${id}`); }, [aplicadas]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (combate) cerrarAviso('todos-listos'); }, [!!combate]); // eslint-disable-line react-hooks/exhaustive-deps
  useLlegadas(sala.presentes, 'GM', agregarAviso);
  const negacionVista = useRef(sala.negaciones.at(-1)?.id ?? 0);
  useEffect(() => {
    const nuevas = sala.negaciones.filter((n) => n.id > negacionVista.current);
    if (!nuevas.length) return;
    negacionVista.current = nuevas.at(-1)!.id;
    for (const n of nuevas) agregarAviso({ id: crypto.randomUUID(), tono: 'peligro', titulo: 'No se puede', cuerpo: n.motivo, dura: 5000 });
  }, [sala.negaciones]);

  // Teclado: Q..Y los ataques de la criatura, F termina su turno, letras para los paneles
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      const destino = e.target as HTMLElement;
      // Esc cierra el panel de la derecha, aunque el foco esté en su campo (el chat)
      if (e.key === 'Escape' && cajon && !document.querySelector('[aria-modal]')) { setCajon(null); (document.activeElement as HTMLElement | null)?.blur?.(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || destino.closest('input, textarea, select') || document.querySelector('[aria-modal]')) return;
      const tecla = e.key.toUpperCase();
      const i = TECLAS.indexOf(tecla);
      const panel = CAJONES.find((c) => c.tecla === tecla);
      if (i >= 0 && actor?.criatura?.ataques[i]) atacar(actor.criatura.ataques[i]!, objetivoId ?? undefined);
      else if (panel) setCajon(cajon === panel.clave ? null : panel.clave);
      else if (tecla === 'F' && suTurno && !actor?.personajeId) sala.enviar({ tipo: 'avanzar-turno' });
      else if (tecla === 'ESCAPE') { setEligiendo(null); setObjetivoId(null); }
      else if (e.key === '?') setAyuda(true);
    }
    addEventListener('keydown', alPulsar);
    return () => removeEventListener('keydown', alPulsar);
  });

  // Crear un personaje para un jugador: el creador guiado a pantalla completa (o a mano)
  if (creando) {
    return (
      <div className="h-full overflow-y-auto">
        {importando ? (
          <ImportarPathbuilder id={creando.id} error={mensajeRechazo(sala.rechazo)}
            onCancelar={() => { setCreando(null); setImportando(false); sala.limpiarRechazo(); }}
            onRevisar={(p) => { setCreando(p); setImportando(false); setAMano(true); }}
            onGuardar={(p, codigo) => sala.nuevoPersonaje(p, codigo)} />
        ) : aMano ? (
          <EditorFicha salaId={salaId} inicial={creando} modo="crear" error={mensajeRechazo(sala.rechazo)}
            onCancelar={() => { setCreando(null); setAMano(false); sala.limpiarRechazo(); }} onGuardar={(p, codigo) => sala.nuevoPersonaje(p, codigo)} />
        ) : (
          <Creador salaId={salaId} id={creando.id} error={mensajeRechazo(sala.rechazo)}
            onCancelar={() => { setCreando(null); sala.limpiarRechazo(); }} onAMano={() => setAMano(true)} onImportar={() => setImportando(true)} onGuardar={(p, codigo) => sala.nuevoPersonaje(p, codigo)} />
        )}
      </div>
    );
  }

  // Dónde aparecen las criaturas nuevas: cerca de los tokens que ya hay
  const tokens = Object.values(estado.tokens);
  const cerca = tokens.length
    ? { x: Math.round(tokens.reduce((s, t) => s + t.x, 0) / tokens.length) + 3, y: Math.round(tokens.reduce((s, t) => s + t.y, 0) / tokens.length) }
    : { x: 3, y: 3 };
  const filaEligiendo = eligiendo ?? asomado;
  const rango = actor && filaEligiendo
    ? { tokenId: actor.id, pies: alcanceAtaque(filaEligiendo), etiqueta: `${actor.nombre}: ${filaEligiendo.nombre} · ${alcanceAtaque(filaEligiendo) <= 5 ? 'cuerpo a cuerpo' : `${alcanceAtaque(filaEligiendo)} ft`}` }
    : null;
  const objetivo = objetivoId ? estado.tokens[objetivoId] : undefined;
  const menu = actor?.criatura && objetivo && !eligiendo && menuObjetivo ? {
    tokenId: objetivo.id,
    contenido: (
      <MenuCriatura estado={estado} actor={actor} objetivo={objetivo} numero={numero}
        onAtacar={(a) => atacar(a, objetivo.id)} onAcercar={(c) => sala.mover(actor.id, c.x, c.y)} onCerrar={() => setObjetivoId(null)} />
    ),
  } : null;
  // Lo que tapa la hoja de abajo: en el teléfono ocupa más de media pantalla
  const margen = actor ? (plegada ? 70 : window.innerWidth < 1024 ? Math.round(window.innerHeight * 0.6) : 300) : 0;

  function seleccionar(id: string | null) {
    if (eligiendo) {
      if (id && id !== actor?.id) { atacar(eligiendo, id); setMenuObjetivo(false); }
      return;
    }
    if (!id) return setObjetivoId(null);
    const t = estado.tokens[id];
    if (!t) return;
    // Tocar a alguien con una criatura en mano: su menú de ataques contra él. Tocar otra criatura: pasar a manejarla.
    if (actor?.criatura && id !== actor.id && (t.personajeId || t.tipo !== actor.tipo)) { setMenuObjetivo(true); return setObjetivoId(id); }
    setActorId(id);
    setObjetivoId(null);
    setPlegada(false);
  }

  const panel = (c: CajonGM) => {
    switch (c) {
      case 'combate': return <PanelCombateGM estado={estado} quien={sala.quien} enviar={sala.enviar} onIniciar={sala.iniciarCombate} onSumar={sala.sumarACombate} />;
      case 'bestiario': return <PanelBestiario estado={estado} enviar={sala.enviar} onDecir={sala.decir} cerca={cerca} onCreados={(ids) => { if (ids[0]) { setActorId(ids[0]); setEnfoque((x) => ({ tokenId: ids[0]!, n: (x?.n ?? 0) + 1 })); } }} />;
      case 'personajes': return <PersonajesGM estado={estado} sala={sala} objetivo={objetivo ? { id: objetivo.id, nombre: objetivo.nombre } : null}
        onCrear={() => setCreando(personajeNuevo(crypto.randomUUID()))} onEditar={setEditandoP} />;
      case 'mesa': return <HerramientasGM salaId={salaId} codigoGM={codigoGM} estado={estado} seleccionado={actorId} onSeleccionar={setActorId} enviar={sala.enviar}
        onEditarPersonaje={(id) => { const p = estado.personajes[id]; if (p) setEditandoP(p); }}
        escenas={<PanelEscenas estado={estado} enviar={sala.enviar} />}
        onExportar={sala.exportar}
        murosNiebla={<SeccionMurosNiebla estado={estado} enviar={sala.enviar} verNiebla={verNiebla} onVerNiebla={setVerNiebla}
          onEditar={() => { setHerramientaMuros('habitacion'); setCajon(null); }} />} />;
      case 'tiradas': return (
        <div className="flex flex-col gap-4">
          <TiradaLibre esGM objetivo={objetivo ? { id: objetivo.id, nombre: objetivo.nombre } : null} onTirar={(que, secreto) => sala.tirar(undefined, que, undefined, undefined, secreto)} />
          <ListaTiradas tiradas={estado.tiradas} verCd />
        </div>
      );
      case 'chat': return <PanelChat key={responderA} estado={estado} quien={sala.quien} onDecir={sala.decir} paraInicial={responderA} />;
      case 'reglas': return <PanelReglas />;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Cabecera salaId={salaId} sala={sala} tema={tema} onAyuda={() => setAyuda(true)} textoSalir="Para volver como GM vas a necesitar tu código de GM."
        extra={(
          <button className="flex h-10 items-center gap-1.5 rounded-lg border border-borde bg-superficie px-3 font-titulo text-[14px] transition hover:bg-superficie-2" onClick={() => setCodigos(!codigos)}>
            Códigos
          </button>
        )} />

      {/* Nada se sale de la pantalla (la hoja plegada de la criatura tampoco): sin scroll */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Tablero
          estado={estado}
          colores={colores}
          quien={sala.quien}
          margenInferior={margen}
          movimiento={actor && suTurno && !actor.personajeId && libres !== null ? { tokenId: actor.id, libres } : null}
          apunta={actor && objetivo ? { desde: actor.id, hasta: objetivo.id } : null}
          eventos={sala.eventos}
          menu={menu}
          rango={rango}
          enfocar={enfoque}
          presencia={{ punteros: Object.values(sala.punteros), senales: sala.senales }}
          onPuntero={sala.moverPuntero}
      onMedir={sala.medir}
          onSenal={sala.senalar}
          onNegar={sala.negarLocal}
          seleccionado={actorId}
          onSeleccionar={seleccionar}
          onMover={(id, x, y) => sala.mover(id, x, y)}
          onPuerta={sala.puerta}
          niebla={nieblaGM}
          editorMuros={herramientaMuros ? {
            herramienta: herramientaMuros,
            onAgregar: (nuevos) => sala.enviar({ tipo: 'editar-mapa', cambios: { muros: [...(estado.mapa.muros ?? []), ...nuevos] } }),
            onCambiar: (muro) => sala.enviar({ tipo: 'editar-mapa', cambios: { muros: (estado.mapa.muros ?? []).map((m) => (m.id === muro.id ? muro : m)) } }),
            onBorrar: (id) => sala.enviar({ tipo: 'editar-mapa', cambios: { muros: (estado.mapa.muros ?? []).filter((m) => m.id !== id) } }),
            onLuz: (c) => {
              const luces = estado.mapa.luces ?? [];
              const hay = luces.find((l) => l.x === c.x && l.y === c.y);
              sala.enviar({ tipo: 'editar-mapa', cambios: { luces: hay ? luces.filter((l) => l !== hay) : [...luces, { id: crypto.randomUUID().slice(0, 12), x: c.x, y: c.y, brillante: 20, tenue: 20 }] } });
            },
            onPintar: (casillas, revelar) => {
              const { columnas, filas } = estado.mapa;
              const exploradas = deMascara(estado.mapa.exploradas, columnas, filas);
              for (const c of casillas) { if (revelar) exploradas.add(`${c.x},${c.y}`); else exploradas.delete(`${c.x},${c.y}`); }
              sala.enviar({ tipo: 'editar-mapa', cambios: { exploradas: aMascara(exploradas, columnas, filas) } });
            },
          } : null}
          oscuridad={oscuridadGM}
        />
        {herramientaMuros && (
          // Empieza después de los botones del tablero (zoom, Centrar, Medir) para no taparlos
          <div className="pointer-events-none absolute top-3 right-3 left-[350px] z-30 flex justify-center">
            <BarraMuros herramienta={herramientaMuros} onElegir={setHerramientaMuros} onListo={() => setHerramientaMuros(null)} />
          </div>
        )}
        {combate && <OrdenEscrito estado={estado} combate={combate} conPanel={!!cajon} onEnfocar={(tokenId) => { setEnfoque((x) => ({ tokenId, n: (x?.n ?? 0) + 1 })); }} />}
        {eligiendo && actor && <BandaElegir fila={{ nombre: `${actor.nombre}: ${eligiendo.nombre}` }} rango={rango} onCancelar={() => setEligiendo(null)}
          className={actor ? (plegada ? 'bottom-[92px]' : 'bottom-[322px]') : 'bottom-4'} />}

        {/* Los paneles del GM, como pestañas de índice a la izquierda */}
        {/* Compañeros y paneles en una columna que termina antes de la hoja de la criatura (si no cabe, sigue en otra);
            con poco alto, solo los iconos (el nombre sale al pasar el cursor) */}
        <div className={`pointer-events-none absolute top-[96px] left-3 z-20 hidden gap-2 lg:flex ${actor ? (plegada ? 'bottom-[96px]' : 'bottom-[336px]') : 'bottom-4'}`}>
          <Companeros estado={estado} presentes={sala.presentes} className="pointer-events-auto max-h-full overflow-hidden"
            onEnfocar={(tokenId) => setEnfoque((x) => ({ tokenId, n: (x?.n ?? 0) + 1 }))} />
          <nav aria-label="Paneles del GM" className="flex max-h-full flex-col flex-wrap content-start items-start gap-1.5">
            {CAJONES.map((c) => (
              <button key={c.clave} onClick={() => setCajon(cajon === c.clave ? null : c.clave)} aria-pressed={cajon === c.clave} aria-label={c.nombre} title={`${c.nombre} (${c.tecla})`}
                className={`pointer-events-auto flex h-10 min-w-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-2.5 font-titulo text-[14px] shadow-[0_4px_10px_-6px_var(--sombra)] transition [@media(min-height:820px)]:justify-start ${cajon === c.clave ? 'border-acento bg-acento text-sobre-acento' : 'border-borde bg-superficie hover:border-acento hover:text-acento'}`}>
                {c.icono}<span className="hidden [@media(min-height:820px)]:inline">{c.nombre}</span>
                <span className="ml-0.5 hidden xl:[@media(min-height:820px)]:inline"><Tecla sobreTinta={cajon === c.clave}>{c.tecla}</Tecla></span>
              </button>
            ))}
          </nav>
        </div>
        {/* En el teléfono, los paneles van en una fila abajo */}
        {!actor && (
          <nav aria-label="Paneles del GM" className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-dashed border-borde bg-fondo/95 lg:hidden">
            {CAJONES.map((c) => (
              <button key={c.clave} onClick={() => setCajon(c.clave)} className="flex flex-col items-center gap-0.5 py-2 font-titulo text-[11.5px] text-texto-suave">
                {c.icono}{c.nombre}
              </button>
            ))}
          </nav>
        )}

        {!actor && !cajon && !pistaVista && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex justify-center px-4 lg:bottom-4">
            <p className="tarjeta pointer-events-auto flex max-w-md items-center gap-2 py-2 pr-2 pl-4 text-center font-titulo text-[14px] text-texto-suave">
              <span>
              Toca una criatura para manejarla. {tokens.some((t) => !t.personajeId) ? '' : 'Pon algunas desde el '}
              {!tokens.some((t) => !t.personajeId) && <button className="font-bold text-acento underline decoration-dotted" onClick={() => setCajon('bestiario')}>Compendio</button>}
              {combate ? '' : ' · Para pelear, abre Combate.'}
              </span>
              <button className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-superficie-2" aria-label="No mostrar más" onClick={verPista}>
                <XIcon size={14} aria-hidden />
              </button>
            </p>
          </div>
        )}

        {actor && (
          <HojaCriatura estado={estado} actor={actor} plegada={plegada} onPlegar={() => setPlegada(!plegada)} numero={numero}
            onAtacar={(a) => atacar(a, objetivoId ?? undefined)} onAsomar={setAsomado}
            onQuitarEfecto={(efectoId) => sala.enviar({ tipo: 'quitar-efecto', tokenId: actor.id, efectoId })}
            onDano={(a, critico) => tirarDano(actor.id, a, critico, objetivoId ?? undefined)}
            onChequeo={(clave) => {
              const p = actor.personajeId ? estado.personajes[actor.personajeId] : undefined;
              if (p) sala.tirar(p.id, clave === 'percepcion' ? { tipo: 'percepcion' } : { tipo: 'salvacion', clave });
              else sala.tirar(undefined, { tipo: 'chequeo-criatura', tokenId: actor.id, clave });
            }}
            onSkill={(nombre, bono) => sala.tirar(undefined, { tipo: 'libre', expresion: `1d20${bono >= 0 ? '+' : ''}${bono}`, etiqueta: `${actor.nombre}: ${nombre}` }, nombre)}
            onPG={(delta) => cambiarPG(actor.id, delta)}
            onCondiciones={() => setCondicionesDe(actor.id)}
            onEditar={() => {
              const p = actor.personajeId ? estado.personajes[actor.personajeId] : undefined;
              if (p) setEditandoP(p);
              else setEditandoCriatura(actor.id);
            }}
            onTerminar={() => sala.enviar({ tipo: 'avanzar-turno' })}
            onEsperar={() => sala.enviar({ tipo: 'demorar', tokenId: actor.id })}
            onVolver={() => sala.enviar({ tipo: 'volver-de-demora', tokenId: actor.id })}
            onCerrar={() => { setActorId(null); setObjetivoId(null); setEligiendo(null); }} />
        )}

        {cajon && (
          <aside className={`absolute top-0 right-0 z-30 flex w-full flex-col border-l border-borde bg-fondo shadow-[-20px_0_40px_-20px_var(--sombra)] sm:w-[440px] ${actor ? (plegada ? 'bottom-0 lg:bottom-[92px] lg:rounded-bl-xl lg:border-b' : 'bottom-0 lg:bottom-[332px] lg:rounded-bl-xl lg:border-b') : 'bottom-0'}`}>
            {/* El título entero arriba; las pestañas, como iconos con su nombre al pasar el cursor */}
            <div className="flex items-center gap-2 px-4 pt-3">
              <h2 className="flex min-w-0 items-center gap-2 font-titulo text-[22px] font-bold text-acento">
                {CAJONES.find((c) => c.clave === cajon)?.icono}<span className="truncate">{CAJONES.find((c) => c.clave === cajon)?.nombre}</span>
              </h2>
              <button className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={() => setCajon(null)} aria-label="Cerrar">
                <XIcon size={18} aria-hidden />
              </button>
            </div>
            <nav aria-label="Paneles del GM" className="flex gap-1 border-b border-dashed border-borde px-3 pt-1 pb-2">
              {CAJONES.map((c) => (
                <button key={c.clave} onClick={() => setCajon(c.clave)} aria-pressed={cajon === c.clave} aria-label={c.nombre} title={`${c.nombre} (${c.tecla})`}
                  className={`flex size-10 items-center justify-center rounded-lg transition ${cajon === c.clave ? 'bg-acento/12 text-acento' : 'text-texto-suave hover:bg-superficie-2 hover:text-texto'}`}>
                  {c.icono}
                </button>
              ))}
            </nav>
            <div className="flex-1 overflow-y-auto p-4">{panel(cajon)}</div>
          </aside>
        )}
      </div>

      <AvisoTirada tiradas={estado.tiradas} verCd pendiente={sala.pendiente}
        lugar={`top-[120px] lg:top-auto lg:inset-x-auto lg:right-6 ${actor ? (plegada ? 'lg:bottom-[104px]' : 'lg:bottom-[340px]') : 'lg:bottom-6'}`} />
      <TituloEscena eventos={sala.eventos} />
      <PilaAvisos avisos={avisos} onCerrar={cerrarAviso}
        className={`fixed inset-x-3 top-[60px] z-[60] lg:inset-x-auto lg:w-[340px] ${combate ? 'lg:top-[118px]' : 'lg:top-[72px]'} ${cajon ? 'lg:right-[464px]' : 'lg:right-6'}`} />

      {/* Preparando un combate: cuántos están listos y tirar sin abrir el panel; al empezar, el orden de juego */}
      <div className={`pointer-events-none fixed left-0 top-[60px] z-30 flex flex-col items-center gap-2 px-4 ${cajon ? 'right-0 lg:right-[440px]' : 'right-0'}`}>
        {estado.preparacion && !estado.combate && (() => {
          const pr = estado.preparacion;
          const jugadores = pr.tokens.filter((id) => estado.tokens[id]?.personajeId);
          const listos = jugadores.filter((id) => pr.listos.includes(id)).length;
          return (
            <div className="tarjeta-cae tarjeta pointer-events-auto flex items-center gap-3 px-4 py-2 lg:ml-[296px]" role="status">
              <SwordIcon size={18} weight="bold" className="text-peligro" aria-hidden />
              <p className="font-titulo text-[15px]">Preparando combate · {listos} de {jugadores.length} listos</p>
              <button className="boli h-9 border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10" onClick={() => sala.iniciarCombate(pr.tokens)}>
                Tirar iniciativa
              </button>
            </div>
          );
        })()}
        {estado.telon && (
          <div className="tarjeta-cae tarjeta pointer-events-auto flex items-center gap-3 px-4 py-2 lg:ml-[296px]" role="status">
            <p className="font-titulo text-[15px] whitespace-nowrap" title="Los jugadores no ven el tablero"><b>Telón bajo</b> · {estado.escena?.nombre ?? 'Primera escena'}</p>
            <button className="boli h-9 shrink-0 whitespace-nowrap border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10" onClick={() => sala.enviar({ tipo: 'telon', bajo: false })}>
              Subir el telón
            </button>
          </div>
        )}
        <OrdenRevelado estado={estado} eventos={sala.eventos} className="mt-10 lg:mt-14 lg:ml-[180px] lg:self-start" />
      </div>

      {/* Un jugador está decidiendo si reacciona: el GM lo ve y puede seguir sin esperar */}
      {estado.esperas.map((e) => (
        <div key={e.id} className="fixed inset-x-0 top-[60px] z-40 flex justify-center px-4" role="status">
          <div className="tarjeta flex items-center gap-3 px-4 py-2.5">
            <p className="font-titulo text-[15px]">{e.atacante} ataca a {estado.tokens[e.objetivoTokenId]?.nombre}: esperando si reacciona…</p>
            <button className="boli h-9 border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10" onClick={() => sala.responder(e.id, null)}>
              Seguir sin reacción
            </button>
          </div>
        </div>
      ))}

      {bienvenida && (
        <Bienvenida salaId={salaId} codigoGM={codigoGM} onCerrar={cerrarBienvenida}
          onIr={(c) => {
            cerrarBienvenida();
            setCajon(c);
            // El mapa está más abajo en el panel de la mesa: se baja hasta él cuando el panel ya se dibujó
            if (c === 'mesa') setTimeout(() => document.getElementById('mesa-mapa')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
          }} />
      )}
      {codigos && (
        <div className="fixed top-[64px] right-4 z-40 w-[300px]">
          <Codigos salaId={salaId} codigoGM={codigoGM} onCerrar={() => setCodigos(false)} />
        </div>
      )}
      {editandoCriatura && estado.tokens[editandoCriatura] && (
        <EditorCriatura salaId={salaId} token={estado.tokens[editandoCriatura]!} enviar={sala.enviar} onCerrar={() => setEditandoCriatura(null)} />
      )}
      {condicionesDe && estado.tokens[condicionesDe] && (
        <ModalCondiciones condiciones={estado.tokens[condicionesDe]!.condiciones ?? []} de={estado.tokens[condicionesDe]!.nombre} onCerrar={() => setCondicionesDe(null)}
          onPoner={(clave, valor) => sala.enviar({ tipo: 'poner-condicion', tokenId: condicionesDe, clave, valor: Math.max(0, valor) })} />
      )}
      {editandoP && estado.personajes[editandoP.id] && (
        <EditarPersonaje salaId={salaId} sala={sala} personaje={estado.personajes[editandoP.id]!} onCerrar={() => setEditandoP(null)} />
      )}
      {ayuda && <AyudaTeclas filas={TECLAS_GM} onCerrar={() => setAyuda(false)} />}
    </div>
  );
}

// La primera vez en una mesa nueva: qué compartir, qué guardar y los tres pasos para empezar a jugar
function Bienvenida({ salaId, codigoGM, onCerrar, onIr }: { salaId: string; codigoGM: string | null; onCerrar: () => void; onIr: (c: 'personajes' | 'bestiario' | 'mesa') => void }) {
  const [copiado, setCopiado] = useState(false);
  const pasos: ['personajes' | 'bestiario' | 'mesa', string, string][] = [
    ['personajes', 'Personajes', 'Comparte el link: cada jugador crea el suyo (o lo importa de Pathbuilder). También puedes crearlos tú.'],
    ['bestiario', 'Criaturas', 'Busca en el compendio y ponlas en el tablero con un toque.'],
    ['mesa', 'Mapa', 'Sube la imagen de tu mapa, dibuja muros y puertas, y elige la luz.'],
  ];
  return (
    <Modal titulo="Tu mesa está lista" subtitulo="Lo que necesitas para empezar a jugar." onCerrar={onCerrar}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-borde bg-superficie px-3 py-2.5">
            <p className="font-titulo text-[13px] text-texto-suave">Para los jugadores</p>
            <p className="font-mono text-[24px] font-bold tracking-widest">{salaId.toUpperCase()}</p>
            <button className="boli mt-1 flex h-9 items-center gap-1.5 border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10"
              onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}/sala/${salaId}`); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin portapapeles */ } }}>
              <CopyIcon size={16} aria-hidden /> {copiado ? 'Link copiado' : 'Copiar el link'}
            </button>
          </div>
          {codigoGM && (
            <div className="rounded-lg border-[1.5px] border-[var(--postit)] bg-superficie px-3 py-2.5">
              <p className="font-titulo text-[13px] text-texto-suave">Tu código de GM: guárdalo</p>
              <p className="font-mono text-[24px] font-bold tracking-widest">{codigoGM}</p>
              <p className="text-[12.5px] leading-snug text-texto-suave">Lo necesitas para volver como GM desde otro aparato. En este navegador queda en «Tus mesas». No lo compartas.</p>
            </div>
          )}
        </div>
        <ol className="flex flex-col gap-2">
          {pasos.map(([c, nombre, texto], i) => (
            <li key={c}>
              <button className="flex w-full items-start gap-3 rounded-lg border border-borde px-3 py-2 text-left hover:border-acento" onClick={() => onIr(c)}>
                <span className="font-titulo text-[20px] font-bold text-acento">{i + 1}</span>
                <span><b className="font-titulo text-[16px]">{nombre}</b><span className="block text-[13px] text-texto-suave">{texto}</span></span>
              </button>
            </li>
          ))}
        </ol>
        <button className="boli h-11 bg-acento font-titulo text-[16px] font-bold text-sobre-acento" onClick={onCerrar}>A la mesa</button>
        <p className="-mt-2 text-center text-[12.5px] text-texto-suave">Los códigos siguen en el botón «Códigos», arriba.</p>
      </div>
    </Modal>
  );
}

// Los códigos para compartir, en una nota que se despliega desde la cabecera
function Codigos({ salaId, codigoGM, onCerrar }: { salaId: string; codigoGM: string | null; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="tarjeta aviso-entra px-4 py-3">
      <div className="flex items-start justify-between">
        <p className="font-titulo text-[13px] text-texto-suave">Código de la mesa</p>
        <button className="-mt-1 -mr-2 flex size-8 items-center justify-center rounded-lg text-texto-suave hover:bg-superficie-2" onClick={onCerrar} aria-label="Cerrar"><XIcon size={16} /></button>
      </div>
      <p className="font-mono text-[26px] font-bold tracking-widest">{salaId.toUpperCase()}</p>
      <button className="boli mt-1 flex h-9 items-center gap-1.5 border-[1.5px] border-acento px-3 font-titulo text-[14px] font-semibold text-acento hover:bg-acento/10"
        onClick={async () => { await navigator.clipboard.writeText(`${location.origin}/sala/${salaId}`); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}>
        <CopyIcon size={16} aria-hidden /> {copiado ? 'Link copiado' : 'Copiar link para los jugadores'}
      </button>
      {codigoGM && (
        <>
          <p className="mt-3 font-titulo text-[13px] text-texto-suave">Tu código de GM (no lo compartas)</p>
          <p className="font-mono text-[22px] font-bold tracking-widest">{codigoGM}</p>
        </>
      )}
    </div>
  );
}

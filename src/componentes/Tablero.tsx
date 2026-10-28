import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Circle, Group, Image as ImagenKonva, Label, Layer, Line, Rect, Shape, Stage, Tag, Text } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { CornersInIcon, MinusIcon, PlusIcon, RulerIcon } from '@phosphor-icons/react';
import { calcular } from '../../reglas/pf2e';
import { alcanzables, caminoA, clave, desdeClave, distanciaEntre, type Casilla, type Paso } from '../../reglas/movimiento';
import { areaTexto, casillasDeArea, distanciaAEsquina, tocados, type Area } from '../../reglas/areas';
import type { EfectoActivo } from '../../reglas/efectos';
import { TINTA_ASPECTO } from './aspectos';
import {
  COLORES_TOKEN, ladoDe, opcionesMovimiento, puedeMoverToken, TAMANOS, tokenEnTurno, velocidadDe,
  type EstadoSala, type Sesion, type Token,
} from '../../compartido/sala';
import { resumenCondiciones } from './Condiciones';
import { estadoDeSalud } from '../../reglas/criaturas';
import type { ColoresTablero } from '../tema';
import type { Evento } from '../../compartido/eventos';
import { EfectosTablero } from './Efectos';
import { PresenciaTablero, tintaDe as tintaDePresencia } from './Presencia';
import { DibujoRegla } from './Regla';
import { FondoTerreno } from './Terreno';
import { CapaNiebla, DibujoMuros, distanciaAMuro } from './Muros';
import { CapaOscuridad, DibujoLuces } from './Luz';
import { habitacion, type Muro } from '../../compartido/vision';
import type { PunteroAjeno, Senal } from '../conexion';
import type { Regla } from '../../compartido/sala';

interface Props {
  estado: EstadoSala;
  colores: ColoresTablero;
  quien: Sesion;
  // Lo que tapa la hoja del jugador abajo: se encuadra en lo que queda visible
  margenInferior?: number;
  // El token que mueve quien mira: en su turno se marcan las casillas a las que llega y la ruta.
  // `libres` son sus acciones (null fuera de combate: se mueve sin costo).
  movimiento?: { tokenId: string; libres: number | null } | null;
  // Línea punteada de un token a su objetivo
  apunta?: { desde: string; hasta: string } | null;
  // Lo que acaba de pasar: se dibuja encima (golpes, impactos, números de daño, el camino recorrido)
  eventos?: { id: number; evento: Evento }[];
  // Un menú pegado a un token (las opciones contra un enemigo)
  menu?: { tokenId: string; contenido: ReactNode } | null;
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
  onMover: (id: string, x: number, y: number) => void;
  // Avisa en la propia pantalla por qué no se pudo (soltar un token donde no llega)
  onNegar?: (motivo: string) => void;
  // Hasta dónde llega una acción desde un token: se sombrea y se marcan los tokens que quedan dentro
  rango?: { tokenId: string; pies: number; etiqueta: string } | null;
  // Los demás en la mesa (punteros, objetivos, señales) y cómo mandar los propios
  presencia?: { punteros: PunteroAjeno[]; senales: Senal[] };
  onPuntero?: (x: number | null, y: number | null) => void;
  // Lo que mido con la regla (los demás lo ven)
  onMedir?: (regla: Regla | null) => void;
  onSenal?: (x: number, y: number) => void;
  // Centrar la vista en un token (cada pedido nuevo trae otro `n`)
  enfocar?: { tokenId: string; n: number } | null;
  // Un token que la vista sigue: si sale de lo que se ve, se centra en él
  seguir?: string;
  // Un área por colocar (Fireball): sigue al puntero y marca a quién toca; tocar el tablero la lanza ahí
  // `aliados`: solo alcanza a los del bando de quien la lanza (y `soloOtros`: no a él mismo)
  plantilla?: { tokenId: string; area: Area; alcance?: number; etiqueta: string; color?: string; aliados?: boolean; soloOtros?: boolean } | null;
  onPunto?: (punto: Casilla) => void;
  // Los ya elegidos para algo de varios objetivos (Electric Arc)
  marcados?: string[];
  // Mientras se apunta: sobre cada token, si sirve como objetivo y qué se tira contra él (o por qué no)
  pistas?: Record<string, { valido: boolean; texto: string }> | null;
  // La niebla de guerra: lo que se ve ahora y lo ya explorado. `opaca` para los jugadores; el GM la ve como velo
  niebla?: { visibles: Set<string>; exploradas: Set<string>; opaca: boolean } | null;
  // Tocar una puerta la abre o la cierra
  onPuerta?: (id: string) => void;
  // El GM dibujando muros: con qué herramienta, y qué hacer con lo dibujado
  editorMuros?: {
    herramienta: HerramientaMuros;
    onAgregar: (muros: Muro[]) => void;
    onCambiar: (muro: Muro) => void;
    onBorrar: (id: string) => void;
    // Pone o quita un brasero en esa casilla
    onLuz: (c: Casilla) => void;
    // El pincel de niebla: revela (o vuelve a cubrir) esas casillas como exploradas
    onPintar?: (casillas: Casilla[], revelar: boolean) => void;
  } | null;
  // Cuánta oscuridad hay en cada casilla (0 nada, 1 negro): el GM ve la luz real; un jugador, lo que ve apagado
  oscuridad?: ((k: string) => number) | null;
}

export type HerramientaMuros = 'muro' | 'puerta' | 'ventana' | 'habitacion' | 'llave' | 'luz' | 'borrar' | 'revelar' | 'cubrir';

// Mantener presionado este tiempo (sin mover) lanza una señal
const SENAL_MS = 450;

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;
const PASO_MS = 120;

export function Tablero({
  estado, colores, quien, margenInferior = 0, movimiento = null, apunta = null, eventos = [], menu = null,
  seleccionado, onSeleccionar, onMover, onNegar, rango = null, presencia, onPuntero, onMedir, onSenal, enfocar = null, seguir,
  plantilla = null, onPunto, marcados = [], pistas = null, niebla = null, onPuerta, editorMuros = null, oscuridad = null,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
  const [vista, setVista] = useState({ x: 0, y: 0, escala: 1 });
  const [imagenMapa] = useImage(estado.mapa.imagen || '', 'anonymous');
  const ajustado = useRef<string | null>(null);
  // La casilla bajo el token que se arrastra: de ahí sale la ruta que se dibuja
  const [apuntada, setApuntada] = useState<Casilla | null>(null);
  // Mientras se lleva el token propio, se ven las casillas a las que llega
  const [arrastrando, setArrastrando] = useState(false);
  // La primera vez, el token propio dice "arrástrame"; después ya se sabe
  const [yaArrastro, setYaArrastro] = useState(false);

  const { mapa } = estado;
  const celda = mapa.tamanoCelda;
  const origen = { x: mapa.desplazamientoX % celda, y: mapa.desplazamientoY % celda };
  const enTurno = tokenEnTurno(estado)?.id ?? null;
  const ancho = imagenMapa ? imagenMapa.width : mapa.columnas * celda;
  const alto = imagenMapa ? imagenMapa.height : mapa.filas * celda;
  // El rectángulo del tablero: la imagen del mapa, o las columnas × filas de la cuadrícula
  const borde = imagenMapa ? { x: 0, y: 0, w: ancho, h: alto } : { x: origen.x, y: origen.y, w: ancho, h: alto };

  // A dónde llega el token que se mueve, con el camino más corto a cada casilla (en combate: hasta 2 Strides)
  const tokenMovil = movimiento ? estado.tokens[movimiento.tokenId] : undefined;
  const velocidad = tokenMovil ? velocidadDe(estado, tokenMovil) : 25;
  const zona = useMemo(() => {
    if (!tokenMovil || movimiento?.libres == null || movimiento.libres <= 0) return null;
    const tramos = Math.min(2, movimiento.libres);
    return alcanzables({ x: tokenMovil.x, y: tokenMovil.y }, velocidad * tramos, opcionesMovimiento(estado, tokenMovil));
  }, [tokenMovil, movimiento?.libres, velocidad, estado]);

  // El último movimiento de cada token, para recorrer su camino en vez de saltar
  const recorridos = useMemo(() => {
    const m = new Map<string, { id: number; camino: Casilla[] }>();
    for (const { id, evento } of eventos) {
      if (evento.tipo === 'movimiento' && evento.camino) m.set(evento.tokenId, { id, camino: evento.camino });
    }
    return m;
  }, [eventos]);

  useEffect(() => {
    const div = contenedor.current;
    if (!div) return;
    // Medida inicial ya: en una pestaña en segundo plano el ResizeObserver no avisa hasta que se ve
    setMedida({ ancho: div.clientWidth, alto: div.clientHeight });
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setMedida({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height });
    });
    observador.observe(div);
    return () => observador.disconnect();
  }, []);

  // Encuadra el tablero entero si cabe a un zoom legible; si es muy grande, a los tokens (con aire alrededor)
  function centrar() {
    const visible = Math.max(120, medida.alto - margenInferior);
    // En pantalla grande, a la izquierda van los retratos y los botones de paneles: se encuadra a su derecha
    const izquierda = medida.ancho >= 1024 ? 240 : 0;
    const libre = medida.ancho - izquierda;
    const entero = Math.min(libre / ancho, visible / alto) * 0.92;
    const tokens = entero >= 0.5 ? [] : Object.values(estado.tokens);
    const caja = tokens.length
      ? tokens.reduce((c, t) => {
        const lado = TAMANOS[t.tamano] * celda;
        const x = origen.x + t.x * celda;
        const y = origen.y + t.y * celda;
        return { x0: Math.min(c.x0, x), y0: Math.min(c.y0, y), x1: Math.max(c.x1, x + lado), y1: Math.max(c.y1, y + lado) };
      }, { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity })
      : { x0: 0, y0: 0, x1: ancho, y1: alto };
    const aire = tokens.length ? celda * 3 : 0;
    const w = caja.x1 - caja.x0 + aire * 2;
    const h = caja.y1 - caja.y0 + aire * 2;
    const escala = Math.min(1.6, Math.min(libre / w, visible / h) * 0.92);
    const cx = (caja.x0 + caja.x1) / 2;
    const cy = (caja.y0 + caja.y1) / 2;
    setVista({ escala, x: izquierda + libre / 2 - cx * escala, y: visible / 2 - cy * escala });
  }

  // Encuadra el tablero completo al entrar y cada vez que cambia el mapa
  useEffect(() => {
    const k = `${mapa.imagen ?? ''}|${ancho}x${alto}`;
    if (!medida.ancho || ajustado.current === k) return;
    if (mapa.imagen && !imagenMapa) return;
    ajustado.current = k;
    centrar();
  }, [medida, ancho, alto, mapa.imagen, imagenMapa]);

  // Lleva la vista hasta un token, deslizándose (o de golpe si se pidió menos movimiento)
  const vistaRef = useRef(vista);
  vistaRef.current = vista;
  const animacion = useRef(0);
  function irA(tokenId: string, soloSiNoSeVe = false) {
    const t = estado.tokens[tokenId];
    if (!t || !medida.ancho) return;
    const visible = Math.max(120, medida.alto - margenInferior);
    const lado = TAMANOS[t.tamano] * celda;
    const cx = origen.x + t.x * celda + lado / 2;
    const cy = origen.y + t.y * celda + lado / 2;
    const v0 = vistaRef.current;
    if (soloSiNoSeVe) {
      const sx = cx * v0.escala + v0.x;
      const sy = cy * v0.escala + v0.y;
      if (sx > 60 && sx < medida.ancho - 60 && sy > 60 && sy < visible - 60) return;
    }
    const destino = { escala: v0.escala, x: medida.ancho / 2 - cx * v0.escala, y: visible / 2 - cy * v0.escala };
    cancelAnimationFrame(animacion.current);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setVista(destino);
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const k = Math.min(1, (ahora - inicio) / 420);
      const e = 1 - Math.pow(1 - k, 3);
      setVista({ escala: v0.escala, x: v0.x + (destino.x - v0.x) * e, y: v0.y + (destino.y - v0.y) * e });
      if (k < 1) animacion.current = requestAnimationFrame(paso);
    };
    animacion.current = requestAnimationFrame(paso);
  }
  useEffect(() => {
    if (enfocar) irA(enfocar.tokenId);
  }, [enfocar?.n]);
  const seguido = seguir ? estado.tokens[seguir] : undefined;
  useEffect(() => {
    if (seguido) irA(seguido.id, true);
  }, [seguido?.x, seguido?.y]); // eslint-disable-line react-hooks/exhaustive-deps
  // La cámara sigue el turno: si le toca a alguien que no se ve, va hacia él
  const turnoVisto = useRef(eventos.at(-1)?.id ?? 0);
  useEffect(() => {
    const nuevos = eventos.filter((e) => e.id > turnoVisto.current);
    if (!nuevos.length) return;
    turnoVisto.current = nuevos.at(-1)!.id;
    const turno = nuevos.reverse().find((e) => e.evento.tipo === 'turno');
    if (turno && turno.evento.tipo === 'turno') irA(turno.evento.tokenId, true);
  }, [eventos]);

  function alHacerZoom(evento: Konva.KonvaEventObject<WheelEvent>) {
    evento.evt.preventDefault();
    const stage = evento.target.getStage();
    const puntero = stage?.getPointerPosition();
    if (!puntero) return;
    const factor = evento.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
    const escala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vista.escala * factor));
    // Mantiene fijo el punto bajo el cursor
    const mundo = { x: (puntero.x - vista.x) / vista.escala, y: (puntero.y - vista.y) / vista.escala };
    setVista({ escala, x: puntero.x - mundo.x * escala, y: puntero.y - mundo.y * escala });
  }

  // Casilla (esquina del token que se mueve) bajo un punto de la pantalla
  function casillaEn(px: number, py: number): Casilla {
    const lado = tokenMovil ? TAMANOS[tokenMovil.tamano] : 1;
    const mx = (px - vista.x) / vista.escala - origen.x;
    const my = (py - vista.y) / vista.escala - origen.y;
    // Para un token grande, el puntero queda en su centro
    return { x: Math.floor(mx / celda - (lado - 1) / 2), y: Math.floor(my / celda - (lado - 1) / 2) };
  }

  // Punto de la pantalla → posición en casillas (con decimales), para punteros y señales
  const enCasillas = (px: number, py: number) => ({
    x: ((px - vista.x) / vista.escala - origen.x) / celda,
    y: ((py - vista.y) / vista.escala - origen.y) / celda,
  });

  // El pincel de niebla (GM): mientras se aprieta, junta casillas de a 3×3; al soltar, se revelan o se cubren
  const pincel = editorMuros?.herramienta === 'revelar' || editorMuros?.herramienta === 'cubrir';
  const [pintadas, setPintadas] = useState<Set<string> | null>(null);
  const pintarEn = (px: number, py: number) => {
    const m = enCasillas(px, py);
    const cx = Math.floor(m.x);
    const cy = Math.floor(m.y);
    setPintadas((antes) => {
      const s = new Set(antes ?? []);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s.add(`${cx + dx},${cy + dy}`);
      return s;
    });
  };

  // Con el teclado: las flechas mueven un cursor desde tu token (o el elegido), Enter lo lleva ahí, Esc lo quita.
  // La regla muestra la distancia mientras tanto
  const tokenTeclado = (quien.rol === 'jugador' ? Object.values(estado.tokens).find((t) => t.personajeId === quien.personajeId) : undefined)
    ?? (seleccionado ? estado.tokens[seleccionado] : undefined);
  const [cursor, setCursor] = useState<Casilla | null>(null);
  useEffect(() => setCursor(null), [tokenTeclado?.id, tokenTeclado?.x, tokenTeclado?.y]);
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || !tokenTeclado) return;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (document.querySelector('[aria-modal]')) return;
      const pasos: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      const paso = pasos[e.key];
      if (paso) {
        e.preventDefault();
        setCursor((c) => {
          const base = c ?? { x: tokenTeclado.x, y: tokenTeclado.y };
          return { x: Math.max(0, Math.min(mapa.columnas - 1, base.x + paso[0])), y: Math.max(0, Math.min(mapa.filas - 1, base.y + paso[1])) };
        });
      } else if (e.key === 'Enter' && cursor) {
        e.preventDefault();
        if (puedeMoverToken(quien, tokenTeclado)) onMover(tokenTeclado.id, cursor.x, cursor.y);
        setCursor(null);
      } else if (e.key === 'Escape' && cursor) {
        setCursor(null);
      }
    };
    addEventListener('keydown', alPulsar);
    return () => removeEventListener('keydown', alPulsar);
  });

  // La regla para medir: con el botón queda puesta (cada arrastre mide); con Ctrl + arrastrar, mide una vez.
  // Lo medido queda a la vista hasta el próximo toque o Esc.
  const [modoRegla, setModoRegla] = useState(false);
  const [regla, setRegla] = useState<Regla | null>(null);
  const [midiendo, setMidiendo] = useState(false);
  useEffect(() => { onMedir?.(regla); }, [regla]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') { setRegla(null); setModoRegla(false); setMidiendo(false); } };
    addEventListener('keydown', alPulsar);
    return () => removeEventListener('keydown', alPulsar);
  }, []);
  const casillaRegla = (px: number, py: number): Casilla => { const m = enCasillas(px, py); return { x: Math.floor(m.x), y: Math.floor(m.y) }; };

  // Mantener presionado: señal. Si se suelta antes, se mueve o se arrastra, no pasa nada.
  const presion = useRef<{ x: number; y: number; espera: ReturnType<typeof setTimeout> } | null>(null);
  const senalHecha = useRef(false);
  function alPresionar(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    soltarPresion();
    if (pincel && !('button' in e.evt && e.evt.button !== 0)) {
      const p = e.target.getStage()?.getPointerPosition();
      if (!p) return;
      e.target.getStage()?.stopDrag();
      pintarEn(p.x, p.y);
      return;
    }
    const conCtrl = 'ctrlKey' in e.evt && (e.evt.ctrlKey || e.evt.metaKey);
    if ((modoRegla || conCtrl) && !('button' in e.evt && e.evt.button !== 0)) {
      const p = e.target.getStage()?.getPointerPosition();
      if (!p) return;
      e.target.getStage()?.stopDrag();
      const c = casillaRegla(p.x, p.y);
      setRegla({ a: c, b: c });
      setMidiendo(true);
      return;
    }
    if (!onSenal || ('button' in e.evt && e.evt.button !== 0)) return;
    const p = e.target.getStage()?.getPointerPosition();
    if (!p) return;
    presion.current = {
      x: p.x, y: p.y,
      espera: setTimeout(() => {
        presion.current = null;
        senalHecha.current = true;
        const c = enCasillas(p.x, p.y);
        onSenal(c.x, c.y);
        navigator.vibrate?.(20);
      }, SENAL_MS),
    };
  }
  function soltarPresion() {
    if (presion.current) clearTimeout(presion.current.espera);
    presion.current = null;
  }
  // Al soltar: la regla queda a la vista (si no se movió, se borra)
  function alSoltar() {
    soltarPresion();
    if (pintadas) {
      const casillas = [...pintadas].map((k) => { const [x, y] = k.split(',').map(Number) as [number, number]; return { x, y }; })
        .filter((c) => c.x >= 0 && c.y >= 0 && c.x < mapa.columnas && c.y < mapa.filas);
      editorMuros?.onPintar?.(casillas, editorMuros.herramienta === 'revelar');
      setPintadas(null);
    }
    if (!midiendo) return;
    setMidiendo(false);
    setRegla((r) => (r && (r.a.x !== r.b.x || r.a.y !== r.b.y) ? r : null));
  }
  // Tras una señal, el clic que viene al soltar no cuenta
  const consumirSenal = () => {
    if (!senalHecha.current) return false;
    senalHecha.current = false;
    return true;
  };

  // El punto del área bajo el puntero: una esquina para la explosión, una casilla para el cono y la línea
  const [puntoArea, setPuntoArea] = useState<Casilla | null>(null);
  // El editor de muros: dónde empieza el tramo que se está dibujando y la esquina bajo el puntero
  const [inicioMuro, setInicioMuro] = useState<Casilla | null>(null);
  const [esquina, setEsquina] = useState<Casilla | null>(null);
  useEffect(() => { setInicioMuro(null); }, [editorMuros?.herramienta]);
  useEffect(() => {
    if (!editorMuros) return;
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') setInicioMuro(null); };
    addEventListener('keydown', alPulsar);
    return () => removeEventListener('keydown', alPulsar);
  }, [!!editorMuros]);
  const murosMapa = mapa.muros ?? [];
  // El muro más cercano a un punto (en casillas), si está a menos de `radio`
  const muroCerca = (p: { x: number; y: number }, radio: number, filtro: (m: Muro) => boolean = () => true) => {
    let mejor: Muro | null = null;
    let d = radio;
    for (const m of murosMapa) {
      if (!filtro(m)) continue;
      const dm = distanciaAMuro(p, m);
      if (dm < d) { d = dm; mejor = m; }
    }
    return mejor;
  };
  // Las herramientas que tocan algo (borrar, llave, luz) no dibujan tramos desde una esquina
  const borrando = editorMuros?.herramienta === 'borrar' || editorMuros?.herramienta === 'llave' || editorMuros?.herramienta === 'luz';
  const resaltado = editorMuros && esquina && borrando
    ? muroCerca(esquina, 0.4, editorMuros.herramienta === 'llave' ? (m) => m.tipo === 'puerta' : undefined)?.id ?? null : null;
  // Un clic del editor: empieza o termina un tramo, arma la habitación, borra o pone la llave
  function tocarEditor(px: number, py: number) {
    if (!editorMuros) return;
    const m = enCasillas(px, py);
    const h = editorMuros.herramienta;
    if (h === 'revelar' || h === 'cubrir') return;
    const casilla = { x: Math.floor(m.x), y: Math.floor(m.y) };
    if (h === 'luz') return editorMuros.onLuz(casilla);
    if (h === 'borrar' && (mapa.luces ?? []).some((l) => l.x === casilla.x && l.y === casilla.y) && !muroCerca(m, 0.25)) return editorMuros.onLuz(casilla);
    if (h === 'borrar' || h === 'llave') {
      const cerca = muroCerca(m, 0.4, h === 'llave' ? (x) => x.tipo === 'puerta' : undefined);
      if (!cerca) return;
      if (h === 'borrar') editorMuros.onBorrar(cerca.id);
      else editorMuros.onCambiar({ ...cerca, conLlave: !cerca.conLlave });
      return;
    }
    const c = { x: Math.round(m.x), y: Math.round(m.y) };
    if (!inicioMuro) return setInicioMuro(c);
    if (c.x === inicioMuro.x && c.y === inicioMuro.y) return setInicioMuro(null);
    const id = () => crypto.randomUUID().slice(0, 12);
    if (h === 'habitacion') {
      editorMuros.onAgregar(habitacion(inicioMuro, c, id));
      return setInicioMuro(null);
    }
    editorMuros.onAgregar([{ id: id(), a: inicioMuro, b: c, tipo: h, ...(h === 'puerta' ? { abierta: false } : {}) }]);
    // Los muros siguen encadenados desde donde terminó el tramo; puertas y ventanas van de a una
    setInicioMuro(h === 'muro' ? c : null);
  }
  useEffect(() => setPuntoArea(null), [plantilla?.tokenId, plantilla?.area.forma, plantilla?.area.tamano]);
  const puntoEn = (px: number, py: number): Casilla => {
    const m = enCasillas(px, py);
    return plantilla?.area.forma === 'explosion' ? { x: Math.round(m.x), y: Math.round(m.y) } : { x: Math.floor(m.x), y: Math.floor(m.y) };
  };
  // Con el mouse, tocar lanza; en el teléfono el primer toque coloca y el segundo (en el mismo lugar) lanza
  function tocarConPlantilla(px: number, py: number, tactil: boolean) {
    if (!plantilla || !onPunto) return;
    const c = plantilla.area.forma === 'emanacion' ? { x: 0, y: 0 } : puntoEn(px, py);
    if (tactil && plantilla.area.forma !== 'emanacion' && (!puntoArea || puntoArea.x !== c.x || puntoArea.y !== c.y)) return setPuntoArea(c);
    onPunto(c);
  }

  function alMoverPuntero(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const p = e.target.getStage()?.getPointerPosition();
    if (!p) return;
    if (pintadas) pintarEn(p.x, p.y);
    if (midiendo) {
      const c = casillaRegla(p.x, p.y);
      setRegla((r) => (r && (r.b.x !== c.x || r.b.y !== c.y) ? { ...r, b: c } : r));
    }
    if (plantilla && e.evt.type === 'mousemove') {
      const c = puntoEn(p.x, p.y);
      if (!puntoArea || puntoArea.x !== c.x || puntoArea.y !== c.y) setPuntoArea(c);
    }
    if (editorMuros) {
      const m = enCasillas(p.x, p.y);
      const c = borrando ? { x: m.x, y: m.y } : { x: Math.round(m.x), y: Math.round(m.y) };
      if (borrando || !esquina || esquina.x !== c.x || esquina.y !== c.y) setEsquina(c);
    }
    if (presion.current && Math.hypot(p.x - presion.current.x, p.y - presion.current.y) > 6) soltarPresion();
    if (onPuntero && e.evt.type === 'mousemove') {
      const m = enCasillas(p.x, p.y);
      onPuntero(Math.round(m.x * 100) / 100, Math.round(m.y * 100) / 100);
    }
  }

  const hayOtroToken = (c: Casilla) => Object.values(estado.tokens).some((t) => {
    if (t.id === tokenMovil?.id) return false;
    const n = ladoDe(t);
    return c.x >= t.x && c.x < t.x + n && c.y >= t.y && c.y < t.y + n;
  });

  // Tocar el papel vacío: suelta la selección (moverse es solo arrastrando el token)
  function alTocarFondo(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (consumirSenal()) return;
    // Midiendo, tocar solo mide (o borra lo medido)
    if (modoRegla || ('ctrlKey' in e.evt && (e.evt.ctrlKey || e.evt.metaKey))) return;
    if (regla) setRegla(null);
    // Alt + clic: señal al instante
    if ('altKey' in e.evt && e.evt.altKey && onSenal) {
      const p = e.target.getStage()?.getPointerPosition();
      if (p) { const c = enCasillas(p.x, p.y); onSenal(c.x, c.y); }
      return;
    }
    if (plantilla) {
      const p = e.target.getStage()?.getPointerPosition();
      if (p) tocarConPlantilla(p.x, p.y, e.type === 'tap');
      return;
    }
    if (editorMuros) {
      const p = e.target.getStage()?.getPointerPosition();
      if (p) tocarEditor(p.x, p.y);
      return;
    }
    // Tocar cerca de una puerta la abre o la cierra
    const pp = e.target.getStage()?.getPointerPosition();
    const puerta = pp && onPuerta ? muroCerca(enCasillas(pp.x, pp.y), 0.35, (m) => m.tipo === 'puerta') : null;
    if (puerta) return onPuerta!(puerta.id);
    if (e.target !== e.target.getStage() && e.target.name() !== 'fondo') return;
    onSeleccionar(null);
  }

  // Zoom con los botones: sobre el centro de lo que se ve
  function zoomEn(factor: number) {
    const visible = Math.max(120, medida.alto - margenInferior);
    const c = { x: medida.ancho / 2, y: visible / 2 };
    const escala = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, vista.escala * factor));
    const mundo = { x: (c.x - vista.x) / vista.escala, y: (c.y - vista.y) / vista.escala };
    setVista({ escala, x: c.x - mundo.x * escala, y: c.y - mundo.y * escala });
  }

  const motivoLejos = (c: Casilla) => {
    const ocupada = tokenMovil && Object.values(estado.tokens).some((t) => t.id !== tokenMovil.id && t.x === c.x && t.y === c.y);
    if (ocupada) return 'Esa casilla está ocupada.';
    const libres = movimiento?.libres ?? 0;
    return `Muy lejos: con ${libres >= 2 ? 'dos Strides' : 'un Stride'} llegas a ${velocidad * Math.min(2, libres)} ft.`;
  };

  // Posición en pantalla del centro de un token (para el menú)
  const enPantalla = (t: Token) => {
    const lado = TAMANOS[t.tamano] * celda;
    return {
      x: (origen.x + t.x * celda + lado / 2) * vista.escala + vista.x,
      y: (origen.y + t.y * celda) * vista.escala + vista.y,
    };
  };
  const tokenMenu = menu ? estado.tokens[menu.tokenId] : undefined;
  const rangoToken = rango ? estado.tokens[rango.tokenId] : undefined;

  return (
    // Absoluto: así el canvas no empuja el tamaño de su contenedor y el tablero se puede encoger
    <div ref={contenedor} className={`papel-tablero absolute inset-0 overflow-hidden ${rango || plantilla || editorMuros || modoRegla ? 'cursor-crosshair' : ''}`}
      onMouseLeave={() => { onPuntero?.(null, null); soltarPresion(); }}>
      {medida.ancho > 0 && (
        <Stage
          width={medida.ancho}
          height={medida.alto}
          x={vista.x}
          y={vista.y}
          scaleX={vista.escala}
          scaleY={vista.escala}
          draggable={!modoRegla && !midiendo && !pincel}
          dragDistance={5}
          onWheel={alHacerZoom}
          onMouseMove={alMoverPuntero}
          onTouchMove={alMoverPuntero}
          onMouseDown={alPresionar}
          onTouchStart={alPresionar}
          onMouseUp={alSoltar}
          onTouchEnd={alSoltar}
          onDragStart={soltarPresion}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) setVista((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onClick={alTocarFondo}
          onTap={alTocarFondo}
        >
          <Layer>
            {/* Sin imagen, el tablero lleva un terreno dibujado (el GM lo puede quitar); con imagen, el mapa */}
            {imagenMapa ? (
              <>
                <Rect name="fondo" width={ancho} height={alto} fill={colores.tablero} />
                <ImagenKonva image={imagenMapa} listening={false} />
              </>
            ) : (
              <FondoTerreno terreno={mapa.terreno ?? 'claro'} columnas={mapa.columnas} filas={mapa.filas} celda={celda} x={borde.x} y={borde.y} colores={colores} />
            )}
            {mapa.mostrarCuadricula && (
              <Shape
                listening={false}
                stroke={colores.cuadricula}
                strokeWidth={1 / vista.escala}
                sceneFunc={(ctx, forma) => {
                  // La cuadrícula se queda dentro del tablero
                  const x0 = borde.x;
                  const y0 = borde.y;
                  const x1 = borde.x + borde.w;
                  const y1 = borde.y + borde.h;
                  // Como el papel milimetrado: cada 5 casillas (25 ft) una línea más marcada
                  const primeraX = Math.ceil((x0 - origen.x) / celda);
                  const primeraY = Math.ceil((y0 - origen.y) / celda);
                  for (const mayor of [false, true]) {
                    ctx.beginPath();
                    for (let i = primeraX, x = origen.x + i * celda; x <= x1; i++, x += celda) {
                      if ((i % 5 === 0) !== mayor) continue;
                      ctx.moveTo(x, y0);
                      ctx.lineTo(x, y1);
                    }
                    for (let i = primeraY, y = origen.y + i * celda; y <= y1; i++, y += celda) {
                      if ((i % 5 === 0) !== mayor) continue;
                      ctx.moveTo(x0, y);
                      ctx.lineTo(x1, y);
                    }
                    ctx.setAttr('lineWidth', (mayor ? 1.6 : 1) / vista.escala);
                    ctx.setAttr('strokeStyle', forma.stroke());
                    ctx.stroke();
                    // La línea mayor se repasa: queda del doble de tinta
                    if (mayor) ctx.stroke();
                  }
                }}
              />
            )}
            {oscuridad && <CapaOscuridad sombra={oscuridad} columnas={mapa.columnas} filas={mapa.filas} celda={celda} origen={origen} />}
            {murosMapa.length > 0 && <DibujoMuros muros={murosMapa} celda={celda} origen={origen} escala={vista.escala} colores={colores} resaltado={resaltado} />}
            {(mapa.luces ?? []).length > 0 && <DibujoLuces luces={mapa.luces!} celda={celda} origen={origen} escala={vista.escala} colores={colores} />}
            {/* Lo que va pintando el pincel de niebla */}
            {pintadas && [...pintadas].map((k) => {
              const [x, y] = k.split(',').map(Number) as [number, number];
              return <Rect key={`pincel-${k}`} x={origen.x + x * celda} y={origen.y + y * celda} width={celda} height={celda} listening={false}
                fill={editorMuros?.herramienta === 'revelar' ? colores.exito : colores.texto} opacity={0.22} />;
            })}
            {niebla && (
              <CapaNiebla visibles={niebla.visibles} exploradas={niebla.exploradas} columnas={mapa.columnas} filas={mapa.filas}
                celda={celda} origen={origen} colores={colores} opaca={niebla.opaca} />
            )}
            {editorMuros && esquina && !borrando && (
              <Shape listening={false} sceneFunc={(ctx) => {
                const c = ctx._context;
                const P = (q: Casilla) => ({ x: origen.x + q.x * celda, y: origen.y + q.y * celda });
                const e2 = P(esquina);
                c.save();
                c.strokeStyle = colores.peligro;
                c.fillStyle = colores.peligro;
                c.lineWidth = 3 / vista.escala;
                c.setLineDash([8 / vista.escala, 6 / vista.escala]);
                if (inicioMuro) {
                  const a = P(inicioMuro);
                  c.beginPath();
                  if (editorMuros.herramienta === 'habitacion') c.rect(a.x, a.y, e2.x - a.x, e2.y - a.y);
                  else { c.moveTo(a.x, a.y); c.lineTo(e2.x, e2.y); }
                  c.stroke();
                  c.beginPath(); c.arc(a.x, a.y, 5 / vista.escala, 0, Math.PI * 2); c.fill();
                }
                c.beginPath(); c.arc(e2.x, e2.y, 6 / vista.escala, 0, Math.PI * 2); c.fill();
                c.restore();
              }} />
            )}
            {/* Dónde termina el tablero: afuera, papel apagado y rayado; el borde, a tinta doble */}
            <Shape
              listening={false}
              sceneFunc={(ctx) => {
                const c = ctx._context;
                const e = vista.escala;
                const vx0 = -vista.x / e;
                const vy0 = -vista.y / e;
                const vx1 = vx0 + medida.ancho / e;
                const vy1 = vy0 + medida.alto / e;
                c.save();
                c.beginPath();
                c.rect(vx0, vy0, vx1 - vx0, vy1 - vy0);
                c.rect(borde.x, borde.y, borde.w, borde.h);
                c.clip('evenodd');
                c.globalAlpha = 0.07;
                c.fillStyle = colores.texto;
                c.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
                c.globalAlpha = 0.18;
                c.strokeStyle = colores.textoSuave;
                c.lineWidth = 1 / e;
                const paso = 16 / e;
                c.beginPath();
                for (let d = Math.floor((vx0 + vy0) / paso) * paso; d < vx1 + vy1; d += paso) {
                  c.moveTo(d - vy0, vy0);
                  c.lineTo(d - vy1, vy1);
                }
                c.stroke();
                c.restore();
                c.save();
                c.strokeStyle = colores.texto;
                c.globalAlpha = 0.85;
                c.lineWidth = 3 / e;
                c.strokeRect(borde.x, borde.y, borde.w, borde.h);
                c.globalAlpha = 0.4;
                c.lineWidth = 1 / e;
                const m = 5 / e;
                c.strokeRect(borde.x + m, borde.y + m, borde.w - m * 2, borde.h - m * 2);
                c.restore();
              }}
            />
            {zona && tokenMovil && arrastrando && (
              <ZonaYRuta zona={zona} token={tokenMovil} apuntada={apuntada} velocidad={velocidad} celda={celda}
                origen={origen} escala={vista.escala} colores={colores} libres={movimiento?.libres ?? 0}
                ocupada={!!apuntada && hayOtroToken(apuntada)} />
            )}
            {rangoToken && rango && (
              <Alcance token={rangoToken} pies={rango.pies} etiqueta={rango.etiqueta} estado={estado} celda={celda} origen={origen}
                escala={vista.escala} colores={colores} />
            )}
            {apunta && <LineaObjetivo estado={estado} apunta={apunta} celda={celda} origen={origen} escala={vista.escala} colores={colores} />}
            {plantilla && estado.tokens[plantilla.tokenId] && (
              <PlantillaArea estado={estado} plantilla={plantilla} punto={puntoArea} celda={celda} origen={origen} escala={vista.escala} colores={colores} />
            )}
            {marcados.map((id) => {
              const t = estado.tokens[id];
              if (!t) return null;
              const r = (TAMANOS[t.tamano] * celda) / 2;
              return <Circle key={id} x={origen.x + t.x * celda + r} y={origen.y + t.y * celda + r} radius={r + 6} listening={false} stroke={colores.peligro} strokeWidth={4 / vista.escala} />;
            })}
          </Layer>
          <Layer listening={!editorMuros}>
            {ordenTokens(estado.tokens, enTurno, seleccionado).map((token) => (
              <FichaToken
                key={token.id}
                token={token}
                vecinos={vecinosDe(estado.tokens, token)}
                celda={celda}
                origen={origen}
                colores={colores}
                escala={vista.escala}
                movible={puedeMoverToken(quien, token) && !modoRegla}
                recorrido={recorridos.get(token.id) ?? null}
                pg={pgVisible(estado, token, quien)}
                salud={!pgVisible(estado, token, quien) && token.pg && !token.personajeId ? estadoDeSalud(token.pg) : null}
                derrotado={token.personajeId ? (estado.personajes[token.personajeId]?.pgActual ?? 1) <= 0 : !!token.pg && token.pg.actual <= 0}
                enTurno={token.id === enTurno}
                seleccionado={token.id === seleccionado}
                pista={!!zona && token.id === tokenMovil?.id && !arrastrando && !yaArrastro}
                onSeleccionar={() => {
                  if (consumirSenal()) return;
                  // Con un área por colocar, tocar un token también la lanza (en el punto que se ve)
                  if (plantilla) {
                    if (plantilla.area.forma === 'emanacion' || puntoArea) return onPunto?.(puntoArea ?? { x: 0, y: 0 });
                    const lado = TAMANOS[token.tamano];
                    return setPuntoArea(plantilla.area.forma === 'explosion' ? { x: token.x + Math.ceil(lado / 2), y: token.y + Math.ceil(lado / 2) } : { x: token.x, y: token.y });
                  }
                  onSeleccionar(token.id);
                }}
                efectos={token.efectos ?? []}
                onEmpezar={() => {
                  soltarPresion();
                  if (token.id !== tokenMovil?.id) return;
                  setArrastrando(true);
                  setYaArrastro(true);
                }}
                onArrastrar={(px, py) => {
                  if (token.id !== tokenMovil?.id || !zona) return;
                  const c = casillaEn(px, py);
                  if (!apuntada || apuntada.x !== c.x || apuntada.y !== c.y) setApuntada(c);
                }}
                onSoltar={(px, py) => {
                  setApuntada(null);
                  setArrastrando(false);
                  const c = token.id === tokenMovil?.id ? casillaEn(px, py) : (() => {
                    const lado = TAMANOS[token.tamano];
                    return {
                      x: Math.round(((px - vista.x) / vista.escala - origen.x) / celda - lado / 2),
                      y: Math.round(((py - vista.y) / vista.escala - origen.y) / celda - lado / 2),
                    };
                  })();
                  if (c.x === token.x && c.y === token.y) return;
                  // En su turno, solo donde llega; si no, la mesa dice por qué y el token vuelve
                  if (zona && token.id === tokenMovil?.id && !zona.has(clave(c))) return onNegar?.(motivoLejos(c));
                  onMover(token.id, c.x, c.y);
                }}
              />
            ))}
          </Layer>
          {pistas && (
            <Layer listening={false}>
              {Object.entries(pistas).map(([id, pista]) => {
                const t = estado.tokens[id];
                if (!t) return null;
                const r = (TAMANOS[t.tamano] * celda) / 2;
                const cx = origen.x + t.x * celda + r;
                const cy = origen.y + t.y * celda + r;
                const letra = Math.max(celda * 0.16, 12 / vista.escala);
                const tinta = pista.valido ? colores.acento : colores.textoSuave;
                // Dos tokens pegados no se pisan las etiquetas: una casilla sí, una no, va un renglón más arriba
                const renglon = (t.x + t.y) % 2 === 0 ? 0 : letra * 2;
                return (
                  <Group key={id}>
                    {/* Lo que no sirve queda a lápiz, como borrado */}
                    {!pista.valido && <Circle x={cx} y={cy} radius={r} fill={colores.superficie} opacity={0.6} />}
                    <Label x={cx} y={cy - r - 3 / vista.escala - renglon}>
                      <Tag fill={colores.superficie} stroke={tinta} strokeWidth={1.3 / vista.escala} cornerRadius={4 / vista.escala} opacity={0.96}
                        pointerDirection="down" pointerWidth={8 / vista.escala} pointerHeight={5 / vista.escala} />
                      <Text text={pista.texto} fontSize={letra} fontFamily="Shantell Sans, cursive" fontStyle={pista.valido ? 'bold' : 'normal'} fill={tinta} padding={letra * 0.32} />
                    </Label>
                  </Group>
                );
              })}
            </Layer>
          )}
        </Stage>
      )}
      <EfectosTablero eventos={eventos} estado={estado} vista={vista} celda={celda} />
      {presencia && (
        <PresenciaTablero estado={estado} vista={vista} celda={celda} origen={origen} punteros={presencia.punteros} senales={presencia.senales} />
      )}
      {/* Las reglas de los demás, con su nombre; la propia encima */}
      {presencia?.punteros.filter((p) => p.regla).map((p) => (
        <DibujoRegla key={`regla-${p.idConexion}`} a={p.regla!.a} b={p.regla!.b} vista={vista} celda={celda} origen={origen} nombre={p.nombre}
          color={tintaDePresencia(p)} />
      ))}
      {regla && <DibujoRegla a={regla.a} b={regla.b} vista={vista} celda={celda} origen={origen} />}
      {cursor && tokenTeclado && <DibujoRegla a={{ x: tokenTeclado.x, y: tokenTeclado.y }} b={cursor} vista={vista} celda={celda} origen={origen} nombre="Enter para ir" />}
      {/* Para lectores de pantalla: quién está en el tablero y a qué distancia de tu token */}
      <ResumenTablero estado={estado} desde={tokenTeclado ?? null} cursor={cursor} />
      {tokenMenu && menu && (() => {
        const p = enPantalla(tokenMenu);
        const izquierda = Math.round(Math.min(Math.max(8, p.x - 150), medida.ancho - 308));
        // Arriba del token si cabe en la mitad visible de arriba; si no, debajo. Nunca se sale de la pantalla.
        const visible = medida.alto - margenInferior;
        const abajoDelToken = p.y + TAMANOS[tokenMenu.tamano] * celda * vista.escala + 10;
        const arriba = p.y > visible / 2;
        // En celular los avisos ocupan todo el ancho de arriba: el menú no se mete debajo de ellos
        const techo = medida.ancho < 768 ? 96 : 8;
        const estilo = arriba
          ? { left: izquierda, bottom: Math.round(medida.alto - p.y + 10), maxHeight: Math.max(160, p.y - 10 - techo) }
          : { left: izquierda, top: Math.round(abajoDelToken), maxHeight: Math.max(160, visible - abajoDelToken - 8) };
        return (
          <div className="absolute z-20 w-[300px] overflow-y-auto overscroll-contain rounded-lg" style={estilo}>
            {menu.contenido}
          </div>
        );
      })()}
      <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
        <div className="flex h-10 overflow-hidden rounded-lg border border-borde bg-superficie font-titulo text-sm shadow-[0_4px_10px_-6px_var(--sombra)]">
          <button onClick={() => zoomEn(1 / 1.25)} className="flex w-10 items-center justify-center transition hover:bg-superficie-2" aria-label="Alejar" title="Alejar">
            <MinusIcon size={17} aria-hidden />
          </button>
          <button onClick={() => zoomEn(1.25)} className="flex w-10 items-center justify-center border-x border-borde transition hover:bg-superficie-2" aria-label="Acercar" title="Acercar">
            <PlusIcon size={17} aria-hidden />
          </button>
          <button onClick={centrar} className="flex items-center gap-1.5 px-3 transition hover:bg-superficie-2" title="Encuadrar a todos los tokens">
            <CornersInIcon size={17} aria-hidden /> Centrar
          </button>
          <button onClick={() => { setModoRegla(!modoRegla); if (modoRegla) setRegla(null); }} aria-pressed={modoRegla}
            className={`flex items-center gap-1.5 border-l border-borde px-3 transition ${modoRegla ? 'bg-acento text-sobre-acento' : 'hover:bg-superficie-2'}`}
            title="Medir: arrastra de una casilla a otra (también Ctrl + arrastrar). Esc la quita">
            <RulerIcon size={17} aria-hidden /> Medir
          </button>
        </div>
        {/* La escala, dibujada como una regla a lápiz */}
        <div className="flex items-center gap-1.5 rounded-sm bg-fondo/80 px-1.5 py-0.5 font-titulo text-[12px] text-texto-suave" aria-label="Una casilla son 5 pies">
          <svg width={Math.round(Math.min(60, Math.max(14, celda * vista.escala)))} height="8" aria-hidden className="overflow-visible text-texto-suave">
            <path d={`M1 1 V7 H${Math.round(Math.min(60, Math.max(14, celda * vista.escala))) - 1} V1`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          1 casilla = 5 ft
        </div>
      </div>
    </div>
  );
}

// Hasta dónde llega una acción: las casillas dentro del alcance, con su borde, y un anillo en cada token alcanzable
function Alcance({ token, pies, etiqueta, estado, celda, origen, escala, colores }: {
  token: Token;
  pies: number;
  etiqueta: string;
  estado: EstadoSala;
  celda: number;
  origen: { x: number; y: number };
  escala: number;
  colores: ColoresTablero;
}) {
  const lado = ladoDe(token);
  const casillas = useMemo(() => {
    const radio = Math.ceil(pies / 5) + 1;
    const dentro = new Set<string>();
    for (let x = token.x - radio; x < token.x + lado + radio; x++) {
      for (let y = token.y - radio; y < token.y + lado + radio; y++) {
        const propia = x >= token.x && x < token.x + lado && y >= token.y && y < token.y + lado;
        if (!propia && distanciaEntre(token, lado, { x, y }, 1) <= pies) dentro.add(clave({ x, y }));
      }
    }
    return dentro;
  }, [token.x, token.y, lado, pies]);
  const alcanzados = Object.values(estado.tokens).filter((t) => t.id !== token.id && distanciaEntre(token, lado, t, ladoDe(t)) <= pies);
  const letra = Math.max(celda * 0.2, 13 / escala);
  const arriba = Math.min(token.y, ...[...casillas].map((k) => desdeClave(k).y));
  return (
    <>
      <Shape
        listening={false}
        sceneFunc={(ctx) => {
          ctx.fillStyle = colores.acento;
          ctx.globalAlpha = 0.09;
          for (const k of casillas) {
            const c = desdeClave(k);
            ctx.fillRect(origen.x + c.x * celda, origen.y + c.y * celda, celda, celda);
          }
          // El borde: solo los lados que dan afuera del alcance
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = colores.acento;
          ctx.lineWidth = 2 / escala;
          ctx.setLineDash([7 / escala, 5 / escala]);
          ctx.beginPath();
          const fuera = (x: number, y: number) => {
            const propia = x >= token.x && x < token.x + lado && y >= token.y && y < token.y + lado;
            return !propia && !casillas.has(clave({ x, y }));
          };
          for (const k of casillas) {
            const c = desdeClave(k);
            const x0 = origen.x + c.x * celda;
            const y0 = origen.y + c.y * celda;
            if (fuera(c.x, c.y - 1)) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + celda, y0); }
            if (fuera(c.x, c.y + 1)) { ctx.moveTo(x0, y0 + celda); ctx.lineTo(x0 + celda, y0 + celda); }
            if (fuera(c.x - 1, c.y)) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + celda); }
            if (fuera(c.x + 1, c.y)) { ctx.moveTo(x0 + celda, y0); ctx.lineTo(x0 + celda, y0 + celda); }
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }}
      />
      {alcanzados.map((t) => {
        const r = (TAMANOS[t.tamano] * celda) / 2;
        return (
          <Circle key={t.id} x={origen.x + t.x * celda + r} y={origen.y + t.y * celda + r} radius={r + 3} listening={false}
            stroke={t.personajeId ? colores.acento : colores.peligro} strokeWidth={3 / escala} dash={[4 / escala, 4 / escala]} />
        );
      })}
      <Label x={origen.x + (token.x + lado / 2) * celda} y={origen.y + arriba * celda - 4 / escala} listening={false}>
        <Tag fill={colores.superficie} stroke={colores.acento} strokeWidth={1.5 / escala} cornerRadius={4 / escala}
          pointerDirection="down" pointerWidth={10 / escala} pointerHeight={6 / escala} />
        <Text text={etiqueta} fontSize={letra} fontFamily="Shantell Sans, cursive" fontStyle="bold" fill={colores.acento} padding={letra * 0.35} />
      </Label>
    </>
  );
}

// Un área por colocar: sus casillas con la tinta del conjuro, un anillo en cada token que toca y su nombre encima.
// Si la explosión queda más lejos que el alcance, se dibuja a lápiz y lo dice.
function PlantillaArea({ estado, plantilla, punto, celda, origen, escala, colores }: {
  estado: EstadoSala;
  plantilla: NonNullable<Props['plantilla']>;
  punto: Casilla | null;
  celda: number;
  origen: { x: number; y: number };
  escala: number;
  colores: ColoresTablero;
}) {
  const t = estado.tokens[plantilla.tokenId]!;
  const desde = { x: t.x, y: t.y, lado: ladoDe(t) };
  const casillas = useMemo(() => casillasDeArea(plantilla.area, desde, punto), [plantilla.area.forma, plantilla.area.tamano, desde.x, desde.y, desde.lado, punto?.x, punto?.y]);
  if (plantilla.area.forma !== 'emanacion' && !punto) return null;
  const lejos = plantilla.area.forma === 'explosion' && punto && plantilla.alcance !== undefined && distanciaAEsquina(desde, punto) > plantilla.alcance;
  const tinta = lejos ? colores.textoSuave : plantilla.color ?? colores.peligro;
  // A quién alcanza de verdad (lo que ayuda, solo a los aliados); en un área que daña, los aliados van marcados aparte
  const delBando = (x: Token) => (x.tipo === 'enemigo') === (t.tipo === 'enemigo');
  const tocadosAhora = tocados(casillas, Object.values(estado.tokens).map((x) => ({ ...x, lado: ladoDe(x) })))
    .filter((x) => !plantilla.aliados || (delBando(x) && !(plantilla.soloOtros && x.id === t.id)));
  const amigos = plantilla.aliados ? [] : tocadosAhora.filter(delBando);
  const aviso = amigos.length === 0 ? '' : ` · ¡ojo! también ${amigos.length === 1 ? (amigos[0]!.id === t.id ? 'a ti' : `a ${amigos[0]!.nombre}`) : `a ${amigos.length} aliados`}`;
  const letra = Math.max(celda * 0.2, 13 / escala);
  const arriba = Math.min(...casillas.map((c) => c.y));
  const centroX = casillas.reduce((s, c) => s + c.x + 0.5, 0) / Math.max(1, casillas.length);
  return (
    <>
      <Shape
        listening={false}
        sceneFunc={(ctx) => {
          ctx.fillStyle = tinta;
          ctx.globalAlpha = lejos ? 0.08 : 0.22;
          for (const c of casillas) ctx.fillRect(origen.x + c.x * celda + 1, origen.y + c.y * celda + 1, celda - 2, celda - 2);
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = tinta;
          ctx.lineWidth = 2 / escala;
          ctx.setLineDash(lejos ? [4 / escala, 6 / escala] : []);
          const dentro = new Set(casillas.map((c) => clave(c)));
          ctx.beginPath();
          for (const c of casillas) {
            const x0 = origen.x + c.x * celda;
            const y0 = origen.y + c.y * celda;
            if (!dentro.has(clave({ x: c.x, y: c.y - 1 }))) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + celda, y0); }
            if (!dentro.has(clave({ x: c.x, y: c.y + 1 }))) { ctx.moveTo(x0, y0 + celda); ctx.lineTo(x0 + celda, y0 + celda); }
            if (!dentro.has(clave({ x: c.x - 1, y: c.y }))) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + celda); }
            if (!dentro.has(clave({ x: c.x + 1, y: c.y }))) { ctx.moveTo(x0 + celda, y0); ctx.lineTo(x0 + celda, y0 + celda); }
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }}
      />
      {plantilla.area.forma === 'explosion' && punto && (
        <Circle x={origen.x + punto.x * celda} y={origen.y + punto.y * celda} radius={6 / escala} fill={tinta} listening={false} />
      )}
      {!lejos && tocadosAhora.map((x) => {
        const r = (TAMANOS[x.tamano] * celda) / 2;
        const amigo = amigos.includes(x);
        return <Circle key={x.id} x={origen.x + x.x * celda + r} y={origen.y + x.y * celda + r} radius={r + 4} listening={false}
          stroke={amigo ? colores.peligro : tinta} strokeWidth={3.5 / escala} dash={amigo ? [6 / escala, 5 / escala] : undefined} />;
      })}
      {casillas.length > 0 && (
        <Label x={origen.x + centroX * celda} y={origen.y + arriba * celda - 4 / escala} listening={false}>
          <Tag fill={colores.superficie} stroke={tinta} strokeWidth={1.5 / escala} cornerRadius={4 / escala} pointerDirection="down" pointerWidth={10 / escala} pointerHeight={6 / escala} />
          <Text text={lejos ? `Muy lejos: llega a ${plantilla.alcance} ft` : `${plantilla.etiqueta} · ${areaTexto(plantilla.area)} · ${tocadosAhora.length} ${tocadosAhora.length === 1 ? 'tocado' : 'tocados'}${aviso}`}
            fontSize={letra} fontFamily="Shantell Sans, cursive" fontStyle="bold" fill={amigos.length && !lejos ? colores.peligro : tinta} padding={letra * 0.35} />
        </Label>
      )}
    </>
  );
}

// Las casillas a las que llega en su turno (1 Stride más intenso, 2 Strides más suave) y la ruta hasta la apuntada
function ZonaYRuta({ zona, token, apuntada, velocidad, celda, origen, escala, colores, libres, ocupada }: {
  zona: Map<string, Paso>;
  token: Token;
  apuntada: Casilla | null;
  velocidad: number;
  celda: number;
  origen: { x: number; y: number };
  escala: number;
  colores: ColoresTablero;
  libres: number;
  ocupada: boolean;
}) {
  const lado = ladoDe(token);
  const oscuro = luminancia(colores.tablero) < 0.3;
  const camino = apuntada ? caminoA(apuntada, zona) : null;
  const pies = apuntada ? zona.get(clave(apuntada))?.pies ?? null : null;
  const acciones = pies !== null ? Math.max(1, Math.ceil(pies / velocidad)) : 0;
  const centro = (c: Casilla) => ({ x: origen.x + (c.x + lado / 2) * celda, y: origen.y + (c.y + lado / 2) * celda });
  const fuera = apuntada && !camino && (apuntada.x !== token.x || apuntada.y !== token.y);
  const fin = apuntada ? centro(apuntada) : null;
  const letra = Math.max(celda * 0.22, 14 / escala);
  return (
    <>
      <Shape
        listening={false}
        sceneFunc={(ctx) => {
          for (const [k, paso] of zona) {
            const c = desdeClave(k);
            ctx.fillStyle = colores.marca;
            ctx.globalAlpha = (paso.pies <= velocidad ? 0.3 : 0.12) * (oscuro ? 0.5 : 1);
            ctx.fillRect(origen.x + c.x * celda + 1, origen.y + c.y * celda + 1, celda - 2, celda - 2);
          }
          ctx.globalAlpha = 1;
        }}
      />
      {camino && camino.length > 1 && (
        <>
          <Line points={camino.flatMap((c) => { const p = centro(c); return [p.x, p.y]; })}
            stroke={colores.acento} strokeWidth={3 / escala} dash={[2 / escala, 7 / escala]} lineCap="round" lineJoin="round" listening={false} />
          {camino.slice(1).map((c, i) => {
            const p = centro(c);
            return <Circle key={i} x={p.x} y={p.y} radius={3.5 / escala} fill={colores.acento} listening={false} />;
          })}
          {fin && (
            <>
              <Circle x={fin.x} y={fin.y} radius={(lado * celda) / 2 - 4} stroke={colores.acento} strokeWidth={2 / escala} dash={[6 / escala, 5 / escala]} listening={false} />
              <Label x={fin.x} y={fin.y - (lado * celda) / 2 - letra * 2} listening={false}>
                <Tag fill={colores.superficie} stroke={colores.acento} strokeWidth={1.5 / escala} cornerRadius={4 / escala} pointerDirection="down" pointerWidth={10 / escala} pointerHeight={6 / escala} />
                <Text text={`${pies} ft · ${acciones === 1 ? '1 acción' : `${acciones} acciones`}`} fontSize={letra} fontFamily="Shantell Sans, cursive"
                  fontStyle="bold" fill={colores.acento} padding={letra * 0.35} />
              </Label>
            </>
          )}
        </>
      )}
      {fuera && fin && (
        <Label x={fin.x} y={fin.y - letra} listening={false}>
          <Tag fill={colores.superficie} stroke={colores.peligro} strokeWidth={1.5 / escala} cornerRadius={4 / escala} pointerDirection="down" pointerWidth={10 / escala} pointerHeight={6 / escala} />
          <Text text={ocupada ? 'Ocupada' : libres > 0 ? 'Muy lejos' : 'Sin acciones'} fontSize={letra} fontFamily="Shantell Sans, cursive" fontStyle="bold" fill={colores.peligro} padding={letra * 0.35} />
        </Label>
      )}
    </>
  );
}

function LineaObjetivo({ estado, apunta, celda, origen, escala, colores }: {
  estado: EstadoSala;
  apunta: { desde: string; hasta: string };
  celda: number;
  origen: { x: number; y: number };
  escala: number;
  colores: ColoresTablero;
}) {
  const centro = (id: string) => {
    const t = estado.tokens[id];
    if (!t) return null;
    const lado = TAMANOS[t.tamano] * celda;
    return { x: origen.x + t.x * celda + lado / 2, y: origen.y + t.y * celda + lado / 2 };
  };
  const a = centro(apunta.desde);
  const b = centro(apunta.hasta);
  if (!a || !b) return null;
  return <Line points={[a.x, a.y, b.x, b.y]} stroke={colores.peligro} strokeWidth={2 / escala} dash={[7 / escala, 6 / escala]} lineCap="round" opacity={0.85} listening={false} />;
}

interface PropsFicha {
  token: Token;
  celda: number;
  origen: { x: number; y: number };
  colores: ColoresTablero;
  escala: number;
  // Solo el GM y el dueño del personaje pueden arrastrarlo
  movible: boolean;
  // Su último movimiento: lo recorre casilla por casilla
  recorrido: { id: number; camino: Casilla[] } | null;
  pg: { actual: number; max: number } | null;
  // Para los jugadores: cómo se ve un enemigo sin decir sus PG ("herido")
  salud: string | null;
  // Con 0 PG: tachado, gris
  derrotado: boolean;
  enTurno: boolean;
  seleccionado: boolean;
  // Quién tiene pegado: si hay alguien debajo, el nombre va arriba; si hay alguien al lado, se acorta
  vecinos: { arriba: boolean; abajo: boolean; lados: boolean };
  // Mostrar "arrástrame" sobre el token propio la primera vez
  pista: boolean;
  // Lo que tiene puesto: un halo si algo lo ayuda, y una marquita por efecto
  efectos: EfectoActivo[];
  onSeleccionar: () => void;
  onEmpezar: () => void;
  onArrastrar: (px: number, py: number) => void;
  onSoltar: (px: number, py: number) => void;
}

function FichaToken({ token, vecinos, celda, origen, colores, escala, movible, recorrido, pg, salud, derrotado, enTurno, seleccionado, pista, efectos, onSeleccionar, onEmpezar, onArrastrar, onSoltar }: PropsFicha) {
  const [imagen] = useImage(token.imagen || '', 'anonymous');
  const nodo = useRef<Konva.Group>(null);
  const lado = TAMANOS[token.tamano] * celda;
  const radio = lado / 2;
  const porDefecto = !token.color || token.color === COLORES_TOKEN[token.tipo];
  const tintaDelTema = token.tipo === 'personaje' ? colores.acento : token.tipo === 'enemigo' ? colores.peligro : colores.textoSuave;
  const tinta = porDefecto ? tintaDelTema : token.color;
  const grosor = Math.max(2.2, celda * 0.04);
  // Cada token tiembla distinto, pero siempre igual: la semilla sale de su id
  const semilla = [...token.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  // Textos y barra con un tamaño mínimo en pantalla, para que se lean aunque el mapa esté lejos
  const letraNombre = Math.max(celda * 0.19, 12.5 / escala);
  const letraCondicion = Math.max(celda * 0.15, 12 / escala);
  const altoBarra = Math.max(celda * 0.09, 6 / escala);
  // Levantada mientras se arrastra: como una pieza que se toma con los dedos
  const [levantada, setLevantada] = useState(false);

  // Dónde se dibuja: normalmente su casilla; mientras recorre un camino, el paso en que va
  const enCasilla = (c: Casilla) => ({ x: origen.x + c.x * celda, y: origen.y + c.y * celda });
  const [pos, setPos] = useState(() => enCasilla(token));
  const animado = useRef(recorrido?.id ?? 0);

  useEffect(() => {
    const destino = enCasilla(token);
    const g = nodo.current;
    const fin = recorrido?.camino.at(-1);
    const nuevo = recorrido && recorrido.id !== animado.current && fin && fin.x === token.x && fin.y === token.y;
    if (!g || !nuevo || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      g?.position(destino);
      setPos(destino);
      if (recorrido) animado.current = recorrido.id;
      return;
    }
    animado.current = recorrido.id;
    // Recorre el camino casilla por casilla, como una pieza que se mueve sobre el tablero
    const pasos = recorrido.camino.slice(1).map(enCasilla);
    g.position(enCasilla(recorrido.camino[0]!));
    let i = 0;
    let tween: Konva.Tween | null = null;
    const siguiente = () => {
      const p = pasos[i++];
      if (!p) { setPos(destino); return; }
      tween = new Konva.Tween({ node: g, duration: PASO_MS / 1000, x: p.x, y: p.y, easing: Konva.Easings.EaseInOut, onFinish: siguiente });
      tween.play();
    };
    siguiente();
    return () => { tween?.destroy(); g.position(destino); };
  }, [token.x, token.y, recorrido?.id, celda, origen.x, origen.y]);

  const cursor = (e: Konva.KonvaEventObject<MouseEvent | DragEvent>, valor: string) => {
    const c = e.target.getStage()?.container();
    if (c) c.style.cursor = valor;
  };
  const fraccion = pg ? Math.max(0, Math.min(1, pg.actual / pg.max)) : 0;
  const tintaPG = fraccion > 0.5 ? colores.exito : fraccion > 0.2 ? '#d69a2d' : colores.peligro;
  const anchoBarra = Math.max(lado * 0.84, 34 / escala);
  const nombreArriba = vecinos.abajo && !vecinos.arriba && !pista;
  const nombreCorto = vecinos.lados && !enTurno && !seleccionado ? Math.max(lado + celda * 0.3, 60 / escala) : 0;

  return (
    <Group
      ref={nodo}
      x={pos.x}
      y={pos.y}
      draggable={movible}
      onMouseDown={onSeleccionar}
      onTap={onSeleccionar}
      onMouseEnter={(e) => cursor(e, movible ? 'grab' : 'pointer')}
      onMouseLeave={(e) => cursor(e, '')}
      onDragStart={(e) => { e.target.moveToTop(); setLevantada(true); cursor(e, 'grabbing'); onEmpezar(); }}
      onDragMove={(e) => { const p = e.target.getStage()?.getPointerPosition(); if (p) onArrastrar(p.x, p.y); }}
      onDragEnd={(e) => {
        const p = e.target.getStage()?.getPointerPosition();
        setLevantada(false);
        cursor(e, movible ? 'grab' : 'pointer');
        // Vuelve a su casilla: si la sala acepta el movimiento, lo recorre desde ahí
        e.target.position(enCasilla(token));
        if (p) onSoltar(p.x, p.y);
      }}
    >
      {/* Su turno: un manchón de marcatextos debajo, con borde irregular */}
      {enTurno && (
        <Shape listening={false} fill={colores.marca} opacity={0.6}
          sceneFunc={(ctx, forma) => { trazoAMano(ctx, radio, radio, radio + 11, semilla + 3, 0.16); ctx.fillShape(forma); }} />
      )}
      {seleccionado && (
        <Shape listening={false} stroke={colores.acento} strokeWidth={grosor * 0.8} dash={[6, 5]}
          sceneFunc={(ctx, forma) => { trazoAMano(ctx, radio, radio, radio + 7, semilla + 7); ctx.strokeShape(forma); }} />
      )}
      {/* Algo lo ayuda (Bless, Shield): un halo de tinta dorada alrededor; algo lo quema: un halo del elemento */}
      {(() => {
        const visibles = efectos.filter((e) => !e.inmuneA);
        const bueno = visibles.find((e) => e.beneficioso);
        const malo = visibles.find((e) => !e.beneficioso && e.persistente);
        const color = bueno ? TINTA_ASPECTO[bueno.aspecto ?? 'bendicion'] : malo ? TINTA_ASPECTO[malo.aspecto ?? 'fuego'] : null;
        if (!color) return null;
        return (
          <Shape listening={false} stroke={color} strokeWidth={grosor * 1.3} opacity={0.75} shadowColor={color} shadowBlur={14} shadowOpacity={0.9}
            dash={bueno ? [2, 7] : undefined} lineCap="round"
            sceneFunc={(ctx, forma) => { trazoAMano(ctx, radio, radio, radio + 4.5, semilla + 19, 0.08); ctx.strokeShape(forma); }} />
        );
      })()}
      <Group x={radio} y={radio} offsetX={radio} offsetY={radio} scaleX={levantada ? 1.08 : 1} scaleY={levantada ? 1.08 : 1} opacity={derrotado ? 0.5 : 1}>
        {/* La pieza de cartón: papel con sombra sobre la mesa (más sombra si está levantada) */}
        <Circle x={radio} y={radio} radius={radio - grosor * 0.5} fill={colores.superficie}
          shadowColor={colores.sombra} shadowBlur={levantada ? 18 : 7} shadowOffsetX={levantada ? 4 : 1} shadowOffsetY={levantada ? 12 : 3}
          shadowOpacity={levantada ? 0.55 : 0.4} />
        {!imagen && <Circle x={radio} y={radio} radius={radio - grosor} fill={tinta} opacity={0.1} listening={false} />}
        {imagen ? (
          <Group clipFunc={(ctx) => { ctx.arc(radio, radio, radio - grosor * 1.6, 0, Math.PI * 2); }}>
            <ImagenKonva image={imagen} {...cubrir(imagen, lado)} />
          </Group>
        ) : (
          <Text width={lado} height={lado} align="center" verticalAlign="middle" text={token.nombre.slice(0, 1).toUpperCase()}
            fontSize={lado * 0.44} fontFamily="Shantell Sans, cursive" fontStyle="bold" fill={tinta} listening={false} />
        )}
        {/* El borde a tinta, en dos pasadas apenas corridas */}
        <Shape listening={false} stroke={tinta} strokeWidth={grosor} lineCap="round" lineJoin="round"
          sceneFunc={(ctx, forma) => { trazoAMano(ctx, radio, radio, radio - grosor, semilla); ctx.strokeShape(forma); }} />
        <Shape listening={false} stroke={tinta} strokeWidth={grosor * 0.55} opacity={0.5} lineCap="round"
          sceneFunc={(ctx, forma) => { trazoAMano(ctx, radio + 0.8, radio - 0.6, radio - grosor * 1.9, semilla + 11); ctx.strokeShape(forma); }} />
        {/* Los enemigos llevan cuatro muescas, para distinguirlos sin depender del color */}
        {token.tipo === 'enemigo' && (
          <Shape listening={false} stroke={tinta} strokeWidth={grosor * 0.9} lineCap="round"
            sceneFunc={(ctx, forma) => {
              ctx.beginPath();
              for (let k = 0; k < 4; k++) {
                const a = Math.PI / 4 + (k * Math.PI) / 2;
                ctx.moveTo(radio + Math.cos(a) * (radio - grosor * 0.2), radio + Math.sin(a) * (radio - grosor * 0.2));
                ctx.lineTo(radio + Math.cos(a) * (radio + grosor * 1.6), radio + Math.sin(a) * (radio + grosor * 1.6));
              }
              ctx.strokeShape(forma);
            }} />
        )}
      </Group>
      {/* Derrotado: una cruz a tinta roja encima */}
      {derrotado && (
        <Shape listening={false} stroke={colores.peligro} strokeWidth={grosor * 1.4} lineCap="round"
          sceneFunc={(ctx, forma) => {
            const m = lado * 0.18;
            ctx.beginPath();
            ctx.moveTo(m, m + 2); ctx.lineTo(lado - m, lado - m - 1);
            ctx.moveTo(lado - m + 1, m); ctx.lineTo(m - 1, lado - m + 2);
            ctx.strokeShape(forma);
          }} />
      )}
      {/* Una marquita por efecto, en el borde de arriba a la derecha: el color de su elemento y su inicial */}
      {efectos.filter((e) => !e.inmuneA).slice(0, 4).map((e, i) => {
        const ang = -Math.PI / 2 + 0.55 + i * 0.5;
        const r = Math.max(celda * 0.11, 8 / escala);
        const color = TINTA_ASPECTO[e.aspecto ?? (e.beneficioso ? 'bendicion' : 'marca')];
        return (
          <Group key={e.id} x={radio + Math.cos(ang) * (radio + r * 0.3)} y={radio + Math.sin(ang) * (radio + r * 0.3)} listening={false}>
            <Circle radius={r} fill={colores.superficie} stroke={color} strokeWidth={Math.max(1.5, r * 0.22)} />
            <Text text={e.nombre.slice(0, 1).toUpperCase()} width={r * 2} height={r * 2} offsetX={r} offsetY={r} align="center" verticalAlign="middle"
              fontSize={r * 1.25} fontFamily="Shantell Sans, cursive" fontStyle="bold" fill={color} />
          </Group>
        );
      })}
      {/* PG: barra rayada a lápiz justo debajo */}
      {pg && (
        <Shape x={radio - anchoBarra / 2} y={lado + 3} listening={false}
          sceneFunc={(ctx) => {
            const w = anchoBarra;
            const h = altoBarra;
            ctx.fillStyle = colores.superficie;
            ctx.fillRect(0, 0, w, h);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, w * fraccion, h);
            ctx.clip();
            ctx.strokeStyle = tintaPG;
            ctx.lineWidth = Math.max(1.2, h * 0.28);
            ctx.beginPath();
            for (let x = -h; x < w + h; x += h * 0.55) { ctx.moveTo(x, h); ctx.lineTo(x + h, 0); }
            ctx.stroke();
            ctx.restore();
            ctx.strokeStyle = colores.texto;
            ctx.lineWidth = 1.2 / escala;
            ctx.strokeRect(0, 0, w, h);
          }} />
      )}
      {/* El nombre en una etiqueta de papel: debajo, o arriba si hay otro token pegado debajo y nadie arriba.
          Con vecinos a los lados se corta con "…" (salvo el que está en turno o elegido, que se lee entero) */}
      <Label x={radio} y={nombreArriba ? -3 / escala : lado + (pg ? altoBarra + 6 : 4)} listening={false}>
        <Tag fill={colores.superficie} opacity={0.94} cornerRadius={3 / escala} pointerDirection={nombreArriba ? 'down' : 'up'} pointerWidth={8 / escala} pointerHeight={4 / escala}
          shadowColor={colores.sombra} shadowBlur={4 / escala} shadowOffsetY={1.5 / escala} shadowOpacity={0.25} />
        <Text text={salud ? `${token.nombre} · ${salud}` : token.nombre} fontSize={letraNombre} fontFamily="Shantell Sans, cursive" fontStyle={enTurno ? 'bold' : 'normal'}
          fill={token.tipo === 'enemigo' ? colores.peligro : colores.texto} padding={letraNombre * 0.28}
          {...(nombreCorto ? { width: nombreCorto, wrap: 'none', ellipsis: true, align: 'center' } : {})} />
      </Label>
      {/* Condiciones: un post-it pegado arriba a la derecha */}
      {token.condiciones && token.condiciones.length > 0 && (
        <Label x={lado * 0.55} y={-letraCondicion * 1.9 - (nombreArriba ? letraNombre * 1.9 : 0)} rotation={4} listening={false}>
          <Tag fill={colores.postit} shadowColor="rgba(40,50,70,.35)" shadowBlur={4} shadowOffsetY={2} />
          <Text
            text={resumenCondiciones(token.condiciones)}
            fontSize={letraCondicion}
            fontFamily="Shantell Sans, cursive"
            padding={letraCondicion * 0.3}
            fill="#2b2a22"
          />
        </Label>
      )}
      {/* La primera vez en tu turno: cómo se mueve */}
      {pista && (
        <Label x={radio} y={-grosor * 3} listening={false}>
          <Tag fill={colores.acento} cornerRadius={4 / escala} pointerDirection="down" pointerWidth={10 / escala} pointerHeight={6 / escala} />
          <Text text="Arrástrame para moverte" fontSize={Math.max(celda * 0.17, 12.5 / escala)} fontFamily="Shantell Sans, cursive" fontStyle="bold"
            fill={colores.sobreAcento} padding={Math.max(celda * 0.17, 12.5 / escala) * 0.4} />
        </Label>
      )}
    </Group>
  );
}

// Abajo primero, y el que está en turno o elegido al final: lo de abajo tapa lo de arriba, nunca al revés
function ordenTokens(tokens: Record<string, Token>, enTurno: string | null | undefined, seleccionado: string | null | undefined) {
  const peso = (t: Token) => (t.id === seleccionado ? 2 : t.id === enTurno ? 1 : 0);
  return Object.values(tokens).sort((a, b) => peso(a) - peso(b) || a.y - b.y || a.x - b.x);
}

// Si otro token toca a este por arriba, por abajo o por los lados (casillas pegadas)
function vecinosDe(tokens: Record<string, Token>, t: Token) {
  const lado = TAMANOS[t.tamano];
  const v = { arriba: false, abajo: false, lados: false };
  for (const o of Object.values(tokens)) {
    if (o.id === t.id) continue;
    const lo = TAMANOS[o.tamano];
    const cruzaX = o.x < t.x + lado && o.x + lo > t.x;
    const cruzaY = o.y < t.y + lado && o.y + lo > t.y;
    if (cruzaX && o.y === t.y + lado) v.abajo = true;
    if (cruzaX && o.y + lo === t.y) v.arriba = true;
    if (cruzaY && (o.x === t.x + lado || o.x + lo === t.x)) v.lados = true;
    // Uno en diagonal debajo también choca con la etiqueta, que es más ancha que la casilla
    if (!cruzaX && o.y === t.y + lado && (o.x === t.x + lado || o.x + lo === t.x)) v.lados = true;
  }
  return v;
}

// Escala la imagen para cubrir el círculo sin deformarla (como object-fit: cover)
function cubrir(imagen: HTMLImageElement, lado: number) {
  const escala = Math.max(lado / imagen.width, lado / imagen.height);
  const ancho = imagen.width * escala;
  const alto = imagen.height * escala;
  return { width: ancho, height: alto, x: (lado - ancho) / 2, y: (lado - alto) / 2 };
}

// La barra de PG: la de los personajes la ven todos; la de los enemigos, solo el GM
function pgVisible(estado: EstadoSala, token: Token, quien: Sesion): { actual: number; max: number } | null {
  if (token.personajeId) {
    const p = estado.personajes[token.personajeId];
    return p ? { actual: p.pgActual, max: Math.max(1, calcular(p).pgMax.total) } : null;
  }
  return quien.rol === 'gm' && token.pg ? token.pg : null;
}

// Un círculo como hecho a mano con bolígrafo: radio con un leve temblor y el trazo pasándose un poco al cerrar
function trazoAMano(ctx: Konva.Context, cx: number, cy: number, r: number, semilla: number, temblor = 0.06) {
  const puntos = 22;
  const azar = (i: number) => {
    const x = Math.sin(semilla * 12.9898 + i * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const inicio = azar(99) * Math.PI * 2;
  ctx.beginPath();
  for (let i = 0; i <= puntos + 1; i++) {
    const angulo = inicio + (i / puntos) * Math.PI * 2;
    const radio = r * (1 + (azar(i) - 0.5) * temblor);
    const x = cx + Math.cos(angulo) * radio;
    const y = cy + Math.sin(angulo) * radio;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

// Luminancia aproximada de un color #rrggbb (0 negro, 1 blanco)
function luminancia(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return 1;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x!, 16) / 255);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

// El tablero en palabras (solo lo leen los lectores de pantalla): cada token a la vista con su distancia, y el cursor
function ResumenTablero({ estado, desde, cursor }: { estado: EstadoSala; desde: Token | null; cursor: Casilla | null }) {
  const tokens = Object.values(estado.tokens);
  const distancia = (t: Token) => (desde && t.id !== desde.id ? ` a ${distanciaEntre({ x: desde.x, y: desde.y }, ladoDe(desde), { x: t.x, y: t.y }, ladoDe(t))} ft` : '');
  return (
    <div className="sr-only">
      <h2>Tablero</h2>
      <p>Con las flechas mueves un cursor desde {desde ? desde.nombre : 'tu token'}; Enter lo lleva ahí y Esc lo quita.</p>
      <ul>
        {tokens.map((t) => <li key={t.id}>{t.nombre}{t.personajeId ? '' : t.tipo === 'enemigo' ? ', enemigo' : ''}{distancia(t)}</li>)}
      </ul>
      <p aria-live="polite">{cursor && desde ? `Cursor a ${distanciaEntre({ x: desde.x, y: desde.y }, 1, cursor, 1)} pies de ${desde.nombre}` : ''}</p>
    </div>
  );
}

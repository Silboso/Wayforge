import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Circle, Group, Image as ImagenKonva, Label, Layer, Line, Rect, Shape, Stage, Tag, Text } from 'react-konva';
import Konva from 'konva';
import useImage from 'use-image';
import { CornersInIcon } from '@phosphor-icons/react';
import { calcular } from '../../reglas/pf2e';
import { alcanzables, caminoA, clave, desdeClave, type Casilla, type Paso } from '../../reglas/movimiento';
import {
  COLORES_TOKEN, ladoDe, opcionesMovimiento, puedeMoverToken, TAMANOS, tokenEnTurno, velocidadDe,
  type EstadoSala, type Sesion, type Token,
} from '../../compartido/sala';
import { resumenCondiciones } from './Condiciones';
import type { ColoresTablero } from '../tema';
import type { Evento } from '../../compartido/eventos';
import { EfectosTablero } from './Efectos';

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
}

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;
const PASO_MS = 120;

export function Tablero({
  estado, colores, quien, margenInferior = 0, movimiento = null, apunta = null, eventos = [], menu = null,
  seleccionado, onSeleccionar, onMover, onNegar,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
  const [vista, setVista] = useState({ x: 0, y: 0, escala: 1 });
  const [imagenMapa] = useImage(estado.mapa.imagen || '', 'anonymous');
  const ajustado = useRef<string | null>(null);
  // La casilla bajo el puntero (o bajo el token que se arrastra): de ahí sale la ruta que se dibuja
  const [apuntada, setApuntada] = useState<Casilla | null>(null);

  const { mapa } = estado;
  const celda = mapa.tamanoCelda;
  const origen = { x: mapa.desplazamientoX % celda, y: mapa.desplazamientoY % celda };
  const enTurno = tokenEnTurno(estado)?.id ?? null;
  const ancho = imagenMapa ? imagenMapa.width : mapa.columnas * celda;
  const alto = imagenMapa ? imagenMapa.height : mapa.filas * celda;

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

  // Encuadra a los tokens (con aire alrededor) a un zoom legible; sin tokens, el mapa entero
  function centrar() {
    const visible = Math.max(120, medida.alto - margenInferior);
    const tokens = Object.values(estado.tokens);
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
    const escala = Math.min(1.6, Math.min(medida.ancho / w, visible / h) * 0.92);
    const cx = (caja.x0 + caja.x1) / 2;
    const cy = (caja.y0 + caja.y1) / 2;
    setVista({ escala, x: medida.ancho / 2 - cx * escala, y: visible / 2 - cy * escala });
  }

  // Encuadra el tablero completo al entrar y cada vez que cambia el mapa
  useEffect(() => {
    const k = `${mapa.imagen ?? ''}|${ancho}x${alto}`;
    if (!medida.ancho || ajustado.current === k) return;
    if (mapa.imagen && !imagenMapa) return;
    ajustado.current = k;
    centrar();
  }, [medida, ancho, alto, mapa.imagen, imagenMapa]);

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

  function alMoverPuntero(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!zona) return;
    const p = e.target.getStage()?.getPointerPosition();
    if (!p) return;
    const c = casillaEn(p.x, p.y);
    // Sobre otro token no hay ruta que mostrar: ahí se abre su menú
    if (hayOtroToken(c)) return apuntada && setApuntada(null);
    if (!apuntada || apuntada.x !== c.x || apuntada.y !== c.y) setApuntada(c);
  }

  const hayOtroToken = (c: Casilla) => Object.values(estado.tokens).some((t) => {
    if (t.id === tokenMovil?.id) return false;
    const n = ladoDe(t);
    return c.x >= t.x && c.x < t.x + n && c.y >= t.y && c.y < t.y + n;
  });

  // Tocar una casilla vacía en su turno: Stride hasta ahí
  function alTocarFondo(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target !== e.target.getStage() && e.target.name() !== 'fondo') return;
    onSeleccionar(null);
    if (!tokenMovil || !zona) return;
    const p = e.target.getStage()?.getPointerPosition();
    if (!p) return;
    const c = casillaEn(p.x, p.y);
    if (c.x === tokenMovil.x && c.y === tokenMovil.y) return;
    if (zona.has(clave(c))) onMover(tokenMovil.id, c.x, c.y);
    else onNegar?.(motivoLejos(c));
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

  return (
    // Absoluto: así el canvas no empuja el tamaño de su contenedor y el tablero se puede encoger
    <div ref={contenedor} className="absolute inset-0 overflow-hidden bg-fondo" onMouseLeave={() => setApuntada(null)}>
      {medida.ancho > 0 && (
        <Stage
          width={medida.ancho}
          height={medida.alto}
          x={vista.x}
          y={vista.y}
          scaleX={vista.escala}
          scaleY={vista.escala}
          draggable
          dragDistance={5}
          onWheel={alHacerZoom}
          onMouseMove={alMoverPuntero}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) setVista((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onClick={alTocarFondo}
          onTap={alTocarFondo}
        >
          <Layer>
            {/* Sin imagen, el tablero es el mismo papel: no hay caja, la cuadrícula sigue hasta el borde de la pantalla */}
            {imagenMapa && (
              <>
                <Rect name="fondo" width={ancho} height={alto} fill={colores.tablero} />
                <ImagenKonva image={imagenMapa} listening={false} />
              </>
            )}
            {mapa.mostrarCuadricula && (
              <Shape
                listening={false}
                stroke={colores.cuadricula}
                strokeWidth={1 / vista.escala}
                sceneFunc={(ctx, forma) => {
                  // Con imagen, la cuadrícula se queda sobre el mapa; sin imagen, cubre todo lo visible
                  const x0 = imagenMapa ? 0 : -vista.x / vista.escala;
                  const y0 = imagenMapa ? 0 : -vista.y / vista.escala;
                  const x1 = imagenMapa ? ancho : x0 + medida.ancho / vista.escala;
                  const y1 = imagenMapa ? alto : y0 + medida.alto / vista.escala;
                  ctx.beginPath();
                  for (let x = origen.x + Math.ceil((x0 - origen.x) / celda) * celda; x <= x1; x += celda) {
                    ctx.moveTo(x, y0);
                    ctx.lineTo(x, y1);
                  }
                  for (let y = origen.y + Math.ceil((y0 - origen.y) / celda) * celda; y <= y1; y += celda) {
                    ctx.moveTo(x0, y);
                    ctx.lineTo(x1, y);
                  }
                  ctx.strokeShape(forma);
                }}
              />
            )}
            {zona && tokenMovil && (
              <ZonaYRuta zona={zona} token={tokenMovil} apuntada={apuntada} velocidad={velocidad} celda={celda}
                origen={origen} escala={vista.escala} colores={colores} libres={movimiento?.libres ?? 0} />
            )}
            {apunta && <LineaObjetivo estado={estado} apunta={apunta} celda={celda} origen={origen} escala={vista.escala} colores={colores} />}
          </Layer>
          <Layer>
            {Object.values(estado.tokens).map((token) => (
              <FichaToken
                key={token.id}
                token={token}
                celda={celda}
                origen={origen}
                colores={colores}
                escala={vista.escala}
                movible={puedeMoverToken(quien, token)}
                recorrido={recorridos.get(token.id) ?? null}
                pg={pgVisible(estado, token, quien)}
                enTurno={token.id === enTurno}
                seleccionado={token.id === seleccionado}
                onSeleccionar={() => onSeleccionar(token.id)}
                onArrastrar={(px, py) => {
                  if (token.id !== tokenMovil?.id || !zona) return;
                  const c = casillaEn(px, py);
                  if (!apuntada || apuntada.x !== c.x || apuntada.y !== c.y) setApuntada(c);
                }}
                onSoltar={(px, py) => {
                  setApuntada(null);
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
        </Stage>
      )}
      <EfectosTablero eventos={eventos} estado={estado} vista={vista} celda={celda} />
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
      <button
        onClick={centrar}
        className="absolute top-3 left-3 z-10 flex h-10 items-center gap-2 rounded-lg border border-borde bg-superficie px-3 font-titulo text-sm shadow-sm transition hover:bg-superficie-2"
      >
        <CornersInIcon size={18} aria-hidden />
        Centrar
      </button>
    </div>
  );
}

// Las casillas a las que llega en su turno (1 Stride más intenso, 2 Strides más suave) y la ruta hasta la apuntada
function ZonaYRuta({ zona, token, apuntada, velocidad, celda, origen, escala, colores, libres }: {
  zona: Map<string, Paso>;
  token: Token;
  apuntada: Casilla | null;
  velocidad: number;
  celda: number;
  origen: { x: number; y: number };
  escala: number;
  colores: ColoresTablero;
  libres: number;
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
          <Text text={libres > 0 ? 'Muy lejos' : 'Sin acciones'} fontSize={letra} fontFamily="Shantell Sans, cursive" fontStyle="bold" fill={colores.peligro} padding={letra * 0.35} />
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
  enTurno: boolean;
  seleccionado: boolean;
  onSeleccionar: () => void;
  onArrastrar: (px: number, py: number) => void;
  onSoltar: (px: number, py: number) => void;
}

function FichaToken({ token, celda, origen, colores, escala, movible, recorrido, pg, enTurno, seleccionado, onSeleccionar, onArrastrar, onSoltar }: PropsFicha) {
  const [imagen] = useImage(token.imagen || '', 'anonymous');
  const nodo = useRef<Konva.Group>(null);
  const lado = TAMANOS[token.tamano] * celda;
  const radio = lado / 2;
  const porDefecto = !token.color || token.color === COLORES_TOKEN[token.tipo];
  const tintaDelTema = token.tipo === 'personaje' ? colores.acento : token.tipo === 'enemigo' ? colores.peligro : colores.textoSuave;
  const tinta = porDefecto ? tintaDelTema : token.color;
  const grosor = Math.max(2, celda * 0.035);
  // Cada token tiembla distinto, pero siempre igual: la semilla sale de su id
  const semilla = [...token.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  // Textos y barra con un tamaño mínimo en pantalla, para que se lean aunque el mapa esté lejos
  const letraNombre = Math.max(celda * 0.2, 13 / escala);
  const letraCondicion = Math.max(celda * 0.15, 12 / escala);
  const altoBarra = Math.max(celda * 0.08, 5 / escala);

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

  return (
    <Group
      ref={nodo}
      x={pos.x}
      y={pos.y}
      draggable={movible}
      onMouseDown={onSeleccionar}
      onTap={onSeleccionar}
      onDragStart={(e) => e.target.moveToTop()}
      onDragMove={(e) => { const p = e.target.getStage()?.getPointerPosition(); if (p) onArrastrar(p.x, p.y); }}
      onDragEnd={(e) => {
        const p = e.target.getStage()?.getPointerPosition();
        // Vuelve a su casilla: si la sala acepta el movimiento, lo recorre desde ahí
        e.target.position(enCasilla(token));
        if (p) onSoltar(p.x, p.y);
      }}
    >
      {/* Su turno: un manchón de marcatextos debajo */}
      {enTurno && <Circle x={radio} y={radio} radius={radio + 9} fill={colores.marca} opacity={0.55} listening={false} />}
      {seleccionado && (
        <Shape listening={false} stroke={colores.acento} strokeWidth={grosor * 0.8} dash={[6, 5]}
          sceneFunc={(ctx, forma) => { trazoAMano(ctx, radio, radio, radio + 6, semilla + 7); ctx.strokeShape(forma); }} />
      )}
      <Shape
        fill={colores.superficie}
        stroke={tinta}
        strokeWidth={grosor}
        lineCap="round"
        sceneFunc={(ctx, forma) => { trazoAMano(ctx, radio, radio, radio - grosor, semilla); ctx.fillStrokeShape(forma); }}
      />
      {imagen ? (
        <Group clipFunc={(ctx) => { ctx.arc(radio, radio, radio - grosor * 2, 0, Math.PI * 2); }}>
          <ImagenKonva image={imagen} {...cubrir(imagen, lado)} />
        </Group>
      ) : (
        <Text
          width={lado}
          height={lado}
          align="center"
          verticalAlign="middle"
          text={token.nombre.slice(0, 1).toUpperCase()}
          fontSize={lado * 0.42}
          fontFamily="Shantell Sans, cursive"
          fontStyle="bold"
          fill={tinta}
        />
      )}
      <Text
        y={lado + 4}
        x={-celda}
        width={lado + celda * 2}
        align="center"
        text={token.nombre}
        fontSize={letraNombre}
        fontFamily="Shantell Sans, cursive"
        fill={colores.texto}
        listening={false}
      />
      {pg && (
        <Group y={lado + 6 + letraNombre * 1.2} x={lado * 0.1} listening={false}>
          <Rect width={lado * 0.8} height={altoBarra} fill={colores.superficie} stroke={colores.texto} strokeWidth={1 / escala} />
          <Rect width={lado * 0.8 * Math.max(0, Math.min(1, pg.actual / pg.max))} height={altoBarra}
            fill={pg.actual / pg.max > 0.5 ? '#3f8f57' : pg.actual / pg.max > 0.2 ? '#d69a2d' : colores.peligro} />
        </Group>
      )}
      {/* Condiciones: un post-it pegado arriba a la derecha */}
      {token.condiciones && token.condiciones.length > 0 && (
        <Label x={lado * 0.55} y={-letraCondicion * 1.9} rotation={4} listening={false}>
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
    </Group>
  );
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
function trazoAMano(ctx: Konva.Context, cx: number, cy: number, r: number, semilla: number) {
  const puntos = 22;
  const azar = (i: number) => {
    const x = Math.sin(semilla * 12.9898 + i * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const inicio = azar(99) * Math.PI * 2;
  ctx.beginPath();
  for (let i = 0; i <= puntos + 1; i++) {
    const angulo = inicio + (i / puntos) * Math.PI * 2;
    const radio = r * (1 + (azar(i) - 0.5) * 0.06);
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

import { useEffect, useRef, useState } from 'react';
import { Circle, Group, Image as ImagenKonva, Layer, Rect, Shape, Stage, Text } from 'react-konva';
import type Konva from 'konva';
import useImage from 'use-image';
import { CornersInIcon } from '@phosphor-icons/react';
import { COLORES_TOKEN, TAMANOS, puedeMoverToken, type EstadoSala, type Sesion, type Token } from '../../compartido/sala';
import type { ColoresTablero } from '../tema';

interface Props {
  estado: EstadoSala;
  colores: ColoresTablero;
  quien: Sesion;
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
  onMover: (id: string, x: number, y: number) => void;
}

const ZOOM_MIN = 0.2;
const ZOOM_MAX = 4;

export function Tablero({ estado, colores, quien, seleccionado, onSeleccionar, onMover }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 });
  const [vista, setVista] = useState({ x: 0, y: 0, escala: 1 });
  const [imagenMapa] = useImage(estado.mapa.imagen || '', 'anonymous');
  const ajustado = useRef<string | null>(null);

  const { mapa } = estado;
  const celda = mapa.tamanoCelda;
  const ancho = imagenMapa ? imagenMapa.width : mapa.columnas * celda;
  const alto = imagenMapa ? imagenMapa.height : mapa.filas * celda;

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

  function centrar() {
    const escala = Math.min(medida.ancho / ancho, medida.alto / alto) * 0.95;
    setVista({ escala, x: (medida.ancho - ancho * escala) / 2, y: (medida.alto - alto * escala) / 2 });
  }

  // Encuadra el tablero completo al entrar y cada vez que cambia el mapa
  useEffect(() => {
    const clave = `${mapa.imagen ?? ''}|${ancho}x${alto}`;
    if (!medida.ancho || ajustado.current === clave) return;
    if (mapa.imagen && !imagenMapa) return;
    ajustado.current = clave;
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

  return (
    // Absoluto: así el canvas no empuja el tamaño de su contenedor y el tablero se puede encoger
    <div ref={contenedor} className="absolute inset-0 overflow-hidden bg-fondo">
      {medida.ancho > 0 && (
        <Stage
          width={medida.ancho}
          height={medida.alto}
          x={vista.x}
          y={vista.y}
          scaleX={vista.escala}
          scaleY={vista.escala}
          draggable
          onWheel={alHacerZoom}
          onDragEnd={(e) => {
            if (e.target === e.target.getStage()) setVista((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
          }}
          onMouseDown={(e) => e.target === e.target.getStage() && onSeleccionar(null)}
          onTap={(e) => e.target === e.target.getStage() && onSeleccionar(null)}
        >
          <Layer>
            <Rect
              width={ancho}
              height={alto}
              fill={colores.tablero}
              onMouseDown={() => onSeleccionar(null)}
              onTap={() => onSeleccionar(null)}
            />
            {imagenMapa && <ImagenKonva image={imagenMapa} listening={false} />}
            {mapa.mostrarCuadricula && (
              <Shape
                listening={false}
                stroke={colores.cuadricula}
                strokeWidth={1 / vista.escala}
                sceneFunc={(ctx, forma) => {
                  ctx.beginPath();
                  for (let x = mapa.desplazamientoX % celda; x <= ancho; x += celda) {
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, alto);
                  }
                  for (let y = mapa.desplazamientoY % celda; y <= alto; y += celda) {
                    ctx.moveTo(0, y);
                    ctx.lineTo(ancho, y);
                  }
                  ctx.strokeShape(forma);
                }}
              />
            )}
          </Layer>
          <Layer>
            {Object.values(estado.tokens).map((token) => (
              <FichaToken
                key={token.id}
                token={token}
                celda={celda}
                origen={{ x: mapa.desplazamientoX % celda, y: mapa.desplazamientoY % celda }}
                colores={colores}
                movible={puedeMoverToken(quien, token)}
                seleccionado={token.id === seleccionado}
                onSeleccionar={() => onSeleccionar(token.id)}
                onMover={(x, y) => onMover(token.id, x, y)}
              />
            ))}
          </Layer>
        </Stage>
      )}
      <button
        onClick={centrar}
        className="absolute right-3 bottom-3 flex h-10 items-center gap-2 rounded-lg border border-borde bg-superficie px-3 text-sm shadow-sm transition hover:bg-superficie-2"
      >
        <CornersInIcon size={18} aria-hidden />
        Centrar
      </button>
    </div>
  );
}

interface PropsFicha {
  token: Token;
  celda: number;
  origen: { x: number; y: number };
  colores: ColoresTablero;
  // Solo el GM y el dueño del personaje pueden arrastrarlo
  movible: boolean;
  seleccionado: boolean;
  onSeleccionar: () => void;
  onMover: (x: number, y: number) => void;
}

function FichaToken({ token, celda, origen, colores, movible, seleccionado, onSeleccionar, onMover }: PropsFicha) {
  const [imagen] = useImage(token.imagen || '', 'anonymous');
  const lado = TAMANOS[token.tamano] * celda;
  const radio = lado / 2;
  // Tiny ocupa media casilla, así que se puede colocar en pasos de media casilla
  const paso = token.tamano === 'Tiny' ? 0.5 : 1;
  const borde = token.color || COLORES_TOKEN[token.tipo];

  return (
    <Group
      x={origen.x + token.x * celda}
      y={origen.y + token.y * celda}
      draggable={movible}
      onMouseDown={onSeleccionar}
      onTap={onSeleccionar}
      onDragStart={(e) => e.target.moveToTop()}
      onDragEnd={(e) => {
        const ajustar = (valor: number, desde: number) => Math.round((valor - desde) / celda / paso) * paso;
        const x = ajustar(e.target.x(), origen.x);
        const y = ajustar(e.target.y(), origen.y);
        // Coloca el nodo en la casilla ya, por si el estado no cambia (soltó en la misma casilla)
        e.target.position({ x: origen.x + x * celda, y: origen.y + y * celda });
        if (x !== token.x || y !== token.y) onMover(x, y);
      }}
    >
      {seleccionado && <Circle x={radio} y={radio} radius={radio + 4} stroke={colores.acento} strokeWidth={4} />}
      <Circle x={radio} y={radio} radius={radio - 2} fill={borde} />
      {imagen ? (
        <Group
          clipFunc={(ctx) => {
            ctx.arc(radio, radio, radio - 5, 0, Math.PI * 2);
          }}
        >
          <ImagenKonva image={imagen} {...cubrir(imagen, lado)} />
        </Group>
      ) : (
        <Text
          width={lado}
          height={lado}
          align="center"
          verticalAlign="middle"
          text={token.nombre.slice(0, 1).toUpperCase()}
          fontSize={lado * 0.45}
          fontFamily="Alegreya, Georgia, serif"
          fontStyle="bold"
          fill="#fff8ec"
        />
      )}
      <Text
        y={lado + 3}
        x={-celda}
        width={lado + celda * 2}
        align="center"
        text={token.nombre}
        fontSize={Math.max(11, celda * 0.2)}
        fontFamily="Alegreya Sans, system-ui, sans-serif"
        fill={colores.texto}
        listening={false}
      />
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

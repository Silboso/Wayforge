import { useCallback, useEffect, useRef, useState } from 'react';
import { leerExpresion, type Personaje } from '../reglas/pf2e';
import {
  aplicar,
  type Accion, type EstadoSala, type MensajeCliente, type MensajeSala, type Presente, type Puntero, type QueTirar,
  type ResumenPersonaje, type Sesion,
} from '../compartido/sala';
import { eventosDe, type Evento } from '../compartido/eventos';

export type Fase = 'conectando' | 'entrada' | 'dentro';

// Lo que se ve de los demás en el tablero: su puntero (con cuándo se movió por última vez) y sus señales
export type PunteroAjeno = Puntero & { cuando: number };
export interface Senal { id: number; idConexion: string; nombre: string; personajeId?: string; x: number; y: number }

// Cada cuánto, como mucho, se manda el puntero propio (unas 14 veces por segundo)
const PUNTERO_MS = 70;

// Lo que el navegador recuerda de cada sala
export const almacen = {
  sesion: (sala: string) => `wayforge:sesion:${sala}`,
  // El código de GM recién creado: se usa una vez para entrar solo
  gmNuevo: (sala: string) => `wayforge:gm-nuevo:${sala}`,
  // El código de GM para mostrárselo al GM mientras no salga
  gmCodigo: (sala: string) => `wayforge:gm-codigo:${sala}`,
};

export function leer(clave: string): string | null {
  try { return localStorage.getItem(clave); } catch { return null; }
}
export function guardar(clave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch { /* almacenamiento bloqueado */ }
}

// Conexión con la sala. Al conectar se es visitante: se ve la lista de personajes y se entra con un código.
// Las acciones propias se aplican al instante (optimista) y se mandan a la sala, que las reparte al resto.
// Al reconectar, la sala manda el estado completo y eso corrige cualquier diferencia.
export function useSala(salaId: string) {
  const [fase, setFase] = useState<Fase>('conectando');
  const [lobby, setLobby] = useState<ResumenPersonaje[]>([]);
  const [quien, setQuien] = useState<Sesion>({ rol: 'visitante' });
  const [estado, setEstado] = useState<EstadoSala | null>(null);
  const [presentes, setPresentes] = useState<Presente[]>([]);
  const [conectado, setConectado] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  // Lo que acaba de pasar (tiradas, movimientos, turnos), para avisos y animaciones. Solo lo que llega de la sala.
  const [eventos, setEventos] = useState<{ id: number; evento: Evento }[]>([]);
  // Lo que la sala no dejó hacer, con su motivo (para mostrarlo en un aviso)
  const [negaciones, setNegaciones] = useState<{ id: number; motivo: string }[]>([]);
  // Una tirada propia en camino: el dado empieza a rodar al apretar, sin esperar a la sala
  const [pendiente, setPendiente] = useState<{ etiqueta: string; desde: number; caras?: number } | null>(null);
  const [punteros, setPunteros] = useState<Record<string, PunteroAjeno>>({});
  const [senales, setSenales] = useState<Senal[]>([]);
  const ws = useRef<WebSocket | null>(null);
  // Mi puntero y mi objetivo: se mandan juntos, con un ritmo máximo, y siempre llega el último
  const miPuntero = useRef<{ x: number | null; y: number | null; apunta: string | null }>({ x: null, y: null, apunta: null });
  const envioPuntero = useRef<{ ultimo: number; espera?: ReturnType<typeof setTimeout> }>({ ultimo: 0 });
  // El estado también en una ref: para comparar el antes y el después de cada acción que llega
  const estadoRef = useRef<EstadoSala | null>(null);
  const contador = useRef(0);
  const cambiarEstado = useCallback((nuevo: EstadoSala | null) => {
    estadoRef.current = nuevo;
    setEstado(nuevo);
  }, []);

  const mandar = useCallback((mensaje: MensajeCliente) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(mensaje));
  }, []);

  useEffect(() => {
    let cerrado = false;
    let reintentos = 0;
    let ping: ReturnType<typeof setInterval> | undefined;
    let espera: ReturnType<typeof setTimeout> | undefined;
    // Mientras se intenta retomar la sesión guardada, la lista de personajes no se muestra
    let reanudando = false;

    function conectar() {
      const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${protocolo}://${location.host}/api/salas/${salaId}/ws`);
      ws.current = socket;
      const enviarAhora = (m: MensajeCliente) => socket.send(JSON.stringify(m));

      socket.onopen = () => {
        reintentos = 0;
        setConectado(true);
        ping = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('ping'), 25_000);
        const sesion = leer(almacen.sesion(salaId));
        const gmNuevo = leer(almacen.gmNuevo(salaId));
        if (sesion) {
          reanudando = true;
          enviarAhora({ tipo: 'reanudar', sesion });
        } else if (gmNuevo) {
          reanudando = true;
          guardar(almacen.gmNuevo(salaId), null);
          guardar(almacen.gmCodigo(salaId), gmNuevo);
          enviarAhora({ tipo: 'entrar', como: 'gm', codigo: gmNuevo });
        }
      };

      socket.onmessage = (evento) => {
        if (evento.data === 'pong') return;
        const mensaje = JSON.parse(evento.data as string) as MensajeSala;
        switch (mensaje.tipo) {
          case 'lobby':
            setLobby(mensaje.personajes);
            if (!reanudando) {
              setFase('entrada');
              setQuien({ rol: 'visitante' });
              cambiarEstado(null);
            }
            break;
          case 'bienvenida':
            reanudando = false;
            guardar(almacen.sesion(salaId), mensaje.sesion);
            setQuien(mensaje.quien);
            setRechazo(null);
            setFase('dentro');
            break;
          case 'rechazo':
            if (reanudando) {
              reanudando = false;
              guardar(almacen.sesion(salaId), null);
              setFase('entrada');
            } else {
              setRechazo(mensaje.motivo);
            }
            break;
          case 'estado': {
            // Si lo mandó una acción (pasar de escena, el telón), también se avisa como evento
            const anterior = estadoRef.current;
            cambiarEstado(mensaje.estado);
            setPresentes(mensaje.presentes);
            const nuevos = mensaje.por && anterior ? eventosDe(anterior, mensaje.por, mensaje.estado) : [];
            if (nuevos.length) setEventos((prev) => [...prev, ...nuevos.map((evento) => ({ id: ++contador.current, evento }))].slice(-30));
            break;
          }
          case 'accion': {
            const anterior = estadoRef.current;
            if (!anterior) break;
            const posterior = aplicar(anterior, mensaje.accion);
            cambiarEstado(posterior);
            const nuevos = eventosDe(anterior, mensaje.accion, posterior);
            if (mensaje.accion.tipo === 'registrar-tirada') setPendiente(null);
            if (nuevos.length) setEventos((prev) => [...prev, ...nuevos.map((evento) => ({ id: ++contador.current, evento }))].slice(-30));
            break;
          }
          // Con niebla: lo que ahora ve este jugador. Primero la acción (para sus animaciones), después la vista nueva
          case 'vista': {
            const anterior = estadoRef.current;
            if (!anterior) break;
            const intermedio = mensaje.accion ? aplicar(anterior, mensaje.accion) : anterior;
            const posterior = { ...intermedio, tokens: mensaje.tokens, mapa: mensaje.mapa };
            cambiarEstado(posterior);
            if (mensaje.accion) {
              const nuevos = eventosDe(anterior, mensaje.accion, posterior);
              if (mensaje.accion.tipo === 'registrar-tirada') setPendiente(null);
              if (nuevos.length) setEventos((prev) => [...prev, ...nuevos.map((evento) => ({ id: ++contador.current, evento }))].slice(-30));
            }
            break;
          }
          case 'presentes': {
            setPresentes(mensaje.presentes);
            // Quien se fue deja de tener puntero
            const siguen = new Set(mensaje.presentes.map((x) => x.idConexion));
            setPunteros((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => siguen.has(id))));
            break;
          }
          case 'puntero': {
            const { tipo: _tipo, ...puntero } = mensaje;
            setPunteros((prev) => ({ ...prev, [puntero.idConexion]: { ...puntero, cuando: Date.now() } }));
            break;
          }
          case 'senal': {
            const { tipo: _tipo, ...resto } = mensaje;
            const senal = { ...resto, id: ++contador.current };
            setSenales((prev) => [...prev, senal].slice(-8));
            setTimeout(() => setSenales((prev) => prev.filter((s) => s.id !== senal.id)), 2400);
            break;
          }
          case 'negado':
            setPendiente(null);
            setNegaciones((prev) => [...prev, { id: ++contador.current, motivo: mensaje.motivo }].slice(-10));
            break;
        }
      };

      socket.onclose = () => {
        clearInterval(ping);
        setConectado(false);
        if (!cerrado) espera = setTimeout(conectar, Math.min(1000 * 2 ** reintentos++, 10_000));
      };
    }

    conectar();
    return () => {
      cerrado = true;
      clearTimeout(espera);
      clearInterval(ping);
      const socket = ws.current;
      if (!socket) return;
      socket.onclose = null;
      // Cerrar un socket que aún no abre no le avisa a la sala; se espera a que abra y entonces se cierra
      if (socket.readyState === WebSocket.CONNECTING) socket.onopen = () => socket.close();
      else socket.close();
    };
  }, [salaId, cambiarEstado]);

  const enviar = useCallback((accion: Accion) => {
    const actual = estadoRef.current;
    if (actual) cambiarEstado(aplicar(actual, accion));
    mandar({ tipo: 'accion', accion });
  }, [mandar, cambiarEstado]);

  // Respuesta a un ataque en pausa: la reacción elegida, o null para dejarlo pasar
  const responder = useCallback((esperaId: string, aptitudId: string | null) => {
    mandar({ tipo: 'responder', esperaId, aptitudId });
  }, [mandar]);

  const entrarComoGM = useCallback((codigo: string) => {
    setRechazo(null);
    guardar(almacen.gmCodigo(salaId), codigo);
    mandar({ tipo: 'entrar', como: 'gm', codigo });
  }, [mandar, salaId]);

  const entrarComoJugador = useCallback((personajeId: string, codigo: string) => {
    setRechazo(null);
    mandar({ tipo: 'entrar', como: 'jugador', personajeId, codigo });
  }, [mandar]);

  const nuevoPersonaje = useCallback((personaje: Personaje, codigo: string) => {
    setRechazo(null);
    mandar({ tipo: 'nuevo-personaje', personaje, codigo });
  }, [mandar]);

  const salir = useCallback(() => {
    mandar({ tipo: 'salir' });
    guardar(almacen.sesion(salaId), null);
    guardar(almacen.gmCodigo(salaId), null);
    setQuien({ rol: 'visitante' });
    cambiarEstado(null);
    setFase('entrada');
  }, [mandar, salaId, cambiarEstado]);

  // Sin personaje: tirada libre del GM (por ejemplo, el ataque de un enemigo)
  // `caras`: qué dado empieza a girar mientras llega el resultado (por defecto, el de la expresión o un d20)
  // `secreto`: tirada del GM que solo ve él
  const tirar = useCallback((personajeId: string | undefined, que: QueTirar, etiqueta = 'Tirando…', caras?: number, secreto = false) => {
    const deExpresion = que.tipo === 'libre' ? leerExpresion(que.expresion)?.dados[0]?.caras : undefined;
    setPendiente({ etiqueta, desde: Date.now(), caras: caras ?? deExpresion ?? 20 });
    mandar({ tipo: 'tirar', ...(personajeId ? { personajeId } : {}), que, ...(secreto ? { secreto } : {}) });
  }, [mandar]);

  // Hablar en el chat (`para`: susurro al GM o a un personaje)
  const decir = useCallback((texto: string, para?: string) => {
    mandar({ tipo: 'decir', texto, ...(para ? { para } : {}) });
  }, [mandar]);

  // Mover un token: la sala calcula el camino y, en combate, gasta los Strides
  const mover = useCallback((tokenId: string, x: number, y: number) => {
    mandar({ tipo: 'mover', tokenId, x, y });
  }, [mandar]);

  // Usar una aptitud: la sala revisa todo y tira si corresponde
  // `mas`: varios objetivos, o el punto de un área (la esquina de una explosión, hacia dónde va un cono)
  const usar = useCallback((aptitudId: string, objetivo?: string, etiqueta?: string, mas?: { objetivos?: string[]; punto?: { x: number; y: number }; nivel?: number }) => {
    if (etiqueta) setPendiente({ etiqueta, desde: Date.now() });
    mandar({
      tipo: 'usar', aptitudId, ...(objetivo ? { objetivo } : {}), ...(mas?.objetivos ? { objetivos: mas.objetivos } : {}), ...(mas?.punto ? { punto: mas.punto } : {}),
      ...(mas?.nivel ? { nivel: mas.nivel } : {}),
    });
  }, [mandar]);

  // Gastar Hero Points: todos para no morir, o uno para repetir una tirada
  const heroico = useCallback((uso: 'recuperar' | 'repetir', tiradaId?: string) => {
    mandar({ tipo: 'heroico', uso, ...(tiradaId ? { tiradaId } : {}) });
  }, [mandar]);

  // Avisos que nacen en la propia pantalla (antes de mandar algo que la sala va a rechazar)
  const negarLocal = useCallback((motivo: string) => {
    setNegaciones((prev) => [...prev, { id: ++contador.current, motivo }].slice(-10));
  }, []);

  const mandarPuntero = useCallback(() => {
    const e = envioPuntero.current;
    if (e.espera) return;
    const ya = () => {
      e.ultimo = Date.now();
      e.espera = undefined;
      mandar({ tipo: 'puntero', ...miPuntero.current });
    };
    const falta = PUNTERO_MS - (Date.now() - e.ultimo);
    if (falta <= 0) ya();
    else e.espera = setTimeout(ya, falta);
  }, [mandar]);

  // Mi puntero sobre el tablero, en casillas (null al salir del tablero)
  const moverPuntero = useCallback((x: number | null, y: number | null) => {
    const p = miPuntero.current;
    if (p.x === x && p.y === y) return;
    miPuntero.current = { ...p, x, y };
    mandarPuntero();
  }, [mandarPuntero]);

  // A quién apunto: los demás ven la marca sobre ese token
  const apuntar = useCallback((tokenId: string | null) => {
    if (miPuntero.current.apunta === tokenId) return;
    miPuntero.current = { ...miPuntero.current, apunta: tokenId };
    mandarPuntero();
  }, [mandarPuntero]);

  const senalar = useCallback((x: number, y: number) => {
    mandar({ tipo: 'senal', x, y });
  }, [mandar]);

  const iniciarCombate = useCallback((tokens: string[]) => {
    mandar({ tipo: 'iniciar-combate', tokens });
  }, [mandar]);

  // Abrir o cerrar una puerta (la sala revisa si estás al lado)
  const puerta = useCallback((id: string) => {
    mandar({ tipo: 'puerta', id });
  }, [mandar]);

  return {
    fase, lobby, quien, estado, presentes, conectado, rechazo, eventos, negaciones, pendiente, punteros, senales,
    enviar, entrarComoGM, entrarComoJugador, nuevoPersonaje, salir, tirar, iniciarCombate, responder, mover, usar, negarLocal,
    moverPuntero, apuntar, senalar, puerta, decir, heroico,
    limpiarRechazo: () => setRechazo(null),
  };
}

export type Sala = ReturnType<typeof useSala>;

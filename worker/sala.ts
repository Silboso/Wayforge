import { DurableObject } from 'cloudflare:workers';
import { esPersonajeValido } from '../reglas/pf2e';
import {
  aplicar, casillaLibre, esAccionValida, estadoInicial, puede, resumen,
  type Accion, type EstadoSala, type MensajeSala, type Presente, type Sesion, type Tirada,
} from '../compartido/sala';
import { queSeTira } from '../compartido/tiradas';

// Lo que la sala recuerda de cada conexión (sobrevive a la hibernación)
interface Conexion {
  idConexion: string;
  desde: number;
  quien: Sesion;
  // Token de la sesión con la que entró; al salir se borra
  sesion?: string;
}

// Los códigos nunca se guardan en claro: solo su hash con la sal de la sala
interface Codigos {
  sal: string;
  gm: string;
  personajes: Record<string, string>;
}

// Los clientes mandan ping cada 25 s; una conexión que calla más que esto se da por perdida
const SIN_SENAL_MS = 70_000;
// Tras 5 códigos equivocados para el mismo personaje (o el GM), se bloquea un minuto
const MAX_FALLOS = 5;
const BLOQUEO_MS = 60_000;

// Una partida. Guarda el estado en su SQLite y lo reparte por WebSocket a quienes ya entraron.
// Quien solo tiene el código de sala es un visitante: ve la lista de personajes y nada más.
export class Sala extends DurableObject<Env> {
  private estado: EstadoSala = estadoInicial();
  private codigos: Codigos | null = null;
  private fallos = new Map<string, { n: number; hasta: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Los clientes mandan "ping" para mantener viva la conexión; se contesta sin despertar al objeto
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.ctx.blockConcurrencyWhile(async () => {
      const guardado = await this.ctx.storage.get<EstadoSala>('estado');
      // Estados guardados antes de que existieran personajes y tiradas
      this.estado = { ...estadoInicial(), ...guardado };
      this.codigos = (await this.ctx.storage.get<Codigos>('codigos')) ?? null;
    });
  }

  // Llamado al crear la partida. Devuelve el código de GM, o null si la sala ya existía.
  async inicializar(): Promise<string | null> {
    if (this.codigos) return null;
    const codigoGM = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b % 10).join('');
    const sal = crypto.randomUUID();
    this.codigos = { sal, gm: await hash(sal, codigoGM), personajes: {} };
    await this.ctx.storage.put('codigos', this.codigos);
    await this.ctx.storage.put('estado', this.estado);
    return codigoGM;
  }

  async existe(): Promise<boolean> {
    return this.codigos !== null;
  }

  async fetch(req: Request): Promise<Response> {
    if (!this.codigos) return new Response('Esa sala no existe', { status: 404 });
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Se esperaba WebSocket', { status: 426 });
    }
    const [cliente, servidor] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(servidor);
    const conexion: Conexion = { idConexion: crypto.randomUUID(), desde: Date.now(), quien: { rol: 'visitante' } };
    servidor.serializeAttachment(conexion);
    this.enviarLobby(servidor);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(ws: WebSocket, texto: string | ArrayBuffer) {
    if (typeof texto !== 'string' || texto.length > 50_000) return;
    let m: Record<string, unknown>;
    try { m = JSON.parse(texto); } catch { return; }
    if (typeof m !== 'object' || m === null) return;
    const conexion = ws.deserializeAttachment() as Conexion;

    switch (m.tipo) {
      case 'entrar':
        return this.entrar(ws, conexion, m);
      case 'reanudar': {
        const quien = typeof m.sesion === 'string' ? await this.ctx.storage.get<Sesion>(`sesion:${m.sesion}`) : undefined;
        if (!quien || (quien.rol === 'jugador' && !this.estado.personajes[quien.personajeId])) {
          return enviar(ws, { tipo: 'rechazo', motivo: 'sesion-vencida' });
        }
        return this.darBienvenida(ws, conexion, quien, m.sesion as string);
      }
      case 'nuevo-personaje':
        return this.nuevoPersonaje(ws, conexion, m);
      case 'salir': {
        // Salir cierra la sesión de este dispositivo; para volver hay que escribir los códigos otra vez
        if (conexion.sesion) await this.ctx.storage.delete(`sesion:${conexion.sesion}`);
        ws.serializeAttachment({ idConexion: conexion.idConexion, desde: conexion.desde, quien: { rol: 'visitante' } } satisfies Conexion);
        this.enviarLobby(ws);
        return this.repartirPresentes();
      }
      case 'accion':
        return this.accion(ws, conexion.quien, m.accion);
      case 'tirar':
        return this.tirar(conexion.quien, m);
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code === 1005 ? 1000 : code, 'adiós'); } catch { /* ya cerrado */ }
    this.repartirPresentes(ws);
  }

  async webSocketError(ws: WebSocket) {
    try { ws.close(1011, 'error'); } catch { /* ya cerrado */ }
    this.repartirPresentes(ws);
  }

  private async entrar(ws: WebSocket, conexion: Conexion, m: Record<string, unknown>) {
    const codigos = this.codigos!;
    const codigo = typeof m.codigo === 'string' ? m.codigo.trim() : '';
    let objetivo: string;
    let esperado: string | undefined;
    let quien: Sesion;
    if (m.como === 'gm') {
      objetivo = 'gm';
      esperado = codigos.gm;
      quien = { rol: 'gm' };
    } else if (m.como === 'jugador' && typeof m.personajeId === 'string' && this.estado.personajes[m.personajeId]) {
      objetivo = m.personajeId;
      esperado = codigos.personajes[m.personajeId];
      quien = { rol: 'jugador', personajeId: m.personajeId };
    } else {
      return enviar(ws, { tipo: 'rechazo', motivo: 'no-existe' });
    }

    const ahora = Date.now();
    const registro = this.fallos.get(objetivo);
    if (registro && registro.hasta > ahora) return enviar(ws, { tipo: 'rechazo', motivo: 'bloqueado' });

    if (!esperado || (await hash(codigos.sal, codigo)) !== esperado) {
      const n = (registro?.n ?? 0) + 1;
      this.fallos.set(objetivo, n >= MAX_FALLOS ? { n: 0, hasta: ahora + BLOQUEO_MS } : { n, hasta: 0 });
      return enviar(ws, { tipo: 'rechazo', motivo: n >= MAX_FALLOS ? 'bloqueado' : 'codigo' });
    }
    this.fallos.delete(objetivo);
    const sesion = crypto.randomUUID();
    await this.ctx.storage.put(`sesion:${sesion}`, quien);
    this.darBienvenida(ws, conexion, quien, sesion);
  }

  // Un visitante crea su ficha (y entra con ella), o el GM crea una para alguien
  private async nuevoPersonaje(ws: WebSocket, conexion: Conexion, m: Record<string, unknown>) {
    const { quien } = conexion;
    if (quien.rol === 'jugador') return;
    const codigo = typeof m.codigo === 'string' ? m.codigo : '';
    // Quien crea desde la entrada no ve el tablero: la sala elige la casilla
    const { x, y } = casillaLibre(this.estado);
    const accion = { tipo: 'crear-personaje', personaje: m.personaje, x, y };
    if (!/^\d{4}$/.test(codigo) || !esAccionValida(accion, this.estado) || accion.tipo !== 'crear-personaje') {
      return enviar(ws, { tipo: 'rechazo', motivo: 'ficha-invalida' });
    }
    if (this.estado.personajes[accion.personaje.id]) return enviar(ws, { tipo: 'rechazo', motivo: 'ficha-invalida' });

    this.codigos!.personajes[accion.personaje.id] = await hash(this.codigos!.sal, codigo);
    await this.ctx.storage.put('codigos', this.codigos);
    await this.guardar(accion);
    this.repartir({ tipo: 'accion', accion });
    this.repartirLobby();

    if (quien.rol === 'visitante') {
      const nuevo: Sesion = { rol: 'jugador', personajeId: accion.personaje.id };
      const sesion = crypto.randomUUID();
      await this.ctx.storage.put(`sesion:${sesion}`, nuevo);
      this.darBienvenida(ws, conexion, nuevo, sesion);
    }
  }

  private async accion(ws: WebSocket, quien: Sesion, accion: unknown) {
    if (!esAccionValida(accion, this.estado) || !puede(quien, accion, this.estado)) {
      // Quien la mandó ya la aplicó en su pantalla: se le devuelve el estado real
      if (quien.rol !== 'visitante') this.enviarEstado(ws);
      return;
    }
    await this.guardar(accion);
    // Quien la mandó ya la aplicó en su pantalla (optimista); se reparte al resto
    this.repartir({ tipo: 'accion', accion }, ws);

    if (accion.tipo === 'editar-personaje' || accion.tipo === 'borrar-personaje') this.repartirLobby();
    if (accion.tipo === 'borrar-personaje') {
      delete this.codigos!.personajes[accion.id];
      await this.ctx.storage.put('codigos', this.codigos);
      // Quien jugaba con ese personaje vuelve a la entrada
      for (const otro of this.ctx.getWebSockets()) {
        const c = otro.deserializeAttachment() as Conexion;
        if (c.quien.rol === 'jugador' && c.quien.personajeId === accion.id) {
          otro.serializeAttachment({ idConexion: c.idConexion, desde: c.desde, quien: { rol: 'visitante' } } satisfies Conexion);
          this.enviarLobby(otro);
        }
      }
      this.repartirPresentes();
    }
    if (accion.tipo === 'editar-personaje' && accion.cambios.nombre) this.repartirPresentes();
  }

  // La sala tira los dados: así nadie puede inventar un 20
  private async tirar(quien: Sesion, m: Record<string, unknown>) {
    const personaje = typeof m.personajeId === 'string' ? this.estado.personajes[m.personajeId] : undefined;
    if (!personaje) return;
    if (quien.rol !== 'gm' && !(quien.rol === 'jugador' && quien.personajeId === personaje.id)) return;
    const que = typeof m.que === 'object' && m.que !== null ? queSeTira(personaje, m.que as never) : null;
    if (!que) return;

    const dados = Array.from({ length: que.cantidad }, () => dado(que.caras));
    const tirada: Tirada = {
      id: crypto.randomUUID(),
      quien: personaje.nombre,
      etiqueta: que.etiqueta,
      dados,
      caras: que.caras,
      modificador: que.modificador,
      total: dados.reduce((s, d) => s + d, 0) + que.modificador,
      cuando: Date.now(),
    };
    const accion: Accion = { tipo: 'registrar-tirada', tirada };
    await this.guardar(accion);
    this.repartir({ tipo: 'accion', accion });
  }

  private async guardar(accion: Accion) {
    this.estado = aplicar(this.estado, accion);
    await this.ctx.storage.put('estado', this.estado);
  }

  private darBienvenida(ws: WebSocket, conexion: Conexion, quien: Sesion, sesion: string) {
    ws.serializeAttachment({ ...conexion, quien, sesion } satisfies Conexion);
    enviar(ws, { tipo: 'bienvenida', sesion, quien });
    this.enviarEstado(ws);
    this.repartirPresentes(undefined, ws);
  }

  private enviarEstado(ws: WebSocket) {
    const { idConexion } = ws.deserializeAttachment() as Conexion;
    enviar(ws, { tipo: 'estado', estado: this.estado, presentes: this.presentes(), tuConexion: idConexion });
  }

  private enviarLobby(ws: WebSocket) {
    enviar(ws, { tipo: 'lobby', personajes: Object.values(this.estado.personajes).map(resumen) });
  }

  private repartirLobby() {
    for (const ws of this.ctx.getWebSockets()) {
      if ((ws.deserializeAttachment() as Conexion).quien.rol === 'visitante') this.enviarLobby(ws);
    }
  }

  private repartirPresentes(cerrado?: WebSocket, excepto?: WebSocket) {
    this.repartir({ tipo: 'presentes', presentes: this.presentes(cerrado) }, excepto ?? cerrado);
  }

  // Quién está en la mesa. De paso cierra las conexiones fantasma: las que se cortaron sin avisar.
  private presentes(excepto?: WebSocket): Presente[] {
    const ahora = Date.now();
    const lista: Presente[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excepto) continue;
      const { idConexion, desde, quien } = ws.deserializeAttachment() as Conexion;
      const ultimaSenal = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? desde;
      if (ahora - ultimaSenal > SIN_SENAL_MS) {
        try { ws.close(1001, 'sin señal'); } catch { /* ya cerrado */ }
        continue;
      }
      if (quien.rol === 'visitante') continue;
      const nombre = quien.rol === 'gm' ? 'GM' : this.estado.personajes[quien.personajeId]?.nombre ?? '¿?';
      lista.push({ idConexion, nombre, rol: quien.rol });
    }
    return lista;
  }

  // Reparte a quienes ya entraron (los visitantes no ven la mesa)
  private repartir(mensaje: MensajeSala, excepto?: WebSocket) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excepto) continue;
      if ((ws.deserializeAttachment() as Conexion).quien.rol === 'visitante') continue;
      enviar(ws, mensaje);
    }
  }
}

function enviar(ws: WebSocket, mensaje: MensajeSala) {
  try { ws.send(JSON.stringify(mensaje)); } catch { /* conexión cerrada */ }
}

async function hash(sal: string, codigo: string): Promise<string> {
  const datos = new TextEncoder().encode(`${sal}:${codigo}`);
  const resumen = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Dado justo: descarta los valores que sesgarían el módulo
function dado(caras: number): number {
  const limite = Math.floor(0x1_0000_0000 / caras) * caras;
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0]! >= limite);
  return (buffer[0]! % caras) + 1;
}

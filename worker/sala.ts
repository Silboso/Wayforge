import { DurableObject } from 'cloudflare:workers';
import { calcular, gradoDeExito, leerExpresion } from '../reglas/pf2e';
import {
  aplicar, caDeToken, casillaLibre, esAccionValida, estadoInicial, puede, resumen, tokenEnTurno,
  type Accion, type Combatiente, type EstadoSala, type MensajeSala, type Presente, type QueTirar, type Sesion, type Tirada,
} from '../compartido/sala';
import { queSeTira, type QueSeTira } from '../compartido/tiradas';

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
      case 'iniciar-combate':
        return this.iniciarCombate(conexion.quien, m);
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
    if (quien.rol === 'visitante') return;
    const que = m.que as QueTirar | null;
    if (typeof que !== 'object' || que === null || typeof que.tipo !== 'string') return;
    // El jugador tira siempre por su personaje; el GM por cualquiera, o por nadie en una tirada libre
    if (quien.rol === 'jugador' && m.personajeId !== undefined && m.personajeId !== quien.personajeId) return;
    const personajeId = quien.rol === 'jugador' ? quien.personajeId : typeof m.personajeId === 'string' ? m.personajeId : undefined;
    const personaje = personajeId ? this.estado.personajes[personajeId] : undefined;
    if (personajeId && !personaje) return;
    const tokenPropio = personaje && Object.values(this.estado.tokens).find((t) => t.personajeId === personaje.id);

    let plan: QueSeTira | null;
    let nombre = personaje?.nombre ?? 'GM';
    if (que.tipo === 'libre') {
      const expresion = typeof que.expresion === 'string' ? que.expresion.trim() : '';
      const leida = leerExpresion(expresion);
      if (!leida) return;
      const etiqueta = typeof que.etiqueta === 'string' ? que.etiqueta.trim().slice(0, 40) : '';
      // El GM pone el nombre del enemigo como etiqueta: "Goblin · 1d20+7"
      if (!personaje && etiqueta) nombre = etiqueta;
      plan = { etiqueta: personaje && etiqueta ? `${etiqueta} (${expresion})` : expresion, ...leida, multiplicador: 1, esAtaque: false };
    } else {
      plan = personaje ? queSeTira(personaje, que, tokenPropio?.condiciones ?? []) : null;
    }
    if (!plan) return;

    const dados = plan.dados.flatMap((d) => Array.from({ length: d.cantidad }, () => dado(d.caras)));
    const total = (dados.reduce((s, d) => s + d, 0) + plan.modificador) * plan.multiplicador;
    const esD20 = dados.length === 1 && plan.dados[0]?.caras === 20;

    // Contra la CA de un objetivo: la sala dice el grado de éxito
    const objetivoId = (que.tipo === 'ataque' || que.tipo === 'libre') && typeof que.objetivo === 'string' ? que.objetivo : undefined;
    const objetivoToken = objetivoId ? this.estado.tokens[objetivoId] : undefined;
    const ca = objetivoToken && esD20 ? caDeToken(this.estado, objetivoToken) : null;

    const tirada: Tirada = {
      id: crypto.randomUUID(),
      quien: nombre,
      etiqueta: plan.etiqueta,
      dados,
      caras: plan.dados.length === 1 ? plan.dados[0]!.caras : 0,
      modificador: plan.modificador,
      total,
      cuando: Date.now(),
      ...(objetivoToken && ca ? { objetivo: { nombre: objetivoToken.nombre, cd: ca.total, grado: gradoDeExito(total, dados[0]!, ca.total) } } : {}),
    };
    await this.guardarYRepartir({ tipo: 'registrar-tirada', tirada });

    // Un ataque en su turno gasta una acción y sube la penalización del siguiente
    if (plan.esAtaque && tokenPropio && tokenEnTurno(this.estado)?.id === tokenPropio.id) {
      await this.guardarYRepartir({ tipo: 'contar-ataque', tokenId: tokenPropio.id });
    }
  }

  // El GM empieza el combate: la sala tira la iniciativa (Perception) de cada uno
  private async iniciarCombate(quien: Sesion, m: Record<string, unknown>) {
    if (quien.rol !== 'gm' || !Array.isArray(m.tokens)) return;
    const tokens = [...new Set(m.tokens)].map((id) => (typeof id === 'string' ? this.estado.tokens[id] : undefined)).filter((t) => !!t);
    if (tokens.length === 0) return;

    const orden: Combatiente[] = [];
    for (const token of tokens) {
      const personaje = token.personajeId ? this.estado.personajes[token.personajeId] : undefined;
      const modificador = personaje ? calcular(personaje, token.condiciones ?? []).percepcion.total : token.percepcion ?? 0;
      const d = dado(20);
      orden.push({ tokenId: token.id, iniciativa: d + modificador });
      await this.guardarYRepartir({
        tipo: 'registrar-tirada',
        tirada: {
          id: crypto.randomUUID(), quien: token.nombre, etiqueta: 'Iniciativa', dados: [d], caras: 20,
          modificador, total: d + modificador, cuando: Date.now(),
        },
      });
    }
    await this.guardarYRepartir({ tipo: 'iniciar-combate', orden });
  }

  private async guardarYRepartir(accion: Accion) {
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

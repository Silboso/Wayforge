import { DurableObject } from 'cloudflare:workers';
import { calcular, gradoDeExito, leerExpresion, type Personaje } from '../reglas/pf2e';
import {
  aplicar, BLOQUEO_ESCUDO, caDeToken, casillaLibre, puedeVerMensaje, puedeVerTirada, dentroDelTablero, ladoDe, ESPERA_MS, esAccionValida, estadoInicial, motivoAlcance, motivoParaActuar, motivoParaActuarToken, planMovimiento, preparacionDe, puede,
  puedeMoverToken, reaccionesPara, resumen, tokenDePersonaje, tokenEnTurno,
  type Accion, type Combatiente, type Espera, type EstadoSala, type MensajeSala, type Presente, type QueTirar, type Sesion, type Tirada, type Token,
} from '../compartido/sala';
import { iniciativaDe, queSeTira, queTiraCriatura, type QueSeTira } from '../compartido/tiradas';
import { modificadorDefensa, motivoInmune, objetivosDe, persistenteAlTerminar, resolverUso, type Azar } from '../compartido/interacciones';
import { disponibilidad, recursosDe, todasLasAptitudes } from '../reglas/aptitudes';
import { claveDe, interaccionDe, potenciar, rangoDeLanzamiento, VAN_ULTIMO } from '../reglas/interacciones';
import { momentoIniciativa } from '../reglas/disparadores';
import { conDying, curarHeridas, NIVELES_CURAR, recuperacion } from '../reglas/muerte';
import type { Condicion } from '../reglas/condiciones';
import { distanciaEntre } from '../reglas/movimiento';
import { crearEfecto } from '../reglas/efectos';
import { alLadoDe, conCobertura, explorar, iluminacion, visibilidad, visionActiva, vistaDeJugador } from '../compartido/vision';

// Los dados de la sala, para el motor de interacciones
const AZAR: Azar = { dado: (caras) => dado(caras), id: () => crypto.randomUUID(), ahora: () => Date.now() };

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
  // Una mesa importada trae los códigos de sus personajes cifrados con la sal de la mesa original
  salPersonajes?: string;
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
  // Lo último que vieron los jugadores (para no mandarles la vista si no cambió)
  // Lo último que vio cada jugador (con visión compartida, todos bajo la clave '')
  private firmasJugadores = new Map<string, string>();
  // Quién usó Sneak y todavía no se movió (su próximo movimiento es a escondidas)
  private sigilo = new Set<string>();

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

  // Abre una mesa exportada en esta sala recién creada: su estado y los códigos de sus personajes (el GM es el nuevo)
  async importar(estado: EstadoSala, codigos: { sal: string; personajes: Record<string, string> }): Promise<boolean> {
    if (!this.codigos || Object.keys(this.estado.personajes).length > 0 || Object.keys(this.codigos.personajes).length > 0) return false;
    // Los códigos de los personajes se guardaron con la sal de la mesa vieja: se queda esa sal y se rehace el del GM
    this.codigos = { ...this.codigos, personajes: Object.fromEntries(Object.entries(codigos.personajes).filter(([id]) => estado.personajes[id])) };
    this.codigos.salPersonajes = codigos.sal;
    this.estado = estado;
    await this.ctx.storage.put('codigos', this.codigos);
    await this.ctx.storage.put('estado', this.estado);
    return true;
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
        return this.tirar(conexion.quien, m, undefined, ws);
      case 'mover':
        return this.mover(ws, conexion.quien, m);
      case 'usar':
        return this.usar(ws, conexion.quien, m);
      case 'iniciar-combate':
        return this.iniciarCombate(conexion.quien, m);
      case 'responder':
        return this.responder(conexion.quien, m.esperaId, m.aptitudId);
      case 'puerta':
        return this.puerta(ws, conexion.quien, m.id);
      case 'decir':
        return this.decir(ws, conexion.quien, m);
      case 'heroico':
        return this.heroico(ws, conexion.quien, m);
      case 'puntero':
      case 'senal':
        return this.presencia(ws, conexion, m);
      case 'exportar':
        if (conexion.quien.rol !== 'gm' || !this.codigos) return;
        return enviar(ws, {
          tipo: 'exportacion', mesa: {
            formato: 'wayforge-mesa', version: 1, exportada: Date.now(), estado: this.estado,
            codigos: { sal: this.codigos.salPersonajes ?? this.codigos.sal, personajes: this.codigos.personajes },
          },
        });
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

    if (!esperado || (await hash(quien.rol === 'jugador' ? codigos.salPersonajes ?? codigos.sal : codigos.sal, codigo)) !== esperado) {
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

    this.codigos!.personajes[accion.personaje.id] = await hash(this.codigos!.salPersonajes ?? this.codigos!.sal, codigo);
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
    // Al terminar un turno, lo persistente (fuego, ácido, sangrado) hace su daño antes de pasar al siguiente
    if (accion.tipo === 'avanzar-turno') {
      const termina = tokenEnTurno(this.estado);
      if (termina?.efectos?.some((e) => e.persistente)) {
        // Quien pasó el turno lo vio adelantado: primero se le corrige, después va todo en orden
        this.enviarEstado(ws);
        for (const a of persistenteAlTerminar(this.estado, termina, AZAR)) await this.guardarYRepartir(a);
        await this.guardarYRepartir(accion);
        return this.recuperacionAlEmpezar();
      }
    }
    // Quien la mandó ya la aplicó en su pantalla (optimista); al resto le llega filtrada (niebla, escenas, telón)
    await this.guardarYRepartir(accion, ws);
    if (accion.tipo === 'avanzar-turno') await this.recuperacionAlEmpezar();

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

  // La sala tira los dados: así nadie puede inventar un 20.
  // Si el ataque va contra un personaje que tiene una reacción para "cuando te atacan", primero le pregunta.
  private async tirar(quien: Sesion, m: Record<string, unknown>, reaccion?: { bonoCA: number; nombre: string }, ws?: WebSocket, validado = false) {
    if (quien.rol === 'visitante') return;
    const que = m.que as QueTirar | null;
    if (typeof que !== 'object' || que === null || typeof que.tipo !== 'string') return;
    // El jugador tira siempre por su personaje; el GM por cualquiera, o por nadie en una tirada libre
    if (quien.rol === 'jugador' && m.personajeId !== undefined && m.personajeId !== quien.personajeId) return;
    const personajeId = quien.rol === 'jugador' ? quien.personajeId : typeof m.personajeId === 'string' ? m.personajeId : undefined;
    const personaje = personajeId ? this.estado.personajes[personajeId] : undefined;
    if (personajeId && !personaje) return;
    // Las criaturas del GM tiran desde su token (solo el GM puede)
    const deCriatura = que.tipo === 'criatura' || que.tipo === 'dano-criatura' || que.tipo === 'chequeo-criatura';
    if (deCriatura && quien.rol !== 'gm') return;
    const criatura = deCriatura && typeof que.tokenId === 'string' ? this.estado.tokens[que.tokenId] : undefined;
    if (deCriatura && !criatura?.criatura) return;
    const tokenPropio = personaje ? tokenDePersonaje(this.estado, personaje.id) : criatura;

    // Un Strike del jugador sigue las reglas: en su turno, con una acción, y llegando al objetivo
    if (!validado && quien.rol === 'jugador' && personaje && que.tipo === 'ataque') {
      const motivo = motivoParaActuar(this.estado, personaje.id, 1);
      if (motivo) return ws && this.negar(ws, motivo);
      const golpe = personaje.golpes.find((g) => g.id === que.golpe);
      const objetivo = typeof que.objetivo === 'string' ? this.estado.tokens[que.objetivo] : undefined;
      if (golpe && objetivo && tokenPropio) {
        const lejos = motivoAlcance(tokenPropio, objetivo, golpe.distancia ?? 5);
        if (lejos) return ws && this.negar(ws, lejos);
      }
    }

    // El ataque de una criatura también sigue las reglas: en su turno, con una acción, y llegando al objetivo
    if (!validado && criatura && que.tipo === 'criatura') {
      const motivo = motivoParaActuarToken(this.estado, criatura, 1);
      if (motivo) return ws && this.negar(ws, motivo);
      const a = criatura.criatura!.ataques.find((x) => x.id === que.ataque);
      const objetivo = typeof que.objetivo === 'string' ? this.estado.tokens[que.objetivo] : undefined;
      if (a && objetivo) {
        const lejos = motivoAlcance(criatura, objetivo, a.distancia ?? 5);
        if (lejos) return ws && this.negar(ws, lejos);
      }
    }

    let plan: QueSeTira | null;
    let nombre = personaje?.nombre ?? criatura?.nombre ?? 'GM';
    if (que.tipo === 'libre') {
      const expresion = typeof que.expresion === 'string' ? que.expresion.trim() : '';
      const leida = leerExpresion(expresion);
      if (!leida) return;
      const etiqueta = typeof que.etiqueta === 'string' ? que.etiqueta.trim().slice(0, 40) : '';
      // El GM pone el nombre del enemigo como etiqueta: "Goblin · 1d20+7"
      if (!personaje && etiqueta) nombre = etiqueta;
      // Un crítico de daño se duplica, también en las tiradas libres (el daño de un conjuro)
      const critico = que.critico === true;
      plan = {
        etiqueta: `${personaje && etiqueta ? `${critico ? 'Crítico: ' : ''}${etiqueta} (${expresion})` : expresion}`,
        ...leida, multiplicador: critico ? 2 : 1, esAtaque: false,
      };
    } else if (criatura) {
      plan = queTiraCriatura(criatura, que);
    } else {
      plan = personaje ? queSeTira(personaje, que, tokenPropio?.condiciones ?? [], tokenPropio?.efectos ?? []) : null;
    }
    if (!plan) return;

    const esD20 = plan.dados.length === 1 && plan.dados[0]?.cantidad === 1 && plan.dados[0]?.caras === 20;
    const objetivoId = 'objetivo' in que && typeof que.objetivo === 'string' ? que.objetivo : undefined;
    const objetivoToken = objetivoId ? this.estado.tokens[objetivoId] : undefined;
    // Quien tira sin personaje (el GM por un enemigo) se busca por el nombre que escribió, para dibujar el golpe
    const autor = tokenPropio ?? Object.values(this.estado.tokens).find((t) => !t.personajeId && t.nombre.toLowerCase() === nombre.toLowerCase());
    // La luz y los muros: sin línea de efecto o sin verlo no hay ataque; si está oculto o escondido, chequeo plano
    const vis = plan.esAtaque && tokenPropio && objetivoToken ? visibilidad(this.estado, tokenPropio, objetivoToken) : null;
    if (vis && !validado && (!vis.efecto || !vis.ve)) {
      return ws && this.negar(ws, !vis.efecto ? `Hay algo sólido entre ${tokenPropio!.nombre} y ${objetivoToken!.nombre}.` : `${objetivoToken!.nombre}: ${vis.razon}.`);
    }

    // Un ataque contra un personaje con reacción para "cuando te atacan": la mesa espera su respuesta
    if (!reaccion && esD20 && objetivoToken?.personajeId && (plan.esAtaque || que.tipo === 'libre')) {
      const sirven = reaccionesPara(this.estado, objetivoToken.personajeId, 'te-apuntan');
      if (sirven.length) {
        const espera: Espera = {
          id: crypto.randomUUID(), atacante: nombre, etiqueta: plan.etiqueta, objetivoTokenId: objetivoToken.id,
          personajeId: objetivoToken.personajeId, aptitudes: sirven.map((a) => a.id), vence: Date.now() + ESPERA_MS,
        };
        await this.ctx.storage.put(`solicitud:${espera.id}`, { quien, m });
        await this.guardarYRepartir({ tipo: 'abrir-espera', espera });
        await this.ctx.storage.setAlarm(espera.vence);
        return;
      }
    }

    const dados = plan.dados.flatMap((d) => Array.from({ length: d.cantidad }, () => dado(d.caras)));
    const total = (dados.reduce((s, d) => s + d, 0) + plan.modificador) * plan.multiplicador;

    // Contra la CA de un objetivo: la sala dice el grado de éxito
    const ca = objetivoToken && esD20 ? caDeToken(this.estado, objetivoToken) : null;
    // Quien ataca escondido toma desprevenido al objetivo (−2 a su CA) y, al atacar, deja de estar escondido
    const escondido = !!(plan.esAtaque && tokenPropio?.condiciones?.some((c) => c.clave === 'hidden'));
    const cd = ca ? ca.total + (reaccion?.bonoCA ?? 0) - (escondido && ca ? 2 : 0) : 0;
    let grado = ca ? gradoDeExito(total, dados[0]!, cd) : undefined;
    let nota = escondido && ca ? ' · desde las sombras (−2 a su CA)' : '';
    if (grado && vis?.plano && (grado === 'exito' || grado === 'critico')) {
      const d = dado(20);
      await this.guardarYRepartir({
        tipo: 'registrar-tirada', tirada: {
          id: crypto.randomUUID(), quien: nombre, etiqueta: `Chequeo plano: ${objetivoToken!.nombre} ${vis.razon} (CD ${vis.plano})`, dados: [d], caras: 20,
          modificador: 0, total: d, cuando: Date.now(), ...(personaje ? { personajeId: personaje.id } : {}),
        },
      });
      if (d < vis.plano) { grado = 'fallo'; nota += ` · se le escapa (${vis.razon})`; }
    }
    const tirada: Tirada = {
      ...(quien.rol === 'gm' && m.secreto === true ? { secreta: true } : {}),
      id: crypto.randomUUID(),
      quien: nombre,
      etiqueta: `${reaccion?.nombre ? `${plan.etiqueta} · ${objetivoToken?.nombre} usó ${reaccion.nombre} (+${reaccion.bonoCA} CA)` : plan.etiqueta}${nota}`,
      dados,
      caras: plan.dados.length === 1 ? plan.dados[0]!.caras : 0,
      modificador: plan.modificador,
      total,
      cuando: Date.now(),
      ...(personaje ? { personajeId: personaje.id } : {}),
      ...(autor ? { autorTokenId: autor.id } : {}),
      ...(objetivoToken
        ? { objetivo: { nombre: objetivoToken.nombre, tokenId: objetivoToken.id, ...(ca && grado ? { cd, grado } : {}) } }
        : {}),
    };
    await this.guardarYRepartir({ tipo: 'registrar-tirada', tirada });

    // Un ataque en su turno sube la penalización del siguiente (y un Strike gasta su acción)
    if (plan.esAtaque && tokenPropio && tokenEnTurno(this.estado)?.id === tokenPropio.id) {
      await this.guardarYRepartir({ tipo: 'contar-ataque', tokenId: tokenPropio.id, gastaAccion: que.tipo === 'ataque' || que.tipo === 'criatura' });
    }
    if (escondido && tokenPropio) await this.guardarYRepartir({ tipo: 'poner-condicion', tokenId: tokenPropio.id, clave: 'hidden', valor: 0 });
  }

  private negar(ws: WebSocket, motivo: string) {
    enviar(ws, { tipo: 'negado', motivo });
  }

  // Mover un token: la sala calcula el camino (sin atravesar enemigos) y, en combate, gasta los Strides
  private async mover(ws: WebSocket, quien: Sesion, m: Record<string, unknown>) {
    const t = typeof m.tokenId === 'string' ? this.estado.tokens[m.tokenId] : undefined;
    const x = m.x;
    const y = m.y;
    if (!t || !Number.isInteger(x) || !Number.isInteger(y)) return;
    const destino = { x: x as number, y: y as number };
    if (quien.rol === 'visitante' || !puedeMoverToken(quien, t)) return this.negar(ws, 'Ese token no es tuyo.');
    if (!dentroDelTablero(this.estado.mapa, destino, ladoDe(t))) return this.negar(ws, 'Eso queda fuera del tablero.');
    const c = this.estado.combate;
    const enCombate = !!c && c.orden.some((o) => o.tokenId === t.id);
    let libres: number | null = null;
    if (quien.rol === 'jugador' && enCombate && t.personajeId) {
      const motivo = motivoParaActuar(this.estado, t.personajeId, 1);
      if (motivo) return this.negar(ws, motivo);
      libres = c!.acciones - c!.usadas;
    }
    // La criatura que tiene el turno se mueve como un personaje: gasta Strides y no atraviesa enemigos
    const criaturaEnTurno = quien.rol === 'gm' && enCombate && !t.personajeId && tokenEnTurno(this.estado)?.id === t.id;
    if (criaturaEnTurno) {
      const motivo = motivoParaActuarToken(this.estado, t, 1);
      if (motivo) return this.negar(ws, motivo);
      libres = c!.acciones - c!.usadas;
    }
    const sigilo = this.sigilo.has(t.id);
    const plan = planMovimiento(this.estado, t, destino, sigilo ? null : libres, sigilo);
    if ('motivo' in plan) {
      // El GM manda: si no hay camino libre, pone el token donde dice (salvo la criatura que está jugando su turno)
      if (quien.rol === 'gm' && !criaturaEnTurno) return this.guardarYRepartir({ tipo: 'mover-turno', id: t.id, camino: [{ x: t.x, y: t.y }, destino], acciones: 0 });
      return this.negar(ws, plan.motivo);
    }
    if (plan.camino.length < 2) return;
    await this.guardarYRepartir({ tipo: 'mover-turno', id: t.id, camino: plan.camino, acciones: plan.acciones });
    if (sigilo) {
      this.sigilo.delete(t.id);
      const movido = this.estado.tokens[t.id];
      const p = movido?.personajeId ? this.estado.personajes[movido.personajeId] : undefined;
      if (movido && p) await this.alTerminarSneak(movido, p);
      return;
    }
    if (plan.acciones > 0 && t.condiciones?.some((c) => c.clave === 'hidden')) await this.guardarYRepartir({ tipo: 'poner-condicion', tokenId: t.id, clave: 'hidden', valor: 0 });
  }

  // Usar una aptitud de una vez: revisa turno, acciones, usos, requisitos y alcance; gasta y tira
  private async usar(ws: WebSocket, quien: Sesion, m: Record<string, unknown>) {
    if (quien.rol !== 'jugador') return;
    const p = this.estado.personajes[quien.personajeId];
    const token = p && tokenDePersonaje(this.estado, p.id);
    const a = p && typeof m.aptitudId === 'string' ? todasLasAptitudes(p).find((x) => x.id === m.aptitudId) : undefined;
    if (!p || !token || !a) return;

    const motivo = motivoParaActuar(this.estado, p.id, a.costo);
    if (motivo) return this.negar(ws, motivo);
    // En la preparación del combate, lo de "al tirar iniciativa" se usa una vez
    const preparando = preparacionDe(this.estado, token.id);
    const alEmpezar = preparando ? momentoIniciativa(a) : null;
    if (preparando && alEmpezar && preparando.usadas.includes(a.id)) return this.negar(ws, `${a.verbo || a.nombre}: ya la usaste para este combate.`);
    const disp = disponibilidad(p, a);
    if (!disp.puede) return this.negar(ws, `${a.verbo || a.nombre}: ${disp.texto}.`);
    // Shield Block sin un escudo en la hoja no frenaría nada: mejor decirlo antes de gastar la reacción
    if (/shield block/i.test(a.nombre) && !p.escudo) return this.negar(ws, 'Para bloquear necesitas un escudo en tu hoja (ponlo al editar tu personaje).');
    if (a.requiere && !(token.condiciones ?? []).some((c) => c.clave === a.requiere)) {
      return this.negar(ws, a.requiere === 'shield-raised' ? 'Primero tienes que levantar el escudo.' : `Necesitas ${a.requiere}.`);
    }
    const objetivo = typeof m.objetivo === 'string' ? this.estado.tokens[m.objetivo] : undefined;
    const distancia = a.tirada?.tipo === 'golpe' ? (p.golpes[0]?.distancia ?? 5) : a.distancia;
    // Treat Wounds fuera de combate son 10 minutos: da tiempo de ir hasta el herido, esté donde esté
    const explorando = a.id === 'basica:treat-wounds' && !this.estado.combate;
    if (objetivo && !explorando && a.tirada && a.tirada.tipo !== 'expresion' && a.tirada.tipo !== 'percepcion') {
      const lejos = distancia !== undefined ? motivoAlcance(token, objetivo, distancia) : null;
      if (lejos) return this.negar(ws, lejos);
    }

    // Contra alguien: que lo vea y que no haya nada sólido en medio
    let inter = interaccionDe(a);
    const contra = objetivo && !explorando && objetivo.id !== token.id && (a.tirada || inter) ? visibilidad(this.estado, token, objetivo) : null;
    if (contra && (!contra.efecto || !contra.ve)) return this.negar(ws, !contra.efecto ? `Hay algo sólido entre tú y ${objetivo!.nombre}.` : `${objetivo!.nombre}: ${contra.razon}.`);
    // Hide pide sombra o algo detrás de qué cubrirse, si alguien te está viendo
    const observan = a.id === 'basica:hide'
      ? Object.values(this.estado.tokens).filter((t) => !t.personajeId && t.tipo === 'enemigo' && visibilidad(this.estado, t, token).ve)
      : [];
    if (a.id === 'basica:sneak' && !token.condiciones?.some((x) => x.clave === 'hidden')) {
      return this.negar(ws, 'Para moverte sin ser visto primero tienes que estar escondido (Hide).');
    }
    if (a.id === 'basica:hide' && observan.length && iluminacion(this.estado)(`${token.x},${token.y}`) === 2 && !conCobertura(this.estado, token)) {
      return this.negar(ws, 'Para esconderte necesitas sombra o algo detrás de qué cubrirte (una pared pegada a ti).');
    }

    // Con qué espacio se lanza (si eligió uno más alto, que tenga libre); lo potenciado suma daño o curación
    const espacio = a.recuperacion.tipo === 'espacio' && Number.isInteger(m.rango) && (m.rango as number) > a.recuperacion.rango && (m.rango as number) <= 10
      ? m.rango as number : undefined;
    if (espacio !== undefined && !recursosDe(p).espacios.some((e) => e.rango === espacio && e.usados < e.max)) {
      return this.negar(ws, `No te quedan espacios de rango ${espacio}.`);
    }
    if (inter) inter = potenciar(inter, a, rangoDeLanzamiento(a, p.nivel, espacio));

    // Con interacción (salvaciones, áreas, efectos): a quiénes alcanza, y que no estén inmunes, antes de gastar nada
    let alcance: ReturnType<typeof objetivosDe> | null = null;
    const planos: Record<string, number> = {};
    if (inter) {
      const punto = typeof m.punto === 'object' && m.punto !== null && Number.isInteger((m.punto as { x: unknown }).x) && Number.isInteger((m.punto as { y: unknown }).y)
        ? m.punto as { x: number; y: number } : undefined;
      const objetivos = Array.isArray(m.objetivos) ? m.objetivos.filter((x): x is string => typeof x === 'string').slice(0, 10) : undefined;
      alcance = objetivosDe(this.estado, token, a, inter, { ...(objetivo ? { objetivo: objetivo.id } : {}), ...(objetivos ? { objetivos } : {}), ...(punto ? { punto } : {}) }, distancia);
      if ('motivo' in alcance) return this.negar(ws, alcance.motivo);
      for (const t of alcance.tokens) {
        const inmune = motivoInmune(a, inter, token, t);
        if (inmune) return this.negar(ws, inmune);
      }
      // A los que se apunta uno por uno: que se vean; los ocultos o escondidos piden chequeo plano
      if (inter.objetivos.tipo === 'uno' || inter.objetivos.tipo === 'varios') {
        for (const t of alcance.tokens) {
          if (t.id === token.id) continue;
          const v = visibilidad(this.estado, token, t);
          if (!v.efecto || !v.ve) return this.negar(ws, !v.efecto ? `Hay algo sólido entre tú y ${t.nombre}.` : `${t.nombre}: ${v.razon}.`);
          if (v.plano) planos[t.id] = v.plano;
        }
      }
    }

    const c = this.estado.combate;
    const miTurno = !!c && tokenEnTurno(this.estado)?.id === token.id;
    if (a.recuperacion.tipo !== 'siempre') await this.guardarYRepartir({ tipo: 'usar-aptitud', personajeId: p.id, aptitudId: a.id, ...(espacio ? { rango: espacio } : {}) });
    if (a.costo === 'reaccion' && c) await this.guardarYRepartir({ tipo: 'usar-reaccion', tokenId: token.id, usada: true });
    if (typeof a.costo === 'number' && miTurno) await this.guardarYRepartir({ tipo: 'gastar-acciones', usadas: Math.min(c!.acciones, c!.usadas + a.costo) });
    if (a.efecto?.aplica) await this.guardarYRepartir({ tipo: 'poner-condicion', tokenId: token.id, clave: a.efecto.aplica, valor: 1, hasta: 'inicio-turno' });
    // Shield Block: el próximo daño lo frena el escudo (lo aplica la sala al restar)
    if (/shield block/i.test(a.nombre) && p.escudo) {
      await this.guardarYRepartir({ tipo: 'poner-efecto', tokenId: token.id, efecto: crearEfecto({
        clave: BLOQUEO_ESCUDO, nombre: `Shield Block (Dureza ${p.escudo.dureza})`, beneficioso: true, modificadores: [], rondas: 1,
      }, crypto.randomUUID(), { tokenId: token.id, nombre: a.nombre }, token.id, undefined) });
    }
    if (a.id === 'basica:sustain' && c) await this.guardarYRepartir({ tipo: 'sostener', tokenId: token.id });
    if (alEmpezar) {
      const ultimo = VAN_ULTIMO.has(claveDe(a.nombre));
      await this.guardarYRepartir({ tipo: 'usar-preparacion', tokenId: token.id, aptitudId: a.id, nombre: a.nombre, ...(ultimo ? { ultimo } : {}) });
    }

    if (a.id === 'basica:hide') return this.esconderse(token, p, observan);
    if (a.id === 'basica:seek') return this.buscar(token, p);
    if (a.id === 'basica:sneak') {
      this.sigilo.add(token.id);
      return;
    }
    if (a.id === 'basica:treat-wounds') return this.curarHeridas(ws, token, p, objetivo ?? token, m.nivel);

    if (inter && alcance && !('motivo' in alcance)) {
      const numero = (miTurno ? Math.min(c!.ataques, 2) : 0) as 0 | 1 | 2;
      const acciones = resolverUso(this.estado, { autor: token, personaje: p, aptitud: a, interaccion: inter, objetivos: alcance.tokens, ...(alcance.casillas ? { casillas: alcance.casillas } : {}), numero, planos }, AZAR);
      if ('motivo' in acciones) return this.negar(ws, acciones.motivo);
      for (const accion of acciones) await this.guardarYRepartir(accion);
      // Lo que ataca o daña delata a quien estaba escondido
      const hostil = inter.modo.tipo !== 'ninguna' || !!inter.dano || a.rasgos.includes('attack');
      if (hostil && token.condiciones?.some((x) => x.clave === 'hidden')) await this.guardarYRepartir({ tipo: 'poner-condicion', tokenId: token.id, clave: 'hidden', valor: 0 });
      // Los ataques (y lo que tiene el rasgo attack, como Trip) suben la penalización del siguiente
      if (miTurno && (inter.modo.tipo === 'ataque' || a.rasgos.includes('attack'))) {
        await this.guardarYRepartir({ tipo: 'contar-ataque', tokenId: token.id, gastaAccion: false });
      }
      return;
    }
    if (a.tirada) {
      const numero = (a.tirada.tipo === 'golpe' && miTurno ? Math.min(c!.ataques, 2) : 0) as 0 | 1 | 2;
      await this.tirar(quien, { que: { tipo: 'aptitud', id: a.id, numero, ...(objetivo ? { objetivo: objetivo.id } : {}) } }, undefined, ws, true);
    }
  }

  // Seek: Perception contra la Stealth DC de cada criatura escondida a 30 ft que podría ver; la que no supera queda a la vista
  private async buscar(token: Token, p: Personaje) {
    const mod = calcular(p, token.condiciones ?? [], token.efectos ?? []).percepcion.total;
    const d = dado(20);
    const total = d + mod;
    const escondidos = Object.values(this.estado.tokens).filter((t) => !t.personajeId && t.condiciones?.some((c) => c.clave === 'hidden')
      && distanciaEntre({ x: token.x, y: token.y }, ladoDe(token), { x: t.x, y: t.y }, ladoDe(t)) <= 30 && visibilidad(this.estado, token, t).ve);
    const hallados = escondidos.filter((t) => {
      const grado = gradoDeExito(total, d, cdSigilo(t));
      return grado === 'exito' || grado === 'critico';
    });
    await this.guardarYRepartir({
      tipo: 'registrar-tirada', tirada: {
        id: crypto.randomUUID(), quien: p.nombre, etiqueta: 'Buscar (Perception)', dados: [d], caras: 20, modificador: mod, total, cuando: Date.now(),
        personajeId: p.id, autorTokenId: token.id,
        resultado: { nota: hallados.length ? `encuentras a ${hallados.map((t) => t.nombre).join(', ')}` : 'no encuentras a nadie escondido cerca' },
      },
    });
    for (const t of hallados) await this.guardarYRepartir({ tipo: 'poner-condicion', tokenId: t.id, clave: 'hidden', valor: 0 });
  }

  // Al terminar un Sneak: Stealth contra la Perception DC más alta de los enemigos que lo ven ahora.
  // Si llega a plena luz sin nada detrás y alguien lo mira, lo ven sin tirar
  private async alTerminarSneak(token: Token, p: Personaje) {
    const observan = Object.values(this.estado.tokens).filter((t) => !t.personajeId && t.tipo === 'enemigo' && visibilidad(this.estado, t, token).ve);
    if (!observan.length) return;
    const expuesto = iluminacion(this.estado)(`${token.x},${token.y}`) === 2 && !conCobertura(this.estado, token);
    const mod = calcular(p, token.condiciones ?? [], token.efectos ?? []).habilidades.stealth.total;
    const d = dado(20);
    const total = d + mod;
    const cd = Math.max(...observan.map((t) => 10 + (modificadorDefensa(this.estado, t, 'percepcion') ?? 0)));
    const grado = gradoDeExito(total, d, cd);
    const sigue = !expuesto && (grado === 'exito' || grado === 'critico');
    await this.guardarYRepartir({
      tipo: 'registrar-tirada', tirada: {
        id: crypto.randomUUID(), quien: p.nombre, etiqueta: 'Moverte sin ser visto (Stealth)', dados: [d], caras: 20, modificador: mod, total, cuando: Date.now(),
        personajeId: p.id, autorTokenId: token.id,
        objetivo: { nombre: observan.length === 1 ? observan[0]!.nombre : `${observan.length} enemigos que miran`, cd, grado },
        resultado: { nota: sigue ? 'sigues escondido' : expuesto ? 'quedas a la vista: no hay sombra ni nada detrás de qué cubrirte' : 'te vieron' },
      },
    });
    if (!sigue) await this.guardarYRepartir({ tipo: 'poner-condicion', tokenId: token.id, clave: 'hidden', valor: 0 });
  }

  // Hide: Stealth contra la Perception DC más alta de los enemigos que lo ven; con éxito queda Hidden
  private async esconderse(token: Token, p: Personaje, observan: Token[]) {
    const mod = calcular(p, token.condiciones ?? [], token.efectos ?? []).habilidades.stealth.total;
    const d = dado(20);
    const total = d + mod;
    const cd = observan.length ? Math.max(...observan.map((t) => 10 + (modificadorDefensa(this.estado, t, 'percepcion') ?? 0))) : 0;
    const grado = observan.length ? gradoDeExito(total, d, cd) : 'exito';
    const logra = grado === 'exito' || grado === 'critico';
    await this.guardarYRepartir({
      tipo: 'registrar-tirada', tirada: {
        id: crypto.randomUUID(), quien: p.nombre, etiqueta: 'Esconderte (Stealth)', dados: [d], caras: 20, modificador: mod, total, cuando: Date.now(),
        personajeId: p.id, autorTokenId: token.id,
        objetivo: observan.length
          ? { nombre: observan.length === 1 ? observan[0]!.nombre : `${observan.length} enemigos que te ven`, cd, grado }
          : { nombre: 'nadie te ve' },
        resultado: { nota: logra ? 'quedas Hidden: te atacan con chequeo plano CD 11' : 'te siguen viendo' },
      },
    });
    if (logra) await this.guardarYRepartir({ tipo: 'poner-condicion', tokenId: token.id, clave: 'hidden', valor: 1 });
  }

  // Quien estaba siendo atacado responde: usa una reacción o la deja pasar. Después se tira el ataque.
  private async responder(quien: Sesion, esperaId: unknown, aptitudId: unknown) {
    const espera = this.estado.esperas.find((e) => e.id === esperaId);
    if (!espera) return;
    if (quien.rol !== 'gm' && !(quien.rol === 'jugador' && quien.personajeId === espera.personajeId)) return;
    const solicitud = await this.ctx.storage.get<{ quien: Sesion; m: Record<string, unknown> }>(`solicitud:${espera.id}`);
    await this.ctx.storage.delete(`solicitud:${espera.id}`);
    await this.guardarYRepartir({ tipo: 'cerrar-espera', id: espera.id });

    let reaccion: { bonoCA: number; nombre: string } | undefined;
    const p = this.estado.personajes[espera.personajeId];
    const elegida = p && typeof aptitudId === 'string' && espera.aptitudes.includes(aptitudId)
      ? reaccionesPara(this.estado, p.id, 'te-apuntan').find((a) => a.id === aptitudId)
      : undefined;
    if (p && elegida) {
      await this.guardarYRepartir({ tipo: 'usar-reaccion', tokenId: espera.objetivoTokenId, usada: true });
      if (elegida.recuperacion.tipo !== 'siempre') {
        await this.guardarYRepartir({ tipo: 'usar-aptitud', personajeId: p.id, aptitudId: elegida.id });
      }
      reaccion = { bonoCA: elegida.efecto?.bonoCA ?? 0, nombre: elegida.nombre };
    }
    // Si nadie la eligió (o no tiene bono), el ataque sigue igual; marcar la respuesta evita volver a esperar
    if (solicitud) await this.tirar(solicitud.quien, solicitud.m, reaccion ?? { bonoCA: 0, nombre: '' });
  }

  // Vence la espera de una reacción: el ataque sigue sin ella
  async alarm() {
    const ahora = Date.now();
    for (const e of this.estado.esperas.filter((x) => x.vence <= ahora)) {
      await this.responder({ rol: 'gm' }, e.id, null);
    }
    const proxima = this.estado.esperas.reduce((min, e) => Math.min(min, e.vence), Infinity);
    if (Number.isFinite(proxima)) await this.ctx.storage.setAlarm(proxima);
  }

  // El GM empieza el combate: la sala tira la iniciativa de cada uno con lo que eligió en la preparación
  // (Perception si no eligió), sumando lo que le dieron las aptitudes de preparación (Oracular Warning).
  // Quien eligió ir último (After You) no tira: queda detrás de todos.
  private async iniciarCombate(quien: Sesion, m: Record<string, unknown>) {
    if (quien.rol !== 'gm' || !Array.isArray(m.tokens) || this.estado.combate) return;
    const tokens = [...new Set(m.tokens)].map((id) => (typeof id === 'string' ? this.estado.tokens[id] : undefined)).filter((t) => !!t);
    if (tokens.length === 0) return;
    const pr = this.estado.preparacion;

    const orden: Combatiente[] = [];
    const ultimos: string[] = [];
    for (const token of tokens) {
      if (pr?.ultimos.includes(token.id)) { ultimos.push(token.id); continue; }
      const personaje = token.personajeId ? this.estado.personajes[token.personajeId] : undefined;
      const { modificador, etiqueta, bono } = iniciativaDe(token, personaje, pr?.tiradas[token.id] ?? 'percepcion');
      const d = dado(20);
      orden.push({ tokenId: token.id, iniciativa: d + modificador });
      await this.guardarYRepartir({
        tipo: 'registrar-tirada',
        tirada: {
          id: crypto.randomUUID(), quien: token.nombre, etiqueta: bono ? `${etiqueta} · ${bono > 0 ? '+' : ''}${bono} de preparación` : etiqueta,
          dados: [d], caras: 20, modificador, total: d + modificador, cuando: Date.now(),
          ...(personaje ? { personajeId: personaje.id } : {}), autorTokenId: token.id,
        },
      });
    }
    // Los que van últimos: detrás del más bajo, y entre ellos primero los enemigos (ordenar lo resuelve)
    const piso = Math.min(...orden.map((c) => c.iniciativa), 1) - 1;
    for (const id of ultimos) orden.push({ tokenId: id, iniciativa: piso, desempate: -1 });
    await this.guardarYRepartir({ tipo: 'iniciar-combate', orden });
    // Si el primero en jugar está muriendo, tira su recuperación
    await this.recuperacionAlEmpezar();
  }

  // Aplica, guarda y reparte. Con niebla, lo que el grupo ve ahora queda explorado, y a cada jugador le llega
  // solo lo suyo: la acción tal cual si no cambia lo que ve ni toca algo oculto; si no, su vista nueva.
  // `optimista`: quien mandó la acción ya la aplicó en su pantalla; no se le repite (sí lo que cambie de su vista)
  private async guardarYRepartir(accion: Accion, optimista?: WebSocket) {
    await this.guardar(accion);
    // Con el telón bajo, lo que ven los personajes no se explora (el GM está armando la escena)
    const mascara = visionActiva(this.estado.mapa) && !this.estado.telon ? explorar(this.estado) : null;
    if (mascara) await this.guardar({ tipo: 'explorar', mascara });
    // Con visión compartida todos ven lo mismo; con visión por personaje, una vista para cada uno
    const porPersonaje = !!this.estado.mapa.visionPorPersonaje;
    const vistas = new Map<string, { vista: ReturnType<typeof vistaDeJugador>; cambio: boolean; oculta: boolean }>();
    const ids = idsDe(accion);
    const vistaPara = (personajeId: string) => {
      const clave = porPersonaje ? personajeId : '';
      let v = vistas.get(clave);
      if (!v) {
        const vista = vistaDeJugador(this.estado, porPersonaje ? personajeId : undefined);
        const cambio = vista.firma !== this.firmasJugadores.get(clave);
        this.firmasJugadores.set(clave, vista.firma);
        v = { vista, cambio, oculta: ids.some((id) => this.estado.tokens[id] && !vista.estado.tokens[id]) };
        vistas.set(clave, v);
      }
      return v;
    };
    // Pasar de escena o mover el telón cambia todo lo que ve un jugador: le llega el estado entero
    // Los handouts también: así nunca viaja uno que no le mostraron
    const todo = accion.tipo.endsWith('-escena') || accion.tipo === 'telon' || accion.tipo.endsWith('-handout');
    for (const ws of this.ctx.getWebSockets()) {
      const { quien } = ws.deserializeAttachment() as Conexion;
      if (quien.rol === 'visitante') continue;
      // Un susurro ajeno o una tirada secreta no le llegan
      if (accion.tipo === 'chat' && !puedeVerMensaje(accion.mensaje, quien)) continue;
      if (accion.tipo === 'registrar-tirada' && !puedeVerTirada(accion.tirada, quien)) continue;
      const yaLaTiene = ws === optimista;
      if (quien.rol === 'gm') {
        if (!yaLaTiene) enviar(ws, { tipo: 'accion', accion });
        if (mascara) enviar(ws, { tipo: 'accion', accion: { tipo: 'explorar', mascara } });
      } else if (todo) {
        this.enviarEstado(ws, accion);
      } else {
        const { vista, cambio, oculta } = vistaPara(quien.personajeId);
        if (!cambio && !oculta) {
          if (!yaLaTiene) enviar(ws, { tipo: 'accion', accion });
        } else {
          enviar(ws, { tipo: 'vista', ...(oculta || yaLaTiene ? {} : { accion }), tokens: vista.estado.tokens, mapa: vista.estado.mapa });
        }
      }
    }
  }

  // Al empezar el turno de un personaje que está muriendo: su salvación de recuperación (chequeo plano 10 + Dying)
  private async recuperacionAlEmpezar() {
    const t = tokenEnTurno(this.estado);
    const condiciones = t?.condiciones ?? [];
    if (!t?.personajeId || !condiciones.some((c) => c.clave === 'dying')) return;
    const d = dado(20);
    const r = recuperacion(condiciones, d);
    const despues = conDying(condiciones, r.dying);
    const muere = despues.some((c) => c.clave === 'dead');
    await this.guardarYRepartir({
      tipo: 'registrar-tirada', tirada: {
        id: crypto.randomUUID(), quien: t.nombre, etiqueta: `Salvación de recuperación (Dying ${condiciones.find((c) => c.clave === 'dying')!.valor})`,
        dados: [d], caras: 20, modificador: 0, total: d, cuando: Date.now(), personajeId: t.personajeId, autorTokenId: t.id,
        objetivo: { nombre: t.nombre, tokenId: t.id, cd: r.cd, grado: r.grado, salvacion: true },
        resultado: { nota: muere ? 'muere' : r.dying === 0 ? 'se estabiliza (sigue inconsciente, Wounded +1)' : `queda Dying ${r.dying}` },
      },
    });
    await this.ponerCondiciones(t.id, condiciones, despues);
  }

  // Cambia las condiciones de un token a las de `despues` (con una acción por cada una que cambió)
  private async ponerCondiciones(tokenId: string, antes: Condicion[], despues: Condicion[]) {
    const claves = new Set([...antes, ...despues].map((c) => c.clave));
    for (const clave of claves) {
      const a = antes.find((c) => c.clave === clave)?.valor ?? 0;
      const b = despues.find((c) => c.clave === clave)?.valor ?? 0;
      if (a !== b) await this.guardarYRepartir({ tipo: 'poner-condicion', tokenId, clave, valor: b });
    }
  }

  // Hero Points: gastarlos todos para dejar de morir (sin sumar Wounded), o uno para repetir una tirada propia
  private async heroico(ws: WebSocket, quien: Sesion, m: Record<string, unknown>) {
    if (quien.rol !== 'jugador') return;
    const p = this.estado.personajes[quien.personajeId];
    const token = p && tokenDePersonaje(this.estado, p.id);
    if (!p || !token) return;
    const puntos = p.puntosHeroicos ?? 0;
    if (puntos < 1) return this.negar(ws, 'No te quedan Hero Points.');
    const decir = (texto: string) => this.guardarYRepartir({ tipo: 'chat', mensaje: { id: crypto.randomUUID(), quien: p.nombre, rol: 'jugador', personajeId: p.id, texto, cuando: Date.now() } });
    if (m.uso === 'recuperar') {
      const condiciones = token.condiciones ?? [];
      if (!condiciones.some((c) => c.clave === 'dying')) return this.negar(ws, 'Solo sirve cuando estás muriendo (Dying).');
      await this.guardarYRepartir({ tipo: 'dar-heroico', personajeId: p.id, cantidad: -puntos });
      await this.ponerCondiciones(token.id, condiciones, conDying(condiciones, 0, true));
      return decir(`Gasta ${puntos === 1 ? 'su Hero Point' : `sus ${puntos} Hero Points`}: deja de morir y queda estable a 0 PG.`);
    }
    // Repetir: una tirada propia de un d20 que no haya resuelto ya el motor (su efecto ya se aplicó)
    const t = this.estado.tiradas.slice(-12).find((x) => x.id === m.tiradaId);
    if (!t || t.personajeId !== p.id || t.dados.length !== 1 || t.caras !== 20 || t.resultado || t.secreta) {
      return this.negar(ws, 'Esa tirada no se puede repetir (solo una tirada tuya reciente de un d20).');
    }
    const d = dado(20);
    const total = d + t.modificador;
    await this.guardarYRepartir({ tipo: 'dar-heroico', personajeId: p.id, cantidad: -1 });
    await this.guardarYRepartir({
      tipo: 'registrar-tirada', tirada: {
        ...t, id: crypto.randomUUID(), dados: [d], total, cuando: Date.now(), etiqueta: `${t.etiqueta} · repetida (Hero Point)`.slice(0, 200),
        ...(t.objetivo ? { objetivo: { ...t.objetivo, ...(t.objetivo.cd !== undefined && t.objetivo.grado ? { grado: gradoDeExito(total, d, t.objetivo.cd) } : {}) } } : {}),
      },
    });
  }

  // Treat Wounds: Medicine contra la dificultad elegida; cura (o, con pifia, hace daño). El curado queda inmune
  // una hora, se le va Wounded y pasan 10 minutos para todos.
  private async curarHeridas(ws: WebSocket, token: Token, p: Personaje, objetivo: Token, pedido: unknown) {
    const destino = objetivo.personajeId ? this.estado.personajes[objetivo.personajeId] : undefined;
    if (!destino) return this.negar(ws, 'Treat Wounds es para personajes (los tuyos o tus aliados).');
    // En combate, al lado; fuera de combate son 10 minutos y da tiempo de ir hasta el herido
    if (this.estado.combate && objetivo.id !== token.id && motivoAlcance(token, objetivo, 5)) return this.negar(ws, `Tienes que estar al lado de ${objetivo.nombre}.`);
    const rango = p.habilidades.medicine;
    const nivel = NIVELES_CURAR.find((n) => n.rango === pedido) ?? [...NIVELES_CURAR].reverse().find((n) => n.rango <= rango);
    if (!nivel || nivel.rango > rango) return this.negar(ws, 'Necesitas Medicine en Trained (o más, para las dificultades altas).');
    if (objetivo.efectos?.some((e) => e.clave === 'inmune:treat-wounds')) return this.negar(ws, `${objetivo.nombre} ya recibió Treat Wounds hace menos de una hora.`);
    const mod = calcular(p, token.condiciones ?? [], token.efectos ?? []).habilidades.medicine.total;
    const d = dado(20);
    const total = d + mod;
    const grado = gradoDeExito(total, d, nivel.cd);
    const efecto = curarHeridas(grado, nivel);
    const tirada = efecto.cura ?? efecto.dana;
    const leida = tirada ? leerExpresion(tirada) : null;
    const cantidad = leida ? leida.dados.reduce((s, x) => s + Array.from({ length: x.cantidad }, () => dado(x.caras)).reduce((a, b) => a + b, 0), 0) + leida.modificador : 0;
    await this.guardarYRepartir({
      tipo: 'registrar-tirada', tirada: {
        id: crypto.randomUUID(), quien: p.nombre, etiqueta: `Treat Wounds ${nivel.nombre} (Medicine)`, dados: [d], caras: 20, modificador: mod, total, cuando: Date.now(),
        personajeId: p.id, autorTokenId: token.id, objetivo: { nombre: objetivo.nombre, tokenId: objetivo.id, cd: nivel.cd, grado },
        resultado: efecto.cura ? { curacion: cantidad, nota: `cura ${cantidad} (${efecto.cura})` } : efecto.dana ? { dano: cantidad, nota: `le hace ${cantidad} de daño (${efecto.dana})` } : { nota: 'no cura nada' },
      },
    });
    if (efecto.cura) {
      await this.guardarYRepartir({ tipo: 'curar', tokenId: objetivo.id, cantidad });
      await this.guardarYRepartir({ tipo: 'poner-condicion', tokenId: objetivo.id, clave: 'wounded', valor: 0 });
    }
    if (efecto.dana) await this.guardarYRepartir({ tipo: 'danar', tokenId: objetivo.id, cantidad });
    // La inmunidad dura una hora a partir de que termina (10 minutos de atención)
    const reloj = (this.estado.reloj ?? 0) + 10;
    await this.guardarYRepartir({
      tipo: 'poner-efecto', tokenId: objetivo.id, efecto: {
        id: crypto.randomUUID(), clave: 'inmune:treat-wounds', nombre: 'Ya atendido (Treat Wounds)', beneficioso: true, modificadores: [],
        inmuneA: 'treat-wounds', duracion: { tipo: 'minutos', hasta: reloj + 60 }, origen: { tokenId: token.id, nombre: p.nombre },
      },
    });
    await this.guardarYRepartir({ tipo: 'pasar-tiempo', minutos: 10 });
  }

  // El chat: la sala firma el mensaje con quién lo manda. Un susurro va al GM o a un personaje que exista.
  private async decir(ws: WebSocket, quien: Sesion, m: Record<string, unknown>) {
    if (quien.rol === 'visitante') return;
    const texto = typeof m.texto === 'string' ? m.texto.trim().slice(0, 500) : '';
    if (!texto) return;
    const para = typeof m.para === 'string' ? m.para : undefined;
    if (para && para !== 'gm' && !this.estado.personajes[para]) return this.negar(ws, 'A quien le susurras ya no está en la mesa.');
    const mensaje = {
      id: crypto.randomUUID(), quien: this.nombreDe(quien), rol: quien.rol, texto, cuando: Date.now(),
      ...(quien.rol === 'jugador' ? { personajeId: quien.personajeId } : {}),
      ...(para && !(quien.rol === 'gm' && para === 'gm') ? { para } : {}),
    } as const;
    await this.guardarYRepartir({ tipo: 'chat', mensaje });
  }

  // Abrir o cerrar una puerta. El GM, cualquiera (también las cerradas con llave); un jugador, la que tiene al lado,
  // y en combate solo en su turno y gastando una acción (Interact)
  private async puerta(ws: WebSocket, quien: Sesion, id: unknown) {
    const m = (this.estado.mapa.muros ?? []).find((x) => x.id === id && x.tipo === 'puerta');
    if (!m || quien.rol === 'visitante') return;
    if (quien.rol === 'jugador') {
      const token = tokenDePersonaje(this.estado, quien.personajeId);
      if (!token) return;
      if (m.conLlave) return this.negar(ws, 'Está cerrada con llave.');
      if (!alLadoDe(token, m)) return this.negar(ws, 'Tienes que estar al lado de la puerta.');
      const c = this.estado.combate;
      if (c && c.orden.some((x) => x.tokenId === token.id)) {
        const motivo = motivoParaActuar(this.estado, quien.personajeId, 1);
        if (motivo) return this.negar(ws, motivo);
        await this.guardarYRepartir({ tipo: 'gastar-acciones', usadas: Math.min(c.acciones, c.usadas + 1) });
      }
    }
    await this.guardarYRepartir({ tipo: 'alternar-puerta', id: m.id, abierta: !m.abierta });
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

  // A un jugador le llega su vista (sin escenas guardadas, con niebla y telón); al GM, todo.
  // `por`: la acción que lo provocó, para que la pantalla avise (pasar de escena, el telón)
  private enviarEstado(ws: WebSocket, por?: Accion) {
    const { idConexion, quien } = ws.deserializeAttachment() as Conexion;
    const estado = quien.rol === 'jugador' ? vistaDeJugador(this.estado, quien.personajeId).estado : this.estado;
    enviar(ws, { tipo: 'estado', estado, presentes: this.presentes(), tuConexion: idConexion, ...(por ? { por } : {}) });
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
      const nombre = this.nombreDe(quien);
      lista.push({ idConexion, nombre, rol: quien.rol });
    }
    return lista;
  }

  // Punteros, objetivos y señales: se reparten a los demás tal cual llegan, sin guardar nada
  private presencia(ws: WebSocket, conexion: Conexion, m: Record<string, unknown>) {
    const { quien, idConexion } = conexion;
    if (quien.rol === 'visitante') return;
    const coordenada = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 10_000;
    const nombre = this.nombreDe(quien);
    const personajeId = quien.rol === 'jugador' ? { personajeId: quien.personajeId } : {};
    if (m.tipo === 'senal') {
      if (!coordenada(m.x) || !coordenada(m.y)) return;
      return this.repartir({ tipo: 'senal', idConexion, nombre, ...personajeId, x: m.x as number, y: m.y as number });
    }
    const fuera = m.x === null || m.y === null;
    if (!fuera && (!coordenada(m.x) || !coordenada(m.y))) return;
    const apunta = typeof m.apunta === 'string' && this.estado.tokens[m.apunta] ? m.apunta : null;
    // La regla: dos casillas enteras
    const casilla = (c: unknown) => typeof c === 'object' && c !== null && Number.isInteger((c as { x: unknown }).x) && Number.isInteger((c as { y: unknown }).y)
      && coordenada((c as { x: number }).x) && coordenada((c as { y: number }).y);
    const r = m.regla as { a?: unknown; b?: unknown } | null | undefined;
    const regla = r && casilla(r.a) && casilla(r.b) ? { a: r.a as { x: number; y: number }, b: r.b as { x: number; y: number } } : null;
    this.repartir({
      tipo: 'puntero', idConexion, nombre, rol: quien.rol, ...personajeId,
      x: fuera ? null : m.x as number, y: fuera ? null : m.y as number, apunta, regla,
    }, ws);
  }

  private nombreDe(quien: Sesion): string {
    return quien.rol === 'gm' ? 'GM' : quien.rol === 'jugador' ? this.estado.personajes[quien.personajeId]?.nombre ?? '¿?' : '';
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

// Los tokens que nombra una acción (para saber si toca algo que un jugador no ve). Las tiradas sí le llegan:
// si un arquero escondido le dispara, se entera del disparo aunque no vea de dónde vino.
function idsDe(accion: Accion): string[] {
  const a = accion as Record<string, unknown>;
  return [a.id, a.tokenId, (a.token as { id?: unknown } | undefined)?.id].filter((x): x is string => typeof x === 'string');
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

// La Stealth DC de una criatura (10 + su Stealth; si no la tiene anotada, 10 + su Perception)
function cdSigilo(t: Token): number {
  const stealth = t.criatura?.habilidades.find((h) => /stealth/i.test(h.nombre))?.bono;
  return 10 + (stealth ?? t.percepcion ?? 0);
}

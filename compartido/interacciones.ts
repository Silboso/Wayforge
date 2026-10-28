// La sala resuelve las interacciones: a quiénes alcanza una aptitud, qué tira cada uno contra qué CD,
// y qué queda después (daño con resistencias, curación, condiciones, efectos). Puro: los dados se inyectan,
// así la sala tira de verdad y las pruebas tiran lo que quieran.

import { calcular, gradoDeExito, HABILIDADES, leerExpresion, type Grado, type Personaje } from '../reglas/pf2e';
import { golpeDeBomba } from '../reglas/objetos';
import type { Aptitud } from '../reglas/aptitudes';
import { danoAjustado } from '../reglas/criaturas';
import { ASPECTO_POR_DANO, crearEfecto, type Aspecto, type EfectoActivo } from '../reglas/efectos';
import { casillasDeArea, distanciaAEsquina, tocados } from '../reglas/areas';
import { claveDe, nombreSalvacion, resultadoPara, temporalesDe, type Interaccion, type Salvacion } from '../reglas/interacciones';
import { distanciaEntre } from '../reglas/movimiento';
import { conLineaDeEfecto, visibilidad } from './vision';
import type { Casilla } from '../reglas/movimiento';
import { queTiraCriatura } from './tiradas';
import { caDeToken, ladoDe, motivoAlcance, type Accion, type EstadoSala, type Tirada, type Token } from './sala';

export interface Azar {
  dado: (caras: number) => number;
  id: () => string;
  ahora: () => number;
}

export interface Pedido {
  objetivo?: string;
  objetivos?: string[];
  punto?: { x: number; y: number };
}

const bando = (t: Token) => (t.tipo === 'enemigo' ? 'enemigo' : 'aliado');
const origenDe = (t: Token) => ({ x: t.x, y: t.y, lado: ladoDe(t) });

// A quiénes alcanza: valida el alcance y devuelve los tokens (y las casillas, si es un área)
export function objetivosDe(estado: EstadoSala, autor: Token, a: Aptitud, i: Interaccion, pedido: Pedido, distancia: number | undefined): { tokens: Token[]; casillas?: Casilla[] } | { motivo: string } {
  const o = i.objetivos;
  const nombre = a.verbo || a.nombre;
  const aliado = (t: Token) => bando(t) === bando(autor);
  if (o.tipo === 'yo') return { tokens: [autor] };
  if (o.tipo === 'uno' || o.tipo === 'varios') {
    const ids = o.tipo === 'varios' ? [...new Set(pedido.objetivos ?? (pedido.objetivo ? [pedido.objetivo] : []))] : pedido.objetivo ? [pedido.objetivo] : [];
    // Lo que ayuda a un aliado, sin objetivo, va sobre quien lo usa
    if (ids.length === 0 && o.aliados) return { tokens: [autor] };
    if (ids.length === 0) return { motivo: `${nombre}: elige a quién.` };
    if (o.tipo === 'varios' && ids.length > o.max) return { motivo: `${nombre} alcanza como mucho a ${o.max}.` };
    const tokens: Token[] = [];
    for (const id of ids) {
      const t = estado.tokens[id];
      if (!t) return { motivo: 'Ese objetivo ya no está en el tablero.' };
      if (o.aliados && !aliado(t)) return { motivo: `${nombre} es para tus aliados.` };
      const lejos = t.id !== autor.id && distancia !== undefined ? motivoAlcance(autor, t, distancia) : null;
      if (lejos) return { motivo: lejos };
      tokens.push(t);
    }
    return { tokens };
  }
  const area = o.area;
  if (area.forma !== 'emanacion' && !pedido.punto) return { motivo: `${nombre}: elige dónde en el tablero.` };
  if (area.forma === 'explosion' && distancia !== undefined && distanciaAEsquina(origenDe(autor), pedido.punto!) > distancia) {
    return { motivo: `Muy lejos: ${nombre} llega a ${distancia} ft.` };
  }
  // Una explosión sale de su esquina; lo demás, de quien la lanza. Las paredes la cortan.
  const desde = area.forma === 'explosion' ? pedido.punto! : { x: autor.x + ladoDe(autor) / 2, y: autor.y + ladoDe(autor) / 2 };
  const casillas = conLineaDeEfecto(estado.mapa.muros ?? [], desde, casillasDeArea(area, origenDe(autor), pedido.punto ?? null));
  const todos = Object.values(estado.tokens).map((t) => ({ ...t, lado: ladoDe(t) }));
  let tokens: Token[] = tocados(casillas, todos).map((t) => estado.tokens[t.id]!);
  if (o.aliados) tokens = tokens.filter(aliado);
  // Una emanación que daña elige a los enemigos; las demás áreas alcanzan a todos menos a quien la lanza desde fuera
  else if (area.forma === 'emanacion') tokens = tokens.filter((t) => !aliado(t));
  if (o.soloOtros) tokens = tokens.filter((t) => t.id !== autor.id);
  return { tokens, casillas };
}

// El modificador de una defensa de un token (para su salvación, o para la CD contra la que se tira: 10 + esto)
export function modificadorDefensa(estado: EstadoSala, t: Token, d: Salvacion | 'percepcion'): number | null {
  if (t.personajeId) {
    const p = estado.personajes[t.personajeId];
    if (!p) return null;
    const f = calcular(p, t.condiciones ?? [], t.efectos ?? []);
    return d === 'percepcion' ? f.percepcion.total : f.salvaciones[d].total;
  }
  return queTiraCriatura(t, { tipo: 'chequeo-criatura', tokenId: t.id, clave: d })?.modificador ?? null;
}

// Lo que tira quien la usa (ataque o skill) y su CD (para las salvaciones)
function numerosDelAutor(p: Personaje, autor: Token, a: Aptitud, i: Interaccion, numero: 0 | 1 | 2): { mod: number | null; cd: number | null } {
  const f = calcular(p, autor.condiciones ?? [], autor.efectos ?? []);
  const m = i.modo;
  if (m.tipo === 'ataque') {
    // Una bomba es un Strike con Dex y la competencia en armas marciales
    if (a.rasgos.includes('bomb')) return { mod: calcular({ ...p, golpes: [golpeDeBomba(p, a)] }, autor.condiciones ?? [], autor.efectos ?? []).golpes[0]!.penalizaciones[numero], cd: null };
    if (a.tirada?.tipo === 'golpe') return { mod: f.golpes[0]?.penalizaciones[numero] ?? null, cd: null };
    return { mod: f.conjuros ? f.conjuros.ataque.total - numero * 5 : null, cd: null };
  }
  if (m.tipo === 'chequeo') return { mod: f.habilidades[m.habilidad].total, cd: null };
  if (m.tipo === 'salvacion') return { mod: null, cd: (m.cd === 'clase' ? f.claseCD?.total : f.conjuros?.cd.total ?? f.claseCD?.total) ?? null };
  return { mod: null, cd: null };
}

function tirarExpresion(expresion: string, azar: Azar): { dados: number[]; caras: number; modificador: number; total: number } | null {
  const leida = leerExpresion(expresion);
  if (!leida) return null;
  const dados = leida.dados.flatMap((d) => Array.from({ length: d.cantidad }, () => azar.dado(d.caras)));
  return { dados, caras: leida.dados.length === 1 ? leida.dados[0]!.caras : 0, modificador: leida.modificador, total: Math.max(0, dados.reduce((s, x) => s + x, 0) + leida.modificador) };
}

export interface Uso {
  autor: Token;
  personaje: Personaje;
  aptitud: Aptitud;
  interaccion: Interaccion;
  objetivos: Token[];
  casillas?: Casilla[];
  // Cuántos ataques lleva en el turno (para la penalización)
  numero: 0 | 1 | 2;
  // Los objetivos que hay que pasar con un chequeo plano (5 si están ocultos, 11 si escondidos)
  planos?: Record<string, number>;
}

// Resuelve el uso contra cada objetivo. Devuelve las acciones que la sala aplica en orden:
// el área para verla, la tirada de daño (una para todos), y por objetivo su tirada, su daño y lo que le quede.
export function resolverUso(estado: EstadoSala, u: Uso, azar: Azar): Accion[] | { motivo: string } {
  const { autor, aptitud: a, interaccion: i } = u;
  const nombre = a.verbo || a.nombre;
  const salen: Accion[] = [];
  const numeros = numerosDelAutor(u.personaje, autor, a, i, u.numero);
  if ((i.modo.tipo === 'ataque' || i.modo.tipo === 'chequeo') && numeros.mod === null) return { motivo: `${nombre}: tu ficha no tiene con qué tirarlo.` };
  if (i.modo.tipo === 'salvacion' && numeros.cd === null) return { motivo: `${nombre}: tu ficha no tiene CD de conjuro ni de clase.` };

  const tipoDano = i.dano?.tipo ?? '';
  const aspecto: Aspecto | undefined = ASPECTO_POR_DANO[tipoDano] ?? (i.curacion || i.efecto?.beneficioso ? 'bendicion' : undefined);
  if (u.casillas?.length) {
    salen.push({ tipo: 'mostrar-area', casillas: u.casillas.slice(0, 400), ...(aspecto ? { aspecto } : {}), ...(tipoDano ? { tipoDano } : {}), autorTokenId: autor.id });
  }
  const tirada = (t: Omit<Tirada, 'id' | 'cuando'>): Accion => ({ tipo: 'registrar-tirada', tirada: { id: azar.id(), cuando: azar.ahora(), ...t } });
  const solo = u.objetivos.length === 1 && i.modo.tipo === 'ninguna' ? u.objetivos[0] : undefined;

  // El daño (o la curación) se tira una vez y vale para todos
  const dano = i.dano ? tirarExpresion(i.dano.formula, azar) : null;
  const curacion = i.curacion ? tirarExpresion(i.curacion, azar) : null;
  const pendientes: { tokenId: string; tirada: Accion }[] = [];
  for (const [tirado, etiqueta] of [[dano, `Daño de ${nombre}${tipoDano ? ` (${tipoDano})` : ''}`], [curacion, `Curación de ${nombre}`]] as const) {
    if (!tirado) continue;
    const accion = tirada({ quien: autor.nombre, etiqueta, ...tirado, personajeId: u.personaje.id, autorTokenId: autor.id });
    // Sin tirada por objetivo (Force Barrage, Heal a uno), esta misma lleva el resultado
    if (solo) pendientes.push({ tokenId: solo.id, tirada: accion });
    else salen.push(accion);
  }

  const cuentaEn = estado.combate?.orden.some((c) => c.tokenId === autor.id) ? autor.id : undefined;
  const ronda = estado.combate?.ronda;
  const origen = { tokenId: autor.id, nombre: autor.nombre };
  for (const t of u.objetivos) {
    // Oculto o escondido: antes de nada, un chequeo plano; si falla, se le escapa
    const plano = u.planos?.[t.id];
    if (plano) {
      const d = azar.dado(20);
      salen.push(tirada({
        quien: autor.nombre, etiqueta: `Chequeo plano contra ${t.nombre} (CD ${plano})`, dados: [d], caras: 20, modificador: 0, total: d,
        personajeId: u.personaje.id, autorTokenId: autor.id, objetivo: { nombre: t.nombre, tokenId: t.id },
        resultado: { nota: d >= plano ? 'lo encuentras' : 'se te escapa: no lo alcanza' },
      }));
      if (d < plano) continue;
    }
    let grado: Grado | null = null;
    let porObjetivo: Tirada | null = null;
    const m = i.modo;
    if (m.tipo === 'ataque' || m.tipo === 'chequeo') {
      const cd = m.tipo === 'ataque' ? caDeToken(estado, t)?.total : 10 + (modificadorDefensa(estado, t, m.contra) ?? 0);
      if (cd === undefined) continue;
      const d = azar.dado(20);
      const total = d + numeros.mod!;
      grado = gradoDeExito(total, d, cd);
      const que = m.tipo === 'ataque' ? (a.tirada?.tipo === 'golpe' ? 'Strike' : 'ataque de conjuro') : HABILIDADES.find((h) => h.clave === m.habilidad)!.nombre;
      porObjetivo = {
        id: azar.id(), cuando: azar.ahora(), quien: autor.nombre, etiqueta: `${nombre} (${que})`, dados: [d], caras: 20, modificador: numeros.mod!, total,
        personajeId: u.personaje.id, autorTokenId: autor.id, objetivo: { nombre: t.nombre, tokenId: t.id, cd, grado },
      };
    } else if (m.tipo === 'salvacion') {
      const mod = modificadorDefensa(estado, t, m.salvacion) ?? 0;
      const d = azar.dado(20);
      const total = d + mod;
      grado = gradoDeExito(total, d, numeros.cd!);
      porObjetivo = {
        id: azar.id(), cuando: azar.ahora(), quien: t.nombre, etiqueta: `${nombreSalvacion(m.salvacion)} contra ${nombre}`, dados: [d], caras: 20, modificador: mod, total,
        autorTokenId: autor.id, objetivo: { nombre: t.nombre, tokenId: t.id, cd: numeros.cd!, grado, salvacion: true },
      };
    }
    const r = resultadoPara(i, grado);
    const despues: Accion[] = [];
    let aplicado: number | undefined;
    let nota: string | undefined = r.texto;
    if (dano && r.dano) {
      const bruto = Math.floor(dano.total * r.dano);
      const ajuste = t.personajeId ? { total: bruto, nota: null } : danoAjustado(t.criatura, bruto, tipoDano || null);
      aplicado = ajuste.total;
      if (ajuste.nota) nota = [nota, ajuste.nota].filter(Boolean).join(' · ');
      if (aplicado > 0) despues.push({ tipo: 'danar', tokenId: t.id, cantidad: aplicado, ...(r.dano === 2 && m.tipo === 'ataque' ? { critico: true } : {}) });
    } else if (dano) {
      aplicado = 0;
    }
    let curado: number | undefined;
    if (curacion && r.dano !== 0) {
      curado = curacion.total;
      despues.push({ tipo: 'curar', tokenId: t.id, cantidad: curado });
    }
    const temporales = temporalesDe(i.temporales, u.personaje.nivel);
    if (temporales > 0 && t.personajeId) {
      despues.push({ tipo: 'dar-temporales', tokenId: t.id, cantidad: temporales });
      nota = [nota, `+${temporales} PG temporales`].filter(Boolean).join(' · ');
    }
    for (const c of r.condiciones ?? []) {
      const actual = t.condiciones?.find((x) => x.clave === c.clave)?.valor ?? 0;
      if (c.valor > actual) despues.push({ tipo: 'poner-condicion', tokenId: t.id, clave: c.clave, valor: c.valor });
    }
    const plantilla = r.efecto ?? (grado === null || i.modo.tipo === 'ninguna' ? i.efecto : undefined);
    if (plantilla) despues.push({ tipo: 'poner-efecto', tokenId: t.id, efecto: crearEfecto(plantilla, azar.id(), origen, cuentaEn ?? t.id, ronda) });
    for (const c of r.alAutor ?? []) despues.push({ tipo: 'poner-condicion', tokenId: autor.id, clave: c.clave, valor: c.valor });
    if (i.inmunidad) {
      const inmune: EfectoActivo = crearEfecto({
        clave: `inmune:${claveDe(a.nombre)}`, nombre: `Inmune a ${a.nombre}`.slice(0, 60), beneficioso: true, modificadores: [],
        inmuneA: inmunidadClave(a, autor), rondas: i.inmunidad,
      }, azar.id(), origen, t.id, ronda);
      despues.push({ tipo: 'poner-efecto', tokenId: t.id, efecto: inmune });
    }
    const resultado = {
      ...(aplicado !== undefined ? { dano: aplicado } : {}), ...(curado !== undefined ? { curacion: curado } : {}),
      ...(tipoDano ? { tipo: tipoDano } : {}), ...(nota ? { nota } : {}),
    };
    if (porObjetivo) salen.push({ tipo: 'registrar-tirada', tirada: { ...porObjetivo, resultado } });
    const pendiente = pendientes.find((x) => x.tokenId === t.id);
    if (pendiente && pendiente.tirada.tipo === 'registrar-tirada') {
      salen.push({ ...pendiente.tirada, tirada: { ...pendiente.tirada.tirada, objetivo: { nombre: t.nombre, tokenId: t.id }, resultado } });
    }
    salen.push(...despues);
  }
  return salen;
}

// Lo que se ve sobre cada token mientras se apunta: si sirve como objetivo y, si sirve, qué se tira contra él.
// No dice números de las criaturas (el jugador no ve sus CD): "contra su Will · 15 ft".
export interface Pista { valido: boolean; texto: string }

export function pistaObjetivo(estado: EstadoSala, autor: Token, a: Aptitud | null, i: Interaccion | null, t: Token, distancia: number | undefined): Pista {
  const o = i?.objetivos;
  const propio = t.id === autor.id;
  if (o?.tipo === 'yo') return propio ? { valido: true, texto: 'sobre ti' } : { valido: false, texto: 'solo sobre ti' };
  if (o && 'aliados' in o && o.aliados && bando(t) !== bando(autor)) return { valido: false, texto: 'no es tu aliado' };
  if (propio && !(o && 'aliados' in o && o.aliados)) return { valido: false, texto: 'eres tú' };
  const pies = propio ? 0 : distanciaEntre(autor, ladoDe(autor), t, ladoDe(t));
  if (distancia !== undefined && pies > distancia) return { valido: false, texto: `lejos: a ${pies} ft (llegas a ${distancia})` };
  const vista = visibilidad(estado, autor, t);
  if (!vista.efecto) return { valido: false, texto: 'hay una pared en medio' };
  if (!vista.ve) return { valido: false, texto: vista.razon };
  if (a && i) {
    const inmune = motivoInmune(a, i, autor, t);
    if (inmune) return { valido: false, texto: 'inmune por ahora' };
  }
  const m = i?.modo;
  const que = !m ? ''
    : m.tipo === 'ataque' ? 'contra su CA'
    : m.tipo === 'chequeo' ? `contra su ${m.contra === 'percepcion' ? 'Perception' : nombreSalvacion(m.contra)}`
    : m.tipo === 'salvacion' ? `salva con ${nombreSalvacion(m.salvacion)}`
    : i?.curacion ? 'lo curas' : i?.efecto ? i.efecto.nombre : i?.dano ? 'daño sin tirar' : '';
  const lejos = pies > 0 ? `${pies} ft` : '';
  const plano = vista.plano ? `${vista.razon}: CD ${vista.plano}` : '';
  return { valido: true, texto: [que, lejos, plano].filter(Boolean).join(' · ') || 'sirve' };
}

// "demoralize:<token de quien asusta>": la marca que deja la inmunidad
export function inmunidadClave(a: Aptitud, autor: Token): string {
  return `${claveDe(a.nombre)}:${autor.id}`.slice(0, 100);
}

// ¿Ya no le sirve contra este objetivo? (Demoralize repetido)
export function motivoInmune(a: Aptitud, i: Interaccion, autor: Token, t: Token): string | null {
  if (!i.inmunidad) return null;
  const clave = inmunidadClave(a, autor);
  return t.efectos?.some((e) => e.inmuneA === clave) ? `${t.nombre} ya no cae con tu ${a.verbo || a.nombre} por un rato.` : null;
}

// Al terminar su turno, lo persistente hace daño; con 15 o más en un d20 plano se apaga
export function persistenteAlTerminar(estado: EstadoSala, t: Token, azar: Azar): Accion[] {
  const salen: Accion[] = [];
  for (const e of t.efectos ?? []) {
    if (!e.persistente) continue;
    const tirado = tirarExpresion(e.persistente.dano, azar);
    if (!tirado) continue;
    const ajuste = t.personajeId ? { total: tirado.total, nota: null } : danoAjustado(t.criatura, tirado.total, e.persistente.tipo || null);
    salen.push({
      tipo: 'registrar-tirada', tirada: {
        id: azar.id(), cuando: azar.ahora(), quien: t.nombre, etiqueta: `${e.nombre}: daño persistente (${e.persistente.tipo})`, ...tirado,
        objetivo: { nombre: t.nombre, tokenId: t.id }, resultado: { dano: ajuste.total, tipo: e.persistente.tipo, ...(ajuste.nota ? { nota: ajuste.nota } : {}) },
      },
    });
    if (ajuste.total > 0) salen.push({ tipo: 'danar', tokenId: t.id, cantidad: ajuste.total });
    const d = azar.dado(20);
    salen.push({
      tipo: 'registrar-tirada', tirada: {
        id: azar.id(), cuando: azar.ahora(), quien: t.nombre, etiqueta: `Chequeo plano para quitarse ${e.nombre} (CD 15)`, dados: [d], caras: 20, modificador: 0, total: d,
      },
    });
    if (d >= 15) salen.push({ tipo: 'quitar-efecto', tokenId: t.id, efectoId: e.id });
  }
  return salen;
}

// Prueba de punta a punta: arma una mesa en el servidor y juega una ronda entera como lo harían el GM y dos jugadores,
// por el mismo WebSocket que usa la app. Revisa que la sala cumpla las reglas en cada paso.
// Uso: npm run e2e                     (con `npm run dev` corriendo)
//      npm run e2e -- https://wayforge.convoca.workers.dev

import assert from 'node:assert/strict';

const base = process.argv[2] ?? 'http://localhost:5173';
const wsBase = base.replace(/^http/, 'ws');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let pasos = 0;
const paso = (texto) => console.log(`  ✓ ${++pasos}. ${texto}`);

// Una conexión a la mesa: guarda el último estado (aplicando lo que llega como el cliente no puede hacerlo aquí,
// así que se pide el estado entero al GM cuando hace falta) y lo que la sala negó o tiró
async function conectar(codigo, entrar) {
  const ws = new WebSocket(`${wsBase}/api/salas/${codigo}/ws`);
  const yo = { ws, estado: null, negados: [], tiradas: [], bienvenida: null, rechazo: null };
  ws.addEventListener('message', (e) => {
    if (e.data === 'pong') return;
    const m = JSON.parse(e.data);
    if (m.tipo === 'estado') yo.estado = m.estado;
    if (m.tipo === 'bienvenida') yo.bienvenida = m;
    if (m.tipo === 'rechazo') yo.rechazo = m.motivo;
    if (m.tipo === 'negado') yo.negados.push(m.motivo);
    if (m.tipo === 'accion' && m.accion.tipo === 'registrar-tirada') yo.tiradas.push(m.accion.tirada);
  });
  await new Promise((r, f) => { ws.addEventListener('open', r); ws.addEventListener('error', f); });
  ws.send(JSON.stringify(entrar));
  // Hasta que la sala conteste (en producción, a veces tarda más de medio segundo)
  for (let i = 0; i < 50 && !yo.estado && !yo.rechazo && !yo.bienvenida; i++) await esperar(100);
  await esperar(300);
  yo.mandar = (m) => ws.send(JSON.stringify(m));
  yo.accion = (accion) => yo.mandar({ tipo: 'accion', accion });
  return yo;
}

const skills = (marcadas = {}) => Object.fromEntries(
  ['acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine', 'nature',
    'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery'].map((h) => [h, marcadas[h] ?? 0]));
const ficha = (extra) => ({
  ascendencia: 'Human', nivel: 3, pgTemporales: 0, velocidad: 25, notas: '', pgAscendencia: 8, percepcion: 2,
  salvaciones: { fortitude: 2, reflex: 2, will: 1 }, habilidades: skills(), ...extra,
});
const kyra = ficha({
  id: 'kyra', nombre: 'Kyra', clase: 'Fighter', atributos: { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 }, pgClase: 10, pgActual: 44,
  armadura: { nombre: 'Chain mail', rango: 1, bonoObjeto: 4, topeDex: 1 },
  golpes: [{ id: 'espada', nombre: 'Longsword', atributo: 'str', rango: 2, bonoObjeto: 1, dados: '1d8', tipoDano: 'slashing', sumarFuerza: true, agil: false }],
});
const ezren = ficha({
  id: 'ezren', nombre: 'Ezren', clase: 'Wizard', atributos: { str: 0, dex: 2, con: 1, int: 4, wis: 1, cha: 0 }, pgClase: 6, pgActual: 29,
  armadura: { nombre: '', rango: 1, bonoObjeto: 0, topeDex: null }, golpes: [],
  lanzador: { tradicion: 'arcane', atributo: 'int', rango: 1 },
  recursos: { foco: { max: 1, actual: 1 }, espacios: [{ rango: 1, max: 2, usados: 0 }], usos: {} },
  aptitudes: [{
    id: 'rayo', nombre: 'Ray of Frost', verbo: 'Rayo de escarcha', categoria: 'truco', costo: 2, recuperacion: { tipo: 'siempre' },
    descripcion: 'Ataque de conjuro: 2d4 de frío.', rasgos: ['attack', 'cantrip', 'cold'], tirada: { tipo: 'ataque-conjuro' }, dano: '2d4', distancia: 120,
    interaccion: { modo: { tipo: 'ataque' }, objetivos: { tipo: 'uno' }, dano: { formula: '2d4', tipo: 'cold' } },
  }],
});
const goblin = {
  id: 'goblin', nombre: 'Goblin', tipo: 'enemigo', tamano: 'Small', x: 8, y: 6, color: '#c8392b', ca: 15, pg: { actual: 40, max: 40 }, percepcion: 5,
  criatura: {
    nivel: 1, salvaciones: { fortitude: 6, reflex: 8, will: 4 }, velocidad: 25, habilidades: [], rasgos: ['Goblin'], notas: '',
    ataques: [{ id: 'dogslicer', nombre: 'Dogslicer', bono: 8, dano: '1d6+2', tipoDano: 'slashing', agil: true, rasgos: ['agile'] }],
  },
};

console.log(`Ronda de prueba en ${base}`);
const r = await fetch(`${base}/api/salas`, { method: 'POST' }).catch(() => null);
assert.ok(r?.ok, `No pude crear la mesa en ${base}. ¿Está corriendo "npm run dev"?`);
const { codigo, codigoGM } = await r.json();
paso(`mesa creada (${codigo.toUpperCase()})`);

const gm = await conectar(codigo, { tipo: 'entrar', como: 'gm', codigo: codigoGM });
assert.equal(gm.bienvenida?.quien.rol, 'gm');
for (const [p, c] of [[kyra, '1234'], [ezren, '5678']]) { gm.mandar({ tipo: 'nuevo-personaje', personaje: p, codigo: c }); await esperar(250); }
gm.accion({ tipo: 'crear-token', token: goblin });
await esperar(300);
// El GM pide el estado entero de nuevo (reconectando) para revisar lo armado
const gm2 = await conectar(codigo, { tipo: 'entrar', como: 'gm', codigo: codigoGM });
assert.deepEqual(Object.keys(gm2.estado.personajes).sort(), ['ezren', 'kyra']);
assert.ok(gm2.estado.tokens.goblin);
paso('dos personajes y un goblin en el tablero');

const mal = await conectar(codigo, { tipo: 'entrar', como: 'jugador', personajeId: 'kyra', codigo: '0000' });
assert.equal(mal.rechazo, 'codigo');
mal.ws.close();
const jk = await conectar(codigo, { tipo: 'entrar', como: 'jugador', personajeId: 'kyra', codigo: '1234' });
const je = await conectar(codigo, { tipo: 'entrar', como: 'jugador', personajeId: 'ezren', codigo: '5678' });
assert.equal(jk.bienvenida?.quien.personajeId, 'kyra');
assert.equal(je.bienvenida?.quien.personajeId, 'ezren');
paso('cada jugador entra con su código (y con uno equivocado, no)');

// Un jugador no puede hacer cosas del GM
jk.accion({ tipo: 'crear-token', token: { ...goblin, id: 'trampa' } });
await esperar(300);
const gm3 = await conectar(codigo, { tipo: 'entrar', como: 'gm', codigo: codigoGM });
assert.equal(gm3.estado.tokens.trampa, undefined);
paso('un jugador no puede poner criaturas');

// Preparar el combate: cada jugador avisa que está listo; después el GM tira la iniciativa
const tokens = ['kyra', 'ezren', 'goblin'];
gm.accion({ tipo: 'preparar-combate', tokens });
await esperar(300);
jk.accion({ tipo: 'marcar-listo', tokenId: 'kyra', listo: true });
je.accion({ tipo: 'marcar-listo', tokenId: 'ezren', listo: true });
await esperar(300);
gm.mandar({ tipo: 'iniciar-combate', tokens });
await esperar(700);
let ver = await conectar(codigo, { tipo: 'entrar', como: 'gm', codigo: codigoGM });
const combate = ver.estado.combate;
assert.ok(combate, 'el combate no empezó');
assert.equal(combate.orden.length, 3);
assert.equal(combate.ronda, 1);
paso(`iniciativa: ${combate.orden.map((o) => ver.estado.tokens[o.tokenId].nombre).join(' → ')}`);

// Fuera de su turno, un jugador no puede atacar
const enTurno = () => ver.estado.combate.orden[ver.estado.combate.turno].tokenId;
const noLeToca = enTurno() === 'kyra' ? je : jk;
const antesNegados = noLeToca.negados.length;
noLeToca.mandar(noLeToca === jk
  ? { tipo: 'tirar', personajeId: 'kyra', que: { tipo: 'ataque', golpe: 'espada', numero: 0, objetivo: 'goblin' } }
  : { tipo: 'usar', aptitudId: 'rayo', objetivo: 'goblin' });
await esperar(400);
assert.ok(noLeToca.negados.length > antesNegados, 'debió negarse: no es su turno');
paso('fuera de su turno, la sala no deja actuar');

// La ronda: cada uno juega su turno
const pgGoblin = ver.estado.tokens.goblin.pg.actual;
for (let i = 0; i < 3; i++) {
  ver = await conectar(codigo, { tipo: 'entrar', como: 'gm', codigo: codigoGM });
  const quien = enTurno();
  if (quien === 'kyra') {
    // Se acerca (un Stride) y ataca; la sala tira y aplica el daño si acierta
    jk.mandar({ tipo: 'mover', tokenId: 'kyra', x: 7, y: 6 });
    await esperar(500);
    jk.mandar({ tipo: 'tirar', personajeId: 'kyra', que: { tipo: 'ataque', golpe: 'espada', numero: 0, objetivo: 'goblin' } });
    await esperar(600);
    const t = jk.tiradas.at(-1);
    assert.ok(t && t.objetivo?.nombre === 'Goblin', 'Kyra no tiró contra el goblin');
    paso(`Kyra se acerca y ataca: ${t.total} contra CA 15 (${t.objetivo.grado})`);
    if (t.objetivo.grado === 'exito' || t.objetivo.grado === 'critico') {
      const antes = (await conectar(codigo, { tipo: 'entrar', como: 'gm', codigo: codigoGM })).estado.tokens.goblin.pg.actual;
      jk.mandar({ tipo: 'tirar', personajeId: 'kyra', que: { tipo: 'dano', golpe: 'espada', critico: t.objetivo.grado === 'critico', objetivo: 'goblin' } });
      await esperar(600);
      // Al GM le llega el daño contra su criatura y lo confirma ("Restar"), como en la app
      const dano = gm.tiradas.at(-1);
      assert.ok(dano && /Daño/.test(dano.etiqueta), 'al GM no le llegó el daño');
      gm.accion({ tipo: 'danar', tokenId: 'goblin', cantidad: dano.total });
      await esperar(400);
      const despues = (await conectar(codigo, { tipo: 'entrar', como: 'gm', codigo: codigoGM })).estado.tokens.goblin.pg.actual;
      assert.ok(despues < antes, 'el daño no se aplicó al goblin');
      paso(`daño de la espada: el goblin baja de ${antes} a ${despues} PG`);
    }
    jk.accion({ tipo: 'avanzar-turno' });
  } else if (quien === 'ezren') {
    je.mandar({ tipo: 'usar', aptitudId: 'rayo', objetivo: 'goblin' });
    await esperar(700);
    const t = je.tiradas.find((x) => x.etiqueta?.includes('Rayo') || x.etiqueta?.includes('Ray'));
    assert.ok(t, 'Ezren no lanzó el rayo');
    paso(`Ezren lanza Ray of Frost: ${t.total}${t.objetivo?.grado ? ` (${t.objetivo.grado})` : ''}`);
    je.accion({ tipo: 'avanzar-turno' });
  } else {
    gm.mandar({ tipo: 'tirar', que: { tipo: 'criatura', tokenId: 'goblin', ataque: 'dogslicer', numero: 0, objetivo: 'kyra' } });
    await esperar(700);
    const t = gm.tiradas.at(-1);
    paso(`el goblin ataca a Kyra${t ? `: ${t.total}` : ''}`);
    gm.accion({ tipo: 'avanzar-turno' });
  }
  await esperar(500);
}

ver = await conectar(codigo, { tipo: 'entrar', como: 'gm', codigo: codigoGM });
assert.equal(ver.estado.combate.ronda, 2, 'la ronda no avanzó');
assert.ok(ver.estado.tiradas.length >= 3, 'faltan tiradas en el registro');
const pgDespues = ver.estado.tokens.goblin.pg.actual;
paso(`ronda 2 · el goblin tiene ${pgDespues} de ${pgGoblin} PG · ${ver.estado.tiradas.length} tiradas en el registro`);

gm.accion({ tipo: 'terminar-combate' });
await esperar(300);
for (const c of [gm, gm2, gm3, jk, je, ver]) c.ws.close();
console.log(`\nTodo bien: ${pasos} pasos.`);
process.exit(0);

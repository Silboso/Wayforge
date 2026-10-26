// Arma una mesa de prueba en el servidor local e imprime cómo entrar: código de mesa, de GM y de cada personaje.
// Uso: npm run demo            (con `npm run dev` corriendo)
//      npm run demo -- http://localhost:5173

const base = process.argv[2] ?? 'http://localhost:5173';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const respuesta = await fetch(`${base}/api/salas`, { method: 'POST' }).catch(() => null);
if (!respuesta?.ok) {
  console.error(`No pude crear la mesa en ${base}. ¿Está corriendo "npm run dev"?`);
  process.exit(1);
}
const { codigo, codigoGM } = await respuesta.json();

const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/api/salas/${codigo}/ws`);
await new Promise((r, f) => { ws.addEventListener('open', r); ws.addEventListener('error', f); });
const enviar = (m) => ws.send(JSON.stringify(m));
enviar({ tipo: 'entrar', como: 'gm', codigo: codigoGM });
await esperar(300);

const skills = (marcadas) => Object.fromEntries(
  ['acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine', 'nature',
    'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery'].map((h) => [h, marcadas[h] ?? 0]));
const aptitud = (id, nombre, verbo, categoria, costo, recuperacion, descripcion, extra = {}) =>
  ({ id, nombre, verbo, categoria, costo, recuperacion, descripcion, rasgos: [], ...extra });

const personajes = [
  {
    codigo: '1234',
    ficha: {
      id: 'kyra', nombre: 'Kyra', ascendencia: 'Human', clase: 'Fighter', nivel: 3, pgTemporales: 0, velocidad: 25, notas: '',
      atributos: { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 }, pgAscendencia: 8, pgClase: 10, pgActual: 44, percepcion: 2,
      salvaciones: { fortitude: 2, reflex: 2, will: 1 }, armadura: { nombre: 'Chain mail', rango: 1, bonoObjeto: 4, topeDex: 1 },
      habilidades: skills({ athletics: 1, intimidation: 1 }),
      golpes: [{ id: 'espada', nombre: 'Longsword', atributo: 'str', rango: 2, bonoObjeto: 1, dados: '1d8', tipoDano: 'slashing', sumarFuerza: true, agil: false }],
      aptitudes: [
        aptitud('shield-block', 'Shield Block', 'Bloquear con el escudo', 'dote', 'reaccion', { tipo: 'siempre' },
          'Con el escudo levantado, cuando un ataque te iba a hacer daño físico: el escudo absorbe tanto daño como su Dureza.',
          { disparadores: ['te-golpean'], requiere: 'shield-raised' }),
        aptitud('reactive-strike', 'Reactive Strike', 'Golpe de oportunidad', 'dote', 'reaccion', { tipo: 'siempre' },
          'Cuando un enemigo a tu alcance se mueve o manipula algo, le haces un Strike.', { disparadores: ['enemigo-se-mueve'], tirada: { tipo: 'golpe' } }),
        aptitud('power-attack', 'Power Attack', 'Ataque poderoso', 'dote', 2, { tipo: 'siempre' },
          'Un Strike cuerpo a cuerpo con un dado de daño extra.', { disparadores: ['al-atacar'], tirada: { tipo: 'golpe' } }),
        aptitud('pocion', 'Minor Healing Potion', 'Beber poción', 'objeto', 1, { tipo: 'consumible', cantidad: 2 },
          'Recuperas 1d8 PG.', { tirada: { tipo: 'expresion', expresion: '1d8' } }),
      ],
    },
  },
  {
    codigo: '5678',
    ficha: {
      id: 'ezren', nombre: 'Ezren', ascendencia: 'Human', clase: 'Wizard', nivel: 3, pgTemporales: 0, velocidad: 25, notas: '',
      atributos: { str: 0, dex: 2, con: 1, int: 4, wis: 1, cha: 0 }, pgAscendencia: 8, pgClase: 6, pgActual: 29, percepcion: 1,
      salvaciones: { fortitude: 1, reflex: 1, will: 2 }, armadura: { nombre: '', rango: 1, bonoObjeto: 0, topeDex: null },
      habilidades: skills({ arcana: 2, crafting: 1, society: 1, occultism: 1 }),
      golpes: [{ id: 'baston', nombre: 'Staff', atributo: 'str', rango: 1, bonoObjeto: 0, dados: '1d4', tipoDano: 'bludgeoning', sumarFuerza: true, agil: false }],
      lanzador: { tradicion: 'arcane', atributo: 'int', rango: 1 },
      recursos: { foco: { max: 1, actual: 1 }, espacios: [{ rango: 1, max: 2, usados: 0 }, { rango: 2, max: 2, usados: 0 }], usos: {} },
      aptitudes: [
        aptitud('nimble-dodge', 'Nimble Dodge', 'Esquiva ágil', 'dote', 'reaccion', { tipo: 'siempre' },
          'Cuando un enemigo te ataca, te apartas: +2 a tu CA contra ese ataque.', { disparadores: ['te-apuntan'], efecto: { bonoCA: 2 } }),
        aptitud('ray', 'Ray of Frost', 'Rayo de escarcha', 'truco', 2, { tipo: 'siempre' },
          'Un rayo helado: ataque de conjuro contra la CA, 2d4 de daño de frío.', { tirada: { tipo: 'ataque-conjuro' }, dano: '2d4', distancia: 120 }),
        aptitud('barrage', 'Force Barrage', 'Proyectiles mágicos', 'conjuro', 2, { tipo: 'espacio', rango: 1 },
          'Proyectiles de fuerza que no fallan: 1d4+1 cada uno.', { tirada: { tipo: 'expresion', expresion: '2d4+2' } }),
        aptitud('bolt', 'Force Bolt', 'Rayo de fuerza', 'foco', 1, { tipo: 'foco' },
          'Un dardo de fuerza que siempre acierta: 2d4 de daño.', { tirada: { tipo: 'expresion', expresion: '2d4' } }),
      ],
    },
  },
];

for (const p of personajes) {
  enviar({ tipo: 'nuevo-personaje', personaje: p.ficha, codigo: p.codigo });
  await esperar(250);
}
// Los goblins traen su ficha de criatura: el GM los juega con sus ataques, su turno y su alcance
const criatura = (ataques) => ({
  nivel: 1, salvaciones: { fortitude: 6, reflex: 8, will: 4 }, velocidad: 25, ataques,
  habilidades: [{ nombre: 'Stealth', bono: 7 }], rasgos: ['Goblin', 'Humanoid'], notas: '',
});
const dogslicer = { id: 'dogslicer', nombre: 'Dogslicer', bono: 8, dano: '1d6+2', tipoDano: 'slashing', agil: true, rasgos: ['agile', 'finesse'] };
const shortbow = { id: 'shortbow', nombre: 'Shortbow', bono: 8, dano: '1d6', tipoDano: 'piercing', agil: false, rasgos: ['deadly d10'], distancia: 60 };
for (const [id, nombre, x, y, ataques] of [['goblin-1', 'Goblin', 3, 2, [dogslicer, shortbow]], ['goblin-2', 'Goblin arquero', 6, 1, [shortbow, dogslicer]]]) {
  enviar({ tipo: 'accion', accion: { tipo: 'crear-token', token: { id, nombre, tipo: 'enemigo', tamano: 'Small', x, y, color: '#c8392b', ca: 15, pg: { actual: 20, max: 20 }, percepcion: 5, criatura: criatura(ataques) } } });
  await esperar(150);
}
await esperar(300);
ws.close();

console.log(`
Mesa de prueba lista
  Link:            ${base}/sala/${codigo}
  Código de mesa:  ${codigo.toUpperCase()}
  Código de GM:    ${codigoGM}
  Personajes:
    Kyra  (Human Fighter 3: Shield Block, Reactive Strike, Power Attack)  código 1234
    Ezren (Human Wizard 3: Nimble Dodge, conjuros y foco)                 código 5678
  Enemigos: Goblin y Goblin arquero (CA 15, 20 PG, con dogslicer y arco; el bestiario tiene más)

Para jugar GM y jugador a la vez en la misma PC, abre al jugador en una ventana de incógnito.`);

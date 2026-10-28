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
        aptitud('pocion', 'Healing Potion (Minor)', 'Beber poción', 'objeto', 1, { tipo: 'consumible', cantidad: 2 },
          'Recuperas 1d8 PG.', { rasgos: ['consumable', 'healing', 'potion'], interaccion: { modo: { tipo: 'ninguna' }, objetivos: { tipo: 'yo' }, curacion: '1d8' } }),
        aptitud('fuego', "Alchemist's Fire (Lesser)", 'Lanzar bomba', 'objeto', 1, { tipo: 'consumible', cantidad: 2 },
          'Strike a distancia con Dex: 1d8 de fuego, 1 de fuego persistente y 1 de salpicadura.',
          { rasgos: ['alchemical', 'bomb', 'consumable', 'fire', 'splash'], dano: '1d8', distancia: 20, interaccion: { modo: { tipo: 'ataque' }, objetivos: { tipo: 'uno' }, dano: { formula: '1d8', tipo: 'fire' } } }),
      ],
      // La mochila: las pociones y las bombas están ligadas a su acción (se gastan juntas)
      inventario: [
        { id: 'compendio:chain-mail', nombre: 'Chain Mail', cantidad: 1, bulto: 2, precio: 60 },
        { id: 'compendio:longsword', nombre: 'Longsword', cantidad: 1, bulto: 1, precio: 10 },
        { id: 'compendio:steel-shield', nombre: 'Steel Shield', cantidad: 1, bulto: 1, precio: 20 },
        { id: 'compendio:healing-potion-minor', nombre: 'Healing Potion (Minor)', cantidad: 2, bulto: 0.1, precio: 40, aptitudId: 'pocion' },
        { id: 'compendio:alchemist-s-fire-lesser', nombre: "Alchemist's Fire (Lesser)", cantidad: 2, bulto: 0.1, precio: 30, aptitudId: 'fuego' },
        { id: 'compendio:torch', nombre: 'Torch', cantidad: 5, bulto: 0.1, precio: 0.1 },
      ],
      monedas: { oro: 12, plata: 4, cobre: 0 },
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
          'Un rayo helado: ataque de conjuro contra la CA, 2d4 de daño de frío. Con crítico, −10 ft de Velocidad.', { tirada: { tipo: 'ataque-conjuro' }, dano: '2d4', distancia: 120 }),
        aptitud('arc', 'Electric Arc', 'Arco eléctrico', 'truco', 2, { tipo: 'siempre' },
          'Un arco de rayos salta a uno o dos enemigos: salvación básica de Reflex contra 2d4 de electricidad.', { distancia: 30 }),
        aptitud('caustic', 'Caustic Blast', 'Estallido cáustico', 'truco', 2, { tipo: 'siempre' },
          'Una bola de ácido revienta en una explosión de 5 ft: salvación básica de Reflex contra 2d8 de ácido.', { distancia: 30 }),
        aptitud('shield', 'Shield', 'Escudo arcano', 'truco', 1, { tipo: 'siempre' },
          'Un escudo de fuerza te cubre: +1 a tu CA hasta el inicio de tu próximo turno.'),
        aptitud('grease', 'Grease', 'Grasa', 'conjuro', 2, { tipo: 'espacio', rango: 1 },
          'Cubres 4 casillas de grasa: quien falla su Reflex resbala y cae.', { distancia: 30 }),
        aptitud('fear', 'Fear', 'Miedo', 'conjuro', 2, { tipo: 'espacio', rango: 1 },
          'Llenas de terror a una criatura: Frightened 1, 2 o 3 según su Will.', { distancia: 30 }),
        aptitud('barrage', 'Force Barrage', 'Proyectiles mágicos', 'conjuro', 2, { tipo: 'espacio', rango: 1 },
          'Proyectiles de fuerza que no fallan: 1d4+1 cada uno.', { tirada: { tipo: 'expresion', expresion: '2d4+2' }, distancia: 120 }),
        aptitud('bolt', 'Force Bolt', 'Rayo de fuerza', 'foco', 1, { tipo: 'foco' },
          'Un dardo de fuerza que siempre acierta: 2d4 de daño.', { tirada: { tipo: 'expresion', expresion: '2d4' } }),
      ],
    },
  },
  {
    codigo: '9012',
    ficha: {
      id: 'korakai', nombre: 'Korakai', ascendencia: 'Human', clase: 'Oracle', nivel: 3, pgTemporales: 0, velocidad: 25, notas: '',
      atributos: { str: 0, dex: 1, con: 2, int: 0, wis: 2, cha: 4 }, pgAscendencia: 8, pgClase: 8, pgActual: 38, percepcion: 1,
      salvaciones: { fortitude: 1, reflex: 1, will: 2 }, armadura: { nombre: 'Leather', rango: 1, bonoObjeto: 1, topeDex: 4 },
      habilidades: skills({ religion: 2, diplomacy: 1, occultism: 1, medicine: 1 }),
      golpes: [{ id: 'maza', nombre: 'Mace', atributo: 'str', rango: 1, bonoObjeto: 0, dados: '1d6', tipoDano: 'bludgeoning', sumarFuerza: true, agil: false }],
      lanzador: { tradicion: 'divine', atributo: 'cha', rango: 1 },
      recursos: { foco: { max: 1, actual: 1 }, espacios: [{ rango: 1, max: 3, usados: 0 }, { rango: 2, max: 2, usados: 0 }], usos: {} },
      aptitudes: [
        aptitud('oracular-warning', 'Oracular Warning', 'Aviso oracular', 'dote', 'libre', { tipo: 'siempre' },
          'Trigger You are about to roll initiative.\n\n—\nUna premonición te avisa del peligro: cada aliado a 20 ft gana +2 de estado a su iniciativa y PG temporales iguales a la mitad de tu nivel.',
          { disparadores: ['iniciativa'] }),
        aptitud('heal', 'Heal', 'Curar', 'conjuro', 2, { tipo: 'espacio', rango: 1 },
          'Energía vital cura a un aliado que tocas o a 30 ft: 1d8+8 PG.', { distancia: 30 }),
        aptitud('bless', 'Bless', 'Bendecir', 'conjuro', 2, { tipo: 'espacio', rango: 1 },
          'Tú y tus aliados a 15 ft: +1 de estado a los ataques por 1 minuto.'),
        aptitud('daze', 'Daze', 'Aturdir', 'truco', 2, { tipo: 'siempre' },
          'Nublas la mente de una criatura a 60 ft: salvación básica de Will contra 1d6 mental.', { distancia: 60 }),
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
  habilidades: [{ nombre: 'Stealth', bono: 7 }], rasgos: ['Goblin', 'Humanoid'], notas: 'Sentidos: darkvision',
});
const dogslicer = { id: 'dogslicer', nombre: 'Dogslicer', bono: 8, dano: '1d6+2', tipoDano: 'slashing', agil: true, rasgos: ['agile', 'finesse'] };
const shortbow = { id: 'shortbow', nombre: 'Shortbow', bono: 8, dano: '1d6', tipoDano: 'piercing', agil: false, rasgos: ['deadly d10'], distancia: 60 };
for (const [id, nombre, x, y, ataques] of [['goblin-1', 'Goblin', 9, 7, [dogslicer, shortbow]], ['goblin-3', 'Goblin guerrero', 10, 8, [dogslicer]], ['goblin-2', 'Goblin arquero', 18, 6, [shortbow, dogslicer]]]) {
  enviar({ tipo: 'accion', accion: { tipo: 'crear-token', token: { id, nombre, tipo: 'enemigo', tamano: 'Small', x, y, color: '#c8392b', ca: 15, pg: { actual: 20, max: 20 }, percepcion: 5, criatura: criatura(ataques) } } });
  await esperar(150);
}
// Una cabaña con el arquero adentro: muros, una puerta abajo y una ventana al oeste (la niebla la tapa hasta entrar)
const tramo = (id, a, b, tipo = 'muro') => ({ id, a, b, tipo, ...(tipo === 'puerta' ? { abierta: false } : {}) });
enviar({ tipo: 'accion', accion: { tipo: 'editar-mapa', cambios: { muros: [
  tramo('c-norte', { x: 15, y: 3 }, { x: 22, y: 3 }),
  tramo('c-este', { x: 22, y: 3 }, { x: 22, y: 10 }),
  tramo('c-oeste-1', { x: 15, y: 3 }, { x: 15, y: 5 }),
  tramo('c-ventana', { x: 15, y: 5 }, { x: 15, y: 6 }, 'ventana'),
  tramo('c-oeste-2', { x: 15, y: 6 }, { x: 15, y: 10 }),
  tramo('c-sur-1', { x: 15, y: 10 }, { x: 18, y: 10 }),
  tramo('c-puerta', { x: 18, y: 10 }, { x: 19, y: 10 }, 'puerta'),
  tramo('c-sur-2', { x: 19, y: 10 }, { x: 22, y: 10 }),
], luz: 'tenue', luces: [{ id: 'brasero', x: 20, y: 4, brillante: 10, tenue: 10 }] } } });
// Atardecer: Kyra lleva una antorcha; los goblins ven en la oscuridad
enviar({ tipo: 'accion', accion: { tipo: 'llevar-luz', tokenId: 'kyra', luz: { brillante: 20, tenue: 20 } } });
enviar({ tipo: 'accion', accion: { tipo: 'nombrar-mesa', nombre: 'Mesa de prueba' } });
// Un handout preparado (nadie lo ve hasta que el GM lo muestre desde Mesa → Handouts)
enviar({ tipo: 'accion', accion: { tipo: 'guardar-handout', handout: { id: 'carta-alcalde', titulo: 'La carta del alcalde', texto: 'Al grupo que limpió el camino:\n\nVengan solos al molino viejo cuando caiga la noche. No confíen en el herrero.\n\n— Alcalde Deverin' } } });
await esperar(300);
ws.close();

console.log(`
Mesa de prueba lista
  Link:            ${base}/sala/${codigo}
  Código de mesa:  ${codigo.toUpperCase()}
  Código de GM:    ${codigoGM}
  Personajes:
    Kyra  (Human Fighter 3: Demoralize, Trip, Power Attack; lista para subir a nivel 4)   código 1234
    Ezren (Human Wizard 3: Electric Arc, Caustic Blast, Grease, Fear, Shield…)          código 5678
    Korakai (Human Oracle 3: Oracular Warning al empezar el combate, Heal, Bless, Daze) código 9012
  Enemigos: tres goblins (CA 15, 20 PG); el arquero espera dentro de la cabaña, bajo la niebla
  Para ver la preparación: el GM abre Combate → Preparar combate; a cada jugador le llega su hoja
  (Korakai puede usar Oracular Warning antes de tirar). Para ver el motor: Ezren lanza Caustic Blast entre el Goblin y el Goblin guerrero.
  Para ver la niebla: acércate a la cabaña; mira por la ventana o abre la puerta (tócala estando al lado).
  Atardecer: fuera de la antorcha de Kyra, los goblins están en penumbra (atacarlos pide chequeo plano CD 5).
  Handout: el GM abre Mesa → Handouts y muestra La carta del alcalde a todos o a uno (se les abre en la pantalla).

Para jugar GM y jugador a la vez en la misma PC, abre al jugador en una ventana de incógnito.`);

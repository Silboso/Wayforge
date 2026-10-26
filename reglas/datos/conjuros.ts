import type { Conjuro, Tradicion } from './tipos';

// Trucos y conjuros de rango 1 del Player Core (remaster). Licencia ORC.
// "dano" es el daño (o la curación) a rango base; "potenciado", lo que suma al subirlo de rango.

const c = (id: string, nombre: string, rango: number, tradiciones: Tradicion[], costo: Conjuro['costo'], defensa: Conjuro['defensa'],
  distancia: number | null, descripcion: string, extra: Partial<Conjuro> = {}): Conjuro =>
  ({ id, nombre, rango, tradiciones, costo, defensa, distancia, descripcion, rasgos: [], ...extra });

const A: Tradicion = 'arcane';
const D: Tradicion = 'divine';
const O: Tradicion = 'occult';
const P: Tradicion = 'primal';

export const CONJUROS: Conjuro[] = [
  // Trucos
  c('caustic-blast', 'Caustic Blast', 0, [A, P], 2, 'reflex', 30, 'Una bola de ácido estalla en un radio de 5 ft: daño ácido con salvación básica de Reflex; con fallo crítico, también ácido persistente.', { dano: '2d8', tipoDano: 'acid', area: 'explosión 5 ft', potenciado: '+1d8 cada 2 rangos' }),
  c('daze', 'Daze', 0, [A, D, O], 2, 'will', 60, 'Golpeas la mente de un enemigo: daño mental con salvación básica de Will; con fallo crítico queda Stunned 1.', { dano: '1d6', tipoDano: 'mental', potenciado: '+1d6 cada 2 rangos' }),
  c('detect-magic', 'Detect Magic', 0, [A, D, O, P], 2, null, null, 'Sientes la magia en una emanación de 30 ft a tu alrededor.', { area: 'emanación 30 ft' }),
  c('divine-lance', 'Divine Lance', 0, [D], 2, 'ataque', 30, 'Lanzas un rayo de fe: ataque de conjuro, daño espiritual (doble con crítico).', { dano: '2d4', tipoDano: 'spirit', potenciado: '+1d4 por rango' }),
  c('electric-arc', 'Electric Arc', 0, [A, P], 2, 'reflex', 30, 'Un arco eléctrico salta a uno o dos enemigos: daño eléctrico con salvación básica de Reflex.', { dano: '2d4', tipoDano: 'electricity', objetivos: '1 o 2 criaturas', potenciado: '+1d4 por rango' }),
  c('figment', 'Figment', 0, [A, O], 2, null, 30, 'Creas una ilusión simple: un sonido o una imagen pequeña.'),
  c('forbidding-ward', 'Forbidding Ward', 0, [D, O], 2, null, 30, 'Un aliado gana +1 a la CA y salvaciones contra un enemigo elegido.'),
  c('frostbite', 'Frostbite', 0, [A, P], 2, 'fortitude', 60, 'El frío muerde a un enemigo: daño de frío con salvación básica de Fortitude; con fallo queda con −5 ft de Velocidad.', { dano: '2d4', tipoDano: 'cold', potenciado: '+1d4 por rango' }),
  c('gouging-claw', 'Gouging Claw', 0, [A, P], 2, 'ataque', 0, 'Tu mano se vuelve una garra: ataque de conjuro cuerpo a cuerpo, daño cortante o perforante.', { dano: '2d6', tipoDano: 'slashing', potenciado: '+1d6 por rango' }),
  c('guidance', 'Guidance', 0, [D, O, P], 1, null, 30, 'Un aliado gana +1 a su próxima tirada de ataque, Perception, salvación o skill.'),
  c('ignition', 'Ignition', 0, [A, P], 2, 'ataque', 30, 'Llamas: ataque de conjuro a distancia (o cuerpo a cuerpo, con más daño). Daño de fuego.', { dano: '2d4', tipoDano: 'fire', potenciado: '+1d4 por rango' }),
  c('light', 'Light', 0, [A, D, O, P], 1, null, 120, 'Un objeto (o un orbe) da luz brillante en 20 ft.'),
  c('message', 'Message', 0, [A, D, O], 1, null, 120, 'Le susurras un mensaje a alguien, que puede responderte.'),
  c('needle-darts', 'Needle Darts', 0, [A, O, P], 2, 'ataque', 60, 'Disparas agujas de metal: ataque de conjuro, daño perforante.', { dano: '3d4', tipoDano: 'piercing', potenciado: '+1d4 por rango' }),
  c('prestidigitation', 'Prestidigitation', 0, [A, D, O, P], 2, null, 10, 'Pequeños trucos: limpiar, calentar, colorear, levantar algo ligero.'),
  c('shield', 'Shield', 0, [A, D, O], 1, null, null, 'Un escudo de fuerza: +1 a tu CA hasta tu próximo turno; puedes bloquear daño con él (Dureza 5).'),
  c('sigil', 'Sigil', 0, [A, D, O, P], 1, null, 0, 'Dejas una marca mágica personal en un objeto o criatura.'),
  c('stabilize', 'Stabilize', 0, [D, P], 2, null, 30, 'Una criatura moribunda deja de estar Dying.'),
  c('tangle-vine', 'Tangle Vine', 0, [P], 2, 'ataque', 30, 'Una liana se enreda en el enemigo: ataque de conjuro; con éxito queda con −10 ft de Velocidad (Immobilized con crítico).'),
  c('telekinetic-projectile', 'Telekinetic Projectile', 0, [A, O], 2, 'ataque', 30, 'Lanzas un objeto con la mente: ataque de conjuro, daño contundente, perforante o cortante.', { dano: '2d6', tipoDano: 'bludgeoning', potenciado: '+1d6 por rango' }),
  c('vitality-lash', 'Vitality Lash', 0, [D, P], 2, 'fortitude', 30, 'Energía vital contra un no-muerto: daño vital con salvación básica de Fortitude.', { dano: '2d6', tipoDano: 'vitality', potenciado: '+1d6 por rango' }),
  c('void-warp', 'Void Warp', 0, [A, D, O], 2, 'fortitude', 30, 'Energía del vacío drena a un ser vivo: daño de vacío con salvación básica de Fortitude; con fallo crítico queda Enfeebled 1.', { dano: '2d4', tipoDano: 'void', potenciado: '+1d4 por rango' }),

  // Rango 1
  c('bless', 'Bless', 1, [D, O], 2, null, null, 'Tú y tus aliados en 15 ft ganan +1 a las tiradas de ataque. El aura puede crecer.', { area: 'emanación 15 ft' }),
  c('breathe-fire', 'Breathe Fire', 1, [A, P], 2, 'reflex', null, 'Escupes fuego en un cono de 15 ft: daño de fuego con salvación básica de Reflex.', { dano: '2d6', tipoDano: 'fire', area: 'cono 15 ft', potenciado: '+2d6 por rango' }),
  c('charm', 'Charm', 1, [A, O, P], 2, 'will', 30, 'Un humanoide te ve como amigo durante 1 hora (Will para resistir).'),
  c('command', 'Command', 1, [A, D, O], 2, 'will', 30, 'Una orden de una palabra: acércate, corre, suelta, al suelo, quieto (Will para resistir).'),
  c('dizzying-colors', 'Dizzying Colors', 1, [A, O], 2, 'will', null, 'Colores brillantes en un cono de 15 ft: quedan Dazzled, Blinded o Stunned según su Will.', { area: 'cono 15 ft' }),
  c('fear', 'Fear', 1, [A, D, O, P], 2, 'will', 30, 'Un enemigo queda Frightened 1 (Frightened 2 con fallo, y huye con fallo crítico).'),
  c('force-barrage', 'Force Barrage', 1, [A, O], 2, null, 120, 'Dardos de fuerza que nunca fallan: 1d4+1 cada uno. Uno por acción (hasta 3).', { dano: '2d4+2', tipoDano: 'force', potenciado: '+1 dardo cada 2 rangos' }),
  c('grease', 'Grease', 1, [A, P], 2, 'reflex', 30, 'Cubres 4 casillas de grasa: quien la pisa hace Acrobatics o cae Prone.', { area: '4 casillas' }),
  c('gust-of-wind', 'Gust of Wind', 1, [A, P], 2, 'fortitude', null, 'Un ventarrón en línea de 60 ft: apaga llamas y derriba a los que fallen Fortitude.', { area: 'línea 60 ft' }),
  c('harm', 'Harm', 1, [D], 2, 'fortitude', 30, 'Energía de vacío: daña a un ser vivo (Fortitude básica) o cura a un no-muerto.', { dano: '1d8', tipoDano: 'void', potenciado: '+1d8 (+8 con dos acciones) por rango' }),
  c('heal', 'Heal', 1, [D, P], 2, null, 30, 'Energía vital: cura 1d8 + 8 a un ser vivo con dos acciones (1d8 al toque con una), o daña a un no-muerto.', { dano: '1d8+8', tipoDano: 'healing', potenciado: '+1d8 (+8 con dos acciones) por rango' }),
  c('hydraulic-push', 'Hydraulic Push', 1, [A, P], 2, 'ataque', 60, 'Un chorro de agua: ataque de conjuro, daño contundente y empuja 5 ft (10 ft con crítico).', { dano: '3d6', tipoDano: 'bludgeoning', potenciado: '+2d6 por rango' }),
  c('illusory-object', 'Illusory Object', 1, [A, O], 2, null, 500, 'Creas la ilusión de un objeto, inmóvil, de hasta 20 ft.'),
  c('jump', 'Jump', 1, [A, P], 1, null, 0, 'Saltas hasta 30 ft en cualquier dirección.'),
  c('mystic-armor', 'Mystic Armor', 1, [A, D, O, P], 2, null, 0, 'Una armadura mágica: +1 de objeto a la CA durante 10 minutos (si no llevas armadura).'),
  c('phantom-pain', 'Phantom Pain', 1, [O], 2, 'will', 30, 'Dolor ilusorio: daño mental y daño persistente mental; con fallo queda Sickened 1.', { dano: '2d4', tipoDano: 'mental', potenciado: '+2d4 por rango' }),
  c('pummeling-rubble', 'Pummeling Rubble', 1, [A, P], 2, 'reflex', null, 'Piedras en un cono de 15 ft: daño contundente con salvación básica de Reflex; con fallo los empuja.', { dano: '2d4', tipoDano: 'bludgeoning', area: 'cono 15 ft', potenciado: '+2d4 por rango' }),
  c('runic-weapon', 'Runic Weapon', 1, [A, O], 2, null, 0, 'Un arma brilla con runas: +1 a los ataques y un dado de daño más grande por 1 minuto.'),
  c('sleep', 'Sleep', 1, [A, O], 2, 'will', 30, 'En un radio de 5 ft, los que fallen Will quedan dormidos o somnolientos.', { area: 'explosión 5 ft' }),
  c('soothe', 'Soothe', 1, [O], 2, null, 30, 'Calma y cura a un aliado: 1d10 + 4 PG y +2 a salvaciones contra efectos mentales.', { dano: '1d10+4', tipoDano: 'healing', potenciado: '+1d10+4 por rango' }),
  c('summon-animal', 'Summon Animal', 1, [A, P], 3, null, 30, 'Invocas un animal de nivel −1 que pelea por ti mientras te concentras.'),
  c('sure-strike', 'Sure Strike', 1, [A, O], 1, null, null, 'Tu próxima tirada de ataque este turno se tira dos veces y te quedas con la mejor.'),
  c('thunderstrike', 'Thunderstrike', 1, [A, D, P], 2, 'reflex', 120, 'Un rayo cae sobre un enemigo: daño eléctrico y sónico con salvación básica de Reflex.', { dano: '1d12+1d4', tipoDano: 'electricity', potenciado: '+1d12 y +1d4 por rango' }),
];

export function conjuroDe(id: string): Conjuro | undefined {
  return CONJUROS.find((x) => x.id === id);
}

export const NOMBRES_TRADICION: Record<Tradicion, string> = {
  arcane: 'Arcane',
  divine: 'Divine',
  occult: 'Occult',
  primal: 'Primal',
};

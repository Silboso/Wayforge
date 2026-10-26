import type { Trasfondo } from './tipos';

// Trasfondos del Player Core (remaster): de dónde viene tu personaje antes de aventurar. Licencia ORC.
// Cada uno da una mejora entre dos atributos y otra libre, una skill, un saber (Lore) y una dote de habilidad.
const t = (id: string, nombre: string, descripcion: string, mejoras: Trasfondo['mejoras'], habilidad: Trasfondo['habilidad'], saber: string, dote: string): Trasfondo =>
  ({ id, nombre, descripcion, mejoras, habilidad, saber, dote });

export const TRASFONDOS: Trasfondo[] = [
  t('acolyte', 'Acolyte', 'Pasaste años en un templo, entre rezos, escrituras y tareas sagradas.', ['int', 'wis'], 'religion', 'Scribing Lore', 'student-of-the-canon'),
  t('acrobat', 'Acrobat', 'Saltabas y hacías piruetas en un circo o en las plazas.', ['str', 'dex'], 'acrobatics', 'Circus Lore', 'steady-balance'),
  t('animal-whisperer', 'Animal Whisperer', 'Siempre te entendiste mejor con los animales que con la gente.', ['wis', 'cha'], 'nature', 'Plains Lore', 'train-animal'),
  t('artisan', 'Artisan', 'Aprendiste un oficio con tus manos en un taller.', ['str', 'int'], 'crafting', 'Guild Lore', 'specialty-crafting'),
  t('artist', 'Artist', 'Pintas, esculpes o tallas: el arte es tu forma de hablar.', ['dex', 'cha'], 'crafting', 'Art Lore', 'specialty-crafting'),
  t('barkeep', 'Barkeep', 'Serviste tragos y escuchaste los secretos de medio pueblo.', ['con', 'cha'], 'diplomacy', 'Alcohol Lore', 'hobnobber'),
  t('barrister', 'Barrister', 'Conoces las leyes y cómo torcerlas con palabras.', ['int', 'cha'], 'diplomacy', 'Legal Lore', 'group-impression'),
  t('bounty-hunter', 'Bounty Hunter', 'Cazabas fugitivos por la recompensa.', ['str', 'wis'], 'survival', 'Legal Lore', 'experienced-tracker'),
  t('charlatan', 'Charlatan', 'Vendías curas milagrosas y profecías falsas.', ['int', 'cha'], 'deception', 'Underworld Lore', 'charming-liar'),
  t('criminal', 'Criminal', 'Viviste del otro lado de la ley, entre contrabando y golpes.', ['dex', 'int'], 'stealth', 'Underworld Lore', 'experienced-smuggler'),
  t('detective', 'Detective', 'Resolvías misterios siguiendo pistas que nadie veía.', ['int', 'wis'], 'society', 'Underworld Lore', 'streetwise'),
  t('emissary', 'Emissary', 'Viajaste como mensajero o diplomático entre pueblos.', ['int', 'cha'], 'society', 'City Lore', 'multilingual'),
  t('entertainer', 'Entertainer', 'Cantabas, actuabas o contabas historias para ganarte el pan.', ['dex', 'cha'], 'performance', 'Theater Lore', 'fascinating-performance'),
  t('farmhand', 'Farmhand', 'Trabajaste la tierra de sol a sol.', ['con', 'wis'], 'athletics', 'Farming Lore', 'assurance-athletics'),
  t('field-medic', 'Field Medic', 'Curabas heridos en el campo de batalla.', ['con', 'wis'], 'medicine', 'Warfare Lore', 'battle-medicine'),
  t('fortune-teller', 'Fortune Teller', 'Leías cartas, manos y estrellas a cambio de monedas.', ['int', 'cha'], 'occultism', 'Fortune-Telling Lore', 'oddity-identification'),
  t('gambler', 'Gambler', 'Vivías de apuestas, dados y faroles.', ['dex', 'cha'], 'deception', 'Games Lore', 'lie-to-me'),
  t('gladiator', 'Gladiator', 'Peleaste en la arena para el público.', ['str', 'cha'], 'performance', 'Gladiatorial Lore', 'impressive-performance'),
  t('guard', 'Guard', 'Patrullabas murallas y calles con lanza y paciencia.', ['str', 'cha'], 'intimidation', 'Legal Lore', 'quick-coercion'),
  t('herbalist', 'Herbalist', 'Recolectabas hierbas y preparabas remedios.', ['con', 'wis'], 'nature', 'Herbalism Lore', 'natural-medicine'),
  t('hermit', 'Hermit', 'Viviste aislado, estudiando el mundo a tu manera.', ['con', 'int'], 'nature', 'Cave Lore', 'dubious-knowledge'),
  t('hunter', 'Hunter', 'Cazabas para comer y vender pieles.', ['dex', 'wis'], 'survival', 'Tanning Lore', 'survey-wildlife'),
  t('laborer', 'Laborer', 'Cargaste, cavaste y construiste a fuerza de espalda.', ['str', 'con'], 'athletics', 'Labor Lore', 'hefty-hauler'),
  t('martial-disciple', 'Martial Disciple', 'Entrenaste en una escuela de combate o un monasterio.', ['str', 'dex'], 'acrobatics', 'Warfare Lore', 'cat-fall'),
  t('merchant', 'Merchant', 'Comprabas barato y vendías caro en un mercado.', ['int', 'cha'], 'diplomacy', 'Mercantile Lore', 'bargain-hunter'),
  t('miner', 'Miner', 'Pasaste tu vida bajo tierra, siguiendo vetas de metal.', ['str', 'wis'], 'survival', 'Mining Lore', 'terrain-expertise'),
  t('noble', 'Noble', 'Creciste entre bailes, intrigas y apellidos importantes.', ['int', 'cha'], 'society', 'Genealogy Lore', 'courtly-graces'),
  t('nomad', 'Nomad', 'Viajaste sin hogar fijo, de horizonte en horizonte.', ['con', 'wis'], 'survival', 'Desert Lore', 'assurance-survival'),
  t('prisoner', 'Prisoner', 'Estuviste encerrado, justa o injustamente.', ['str', 'con'], 'stealth', 'Underworld Lore', 'experienced-smuggler'),
  t('sailor', 'Sailor', 'Viviste en barcos, entre cuerdas, tormentas y puertos.', ['str', 'dex'], 'athletics', 'Sailing Lore', 'underwater-marauder'),
  t('scholar', 'Scholar', 'Estudiaste en una academia o una gran biblioteca.', ['int', 'wis'], 'arcana', 'Academia Lore', 'assurance-arcana'),
  t('scout', 'Scout', 'Explorabas por delante del grupo, leyendo el terreno.', ['dex', 'wis'], 'survival', 'Forest Lore', 'forager'),
  t('street-urchin', 'Street Urchin', 'Sobreviviste en las calles con dedos rápidos.', ['dex', 'con'], 'thievery', 'City Lore', 'pickpocket'),
  t('warrior', 'Warrior', 'Fuiste soldado, mercenario o guerrero de tu gente.', ['str', 'con'], 'intimidation', 'Warfare Lore', 'intimidating-glare'),
];

import type { DrawingChoice, PlatformLevel, PlatformMechanism, PlatformPoint, PuzzleRequirement, PuzzleScene } from './platformer';

const point = (x: number, y = 430): PlatformPoint => ({ x, y });
const closed = (id: string, label: string): PuzzleRequirement => ({ mechanismId: id, max: .12, label });
const open = (id: string, label: string): PuzzleRequirement => ({ mechanismId: id, min: .88, label });
const notch = (id: string, at: number, label: string): PuzzleRequirement => ({ mechanismId: id, min: Math.max(0, at - .065), max: Math.min(1, at + .065), label });
const floor = (level: PlatformLevel, left: number, right: number, y = 430) => level.surfaces.push({ a: point(left, y), b: point(right, y) });
const slope = (level: PlatformLevel, left: number, y1: number, right: number, y2: number) => level.surfaces.push({ a: point(left, y1), b: point(right, y2) });
const flag = (level: PlatformLevel, x: number, y = 430) => level.checkpoints.push(point(x, y));
const add = (level: PlatformLevel, mechanism: PlatformMechanism) => { level.mechanisms!.push(mechanism); return mechanism; };
const interlock = (requirements: PuzzleRequirement[], message: string) => ({ requirements, message });
function door(id: string, title: string, x: number, y = 430, travel = 240, width = 40): Extract<PlatformMechanism, { type: 'gate' }> {
  return { id, title, prompt: 'Observe les liaisons et saisis la poignée pour essayer ton réglage.', type: 'gate', appearance: 'door',
    from: point(x, y), to: point(x, y - travel), width, height: 180, speed: 460, detents: [0, 1] };
}
function platform(id: string, title: string, x1: number, y1: number, x2: number, y2: number, width = 144): Extract<PlatformMechanism, { type: 'platform' }> {
  return { id, title, prompt: 'Le plateau suit ta main. Les repères montrent ses positions utiles.', type: 'platform',
    from: point(x1, y1), to: point(x2, y2), width, speed: 420, detents: [0, 1] };
}
function scene(level: PlatformLevel, id: string, title: string, b: number, hints: PuzzleScene['hints']) {
  level.puzzles!.push({ id, title, fromX: b + 180, toX: b + 1860, hints });
  flag(level, b + 200);
}

/** Every new drawing is a real fork: the high route lands on a different
 * balcony, then rejoins the next room by a walkable slope. Neither card draws
 * for the player. A bounded ink supply prevents bypassing an entire room. */
function passage(level: PlatformLevel, b: number, index: number, style: 'pendulum' | 'teeth' | 'press' = 'pendulum', star = true) {
  const a = point(b + 1150), lowB = point(b + 1600), highB = point(b + 1600, 280);
  const high = [a, point(b + 1300, 250), point(b + 1480, 250), highB];
  const low = style === 'teeth' ? [a, point(b + 1270, 370), point(b + 1480, 370), lowB] : [a, lowB];
  const length = (path: PlatformPoint[]) => path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);
  const choice = (id: string, label: string, hint: string, path: PlatformPoint[]): DrawingChoice => ({
    id, label, hint, path, inkLimit: Math.ceil((length(path) * 1.22 + 30) / 10) * 10,
  });
  const choices = [
    choice('balcon', 'Le balcon', 'Un raccord en hauteur. Observe ce qui se trouve sous le trait.', high),
    choice('rive', 'La rive basse', 'Un autre point d’arrivée, plus près du mécanisme. La hauteur du trait compte.', low),
  ];
  level.drawings.push({ id: `trait-${level.id}-${index}`, title: 'Où faire passer la ligne ?',
    prompt: 'Deux arrivées sont possibles. Choisis, observe l’obstacle, puis invente ton passage.',
    triggerX: b + 1090, path: high, choices, inkLimit: choices[0].inkLimit, duration: 2.5 });
  floor(level, b + 1600, b + 1900);
  floor(level, b + 1600, b + 1660, 280);
  slope(level, b + 1660, 280, b + 1770, 430);
  flag(level, b + 1790);
  if (star) level.stars.push(point(b + 1410, 220));
  if (style === 'teeth') level.hazards.push({ id: `fosse-${level.id}-${index}`, type: 'spikes', x: b + 1330, y: 414, w: 130, h: 26 });
  if (style === 'pendulum') level.hazards.push({ id: `balancier-${level.id}-${index}`, type: 'gear', appearance: 'pendulum', motion: 'swing',
    x: b + 1390, y: 350, r: 27, armLength: 150, swingAngle: .32, speed: .95 + index * .11, phase: index * .7 });
  if (style === 'press') add(level, { ...door(`presse-${level.id}-${index}`, 'La presse du trait', b + 1390, 430, 230, 78), appearance: 'press', height: 108 });
}

/** One door must be shut before its neighbour can be moved. The character
 * has to enter the chamber and close the door behind him; opening everything
 * beforehand is impossible, and all required handles remain visible nearby. */
function airlock(level: PlatformLevel, b: number, key: string, third = false) {
  floor(level, b, b + 1150);
  const inner = `${key}-entree`, outer = `${key}-sortie`;
  add(level, { ...door(inner, 'Le battant d’entrée', b + 350), interlock: interlock([closed(outer, 'Battant opposé refermé')], 'Les deux battants partagent un verrou. Observe celui d’en face.') });
  add(level, { ...door(outer, 'Le battant de sortie', b + 650), interlock: interlock([closed(inner, 'Battant derrière soi refermé')], 'Le verrou reste retenu par le battant d’entrée.') });
  if (third) add(level, { ...door(`${key}-temoin`, 'La porte témoin', b + 980), interlock: interlock([closed(inner, 'Entrée refermée'), open(outer, 'Sortie ouverte')], 'Le dernier verrou observe les deux battants, pas seulement le plus proche.') });
  flag(level, b + 790);
  scene(level, key, third ? 'Trois portes, un seul passage' : 'Comment entrer sans tout ouvrir ?', b, [
    'Chaque porte retient la poignée de l’autre. Regarde les liaisons avant de toucher les deux.',
    'La chambre sert de refuge. Il faut changer l’état de la porte que tu viens de traverser.',
    `Ouvre l’entrée, avance entre les deux battants, referme l’entrée derrière toi, puis ouvre la sortie.${third ? ' La troisième porte se libère quand l’entrée reste fermée et la sortie ouverte.' : ''}`,
  ]);
}

/** The two ends align at the central notch, which releases the local latch.
 * Once the character has passed it, moving the deck must not revoke progress. */
function balancedBridge(level: PlatformLevel, b: number, key: string, counterweight = false) {
  floor(level, b, b + 470); floor(level, b + 990, b + 1150);
  const bridge = `${key}-pont`, latch = `${key}-porte`, weight = `${key}-poids`;
  if (counterweight) add(level, { ...door(weight, 'Le contrepoids du pont', b + 300), detents: [0, .5, 1] });
  add(level, { ...platform(bridge, 'Le pont à deux appuis', b + 560, 430, b + 900, 430, 540), detents: [0, .5, 1],
    ...(counterweight ? { interlock: interlock([notch(weight, .5, 'Contrepoids équilibré')], 'Le contrepoids retient le pont hors de son cran d’équilibre.') } : {}) });
  add(level, { ...door(latch, 'Le verrou des deux rives', b + 1070), interlock: interlock([notch(bridge, .5, 'Les deux appuis alignés')], 'Le pont doit toucher les deux rives à la fois pour libérer ce verrou.') });
  flag(level, b + 1020);
  scene(level, key, 'Où le pont porte-t-il vraiment ?', b, [
    'L’extrémité du rail ne correspond pas forcément à l’endroit où le pont est utile.',
    'Il faut raccorder les deux appuis en même temps. Le verrou lit la position réelle du plateau.',
    `${counterweight ? 'Place d’abord le contrepoids au cran central. ' : ''}Place le pont au cran central, traverse jusqu’à la rive de droite, puis ouvre le verrou. Une fois le verrou franchi, le passage est résolu.`,
  ]);
}

/** Riding across is only half the operation: a docking pin first records the
 * arrival, then the empty ferry must return to release the following door. */
function returningFerry(level: PlatformLevel, b: number, key: string, diagonal = false) {
  const y = diagonal ? 310 : 430, ferry = `${key}-plateau`, pin = `${key}-cliquet`, exit = `${key}-porte`;
  floor(level, b, b + 500); floor(level, b + 890, b + (diagonal ? 1100 : 1150), y);
  if (diagonal) slope(level, b + 1100, y, b + 1150, 430);
  add(level, platform(ferry, diagonal ? 'Le passeur du balcon' : 'Le passeur à rappel', b + 550, 430, b + 850, y, 144));
  add(level, { ...door(pin, 'Le cliquet d’arrivée', b + 950, y), interlock: interlock([open(ferry, 'Plateau accosté')], 'Le cliquet n’accroche que lorsque le plateau a accosté.') });
  add(level, { ...door(exit, 'La porte du retour', b + 1050, y), interlock: interlock([open(pin, 'Cliquet accroché'), closed(ferry, 'Plateau rappelé')], 'Le cliquet est prêt, mais le câble attend le retour du plateau.') });
  flag(level, b + 1000, y);
  scene(level, key, diagonal ? 'Qui doit redescendre ?' : 'Le passage n’est pas fini à l’arrivée', b, [
    'Un cliquet garde la mémoire de l’accostage. Le câble continue vers une seconde porte.',
    'Une fois débarqué, le plateau n’a plus besoin de rester près de toi.',
    'Monte sur le plateau et fais-le accoster. Ouvre le cliquet, avance au-delà du plateau, rappelle le plateau vide à son départ, puis ouvre la dernière porte.',
  ]);
}

/** Two unequal counterweights release a ferry; the low weight leaves only a
 * crouched clearance. Later arrangements add a third central contact. */
function counterweights(level: PlatformLevel, b: number, key: string, three = false, reverse = false) {
  floor(level, b, b + 650); floor(level, b + 970, b + 1150);
  const left = `${key}-gauche`, right = `${key}-droite`, centre = `${key}-centre`, ferry = `${key}-plateau`, exit = `${key}-porte`;
  const l = reverse ? .75 : .25, r = reverse ? .25 : .75;
  add(level, { ...door(left, 'Le poids gauche', b + 290), detents: [0, .25, .5, .75, 1] });
  add(level, { ...door(right, 'Le poids droit', b + 490), detents: [0, .25, .5, .75, 1] });
  if (three) add(level, { ...door(centre, 'Le poids central', b + 590), detents: [0, .5, 1], width: 30 });
  const required = [notch(left, l, 'Poids gauche sur son contact'), notch(right, r, 'Poids droit sur son contact'), ...(three ? [notch(centre, .5, 'Poids central équilibré')] : [])];
  add(level, { ...platform(ferry, 'Le plateau équilibré', b + 700, 430, b + 920, 430), interlock: interlock(required, 'Les contrepoids doivent fermer leurs contacts ensemble.') });
  add(level, { ...door(exit, 'Le verrou de l’équilibre', b + 1070), interlock: interlock([open(ferry, 'Plateau accosté'), ...required], 'L’accostage ne suffit pas : les poids doivent garder leur accord.') });
  flag(level, b + 1010);
  scene(level, key, three ? 'Trois poids, un accord' : 'Les poids ne montent pas ensemble', b, [
    'Les marques utiles n’occupent pas la même hauteur sur les deux rails. Les extrémités ne donnent pas l’équilibre.',
    'Tous les contacts du plateau doivent être satisfaits en même temps. Le poids le plus bas laisse un passage baissé.',
    `Place le poids gauche au ${reverse ? 'troisième' : 'premier'} petit cran et le droit au ${reverse ? 'premier' : 'troisième'}.${three ? ' Garde le poids central au milieu.' : ''} Baisse-toi sous le poids bas, monte sur le plateau, fais-le accoster puis ouvre le verrou.`,
  ]);
}

/** A three-stop lift reaches a real upper star alcove and a different middle
 * exit. The high alcove has no falling shortcut: return to the lift yourself. */
function middleLift(level: PlatformLevel, b: number, key: string) {
  floor(level, b, b + 600);
  floor(level, b + 725, b + 900, 190); floor(level, b + 725, b + 1070, 310); slope(level, b + 1070, 310, b + 1150, 430);
  const lift = `${key}-ascenseur`, exit = `${key}-porte`;
  add(level, { ...platform(lift, 'L’ascenseur à trois arrêts', b + 660, 430, b + 660, 190), detents: [0, .5, 1] });
  add(level, { ...door(exit, 'La porte de l’entresol', b + 990, 310, 180), height: 140,
    interlock: interlock([notch(lift, .5, 'Ascenseur à l’entresol')], 'Le palier d’en haut n’est pas celui qui aligne le verrou.') });
  level.stars.push(point(b + 840, 160));
  flag(level, b + 910, 310);
  scene(level, key, 'L’étoile n’est pas la sortie', b, [
    'Deux balcons apparaissent sur le même rail. L’étoile et la sortie n’ont pas la même hauteur.',
    'Le balcon supérieur s’arrête. Tu peux repartir sur l’ascenseur après avoir pris l’étoile.',
    'Pour l’étoile, monte tout en haut et marche jusqu’au balcon. Reviens sur le plateau, redescends au cran central et emprunte le palier du milieu. Ouvre sa porte.',
  ]);
}

/** A raised latch remains raised. Its source must be repositioned for the
 * next latch, deliberately undoing an earlier input without undoing progress. */
function relay(level: PlatformLevel, b: number, key: string, three = false) {
  floor(level, b, b + 1150);
  const control = `${key}-commande`, first = `${key}-premier`, second = `${key}-second`, last = `${key}-dernier`;
  add(level, { ...door(control, 'La commande à mémoire', b + 300), detents: [0, .5, 1] });
  add(level, { ...door(first, 'Le premier verrou', b + 570), interlock: interlock([three ? notch(control, .5, 'Commande au centre') : open(control, 'Commande en haut')], 'Le premier verrou écoute la commande, pas la force du geste.') });
  add(level, { ...door(second, 'Le deuxième verrou', b + 820), interlock: interlock([open(first, 'Premier verrou accroché'), three ? open(control, 'Commande en haut') : closed(control, 'Commande revenue en bas')], 'Le verrou précédent reste accroché. La commande peut changer de position.') });
  if (three) add(level, { ...door(last, 'Le dernier verrou', b + 1050), interlock: interlock([open(second, 'Deuxième verrou accroché'), closed(control, 'Commande revenue en bas')], 'Le dernier contact demande de refermer la commande laissée derrière toi.') });
  flag(level, b + 690);
  scene(level, key, three ? 'Une commande, trois états' : 'Faut-il vraiment tout laisser ouvert ?', b, [
    'Un verrou levé garde sa position. La commande peut donc servir plusieurs fois.',
    'Les liaisons demandent des positions différentes au cours du trajet. Tu devras revenir sur ton premier réglage.',
    three ? 'Commande au milieu : ouvre le premier verrou. Commande en haut : ouvre le deuxième. Avance après ces portes, ramène la commande en bas, puis ouvre le dernier verrou.'
      : 'Monte la commande et ouvre le premier verrou. Avance derrière lui, ramène la commande en bas puis ouvre le deuxième verrou.',
  ]);
}

/** Two separate water gaps share a transfer island. The first empty boat
 * must be recalled (or parked halfway later) before the second can leave. */
function twinFerries(level: PlatformLevel, b: number, key: string, middle = false) {
  floor(level, b, b + 430); floor(level, b + 680, b + 790); floor(level, b + 1030, b + 1150);
  const first = `${key}-amont`, second = `${key}-aval`, pin = `${key}-cliquet`;
  add(level, { ...platform(first, 'Le passeur amont', b + 480, 430, b + 650, 430), detents: middle ? [0, .5, 1] : [0, 1],
    interlock: interlock([closed(second, 'Passeur aval au départ')], 'Le passeur aval retient le câble du premier.') });
  add(level, { ...door(pin, 'Le cliquet de l’île', b + 740, 430, 240, 30), interlock: interlock([open(first, 'Passeur amont accosté')], 'Le cliquet attend que le premier passeur atteigne l’île.') });
  const parking = middle ? notch(first, .5, 'Passeur amont sur le contact central') : closed(first, 'Passeur amont rappelé');
  add(level, { ...platform(second, 'Le passeur aval', b + 840, 430, b + 1000, 430), interlock: interlock([open(pin, 'Cliquet de l’île accroché'), parking], 'Le second plateau attend le cliquet et la bonne tension du premier câble.') });
  flag(level, b + 780); flag(level, b + 1090);
  scene(level, key, middle ? 'Le bon mou dans le câble' : 'Un relais au milieu du vide', b, [
    'L’île permet de quitter un passeur avant de préparer l’autre. Les câbles ne sont pas indépendants.',
    `Le cliquet accroché conserve le premier accostage. Le passeur amont doit ensuite ${middle ? 'donner juste assez de mou' : 'libérer le câble en revenant'} avant le départ du second.`,
    `Prends le premier passeur jusqu’à l’île. Ouvre son cliquet, avance sur l’île puis renvoie le premier plateau ${middle ? 'au cran central' : 'au départ'}. Monte sur le second et conduis-le jusqu’à la dernière rive.`,
  ]);
}

function halfPress(level: PlatformLevel, b: number, key: string) {
  floor(level, b, b + 1150);
  const control = `${key}-commande`, press = `${key}-presse`, exit = `${key}-porte`;
  add(level, { ...door(control, 'Le régulateur de la presse', b + 300), detents: [0, .5, 1] });
  add(level, { ...door(press, 'La presse à demi-course', b + 700, 430, 120, 170), appearance: 'press', height: 130, detents: [0, .5, 1],
    interlock: interlock([notch(control, .5, 'Régulateur au centre')], 'Le régulateur libère la presse seulement à l’équilibre.') });
  add(level, { ...door(exit, 'Le verrou de la presse', b + 1050), interlock: interlock([notch(press, .5, 'Presse à demi-course'), closed(control, 'Régulateur remis en bas')], 'Le dernier verrou demande une ouverture précise et le régulateur refermé.') });
  flag(level, b + 870);
  scene(level, key, 'La place d’un petit bonhomme', b, [
    'Soulever la presse au maximum donne de la place, mais pas forcément le bon réglage.',
    'Le passage et le contact de sortie se satisfont avec une ouverture intermédiaire. Le régulateur peut ensuite être refermé.',
    'Place le régulateur au centre puis la presse au cran central. Passe dessous en te baissant. Remets le régulateur en bas derrière toi, puis ouvre le verrou final.',
  ]);
}

function base(id: number, title: string, subtitle: string, palette: PlatformLevel['palette'], rooms = 3): PlatformLevel {
  // The physical locks enforce each puzzle where it is encountered. The finish
  // flag must not remotely recheck controls the player has already passed.
  // Keeping the existing geometry and save IDs lets 1.6.0 games resume safely.
  return { id, title, subtitle, palette, width: rooms * 1900 + 160, start: point(140), goal: point(rooms * 1900 + 30),
    surfaces: [{ a: point(-120), b: point(0) }], hazards: [], drawings: [], stars: [], checkpoints: [], mechanisms: [], puzzles: [] };
}
function finish(level: PlatformLevel): PlatformLevel {
  floor(level, level.width - 350, level.width + 100);
  level.checkpoints.sort((a, b) => a.x - b.x);
  return level;
}

/** The second act contains different physical reasoning, not faster copies of
 * the introductory courses. The final chapter is a four-room assembly. */
export const ADVANCED_LEVELS: PlatformLevel[] = [
  (() => {
    const l = base(7, 'Le sens des serrures', 'Fermer une porte peut être le seul moyen d’en ouvrir une autre.', 'teal');
    airlock(l, 0, 'sas'); passage(l, 0, 1, 'pendulum');
    balancedBridge(l, 1900, 'appuis'); passage(l, 1900, 2, 'teeth');
    returningFerry(l, 3800, 'rappel'); passage(l, 3800, 3, 'press');
    return finish(l);
  })(),
  (() => {
    const l = base(8, 'Le poids du trait', 'Ni tout en haut, ni tout en bas : trouve l’accord qui laisse passer.', 'terracotta');
    counterweights(l, 0, 'balance'); passage(l, 0, 1, 'teeth');
    middleLift(l, 1900, 'entresol'); passage(l, 1900, 2, 'pendulum', false);
    halfPress(l, 3800, 'demi-course'); passage(l, 3800, 3, 'press');
    return finish(l);
  })(),
  (() => {
    const l = base(9, 'La ligne à rebours', 'Un réglage utile peut devenir celui qu’il faut défaire.', 'plum');
    relay(l, 0, 'memoire'); passage(l, 0, 1, 'press');
    twinFerries(l, 1900, 'relais'); passage(l, 1900, 2, 'pendulum');
    airlock(l, 3800, 'trois-portes', true); passage(l, 3800, 3, 'teeth');
    return finish(l);
  })(),
  (() => {
    const l = base(10, 'L’étage oublié', 'L’arrivée la plus haute n’est pas toujours la bonne. Observe les paliers.', 'blue');
    middleLift(l, 0, 'etages'); passage(l, 0, 1, 'press', false);
    balancedBridge(l, 1900, 'pont-pese', true); passage(l, 1900, 2, 'pendulum');
    returningFerry(l, 3800, 'retour-haut', true); passage(l, 3800, 3, 'teeth');
    return finish(l);
  })(),
  (() => {
    const l = base(11, 'Les accords contraires', 'Plusieurs contacts doivent s’accorder ; un seul mauvais réglage retient tout.', 'terracotta');
    counterweights(l, 0, 'trio', true, true); passage(l, 0, 1, 'pendulum');
    relay(l, 1900, 'trois-etats', true); passage(l, 1900, 2, 'teeth');
    twinFerries(l, 3800, 'tension', true); passage(l, 3800, 3, 'press');
    return finish(l);
  })(),
  (() => {
    const l = base(12, 'La dernière mécanique', 'Quatre chambres composent une seule machine. Prépare chaque transmission.', 'plum', 4);
    halfPress(l, 0, 'precision'); passage(l, 0, 1, 'teeth');
    airlock(l, 1900, 'chambre', true); passage(l, 1900, 2, 'press');
    counterweights(l, 3800, 'accord-final', true); passage(l, 3800, 3, 'pendulum');
    twinFerries(l, 5700, 'dernier-relais', true); passage(l, 5700, 4, 'teeth', false);
    return finish(l);
  })(),
];

import type { DrawingObstacle, PlatformHazard, PlatformLevel, PlatformMechanism, PlatformPoint, PlatformSurface } from './platformer';

const p = (x: number, y: number): PlatformPoint => ({ x, y });
const floor = (x1: number, x2: number, y: number): PlatformSurface => ({ a: p(x1, y), b: p(x2, y) });
const route = (points: [number, number][]) => points.map(([x, y]) => p(x, y));
const gear = (id: string, x: number, y: number, r: number, axis: 'x' | 'y', range: number, speed: number, phase = 0): PlatformHazard => ({ id, type: 'gear', x, y, r, axis, range, speed, phase });
const spikes = (id: string, x: number, y: number, w: number, h = 26): PlatformHazard => ({ id, type: 'spikes', x, y, w, h });
const drawing = (id: string, title: string, prompt: string, triggerX: number, points: [number, number][], duration = 2.2): DrawingObstacle => ({ id, title, prompt, triggerX, path: route(points), duration });

/**
 * Expand the walking sections for a scrolling level. Join the old small gaps;
 * every remaining gap is repaired by a freehand drawing or crossed on a ferry.
 * Stair rises stay small enough to walk up with both feet following the line.
 */
function wide(level: PlatformLevel, factor = 1.65): PlatformLevel {
  const point = (q: PlatformPoint): PlatformPoint => ({ x: Math.round(q.x * factor), y: q.y });
  const surfaces = level.surfaces.map(s => ({ a: point(s.a), b: point(s.b) }));
  for (let i = 1; i < surfaces.length; i++) {
    const originalGap = level.surfaces[i].a.x - level.surfaces[i - 1].b.x;
    if (originalGap > 0 && originalGap <= 160) {
      surfaces[i - 1].b.x = surfaces[i].a.x;
    }
  }
  const width = Math.round(level.width * factor);
  return {
    ...level, width, start: { ...level.start, x: 160 }, goal: { x: width - 140, y: level.goal.y }, surfaces,
    hazards: level.hazards.map(h => h.type === 'gear'
      ? { ...h, x: Math.round(h.x * factor), range: Math.round((h.range ?? 0) * 1.15) }
      : { ...h, x: Math.round(h.x * factor), w: Math.round(h.w * factor) }),
    drawings: level.drawings.map(d => ({ ...d, triggerX: Math.round(d.triggerX * factor), path: d.path.map(point), duration: d.duration + 0.3 })),
    stars: level.stars.map(point), checkpoints: level.checkpoints.map(point),
  };
}

/** Six authored courses: three hand constructions, moving hazards and safe flags. */
const DRAWING_COURSES: PlatformLevel[] = [
  wide({
    id: 1, title: 'Le premier passage', subtitle: 'Avance, baisse-toi et appelle la main devant le vide.', palette: 'blue', width: 2600,
    start: p(160, 430), goal: p(2460, 430),
    surfaces: [floor(-120, 460, 430), floor(760, 1090, 430), floor(1220, 1560, 430), floor(1850, 2100, 350), floor(2320, 2740, 430)],
    drawings: [
      drawing('pont', 'Un pont', 'Appelle la main pour relier les deux rives.', 405, [[460, 430], [760, 430]], 1.9),
      drawing('marches', 'Des marches', 'La main peut dessiner un escalier.', 1505, [[1560, 430], [1620, 430], [1620, 400], [1680, 400], [1680, 370], [1750, 370], [1750, 350], [1850, 350]]),
      drawing('descente', 'Une rampe', 'Dessine la descente jusqu’à la dernière ligne.', 2045, [[2100, 350], [2170, 350], [2250, 395], [2320, 430]]),
    ],
    hazards: [gear('roue-1', 935, 408, 23, 'x', 45, 1.45), spikes('piques-1', 1320, 404, 48), gear('roue-2', 1980, 325, 24, 'x', 30, 1.75, 1.1)],
    stars: [p(850, 375), p(1375, 302), p(2070, 295)], checkpoints: [p(815, 430), p(1895, 350), p(2370, 430)],
  }),
  wide({
    id: 2, title: 'Les dents de la ligne', subtitle: 'Les roues bougent. Passe dessous ou soulève leur poignée.', palette: 'terracotta', width: 2800,
    start: p(160, 430), goal: p(2660, 430),
    surfaces: [floor(-120, 500, 430), floor(780, 1130, 430), floor(1270, 1540, 430), floor(1800, 2090, 360), floor(2390, 2940, 430)],
    drawings: [
      drawing('pont-haut', 'Un pont surélevé', 'La main dessine un passage au-dessus de la roue.', 445, [[500, 430], [575, 370], [705, 370], [780, 430]]),
      drawing('escalier', 'Un escalier', 'Il manque les marches pour atteindre le balcon.', 1485, [[1540, 430], [1600, 430], [1600, 405], [1665, 405], [1665, 380], [1730, 380], [1730, 360], [1800, 360]]),
      drawing('dos-ane', 'Une passerelle', 'La main complète la traversée.', 2035, [[2090, 360], [2180, 320], [2280, 320], [2390, 430]]),
    ],
    hazards: [gear('roue-sous-pont', 640, 425, 26, 'x', 25, 1.6), gear('roue-1', 940, 406, 25, 'x', 55, 1.65), spikes('piques-1', 1380, 404, 48), gear('roue-2', 1950, 332, 26, 'y', 34, 1.55, 1.5), gear('roue-3', 2535, 407, 25, 'x', 45, 1.9, 2.4)],
    stars: [p(960, 302), p(2250, 265), p(2620, 330)], checkpoints: [p(825, 430), p(1840, 360), p(2440, 430)],
  }),
  wide({
    id: 3, title: 'Le pendule', subtitle: 'Certaines roues montent et descendent. Choisis ton moment.', palette: 'plum', width: 2950,
    start: p(160, 430), goal: p(2810, 430),
    surfaces: [floor(-120, 580, 430), floor(920, 1260, 430), floor(1400, 1670, 430), floor(1960, 2220, 330), floor(2520, 3090, 430)],
    drawings: [
      drawing('arche', 'Une arche', 'La main trace le passage au-dessus du vide.', 525, [[580, 430], [650, 385], [850, 385], [920, 430]]),
      drawing('grandes-marches', 'Des marches', 'Appelle la main pour monter sur la corniche.', 1615, [[1670, 430], [1730, 430], [1730, 400], [1790, 400], [1790, 370], [1850, 370], [1850, 340], [1900, 340], [1900, 330], [1960, 330]], 2.4),
      drawing('rampe', 'Une longue rampe', 'Une pente dessinée permet de rejoindre la sortie.', 2165, [[2220, 330], [2300, 330], [2420, 395], [2520, 430]]),
    ],
    hazards: [gear('pendule-1', 420, 368, 29, 'y', 42, 1.6), gear('roue-du-vide', 760, 475, 27, 'x', 65, 1.5), spikes('piques-1', 1060, 404, 55), gear('roue-1', 1515, 404, 25, 'x', 45, 1.75, 0.7), gear('roue-2', 2110, 306, 25, 'x', 28, 1.8, 2), spikes('piques-2', 2660, 404, 58)],
    stars: [p(1100, 298), p(2030, 275), p(2720, 310)], checkpoints: [p(970, 430), p(2010, 330), p(2570, 430)],
  }),
  wide({
    id: 4, title: 'Les grandes roues', subtitle: 'Garde de l’élan et utilise les espaces entre les pièges.', palette: 'teal', width: 3100,
    start: p(160, 430), goal: p(2960, 430),
    surfaces: [floor(-120, 470, 430), floor(800, 1180, 430), floor(1320, 1680, 430), floor(2040, 2340, 340), floor(2670, 3240, 430)],
    drawings: [
      drawing('pont', 'Un pont', 'La main raccorde cette grande coupure.', 415, [[470, 430], [800, 430]]),
      drawing('double-rampe', 'Deux rampes', 'La main dessine une montée en deux temps.', 1625, [[1680, 430], [1790, 385], [1880, 385], [1970, 340], [2040, 340]]),
      drawing('passerelle', 'Une passerelle', 'Le dernier vide attend son trait.', 2285, [[2340, 340], [2440, 340], [2560, 395], [2670, 430]]),
    ],
    hazards: [gear('pendule-1', 950, 378, 29, 'y', 39, 1.55), gear('roue-1', 1100, 408, 23, 'x', 22, 1.8, 1), spikes('piques-1', 1430, 404, 58), gear('roue-2', 2180, 315, 26, 'x', 42, 1.7, 2.1), gear('pendule-2', 2810, 400, 26, 'y', 29, 1.9, 0.4)],
    stars: [p(1020, 302), p(2180, 216), p(2930, 375)], checkpoints: [p(840, 430), p(2080, 340), p(2715, 430)],
  }),
  wide({
    id: 5, title: 'Les marches du danger', subtitle: 'Les lignes prennent de la hauteur, les roues aussi.', palette: 'terracotta', width: 3220,
    start: p(160, 430), goal: p(3080, 430),
    surfaces: [floor(-120, 540, 430), floor(890, 1230, 360), floor(1360, 1680, 360), floor(2040, 2390, 430), floor(2720, 3360, 430)],
    drawings: [
      drawing('marches', 'Un escalier', 'La main dessine les premières marches.', 485, [[540, 430], [600, 430], [600, 400], [665, 400], [665, 370], [735, 370], [735, 340], [810, 340], [890, 360]], 2.4),
      drawing('pont-haut', 'Un passage en hauteur', 'Passe au-dessus des dents avec l’aide de la main.', 1625, [[1680, 360], [1760, 310], [1870, 310], [1960, 390], [2040, 430]]),
      drawing('dernier-pont', 'Une dernière arche', 'La main dessine l’arche qui manque.', 2335, [[2390, 430], [2470, 370], [2610, 370], [2720, 430]]),
    ],
    hazards: [gear('roue-1', 1060, 335, 28, 'x', 58, 1.7), spikes('piques-1', 1440, 334, 58), gear('roue-du-bas', 1850, 414, 33, 'x', 32, 1.6), gear('roue-2', 2190, 405, 27, 'x', 58, 1.9, 1.2), gear('roue-du-vide', 2550, 450, 25, 'y', 18, 1.6), gear('pendule-3', 2880, 398, 26, 'y', 32, 1.8, 2.2), spikes('piques-2', 2970, 404, 48)],
    stars: [p(1100, 230), p(1850, 255), p(3040, 280)], checkpoints: [p(930, 360), p(2080, 430), p(2770, 430)],
  }),
  wide({
    id: 6, title: 'Le grand final', subtitle: 'Trois traits de la main et une dernière course entre les roues.', palette: 'plum', width: 3400,
    start: p(160, 430), goal: p(3260, 430),
    surfaces: [floor(-120, 560, 430), floor(900, 1260, 430), floor(1390, 1800, 430), floor(2170, 2460, 340), floor(2780, 3540, 430)],
    drawings: [
      drawing('premiere-arche', 'Une arche', 'Appelle la main pour lancer la traversée.', 505, [[560, 430], [650, 375], [810, 375], [900, 430]]),
      drawing('escalier-final', 'Le grand escalier', 'La corniche a besoin de quelques marches.', 1745, [[1800, 430], [1860, 430], [1860, 400], [1920, 400], [1920, 370], [1990, 370], [1990, 340], [2170, 340]], 2.5),
      drawing('rampe-finale', 'La rampe finale', 'Un dernier coup de crayon pour rejoindre les derniers pièges.', 2405, [[2460, 340], [2530, 340], [2620, 390], [2700, 390], [2780, 430]]),
    ],
    hazards: [gear('roue-depart', 385, 405, 25, 'x', 32, 1.7), gear('pendule-1', 1050, 388, 28, 'y', 31, 1.85), gear('pendule-2', 1515, 396, 26, 'y', 34, 1.65, 1.4), spikes('piques-1', 1650, 404, 48), gear('roue-haute', 2310, 315, 27, 'x', 42, 2, 2.5), gear('roue-finale', 2920, 407, 26, 'x', 40, 1.8, 1), spikes('piques-2', 3100, 404, 62), gear('pendule-final', 3220, 376, 25, 'y', 30, 1.6, 1.7)],
    stars: [p(1040, 280), p(2110, 285), p(3180, 265)], checkpoints: [p(950, 430), p(2210, 340), p(2830, 430)],
  }, 1.6),
];

const liftGate = (id: string, x: number, y = 430, height = 210): PlatformMechanism => ({
  id, type: 'gate', title: 'La porte suspendue', prompt: 'Soulève la poignée dorée pour libérer le passage.',
  from: p(x, y), to: p(x, y - 265), width: 32, height, speed: 720,
});
const ferry = (id: string, from: PlatformPoint, to: PlatformPoint, width = 132): PlatformMechanism => ({
  id, type: 'platform', title: from.y === to.y ? 'Le passeur' : 'L’ascenseur de la ligne',
  prompt: 'Monte sur le plateau, puis garde sa poignée en main pendant le déplacement.', from, to, width, speed: 640,
});
const parkGear = (hazard: Extract<PlatformHazard, { type: 'gear' }>, parkedY: number): PlatformMechanism => ({
  id: `poignee-${hazard.id}`, type: 'gear', hazardId: hazard.id, title: 'La roue à soulever',
  prompt: 'Soulève la roue avec sa poignée dorée et laisse-la en haut du rail.',
  from: p(hazard.x, hazard.y), to: p(hazard.x, parkedY), width: hazard.r * 2, speed: 720,
});

const press = (id: string, x: number, y: number): PlatformMechanism => ({
  id, type: 'gate', appearance: 'press', title: 'La presse suspendue',
  prompt: 'Saisis la poignée et soulève la presse. Elle reste où tu la lâches.',
  from: p(x, y), to: p(x, y - 165), width: 90, height: 126, speed: 700,
});

/**
 * Cooperation is part of the route: the long ferry gaps cannot be walked over,
 * raised gates stay raised, and every ferry remains callable from either bank.
 * The eighteen hand-drawn bridges are still supplied entirely by the player.
 */
function cooperativeCourse(source: PlatformLevel): PlatformLevel {
  const level: PlatformLevel = {
    ...source,
    surfaces: source.surfaces.map(s => ({ a: { ...s.a }, b: { ...s.b } })),
    hazards: source.hazards.map(h => ({ ...h })),
    drawings: source.drawings.map(d => ({ ...d, path: d.path.map(q => ({ ...q })) })),
    stars: source.stars.map(q => ({ ...q })),
    checkpoints: source.checkpoints.map(q => ({ ...q })),
    mechanisms: [],
  };
  const mechanisms = level.mechanisms!;
  const wheel = (id: string) => level.hazards.find(h => h.id === id && h.type === 'gear') as Extract<PlatformHazard, { type: 'gear' }>;
  const addFlag = (x: number, y: number) => level.checkpoints.push(p(x, y));
  switch (level.id) {
    case 1:
      level.subtitle = 'Soulève la porte, dessine ton pont, puis fais traverser le petit bonhomme.';
      level.surfaces[1].b.x = 1690;
      mechanisms.push(liftGate('premiere-porte', 420), ferry('premier-passeur', p(1690, 430), p(1993, 430), 128));
      addFlag(2050, 430);
      break;
    case 2:
      level.subtitle = 'Une roue peut se garer en hauteur. À toi de choisir le tracé et le moment.';
      level.surfaces[1].b.x = 1780;
      mechanisms.push(parkGear(wheel('roue-sous-pont'), 200), ferry('passeur-des-dents', p(1780, 430), p(2075, 430)));
      addFlag(2155, 430);
      break;
    case 3:
      level.subtitle = 'Écarte le pendule et monte à bord : la main peut aussi te faire prendre de la hauteur.';
      level.surfaces[1].b.x = 1980;
      mechanisms.push(parkGear(wheel('pendule-1'), 160), ferry('ascenseur-oblique', p(1980, 430), p(2240, 290), 140));
      level.surfaces.push(floor(2240, 2360, 290), { a: p(2360, 290), b: p(2475, 430) });
      level.stars[0] = p(2300, 230);
      addFlag(2300, 290);
      break;
    case 4:
      level.subtitle = 'Fais accoster le plateau, soulève la porte, puis écarte la dernière roue.';
      level.surfaces[1].b.x = 1850;
      wheel('roue-1').x = 1710;
      mechanisms.push(ferry('passeur-et-porte', p(1850, 430), p(2158, 430), 136), liftGate('porte-du-quai', 2240), parkGear(wheel('pendule-2'), 190));
      addFlag(2195, 430);
      break;
    case 5:
      level.subtitle = 'Dégage les roues, invente ta passerelle et ouvre la sortie du balcon.';
      level.surfaces[1].b.x = 1905;
      mechanisms.push(ferry('passeur-du-balcon', p(1905, 360), p(2224, 360)), parkGear(wheel('roue-du-bas'), 180), liftGate('porte-du-balcon', 3510));
      addFlag(2290, 360);
      break;
    case 6:
      level.subtitle = 'Le duo au complet : un trait, une roue à dégager, un passeur et la dernière porte.';
      level.width = 5800;
      level.goal = p(5660, 430);
      level.surfaces[4].b.x = 4760;
      level.surfaces.push(floor(5220, 5940, 430));
      wheel('pendule-final').x = 5530;
      const finalSpikes = level.hazards.find(h => h.id === 'piques-2');
      if (finalSpikes?.type === 'spikes') { finalSpikes.x = 5360; finalSpikes.w = 70; }
      level.stars[2] = p(5515, 245);
      mechanisms.push(parkGear(wheel('roue-finale'), 180), ferry('passeur-final', p(4760, 430), p(5200, 430), 144), liftGate('derniere-porte', 5260, 430, 230));
      addFlag(5320, 430);
      break;
  }
  addVerticalDetours(level);
  makeWalkingRoute(level);
  addDistinctObstacles(level);
  addDrawingChoices(level);
  refineMechanicalPassages(level);
  level.checkpoints.sort((a, b) => a.x - b.x);
  return level;
}

/** Existing handles retain their IDs and open/closed save values. These two
 * passages now ask for different physical gestures, with a safe bank to plan
 * from: extend a bridge before walking, then slide a shutter out of the way.
 * No drawn route or checkpoint moves when an older adventure is restored.
 */
function refineMechanicalPassages(level: PlatformLevel): void {
  if (level.id === 2) {
    const bridge = level.mechanisms!.find(m => m.id === 'passeur-des-dents')!;
    Object.assign(bridge, {
      title: 'Le pont coulissant',
      prompt: 'Tire la poignée vers la droite jusqu’à la butée : le pont rejoint l’autre rive.',
      to: p(1927.5, 430), width: 360,
    });
    level.subtitle = 'Dégage la roue, déploie le pont coulissant et règle la hauteur de la presse.';
  }
  if (level.id === 5) {
    const shutter = level.mechanisms!.find(m => m.id === 'porte-du-balcon');
    if (shutter?.type === 'gate') {
      shutter.appearance = 'door';
      shutter.title = 'Le volet sur glissière';
      shutter.prompt = 'Fais glisser la poignée vers le haut à droite pour libérer le passage.';
      shutter.to = p(3620, 165);
    }
    level.subtitle = 'Entre deux balcons, choisis ton tracé puis ouvre le volet sur sa glissière.';
  }
}

/** Four short changes of floor, each joined by a hand-driven vertical lift.
 * Existing bridge anchors and checkpoint positions/indices are unchanged.
 */
function addVerticalDetours(level: PlatformLevel): void {
  const mechanisms = level.mechanisms!;
  switch (level.id) {
    case 1:
      level.surfaces[0].b.x = 500;
      mechanisms.push(ferry('ascenseur-du-debut', p(540, 430), p(540, 300), 132));
      level.surfaces.push(floor(602, 650, 300), { a: p(650, 300), b: p(759, 430) });
      break;
    case 2:
      level.surfaces[2].b.x = 2310;
      mechanisms.push(ferry('ascenseur-des-dents', p(2350, 430), p(2350, 290), 128), press('presse-des-dents', 4350, 430));
      level.surfaces.push(floor(2410, 2460, 290), { a: p(2460, 290), b: p(2541, 430) });
      break;
    case 3:
      mechanisms.push(press('presse-du-pendule', 3460, 330));
      break;
    case 4: {
      const end = level.surfaces[4].b.x;
      level.surfaces[4].b.x = 4760;
      mechanisms.push(ferry('ascenseur-de-la-sortie', p(4800, 430), p(4800, 300), 140));
      level.surfaces.push(floor(4866, 4930, 300), { a: p(4930, 300), b: p(5050, 430) }, floor(5050, end, 430));
      level.stars[2].x = 4900;
      break;
    }
    case 5:
      level.surfaces[2].b.x = 2430;
      mechanisms.push(ferry('ascenseur-descendant', p(2470, 360), p(2470, 430), 144));
      level.surfaces.push(floor(2538, 2600, 430), { a: p(2600, 430), b: p(2772, 360) });
      break;
  }
}

/** Circular pendulums and broad presses change the silhouette of each hazard.
 * Their rendered positions are also the positions used by body collisions.
 */
function addDistinctObstacles(level: PlatformLevel): void {
  const handled = new Set((level.mechanisms ?? []).flatMap(m => m.type === 'gear' ? [m.hazardId] : []));
  for (const hazard of level.hazards) {
    if (hazard.type !== 'gear') continue;
    hazard.appearance = 'saw';
    if (!hazard.id.includes('pendule') || handled.has(hazard.id)) continue;
    hazard.appearance = 'pendulum';
    hazard.motion = 'swing';
    hazard.armLength = 145;
    hazard.swingAngle = .36;
    hazard.y = routeHeight(level, hazard.x) - 90;
    hazard.speed = Math.min(1.5, hazard.speed ?? 1.3);
  }
  if (level.id === 3) level.hazards.push({
    id: 'balancier-du-passage', type: 'gear', appearance: 'pendulum', motion: 'swing',
    x: 2640, y: 340, r: 27, armLength: 140, swingAngle: .42, speed: 1.2,
  });
  for (const mechanism of level.mechanisms ?? []) {
    if (mechanism.type === 'gate' && ['porte-du-quai', 'porte-du-balcon'].includes(mechanism.id)) {
      mechanism.appearance = 'press';
      mechanism.width = 76;
      mechanism.title = 'La presse du quai';
    }
  }
  if (level.id === 1) level.subtitle = 'Soulève la porte, monte avec l’ascenseur, puis dessine ton arche.';
  if (level.id === 2) level.subtitle = 'Des roues, un passeur, un ascenseur et une presse à déplacer de ta main.';
  if (level.id === 3) level.subtitle = 'Les balanciers se croisent : baisse-toi, soulève la presse et trace ton passage.';
  if (level.id === 4) level.subtitle = 'Traverse les quais, garde la presse levée et prends l’ascenseur jusqu’à l’étoile.';
  if (level.id === 5) level.subtitle = 'Monte, redescends avec la poignée et dessine entre les deux balcons.';
}

/** Highest authored walking surface at x, including each reference drawing. */
function routeHeight(level: PlatformLevel, x: number): number {
  const candidates = level.surfaces.slice();
  for (const drawing of level.drawings) for (let i = 1; i < drawing.path.length; i++) {
    candidates.push({ a: drawing.path[i - 1], b: drawing.path[i] });
  }
  const heights = candidates.flatMap(({ a, b }) => {
    if (Math.abs(b.x - a.x) < 0.01 || x < Math.min(a.x, b.x) || x > Math.max(a.x, b.x)) return [];
    return [a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)];
  });
  return heights.length ? Math.min(...heights) : 430;
}

/** Author each pit independently. Teeth belong to one low bed, never to a
 * wheel's travel envelope; the bridge itself remains entirely player drawn.
 */
function makeWalkingRoute(level: PlatformLevel): void {
  const arch = (index: number, height: number) => {
    const drawing = level.drawings[index], a = drawing.path[0], b = drawing.path.at(-1)!;
    const span = b.x - a.x;
    drawing.path = [{ ...a }, p(a.x + span * .25, height), p(a.x + span * .75, height), { ...b }];
  };
  const bed = (id: string, x: number, y: number, width = 84) => {
    const hazard = level.hazards.find(h => h.id === id);
    if (hazard?.type === 'spikes') Object.assign(hazard, { x, y, w: width, h: 26 });
  };
  switch (level.id) {
    case 1:
      arch(0, 370); bed('piques-1', 964.5, 398);
      break;
    case 2:
      arch(0, 370);
      // The first pit contains the handled wheel only. The teeth occupy a
      // separate pit, under the last bridge, over 2,500 units further along.
      bed('piques-1', 3664, 352, 82);
      break;
    case 3:
      arch(0, 280); arch(2, 280);
      bed('piques-1', 2958, 420, 72); bed('piques-2', 3868.5, 308);
      break;
    case 4:
      arch(0, 370); bed('piques-1', 1006, 398);
      break;
    case 5:
      arch(0, 300); arch(2, 380); bed('piques-1', 1138, 328);
      // A single visible machine owns this last pit. The old teeth and wheel
      // occupied the same pixels and offered no intelligible extra decision.
      level.hazards = level.hazards.filter(h => h.id !== 'piques-2');
      break;
    case 6:
      arch(0, 370); arch(2, 290);
      bed('piques-1', 1126, 398); bed('piques-2', 4150, 318);
      break;
  }
  const handledWheels = new Set((level.mechanisms ?? []).flatMap(m => m.type === 'gear' ? [m.hazardId] : []));
  for (const hazard of level.hazards) {
    if (hazard.type !== 'gear' || handledWheels.has(hazard.id) || hazard.y >= 440) continue;
    // The entire oscillation leaves room for a crouched body, but remains dangerous upright.
    const reach = hazard.axis === 'x' ? (hazard.range ?? 0) + hazard.r : 0;
    const floorY = Math.min(routeHeight(level, hazard.x), routeHeight(level, hazard.x - reach), routeHeight(level, hazard.x + reach));
    hazard.y = floorY - (hazard.axis === 'y' ? 96 : 88);
    if (hazard.axis === 'y') hazard.range = 8;
  }
  level.stars = level.stars.map(star => ({ x: star.x, y: routeHeight(level, star.x) - 30 }));
  if (level.id === 1) level.subtitle = 'Soulève la porte, dessine une arche et baisse-toi sous les roues.';
  if (level.id === 2) level.subtitle = 'Trace au-dessus des pointes et glisse sous les roues en te baissant.';
  if (level.id === 6) level.subtitle = 'Un dernier chemin à pied : arches, roues, passeur et porte à ouvrir ensemble.';
}

/** A route card changes a physical corridor, never builds it. The first route
 * remains the reference solution for saves and full-course regression tests.
 * Each generous allowance tolerates a finger-drawn curve instead of requiring
 * the exact guide. No choice adds a jump or an automatically moving mechanism.
 */
function addDrawingChoices(level: PlatformLevel): void {
  const contour = (drawing: DrawingObstacle, y: number, shoulder = .25) => {
    const a = drawing.path[0], b = drawing.path.at(-1)!, span = b.x - a.x;
    return [{ ...a }, p(a.x + span * shoulder, y), p(b.x - span * shoulder, y), { ...b }];
  };
  const allowance = (path: PlatformPoint[]) => Math.ceil((path.slice(1).reduce((length, point, index) =>
    length + Math.hypot(point.x - path[index].x, point.y - path[index].y), 0) * 1.4 + 80) / 10) * 10;
  const choice = (id: string, label: string, hint: string, path: PlatformPoint[]) => ({
    id, label, hint, path: path.map(point => ({ ...point })), inkLimit: allowance(path),
  });
  const setChoices = (index: number, choices: NonNullable<DrawingObstacle['choices']>, title: string, prompt: string) => {
    const drawing = level.drawings[index];
    drawing.choices = choices;
    drawing.path = choices[0].path.map(point => ({ ...point }));
    drawing.inkLimit = choices[0].inkLimit;
    drawing.title = title; drawing.prompt = prompt;
  };
  const optionalHighStar = (index: number, star: number, height: number, shortLabel: string) => {
    const drawing = level.drawings[index], short = drawing.path.map(point => ({ ...point }));
    const high = contour(drawing, height, .30), centre = (high[1].x + high[2].x) / 2;
    setChoices(index, [
      choice('etoile', 'Vers l’étoile', 'Monte au-dessus de la fosse pour prendre l’étoile, puis redescends sur la rive.', high),
      choice('court', shortLabel, 'Un trajet plus bas et plus court. L’étoile reste sur le détour supérieur.', short),
    ], 'Deux chemins, une étoile', 'Choisis ton détour : prendre l’étoile en hauteur ou rejoindre directement la rive.');
    level.stars[star] = p(centre, height - 30);
  };
  const routePress = (drawingIndex: number, id: string, x: number, y: number, highY: number) => {
    const drawing = level.drawings[drawingIndex], low = drawing.path.map(point => ({ ...point }));
    const high = contour(drawing, highY, .30);
    level.mechanisms!.push({
      id, type: 'gate', appearance: 'press', title: 'La presse du raccourci',
      prompt: 'Le tracé bas passe sous la presse : relève sa poignée avant de traverser.',
      from: p(x, y), to: p(x, 145), width: 72, height: 90, speed: 520,
    });
    setChoices(drawingIndex, [
      choice('presse', 'Sous la presse', 'Un trait court ; soulève la presse avant de passer dessous.', low),
      choice('dessus', 'Par-dessus', 'Une grande arche évite la presse. Garde une descente douce vers la rive.', high),
    ], 'La presse ou le détour', 'Observe la presse : relève-la pour le chemin bas, ou dessine au-dessus.');
  };
  switch (level.id) {
    case 1:
      optionalHighStar(0, 0, 235, 'Arche courte');
      level.subtitle = 'Un premier choix : l’arche courte ou le détour jusqu’à l’étoile.';
      break;
    case 2: {
      const drawing = level.drawings[0];
      setChoices(0, [
        choice('haut', 'Au-dessus', 'La roue reste au fond. Trace une arche suffisamment haute pour la contourner.', drawing.path),
        choice('roue', 'Roue relevée', 'Relève d’abord la roue avec sa poignée, puis trace un pont presque horizontal.', [drawing.path[0], drawing.path.at(-1)!]),
      ], 'Passer ou déplacer', 'La roue peut rester en bas si tu passes au-dessus, ou être relevée pour libérer un pont bas.');
      optionalHighStar(2, 1, 220, 'Rampe courte');
      level.subtitle = 'Passer au-dessus de la roue ou la relever ; prendre ensuite le détour de l’étoile.';
      break;
    }
    case 3: {
      const drawing = level.drawings[0], wheel = level.hazards.find(h => h.id === 'roue-du-vide');
      if (wheel?.type === 'gear') { wheel.y = 350; wheel.range = 45; wheel.speed = .85; }
      setChoices(0, [
        choice('haut', 'Grande arche', 'Passe au-dessus de toute la course de la roue suspendue.', drawing.path),
        choice('bas', 'Passage baissé', 'Un pont horizontal passe dessous. Reste baissé jusqu’à avoir dépassé le rail.', [drawing.path[0], drawing.path.at(-1)!]),
      ], 'Deux côtés du rail', 'La roue coupe la hauteur du personnage debout : passe au-dessus, ou baisse-toi sur un pont bas.');
      // Keep the pressure press and the next moving saw visibly separate.
      const wheelAfterPress = level.hazards.find(h => h.id === 'roue-2');
      if (wheelAfterPress?.type === 'gear') { wheelAfterPress.x = 3600; wheelAfterPress.range = 20; }
      level.subtitle = 'Choisis le dessus ou le passage baissé, puis prépare l’ascenseur et la presse.';
      break;
    }
    case 4: {
      routePress(1, 'presse-des-deux-chemins', 3060, 385, 245);
      const quaySaw = level.hazards.find(h => h.id === 'roue-1');
      if (quaySaw?.type === 'gear') quaySaw.x = 1745;
      level.subtitle = 'Le pont court exige de relever la presse ; une arche haute permet de la contourner.';
      break;
    }
    case 5: {
      const middle = level.drawings[1], last = level.drawings[2];
      setChoices(1, [
        choice('haut', 'Le balcon', 'Le passage haut conserve l’étoile et laisse la roue sous tes pieds.', middle.path),
        choice('roue', 'La pente directe', 'Relève la roue centrale, puis trace une pente douce vers la rive. Tu passes sous l’étoile.', [middle.path[0], middle.path.at(-1)!]),
      ], 'Le balcon ou l’atelier', 'Reste en hauteur pour l’étoile, ou dégage la roue et descends directement.');
      const wheel = level.hazards.find(h => h.id === 'roue-du-vide');
      if (wheel?.type === 'gear') {
        wheel.y = 424; wheel.range = 0;
        level.mechanisms!.push(parkGear(wheel, 230));
      }
      const sawAfterPress = level.hazards.find(h => h.id === 'roue-2');
      if (sawAfterPress?.type === 'gear') { sawAfterPress.x = 3710; sawAfterPress.range = 40; }
      setChoices(2, [
        choice('haut', 'Petite arche', 'Laisse la roue dans sa fosse et passe au-dessus.', last.path),
        choice('roue', 'Pont dégagé', 'Monte la roue au sommet du rail, puis dessine un pont droit.', [last.path[0], last.path.at(-1)!]),
      ], 'Une roue, deux solutions', 'Cette fosse contient une seule roue : passe au-dessus ou dégage-la avec la main.');
      level.subtitle = 'Un balcon pour l’étoile, une pente après avoir dégagé la roue, puis une dernière fosse à résoudre.';
      break;
    }
    case 6:
      optionalHighStar(0, 0, 230, 'Arche courte');
      routePress(1, 'presse-du-choix-final', 3110, 385, 245);
      level.subtitle = 'Compose ton parcours : étoile, presse à contourner ou à soulever, puis passeur et porte finale.';
      break;
  }
}

export const PLATFORM_LEVELS: PlatformLevel[] = DRAWING_COURSES.map(cooperativeCourse);

import { getMechanismPosition, getPlayerHeight, playerTouchesHazard, type GameWorld, type PlatformLevel, type PlatformPoint } from './platformer';

export type RouteReading = { kind: 'clear' | 'crouch' | 'danger'; message: string };

/** Read the visible arrangement. This is advice, never a replacement for a player's route. */
export function inspectPlayerRoute(world: GameWorld, level: PlatformLevel, path: readonly PlatformPoint[]): RouteReading {
  let requiresCrouch = false;
  if (path.length < 2) return { kind: 'clear', message: 'Tu dessines le chemin. Le guide reste facultatif.' };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12));
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const player = { ...world.player, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, crouching: false };
      const crouched = { ...player, crouching: true };
      for (const hazard of level.hazards) {
        if (playerTouchesHazard(world, level, crouched, hazard)) return {
          kind: 'danger', message: hazard.type === 'spikes'
            ? 'Ton trait touche les pointes : remonte cette portion.'
            : hazard.appearance === 'pendulum'
              ? 'Le balancier traverse ce chemin : garde une marge et observe son mouvement.'
              : 'Une roue coupe ce chemin : dégage-la ou choisis un autre passage.',
        };
        if (playerTouchesHazard(world, level, player, hazard)) requiresCrouch = true;
      }
      for (const mechanism of level.mechanisms ?? []) {
        if (mechanism.type !== 'gate') continue;
        const position = getMechanismPosition(world, mechanism);
        if (Math.abs(player.x - position.x) >= mechanism.width / 2 + 10) continue;
        const meets = (height: number) => player.y > position.y - mechanism.height && player.y - height < position.y;
        if (meets(getPlayerHeight(crouched))) return { kind: 'danger', message: 'La presse ferme ce chemin : soulève sa poignée avant de traverser.' };
        if (meets(getPlayerHeight(player))) requiresCrouch = true;
      }
    }
  }
  return requiresCrouch
    ? { kind: 'crouch', message: 'Ce passage est bas : traverse en te baissant.' }
    : { kind: 'clear', message: 'La ligne passe ici. Observe aussi le mouvement des obstacles.' };
}

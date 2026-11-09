export const ACTION_IDS = ['left', 'right', 'crouch', 'draw', 'interact', 'pause', 'restart'] as const;
export type ActionId = typeof ACTION_IDS[number];
export type KeyBindings = Record<ActionId, [string | null, string | null]>;

export const ACTION_LABELS: Record<ActionId, string> = {
  left: 'Aller à gauche',
  right: 'Aller à droite',
  crouch: 'Se baisser',
  draw: 'Dessiner un passage',
  interact: 'Manipuler une poignée',
  pause: 'Pause / reprendre',
  restart: 'Revenir au drapeau',
};

/** Values are KeyboardEvent.key values, including the literal space character. */
export const DEFAULT_BINDINGS: KeyBindings = {
  left: ['ArrowLeft', 'q'],
  right: ['ArrowRight', 'd'],
  crouch: ['ArrowDown', 's'],
  draw: ['e', null],
  interact: ['f', 'Enter'],
  pause: ['p', 'Escape'],
  restart: ['r', null],
};

const namedKeys = [
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Enter',
  'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
  'Shift', 'CapsLock', 'NumLock', 'ScrollLock', 'Pause', 'PrintScreen',
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
] as const;
const canonicalKeys = new Map(namedKeys.map(key => [key.toLowerCase(), key]));

/** Null means unsupported. Tab stays available for navigating the controls UI. */
export function normalizeKey(key: string): string | null {
  if (typeof key !== 'string') return null;
  if (key === ' ' || /^(space|spacebar)$/i.test(key)) return ' ';
  if (key === 'Esc') return 'Escape';
  if (key === 'Del') return 'Delete';
  const named = canonicalKeys.get(key.toLowerCase());
  if (named) return named;
  if ([...key].length === 1 && !/[\u0000-\u001f\u007f]/.test(key)) return key.toLowerCase();
  return null;
}

const labels: Record<string, string> = {
  ' ': 'Espace',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Escape: 'Échap', Enter: 'Entrée', Shift: 'Maj', Backspace: 'Retour',
  Delete: 'Suppr.', Insert: 'Inser.', Home: 'Début', End: 'Fin',
  PageUp: 'Page préc.', PageDown: 'Page suiv.', CapsLock: 'Verr. maj.',
  NumLock: 'Verr. num.', ScrollLock: 'Arrêt défil.', PrintScreen: 'Impr. écran',
};

export function keyLabel(key: string | null): string {
  if (key === null) return '—';
  const normalized = normalizeKey(key);
  if (!normalized) return '—';
  return labels[normalized] ?? (normalized.length === 1 ? normalized.toLocaleUpperCase('fr') : normalized);
}

/** Modifier/composition filtering belongs to the KeyboardEvent caller. */
export function actionForKey(key: string, bindings: KeyBindings): ActionId | null {
  const normalized = normalizeKey(key);
  if (!normalized) return null;
  return ACTION_IDS.find(action => bindings[action].includes(normalized)) ?? null;
}

const copyDefaults = (): KeyBindings => Object.fromEntries(
  ACTION_IDS.map(action => [action, [...DEFAULT_BINDINGS[action]]]),
) as KeyBindings;

/**
 * Read untrusted saved preferences without mutating them or the defaults.
 * Keep two slots, unique keys, and at least one key per action. Malformed
 * entries fall back to that action's defaults; irreconcilable data resets all.
 */
export function sanitizeBindings(value: unknown): KeyBindings {
  const result = copyDefaults();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const record = value as Record<string, unknown>;
  const customized = new Set<ActionId>();
  for (const action of ACTION_IDS) {
    const raw = record[action];
    if (!Array.isArray(raw)) continue;
    const slots = [0, 1].map(slot => typeof raw[slot] === 'string' ? normalizeKey(raw[slot]) : null) as KeyBindings[ActionId];
    if (slots[0] === slots[1]) slots[1] = null;
    if (slots.some(Boolean)) { result[action] = slots; customized.add(action); }
  }
  const used = new Set<string>();
  // A new action's defaults must never steal keys from an older custom action.
  const priority = [...ACTION_IDS.filter(a => customized.has(a)), ...ACTION_IDS.filter(a => !customized.has(a))];
  for (const action of priority) {
    for (const slot of [0, 1] as const) {
      const key = result[action][slot];
      if (key === null) continue;
      if (used.has(key)) result[action][slot] = null;
      else used.add(key);
    }
  }
  for (const action of ACTION_IDS) {
    if (result[action].some(Boolean)) continue;
    const fallback = DEFAULT_BINDINGS[action].filter((key): key is string => key !== null && !used.has(key));
    // New actions must not erase an older custom layout using their defaults.
    if (!fallback.length) {
      const spare = ['g','h','j','k','l','a','z','s','w','x','c','v','b','n','m','1','2','3','4','5'].find(key => !used.has(key));
      if (!spare) return copyDefaults();
      fallback.push(spare);
    }
    result[action] = [fallback[0], fallback[1] ?? null];
    fallback.forEach(key => used.add(key));
  }
  return result;
}

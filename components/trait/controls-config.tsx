"use client";

import {useEffect, useId, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowDown, Check, Hand, Keyboard, Pause, Pencil, RotateCcw, X} from 'lucide-react';
import {ACTION_IDS, ACTION_LABELS, DEFAULT_BINDINGS, keyLabel, normalizeKey, sanitizeBindings, type ActionId, type KeyBindings} from '../../lib/trait/controls';
import styles from './controls-config.module.css';

export type ControlsConfigProps = {
  bindings: KeyBindings;
  onChange: (bindings: KeyBindings) => void;
};
type Capture = {action: ActionId; slot: 0 | 1};
type Message = {text: string; error?: boolean};
const icons = {left: ArrowLeft, right: ArrowRight, crouch: ArrowDown, draw: Pencil, interact: Hand, pause: Pause, restart: RotateCcw};
const copyBindings = (bindings: KeyBindings): KeyBindings => Object.fromEntries(
  ACTION_IDS.map(action => [action, [...bindings[action]]]),
) as KeyBindings;

export function ControlsConfig({bindings, onChange}: ControlsConfigProps) {
  const id = useId();
  const [capturing, setCapturing] = useState<Capture | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const captureButton = useRef<HTMLButtonElement | null>(null);

  const cancelCapture = () => {
    setCapturing(null);
    setMessage({text: 'Attribution annulée. Tes touches sont conservées.'});
    captureButton.current?.focus({preventScroll: true});
  };

  useEffect(() => {
    if (!capturing) return;
    let finished = false;
    let shiftPending = false;
    let shiftCombined = false;
    const accept = (key: string) => {
      if (finished) return;
      const normalized = normalizeKey(key);
      if (!normalized) {
        setMessage({text: 'Cette touche ne peut pas être attribuée. Choisis une lettre, une flèche ou une autre touche simple.', error: true});
        return;
      }
      for (const action of ACTION_IDS) for (const slot of [0, 1] as const) {
        if (action === capturing.action && slot === capturing.slot) continue;
        if (bindings[action][slot] === normalized) {
          setMessage({text: `« ${keyLabel(normalized)} » est déjà utilisée pour « ${ACTION_LABELS[action]} ». Choisis une autre touche ou libère-la d’abord.`, error: true});
          return;
        }
      }
      const next = copyBindings(bindings);
      next[capturing.action][capturing.slot] = normalized;
      finished = true;
      onChange(next);
      setCapturing(null);
      setMessage({text: `« ${keyLabel(normalized)} » est attribuée à « ${ACTION_LABELS[capturing.action]} ».`});
      captureButton.current?.focus({preventScroll: true});
    };
    const down = (event: KeyboardEvent) => {
      if (finished) return;
      if (shiftPending && event.key !== 'Shift') shiftCombined = true;
      if (event.isComposing || event.keyCode === 229) return;
      // Even a held/modified Escape must not cancel the containing dialog.
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
      }
      if (event.repeat) return;
      // Tab exits capture and keeps the form fully reachable with a keyboard.
      if (event.key === 'Tab') {
        finished = true;
        setCapturing(null);
        setMessage({text: 'Attribution annulée. Choisis une autre case pour modifier une touche.'});
        return;
      }
      // Allow native keyboard activation of the explicit cancel/reset controls.
      const command = event.target instanceof Element && event.target.closest('[data-controls-command]');
      if (command && (event.key === 'Enter' || event.key === ' ')) return;
      if (event.ctrlKey || event.altKey || event.metaKey || (event.shiftKey && event.key !== 'Shift')) {
        setMessage({text: 'Les combinaisons sont ignorées. Presse une seule touche, ou Maj seule.'});
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      // Bind Shift on release so Shift+A is not mistaken for Shift alone.
      if (event.key === 'Shift') {
        shiftPending = true;
        shiftCombined = false;
        setMessage({text: 'Relâche Maj seule pour l’attribuer.'});
        return;
      }
      accept(event.key);
    };
    const up = (event: KeyboardEvent) => {
      if (finished || event.key !== 'Shift' || !shiftPending) return;
      event.preventDefault();
      event.stopPropagation();
      if (!shiftCombined && !event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing) accept('Shift');
      shiftPending = false;
    };
    // Capture phase prevents Escape from closing the parent dialog while rebinding.
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, [capturing, bindings, onChange]);

  const clear = (action: ActionId, slot: 0 | 1) => {
    if (bindings[action][slot] === null || bindings[action].filter(Boolean).length < 2) return;
    const next = copyBindings(bindings);
    const previous = next[action][slot];
    next[action][slot] = null;
    setCapturing(null);
    onChange(next);
    setMessage({text: `« ${keyLabel(previous)} » a été retirée de « ${ACTION_LABELS[action]} ».`});
  };
  const restore = () => {
    setCapturing(null);
    onChange(sanitizeBindings(DEFAULT_BINDINGS));
    setMessage({text: 'Les touches par défaut sont restaurées.'});
  };

  return <section className={styles.root} aria-labelledby={`${id}-title`}>
    <div className={styles.header}>
      <h3 id={`${id}-title`}><Keyboard size={17} aria-hidden="true"/>Touches du clavier</h3>
      <button className={styles.restore} type="button" onClick={restore} data-controls-command="true"><RotateCcw size={13} aria-hidden="true"/>Par défaut</button>
    </div>
    <p className={styles.hint} id={`${id}-hint`}>Clique sur une case, puis presse une touche. Deux touches au choix par action ; au moins une doit rester.</p>
    <div className={styles.rows}>
      {ACTION_IDS.map(action => {
        const Icon = icons[action];
        const canClear = bindings[action].filter(Boolean).length > 1;
        return <div key={action} className={styles.row} role="group" aria-label={ACTION_LABELS[action]}>
          <div className={styles.action}><Icon size={15} aria-hidden="true"/><span>{ACTION_LABELS[action]}</span></div>
          {([0, 1] as const).map(slot => {
            const key = bindings[action][slot];
            const active = capturing?.action === action && capturing.slot === slot;
            return <div key={slot} className={styles.slot}>
              <button
                type="button"
                className={`${styles.keyButton}${active ? ` ${styles.capturing}` : ''}${key === null ? ` ${styles.empty}` : ''}`}
                aria-label={`${ACTION_LABELS[action]}, touche ${slot + 1} : ${key === null ? 'non attribuée' : keyLabel(key)}. Modifier.`}
                aria-pressed={active}
                aria-describedby={`${id}-hint ${id}-status`}
                onClick={event => {
                  captureButton.current = event.currentTarget;
                  setCapturing({action, slot});
                  setMessage({text: `Choisis une touche pour « ${ACTION_LABELS[action]} ». Tab annule la saisie. Échap peut être attribuée.`});
                }}
              >{active ? <span className={styles.capturePrompt}>Appuie sur une touche</span> : key === null ? <span>Ajouter</span> : <kbd>{keyLabel(key)}</kbd>}</button>
              <button
                className={styles.clear}
                type="button"
                disabled={key === null || !canClear}
                onClick={() => clear(action, slot)}
                aria-label={`Effacer la touche ${slot + 1} de « ${ACTION_LABELS[action]} »`}
                title={!canClear && key !== null ? 'Garde au moins une touche pour cette action.' : 'Effacer cette touche'}
                data-controls-command="true"
              ><X size={13} aria-hidden="true"/></button>
            </div>;
          })}
        </div>;
      })}
    </div>
    <div className={`${styles.feedback}${message?.error ? ` ${styles.error}` : ''}`}>
      <p id={`${id}-status`} role="status" aria-live="polite" aria-atomic="true">
        {message && !capturing && !message.error && <Check size={14} aria-hidden="true"/>}
        <span>{message?.text ?? 'Maj seule est possible. Les combinaisons de touches sont ignorées.'}</span>
      </p>
      {capturing && <button className={styles.cancel} type="button" onClick={cancelCapture} data-controls-command="true">Annuler la saisie</button>}
    </div>
  </section>;
}

export default ControlsConfig;

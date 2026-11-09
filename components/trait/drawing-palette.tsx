import { Eye, Pencil, RotateCcw, Undo2, X } from 'lucide-react';
import type { DrawingObstacle } from '../../lib/trait/platformer';

type Props = {
  drawing: DrawingObstacle;
  choiceId: string | null;
  editing: boolean;
  held: boolean;
  hasStroke: boolean;
  guide: boolean;
  inkPercent: number | null;
  onChoose: (id: string) => void;
  onGuide: () => void;
  onUndo: () => void;
  onClear: () => void;
  onCancel: () => void;
};

export function DrawingPalette(props: Props) {
  const choices = props.drawing.choices ?? [];
  const selected = choices.find(choice => choice.id === props.choiceId) ?? choices[0];
  const points = choices.flatMap(choice => choice.path);
  const top = points.length ? Math.min(...points.map(point => point.y)) - 5 : 0;
  const bottom = points.length ? Math.max(...points.map(point => point.y)) + 5 : 24;
  return <section className={'drawing-palette' + (props.editing ? ' is-editing' : '')} aria-label="Choisir et dessiner un chemin">
    {choices.length > 1 && <div className="route-choices" role="group" aria-label="Itinéraires à dessiner">
      {choices.map((choice, index) => {
        const start = choice.path[0], end = choice.path[choice.path.length - 1];
        const d = choice.path.map((point, i) => `${i ? 'L' : 'M'}${8 + (point.x - start.x) / Math.max(1, end.x - start.x) * 68} ${4 + (point.y - top) / Math.max(24, bottom - top) * 22}`).join(' ');
        return <button key={choice.id} className="route-choice" aria-pressed={selected?.id === choice.id}
          aria-label={`Chemin ${index + 1} : ${choice.label}. ${choice.hint}`} disabled={props.held} onClick={() => props.onChoose(choice.id)}>
          <svg viewBox="0 0 84 32" fill="none" aria-hidden="true"><path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy={4 + (start.y - top) / Math.max(24, bottom - top) * 22} r="2" fill="currentColor"/><circle cx="76" cy={4 + (end.y - top) / Math.max(24, bottom - top) * 22} r="2" fill="currentColor"/></svg>
          <span>{choice.label}</span>
        </button>;
      })}
    </div>}
    {props.editing && <>
      <div className="pencil-actions" role="group" aria-label="Outils de dessin">
        <button className={props.guide ? 'is-selected' : ''} aria-label="Afficher le guide du chemin" aria-pressed={props.guide} onClick={props.onGuide}><Eye size={16}/><span>Guide</span></button>
        <button aria-label="Retirer la dernière portion du trait" disabled={!props.hasStroke || props.held} onClick={props.onUndo}><Undo2 size={16}/><span>Reculer</span></button>
        <button aria-label="Effacer le trait" disabled={!props.hasStroke || props.held} onClick={props.onClear}><RotateCcw size={15}/><span>Effacer</span></button>
        <button aria-label="Annuler le dessin" onClick={props.onCancel}><X size={16}/><span>Fermer</span></button>
      </div>
      {props.inkPercent !== null && <div className={'pencil-budget' + (props.inkPercent > 100 ? ' is-full' : '')} aria-label={`Encre utilisée : ${props.inkPercent} %`}>
        <Pencil size={11}/><span className="pencil-budget-track"><span style={{width: Math.min(100, props.inkPercent) + '%'}}/></span><span>{Math.max(0, 100 - props.inkPercent)} %</span>
      </div>}
    </>}
    {selected && <p className="route-hint">{selected.hint}</p>}
  </section>;
}

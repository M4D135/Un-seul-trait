import { ArrowRight, Check, ChevronRight, Lightbulb, LockKeyhole, Medal, Pencil, Star } from 'lucide-react';
import { PLATFORM_LEVELS } from '../../lib/trait/platform-levels';
import { PLATFORM_PALETTES } from '../../lib/trait/platform-renderer';
import { chapterChallenge, isChapterUnlocked, summarizeCampaign, type CampaignRun, type ChapterScore } from '../../lib/trait/campaign';
import type { PuzzleScene } from '../../lib/trait/platformer';

function ChapterThumbnail({ index }: { index: number }) {
  const level = PLATFORM_LEVELS[index], x = (n: number) => n / level.width * 200, y = (n: number) => 20 + n * .1;
  return <svg viewBox="0 0 200 88" fill="none" aria-hidden="true">
    {level.surfaces.map((surface, i) => <path key={i} d={`M${x(surface.a.x)} ${y(surface.a.y)}L${x(surface.b.x)} ${y(surface.b.y)}`} stroke="#fffdf6" strokeWidth="1.8" strokeLinecap="round"/>)}
    {level.drawings.map(drawing => <path key={drawing.id} d={drawing.path.map((p, i) => `${i ? 'L' : 'M'}${x(p.x)} ${y(p.y)}`).join(' ')} stroke="#fffdf6" strokeWidth="1.2" strokeDasharray="2 3" opacity=".4"/>)}
    {level.mechanisms?.map(mechanism => <g key={mechanism.id}><path d={`M${x(mechanism.from.x)} ${y(mechanism.from.y) - 8}L${x(mechanism.to.x)} ${y(mechanism.to.y) - 8}`} stroke="#f6d89a" strokeWidth="1"/><circle cx={x(mechanism.from.x)} cy={y(mechanism.from.y) - 8} r="2.8" stroke="#f6d89a" strokeWidth="1.2"/></g>)}
  </svg>;
}

export function ChapterNotebook({ scores, current, adventure, onStart }: {
  scores: ChapterScore[]; current: number; adventure: Record<string, unknown>;
  onStart: (index: number, fresh?: boolean) => void;
}) {
  const totals = summarizeCampaign(scores, PLATFORM_LEVELS);
  return <>
    <h2 id="dialog-title">Le carnet des chemins<span>.</span></h2>
    <p className="dialog-intro">Douze chapitres. Observe, essaie, reviens sur tes idées. Le deuxième acte commence au chapitre 07.</p>
    <div className="notebook-summary"><span><Check size={16}/>{totals.completed} / {PLATFORM_LEVELS.length}</span><span><Star size={17}/>{totals.stars} / {totals.totalStars} étoiles</span><span><Medal size={16}/>{totals.mastered} maîtrisés</span></div>
    {[0, 1].map(act => <section className="chapter-act" key={act} aria-labelledby={`act-${act}`}>
      <div className="act-heading"><span>{act === 0 ? 'I' : 'II'}</span><div><h3 id={`act-${act}`}>{act === 0 ? 'Les premiers traits' : 'La mécanique des idées'}</h3><p>{act === 0 ? 'Prendre la main, inventer son chemin.' : 'Des liens à comprendre. Un ordre à trouver.'}</p></div>{act === 1 && <b>6 NOUVEAUX</b>}</div>
      <div className="level-grid">{PLATFORM_LEVELS.slice(act * 6, act * 6 + 6).map((level, offset) => {
        const index = act * 6 + offset, score = scores[index];
        const unlocked = isChapterUnlocked(index, PLATFORM_LEVELS, scores, adventure);
        const challenge = score ? chapterChallenge(score, level) : 'Trouver la sortie';
        return <button key={level.id} disabled={!unlocked} className={'level-card' + (index === current ? ' current' : '') + (!unlocked ? ' is-locked' : '')}
          onClick={() => onStart(index)} aria-label={`Chapitre ${level.id}, ${level.title}. ${unlocked ? challenge : `Termine le chapitre ${level.id - 1} pour l’ouvrir.`}`}>
          <div className="level-preview" style={{ background: PLATFORM_PALETTES[level.palette].background }}><ChapterThumbnail index={index}/><span>{String(level.id).padStart(2, '0')}</span>{score?.mastered ? <i><Medal size={15}/></i> : score?.done ? <i><Check size={13}/></i> : !unlocked ? <i><LockKeyhole size={14}/></i> : null}</div>
          <div className="level-info"><strong>{level.title}</strong><small className="level-mechanics">{unlocked ? `${level.drawings.length} traits · ${level.mechanisms?.length ?? 0} mécanismes` : `Après le chapitre ${String(level.id - 1).padStart(2, '0')}`}</small>
            <span className="chapter-record"><span className="mini-stars">{[0, 1, 2].map(star => <Star key={star} size={12} fill={score?.stars > star ? 'currentColor' : 'none'}/>)}</span>{score?.done && <span className="chapter-seals" aria-label={`${score.cleanStars === 3 ? 'Sans chute. ' : ''}${score.independentStars === 3 ? 'Sans indice.' : ''}`}><span className={score.cleanStars === 3 ? 'earned' : ''}>◇</span><span className={score.independentStars === 3 ? 'earned' : ''}>✧</span></span>}</span>
            {unlocked && score?.done && <span className="chapter-challenge">{challenge}</span>}
          </div>
        </button>;
      })}</div>
    </section>)}
    <div className="notebook-legend"><span>◇ Toutes les étoiles sans chute ni retour</span><span>✧ Toutes les étoiles sans indice</span><span><Medal size={14}/> Les deux en une traversée</span></div>
    <p className="dialog-footnote">Un chapitre se reprend au dernier drapeau. Pour tenter un parcours parfait, recommence-le depuis le menu. {totals.routes} / {totals.totalRoutes} tracés explorés sur des chapitres terminés.</p>
  </>;
}

export function PuzzleNotebook({ scene, revealed, onReveal, onClose }: {
  scene: PuzzleScene | null; revealed: number; onReveal: () => void; onClose: () => void;
}) {
  return <>
    <span className="eyebrow">LE CARNET DU DESSINATEUR</span>
    <h2 id="dialog-title" className="clue-title">{scene?.title ?? 'Regarde les liens'}{!/[.!?]$/.test(scene?.title??'')&&<span>.</span>}</h2>
    <p className="dialog-intro">Les petits symboles relient les mécanismes. Un contact doré indique que son réglage convient. Les poignées restent là où tu les lâches.</p>
    {scene && <>
      <ol className="puzzle-clues">{scene.hints.slice(0, revealed).map((hint, index) => <li key={index}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{['Un détail à observer', 'Le lien à comprendre', 'Une piste concrète'][index]}</small><p>{hint}</p></div></li>)}</ol>
      {revealed < 3 && <button className="quiet-button reveal-clue" onClick={onReveal}><Lightbulb size={17}/>{revealed === 0 ? 'Un premier indice' : 'Un indice plus précis'}<ChevronRight size={17}/></button>}
      <p className="clue-note">{revealed === 0 ? 'Rien n’est révélé pour l’instant. Demander un indice met simplement de côté le défi « sans indice » pour cette traversée.' : 'Prends le temps de faire tes essais. Tu peux toujours revenir sur un réglage.'}</p>
    </>}
    <button className="primary-button help-close" onClick={onClose}>Retour à l’énigme<ArrowRight size={18}/></button>
  </>;
}

export function RunChallenges({ score, run, stars, deaths }: { score: ChapterScore; run: CampaignRun; stars: number; deaths: number }) {
  const seals = [
    { label: '3 étoiles', ok: stars === 3, icon: <Star size={15}/> },
    { label: 'Sans chute', ok: run.eligible && stars === 3 && deaths === 0 && run.checkpointReturns === 0, icon: <Medal size={15}/> },
    { label: 'Sans indice', ok: run.eligible && stars === 3 && run.hintsUsed === 0, icon: <Lightbulb size={15}/> },
  ];
  return <><div className="run-challenges">{seals.map(seal => <span className={seal.ok ? 'earned' : ''} key={seal.label}>{seal.icon}{seal.label}{seal.ok && <Check size={12}/>}</span>)}</div>{score.mastered && <p className="mastery-message"><Pencil size={14}/> Chapitre maîtrisé</p>}</>;
}

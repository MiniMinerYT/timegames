import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Heart, Lock, RotateCcw, ShieldAlert, Skull, Sparkles } from 'lucide-react';
import { triggerHaptic } from './haptics';

const CARD_HEIGHT = 'app-card';

export type HardcoreDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'god' | 'literal';
export type HardcoreScores = Record<HardcoreDifficulty, number>;

type HardcorePhase = 'select' | 'target' | 'playing' | 'result' | 'gameOver';

interface DifficultyDefinition {
  id: HardcoreDifficulty;
  name: string;
  threshold: number;
  unlockText: string;
  panel: string;
  button: string;
  accent: string;
  exact?: boolean;
}

const difficulties: DifficultyDefinition[] = [
  { id: 'easy', name: 'Easy', threshold: 1, unlockText: 'Unlocked', panel: 'bg-teal-100 border-teal-400 text-teal-950', button: 'bg-teal-500 hover:bg-teal-600', accent: 'text-teal-600' },
  { id: 'medium', name: 'Medium', threshold: 0.5, unlockText: 'Score 3 on Easy', panel: 'bg-amber-100 border-amber-400 text-amber-950', button: 'bg-amber-500 hover:bg-amber-600', accent: 'text-amber-600' },
  { id: 'hard', name: 'Hard', threshold: 0.25, unlockText: 'Score 3 on Medium', panel: 'bg-red-700 border-red-400 text-white', button: 'bg-red-600 hover:bg-red-700', accent: 'text-red-400' },
  { id: 'expert', name: 'Expert', threshold: 0.1, unlockText: 'Score 3 on Hard', panel: 'bg-purple-950 border-red-800 text-white', button: 'bg-red-800 hover:bg-red-900', accent: 'text-red-400' },
  { id: 'god', name: 'GOD', threshold: 0.5, unlockText: 'Score 3 on Expert', panel: 'hardcore-god-panel border-yellow-500 text-white', button: 'bg-yellow-500 hover:bg-yellow-400 !text-black', accent: 'text-yellow-400' },
  { id: 'literal', name: 'LITERAL CLOCK', threshold: 0, unlockText: 'Score 3 on GOD', panel: 'bg-black border-white text-white', button: 'bg-white hover:bg-slate-200 !text-black', accent: 'text-white', exact: true },
];

function isUnlocked(difficulty: HardcoreDifficulty, scores: HardcoreScores) {
  if (difficulty === 'easy') return true;
  if (difficulty === 'medium') return scores.easy >= 3;
  if (difficulty === 'hard') return scores.medium >= 3;
  if (difficulty === 'expert') return scores.hard >= 3;
  if (difficulty === 'god') return scores.expert >= 3;
  return scores.god >= 3;
}

function generateTarget(score: number) {
  const [min, max] = score <= 4 ? [1, 4] : score <= 9 ? [2, 7] : [1, 10];
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

export default function HardcoreMode({
  bestScores,
  sounds,
  haptics,
  reducedMotion,
  onTimingChange,
  onHelpVisibilityChange,
  onBestScoreChange,
  onBack,
}: {
  bestScores: HardcoreScores;
  sounds: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  onTimingChange: (active: boolean) => void;
  onHelpVisibilityChange: (visible: boolean) => void;
  onBestScoreChange: (difficulty: HardcoreDifficulty, score: number) => void;
  onBack: () => void;
}) {
  const [difficulty, setDifficulty] = useState<HardcoreDifficulty>('easy');
  const [phase, setPhase] = useState<HardcorePhase>('select');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [target, setTarget] = useState(1);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [passed, setPassed] = useState(false);
  const [unlockNotice, setUnlockNotice] = useState<string | null>(null);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const startRef = useRef<number | null>(null);

  const definition = difficulties.find(item => item.id === difficulty) ?? difficulties[0];

  const playTone = useCallback((frequency: number, duration = 0.08) => {
    if (!sounds) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = difficulty === 'god' || difficulty === 'literal' ? 'sawtooth' : 'sine';
      gain.gain.setValueAtTime(0.06, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      // Sound feedback is optional and can be blocked by the browser.
    }
  }, [difficulty, sounds]);

  const startRun = (selected: HardcoreDifficulty) => {
    setDifficulty(selected);
    setScore(0);
    setLives(3);
    setTarget(generateTarget(0));
    setElapsed(null);
    setPhase('target');
  };

  const beginTimer = () => {
    startRef.current = performance.now();
    setPhase('playing');
    onTimingChange(true);
    playTone(760, 0.08);
    triggerHaptic(haptics, 35);
  };

  const stopTimer = () => {
    if (startRef.current === null) return;
    const rawElapsed = (performance.now() - startRef.current) / 1000;
    const shownElapsed = Math.round(rawElapsed * 100) / 100;
    const rawError = Math.abs(rawElapsed - target);
    const shownError = Math.round(Math.abs(shownElapsed - target) * 100) / 100;
    const success = definition.exact ? shownError === 0 : rawError <= definition.threshold;
    onTimingChange(false);
    const nextScore = success ? score + 1 : score;
    const nextLives = success ? lives : lives - 1;

    setElapsed(shownElapsed);
    setPassed(success);
    setScore(nextScore);
    setLives(nextLives);
    playTone(success ? 900 : 180, 0.12);
    if (!success && nextLives === 0) {
      window.setTimeout(() => playTone(145, 0.16), 110);
      window.setTimeout(() => playTone(95, 0.24), 230);
    }
    if (shownError === 0) {
      window.setTimeout(() => playTone(1120, 0.1), 90);
      window.setTimeout(() => playTone(1380, 0.18), 180);
    }
    triggerHaptic(haptics, success ? [25, 30, 25] : [50, 35, 50]);

    if (success && nextScore > bestScores[difficulty]) {
      onBestScoreChange(difficulty, nextScore);
    }
    if (success && nextScore >= 3 && bestScores[difficulty] < 3 && difficulty !== 'literal') {
      const nextName = difficulty === 'easy' ? 'Medium' : difficulty === 'medium' ? 'Hard' : difficulty === 'hard' ? 'Expert' : difficulty === 'expert' ? 'GOD' : 'LITERAL CLOCK';
      setUnlockNotice(`${nextName} difficulty unlocked!`);
    }
    setPhase(nextLives === 0 ? 'gameOver' : 'result');
  };

  const nextRound = () => {
    setTarget(generateTarget(score));
    setElapsed(null);
    setPhase('target');
  };

  const changeDifficulty = () => {
    startRef.current = null;
    onTimingChange(false);
    setElapsed(null);
    setPhase('select');
  };

  useEffect(() => {
    const handleSpace = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'BUTTON') return;
      if (phase !== 'target' && phase !== 'playing' && phase !== 'result' && phase !== 'gameOver') return;
      event.preventDefault();
      if (phase === 'target') beginTimer();
      else if (phase === 'playing') stopTimer();
      else if (phase === 'result') nextRound();
      else startRun(difficulty);
    };
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  });

  useEffect(() => {
    if (!unlockNotice) return;
    const timer = window.setTimeout(() => setUnlockNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [unlockNotice]);

  useEffect(() => {
    if (!lockedNotice) return;
    const timer = window.setTimeout(() => setLockedNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [lockedNotice]);

  useEffect(() => () => onTimingChange(false), [onTimingChange]);

  useEffect(() => {
    onHelpVisibilityChange(phase === 'select');
    return () => onHelpVisibilityChange(false);
  }, [onHelpVisibilityChange, phase]);

  const shownError = elapsed === null ? null : Math.round(Math.abs(elapsed - target) * 100) / 100;
  const visibleDifficulties = difficulties;
  const screenTheme = difficulty === 'literal'
    ? 'bg-black text-white'
    : difficulty === 'god'
    ? 'hardcore-god-screen'
    : difficulty === 'expert'
      ? 'bg-gradient-to-b from-slate-950 to-purple-950'
      : difficulty === 'hard'
        ? 'bg-gradient-to-b from-red-950 to-slate-950'
        : difficulty === 'medium'
          ? 'bg-gradient-to-b from-amber-950 to-slate-950'
          : 'bg-white';
  const inRun = phase !== 'select';

  return (
    <div className={`${screenTheme} relative rounded-3xl shadow-xl p-5 sm:p-6 text-center ${CARD_HEIGHT} flex flex-col ${inRun && difficulty !== 'easy' ? 'text-white' : ''}`}>
      <div className="text-center space-y-1 mb-3">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-red-600 flex items-center justify-center text-white"><Skull className="w-6 h-6" /></div>
        <h1 className="text-3xl font-black">Hardcore Mode</h1>
        {!inRun && <p className="text-sm opacity-80">Three lives. Hit targets and build an endless score.</p>}
        {inRun && <p className={`text-xs font-black ${definition.accent}`}>{definition.name} · Best {bestScores[difficulty]}</p>}
      </div>

      {phase === 'select' ? (
        <div className="flex-1 min-h-0 overflow-y-auto card-scroll hardcore-difficulty-scroll">
          <div className="mb-2">
            <p className="text-sm font-black text-slate-500 uppercase tracking-[0.18em]">Choose Difficulty</p>
          </div>
          <div className="grid grid-cols-2 gap-2 pb-1">
            {visibleDifficulties.map(item => {
              const unlocked = isUnlocked(item.id, bestScores);
              const mysterious = (item.id === 'god' || item.id === 'literal') && !unlocked;
              const unlockText = item.id === 'literal' && !isUnlocked('god', bestScores)
                ? 'Score 3 on ????'
                : item.unlockText;
              return (
                <button key={item.id} aria-disabled={!unlocked} onClick={() => unlocked ? startRun(item.id) : setLockedNotice(`${mysterious ? 'The mystery difficulty' : item.name} is locked. ${unlockText} to unlock it.`)} className={`w-full rounded-2xl border p-2 text-center transition-colors ${item.panel} ${unlocked ? 'hover:brightness-110' : 'border-dashed ring-2 ring-slate-400/40'}`}>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">{mysterious ? <span className="font-black text-lg">?</span> : unlocked ? <ShieldAlert className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</div>
                    <div>
                      <p className="font-black text-lg">{mysterious ? '????' : item.name}</p>
                      <p className="text-xs opacity-90">{mysterious ? 'A mysterious difficulty awaits' : item.exact ? 'Perfect to 2 decimal places' : `Within ±${item.threshold.toFixed(2)}s`}</p>
                      <p className={`text-xs font-black mt-1 ${unlocked ? '' : 'inline-block bg-slate-950 text-white rounded-full px-2 py-0.5'}`}>{unlocked ? `Best ${bestScores[item.id]}` : `LOCKED · ${unlockText}`}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="grid grid-cols-2 gap-6 px-4 mb-2">
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60">Score</p>
              <motion.p key={score} initial={reducedMotion || score === 0 ? false : { scale: 1.18 }} animate={{ scale: 1 }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: 'easeOut' }} className="text-4xl leading-none font-black mt-1">{score}</motion.p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60">Lives</p>
              <div className="flex justify-end gap-1.5 mt-1" aria-label={`${lives} lives remaining`}>
                {Array.from({ length: 3 }, (_, index) => {
                  const active = index < lives;
                  return (
                    <motion.div
                      key={index}
                      initial={false}
                      animate={active
                        ? { scale: 1, rotate: 0, y: 0, opacity: 1 }
                        : reducedMotion
                          ? { scale: 0.78, rotate: 0, y: 0, opacity: 0.24 }
                          : { scale: [1.15, 0.55, 0.78], rotate: [0, -14, 9, 0], y: [0, -5, 3], opacity: 0.24 }}
                      transition={{ duration: reducedMotion ? 0 : active ? 0.35 : 0.55, ease: 'easeInOut' }}
                    >
                      <Heart className={`w-8 h-8 ${active ? 'fill-red-500 text-red-500 drop-shadow-sm' : 'text-slate-500'}`} />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {phase === 'target' && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <p className={`text-sm uppercase tracking-[0.25em] font-black ${definition.accent}`}>Your target</p>
              <p className="text-5xl font-black">{target.toFixed(2)}s</p>
              <p className="text-sm opacity-80">Memorise it, then press Start or use Space.</p>
              <button onClick={beginTimer} className={`relative z-20 pointer-events-auto w-44 h-44 rounded-full ${definition.button} text-white text-4xl font-black shadow-2xl transition-all active:scale-95`}>START</button>
            </div>
          )}

          {phase === 'playing' && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <p className="invisible text-sm uppercase tracking-[0.25em] font-black" aria-hidden="true">Your target</p>
              <p className="invisible text-5xl font-black" aria-hidden="true">00.00s</p>
              <p className="font-bold opacity-80">Target hidden. Press STOP or Space.</p>
              <button onClick={stopTimer} className="relative z-20 pointer-events-auto w-44 h-44 rounded-full bg-red-600 hover:bg-red-700 text-white text-4xl font-black shadow-2xl shadow-red-900/30 transition-all active:scale-95">STOP</button>
            </div>
          )}

          {phase === 'result' && elapsed !== null && shownError !== null && (
            <div className="flex-1 flex flex-col justify-center space-y-3">
              <div className={`rounded-3xl border p-4 ${passed ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-red-500/15 border-red-500/40'}`}>
                <p className="text-2xl font-black">{passed ? 'Passed' : 'Fail · Life lost'}</p>
                <p className="text-5xl font-black mt-3">{elapsed.toFixed(2)}s</p>
                <p className="font-bold opacity-70 mt-1">{shownError.toFixed(2)}s off · Target {target.toFixed(2)}s</p>
              </div>
              <button onClick={nextRound} className={`w-full ${definition.button} text-white font-black py-3 rounded-2xl`}>Next Target · Space</button>
            </div>
          )}

          {phase === 'gameOver' && elapsed !== null && shownError !== null && (
            <div className="flex-1 flex flex-col justify-center space-y-3">
              <div className="rounded-3xl bg-red-500/15 border border-red-500/40 p-4">
                <Skull className="w-12 h-12 mx-auto text-red-500" />
                <h2 className="text-3xl font-black mt-2">Run Over</h2>
                <p className={`text-6xl font-black mt-4 ${definition.accent}`}>{score}</p>
                <p className="text-sm opacity-70">Best {definition.name} score: {bestScores[difficulty]}</p>
              </div>
              <button onClick={() => startRun(difficulty)} className={`w-full ${definition.button} text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2`}><RotateCcw className="w-5 h-5" />Play Again</button>
            </div>
          )}
        </div>
      )}
      <AnimatePresence>
        {unlockNotice && (
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { y: -96, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: -96, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.42, ease: 'easeInOut' }}
            className="absolute inset-x-4 top-3 z-30 rounded-2xl border border-yellow-400/80 bg-slate-950/95 text-white shadow-xl shadow-yellow-500/20 px-4 py-3"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-300">New difficulty</p>
                <p className="text-sm font-black truncate">{unlockNotice}</p>
              </div>
              <button
                onClick={() => setUnlockNotice(null)}
                className="shrink-0 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1 text-xs font-black text-white transition-colors"
              >
                OK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {lockedNotice && (
        <div className="absolute inset-x-6 top-28 z-30 rounded-3xl border border-slate-400 bg-slate-950 text-white shadow-2xl p-5 animate-fade-in">
          <Lock className="w-9 h-9 mx-auto text-slate-300" />
          <p className="font-black mt-2">Difficulty Locked</p>
          <p className="text-sm text-slate-300 mt-1">{lockedNotice}</p>
          <button onClick={() => setLockedNotice(null)} className="mt-3 bg-teal-500 hover:bg-teal-400 border border-teal-300 text-white font-black px-5 py-2 rounded-xl transition-colors">Got it</button>
        </div>
      )}
      {(phase === 'result' || phase === 'gameOver') && shownError === 0 && (
        <div className="confetti">{Array.from({ length: 14 }, (_, index) => <span key={index} className="confetti-piece" />)}</div>
      )}
      <div className="mt-3 shrink-0 space-y-2 app-bottom-actions">
        {phase !== 'select' && (
          <button onClick={changeDifficulty} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-500 text-white font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors">
            <ShieldAlert className="w-5 h-5" />
            Change Difficulty
          </button>
        )}
        <button onClick={onBack} className="w-full app-secondary-action font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          All Games
        </button>
      </div>
    </div>
  );
}

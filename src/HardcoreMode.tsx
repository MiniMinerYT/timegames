import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, Lock, RotateCcw, ShieldAlert, Skull, Timer } from 'lucide-react';

const CARD_HEIGHT = 'h-[680px]';

export type HardcoreDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'god';
export type HardcoreScores = Record<HardcoreDifficulty, number>;

type HardcorePhase = 'select' | 'target' | 'countdown' | 'playing' | 'result' | 'gameOver';

interface DifficultyDefinition {
  id: HardcoreDifficulty;
  name: string;
  threshold: number;
  unlockText: string;
  panel: string;
  button: string;
  accent: string;
}

const difficulties: DifficultyDefinition[] = [
  { id: 'easy', name: 'Easy', threshold: 0.5, unlockText: 'Unlocked', panel: 'bg-teal-50 border-teal-200', button: 'bg-teal-500 hover:bg-teal-600', accent: 'text-teal-600' },
  { id: 'medium', name: 'Medium', threshold: 0.25, unlockText: 'Score 3 on Easy', panel: 'bg-amber-50 border-amber-200', button: 'bg-amber-500 hover:bg-amber-600', accent: 'text-amber-600' },
  { id: 'hard', name: 'Hard', threshold: 0.1, unlockText: 'Score 3 on Medium', panel: 'bg-red-50 border-red-200', button: 'bg-red-600 hover:bg-red-700', accent: 'text-red-600' },
  { id: 'expert', name: 'Expert', threshold: 0.05, unlockText: 'Score 3 on Hard', panel: 'bg-purple-950 border-red-800 text-white', button: 'bg-red-800 hover:bg-red-900', accent: 'text-red-400' },
  { id: 'god', name: 'GOD', threshold: 0, unlockText: 'Score 3 on Expert', panel: 'hardcore-god-panel border-yellow-500 text-white', button: 'bg-yellow-500 hover:bg-yellow-400 !text-black', accent: 'text-yellow-400' },
];

function isUnlocked(difficulty: HardcoreDifficulty, scores: HardcoreScores) {
  if (difficulty === 'easy') return true;
  if (difficulty === 'medium') return scores.easy >= 3;
  if (difficulty === 'hard') return scores.medium >= 3;
  if (difficulty === 'expert') return scores.hard >= 3;
  return scores.expert >= 3;
}

function generateTarget(score: number) {
  const [min, max] = score <= 4 ? [1, 4] : score <= 9 ? [2, 7] : [1, 10];
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

export default function HardcoreMode({
  bestScores,
  sounds,
  haptics,
  onBestScoreChange,
  onBack,
}: {
  bestScores: HardcoreScores;
  sounds: boolean;
  haptics: boolean;
  onBestScoreChange: (difficulty: HardcoreDifficulty, score: number) => void;
  onBack: () => void;
}) {
  const [difficulty, setDifficulty] = useState<HardcoreDifficulty>('easy');
  const [phase, setPhase] = useState<HardcorePhase>('select');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [target, setTarget] = useState(1);
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [passed, setPassed] = useState(false);
  const startRef = useRef<number | null>(null);

  const definition = difficulties.find(item => item.id === difficulty) ?? difficulties[0];

  const playTone = useCallback((frequency: number, duration = 0.08) => {
    if (!sounds) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = difficulty === 'god' ? 'sawtooth' : 'sine';
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

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown > 0) {
      playTone(400 + (3 - countdown) * 80, 0.05);
      const timer = window.setTimeout(() => setCountdown(value => value - 1), 1000);
      return () => window.clearTimeout(timer);
    }
    playTone(760, 0.08);
    if (haptics && 'vibrate' in navigator) navigator.vibrate(35);
    startRef.current = performance.now();
    setPhase('playing');
  }, [countdown, haptics, phase, playTone]);

  const startRun = (selected: HardcoreDifficulty) => {
    setDifficulty(selected);
    setScore(0);
    setLives(3);
    setTarget(generateTarget(0));
    setElapsed(null);
    setPhase('target');
  };

  const beginCountdown = () => {
    setCountdown(3);
    setPhase('countdown');
  };

  const stopTimer = () => {
    if (startRef.current === null) return;
    const rawElapsed = (performance.now() - startRef.current) / 1000;
    const shownElapsed = Math.round(rawElapsed * 100) / 100;
    const rawError = Math.abs(rawElapsed - target);
    const shownError = Math.round(Math.abs(shownElapsed - target) * 100) / 100;
    const success = difficulty === 'god' ? shownError === 0 : rawError <= definition.threshold;
    const nextScore = success ? score + 1 : score;
    const nextLives = success ? lives : lives - 1;

    setElapsed(shownElapsed);
    setPassed(success);
    setScore(nextScore);
    setLives(nextLives);
    playTone(success ? 900 : 180, 0.12);
    if (haptics && 'vibrate' in navigator) navigator.vibrate(success ? [25, 30, 25] : [50, 35, 50]);

    if (success && nextScore > bestScores[difficulty]) {
      onBestScoreChange(difficulty, nextScore);
    }
    setPhase(nextLives === 0 ? 'gameOver' : 'result');
  };

  const nextRound = () => {
    setTarget(generateTarget(score));
    setElapsed(null);
    setPhase('target');
  };

  const shownError = elapsed === null ? null : Math.round(Math.abs(elapsed - target) * 100) / 100;
  const visibleDifficulties = difficulties.filter(item => item.id !== 'god' || isUnlocked('god', bestScores));
  const screenTheme = difficulty === 'god'
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
    <div className={`${screenTheme} rounded-3xl shadow-xl p-6 text-center ${CARD_HEIGHT} flex flex-col ${inRun && difficulty !== 'easy' ? 'text-white' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={phase === 'select' ? onBack : () => setPhase('select')} aria-label="Back" className="w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:bg-white/20">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className={`text-xs uppercase tracking-[0.22em] font-black ${inRun ? definition.accent : 'text-red-600'}`}>Hardcore Mode</p>
          {inRun && <p className="font-black">{definition.name} · Best {bestScores[difficulty]}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl bg-red-600 flex items-center justify-center text-white">
          <Skull className="w-6 h-6" />
        </div>
      </div>

      {phase === 'select' ? (
        <div className="flex-1 min-h-0 overflow-y-auto always-scrollbar pr-1">
          <div className="mb-4">
            <h1 className="text-3xl font-black text-slate-800">Choose Difficulty</h1>
            <p className="text-sm text-slate-500 mt-1">Three lives. Endless rounds. No mercy.</p>
          </div>
          <div className="space-y-3">
            {visibleDifficulties.map(item => {
              const unlocked = isUnlocked(item.id, bestScores);
              return (
                <button key={item.id} disabled={!unlocked} onClick={() => startRun(item.id)} className={`w-full rounded-2xl border p-4 text-left transition-all ${item.panel} ${unlocked ? 'hover:scale-[1.01] active:scale-[0.99]' : 'opacity-55 cursor-not-allowed'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">{unlocked ? <ShieldAlert className="w-5 h-5" /> : <Lock className="w-5 h-5" />}</div>
                    <div className="flex-1">
                      <div className="flex justify-between gap-2"><p className="font-black text-lg">{item.name}</p><p className="font-black">Best {bestScores[item.id]}</p></div>
                      <p className="text-xs opacity-80">{item.id === 'god' ? 'Exact to 2 decimal places' : `Within ±${item.threshold.toFixed(2)}s`} · {unlocked ? 'Ready' : item.unlockText}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto always-scrollbar pr-1 flex flex-col">
          <div className="flex items-center justify-between bg-white/10 border border-white/10 rounded-2xl px-4 py-3 mb-4">
            <p className="font-black">Score {score}</p>
            <div className="flex gap-1" aria-label={`${lives} lives remaining`}>
              {Array.from({ length: 3 }, (_, index) => <Heart key={index} className={`w-6 h-6 ${index < lives ? 'fill-red-500 text-red-500' : 'text-slate-600'}`} />)}
            </div>
          </div>

          {phase === 'target' && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-5">
              <p className={`text-sm uppercase tracking-[0.25em] font-black ${definition.accent}`}>Your target</p>
              <p className="text-7xl font-black">{target.toFixed(2)}s</p>
              <p className="text-sm opacity-70">Memorise it. The clock will stay hidden.</p>
              <button onClick={beginCountdown} className={`w-full ${definition.button} text-white font-black py-4 rounded-2xl text-lg transition-all active:scale-[0.98]`}>Start Round</button>
            </div>
          )}

          {phase === 'countdown' && <div className="flex-1 flex items-center justify-center"><p className="text-8xl font-black">{countdown > 0 ? countdown : ''}</p></div>}

          {phase === 'playing' && (
            <div className="flex-1 flex flex-col items-center justify-center space-y-7">
              <Timer className={`w-16 h-16 ${definition.accent}`} />
              <p className="font-bold opacity-70">Target hidden. Trust your timing.</p>
              <button onClick={stopTimer} className={`w-44 h-44 rounded-full ${definition.button} text-white text-3xl font-black shadow-2xl transition-all active:scale-95`}>STOP</button>
            </div>
          )}

          {phase === 'result' && elapsed !== null && shownError !== null && (
            <div className="flex-1 flex flex-col justify-center space-y-5">
              <div className={`rounded-3xl border p-5 ${passed ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-red-500/15 border-red-500/40'}`}>
                <p className="text-2xl font-black">{passed ? '+1 · Round cleared' : 'Miss · Life lost'}</p>
                <p className="text-5xl font-black mt-3">{elapsed.toFixed(2)}s</p>
                <p className="font-bold opacity-70 mt-1">{shownError.toFixed(2)}s off · Target {target.toFixed(2)}s</p>
              </div>
              <button onClick={nextRound} className={`w-full ${definition.button} text-white font-black py-4 rounded-2xl`}>Next Target</button>
            </div>
          )}

          {phase === 'gameOver' && elapsed !== null && shownError !== null && (
            <div className="flex-1 flex flex-col justify-center space-y-5">
              <div className="rounded-3xl bg-red-500/15 border border-red-500/40 p-6">
                <Skull className="w-12 h-12 mx-auto text-red-500" />
                <h2 className="text-3xl font-black mt-2">Run Over</h2>
                <p className={`text-6xl font-black mt-4 ${definition.accent}`}>{score}</p>
                <p className="text-sm opacity-70">Best {definition.name} score: {bestScores[difficulty]}</p>
              </div>
              <button onClick={() => startRun(difficulty)} className={`w-full ${definition.button} text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2`}><RotateCcw className="w-5 h-5" />Play Again</button>
              <button onClick={() => setPhase('select')} className="w-full bg-white/10 border border-white/10 font-black py-4 rounded-2xl">Change Difficulty</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

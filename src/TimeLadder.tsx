import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Flag, RotateCcw, Timer, TrendingUp } from 'lucide-react';

const CARD_HEIGHT = 'h-[680px]';
const FINAL_LEVEL = 20;
const TOLERANCE = 0.25;

type LadderPhase = 'ready' | 'countdown' | 'playing' | 'result';

interface TimeLadderProps {
  bestLevel: number;
  sounds: boolean;
  haptics: boolean;
  onBestLevelChange: (level: number) => void;
  onBack: () => void;
}

export default function TimeLadder({
  bestLevel,
  sounds,
  haptics,
  onBestLevelChange,
  onBack,
}: TimeLadderProps) {
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<LadderPhase>('ready');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const startRef = useRef<number | null>(null);

  const playTone = useCallback((frequency: number, duration = 0.08) => {
    if (!sounds) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.07, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      // Audio feedback is optional and may be blocked by the browser.
    }
  }, [sounds]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown > 0) {
      playTone(420, 0.05);
      const timer = window.setTimeout(() => setCountdown(value => value - 1), 1000);
      return () => window.clearTimeout(timer);
    }

    playTone(720, 0.08);
    if (haptics && 'vibrate' in navigator) navigator.vibrate(35);
    startRef.current = performance.now();
    setPhase('playing');
  }, [countdown, haptics, phase, playTone]);

  const startLevel = () => {
    setCountdown(3);
    setElapsed(null);
    setSuccess(false);
    setPhase('countdown');
  };

  const stopTimer = () => {
    if (startRef.current === null) return;
    const measured = Math.round(((performance.now() - startRef.current) / 1000) * 100) / 100;
    const passed = Math.abs(measured - level) <= TOLERANCE;
    setElapsed(measured);
    setSuccess(passed);
    setPhase('result');
    playTone(passed ? 880 : 220, 0.12);
    if (haptics && 'vibrate' in navigator) navigator.vibrate(passed ? [25, 35, 25] : [45, 30, 45]);
    if (passed && level > bestLevel) onBestLevelChange(level);
  };

  const continueRun = () => {
    if (level >= FINAL_LEVEL) {
      setLevel(1);
      setPhase('ready');
      return;
    }
    setLevel(value => value + 1);
    setCountdown(3);
    setElapsed(null);
    setSuccess(false);
    setPhase('countdown');
  };

  const restartRun = () => {
    setLevel(1);
    setElapsed(null);
    setSuccess(false);
    setPhase('ready');
  };

  const error = elapsed === null ? null : Math.abs(elapsed - level);

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} aria-label="Back to TimeGames" className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-black text-indigo-500">Time Ladder</p>
          <p className="text-sm font-bold text-slate-500">Best: Level {bestLevel}</p>
        </div>
        <div className="w-11 h-11 rounded-xl bg-indigo-500 flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto always-scrollbar pr-1">
        <div className="bg-gradient-to-br from-indigo-50 to-teal-50 border border-indigo-100 rounded-3xl p-5 mb-4">
          <p className="text-sm font-bold text-slate-500">Level {level} of {FINAL_LEVEL}</p>
          <p className="text-6xl font-black text-indigo-600 my-2">{level.toFixed(2)}s</p>
          <p className="text-sm text-slate-500">Stop within ±{TOLERANCE.toFixed(2)}s to climb.</p>
          <div className="h-2 bg-white/80 rounded-full overflow-hidden mt-4">
            <div className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${(level / FINAL_LEVEL) * 100}%` }} />
          </div>
        </div>

        {phase === 'ready' && (
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-10 gap-2" aria-label="Ladder progress">
              {Array.from({ length: FINAL_LEVEL }, (_, index) => index + 1).map(step => (
                <div key={step} className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-black ${step <= bestLevel ? 'bg-teal-500 text-white' : step === level ? 'bg-indigo-500 text-white ring-4 ring-indigo-100' : 'bg-slate-100 text-slate-400'}`}>
                  {step}
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-sm">One miss ends the run. The clock stays hidden.</p>
            <button onClick={startLevel} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl text-lg transition-all active:scale-[0.98]">
              Start Climb
            </button>
          </div>
        )}

        {phase === 'countdown' && (
          <div className="h-[250px] flex items-center justify-center">
            <span className="text-8xl font-black text-slate-800">{countdown > 0 ? countdown : ''}</span>
          </div>
        )}

        {phase === 'playing' && (
          <div className="space-y-7 py-7">
            <div className="w-24 h-24 mx-auto rounded-full bg-teal-500 shadow-xl shadow-teal-500/25 flex items-center justify-center">
              <Timer className="w-12 h-12 text-white" />
            </div>
            <p className="font-bold text-slate-700">Trust your internal clock.</p>
            <button onClick={stopTimer} className="w-40 h-40 mx-auto rounded-full bg-rose-500 hover:bg-rose-600 text-white text-3xl font-black shadow-xl shadow-rose-500/25 transition-all active:scale-95">
              STOP
            </button>
          </div>
        )}

        {phase === 'result' && elapsed !== null && error !== null && (
          <div className="space-y-4 py-2">
            <div className={`rounded-3xl border p-5 ${success ? 'bg-teal-50 border-teal-200' : 'bg-rose-50 border-rose-200'}`}>
              <Flag className={`w-9 h-9 mx-auto mb-2 ${success ? 'text-teal-600' : 'text-rose-600'}`} />
              <h2 className="text-2xl font-black text-slate-800">{success ? level === FINAL_LEVEL ? 'Ladder complete!' : 'Level cleared!' : 'Run over'}</h2>
              <p className="text-4xl font-black text-indigo-600 mt-3">{elapsed.toFixed(2)}s</p>
              <p className="text-sm font-bold text-slate-500 mt-1">{error.toFixed(2)}s off target</p>
            </div>
            {success ? (
              <button onClick={continueRun} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl transition-colors">
                {level === FINAL_LEVEL ? 'Finish Run' : `Climb to Level ${level + 1}`}
              </button>
            ) : (
              <button onClick={restartRun} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Try a New Run
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

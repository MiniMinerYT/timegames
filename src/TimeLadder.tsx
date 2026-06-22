import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, TrendingUp } from 'lucide-react';

const CARD_HEIGHT = 'h-[680px]';
const FINAL_LEVEL = 20;
const TOLERANCE = 0.25;

type LadderPhase = 'ready' | 'playing' | 'result';

export default function TimeLadder({
  bestLevel,
  sounds,
  haptics,
  onBestLevelChange,
  onBack,
}: {
  bestLevel: number;
  sounds: boolean;
  haptics: boolean;
  onBestLevelChange: (level: number) => void;
  onBack: () => void;
}) {
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<LadderPhase>('ready');
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
      // Optional browser audio feedback.
    }
  }, [sounds]);

  const startLevel = () => {
    setElapsed(null);
    setSuccess(false);
    startRef.current = performance.now();
    setPhase('playing');
    playTone(720, 0.08);
    if (haptics && 'vibrate' in navigator) navigator.vibrate(35);
  };

  const stopTimer = () => {
    if (startRef.current === null) return;
    const measured = Math.round(((performance.now() - startRef.current) / 1000) * 100) / 100;
    const difference = Math.abs(measured - level);
    const passed = difference <= TOLERANCE;
    setElapsed(measured);
    setSuccess(passed);
    setPhase('result');
    playTone(passed ? 880 : 220, 0.12);
    if (difference < 0.005) {
      window.setTimeout(() => playTone(1100, 0.1), 90);
      window.setTimeout(() => playTone(1320, 0.16), 180);
    }
    if (haptics && 'vibrate' in navigator) navigator.vibrate(passed ? [25, 35, 25] : [45, 30, 45]);
    if (passed && level > bestLevel) onBestLevelChange(level);
  };

  const continueRun = () => {
    if (level >= FINAL_LEVEL) {
      setLevel(1);
    } else {
      setLevel(value => value + 1);
    }
    setElapsed(null);
    setSuccess(false);
    setPhase('ready');
  };

  const restartRun = () => {
    setLevel(1);
    setElapsed(null);
    setSuccess(false);
    setPhase('ready');
  };

  useEffect(() => {
    const handleSpace = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'BUTTON') return;
      event.preventDefault();
      if (phase === 'ready') startLevel();
      else if (phase === 'playing') stopTimer();
      else if (success) continueRun();
      else restartRun();
    };
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  });

  const difference = elapsed === null ? null : Math.abs(elapsed - level);

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="text-center space-y-1 mb-2">
        <div className="w-11 h-11 mx-auto rounded-xl bg-indigo-500 flex items-center justify-center"><TrendingUp className="w-6 h-6 text-white" /></div>
        <h1 className="text-2xl font-black text-slate-800">Time Ladder</h1>
        <p className="text-xs text-slate-500">Climb from 1 to 20 seconds. One miss ends the run.</p>
        <p className="text-xs font-black text-indigo-600">Best level: {bestLevel}</p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center gap-2">
        <div key={level} className="w-full flex-1 min-h-0 flex flex-col items-center justify-center transition-all duration-500">
          <div className="w-[74%] rounded-xl border border-slate-200 bg-slate-100 text-slate-400 py-2">
            <p className="text-[10px] uppercase tracking-wider font-black">Previous</p>
            <p className="text-sm font-black">{level > 1 ? `Level ${level - 1} · ${(level - 1).toFixed(2)}s` : 'Start of ladder'}</p>
          </div>
          <div className="w-1 h-3 bg-slate-200" />
          <div className={`w-full rounded-3xl border-2 p-3 shadow-lg transition-colors ${phase === 'result' ? success ? 'bg-teal-50 border-teal-300' : 'bg-rose-50 border-rose-300' : 'bg-indigo-500 border-indigo-500 text-white'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-left"><p className="text-[10px] uppercase tracking-wider font-black opacity-70">Current level</p><p className="text-2xl font-black">Level {level}</p></div>
              <div className="text-right"><p className="text-[10px] uppercase tracking-wider font-black opacity-70">Target</p><p className="text-3xl font-black">{level.toFixed(2)}s</p></div>
            </div>
            {phase === 'result' && elapsed !== null && difference !== null && (
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-current/20">
                <div><p className="text-[10px] font-bold opacity-70">Actual</p><p className="font-black">{elapsed.toFixed(2)}s</p></div>
                <div><p className="text-[10px] font-bold opacity-70">Difference</p><p className="font-black">{difference.toFixed(2)}s</p></div>
                <div><p className="text-[10px] font-bold opacity-70">Result</p><p className={`font-black ${success ? 'text-teal-700' : 'text-rose-700'}`}>{success ? 'Passed' : 'Failed'}</p></div>
              </div>
            )}
          </div>
          <div className="w-1 h-3 bg-slate-200" />
          <div className="w-[74%] rounded-xl border border-slate-200 bg-slate-100 text-slate-400 py-2">
            <p className="text-[10px] uppercase tracking-wider font-black">Next</p>
            <p className="text-sm font-black">{level < FINAL_LEVEL ? `Level ${level + 1} · ${(level + 1).toFixed(2)}s` : 'Top of ladder'}</p>
          </div>
        </div>

        {(phase === 'ready' || phase === 'playing') && (
          <button onClick={phase === 'ready' ? startLevel : stopTimer} className={`w-32 h-32 shrink-0 rounded-full text-white text-2xl font-black shadow-xl transition-all active:scale-95 ${phase === 'ready' ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-rose-500 hover:bg-rose-600'}`}>
            {phase === 'ready' ? 'START' : 'STOP'}
          </button>
        )}
        {phase === 'result' && (
          <button onClick={success ? continueRun : restartRun} className="w-full shrink-0 bg-indigo-500 hover:bg-indigo-600 text-white font-black py-3 rounded-2xl transition-colors flex items-center justify-center gap-2">
            {!success && <RotateCcw className="w-5 h-5" />}
            {success ? level === FINAL_LEVEL ? 'Finish Run · Space' : 'Next Level · Space' : 'Try a New Run · Space'}
          </button>
        )}
      </div>

      <button onClick={onBack} className="mt-3 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors">
        <ArrowLeft className="w-5 h-5" />All Games
      </button>
    </div>
  );
}

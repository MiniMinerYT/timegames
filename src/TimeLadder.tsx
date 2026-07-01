import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion } from 'framer-motion';
import { ArrowLeft, Check, Sparkles, Trophy } from 'lucide-react';
import LadderIcon from './LadderIcon';
import { triggerHaptic } from './haptics';

const CARD_HEIGHT = 'app-card';
const FINAL_LEVEL = 20;
const TOLERANCE = 0.25;
const LADDER_VIEWPORT_HEIGHT = 250;
const LADDER_RUNG_HEIGHT = 84;
const LADDER_FOCUS_OFFSET = (LADDER_VIEWPORT_HEIGHT - LADDER_RUNG_HEIGHT) / 2;
const LADDER_LEVELS = Array.from({ length: FINAL_LEVEL }, (_, index) => FINAL_LEVEL - index);

type LadderPhase = 'ready' | 'playing' | 'result';
type LadderRunResult = {
  elapsed: number;
  difference: number;
  success: boolean;
  spotOn: boolean;
};

export default function TimeLadder({
  bestLevel,
  sounds,
  haptics,
  reducedMotion,
  nativeControls,
  desktopMode = false,
  onTimingChange,
  onBestLevelChange,
  onSpotOn,
  onBack,
}: {
  bestLevel: number;
  sounds: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  nativeControls: boolean;
  desktopMode?: boolean;
  onTimingChange: (active: boolean) => void;
  onBestLevelChange: (level: number) => void;
  onSpotOn: () => void;
  onBack: () => void;
}) {
  const [level, setLevel] = useState(1);
  const [phase, setPhase] = useState<LadderPhase>('ready');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [bestCelebration, setBestCelebration] = useState(false);
  const [instantReset, setInstantReset] = useState(false);
  const [rewinding, setRewinding] = useState(false);
  const [runResults, setRunResults] = useState<Record<number, LadderRunResult>>({});
  const startRef = useRef<number | null>(null);
  const ladderScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimationRef = useRef<{ stop: () => void } | null>(null);

  const focusLevelInView = useCallback((targetLevel: number, duration = 0.75) => {
    const scroller = ladderScrollRef.current;
    if (!scroller) return;
    const targetScrollTop = (FINAL_LEVEL - targetLevel) * LADDER_RUNG_HEIGHT;

    scrollAnimationRef.current?.stop();

    if (reducedMotion || duration <= 0) {
      scroller.scrollTop = targetScrollTop;
      return;
    }

    scrollAnimationRef.current = animate(scroller.scrollTop, targetScrollTop, {
      duration,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: value => {
        scroller.scrollTop = value;
      },
    });
  }, [reducedMotion]);

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
    window.requestAnimationFrame(() => {
      focusLevelInView(level, 0.42);
    });
    setElapsed(null);
    setSuccess(false);
    startRef.current = performance.now();
    setPhase('playing');
    onTimingChange(true);
    playTone(720, 0.08);
    triggerHaptic(haptics, 35);
  };

  const stopTimer = () => {
    if (startRef.current === null) return;
    const measured = Math.round(((performance.now() - startRef.current) / 1000) * 100) / 100;
    const difference = Math.abs(measured - level);
    const passed = difference <= TOLERANCE;
    const spotOn = difference < 0.005;
    onTimingChange(false);
    setElapsed(measured);
    setSuccess(passed);
    setPhase('result');
    setRunResults(previous => ({
      ...previous,
      [level]: { elapsed: measured, difference, success: passed, spotOn },
    }));
    playTone(passed ? 880 : 220, 0.12);
    if (spotOn) {
      onSpotOn();
      window.setTimeout(() => playTone(1100, 0.1), 90);
      window.setTimeout(() => playTone(1320, 0.16), 180);
    }
    triggerHaptic(haptics, passed ? [25, 35, 25] : [45, 30, 45]);
    if (passed && level > bestLevel) {
      setBestCelebration(true);
      onBestLevelChange(level);
    }
    if (passed && level === FINAL_LEVEL) {
      setCompleted(true);
      [1047, 1319, 1568, 2093].forEach((frequency, index) => {
        window.setTimeout(() => playTone(frequency, 0.22), index * 130);
      });
      triggerHaptic(haptics, [60, 40, 60, 40, 120]);
    }
  };

  const continueRun = () => {
    if (level >= FINAL_LEVEL) {
      setInstantReset(true);
      setLevel(1);
      setRunResults({});
      window.requestAnimationFrame(() => focusLevelInView(1, 0));
    } else {
      const nextLevel = level + 1;
      setLevel(nextLevel);
      window.requestAnimationFrame(() => focusLevelInView(nextLevel, 0.78));
    }
    setElapsed(null);
    setSuccess(false);
    setBestCelebration(false);
    setCompleted(false);
    setPhase('ready');
  };

  const restartRun = () => {
    if (level > 1 && !reducedMotion) {
      setRewinding(true);
    } else {
      setInstantReset(true);
    }
    setLevel(1);
    setElapsed(null);
    setSuccess(false);
    setRunResults({});
    setBestCelebration(false);
    setCompleted(false);
    setPhase('ready');
    window.requestAnimationFrame(() => focusLevelInView(1, reducedMotion ? 0 : Math.min(1.45, 0.7 + Math.max(0, level - 1) * 0.07)));
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

  useEffect(() => () => onTimingChange(false), [onTimingChange]);

  useEffect(() => {
    if (!instantReset) return;
    const frame = window.requestAnimationFrame(() => setInstantReset(false));
    return () => window.cancelAnimationFrame(frame);
  }, [instantReset]);

  useEffect(() => {
    focusLevelInView(1, 0);
    return () => scrollAnimationRef.current?.stop();
  }, [focusLevelInView]);

  const difference = elapsed === null ? null : Math.abs(elapsed - level);

  return (
    <div className={`time-ladder-card bg-white rounded-3xl shadow-xl p-5 text-center ${CARD_HEIGHT} flex flex-col relative overflow-hidden`}>
      <div className="text-center space-y-0.5 mb-1">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500 flex items-center justify-center"><LadderIcon className="w-8 h-8 text-white" /></div>
        <h1 className="text-2xl font-black text-slate-800">Time Ladder</h1>
        <p className="text-xs text-slate-500">Climb 1–20 seconds · Get within ±{TOLERANCE.toFixed(2)}s · One miss ends the run.</p>
        <p className="text-xs font-black text-indigo-600">Best level: {bestLevel}</p>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-start gap-2 pt-1 px-1">
        <div
          data-guide-id="ladder-scroll-lane"
          ref={ladderScrollRef}
          className="relative w-full h-[250px] shrink-0 overflow-y-auto overflow-x-hidden card-scroll rounded-2xl"
          aria-label="Scrollable ladder progress"
        >
          <motion.div
            className="relative w-full pointer-events-none px-5"
            style={{
              paddingTop: LADDER_FOCUS_OFFSET,
              paddingBottom: LADDER_FOCUS_OFFSET,
            }}
            initial={false}
            animate={rewinding && !reducedMotion ? { filter: ['blur(0px)', 'blur(0.8px)', 'blur(0px)'] } : { filter: 'blur(0px)' }}
            transition={{ duration: rewinding && !reducedMotion ? 0.7 : 0 }}
            onAnimationComplete={() => {
              if (rewinding) setRewinding(false);
            }}
          >
            {LADDER_LEVELS.map(rungLevel => {
              const isCurrent = rungLevel === level;
              const currentResult = isCurrent && phase === 'result' && elapsed !== null && difference !== null
                ? { elapsed, difference, success, spotOn: difference < 0.005 }
                : null;
              const displayResult = currentResult ?? runResults[rungLevel] ?? null;
              const isCompleted = Boolean(displayResult?.success) || rungLevel < level;
              const isResult = Boolean(displayResult);
              const isSpotOn = Boolean(displayResult?.spotOn);
              const rungClass = isCurrent
                ? isSpotOn
                  ? 'bg-teal-50 border-yellow-400 text-teal-950 ring-2 ring-yellow-300 shadow-yellow-400/35'
                  : isResult
                  ? success ? 'bg-teal-50 border-teal-400' : 'bg-rose-50 border-rose-400'
                  : 'bg-indigo-500 border-indigo-400 text-white'
                : isCompleted
                  ? isSpotOn
                    ? 'bg-teal-50 border-yellow-400 text-teal-900 ring-1 ring-yellow-300 shadow-yellow-400/25'
                    : 'bg-teal-50 border-teal-200 text-teal-800'
                  : 'bg-slate-100 border-slate-200 text-slate-400 opacity-55';
              const rungAnimate = isCurrent && isResult && !reducedMotion
                ? success
                  ? isSpotOn ? { scale: [1.05, 1.13, 1.05], x: 0, rotate: [0, -1, 1, 0] } : { scale: [1.04, 1.085, 1.04], x: 0 }
                  : { scale: 1.04, x: [0, -6, 6, -3, 0] }
                : { scale: isCurrent ? 1.04 : 1, x: 0 };

              return (
                <div key={rungLevel} className="h-[84px] relative flex items-center justify-center px-4">
                  <motion.div
                    data-guide-id={isCurrent ? 'ladder-rung-active' : undefined}
                    className={`relative z-10 w-full h-[66px] rounded-2xl border-2 px-3 py-1.5 shadow-sm flex flex-col justify-center overflow-hidden ${rungClass}`}
                    initial={false}
                    animate={rungAnimate}
                    transition={reducedMotion ? { duration: 0 } : { duration: isResult ? 0.42 : 0.3, ease: 'easeInOut' }}
                  >
                    <div className={`flex items-center justify-between gap-3 min-h-0 transition-transform ${displayResult ? '-translate-y-1' : 'translate-y-0'}`}>
                      <div className="text-left">
                        <p className="text-[9px] uppercase tracking-wider font-black opacity-70">{isCurrent ? 'Current level' : displayResult ? displayResult.success ? 'Completed' : 'Failed' : 'Ahead'}</p>
                        <p className="text-lg font-black leading-tight">Level {rungLevel}</p>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        {isCompleted && <Check className={`w-5 h-5 ${isSpotOn ? 'text-yellow-500' : 'text-teal-600'}`} />}
                        <div><p className="text-[9px] uppercase tracking-wider font-black opacity-70">Target</p><p className="text-xl font-black leading-tight">{rungLevel.toFixed(2)}s</p></div>
                      </div>
                    </div>
                    <div className={`absolute inset-x-3 bottom-1 border-t pt-0.5 text-[9px] font-black leading-none truncate ${displayResult ? 'border-current/20 opacity-100' : 'border-transparent opacity-0'}`}>
                      {displayResult ? (
                        <>
                          <span>{displayResult.elapsed.toFixed(2)}s</span>
                          <span className="opacity-50"> · </span>
                          <span className={displayResult.spotOn ? 'text-yellow-500' : ''}>{displayResult.spotOn ? 'Spot On' : `${displayResult.difference.toFixed(2)}s off`}</span>
                          <span className="opacity-50"> · </span>
                          <span className={displayResult.success ? 'text-teal-700' : 'text-rose-700'}>{displayResult.success ? 'Passed' : 'Failed'}</span>
                        </>
                      ) : (
                        '0.00s · 0.00s off · Passed'
                      )}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </motion.div>
        </div>

        <motion.button
          data-guide-id="ladder-main-button"
          onClick={phase === 'ready' ? startLevel : phase === 'playing' ? stopTimer : success ? continueRun : restartRun}
          className={`relative z-20 pointer-events-auto w-48 h-48 shrink-0 rounded-full text-white text-2xl font-black shadow-xl transition-colors ${phase === 'ready' ? 'bg-emerald-500 hover:bg-emerald-600' : phase === 'playing' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-500 hover:bg-indigo-600'}`}
          whileTap={reducedMotion ? undefined : { scale: 0.96 }}
          animate={bestCelebration && phase === 'result' && !reducedMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          {phase === 'ready' ? 'START' : phase === 'playing' ? 'STOP' : success ? level === FINAL_LEVEL ? 'FINISH' : 'NEXT' : 'START'}
          {phase === 'result' && !success && <span className="block text-xs tracking-wider mt-0.5">NEW RUN</span>}
          <span className="block text-[10px] tracking-wider mt-1 opacity-80">{nativeControls ? 'TAP WHEN READY' : 'OR SPACE'}</span>
        </motion.button>
      </div>

      {!desktopMode && <button onClick={onBack} className="mt-3 w-full shrink-0 app-secondary-action font-black py-3 rounded-2xl flex items-center justify-center gap-2 transition-colors app-bottom-actions">
        <ArrowLeft className="w-5 h-5" />All Games
      </button>}

      {phase === 'result' && difference !== null && difference < 0.005 && (
        <div className="confetti">{Array.from({ length: 14 }, (_, index) => <span key={index} className="confetti-piece" />)}</div>
      )}

      {completed && (
        <div className="absolute inset-0 z-30 rounded-3xl bg-gradient-to-br from-indigo-950 via-purple-950 to-amber-950 text-white p-6 flex flex-col items-center justify-center overflow-hidden ladder-victory">
          <div className="confetti">{Array.from({ length: 14 }, (_, index) => <span key={index} className="confetti-piece" />)}</div>
          <div className="confetti ladder-confetti-secondary">{Array.from({ length: 14 }, (_, index) => <span key={index} className="confetti-piece" />)}</div>
          <Sparkles className="absolute top-16 left-12 w-10 h-10 text-yellow-300" />
          <Sparkles className="absolute top-28 right-10 w-8 h-8 text-teal-300" />
          <Trophy className="w-24 h-24 text-yellow-300 drop-shadow-2xl relative z-10" />
          <p className="text-xs uppercase tracking-[0.35em] font-black text-yellow-300 mt-4 relative z-10">Legendary Timing</p>
          <h2 className="text-4xl font-black mt-2 relative z-10">LADDER CONQUERED</h2>
          <p className="text-indigo-100 mt-3 relative z-10">All 20 levels. No misses. That is seriously impressive.</p>
          <button onClick={continueRun} className="mt-8 w-44 h-44 rounded-full bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xl font-black shadow-2xl shadow-yellow-400/30 relative z-10">CLIMB AGAIN</button>
          <button onClick={() => setCompleted(false)} className="mt-4 text-sm font-black text-white/90 hover:text-white relative z-10">Review Run</button>
          {!desktopMode && <button onClick={onBack} className="mt-5 text-sm font-black text-white/80 hover:text-white relative z-10">All Games</button>}
        </div>
      )}
    </div>
  );
}

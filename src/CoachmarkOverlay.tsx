import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, X } from 'lucide-react';

export interface CoachmarkStep {
  targetId: string;
  title: string;
  body: string;
  hint?: string;
}

export interface CoachmarkGuide {
  id: string;
  eyebrow: string;
  steps: CoachmarkStep[];
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTargetRect(targetId: string): TargetRect | null {
  const element = document.querySelector<HTMLElement>(`[data-guide-id="${targetId}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export default function CoachmarkOverlay({
  guide,
  reducedMotion,
  onComplete,
}: {
  guide: CoachmarkGuide;
  reducedMotion: boolean;
  onComplete: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const step = guide.steps[stepIndex];
  const isLast = stepIndex === guide.steps.length - 1;
  const advance = useCallback(() => {
    if (isLast) onComplete();
    else setStepIndex(index => index + 1);
  }, [isLast, onComplete]);

  useEffect(() => {
    setStepIndex(0);
  }, [guide.id]);

  useLayoutEffect(() => {
    const element = document.querySelector<HTMLElement>(`[data-guide-id="${step.targetId}"]`);
    element?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });

    const update = () => setTargetRect(getTargetRect(step.targetId));
    const timeout = window.setTimeout(update, reducedMotion ? 0 : 180);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [reducedMotion, step.targetId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onComplete();
      if (event.key === 'Enter') {
        advance();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance, onComplete]);

  const padded = targetRect
    ? {
        top: Math.max(8, targetRect.top - 8),
        left: Math.max(8, targetRect.left - 8),
        width: targetRect.width + 16,
        height: targetRect.height + 16,
      }
    : null;
  const bubbleBelow = !padded || padded.top + padded.height < window.innerHeight * 0.58;
  const bubbleTop = padded
    ? bubbleBelow
      ? Math.min(window.innerHeight - 212, padded.top + padded.height + 18)
      : Math.max(18, padded.top - 194)
    : window.innerHeight * 0.5 - 96;
  const bubbleLeft = Math.min(
    window.innerWidth - 340,
    Math.max(14, (padded ? padded.left + padded.width / 2 : window.innerWidth / 2) - 160)
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={guide.id}
        className="fixed inset-0 z-[80] pointer-events-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={advance}
      >
        {padded && (
          <motion.div
            key={`${guide.id}-${step.targetId}`}
            className="coachmark-target-ring fixed rounded-[1.6rem] border-2 border-teal-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.62),0_0_34px_rgba(45,212,191,0.75)] pointer-events-none"
            initial={false}
            animate={{
              opacity: 1,
              scale: 1,
              top: padded.top,
              left: padded.left,
              width: padded.width,
              height: padded.height,
            }}
            transition={{ duration: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}
          />
        )}

        <motion.div
          key={`${guide.id}-${stepIndex}`}
          className="fixed w-[min(20rem,calc(100vw-1.75rem))] rounded-3xl border border-white/15 bg-white p-4 text-left shadow-2xl"
          style={{ top: bubbleTop, left: bubbleLeft }}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: bubbleBelow ? 12 : -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: bubbleBelow ? -10 : 10, scale: 0.98 }}
          transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="coachmark-title"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-teal-600">{guide.eyebrow}</p>
              <h2 id="coachmark-title" className="mt-1 text-xl font-black leading-tight text-slate-900">{step.title}</h2>
            </div>
            <button type="button" onClick={onComplete} aria-label="Close guide" className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
          {step.hint && <p className="mt-2 text-xs font-bold text-teal-600">{step.hint}</p>}

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {guide.steps.map((item, index) => (
                <button
                  key={item.targetId}
                  type="button"
                  aria-label={`Go to guide step ${index + 1}`}
                  onClick={() => setStepIndex(index)}
                  className={`h-2 rounded-full transition-all ${index === stepIndex ? 'w-7 bg-teal-500' : 'w-2 bg-slate-200'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStepIndex(index => Math.max(0, index - 1))}
                disabled={stepIndex === 0}
                className="px-3 py-2 rounded-xl app-secondary-action text-xs font-black disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  advance();
                }}
                className="px-4 py-2 rounded-xl bg-teal-500 text-white text-xs font-black shadow-lg shadow-teal-500/25"
              >
                {isLast ? 'Got it' : 'Next'}
              </button>
            </div>
          </div>

          {padded && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 text-teal-300 ${bubbleBelow ? '-top-6' : '-bottom-6'}`}
              aria-hidden="true"
            >
              {bubbleBelow ? <ArrowUp className="w-7 h-7 drop-shadow-lg" /> : <ArrowDown className="w-7 h-7 drop-shadow-lg" />}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

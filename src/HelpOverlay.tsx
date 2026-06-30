import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, X } from 'lucide-react';

export interface HelpContent {
  title: string;
  intro: string;
  items: string[];
  objective?: string;
  steps?: Array<{
    title: string;
    body: string;
  }>;
  tips?: string[];
}

export default function HelpOverlay({ content, triggerVisible = true }: { content: HelpContent; triggerVisible?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [content.title]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`About ${content.title}`}
        className={`help-trigger absolute left-4 z-40 w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-600 shadow-md flex items-center justify-center hover:bg-slate-100 transition-all duration-300 ${triggerVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center app-modal-safe-padding"
          onClick={() => setOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            className="w-full max-w-md max-h-full bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={event => event.stopPropagation()}
            initial={{ y: 18, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 14, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="shrink-0 flex items-start gap-3 p-5 border-b border-slate-200">
              <div className="w-11 h-11 rounded-2xl bg-teal-500 text-white flex items-center justify-center shrink-0">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-[0.22em] font-black text-teal-600">How it works</p>
                <h2 id="help-title" className="text-2xl font-black text-slate-800">{content.title}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto card-scroll p-5 text-left">
              <p className="text-slate-600 leading-relaxed">{content.intro}</p>
              {content.objective && (
                <div className="mt-4 rounded-2xl bg-teal-50 border border-teal-200 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-teal-700">Your goal</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{content.objective}</p>
                </div>
              )}
              <div className="mt-5 space-y-3">
                {(content.steps ?? content.items.map(item => ({ title: '', body: item }))).map((step, index) => (
                  <motion.div
                    key={`${step.title}-${step.body}`}
                    className="flex gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-3"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.035 }}
                  >
                    <span className="w-7 h-7 rounded-full bg-teal-500 text-white text-xs font-black flex items-center justify-center shrink-0">{index + 1}</span>
                    <div className="pt-0.5">
                      {step.title && <p className="text-sm font-black text-slate-800 leading-tight">{step.title}</p>}
                      <p className="text-sm text-slate-700 leading-relaxed">{step.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              {content.tips?.length ? (
                <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-amber-700">Good to know</p>
                  <ul className="mt-2 space-y-1.5">
                    {content.tips.map(tip => (
                      <li key={tip} className="text-sm text-slate-700 leading-relaxed">• {tip}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </motion.section>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}

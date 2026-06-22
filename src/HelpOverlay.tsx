import { useEffect, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface HelpContent {
  title: string;
  intro: string;
  items: string[];
}

export default function HelpOverlay({ content }: { content: HelpContent }) {
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
        className="absolute top-4 left-4 z-40 w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-600 shadow-md flex items-center justify-center hover:bg-slate-100 transition-colors"
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {open && (
        <div
          className="absolute inset-0 z-[70] h-[680px] rounded-3xl bg-slate-950/60 p-4 flex"
          onClick={() => setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            className="w-full h-full max-h-[648px] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={event => event.stopPropagation()}
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
              <div className="mt-5 space-y-3">
                {content.items.map((item, index) => (
                  <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-3">
                    <span className="w-7 h-7 rounded-full bg-teal-500 text-white text-xs font-black flex items-center justify-center shrink-0">{index + 1}</span>
                    <p className="text-sm text-slate-700 leading-relaxed pt-0.5">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

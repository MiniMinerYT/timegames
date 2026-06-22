import { useEffect } from 'react';

const NOTES = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];

export default function AmbientMusic({ enabled, paused }: { enabled: boolean; paused: boolean }) {
  useEffect(() => {
    if (!enabled || paused) return;

    let context: AudioContext | null = null;
    let timer: number | null = null;
    let cancelled = false;

    const playNote = () => {
      if (cancelled || !context || context.state !== 'running') return;
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = NOTES[Math.floor(Math.random() * NOTES.length)];
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 1.5);
      timer = window.setTimeout(playNote, 1700 + Math.random() * 2600);
    };

    const begin = () => {
      if (cancelled) return;
      context ??= new AudioContext();
      void context.resume()
        .then(() => {
          if (!cancelled && timer === null) playNote();
        })
        .catch(() => undefined);
    };

    begin();
    window.addEventListener('pointerdown', begin, { once: true });

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('pointerdown', begin);
      if (context) void context.close().catch(() => undefined);
    };
  }, [enabled, paused]);

  return null;
}

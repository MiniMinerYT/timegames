import { useEffect, useRef } from 'react';

const THEME_SRC = '/audio/theme.mp3';
const FADE_OUT_MS = 5000;
const FADE_IN_DELAY_MS = 10000;
const FADE_IN_MS = 5000;
const VOLUME_CHANGE_FADE_MS = 300;
const DUCKED_VOLUME = 0.001;
const CONTROLLER_TICK_MS = 100;

interface AmbientMusicProps {
  enabled: boolean;
  ducked: boolean;
  volume: number;
}

interface FadeJob {
  from: number;
  to: number;
  startedAt: number;
  durationMs: number;
}

export default function AmbientMusic({ enabled, ducked, volume }: AmbientMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<FadeJob | null>(null);
  const returnAtRef = useRef<number | null>(null);
  const hasDuckedRef = useRef(false);
  const lastPlayAttemptRef = useRef(0);

  useEffect(() => {
    const audio = new Audio(THEME_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const startPlayback = () => {
      audio.muted = false;
      void audio.play().catch(() => undefined);
    };

    const startFade = (to: number, durationMs: number) => {
      const currentFade = fadeRef.current;
      if (currentFade && Math.abs(currentFade.to - to) < 0.001 && currentFade.durationMs === durationMs) return;

      fadeRef.current = {
        from: audio.volume,
        to,
        startedAt: performance.now(),
        durationMs,
      };
    };

    const applyFade = () => {
      const fade = fadeRef.current;
      if (!fade) return true;

      const progress = fade.durationMs === 0
        ? 1
        : Math.min(1, (performance.now() - fade.startedAt) / fade.durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = fade.from + (fade.to - fade.from) * eased;

      if (progress < 1) return false;

      audio.volume = fade.to;
      fadeRef.current = null;
      return true;
    };

    const attemptPlaybackPeriodically = () => {
      const now = Date.now();
      if (!audio.paused && !audio.ended) return;
      if (now - lastPlayAttemptRef.current < 1000) return;
      lastPlayAttemptRef.current = now;
      startPlayback();
    };

    const controller = window.setInterval(() => {
      if (!enabled) {
        startFade(0, FADE_OUT_MS);
        if (applyFade()) audio.pause();
        return;
      }

      attemptPlaybackPeriodically();

      if (ducked) {
        hasDuckedRef.current = true;
        returnAtRef.current = null;
        startFade(DUCKED_VOLUME, FADE_OUT_MS);
        applyFade();
        return;
      }

      if (hasDuckedRef.current) {
        returnAtRef.current ??= Date.now() + FADE_IN_DELAY_MS;

        if (Date.now() < returnAtRef.current) {
          startFade(DUCKED_VOLUME, 0);
          applyFade();
          return;
        }

        startPlayback();
        startFade(volume, FADE_IN_MS);
        if (applyFade()) {
          hasDuckedRef.current = false;
          returnAtRef.current = null;
        }
        return;
      }

      startPlayback();
      startFade(volume, VOLUME_CHANGE_FADE_MS);
      applyFade();
    }, CONTROLLER_TICK_MS);

    startPlayback();
    window.addEventListener('pointerdown', startPlayback);

    return () => {
      window.clearInterval(controller);
      window.removeEventListener('pointerdown', startPlayback);
    };
  }, [enabled, ducked, volume]);

  return null;
}

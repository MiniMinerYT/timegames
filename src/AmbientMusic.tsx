import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

const THEME_SRC = '/audio/themev4.mp3';
const FADE_OUT_MS = 5000;
const FADE_IN_DELAY_MS = 10000;
const FADE_IN_MS = 5000;
const VOLUME_CHANGE_FADE_MS = 0;
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
  const unlockedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const duckedRef = useRef(ducked);
  const volumeRef = useRef(volume);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const levelRef = useRef(0);
  const launchAutoplayAttemptedRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
    const audio = audioRef.current;
    if (!audio) return;

    if (!enabled) {
      fadeRef.current = null;
      returnAtRef.current = null;
      hasDuckedRef.current = false;
      setOutputLevel(0);
      audio.muted = true;
      audio.pause();
      return;
    }

    audio.muted = false;
    startPlayback(false);
  }, [enabled]);

  useEffect(() => {
    duckedRef.current = ducked;
  }, [ducked]);

  useEffect(() => {
    const audio = new Audio(THEME_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.autoplay = true;
    audio.playsInline = true;
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.volume = 0;
    audio.muted = !enabledRef.current;
    audioRef.current = audio;
    audio.load();

    return () => {
      audio.pause();
      void audioContextRef.current?.close().catch(() => undefined);
      audioRef.current = null;
      audioContextRef.current = null;
      gainRef.current = null;
    };
  }, []);

  const setOutputLevel = useCallback((level: number) => {
    const clamped = Math.max(0, Math.min(1, level));
    levelRef.current = clamped;

    const gain = gainRef.current;
    if (gain) {
      gain.gain.setValueAtTime(clamped, audioContextRef.current?.currentTime ?? 0);
      return;
    }

    const audio = audioRef.current;
    if (audio) audio.volume = clamped;
  }, []);

  useEffect(() => {
    volumeRef.current = volume;
    if (enabledRef.current && !duckedRef.current && !hasDuckedRef.current) {
      fadeRef.current = null;
      setOutputLevel(volume);
    }
  }, [setOutputLevel, volume]);

  const ensureAudioGraph = useCallback(() => {
    if (gainRef.current) return;

    const audio = audioRef.current;
    if (!audio) return;

    try {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;

      const context = new AudioContextConstructor();
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      gain.gain.value = levelRef.current;
      source.connect(gain);
      gain.connect(context.destination);

      audio.volume = 1;
      audioContextRef.current = context;
      gainRef.current = gain;
    } catch {
      // Fall back to HTMLAudioElement volume when Web Audio is unavailable.
    }
  }, []);

  const startPlayback = useCallback((unlock = false) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (unlock) unlockedRef.current = true;
    if (!enabledRef.current && !unlock) return;

    ensureAudioGraph();
    void audioContextRef.current?.resume().catch(() => undefined);
    audio.muted = !enabledRef.current;
    void audio.play().catch(() => undefined);
  }, [ensureAudioGraph]);

  useEffect(() => {
    if (!enabled || launchAutoplayAttemptedRef.current) return undefined;
    launchAutoplayAttemptedRef.current = true;

    const attemptEarlyPlayback = () => {
      startPlayback(false);
    };

    attemptEarlyPlayback();
    const frame = window.requestAnimationFrame(attemptEarlyPlayback);
    const firstTimer = window.setTimeout(attemptEarlyPlayback, Capacitor.getPlatform() === 'ios' ? 150 : 300);
    const secondTimer = window.setTimeout(attemptEarlyPlayback, 900);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
    };
  }, [enabled, startPlayback]);

  useEffect(() => {
    const unlockPlayback = () => startPlayback(true);
    window.addEventListener('pointerdown', unlockPlayback, { passive: true });
    window.addEventListener('keydown', unlockPlayback);

    return () => {
      window.removeEventListener('pointerdown', unlockPlayback);
      window.removeEventListener('keydown', unlockPlayback);
    };
  }, [startPlayback]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const startFade = (to: number, durationMs: number) => {
      const currentFade = fadeRef.current;
      if (currentFade && Math.abs(currentFade.to - to) < 0.001 && currentFade.durationMs === durationMs) return;

      fadeRef.current = {
        from: levelRef.current,
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
      setOutputLevel(fade.from + (fade.to - fade.from) * eased);

      if (progress < 1) return false;

      setOutputLevel(fade.to);
      fadeRef.current = null;
      return true;
    };

    const attemptPlaybackPeriodically = () => {
      const now = Date.now();
      if (!audio.paused && !audio.ended) return;
      if (now - lastPlayAttemptRef.current < 1000) return;
      lastPlayAttemptRef.current = now;
      startPlayback(false);
    };

    const controller = window.setInterval(() => {
      audio.muted = !enabledRef.current;
      attemptPlaybackPeriodically();

      if (!enabledRef.current) {
        const mutedTarget = duckedRef.current ? DUCKED_VOLUME : volumeRef.current;
        startFade(mutedTarget, VOLUME_CHANGE_FADE_MS);
        applyFade();
        return;
      }

      if (duckedRef.current) {
        hasDuckedRef.current = true;
        returnAtRef.current = null;
        startFade(DUCKED_VOLUME, FADE_OUT_MS);
        applyFade();
        return;
      }

      if (hasDuckedRef.current) {
        returnAtRef.current ??= Date.now() + FADE_IN_DELAY_MS;

        if (Date.now() < returnAtRef.current) {
          startFade(DUCKED_VOLUME, FADE_OUT_MS);
          applyFade();
          return;
        }

        startPlayback(false);
        startFade(volumeRef.current, FADE_IN_MS);
        if (applyFade()) {
          hasDuckedRef.current = false;
          returnAtRef.current = null;
        }
        return;
      }

      startPlayback(false);
      startFade(volumeRef.current, VOLUME_CHANGE_FADE_MS);
      applyFade();
    }, CONTROLLER_TICK_MS);

    audio.muted = !enabled;
    startPlayback(false);

    return () => {
      window.clearInterval(controller);
    };
  }, [enabled, setOutputLevel, startPlayback]);

  return null;
}

import { useState, useEffect, useCallback, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import {
  Clock,
  Users,
  Home,
  RotateCcw,
  BarChart3,
  Target,
  ArrowLeft,
  Plus,
  Trash2,
  Trophy,
  Settings,
  Volume2,
  Music,
  Smartphone,
  Sparkles,
  Moon,
  Skull,
  CalendarDays,
  ArrowRight,
  Eye,
  Timer,
} from 'lucide-react';
import TimeLadder from './TimeLadder';
import HardcoreMode, { type HardcoreDifficulty, type HardcoreScores } from './HardcoreMode';
import AmbientMusic from './AmbientMusic';
import LadderIcon from './LadderIcon';
import HelpOverlay, { type HelpContent } from './HelpOverlay';
import NumberKeypad from './NumberKeypad';
import { triggerHaptic } from './haptics';
import { isSupabaseConfigured } from './supabaseClient';
import {
  fetchDailyLeaderboard,
  submitDailyLeaderboardScore,
  type DailyLeaderboardSummary,
} from './dailyLeaderboard';

type GameMode = 'home' | 'single' | 'party' | 'tabletop' | 'challenge';

type GamePhase =
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'stopped'
  | 'reveal'
  | 'stats'
  | 'settings'
  | 'rankings'
  | 'guesserHub'
  | 'ladder'
  | 'hardcore'
  | 'dailyHub'
  | 'dailyHistory'
  | 'partySetup'
  | 'partyGuesses'
  | 'partyResults'
  | 'tabletopReady'
  | 'tabletopReveal';

interface GameState {
  mode: GameMode;
  phase: GamePhase;
  targetTime: number;
  playerGuess: string;
  countdownValue: number;
  timeRevealed: boolean;
  challengeDate: string | null;
  dailyOfficial: boolean;
  ratingChange: number | null;
}

interface StatsState {
  gamesPlayed: number;
  bestAccuracy: number | null;
  averageError: number | null;
  spotOns: number;
  clockRating: number;
  averageErrorSamples: number;
}

interface SettingsState {
  sounds: boolean;
  music: boolean;
  musicVolume: number;
  haptics: boolean;
  rankedMode: boolean;
  reducedMotion: boolean;
  partyTimerRange: 'short' | 'standard' | 'long';
  darkMode: boolean;
}

type ToggleSettingKey =
  | 'sounds'
  | 'music'
  | 'haptics'
  | 'rankedMode'
  | 'reducedMotion'
  | 'darkMode';

interface PartyPlayer {
  id: string;
  name: string;
  score: number;
  guess: string;
}

interface DailyResult {
  target: number;
  guess: number;
  error: number;
  simulatedRank?: number;
  simulatedPlayers?: number;
  simulatedPercentile?: number;
  globalRank?: number | null;
  leaderboardPlayers?: number;
  bestScoreToday?: number | null;
}

type DailyResults = Record<string, DailyResult>;

interface DailyRetentionState {
  streak: number;
  lastCompletedDate: string | null;
  claimedDates: string[];
}

const CARD_HEIGHT = 'app-card';
const HEADER_ICON_CLASS = 'w-14 h-14 mx-auto rounded-2xl flex items-center justify-center';
type SplashPhase = 'waiting' | 'launching' | 'revealing' | 'done';
const STAR_FIELD_STARS = Array.from({ length: 78 }, (_, index) => {
  const seed = (index + 1) * 9301 + 49297;
  const random = (salt: number) => {
    const value = Math.sin(seed * (salt + 1)) * 10000;
    return value - Math.floor(value);
  };
  const angle = random(1) * Math.PI * 2;
  const distance = 8 + random(2) * 38;
  const central = index < 44;
  const centralX = 50 + (random(9) - 0.5) * 58;
  const centralY = 50 + (random(10) - 0.5) * 62;
  return {
    id: index,
    x: central ? centralX : 4 + random(3) * 92,
    y: central ? centralY : 4 + random(4) * 92,
    size: 1.15 + random(5) * (central ? 2.75 : 2.1),
    opacity: 0.22 + random(6) * (central ? 0.46 : 0.32),
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
    duration: 7 + random(7) * 14,
    delay: -random(8) * 14,
  };
});
const SHOOTING_STARS = Array.from({ length: 3 }, (_, index) => {
  const seed = (index + 3) * 104729 + 1729;
  const random = (salt: number) => {
    const value = Math.sin(seed * (salt + 1)) * 10000;
    return value - Math.floor(value);
  };
  const angle = -38 + random(1) * 76;
  const distance = 240 + random(2) * 260;
  return {
    id: index,
    x: 4 + random(3) * 88,
    y: 5 + random(4) * 72,
    dx: Math.cos((angle * Math.PI) / 180) * distance,
    dy: Math.sin((angle * Math.PI) / 180) * distance,
    angle,
    duration: 44 + random(5) * 34,
    delay: 12 + random(6) * 70,
  };
});

function isNativeOrTouchDevice() {
  if (Capacitor.isNativePlatform()) return true;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}
const MAX_AVERAGE_ERROR = 100;
const MUSIC_DEFAULT_ON_MIGRATION_KEY = 'timegames-music-default-on-migrated';
const PLAYER_ID_KEY = 'timegames-player-id';

function getHelpContent(game: GameState): HelpContent {
  if (game.phase === 'ladder') return {
    title: 'Time Ladder',
    intro: 'Climb from 1.00 to 20.00 seconds by stopping the hidden timer accurately at every level.',
    items: ['Press the large circle or Space to start, then press it again to stop.', 'You must finish within ±0.25 seconds of the target. One miss ends the run.', 'Passed levels move the tower upward. Time Ladder does not affect Clock Rating.'],
  };
  if (game.phase === 'hardcore') return {
    title: 'Hardcore Mode',
    intro: 'An endless three-life timing game with increasingly demanding unlockable difficulties.',
    items: ['Choose a difficulty, memorise the target, then use START and STOP or Space.', 'A hit adds one point. A miss costs one heart, and losing all three ends the run.', 'Score 3 on each difficulty to reveal the next. Hardcore scores never affect Clock Rating.'],
  };
  if (game.phase === 'guesserHub') return {
    title: 'Time Guesser',
    intro: 'Estimate how long a hidden clock was running, then enter your answer in seconds.',
    items: ['Ranked Single Player changes Clock Rating; Casual Single Player does not.', 'Daily Challenge offers one official attempt and a once-per-day Clock Rating participation bonus.', 'Party Mode compares friends locally and never changes Clock Rating.'],
  };
  if (game.phase === 'dailyHub') return {
    title: 'Daily Challenge',
    intro: 'Everyone gets one deterministic hidden-time challenge for the current local calendar day.',
    items: ['You receive one official attempt today—enter carefully.', 'Completing it protects your streak and awards the displayed Clock Rating bonus once.', 'Challenge Archive is view-only. A new challenge arrives at local midnight.'],
  };
  if (game.phase === 'dailyHistory') return {
    title: 'Challenge Archive',
    intro: 'Review recent Daily Challenge outcomes without replaying revealed targets.',
    items: ['Played days show the secret time, best official error and simulated placement.', 'Missed dates are marked Not played.', 'Placements are local simulations until a real online leaderboard is added.'],
  };
  if (game.phase === 'rankings') return {
    title: 'Clock Ranks',
    intro: 'Clock Rating measures your performance in ranked Time Guesser rounds.',
    items: ['More accurate ranked guesses award more rating.', 'Higher ranks require progressively larger rating totals.', 'Party, Ladder and Hardcore performance never changes this rating.'],
  };
  if (game.phase === 'stats') return {
    title: 'Statistics',
    intro: 'A summary of progress across every TimeGames mode.',
    items: ['Time Guesser tracks rating, accuracy, average error and Spot Ons.', 'Daily, Ladder and Hardcore records appear in their own sections.', 'Reset only clears Time Guesser accuracy statistics and Clock Rating.'],
  };
  if (game.phase === 'settings') return {
    title: 'Settings',
    intro: 'Adjust feedback, accessibility, appearance and Party Mode timing ranges.',
    items: ['Sounds and theme music have separate controls.', 'Reduced Motion removes or shortens movement effects.', 'Dark Mode, haptics and Party timer range persist on this device.'],
  };
  if (game.mode === 'party' || ['partySetup', 'partyGuesses', 'partyResults'].includes(game.phase)) return {
    title: 'Party Mode',
    intro: 'Pass the device around and compete to make the closest hidden-time guess.',
    items: ['Add at least two players, then start a shared hidden timer round.', 'Enter guesses in order; Enter moves focus to the next player.', 'Closest guesses score a point. Ties and Spot Ons are celebrated.'],
  };
  if (game.mode === 'challenge') return {
    title: 'Daily Challenge Attempt',
    intro: 'This is today’s single official hidden-time guess.',
    items: ['Wait through the countdown and estimate the hidden clock.', 'Enter your answer to see error, simulated global placement, streak and rating bonus.', 'The current challenge cannot be replayed after submission.'],
  };
  if (game.mode === 'single') return {
    title: 'Single Player',
    intro: 'Build your internal clock by estimating a randomly generated hidden duration.',
    items: ['Wait through the countdown, then remember how long the hidden clock runs.', 'Enter a guess with up to two decimal places and press Enter or Submit.', 'Ranked rounds affect Clock Rating; Casual rounds preserve it.'],
  };
  return {
    title: 'Welcome to TimeGames',
    intro: 'TimeGames is a collection of focused games for training and testing your internal sense of time.',
    items: ['Time Guesser is the ranked core game, with Casual, Party and Daily variants.', 'Time Ladder challenges you to clear targets from 1 to 20 seconds without missing.', 'Hardcore Mode is an endless three-life high-score challenge. Stats and Settings support every mode.'],
  };
}

const defaultStats: StatsState = {
  gamesPlayed: 0,
  bestAccuracy: null,
  averageError: null,
  spotOns: 0,
  clockRating: 0,
  averageErrorSamples: 0,
};

const defaultSettings: SettingsState = {
  sounds: true,
  music: true,
  musicVolume: 0.35,
  haptics: true,
  rankedMode: true,
  reducedMotion: false,
  partyTimerRange: 'standard',
  darkMode: true,
};

const defaultHardcoreScores: HardcoreScores = {
  easy: 0,
  medium: 0,
  hard: 0,
  expert: 0,
  god: 0,
  literal: 0,
};

const defaultDailyRetention: DailyRetentionState = {
  streak: 0,
  lastCompletedDate: null,
  claimedDates: [],
};

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDailyTarget(dateKey: string) {
  let hash = 2166136261;
  for (const character of `TimeGames:${dateKey}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 4294967295;
  return Math.round((0.5 + normalized * 9.5) * 100) / 100;
}

function getDailyReward(streak: number) {
  const rewards = [10, 15, 20, 30, 40, 50, 60, 75, 90];
  return streak >= 10 ? 100 : rewards[Math.max(0, streak - 1)] ?? 10;
}

function adaptHelpContentForTouch(content: HelpContent): HelpContent {
  return {
    ...content,
    items: content.items.map(item =>
      item
        .replace(/ or Space/g, '')
        .replace(/ and STOP or Space/g, ' and STOP')
        .replace(/Space provides/g, 'The main button provides')
        .replace(/Space starts/g, 'The main button starts')
    ),
  };
}

function getTimeUntilNextDay(now: Date) {
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 0);
  const totalSeconds = Math.max(0, Math.floor((nextDay.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

// Placeholder leaderboard simulation. Replace with backend leaderboard data when available.
function getSimulatedDailyStanding(error: number, dateKey: string) {
  let seed = 0;
  for (const character of dateKey) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  const players = 6000 + (seed % 9001);
  const percentile = Math.max(1, Math.min(99, Math.round(100 * Math.exp(-error * 1.35))));
  const rank = Math.max(1, Math.round(players * (1 - percentile / 100)));
  return { players, percentile, rank };
}

function sanitizeTimeInput(value: string) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [whole = '', ...fractionParts] = normalized.split('.');
  const limitedWhole = whole.slice(0, 2);
  if (fractionParts.length === 0 && whole.length > 2) {
    return `${limitedWhole}.${whole.slice(2, 4)}`;
  }
  if (fractionParts.length === 0) return limitedWhole;
  return `${limitedWhole}.${fractionParts.join('').slice(0, 2)}`;
}

function isValidTimeInput(value: string) {
  return /^\d{1,2}(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value));
}

function getOrCreatePlayerId() {
  const saved = localStorage.getItem(PLAYER_ID_KEY);
  if (saved) return saved;
  const generated = crypto.randomUUID ? crypto.randomUUID() : `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(PLAYER_ID_KEY, generated);
  return generated;
}

const rankDefinitions = [
  { min: 0, name: 'Bronze Clock', icon: '🥉' },
  { min: 500, name: 'Silver Clock', icon: '🥈' },
  { min: 1000, name: 'Gold Clock', icon: '🥇' },
  { min: 1500, name: 'Platinum Clock', icon: '💎' },
  { min: 2000, name: 'Diamond Clock', icon: '💠' },
  { min: 2500, name: 'Master Clock', icon: '👑' },
  { min: 3000, name: 'Chrono Master', icon: '⏳' },
] as const;

// Early ranks arrive quickly; the gaps widen toward the prestige ranks.
const rankThresholds = [0, 200, 450, 800, 1300, 2000, 3000] as const;
const ranks = rankDefinitions.map((rank, index) => ({
  ...rank,
  min: rankThresholds[index] ?? 0,
}));

function getRank(rating: number) {
  const rankIcons = ['\u{1F949}', '\u{1F948}', '\u{1F947}', '\u{1F48E}', '\u{1F4A0}', '\u{1F451}', '\u{23F3}'];
  const rankIndex = [...ranks].reverse().findIndex(rank => rating >= rank.min);
  const index = ranks.length - 1 - rankIndex;
  const rank = ranks[index];
  const next = ranks[index + 1] ?? null;
  const progress = next
    ? ((rating - rank.min) / (next.min - rank.min)) * 100
    : 100;

  return {
    rank: { ...rank, icon: rankIcons[index] },
    next,
    pointsNeeded: next ? next.min - rating : 0,
    progress: Math.max(0, Math.min(100, progress)),
  };
}

// Accuracy sets the potential reward. Early ranks get full gains, then the
// multiplier tapers at each higher tier. Losses start at Platinum Clock.
function calculateRatingChange(error: number, rating: number) {
  if (rating >= 800 && error >= 3) {
    const severity = error >= 5 ? 2 : 1;
    const rankPressure = rating >= 2000 ? 10 : rating >= 1300 ? 7 : 4;
    return -Math.min(30, rankPressure * severity);
  }

  const baseGain =
    error < 0.005 ? 260 :
    error < 0.05 ? 180 :
    error < 0.1 ? 115 :
    error < 0.25 ? 65 :
    error < 0.5 ? 48 :
    error < 1 ? 30 :
    error < 2 ? 18 :
    error < 3 ? 8 : 0;

  const difficulty =
    rating < 450 ? 1 :
    rating < 800 ? 0.85 :
    rating < 1300 ? 0.65 :
    rating < 2000 ? 0.45 :
    rating < 3000 ? 0.3 : 0.2;

  return baseGain === 0 ? 0 : Math.max(1, Math.round(baseGain * difficulty));
}

function App() {
  const [nativeControls] = useState(isNativeOrTouchDevice);
  const [game, setGame] = useState<GameState>({
    mode: 'home',
    phase: 'ready',
    targetTime: 0,
    playerGuess: '',
    countdownValue: 3,
    timeRevealed: false,
    challengeDate: null,
    dailyOfficial: false,
    ratingChange: null,
  });

  const [stats, setStats] = useState<StatsState>(() => {
    try {
      const saved = localStorage.getItem('timegames-stats');
      const parsed = saved ? JSON.parse(saved) : {};
      const savedAverage = typeof parsed.averageError === 'number' && parsed.averageError < MAX_AVERAGE_ERROR
        ? parsed.averageError
        : null;
      return {
        gamesPlayed: Number(parsed.gamesPlayed) || 0,
        bestAccuracy: typeof parsed.bestAccuracy === 'number' ? parsed.bestAccuracy : null,
        averageError: savedAverage,
        spotOns: Number(parsed.spotOns) || 0,
        clockRating: Math.max(0, Number(parsed.clockRating) || 0),
        averageErrorSamples: savedAverage === null
          ? 0
          : Number(parsed.averageErrorSamples) || Number(parsed.gamesPlayed) || 0,
      };
    } catch {
      return defaultStats;
    }
  });

  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const saved = localStorage.getItem('timegames-settings');
      if (!saved) return defaultSettings;
      const parsed = JSON.parse(saved);
      const musicDefaultMigrated = localStorage.getItem(MUSIC_DEFAULT_ON_MIGRATION_KEY) === 'true';
      return {
        sounds: typeof parsed.sounds === 'boolean' ? parsed.sounds : defaultSettings.sounds,
        music: musicDefaultMigrated && typeof parsed.music === 'boolean'
          ? parsed.music
          : defaultSettings.music,
        musicVolume: typeof parsed.musicVolume === 'number'
          ? Math.max(0, Math.min(1, parsed.musicVolume))
          : defaultSettings.musicVolume,
        haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : defaultSettings.haptics,
        rankedMode: typeof parsed.rankedMode === 'boolean' ? parsed.rankedMode : defaultSettings.rankedMode,
        reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : defaultSettings.reducedMotion,
        partyTimerRange: ['short', 'standard', 'long'].includes(parsed.partyTimerRange)
          ? parsed.partyTimerRange
          : defaultSettings.partyTimerRange,
        darkMode: typeof parsed.darkMode === 'boolean' ? parsed.darkMode : defaultSettings.darkMode,
      };
    } catch {
      return defaultSettings;
    }
  });

  const [dailyResults, setDailyResults] = useState<DailyResults>(() => {
    try {
      const saved = localStorage.getItem('timegames-daily-results');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [dailyRetention, setDailyRetention] = useState<DailyRetentionState>(() => {
    try {
      const saved = localStorage.getItem('timegames-daily-retention');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        streak: Math.max(0, Number(parsed.streak) || 0),
        lastCompletedDate: typeof parsed.lastCompletedDate === 'string' ? parsed.lastCompletedDate : null,
        claimedDates: Array.isArray(parsed.claimedDates)
          ? parsed.claimedDates.filter((date: unknown): date is string => typeof date === 'string')
          : [],
      };
    } catch {
      return defaultDailyRetention;
    }
  });

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [standaloneTimingActive, setStandaloneTimingActive] = useState(false);
  const [hardcoreHelpVisible, setHardcoreHelpVisible] = useState(false);
  const [playerId] = useState(getOrCreatePlayerId);
  const [dailyLeaderboard, setDailyLeaderboard] = useState<Record<string, DailyLeaderboardSummary>>({});
  const [splashPhase, setSplashPhase] = useState<SplashPhase>('waiting');
  const homeIconRef = useRef<HTMLDivElement | null>(null);
  const splashIconRef = useRef<HTMLDivElement | null>(null);
  const [splashIconTarget, setSplashIconTarget] = useState({ x: 0, y: 0 });

  const [bestLadderLevel, setBestLadderLevel] = useState(() => {
    const saved = Number(localStorage.getItem('timegames-ladder-best')) || 0;
    return Math.max(0, Math.min(20, saved));
  });

  const [hardcoreScores, setHardcoreScores] = useState<HardcoreScores>(() => {
    try {
      const saved = localStorage.getItem('timegames-hardcore-bests');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        easy: Math.max(0, Number(parsed.easy) || 0),
        medium: Math.max(0, Number(parsed.medium) || 0),
        hard: Math.max(0, Number(parsed.hard) || 0),
        expert: Math.max(0, Number(parsed.expert) || 0),
        god: Math.max(0, Number(parsed.god) || 0),
        literal: Math.max(0, Number(parsed.literal) || 0),
      };
    } catch {
      return defaultHardcoreScores;
    }
  });

  const [rankUpNotice, setRankUpNotice] = useState<string | null>(null);
  const [partyPlayers, setPartyPlayers] = useState<PartyPlayer[]>([]);

  const [newPlayerName, setNewPlayerName] = useState('');

  const timerRef = useRef<number | null>(null);
  const dailySubmissionRef = useRef<string | null>(null);
  const todayKey = getLocalDateKey(currentTime);
  const yesterday = new Date(currentTime);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);
  const activeDailyStreak = dailyRetention.lastCompletedDate === todayKey || dailyRetention.lastCompletedDate === yesterdayKey
    ? dailyRetention.streak
    : 0;
  const nextDailyReward = getDailyReward(activeDailyStreak + 1);
  const dailyCountdown = getTimeUntilNextDay(currentTime);

  const todayLeaderboard = dailyLeaderboard[todayKey] ?? null;

  useEffect(() => {
    localStorage.setItem('timegames-stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('timegames-settings', JSON.stringify(settings));
    localStorage.setItem(MUSIC_DEFAULT_ON_MIGRATION_KEY, 'true');
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('timegames-daily-results', JSON.stringify(dailyResults));
  }, [dailyResults]);

  useEffect(() => {
    const missingPlacement = Object.entries(dailyResults).filter(([, result]) => result.simulatedRank === undefined);
    if (missingPlacement.length === 0) return;
    setDailyResults(prev => {
      const next = { ...prev };
      for (const [dateKey, result] of missingPlacement) {
        const standing = getSimulatedDailyStanding(result.error, dateKey);
        next[dateKey] = {
          ...result,
          simulatedRank: standing.rank,
          simulatedPlayers: standing.players,
          simulatedPercentile: standing.percentile,
        };
      }
      return next;
    });
  }, [dailyResults]);

  useEffect(() => {
    localStorage.setItem('timegames-daily-retention', JSON.stringify(dailyRetention));
  }, [dailyRetention]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    const refreshLeaderboard = () => {
      fetchDailyLeaderboard(todayKey, playerId)
        .then(summary => {
        if (cancelled || !summary) return;
        setDailyLeaderboard(prev => ({ ...prev, [todayKey]: summary }));
        })
        .catch(() => undefined);
    };
    refreshLeaderboard();
    const interval = window.setInterval(refreshLeaderboard, ['dailyHub', 'reveal'].includes(game.phase) ? 15000 : 60000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [game.phase, playerId, todayKey]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('timegames-ladder-best', bestLadderLevel.toString());
  }, [bestLadderLevel]);

  useEffect(() => {
    localStorage.setItem('timegames-hardcore-bests', JSON.stringify(hardcoreScores));
  }, [hardcoreScores]);

  const measureSplashIconTarget = useCallback(() => {
    const icon = homeIconRef.current;
    const splashIcon = splashIconRef.current;
    if (!icon || !splashIcon) return;
    const rect = icon.getBoundingClientRect();
    const splashRect = splashIcon.getBoundingClientRect();
    setSplashIconTarget({
      x: rect.left + rect.width / 2 - (splashRect.left + splashRect.width / 2),
      y: rect.top + rect.height / 2 - (splashRect.top + splashRect.height / 2),
    });
  }, []);

  useEffect(() => {
    if (splashPhase !== 'waiting') return undefined;
    measureSplashIconTarget();
    const frame = window.requestAnimationFrame(measureSplashIconTarget);
    window.addEventListener('resize', measureSplashIconTarget);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measureSplashIconTarget);
    };
  }, [game.phase, measureSplashIconTarget, splashPhase]);

  const playTone = useCallback((frequency = 440, duration = 0.08, volume = 0.08) => {
    if (!settings.sounds) return;
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      // Audio can fail silently on some browsers until the user interacts.
    }
  }, [settings.sounds]);

  const vibrate = useCallback((pattern: number | number[]) => {
    triggerHaptic(settings.haptics, pattern);
  }, [settings.haptics]);

  const playCelebration = useCallback(() => {
    playTone(880, 0.1);
    window.setTimeout(() => playTone(1100, 0.1), 90);
    window.setTimeout(() => playTone(1320, 0.18), 180);
  }, [playTone]);

  const generateTargetTime = useCallback((mode: GameMode) => {
    if ((mode === 'party' || mode === 'tabletop') && settings.partyTimerRange !== 'standard') {
      const [min, max] = settings.partyTimerRange === 'short'
        ? [2, 6]
        : [8, 20];
      return Math.round((min + Math.random() * (max - min)) * 100) / 100;
    }

    const roll = Math.random();

    let min: number;
    let max: number;

    if (roll < 0.5) {
      min = 4;
      max = 8;
    } else if (roll < 0.8) {
      if (Math.random() < 0.5) {
        min = 2;
        max = 4;
      } else {
        min = 8;
        max = 10;
      }
    } else if (roll < 0.95) {
      min = 10;
      max = 20;
    } else {
      min = 0.3;
      max = 2;
    }

    return Math.round((min + Math.random() * (max - min)) * 100) / 100;
  }, [settings.partyTimerRange]);

  const clearGameTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback((
    mode: GameMode,
    dailyDate: string | null = null,
    dailyOfficial = false
  ) => {
    clearGameTimer();

    setGame({
      mode,
      phase: 'countdown',
      targetTime: mode === 'challenge' && dailyDate
        ? getDailyTarget(dailyDate)
        : generateTargetTime(mode),
      playerGuess: '',
      countdownValue: 3,
      timeRevealed: false,
      challengeDate: dailyDate,
      dailyOfficial,
      ratingChange: null,
    });
  }, [clearGameTimer, generateTargetTime]);

  const openDailyChallenge = useCallback(() => {
    const today = getLocalDateKey();
    if (dailyResults[today]) {
      setGame(prev => ({ ...prev, mode: 'home', phase: 'dailyHub' }));
      return;
    }
    startCountdown('challenge', today, true);
  }, [dailyResults, startCountdown]);

  useEffect(() => {
    if (game.phase === 'countdown') {
      if (game.countdownValue > 0) {
        playTone(420, 0.06, game.mode === 'tabletop' ? 0.22 : 0.08);

        const timer = setTimeout(() => {
          setGame(prev => ({
            ...prev,
            countdownValue: prev.countdownValue - 1,
          }));
        }, 1000);

        return () => clearTimeout(timer);
      }

      playTone(720, 0.1, game.mode === 'tabletop' ? 0.28 : 0.08);
      vibrate(40);

      setGame(prev => ({
        ...prev,
        phase: 'playing',
      }));
    }
  }, [game.phase, game.countdownValue, game.mode, playTone, vibrate]);

  useEffect(() => {
    if (game.phase === 'playing') {
      timerRef.current = window.setTimeout(() => {
        playTone(220, 0.12, game.mode === 'tabletop' ? 0.28 : 0.08);
        vibrate([40, 30, 40]);

        setGame(prev => ({
          ...prev,
          phase: 'stopped',
        }));
      }, game.targetTime * 1000);

      return () => clearGameTimer();
    }
  }, [game.phase, game.targetTime, clearGameTimer, playTone, vibrate]);

  useEffect(() => {
    if (game.phase === 'stopped') {
      const timer = setTimeout(() => {
        setGame(prev => ({
          ...prev,
          phase: prev.mode === 'party' ? 'partyGuesses' : prev.mode === 'tabletop' ? 'tabletopReveal' : 'reveal',
          timeRevealed: prev.mode === 'party' ? true : false,
        }));
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [game.phase]);

  const updateStats = useCallback((distance: number) => {
    setStats(prev => {
      const newGamesPlayed = prev.gamesPlayed + 1;
      const includeInAverage = distance < MAX_AVERAGE_ERROR;
      const newAverageSamples = prev.averageErrorSamples + (includeInAverage ? 1 : 0);
      const previousTotal = (prev.averageError || 0) * prev.averageErrorSamples;
      const newAverageError = includeInAverage
        ? (previousTotal + distance) / newAverageSamples
        : prev.averageError;

      return {
        gamesPlayed: newGamesPlayed,
        bestAccuracy: prev.bestAccuracy === null ? distance : Math.min(prev.bestAccuracy, distance),
        averageError: newAverageError,
        spotOns: distance < 0.005 ? prev.spotOns + 1 : prev.spotOns,
        clockRating: prev.clockRating,
        averageErrorSamples: newAverageSamples,
      };
    });
  }, []);

  const submitGuess = useCallback((guessOverride?: string) => {
    const submittedGuessText = guessOverride ?? game.playerGuess;
    const submittedGuess = parseFloat(submittedGuessText);
    const distance = Math.abs(submittedGuess - game.targetTime);
    if (!Number.isFinite(distance)) return;
    if (game.dailyOfficial && game.challengeDate) {
      if (dailyResults[game.challengeDate] || dailySubmissionRef.current === game.challengeDate) return;
      dailySubmissionRef.current = game.challengeDate;
    }

    const startingRating = stats.clockRating;
    let projectedRating = startingRating;
    const startingRankName = getRank(startingRating).rank.name;
    const ratingChange = game.mode === 'single' && settings.rankedMode
      ? calculateRatingChange(distance, stats.clockRating)
      : null;

    if (game.mode === 'single' || game.dailyOfficial) {
      updateStats(distance);
    }
    if (game.mode === 'challenge' && game.dailyOfficial && game.challengeDate) {
      const dateKey = game.challengeDate;
      const isToday = dateKey === getLocalDateKey();
      const guess = submittedGuess;
      const standing = !isSupabaseConfigured ? getSimulatedDailyStanding(distance, dateKey) : null;
      setDailyResults(prev => ({
        ...prev,
        [dateKey]: {
          target: game.targetTime,
          guess,
          error: distance,
          simulatedRank: standing?.rank,
          simulatedPlayers: standing?.players,
          simulatedPercentile: standing?.percentile,
        },
      }));

      if (isToday && isSupabaseConfigured) {
        void submitDailyLeaderboardScore({
            challengeDate: dateKey,
            playerId,
            displayName: 'Anonymous',
            error: distance,
            guess,
          })
          .then(leaderboardSummary => {
          const submittedSummary = leaderboardSummary;
          if (submittedSummary) {
            setDailyLeaderboard(prev => ({ ...prev, [dateKey]: submittedSummary }));
              setDailyResults(prev => {
                const existing = prev[dateKey];
                if (!existing) return prev;
                return {
                  ...prev,
                  [dateKey]: {
                    ...existing,
                    globalRank: submittedSummary.playerRank,
                    leaderboardPlayers: submittedSummary.totalPlayers,
                    bestScoreToday: submittedSummary.bestScoreToday,
                  },
                };
              });
          }
          })
          .catch(() => undefined);
      }
      // The participation reward belongs only to today's official challenge.
      // A challenge left open across midnight may still save its result, but cannot claim an archived-day bonus.
      if (isToday && !dailyRetention.claimedDates.includes(dateKey)) {
        const completionDate = new Date(`${dateKey}T12:00:00`);
        completionDate.setDate(completionDate.getDate() - 1);
        const previousDateKey = getLocalDateKey(completionDate);
        const newStreak = dailyRetention.lastCompletedDate === previousDateKey
          ? dailyRetention.streak + 1
          : 1;
        const dailyBonus = getDailyReward(newStreak);
        projectedRating += dailyBonus;
        setDailyRetention(prev => ({
          streak: newStreak,
          lastCompletedDate: dateKey,
          claimedDates: [...prev.claimedDates, dateKey],
        }));
        setStats(prev => ({ ...prev, clockRating: prev.clockRating + dailyBonus }));
      }
    }
    if (ratingChange !== null) {
      projectedRating = Math.max(0, projectedRating + ratingChange);
      setStats(prev => ({
        ...prev,
        clockRating: Math.max(0, prev.clockRating + ratingChange),
      }));
    }
    const newRankName = getRank(projectedRating).rank.name;
    if (newRankName !== startingRankName) {
      setRankUpNotice(newRankName);
      window.setTimeout(() => setRankUpNotice(current => current === newRankName ? null : current), 4200);
    }
    if (distance < 0.005) playCelebration();
    else playTone(distance < 0.5 ? 880 : 520, 0.12);
    vibrate(distance < 0.5 ? [30, 40, 30] : 30);

    setGame(prev => ({
      ...prev,
      playerGuess: submittedGuessText,
      timeRevealed: true,
      ratingChange,
    }));
}, [game, dailyResults, dailyRetention, settings.rankedMode, stats.clockRating, updateStats, playTone, playCelebration, vibrate, playerId]);

  const playAgain = useCallback(() => {
    if (game.mode === 'challenge') {
      setGame(prev => ({ ...prev, mode: 'home', phase: 'dailyHistory' }));
      return;
    }
    startCountdown(game.mode);
  }, [game.mode, startCountdown]);

  const goHome = useCallback(() => {
    clearGameTimer();

    setGame({
      mode: 'home',
      phase: 'ready',
      targetTime: 0,
      playerGuess: '',
      countdownValue: 3,
      timeRevealed: false,
      challengeDate: null,
      dailyOfficial: false,
      ratingChange: null,
    });
  }, [clearGameTimer]);

  const showTimeGuesser = useCallback(() => {
    clearGameTimer();
    setGame(prev => ({ ...prev, mode: 'home', phase: 'guesserHub' }));
  }, [clearGameTimer]);

  const showDailyHistory = useCallback(() => {
    setGame(prev => ({ ...prev, mode: 'home', phase: 'dailyHub' }));
  }, []);

  const showPreviousDailyHistory = useCallback(() => {
    setGame(prev => ({ ...prev, mode: 'home', phase: 'dailyHistory' }));
  }, []);

  const showTimeLadder = useCallback(() => {
    clearGameTimer();
    setGame(prev => ({ ...prev, mode: 'home', phase: 'ladder' }));
  }, [clearGameTimer]);

  const showHardcoreMode = useCallback(() => {
    clearGameTimer();
    setGame(prev => ({ ...prev, mode: 'home', phase: 'hardcore' }));
  }, [clearGameTimer]);

  const updateHardcoreBest = useCallback((difficulty: HardcoreDifficulty, score: number) => {
    setHardcoreScores(prev => ({ ...prev, [difficulty]: Math.max(prev[difficulty], score) }));
  }, []);

  const showStats = useCallback(() => {
    setGame(prev => ({
      ...prev,
      mode: 'home',
      phase: 'stats',
    }));
  }, []);

  const hideStats = useCallback(() => {
    setGame(prev => ({
      ...prev,
      mode: 'home',
      phase: 'ready',
    }));
  }, []);

  const showSettings = useCallback(() => {
    setGame(prev => ({ ...prev, mode: 'home', phase: 'settings' }));
  }, []);

  const hideSettings = useCallback(() => {
    setGame(prev => ({ ...prev, mode: 'home', phase: 'ready' }));
  }, []);

  const showRankings = useCallback(() => {
    setGame(prev => ({ ...prev, mode: 'home', phase: 'rankings' }));
  }, []);

  const updateSetting = useCallback(<K extends keyof SettingsState,>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'haptics' && value === true) {
      triggerHaptic(true, 35);
    }
  }, []);

  const resetStats = useCallback(() => {
    setStats(defaultStats);
    setDailyResults({});
    setDailyRetention(defaultDailyRetention);
    setDailyLeaderboard({});
    setBestLadderLevel(0);
    setHardcoreScores(defaultHardcoreScores);
    setPartyPlayers([]);
    setNewPlayerName('');
    dailySubmissionRef.current = null;
    localStorage.removeItem('timegames-daily-results');
    localStorage.removeItem('timegames-daily-retention');
    localStorage.removeItem('timegames-ladder-best');
    localStorage.removeItem('timegames-hardcore-bests');
  }, []);

  const openPartySetup = useCallback(() => {
    setGame(prev => ({
      ...prev,
      mode: 'party',
      phase: 'partySetup',
    }));
  }, []);

  const addPartyPlayer = useCallback(() => {
    const name = newPlayerName.trim();

    if (!name) return;

    setPartyPlayers(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name,
        score: 0,
        guess: '',
      },
    ]);

    setNewPlayerName('');
  }, [newPlayerName]);

  const removePartyPlayer = useCallback((id: string) => {
    setPartyPlayers(prev => prev.filter(player => player.id !== id));
  }, []);

  const updatePartyGuess = useCallback((id: string, guess: string) => {
    setPartyPlayers(prev =>
      prev.map(player =>
        player.id === id
          ? {
              ...player,
              guess,
            }
          : player
      )
    );
  }, []);

  const formatPartyGuess = useCallback((id: string, guess: string) => {
    if (!isValidTimeInput(guess)) return;

    setPartyPlayers(prev =>
      prev.map(player =>
        player.id === id
          ? {
              ...player,
              guess: Number(guess).toFixed(2),
            }
          : player
      )
    );
  }, []);

  const startPartyRound = useCallback(() => {
    if (partyPlayers.length < 2) return;

    setPartyPlayers(prev =>
      prev.map(player => ({
        ...player,
        guess: '',
      }))
    );

    startCountdown('party');
  }, [partyPlayers.length, startCountdown]);

  const openTabletopMode = useCallback(() => {
    clearGameTimer();
    setGame({
      mode: 'tabletop',
      phase: 'tabletopReady',
      targetTime: 0,
      playerGuess: '',
      countdownValue: 3,
      timeRevealed: false,
      challengeDate: null,
      dailyOfficial: false,
      ratingChange: null,
    });
  }, [clearGameTimer]);

  const startTabletopRound = useCallback(() => {
    startCountdown('tabletop');
  }, [startCountdown]);

  const revealTabletopTime = useCallback(() => {
    setGame(prev => ({
      ...prev,
      timeRevealed: true,
    }));
    playTone(760, 0.1, 0.28);
    window.setTimeout(() => playTone(980, 0.12, 0.28), 110);
    vibrate([25, 35, 25]);
  }, [playTone, vibrate]);

  const showPartyResults = useCallback(() => {
  const ranked = [...partyPlayers]
    .filter(player => isValidTimeInput(player.guess))
    .map(player => ({
      ...player,
      distance: Math.abs(parseFloat(player.guess) - game.targetTime),
    }))
    .sort((a, b) => a.distance - b.distance);

  if (ranked.length === 0) return;

  const winningDistance = ranked[0].distance;

  const winnerIds = ranked
    .filter(player => Math.abs(player.distance - winningDistance) <= 0.005)
    .map(player => player.id);

  setPartyPlayers(prev =>
    prev.map(player =>
      winnerIds.includes(player.id)
        ? {
            ...player,
            score: player.score + 1,
          }
        : player
    )
  );

  if (winningDistance < 0.005) playCelebration();
  else playTone(780, 0.12);
  vibrate([30, 40, 30]);

  setGame(prev => ({
    ...prev,
    phase: 'partyResults',
  }));
}, [partyPlayers, game.targetTime, playTone, playCelebration, vibrate]);

  const guessDistance = (() => {
    if (game.playerGuess) {
      return Math.abs(parseFloat(game.playerGuess) - game.targetTime);
    }

    return null;
  })();
  const revealDailyLeaderboard = (() => {
    if (!game.challengeDate) return null;
    const live = dailyLeaderboard[game.challengeDate];
    if (live) return live;
    const stored = dailyResults[game.challengeDate];
    const rank = stored?.globalRank ?? stored?.simulatedRank;
    if (!stored || rank === undefined) return null;
    return {
      playerRank: rank,
      totalPlayers: stored.leaderboardPlayers ?? stored.simulatedPlayers ?? 0,
      bestScoreToday: stored.bestScoreToday ?? stored.error,
      topTen: [],
    } satisfies DailyLeaderboardSummary;
  })();

  const handleMenuClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest('button')) return;
    if (['ready', 'guesserHub', 'stats', 'settings', 'rankings', 'dailyHub', 'partySetup'].includes(game.phase)) {
      playTone(620, 0.045);
    }
  }, [game.phase, playTone]);

  const helpContent = nativeControls ? adaptHelpContentForTouch(getHelpContent(game)) : getHelpContent(game);
  const showHelp =
    ['ready', 'guesserHub', 'dailyHub', 'dailyHistory', 'partySetup', 'stats', 'settings', 'rankings', 'ladder'].includes(game.phase) ||
    (game.phase === 'hardcore' && hardcoreHelpVisible);
  const musicDucked =
    ['countdown', 'playing', 'stopped'].includes(game.phase) ||
    (game.phase === 'reveal' && !game.timeRevealed) ||
    standaloneTimingActive;
  const disableScreenTransition =
    settings.reducedMotion ||
    standaloneTimingActive ||
    ['countdown', 'playing', 'stopped'].includes(game.phase) ||
    (game.phase === 'reveal' && !game.timeRevealed);
  const splashVisible = splashPhase !== 'done';
  const startSplash = useCallback(() => {
    if (splashPhase !== 'waiting') return;
    measureSplashIconTarget();
    setSplashPhase('launching');
    window.setTimeout(() => {
      setSplashPhase('revealing');
    }, settings.reducedMotion ? 80 : 1560);
    window.setTimeout(() => {
      setSplashPhase('done');
    }, settings.reducedMotion ? 140 : 2200);
  }, [measureSplashIconTarget, settings.reducedMotion, splashPhase]);

  return (
    <div onClickCapture={handleMenuClick} className={`app-viewport bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center screen-transition-scope ${disableScreenTransition ? 'screen-transition-disabled' : ''} ${settings.reducedMotion ? '[&_*]:!animate-none [&_*]:!transition-none' : ''} ${settings.darkMode ? 'dark-mode' : ''}`}>
      <AmbientMusic enabled={settings.music} ducked={musicDucked} volume={settings.musicVolume} />
      <CardStarField active={!disableScreenTransition && !settings.reducedMotion} />
      <AnimatePresence>
        {splashVisible && (
          <SplashScreen
            phase={splashPhase}
            reducedMotion={settings.reducedMotion}
            darkMode={settings.darkMode}
            target={splashIconTarget}
            iconRef={splashIconRef}
            onStart={startSplash}
          />
        )}
      </AnimatePresence>
      <div className={`w-full max-w-md relative min-h-0 ${game.mode === 'tabletop' ? 'tabletop-frame' : ''}`}>
        <AnimatePresence>
          {rankUpNotice && (
            <motion.div
              initial={settings.reducedMotion ? { opacity: 0 } : { y: -18, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={settings.reducedMotion ? { opacity: 0 } : { y: -18, opacity: 0, scale: 0.96 }}
              transition={{ duration: settings.reducedMotion ? 0 : 0.34, ease: 'easeOut' }}
              className="safe-top-toast absolute inset-x-4 z-50 rounded-2xl border border-yellow-300/80 bg-slate-950/95 text-white shadow-2xl shadow-yellow-500/20 px-4 py-3 text-center"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-yellow-300">Rank Up</p>
              <p className="text-lg font-black mt-0.5">{rankUpNotice}</p>
            </motion.div>
          )}
        </AnimatePresence>
        {showHelp && (
          <HelpOverlay
            content={helpContent}
            triggerVisible={!(game.mode === 'home' && game.phase === 'ready' && (splashPhase === 'waiting' || splashPhase === 'launching'))}
          />
        )}
        {game.mode === 'home' && game.phase === 'ready' && (
          <HomeScreen
            key={splashPhase === 'waiting' || splashPhase === 'launching' ? 'home-preload' : 'home-revealed'}
            bestLadderLevel={bestLadderLevel}
            bestHardcoreScore={Math.max(...Object.values(hardcoreScores))}
            rankedMode={settings.rankedMode}
            todayResult={dailyResults[todayKey] ?? null}
            todayLeaderboard={todayLeaderboard}
            dailyStreak={activeDailyStreak}
            nextDailyReward={nextDailyReward}
            dailyCountdown={dailyCountdown}
            iconRef={homeIconRef}
            introIconHidden={splashPhase === 'waiting' || splashPhase === 'launching'}
            onTimeGuesser={showTimeGuesser}
            onTimeLadder={showTimeLadder}
            onHardcore={showHardcoreMode}
            onDailyChallenge={showDailyHistory}
            onStats={showStats}
            onSettings={showSettings}
            animateIn={splashPhase === 'revealing'}
          />
        )}

        {game.phase === 'guesserHub' && (
          <TimeGuesserHub
            stats={stats}
            todayResult={dailyResults[todayKey] ?? null}
            rankedMode={settings.rankedMode}
            reducedMotion={settings.reducedMotion}
            dailyStreak={activeDailyStreak}
            nextDailyReward={nextDailyReward}
            dailyCountdown={dailyCountdown}
            onRankedModeChange={(value) => updateSetting('rankedMode', value)}
            onSinglePlayer={() => startCountdown('single')}
            onPartyMode={openPartySetup}
            onChallengeMode={showDailyHistory}
            onBack={goHome}
            onRankings={showRankings}
          />
        )}

        {game.phase === 'ladder' && (
          <TimeLadder
            bestLevel={bestLadderLevel}
            sounds={settings.sounds}
            haptics={settings.haptics}
            reducedMotion={settings.reducedMotion}
            nativeControls={nativeControls}
            onTimingChange={setStandaloneTimingActive}
            onBestLevelChange={setBestLadderLevel}
            onBack={goHome}
          />
        )}

        {game.phase === 'hardcore' && (
          <HardcoreMode
            bestScores={hardcoreScores}
            sounds={settings.sounds}
            haptics={settings.haptics}
            reducedMotion={settings.reducedMotion}
            nativeControls={nativeControls}
            onTimingChange={setStandaloneTimingActive}
            onHelpVisibilityChange={setHardcoreHelpVisible}
            onBestScoreChange={updateHardcoreBest}
            onBack={goHome}
          />
        )}

        {game.phase === 'rankings' && (
          <RankingsScreen
            clockRating={stats.clockRating}
            onBack={showTimeGuesser}
          />
        )}

        {game.phase === 'dailyHub' && (
          <DailyChallengeHub
            results={dailyResults}
            todayLeaderboard={todayLeaderboard}
            dailyStreak={activeDailyStreak}
            nextDailyReward={nextDailyReward}
            dailyCountdown={dailyCountdown}
            onPlayToday={openDailyChallenge}
            onPrevious={showPreviousDailyHistory}
            onBack={goHome}
          />
        )}

        {game.phase === 'dailyHistory' && (
          <PreviousDailyChallengesScreen
            results={dailyResults}
            onBack={showDailyHistory}
          />
        )}

        {game.phase === 'settings' && (
          <SettingsScreen
            settings={settings}
            onChange={updateSetting}
            onBack={hideSettings}
          />
        )}

        {game.phase === 'stats' && (
          <StatsScreen
            stats={stats}
            bestLadderLevel={bestLadderLevel}
            dailyResults={dailyResults}
            hardcoreScores={hardcoreScores}
            onBack={hideStats}
            onResetStats={resetStats}
          />
        )}

        {game.phase === 'partySetup' && (
          <PartySetupScreen
            players={partyPlayers}
            newPlayerName={newPlayerName}
            showTabletopMode={nativeControls}
            onNewPlayerNameChange={setNewPlayerName}
            onAddPlayer={addPartyPlayer}
            onRemovePlayer={removePartyPlayer}
            onStartRound={startPartyRound}
            onStartTabletop={openTabletopMode}
            onGoHome={showTimeGuesser}
          />
        )}

        {game.phase === 'countdown' && (
          <CountdownScreen value={game.countdownValue} tabletop={game.mode === 'tabletop'} />
        )}

        {game.phase === 'playing' && <PlayingScreen tabletop={game.mode === 'tabletop'} />}

        {game.phase === 'stopped' && <StoppedScreen tabletop={game.mode === 'tabletop'} />}

        {game.phase === 'partyGuesses' && (
          <PartyGuessesScreen
            players={partyPlayers}
            onGuessChange={updatePartyGuess}
            onGuessBlur={formatPartyGuess}
            onShowResults={showPartyResults}
            onGoHome={game.mode === 'challenge' ? goHome : showTimeGuesser}
          />
        )}

        {game.phase === 'partyResults' && (
          <PartyResultsScreen
            targetTime={game.targetTime}
            players={partyPlayers}
            reducedMotion={settings.reducedMotion}
            onNextRound={startPartyRound}
            onGoHome={showTimeGuesser}
          />
        )}

        {game.phase === 'tabletopReady' && (
          <TabletopReadyScreen
            onStart={startTabletopRound}
            onGoHome={showTimeGuesser}
          />
        )}

        {game.phase === 'tabletopReveal' && (
          <TabletopRevealScreen
            targetTime={game.targetTime}
            revealed={game.timeRevealed}
            reducedMotion={settings.reducedMotion}
            onReveal={revealTabletopTime}
            onNextRound={openTabletopMode}
            onGoHome={showTimeGuesser}
          />
        )}

        {game.phase === 'reveal' && game.mode !== 'home' && game.mode !== 'party' && (
          <RevealScreen
            mode={game.mode}
            targetTime={game.targetTime}
            challengeDate={game.challengeDate}
            dailyOfficial={game.dailyOfficial}
            timeRevealed={game.timeRevealed}
            playerGuess={game.playerGuess}
            guessDistance={guessDistance}
            ratingChange={game.ratingChange}
            clockRating={stats.clockRating}
            rankedMode={settings.rankedMode}
            onEnableRanked={() => updateSetting('rankedMode', true)}
            onDisableRanked={() => updateSetting('rankedMode', false)}
            onGuessChange={(value) =>
              setGame(prev => ({
                ...prev,
                playerGuess: value,
              }))
            }
            onSubmitGuess={submitGuess}
            onPlayAgain={playAgain}
            dailyStreak={activeDailyStreak}
            nextDailyReward={nextDailyReward}
            dailyCountdown={dailyCountdown}
            dailyLeaderboard={revealDailyLeaderboard}
            onGoHome={game.mode === 'challenge' ? goHome : showTimeGuesser}
          />
        )}
      </div>
    </div>
  );
}

function SplashScreen({
  phase,
  reducedMotion,
  darkMode,
  target,
  iconRef,
  onStart,
}: {
  phase: SplashPhase;
  reducedMotion: boolean;
  darkMode: boolean;
  target: { x: number; y: number };
  iconRef: RefObject<HTMLDivElement>;
  onStart: () => void;
}) {
  const isLaunching = phase === 'launching';
  const isRevealing = phase === 'revealing';
  const hasStarted = phase !== 'waiting';
  const waveAnimation = reducedMotion || hasStarted
    ? { rotate: 0, y: 0 }
    : {
        rotate: [-0.7, 0.8, -0.45, 0.55, -0.7],
        y: [0, -3, 2, -1, 0],
      };

  return (
    <motion.div
      className={`app-splash-overlay fixed inset-0 z-[90] app-modal-safe-padding ${isRevealing ? 'pointer-events-none' : 'flex items-center justify-center'}`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' } }}
      aria-label="Start TimeGames"
    >
      <motion.div
          className={`absolute inset-0 splash-surface ${darkMode ? 'bg-gradient-to-b from-slate-950 to-slate-900' : 'bg-gradient-to-b from-slate-50 to-slate-100'}`}
        animate={{ opacity: isRevealing ? 0 : 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.28, ease: 'easeOut' }}
      />
      <CardStarField active={!hasStarted && !reducedMotion} splash />
      <motion.div
        role="button"
        tabIndex={0}
        onClick={onStart}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onStart();
          }
        }}
        className="relative w-full h-full text-center cursor-pointer select-none focus:outline-none focus-visible:ring-4 focus-visible:ring-teal-300/60 rounded-3xl overflow-hidden"
        initial={false}
      >
        <motion.div
          className="absolute inset-x-0 top-[calc(50%-1rem)] z-[1] flex flex-col items-center px-6 pointer-events-none"
          animate={waveAnimation}
          transition={reducedMotion || hasStarted ? { duration: 0 } : { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            animate={reducedMotion
              ? { opacity: hasStarted ? 0 : 1 }
              : hasStarted
                ? { opacity: [1, 1, 0], scale: [1, 0.022, 0.001], y: [0, -88, -98], filter: ['blur(0px)', 'blur(0.2px)', 'blur(5px)'] }
                : { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: reducedMotion ? 0 : 0.82, times: [0, 0.82, 1], ease: [0.58, 0, 0.16, 1] }}
          >
            <motion.h1
              className={`text-4xl font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.45, delay: 0.12 }}
            >
              TimeGames
            </motion.h1>
            <motion.p
              className={`text-sm font-bold mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
              initial={reducedMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.45, delay: 0.24 }}
            >
              Master your internal clock
            </motion.p>
            <motion.div
              className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-black uppercase tracking-[0.22em] shadow-lg ${darkMode ? 'bg-slate-800 text-teal-200 shadow-black/30 border border-slate-700' : 'bg-white text-teal-600 shadow-slate-200/80 border border-teal-100'}`}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: reducedMotion ? 0 : 0.28, delay: 0.46 }}
            >
              Tap to start
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          ref={iconRef}
          className="absolute left-1/2 top-[calc(50%-4rem)] z-30 pointer-events-none"
          style={{ marginLeft: -28, marginTop: -28 }}
          initial={reducedMotion ? false : { scale: 0.9, x: 0, y: 0 }}
          animate={reducedMotion
            ? { x: hasStarted ? target.x : 0, y: hasStarted ? target.y : 0, scale: 1, opacity: isRevealing ? 0 : 1 }
            : {
                x: hasStarted ? target.x : 0,
                y: hasStarted ? target.y : 0,
                scale: isLaunching ? [1, 1.08, 1] : 1,
                opacity: isRevealing ? [1, 1, 0] : 1,
              }}
          transition={reducedMotion
            ? { duration: 0 }
            : hasStarted
              ? {
                  x: { duration: 0.78, delay: isLaunching ? 0.72 : 0, ease: [0.2, 0.9, 0.18, 1] },
                  y: { duration: 0.78, delay: isLaunching ? 0.72 : 0, ease: [0.2, 0.9, 0.18, 1] },
                  scale: { duration: 0.54, delay: isLaunching ? 0.72 : 0, ease: 'easeOut' },
                  opacity: { duration: 0.32, delay: isRevealing ? 0.18 : 0, times: [0, 0.55, 1], ease: 'easeOut' },
                }
              : { duration: 0 }}
        >
          <motion.div
            className={`${HEADER_ICON_CLASS} logo-glow bg-teal-500 shadow-2xl shadow-teal-500/30`}
            animate={reducedMotion
              ? { scale: 1, rotate: 0 }
              : isLaunching
                ? { rotate: [0, -5, 0], boxShadow: ['0 24px 50px rgba(20,184,166,0.24)', '0 30px 70px rgba(20,184,166,0.34)', '0 14px 30px rgba(20,184,166,0.16)'] }
                : isRevealing
                  ? { scale: [1, 1.025, 1], rotate: 0, boxShadow: ['0 14px 30px rgba(20,184,166,0.16)', '0 8px 18px rgba(20,184,166,0.08)', '0 0 0 rgba(20,184,166,0)'] }
                  : { scale: [1, 1.035, 1], rotate: [0, -1.25, 1, 0] }}
            transition={reducedMotion
              ? { duration: 0 }
              : isLaunching
                ? { duration: 0.54, delay: 0.72, ease: 'easeOut' }
                : isRevealing
                  ? { duration: 0.5, ease: 'easeOut' }
                  : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Clock className="w-8 h-8 text-white" />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function CardStarField({ active, splash = false }: { active: boolean; splash?: boolean }) {
  return (
    <div className={`card-starfield ${splash ? 'card-starfield-splash' : ''} ${active ? '' : 'card-starfield-paused'}`} aria-hidden="true">
      {STAR_FIELD_STARS.map(star => (
        <span
          key={star.id}
          className="star-dot"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            ['--star-x' as string]: `${star.dx}px`,
            ['--star-y' as string]: `${star.dy}px`,
            ['--star-duration' as string]: `${star.duration}s`,
            ['--star-delay' as string]: `${star.delay}s`,
          }}
        />
      ))}
      {SHOOTING_STARS.map(star => (
        <span
          key={`shooting-${star.id}`}
          className="shooting-star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            ['--shoot-x' as string]: `${star.dx}px`,
            ['--shoot-y' as string]: `${star.dy}px`,
            ['--shoot-angle' as string]: `${star.angle}deg`,
            ['--shoot-duration' as string]: `${star.duration}s`,
            ['--shoot-delay' as string]: `${star.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function HomeScreen({
  bestLadderLevel,
  bestHardcoreScore,
  rankedMode,
  todayResult,
  todayLeaderboard,
  dailyStreak,
  nextDailyReward,
  dailyCountdown,
  iconRef,
  introIconHidden,
  onTimeGuesser,
  onTimeLadder,
  onHardcore,
  onDailyChallenge,
  onStats,
  onSettings,
  animateIn,
}: {
  bestLadderLevel: number;
  bestHardcoreScore: number;
  rankedMode: boolean;
  todayResult: DailyResult | null;
  todayLeaderboard: DailyLeaderboardSummary | null;
  dailyStreak: number;
  nextDailyReward: number;
  dailyCountdown: string;
  iconRef?: RefObject<HTMLDivElement>;
  introIconHidden: boolean;
  onTimeGuesser: () => void;
  onTimeLadder: () => void;
  onHardcore: () => void;
  onDailyChallenge: () => void;
  onStats: () => void;
  onSettings: () => void;
  animateIn: boolean;
}) {
  const dailyRank = todayLeaderboard?.playerRank ?? todayResult?.globalRank ?? todayResult?.simulatedRank;
  const homeTextMotion = (index: number) => ({
    initial: animateIn ? { opacity: 0, y: -42 + index * 6, scale: 0.06 } : false,
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.34, delay: animateIn ? 0.03 + index * 0.055 : 0, ease: [0.16, 1, 0.3, 1] as const },
    style: { transformOrigin: '50% -2.8rem' },
  });

  const homeCardMotion = (index: number) => ({
    initial: animateIn ? { opacity: 0, y: -126 + index * 11, scale: 0.06 } : false,
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.4, delay: animateIn ? 0.12 + 0.065 * index : 0, ease: [0.16, 1, 0.3, 1] as const },
    style: { transformOrigin: '50% -4.5rem' },
  });

  return (
    <div className={`home-screen-card rounded-3xl p-6 ${CARD_HEIGHT} flex flex-col justify-center`}>
      <div className="my-auto w-full min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="w-11" />
        <div className="text-center">
          <div ref={iconRef} className={`${HEADER_ICON_CLASS} logo-glow bg-teal-500 ${introIconHidden ? 'opacity-0' : 'opacity-100'} transition-opacity duration-150`}>
            <Clock className="w-8 h-8 text-white" />
          </div>
          <motion.h1 className="text-3xl font-black text-slate-800 mt-1" {...homeTextMotion(0)}>
            TimeGames
          </motion.h1>
          <motion.p className="text-xs text-slate-500" {...homeTextMotion(1)}>
            Master your internal clock.
          </motion.p>
        </div>
        <div className="w-11" />
      </div>

      <div className="min-h-0 overflow-y-auto card-scroll space-y-3 pr-1">
        <motion.div {...homeCardMotion(0)}><GameMenuCard color="teal" icon={<Timer className="w-7 h-7" />} title="Time Guesser" description="Beat the clock" onClick={onTimeGuesser} /></motion.div>
        <motion.div {...homeCardMotion(1)}><GameMenuCard color="indigo" icon={<LadderIcon className="w-7 h-7" />} title="Time Ladder" description="Climb from 1 to 20" onClick={onTimeLadder} /></motion.div>
        <motion.div {...homeCardMotion(2)}><GameMenuCard color="red" icon={<Skull className="w-7 h-7" />} title="Hardcore Mode" description="Three lives only" onClick={onHardcore} /></motion.div>
        <motion.div {...homeCardMotion(3)}><GameMenuCard color="rose" icon={<CalendarDays className="w-7 h-7" />} title="Daily Challenge" description={todayResult ? `${dailyRank ? `Rank #${dailyRank} · ` : ''}New in ${dailyCountdown}` : `${dailyStreak > 0 ? `🔥 ${dailyStreak} day · ` : ''}+${nextDailyReward} rating`} onClick={onDailyChallenge} /></motion.div>
        <div className="grid grid-cols-2 gap-3">
          <motion.div {...homeCardMotion(4)}><GameMenuCard compact color="cyan" icon={<BarChart3 className="w-6 h-6" />} title="Stats" description="Progress" onClick={onStats} /></motion.div>
          <motion.div {...homeCardMotion(5)}><GameMenuCard compact color="slate" icon={<Settings className="w-6 h-6" />} title="Settings" description="Tweak" onClick={onSettings} /></motion.div>
        </div>
      </div>
      </div>
    </div>
  );
}

function GameMenuCard({ color, icon, title, description, onClick, compact = false }: {
  color: 'teal' | 'indigo' | 'cyan' | 'red' | 'rose' | 'slate';
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  compact?: boolean;
}) {
  const colorClasses = {
    teal: 'bg-teal-500 hover:bg-teal-600 shadow-teal-500/25',
    indigo: 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/25',
    cyan: 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-600/25',
    red: 'bg-red-700 hover:bg-red-800 shadow-red-700/25',
    rose: 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25',
    slate: 'bg-gradient-to-br from-slate-700 to-teal-900 hover:from-slate-600 hover:to-teal-800 shadow-teal-900/30',
  }[color];
  return (
    <button onClick={onClick} className={`menu-game-card w-full ${colorClasses} text-white rounded-3xl ${compact ? 'p-3 flex flex-col gap-1.5 justify-center min-h-[104px]' : 'p-4 grid grid-cols-[48px_1fr_48px] items-center'} text-center shadow-xl transition-all duration-200 active:scale-[0.97]`}>
      <div className={`${compact ? 'w-10 h-10 mx-auto rounded-xl' : 'w-12 h-12 rounded-2xl'} bg-white/20 flex items-center justify-center shrink-0`}>{icon}</div>
      <div><p className={`${compact ? 'text-base' : 'text-lg'} font-black leading-tight`}>{title}</p><p className={`${compact ? 'text-xs' : 'text-sm'} text-white/80 leading-tight`}>{description}</p></div>
      {!compact && <span className="w-12" aria-hidden="true" />}
    </button>
  );
}

function TimeGuesserHub({
  stats,
  todayResult,
  rankedMode,
  reducedMotion,
  dailyStreak,
  nextDailyReward,
  dailyCountdown,
  onRankedModeChange,
  onSinglePlayer,
  onPartyMode,
  onChallengeMode,
  onBack,
  onRankings,
}: {
  stats: StatsState;
  todayResult: DailyResult | null;
  rankedMode: boolean;
  reducedMotion: boolean;
  dailyStreak: number;
  nextDailyReward: number;
  dailyCountdown: string;
  onRankedModeChange: (value: boolean) => void;
  onSinglePlayer: () => void;
  onPartyMode: () => void;
  onChallengeMode: () => void;
  onBack: () => void;
  onRankings: () => void;
}) {
  const rankInfo = getRank(stats.clockRating);
  const settingsMotionDuration = reducedMotion ? 0 : 0.28;

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="space-y-2 mb-5 shrink-0">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center">
            <Timer className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Time Guesser
        </h1>

        <p className="text-sm text-slate-500">
          Guess how long the hidden clock ran.
        </p>
      </div>

      <div className="rank-summary-card h-[82px] bg-slate-50 border border-slate-200 rounded-2xl flex items-stretch overflow-hidden relative mb-5 shrink-0">
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={rankedMode ? 'ranked' : 'casual'}
              className="absolute inset-0"
              initial={{ x: rankedMode ? 14 : -14, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: rankedMode ? -14 : 14, opacity: 0 }}
              transition={{ duration: settingsMotionDuration, ease: 'easeInOut' }}
            >
              {rankedMode ? (
                <button type="button" onClick={onRankings} aria-label="View all Clock Ranks" className="w-full h-full hover:bg-slate-100 px-4 transition-colors grid grid-cols-[40px_1fr_20px] items-center gap-3 text-center">
                  <span className="w-10 h-10 flex items-center justify-center text-3xl" aria-hidden="true">{rankInfo.rank.icon}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{rankInfo.rank.name}</p>
                    <p className="text-xs text-slate-500">{stats.clockRating} rating{' - '}{rankInfo.next ? `${rankInfo.pointsNeeded} to next` : 'Top rank'}</p>
                  </div>
                  <span className="text-xl text-slate-300" aria-hidden="true">&gt;</span>
                </button>
              ) : (
                <div className="w-full h-full px-4 grid grid-cols-[40px_1fr_20px] items-center gap-3 text-center">
                  <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center"><Target className="w-5 h-5 text-slate-500" /></div>
                  <div className="min-w-0"><p className="font-bold text-slate-800">Casual mode</p><p className="text-xs text-slate-500">Clock Rating is paused</p></div>
                  <span className="w-5" aria-hidden="true" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="w-[78px] border-l border-slate-200 flex flex-col items-center justify-center gap-1.5 shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
            Ranked
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={rankedMode}
            aria-label="Toggle ranked mode"
            onClick={() => onRankedModeChange(!rankedMode)}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors ${rankedMode ? 'bg-teal-500' : 'bg-slate-300'}`}
          >
            <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${rankedMode ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {rankedMode && (
          <div className="absolute bottom-0 left-0 right-[78px] h-1 bg-slate-200">
            <motion.div className="h-full bg-teal-500" initial={false} animate={{ width: `${rankInfo.progress}%` }} transition={{ duration: settingsMotionDuration }} />
          </div>
        )}
      </div>

      <div className="space-y-2.5 shrink-0">
        <GameMenuCard color="teal" icon={<Timer className="w-6 h-6" />} title={`Single Player ${rankedMode ? 'Ranked' : 'Casual'}`} description={rankedMode ? 'Build rating.' : 'No rating pressure.'} onClick={onSinglePlayer} />
        <GameMenuCard color="rose" icon={<Users className="w-6 h-6" />} title="Party Mode" description="Compete to be closest with friends." onClick={onPartyMode} />
      </div>

      <div className="flex-1 min-h-[90px]" aria-hidden="true" />

      <div className="mt-auto shrink-0">
        <button
          onClick={onBack}
          className="w-full app-secondary-action font-semibold py-3.5 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>All Games</span>
        </button>
      </div>
    </div>
  );
}

function DailyChallengeHub({
  results,
  todayLeaderboard,
  dailyStreak,
  nextDailyReward,
  dailyCountdown,
  onPlayToday,
  onPrevious,
  onBack,
}: {
  results: DailyResults;
  todayLeaderboard: DailyLeaderboardSummary | null;
  dailyStreak: number;
  nextDailyReward: number;
  dailyCountdown: string;
  onPlayToday: () => void;
  onPrevious: () => void;
  onBack: () => void;
}) {
  const today = getLocalDateKey();
  const todayResult = results[today];
  const todayRank = todayLeaderboard?.playerRank ?? todayResult?.globalRank ?? todayResult?.simulatedRank;
  const todayBest = todayLeaderboard?.bestScoreToday ?? todayResult?.bestScoreToday ?? null;

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-7 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="space-y-1.5 mb-3 shrink-0">
        <div className="w-14 h-14 mx-auto bg-indigo-500 rounded-2xl flex items-center justify-center">
          <CalendarDays className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-slate-800">Daily Challenge</h1>
        <p className="text-slate-500">{todayResult ? "Today's attempt is complete. Come back tomorrow!" : 'Play today from the Home menu.'}</p>
      </div>

      <div className={todayResult ? 'flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions space-y-3 pr-1' : 'flex-1 min-h-0 flex flex-col justify-center space-y-3 px-1 pt-2'}>
      {todayResult && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 mb-3">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-indigo-500">Today's score</p>
          <p className="text-4xl font-black text-indigo-700 mt-1">{todayResult.error.toFixed(2)}s off</p>
          <p className="text-sm text-slate-500 mt-1">
            Guessed {todayResult.guess.toFixed(2)}s · Target {todayResult.target.toFixed(2)}s
          </p>
        </div>
      )}

      {todayResult && todayRank != null && (
        <div className="bg-white border border-indigo-200 rounded-2xl p-3 mb-3">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-indigo-500">Global leaderboard</p>
          <p className="font-black text-indigo-700 mt-1">
            Rank #{todayRank.toLocaleString()}
          </p>
          {todayBest !== null && todayBest !== undefined && (
            <p className="text-xs text-slate-500">Best today {todayBest.toFixed(2)}s off</p>
          )}
        </div>
      )}

      {!todayResult && (
        <div className="w-full max-w-[18rem] mx-auto mt-2 mb-4">
          <button onClick={onPlayToday} className="w-full min-h-[16.25rem] bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 hover:from-emerald-300 hover:via-teal-400 hover:to-cyan-500 text-white rounded-[2rem] px-6 py-4 transition-all shadow-2xl shadow-teal-500/40 ring-4 ring-teal-200/70 active:scale-[0.97] flex flex-col items-center justify-center gap-3.5">
            <span className="w-14 h-14 rounded-2xl bg-white/25 flex items-center justify-center shadow-inner">
              <CalendarDays className="w-8 h-8" />
            </span>
            <span className="text-3xl font-black leading-tight">Tap to Play</span>
            <span className="text-sm font-black uppercase tracking-[0.18em] text-white/90">Today's Daily Challenge</span>
            <span className="rounded-full bg-white/15 border border-white/20 px-4 py-2 text-sm font-black">
              +{nextDailyReward} Clock Rating
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white text-teal-700 px-5 py-2 text-sm font-black shadow-lg shadow-slate-900/10">
              Start Challenge <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}

      {todayResult && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-amber-700">Clock Rating bonus</p>
            <p className="text-2xl font-black text-amber-600">+{getDailyReward(dailyStreak)} Rating</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3">
            <p className="text-xs font-bold text-rose-700">Current streak</p>
            <p className="text-2xl font-black text-rose-600">🔥 {dailyStreak} days</p>
          </div>
        </div>
      )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-2 shrink-0">
        <p className="text-xs text-slate-500 font-bold">{todayResult ? `Tomorrow's Clock Rating bonus: +${nextDailyReward}` : `Today's Clock Rating bonus: +${nextDailyReward}`}</p>
        <p className="font-black text-slate-800">Next challenge in {dailyCountdown}</p>
      </div>

      <div className="space-y-2 shrink-0 app-bottom-actions">
        <button onClick={onPrevious} className="w-full app-secondary-action font-black py-3 rounded-2xl transition-colors">
          Challenge Archive
        </button>
        <button onClick={onBack} className="w-full app-secondary-action font-black py-3 rounded-2xl transition-colors flex items-center justify-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          All Games
        </button>
      </div>
    </div>
  );
}

function PreviousDailyChallengesScreen({
  results,
  onBack,
}: {
  results: DailyResults;
  onBack: () => void;
}) {
  const previousDates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index - 1);
    return getLocalDateKey(date);
  });
  const formatDate = (dateKey: string) => new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${dateKey}T12:00:00`));

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-7 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="mb-5">
        <div className="w-14 h-14 mx-auto bg-indigo-500 rounded-2xl flex items-center justify-center"><CalendarDays className="w-7 h-7 text-white" /></div>
        <h1 className="text-3xl font-black text-slate-800 mt-2">Challenge Archive</h1>
        <p className="text-sm text-slate-500">Your recent Daily Challenge history.</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions space-y-2">
        {previousDates.map(dateKey => {
          const result = results[dateKey];
          const fallback = result ? getSimulatedDailyStanding(result.error, dateKey) : null;
          const rank = result?.simulatedRank ?? fallback?.rank;
          const players = result?.simulatedPlayers ?? fallback?.players;
          return (
            <div key={dateKey} className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-center">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-slate-800">{formatDate(dateKey)}</p>
                <span className={`text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded-full ${result ? 'bg-teal-500 text-white' : 'bg-slate-200 text-slate-600'}`}>{result ? 'Played' : 'Not played'}</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">Secret time: <span className="font-bold text-slate-700">{getDailyTarget(dateKey).toFixed(2)}s</span></p>
              {result && rank !== undefined && players !== undefined ? (
                <p className="text-sm font-semibold text-indigo-600">Best error: {result.error.toFixed(2)}s · Global #{rank.toLocaleString()} of {players.toLocaleString()}</p>
              ) : (
                <p className="text-sm font-semibold text-slate-400">Not played</p>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={onBack} className="mt-5 w-full shrink-0 bg-teal-500 hover:bg-teal-600 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 app-bottom-actions"><ArrowLeft className="w-5 h-5" />Daily Challenge</button>
    </div>
  );
}

function StatsScreen({
  stats,
  bestLadderLevel,
  dailyResults,
  hardcoreScores,
  onBack,
  onResetStats,
}: {
  stats: StatsState;
  bestLadderLevel: number;
  dailyResults: DailyResults;
  hardcoreScores: HardcoreScores;
  onBack: () => void;
  onResetStats: () => void;
}) {
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const rankInfo = getRank(stats.clockRating);
  const dailyEntries = Object.values(dailyResults);
  const bestDailyAccuracy = dailyEntries.length > 0
    ? Math.min(...dailyEntries.map(result => result.error))
    : null;
  const godUnlocked = hardcoreScores.expert >= 3 || hardcoreScores.god > 0;
  const literalUnlocked = hardcoreScores.god >= 3 || hardcoreScores.literal > 0;

  const confirmReset = () => {
    onResetStats();
    setShowResetConfirmation(false);
  };

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 sm:p-8 text-center ${CARD_HEIGHT} flex flex-col relative overflow-hidden`}>
      <div className="space-y-2 mb-5 shrink-0">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Statistics
        </h1>

        <p className="text-slate-500">
          Your TimeGames progress
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions space-y-3 text-left pr-1">
        <StatsSectionLabel>Time Guesser</StatsSectionLabel>
        <ResultRow label="Clock Rating" value={stats.clockRating.toString()} accent />
        <ResultRow label="Current Rank" value={rankInfo.rank.name} />
        <ResultRow label="Games Played" value={stats.gamesPlayed.toString()} />
        <ResultRow label="Best Accuracy" value={stats.bestAccuracy === null ? '-' : `${stats.bestAccuracy.toFixed(2)}s`} />
        <ResultRow label="Average Error" value={stats.averageError === null ? '-' : `${stats.averageError.toFixed(2)}s`} />
        <ResultRow label="Spot Ons" value={stats.spotOns.toString()} />

        <StatsSectionLabel>Daily Challenge</StatsSectionLabel>
        <ResultRow label="Best Daily Accuracy" value={bestDailyAccuracy === null ? '-' : `${bestDailyAccuracy.toFixed(2)}s`} />
        <ResultRow label="Challenges Completed" value={dailyEntries.length.toString()} />

        <StatsSectionLabel>Time Ladder</StatsSectionLabel>
        <ResultRow label="Best Ladder Level" value={bestLadderLevel.toString()} />

        <StatsSectionLabel>Hardcore Mode</StatsSectionLabel>
        <ResultRow label="Easy Best" value={hardcoreScores.easy.toString()} />
        <ResultRow label="Medium Best" value={hardcoreScores.medium.toString()} />
        <ResultRow label="Hard Best" value={hardcoreScores.hard.toString()} />
        <ResultRow label="Expert Best" value={hardcoreScores.expert.toString()} />
        {godUnlocked && <ResultRow label="GOD Best" value={hardcoreScores.god.toString()} accent />}
        {literalUnlocked && <ResultRow label="LITERAL CLOCK Best" value={hardcoreScores.literal.toString()} accent />}

        <div className="pt-4">
          <button
            onClick={() => setShowResetConfirmation(true)}
            className="w-full app-secondary-action font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200"
          >
            Reset Statistics
          </button>
          <p className="text-xs text-slate-400 text-center mt-2">
            Clears all local progress, Daily history, Ladder best and Hardcore unlocks.
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-4 shrink-0 relative z-10 app-bottom-actions">
        <button
          onClick={onBack}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98]"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
      </div>

      {showResetConfirmation && (
        <div className="absolute inset-0 z-20 bg-slate-900/45 backdrop-blur-sm p-6 flex items-center justify-center">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-description"
            className="w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 text-center"
          >
            <div className="w-14 h-14 mx-auto bg-rose-100 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-7 h-7 text-rose-600" />
            </div>
            <h2 id="reset-dialog-title" className="text-2xl font-black text-slate-800">
              Reset statistics?
            </h2>
            <p id="reset-dialog-description" className="text-slate-500 mt-2 mb-6">
              This will erase all local progress, including Clock Rating, Daily history, Time Ladder best level and Hardcore unlocks.
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={confirmReset}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 px-5 rounded-2xl transition-colors"
              >
                Yes, reset these stats
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setShowResetConfirmation(false)}
                className="w-full app-secondary-action font-bold py-3.5 px-5 rounded-2xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsScreen({
  settings,
  onChange,
  onBack,
}: {
  settings: SettingsState;
  onChange: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  onBack: () => void;
}) {
  const options: Array<{
    key: ToggleSettingKey;
    label: string;
    description: string;
    icon: typeof Volume2;
  }> = [
    { key: 'sounds', label: 'Sounds', description: 'Countdown and result tones', icon: Volume2 },
    { key: 'music', label: 'Music', description: 'Play background theme music', icon: Music },
    { key: 'haptics', label: 'Haptic Feedback', description: 'Vibration on supported devices', icon: Smartphone },
    { key: 'reducedMotion', label: 'Reduced Motion', description: 'Disable animations and transitions', icon: Sparkles },
    { key: 'darkMode', label: 'Dark Mode', description: 'Use a darker colour scheme', icon: Moon },
  ];

  const segmentClass = (active: boolean) =>
    `flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
      active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 sm:p-8 ${CARD_HEIGHT} flex flex-col overflow-hidden`}>
      <div className="text-center space-y-2 mb-5 shrink-0">
        <div className="w-14 h-14 mx-auto bg-slate-800 rounded-2xl flex items-center justify-center">
          <Settings className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500">Make TimeGames feel right for you.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions space-y-3 pr-1">
        {options.map(option => {
          const Icon = option.icon;
          const enabled = settings[option.key];
          return (
            <div key={option.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-600 border border-slate-200">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">{option.label}</p>
                  <p className="text-xs text-slate-500">{option.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`Toggle ${option.label}`}
                  onClick={() => onChange(option.key, !enabled)}
                  className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${enabled ? 'bg-teal-500' : 'bg-slate-300'}`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {option.key === 'music' && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label htmlFor="music-volume" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      Volume
                    </label>
                    <span className="text-sm font-black text-teal-600">
                      {Math.round(settings.musicVolume * 100)}%
                    </span>
                  </div>
                  <input
                    id="music-volume"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(settings.musicVolume * 100)}
                    onChange={(event) => onChange('musicVolume', Number(event.target.value) / 100)}
                    aria-label="Music volume"
                    className="volume-slider w-full accent-teal-500"
                  />
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-2">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 mb-3">
            Gameplay
          </p>

          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-800">Party Timer Range</p>
                  <p className="text-xs text-slate-500">Choose the pace for Party rounds</p>
                </div>
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex gap-1 bg-slate-200/70 rounded-xl p-1">
                {([
                  ['short', 'Short'],
                  ['standard', 'Standard'],
                  ['long', 'Long'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange('partyTimerRange', value)}
                    className={segmentClass(settings.partyTimerRange === value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 shrink-0 app-bottom-actions">
        <button onClick={onBack} className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98]">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
      </div>
    </div>
  );
}

function RankingsScreen({
  clockRating,
  onBack,
}: {
  clockRating: number;
  onBack: () => void;
}) {
  const currentRank = getRank(clockRating).rank;

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 ${CARD_HEIGHT} flex flex-col`}>
      <div className="text-center space-y-2 mb-5">
        <div className="text-5xl" aria-hidden="true">{currentRank.icon}</div>
        <h1 className="text-3xl font-bold text-slate-800">Clock Ranks</h1>
        <p className="text-slate-500">
          You have <span className="font-bold text-teal-600">{clockRating}</span> Clock Rating
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions space-y-2 pr-1">
        {ranks.map(rank => {
          const isCurrent = rank.name === currentRank.name;
          const pointsDifference = rank.min - clockRating;
          const icon = getRank(rank.min).rank.icon;
          const distanceText = pointsDifference > 0
            ? `${pointsDifference} point${pointsDifference === 1 ? '' : 's'} away`
            : pointsDifference === 0
              ? 'Threshold reached exactly'
              : `${Math.abs(pointsDifference)} point${Math.abs(pointsDifference) === 1 ? '' : 's'} above threshold`;

          return (
            <div
              key={rank.name}
              className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${
                isCurrent
                  ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-200'
                  : pointsDifference <= 0
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-white border-slate-200'
              }`}
            >
              <span className="text-2xl w-8 text-center" aria-hidden="true">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={`font-bold ${isCurrent ? 'text-teal-800' : 'text-slate-800'}`}>
                    {rank.name}
                  </p>
                  {isCurrent && (
                    <span className="text-[10px] uppercase tracking-wider font-black text-teal-700 bg-teal-100 rounded-full px-2 py-0.5">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Starts at {rank.min} points</p>
              </div>
              <p className={`text-xs font-semibold text-right max-w-[105px] ${
                pointsDifference > 0 ? 'text-amber-600' : 'text-slate-500'
              }`}>
                {distanceText}
              </p>
            </div>
          );
        })}
      </div>

      <button
        onClick={onBack}
        className="mt-5 w-full shrink-0 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 app-bottom-actions"
      >
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>
    </div>
  );
}

function PartySetupScreen({
  players,
  newPlayerName,
  showTabletopMode,
  onNewPlayerNameChange,
  onAddPlayer,
  onRemovePlayer,
  onStartRound,
  onStartTabletop,
  onGoHome,
}: {
  players: PartyPlayer[];
  newPlayerName: string;
  showTabletopMode: boolean;
  onNewPlayerNameChange: (value: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (id: string) => void;
  onStartRound: () => void;
  onStartTabletop: () => void;
  onGoHome: () => void;
}) {
  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="space-y-2 mb-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center">
            <Users className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Party Mode
        </h1>

        <p className="text-slate-500">
          Choose a scored round or a quick tabletop reveal.
        </p>
      </div>

      {showTabletopMode && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="rounded-2xl border-2 border-teal-300 bg-teal-50 p-3 text-left">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-600">Standard</p>
            <p className="text-sm font-bold text-slate-800 mt-1">Players, guesses and scores.</p>
          </div>
          <button
            type="button"
            onClick={onStartTabletop}
            className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-3 text-left transition-all hover:border-indigo-400 active:scale-[0.98]"
          >
            <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Tabletop</p>
            <p className="text-sm font-bold text-slate-800 mt-1">No names. Discuss, then reveal.</p>
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          value={newPlayerName}
          onChange={(e) => onNewPlayerNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAddPlayer();
          }}
          placeholder="Add player"
          className="flex-1 text-left text-base font-semibold py-3 px-4 bg-white border-2 border-slate-200 rounded-2xl focus:border-teal-500 focus:outline-none transition-colors placeholder:text-slate-300"
        />

        <button
          onClick={onAddPlayer}
          className="w-14 bg-teal-500 hover:bg-teal-600 text-white rounded-2xl flex items-center justify-center transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions space-y-3 pr-1">
  {players.length === 0 ? (
    <div className="h-full flex items-center justify-center text-center">
      <p className="text-slate-400">
        Add at least 2 players to start.
      </p>
    </div>
  ) : (
    players.map((player) => (
      <div
        key={player.id}
        className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between"
      >
        <div className="text-left">
          <p className="font-bold text-slate-800">
            {player.name}
          </p>
          <p className="text-sm text-slate-400">
            {player.score} points
          </p>
        </div>

        <button
          onClick={() => onRemovePlayer(player.id)}
          className="text-slate-300 hover:text-rose-500 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    ))
  )}
</div>

      <div className="space-y-3 pt-5 shrink-0 app-bottom-actions">
        <button
          onClick={onStartRound}
          disabled={players.length < 2}
          className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 shadow-lg shadow-teal-500/25 disabled:shadow-none"
        >
          Start Round
        </button>

        <button
          onClick={onGoHome}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
      </div>
    </div>
  );
}

function CountdownScreen({ value, tabletop = false }: { value: number; tabletop?: boolean }) {
  const display = value === 0 ? '' : value.toString();

  if (tabletop) {
    return (
      <div className={`tabletop-card bg-white rounded-3xl shadow-xl p-4 sm:p-6 text-center ${CARD_HEIGHT} overflow-hidden flex flex-col`}>
        <div className="tabletop-landscape-shell">
          <div className="tabletop-landscape-surface tabletop-plain-surface text-slate-800 p-5 flex items-center justify-center">
            <div className="tabletop-countdown font-black leading-none text-teal-600">{display}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex items-center justify-center`}>
      <div className="text-8xl font-black text-slate-800 transition-all duration-150">
        {display}
      </div>
    </div>
  );
}

function PlayingScreen({ tabletop = false }: { tabletop?: boolean }) {
  if (tabletop) {
    return (
      <div className={`tabletop-card bg-white rounded-3xl shadow-xl p-4 sm:p-6 text-center ${CARD_HEIGHT} overflow-hidden flex flex-col`}>
        <div className="tabletop-landscape-shell">
          <div className="tabletop-landscape-surface tabletop-plain-surface text-slate-800 p-5 flex items-center justify-center">
            <div>
              <p className="text-7xl font-black leading-none">Stay Ready</p>
              <p className="text-2xl text-teal-600 font-bold mt-4">The hidden timer is running</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} overflow-hidden relative flex items-center justify-center`}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="shimmer-blob shimmer-blob-1" />
        <div className="shimmer-blob shimmer-blob-2" />
        <div className="shimmer-blob shimmer-blob-3" />
      </div>

      <div className="relative z-10 space-y-5">
        <div className="w-20 h-20 mx-auto bg-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-teal-500/25">
          <Clock className="w-10 h-10 text-white" />
        </div>

        <div>
          <p className="text-slate-800 text-2xl font-bold">
            Stay Ready
          </p>

          <p className="text-slate-400 text-sm mt-2">
            The timer is hidden
          </p>
        </div>
      </div>
    </div>
  );
}

function StoppedScreen({ tabletop = false }: { tabletop?: boolean }) {
  if (tabletop) {
    return (
      <div className={`tabletop-card bg-white rounded-3xl shadow-xl p-4 sm:p-6 text-center ${CARD_HEIGHT} overflow-hidden flex flex-col`}>
        <div className="tabletop-landscape-shell">
          <div className="tabletop-landscape-surface tabletop-plain-surface text-slate-800 p-5 flex items-center justify-center">
            <div className="tabletop-stop font-black leading-none text-red-500">STOP</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex items-center justify-center`}>
      <div className="text-8xl font-black text-red-500 scale-110">
        STOP
      </div>
    </div>
  );
}

function PartyGuessesScreen({
  players,
  onGuessChange,
  onGuessBlur,
  onShowResults,
  onGoHome,
}: {
  players: PartyPlayer[];
  onGuessChange: (id: string, guess: string) => void;
  onGuessBlur: (id: string, guess: string) => void;
  onShowResults: () => void;
  onGoHome: () => void;
}) {
  const atLeastOneGuessEntered = players.some(player => isValidTimeInput(player.guess));
  const [activeIndex, setActiveIndex] = useState(0);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const activeCardRef = useRef<HTMLButtonElement | null>(null);
  const activePlayer = players[activeIndex] ?? players[0];
  const activeGuess = activePlayer?.guess ?? '';

  const submitActiveGuess = useCallback(() => {
    if (!activePlayer || !isValidTimeInput(activeGuess)) return;
    const formatted = Number(activeGuess).toFixed(2);
    onGuessChange(activePlayer.id, formatted);
    onGuessBlur(activePlayer.id, formatted);
    const nextIndex = players.findIndex((player, index) => index > activeIndex && !isValidTimeInput(player.guess));
    setActiveIndex(nextIndex === -1 ? Math.min(activeIndex + 1, players.length - 1) : nextIndex);
    window.setTimeout(() => activeCardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
  }, [activeGuess, activeIndex, activePlayer, onGuessBlur, onGuessChange, players]);

  useEffect(() => {
    if (!keypadOpen) return;
    activeCardRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeIndex, keypadOpen]);

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-5 sm:p-6 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="space-y-1.5 mb-3 shrink-0">
        <h1 className="text-3xl font-black text-slate-800">Enter Guesses</h1>
        <p className="text-sm text-slate-500">Tap a guess box, enter a time, then Save & Next.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions space-y-2.5 pr-1">
        {players.map((player, index) => (
          <button
            key={player.id}
            ref={index === activeIndex ? activeCardRef : undefined}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`w-full text-left border rounded-2xl p-3 space-y-2 transition-all ${
              index === activeIndex
                ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-100'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                {player.name}
              </span>

              <span className="text-sm text-slate-400">
                {player.score} pts
              </span>
            </div>

            <div
              role="textbox"
              aria-label={`${player.name}'s guess`}
              onClick={(event) => {
                event.stopPropagation();
                setActiveIndex(index);
                setKeypadOpen(true);
              }}
              className="w-full text-center text-2xl font-semibold py-3 px-5 bg-white border-2 border-slate-200 rounded-2xl text-slate-800"
            >
              {player.guess || <span className="text-slate-300">Tap to enter</span>}
              {player.guess && <span className="text-slate-400 ml-1">s</span>}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-2 pt-4 shrink-0 app-bottom-actions">
        {activePlayer && keypadOpen && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                {activePlayer.name}'s guess
              </p>
              <button type="button" onClick={() => setKeypadOpen(false)} className="text-xs font-black text-slate-400 hover:text-slate-700">Hide</button>
            </div>
            <NumberKeypad
              value={activeGuess}
              onChange={(value) => onGuessChange(activePlayer.id, sanitizeTimeInput(value))}
              onSubmit={submitActiveGuess}
              submitDisabled={!isValidTimeInput(activeGuess)}
              submitLabel={activeIndex >= players.length - 1 ? 'Save Guess' : 'Save & Next'}
            />
          </div>
        )}

        <button
          onClick={onShowResults}
          disabled={!atLeastOneGuessEntered}
          className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 shadow-lg shadow-teal-500/25 disabled:shadow-none"
        >
          Show Results
        </button>

        <button
          onClick={onGoHome}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
      </div>
    </div>
  );
}

function PartyResultsScreen({
  targetTime,
  players,
  reducedMotion,
  onNextRound,
  onGoHome,
}: {
  targetTime: number;
  players: PartyPlayer[];
  reducedMotion: boolean;
  onNextRound: () => void;
  onGoHome: () => void;
}) {
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showSecretTime, setShowSecretTime] = useState(reducedMotion);

  const rankedPlayers = [...players]
    .filter(player => isValidTimeInput(player.guess))
    .map(player => ({
      ...player,
      distance: Math.abs(parseFloat(player.guess) - targetTime),
    }))
    .sort((a, b) => a.distance - b.distance);

  const winningDistance = rankedPlayers[0]?.distance ?? 0;

  const winners = rankedPlayers.filter(
    player => Math.abs(player.distance - winningDistance) <= 0.005
  );

  const isTie = winners.length > 1;
  const spotOnPlayers = rankedPlayers.filter(player => player.distance < 0.005);
  const hasSpotOn = spotOnPlayers.length > 0;

  const sortedScoreboard = [...players].sort((a, b) => b.score - a.score);

  useEffect(() => {
    if (showScoreboard || reducedMotion) {
      setShowSecretTime(true);
      return;
    }

    setShowSecretTime(false);
    const timer = window.setTimeout(() => setShowSecretTime(true), 220);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, showScoreboard, targetTime]);

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex flex-col relative overflow-hidden`}>
      {!showScoreboard && hasSpotOn && (
        <div className="confetti">{Array.from({ length: 14 }, (_, index) => <span key={index} className="confetti-piece" />)}</div>
      )}
      <div className="space-y-2 mb-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center">
            <Trophy className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className={`text-3xl font-black relative z-10 ${hasSpotOn && !showScoreboard ? 'text-yellow-500' : 'text-slate-800'}`}>
          {showScoreboard ? 'Scoreboard' : isTie ? "It's a tie!" : `${winners[0]?.name} wins!`}
        </h1>

        {!showScoreboard && (
          <div className="flip-scene h-24">
            <div className={`flip-card relative h-full ${showSecretTime ? 'is-flipped' : ''}`}>
              <div className="flip-face absolute inset-0 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 flex flex-col items-center justify-center">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-[0.2em]">
                  Secret Time
                </p>
                <p className="text-3xl font-black text-slate-500 tracking-widest">
                  ? ? ?
                </p>
              </div>
              <div className="flip-face flip-back absolute inset-0 bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 flex flex-col items-center justify-center">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-[0.2em]">
                  Secret Time
                </p>
                <p className="text-3xl font-black text-teal-600">
                  {targetTime.toFixed(2)}s
                </p>
              </div>
            </div>
          </div>
        )}

        {showScoreboard && (
          <p className="text-slate-500">
            Current party standings
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions space-y-2 pr-1">
        {!showScoreboard &&
          rankedPlayers.map((player, index) => {
            const tiedWinner = Math.abs(player.distance - winningDistance) <= 0.005;
            const spotOn = player.distance < 0.005;

            return (
              <div
                key={player.id}
                className={`rounded-2xl px-4 py-3 border flex items-center justify-between ${
                  tiedWinner
                    ? 'bg-teal-50 border-teal-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 text-left">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${
                    tiedWinner
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tiedWinner ? 1 : index + 1}
                  </div>

                  <div>
                    <p className={`font-bold ${spotOn ? 'text-yellow-500' : 'text-slate-800'}`}>
                      {player.name}
                    </p>

                    <p className="text-sm text-slate-400">
                      Guessed {parseFloat(player.guess).toFixed(2)}s
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`font-black ${spotOn ? 'text-yellow-500' : tiedWinner ? 'text-teal-600' : 'text-slate-800'}`}>
                    {spotOn ? 'Spot On!' : `${player.distance.toFixed(2)}s`}
                  </p>

                  {!spotOn && <p className="text-xs text-slate-400">off</p>}
                </div>
              </div>
            );
          })}

        {showScoreboard &&
          sortedScoreboard.map((player, index) => (
            <div
              key={player.id}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500">
                  {index + 1}
                </div>

                <p className="font-bold text-slate-800">
                  {player.name}
                </p>
              </div>

              <p className="font-black text-teal-600">
                {player.score} pts
              </p>
            </div>
          ))}
      </div>

      <div className="space-y-3 pt-5 shrink-0 app-bottom-actions">
        <button
          onClick={onNextRound}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98]"
        >
          <ArrowRight className="w-5 h-5" />
          Next Round
        </button>

        <button
          onClick={() => setShowScoreboard(prev => !prev)}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Trophy className="w-5 h-5" />
          {showScoreboard ? 'Round Results' : 'Scoreboard'}
        </button>

        <button
          onClick={onGoHome}
          className="w-full app-secondary-action font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
      </div>
    </div>
  );
}

function TabletopReadyScreen({
  onStart,
  onGoHome,
}: {
  onStart: () => void;
  onGoHome: () => void;
}) {
  return (
    <div className={`tabletop-card bg-white rounded-3xl shadow-xl p-4 sm:p-6 text-center ${CARD_HEIGHT} overflow-hidden flex flex-col`}>
      <div className="tabletop-landscape-shell">
        <div className="tabletop-landscape-surface tabletop-plain-surface text-slate-800 p-5 flex items-center justify-between gap-5">
          <div className="text-left min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/15 flex items-center justify-center mb-3">
              <Eye className="w-8 h-8 text-teal-500" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-teal-600">Tabletop Mode</p>
            <h1 className="text-4xl font-black leading-none mt-1">Ready?</h1>
            <p className="text-sm text-slate-500 mt-2 max-w-[220px]">Start the hidden timer, then everyone guesses together.</p>
          </div>

          <button
            onClick={onStart}
            className="w-40 h-40 rounded-full bg-teal-500 hover:bg-teal-400 text-white text-2xl font-black shadow-2xl shadow-teal-500/30 transition-all active:scale-95"
          >
            START<br />TIMER
          </button>
        </div>
      </div>

      <button
        onClick={onGoHome}
        className="mt-3 w-full app-secondary-action font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 app-bottom-actions"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Time Guesser
      </button>
    </div>
  );
}

function TabletopRevealScreen({
  targetTime,
  revealed,
  reducedMotion,
  onReveal,
  onNextRound,
  onGoHome,
}: {
  targetTime: number;
  revealed: boolean;
  reducedMotion: boolean;
  onReveal: () => void;
  onNextRound: () => void;
  onGoHome: () => void;
}) {
  return (
    <div className={`tabletop-card bg-white rounded-3xl shadow-xl p-4 sm:p-6 text-center ${CARD_HEIGHT} overflow-hidden flex flex-col`}>
      <div className="tabletop-landscape-shell">
        <div className="tabletop-landscape-surface tabletop-plain-surface text-slate-800 p-4 flex gap-4">
          {!revealed ? (
            <button
              type="button"
              onClick={onReveal}
              className="flex-1 flex flex-col items-center justify-center text-slate-800 transition-all active:scale-[0.98]"
              aria-label="Reveal tabletop time"
            >
              <div className="text-8xl font-black tracking-widest leading-none">???</div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-teal-600 mt-5">Tap to reveal</p>
            </button>
          ) : (
            <>
              <div className="flex-1 flex flex-col items-center justify-center min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-teal-600 mb-2">Secret Time</p>
                <div className="tabletop-time font-black text-teal-600 tracking-tight leading-none">
                  {targetTime.toFixed(2)}s
                </div>
              </div>
              <div className="w-40 shrink-0 flex flex-col justify-center gap-3 tabletop-actions app-bottom-actions">
                <button
                  onClick={onNextRound}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white font-black py-4 px-3 rounded-2xl text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98]"
                >
                  <ArrowRight className="w-5 h-5" />
                  Play Again
                </button>
                <button
                  onClick={onGoHome}
                  className="w-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black py-4 px-3 rounded-2xl text-base transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  Home
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {!revealed && (
        <button
          onClick={onGoHome}
          className="mt-3 w-full app-secondary-action font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 app-bottom-actions"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Time Guesser
        </button>
      )}

      {revealed && !reducedMotion && (
        <div className="confetti">{Array.from({ length: 14 }, (_, index) => <span key={index} className="confetti-piece" />)}</div>
      )}
    </div>
  );
}

function RevealScreen({
  mode,
  targetTime,
  challengeDate,
  dailyOfficial,
  timeRevealed,
  playerGuess,
  guessDistance,
  ratingChange,
  clockRating,
  rankedMode,
  onEnableRanked,
  onDisableRanked,
  onGuessChange,
  onSubmitGuess,
  onPlayAgain,
  dailyStreak,
  nextDailyReward,
  dailyCountdown,
  dailyLeaderboard,
  onGoHome,
}: {
  mode: GameMode;
  targetTime: number;
  challengeDate: string | null;
  dailyOfficial: boolean;
  timeRevealed: boolean;
  playerGuess: string;
  guessDistance: number | null;
  ratingChange: number | null;
  clockRating: number;
  rankedMode: boolean;
  onEnableRanked: () => void;
  onDisableRanked: () => void;
  onGuessChange: (value: string) => void;
  onSubmitGuess: (guessOverride?: string) => void;
  onPlayAgain: () => void;
  dailyStreak: number;
  nextDailyReward: number;
  dailyCountdown: string;
  dailyLeaderboard: DailyLeaderboardSummary | null;
  onGoHome: () => void;
}) {
  const [draftGuess, setDraftGuess] = useState(playerGuess);
  useEffect(() => {
    if (!timeRevealed) setDraftGuess(playerGuess);
  }, [playerGuess, timeRevealed]);
  const activeGuess = timeRevealed ? playerGuess : draftGuess;
  const hasGuess = isValidTimeInput(activeGuess);
  const isChallenge = mode === 'challenge';
  const resultRankInfo = getRank(clockRating);
  const resultMessage = (() => {
    if (!isChallenge && (!hasGuess || guessDistance === null)) return 'No guess submitted.';
    if (guessDistance === null) return '';
    if (guessDistance < 0.005) return '🎯 Spot On!';
    if (guessDistance < 0.1) return 'Elite Timing!';
    if (guessDistance < 0.25) return 'Incredible!';
    if (guessDistance < 0.5) return 'Unreal timing!';
    if (guessDistance < 1) return 'Seriously close!';
    if (guessDistance < 2) return 'Not bad!';
    if (guessDistance < 3) return 'Decent effort.';
    if (guessDistance < 5) return 'A bit off.';
    return 'Your internal clock needs work.';
  })();

  const resultTone = (() => {
    if (guessDistance === null) return 'neutral';
    if (guessDistance < 0.005) return 'spoton';
    if (guessDistance < 0.1) return 'elite';
    if (guessDistance < 0.25) return 'perfect';
    if (guessDistance < 1) return 'great';
    if (guessDistance < 3) return 'okay';
    return 'bad';
  })();

  const displayResultMessage = guessDistance !== null && guessDistance < 0.005
    ? '\u{1F3AF} Spot On!'
    : resultMessage;
  const dailyRank = dailyLeaderboard?.playerRank;
  const dailyBestScore = dailyLeaderboard?.bestScoreToday ?? null;
  const submitCurrentGuess = () => {
    if (!hasGuess) return;
    const formattedGuess = Number(activeGuess).toFixed(2);
    setDraftGuess(formattedGuess);
    onGuessChange(formattedGuess);
    onSubmitGuess(formattedGuess);
  };

  const toneClasses = {
    spoton: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    elite: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    perfect: 'bg-teal-50 text-teal-700 border-teal-200',
    great: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    okay: 'bg-amber-50 text-amber-700 border-amber-200',
    bad: 'bg-rose-50 text-rose-700 border-rose-200',
    neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  }[resultTone];

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-4 sm:p-6 text-center ${CARD_HEIGHT} overflow-hidden`}>
      <div className="flip-scene h-full min-h-0">
        <div className={`flip-card relative h-full ${timeRevealed ? 'is-flipped' : ''}`}>
          <div className="flip-face absolute inset-0 bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-6 flex flex-col justify-between overflow-hidden">
            <div className="flex-1 min-h-[140px] max-h-[230px] flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 px-3">
              <div className="text-5xl sm:text-7xl font-black text-slate-700 tracking-widest leading-none">
                ? ? ?
              </div>

              <p className="text-slate-400 text-sm mt-4 leading-snug">
                {isChallenge
                  ? dailyOfficial ? "Today's one official guess" : `Practice challenge · ${challengeDate}`
                  : 'Enter your guess below'}
              </p>
            </div>

            {(mode === 'single' || isChallenge) && (
              <div className="space-y-3 sm:space-y-4 pt-4 border-t border-slate-200 shrink-0">
                <p className="text-slate-600 font-medium">
                  Enter your guess in seconds
                </p>

                <div className="w-full text-center text-3xl font-black py-3.5 sm:py-4 px-6 bg-white border-2 border-slate-200 rounded-2xl text-slate-800">
                  {activeGuess || <span className="text-slate-300">--.--</span>}
                  {activeGuess && <span className="text-slate-400 ml-1 text-xl">s</span>}
                </div>

                <NumberKeypad
                  value={activeGuess}
                  onChange={(value) => setDraftGuess(sanitizeTimeInput(value))}
                  onSubmit={submitCurrentGuess}
                  submitDisabled={!hasGuess}
                  submitLabel="Submit Guess"
                />
              </div>
            )}
          </div>

          <div className={`flip-face flip-back result-scroll absolute inset-0 bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-6 flex flex-col overflow-hidden ${resultTone === 'spoton' ? 'spoton-glow' : ''}`}>
            {(resultTone === 'spoton' || resultTone === 'elite') && (
              <div className="confetti">
                {Array.from({ length: 14 }).map((_, index) => (
                  <span key={index} className={`confetti-piece confetti-${index + 1}`} />
                ))}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto result-scroll space-y-3 sm:space-y-5 relative z-10 pb-3">
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-[0.25em] mb-2">
                  {isChallenge ? 'Daily Target' : 'Secret Time'}
                </p>

                <div className={`${isChallenge ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-7xl'} font-black text-teal-600 tracking-tight leading-none`}>
                  {targetTime.toFixed(2)}s
                </div>
              </div>

              {displayResultMessage && (
                <div className={`inline-flex px-4 py-2 rounded-full border text-sm font-bold ${toneClasses}`}>
                  {displayResultMessage}
                </div>
              )}

              {mode === 'single' && (
                <div className="space-y-3">
                  {hasGuess && guessDistance !== null ? (
                    <>
                      <ResultRow label="Your Guess" value={`${parseFloat(playerGuess).toFixed(2)}s`} />
                      <ResultRow label="You were off by" value={`${guessDistance.toFixed(2)}s`} accent />
                      {rankedMode && ratingChange !== null ? (
                        <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 text-left">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl" aria-hidden="true">
                              {resultRankInfo.rank.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 truncate">
                                {resultRankInfo.rank.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {clockRating} Clock Rating
                              </p>
                            </div>
                            <span className={`font-black ${
                              ratingChange > 0
                                ? 'text-teal-600'
                                : ratingChange < 0
                                  ? 'text-rose-600'
                                  : 'text-slate-500'
                            }`}>
                              {ratingChange >= 0 ? '+' : ''}{ratingChange}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-500 rounded-full transition-all duration-500"
                              style={{ width: `${resultRankInfo.progress}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 font-semibold mt-1.5 text-right">
                            {resultRankInfo.next
                              ? `${resultRankInfo.pointsNeeded} points to ${resultRankInfo.next.name}`
                              : 'Highest rank reached'}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-indigo-50 rounded-2xl px-4 py-3 border border-indigo-200 flex items-center gap-3 text-left">
                          <div className="w-9 h-9 bg-white rounded-xl border border-indigo-100 flex items-center justify-center shrink-0">
                            <Trophy className="w-5 h-5 text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 text-sm">{rankedMode ? 'Ranked mode enabled' : 'Ready to climb the ranks?'}</p>
                            <p className="text-xs text-slate-500">
                              {rankedMode ? 'Your next round will affect Clock Rating.' : 'Your next round can count toward a Clock Rank.'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={rankedMode ? onDisableRanked : onEnableRanked}
                            className={`${rankedMode ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-500 hover:bg-indigo-600'} text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0`}
                          >
                            {rankedMode ? 'Disable Ranked' : 'Enable Ranked'}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <ResultRow label="Your Guess" value="No guess" />
                  )}
                </div>
              )}

              {mode === 'challenge' && guessDistance !== null && (
                <div className="space-y-3">
                  <p className="font-black text-teal-700">🔥 Daily Challenge Complete</p>
                  <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
                    <ResultRow label="Your Guess" value={`${parseFloat(playerGuess).toFixed(2)}s`} />
                    <ResultRow label="Your Error" value={`${guessDistance.toFixed(2)}s`} accent />
                  </div>
                  {dailyOfficial && dailyRank != null && (
                    <div className="bg-white border border-indigo-200 rounded-2xl p-3 space-y-2 text-left">
                      <ResultRow label="Global Rank" value={`#${dailyRank.toLocaleString()}`} />
                      <ResultRow label="Best Score Today" value={dailyBestScore === null ? '-' : `${dailyBestScore.toFixed(2)}s off`} />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <p className="text-xs font-bold text-amber-700">Bonus Rank Earned</p>
                      <p className="text-2xl font-black text-amber-600">+{getDailyReward(dailyStreak)} Rating</p>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3">
                      <p className="text-xs font-bold text-rose-700">Current streak</p>
                      <p className="text-2xl font-black text-rose-600">🔥 {dailyStreak}</p>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-slate-500">Tomorrow's Clock Rating bonus: +{nextDailyReward} · Next challenge in {dailyCountdown}</p>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 relative z-10 shrink-0">
              {!isChallenge && (
                <button
                  onClick={onPlayAgain}
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98]"
                >
                  <RotateCcw className="w-5 h-5" />
                  Play Again
                </button>
              )}

              <button
                onClick={onGoHome}
                className="w-full app-secondary-action font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                {isChallenge ? 'Back to Home' : 'Back to Time Guesser'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsSectionLabel({ children }: { children: ReactNode }) {
  return <p className="pt-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">{children}</p>;
}

function ResultRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl px-4 sm:px-5 py-3 sm:py-4 flex justify-between items-center gap-3 border border-slate-200">
      <span className="font-medium text-slate-500 text-left">
        {label}
      </span>

      <span className={`font-bold text-base sm:text-lg text-right ${accent ? 'text-amber-600' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
}

export default App;


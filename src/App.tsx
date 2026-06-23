import { useState, useEffect, useCallback, useRef, type MouseEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
} from 'lucide-react';
import TimeLadder from './TimeLadder';
import HardcoreMode, { type HardcoreDifficulty, type HardcoreScores } from './HardcoreMode';
import AmbientMusic from './AmbientMusic';
import LadderIcon from './LadderIcon';
import HelpOverlay, { type HelpContent } from './HelpOverlay';
import { triggerHaptic } from './haptics';

type GameMode = 'home' | 'single' | 'party' | 'challenge';

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
  | 'partyResults';

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
}

type DailyResults = Record<string, DailyResult>;

interface DailyRetentionState {
  streak: number;
  lastCompletedDate: string | null;
  claimedDates: string[];
}

const CARD_HEIGHT = 'app-card';
const MAX_AVERAGE_ERROR = 100;

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
    items: ['Sounds and ambient music have separate controls.', 'Reduced Motion removes or shortens movement effects.', 'Dark Mode, haptics and Party timer range persist on this device.'],
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
  music: false,
  haptics: true,
  rankedMode: true,
  reducedMotion: false,
  partyTimerRange: 'standard',
  darkMode: false,
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
  return streak >= 10 ? 60 : Math.max(10, streak * 5 + 5);
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
    error < 0.005 ? 110 :
    error < 0.1 ? 85 :
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
      return {
        sounds: typeof parsed.sounds === 'boolean' ? parsed.sounds : defaultSettings.sounds,
        music: typeof parsed.music === 'boolean' ? parsed.music : defaultSettings.music,
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

  useEffect(() => {
    localStorage.setItem('timegames-stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('timegames-settings', JSON.stringify(settings));
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
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('timegames-ladder-best', bestLadderLevel.toString());
  }, [bestLadderLevel]);

  useEffect(() => {
    localStorage.setItem('timegames-hardcore-bests', JSON.stringify(hardcoreScores));
  }, [hardcoreScores]);

  const playTone = useCallback((frequency = 440, duration = 0.08) => {
    if (!settings.sounds) return;
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
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
    if (mode === 'party' && settings.partyTimerRange !== 'standard') {
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
        playTone(420, 0.06);

        const timer = setTimeout(() => {
          setGame(prev => ({
            ...prev,
            countdownValue: prev.countdownValue - 1,
          }));
        }, 1000);

        return () => clearTimeout(timer);
      }

      playTone(720, 0.1);
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
        playTone(220, 0.12);
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
          phase: prev.mode === 'party' ? 'partyGuesses' : 'reveal',
          timeRevealed: prev.mode === 'party' ? true : prev.timeRevealed,
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

  const submitGuess = useCallback(() => {
    const distance = Math.abs(parseFloat(game.playerGuess) - game.targetTime);
    if (!Number.isFinite(distance)) return;
    if (game.dailyOfficial && game.challengeDate) {
      if (dailyResults[game.challengeDate] || dailySubmissionRef.current === game.challengeDate) return;
      dailySubmissionRef.current = game.challengeDate;
    }

    const ratingChange = game.mode === 'single' && settings.rankedMode
      ? calculateRatingChange(distance, stats.clockRating)
      : null;

    if (game.mode === 'single' || game.dailyOfficial) {
      updateStats(distance);
    }
    if (game.mode === 'challenge' && game.dailyOfficial && game.challengeDate) {
      const dateKey = game.challengeDate;
      const standing = getSimulatedDailyStanding(distance, dateKey);
      setDailyResults(prev => ({
        ...prev,
        [dateKey]: {
          target: game.targetTime,
          guess: parseFloat(game.playerGuess),
          error: distance,
          simulatedRank: standing.rank,
          simulatedPlayers: standing.players,
          simulatedPercentile: standing.percentile,
        },
      }));
      // The participation reward belongs only to today's official challenge.
      // A challenge left open across midnight may still save its result, but cannot claim an archived-day bonus.
      if (dateKey === getLocalDateKey() && !dailyRetention.claimedDates.includes(dateKey)) {
        const completionDate = new Date(`${dateKey}T12:00:00`);
        completionDate.setDate(completionDate.getDate() - 1);
        const previousDateKey = getLocalDateKey(completionDate);
        const newStreak = dailyRetention.lastCompletedDate === previousDateKey
          ? dailyRetention.streak + 1
          : 1;
        const dailyBonus = getDailyReward(newStreak);
        setDailyRetention(prev => ({
          streak: newStreak,
          lastCompletedDate: dateKey,
          claimedDates: [...prev.claimedDates, dateKey],
        }));
        setStats(prev => ({ ...prev, clockRating: prev.clockRating + dailyBonus }));
      }
    }
    if (ratingChange !== null) {
      setStats(prev => ({
        ...prev,
        clockRating: Math.max(0, prev.clockRating + ratingChange),
      }));
    }
    if (distance < 0.005) playCelebration();
    else playTone(distance < 0.5 ? 880 : 520, 0.12);
    vibrate(distance < 0.5 ? [30, 40, 30] : 30);

    setGame(prev => ({
      ...prev,
      timeRevealed: true,
      ratingChange,
    }));
  }, [game, dailyResults, dailyRetention, settings.rankedMode, stats.clockRating, updateStats, playTone, playCelebration, vibrate]);

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
  }, []);

  const resetStats = useCallback(() => {
    setStats(defaultStats);
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

  const handleMenuClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest('button')) return;
    if (['ready', 'guesserHub', 'stats', 'settings', 'rankings', 'dailyHub', 'partySetup'].includes(game.phase)) {
      playTone(620, 0.045);
    }
  }, [game.phase, playTone]);

  const helpContent = getHelpContent(game);
  const showHelp =
    ['ready', 'guesserHub', 'dailyHub', 'dailyHistory', 'partySetup', 'stats', 'settings', 'rankings', 'ladder'].includes(game.phase) ||
    (game.phase === 'hardcore' && hardcoreHelpVisible);

  return (
    <div onClickCapture={handleMenuClick} className={`app-viewport bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center ${settings.reducedMotion ? '[&_*]:!animate-none [&_*]:!transition-none' : ''} ${settings.darkMode ? 'dark-mode' : ''}`}>
      <AmbientMusic enabled={settings.music} paused={game.phase === 'playing' || standaloneTimingActive} />
      <div className="w-full max-w-md relative min-h-0">
        {showHelp && <HelpOverlay content={helpContent} />}
        {game.mode === 'home' && game.phase === 'ready' && (
          <HomeScreen
            bestLadderLevel={bestLadderLevel}
            bestHardcoreScore={Math.max(...Object.values(hardcoreScores))}
            rankedMode={settings.rankedMode}
            onTimeGuesser={showTimeGuesser}
            onTimeLadder={showTimeLadder}
            onHardcore={showHardcoreMode}
            onStats={showStats}
            onSettings={showSettings}
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
            dailyStreak={activeDailyStreak}
            nextDailyReward={nextDailyReward}
            dailyCountdown={dailyCountdown}
            onPlayToday={openDailyChallenge}
            onPrevious={showPreviousDailyHistory}
            onBack={showTimeGuesser}
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
            onNewPlayerNameChange={setNewPlayerName}
            onAddPlayer={addPartyPlayer}
            onRemovePlayer={removePartyPlayer}
            onStartRound={startPartyRound}
            onGoHome={showTimeGuesser}
          />
        )}

        {game.phase === 'countdown' && (
          <CountdownScreen value={game.countdownValue} />
        )}

        {game.phase === 'playing' && <PlayingScreen />}

        {game.phase === 'stopped' && <StoppedScreen />}

        {game.phase === 'partyGuesses' && (
          <PartyGuessesScreen
            players={partyPlayers}
            onGuessChange={updatePartyGuess}
            onGuessBlur={formatPartyGuess}
            onShowResults={showPartyResults}
            onGoHome={showTimeGuesser}
          />
        )}

        {game.phase === 'partyResults' && (
          <PartyResultsScreen
            targetTime={game.targetTime}
            players={partyPlayers}
            onNextRound={startPartyRound}
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
            onGoHome={showTimeGuesser}
          />
        )}
      </div>
    </div>
  );
}

function HomeScreen({
  bestLadderLevel,
  bestHardcoreScore,
  rankedMode,
  onTimeGuesser,
  onTimeLadder,
  onHardcore,
  onStats,
  onSettings,
}: {
  bestLadderLevel: number;
  bestHardcoreScore: number;
  rankedMode: boolean;
  onTimeGuesser: () => void;
  onTimeLadder: () => void;
  onHardcore: () => void;
  onStats: () => void;
  onSettings: () => void;
}) {
  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 ${CARD_HEIGHT} flex flex-col`}>
      <div className="flex items-center justify-between mb-4">
        <div className="w-11" />
        <div className="text-center">
          <div className="w-12 h-12 mx-auto bg-teal-500 rounded-2xl flex items-center justify-center">
            <Clock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mt-1">TimeGames</h1>
          <p className="text-xs text-slate-500">Master your internal clock.</p>
        </div>
        <div className="w-11" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto card-scroll space-y-3 pr-1">
        <GameMenuCard color="teal" icon={<Clock className="w-7 h-7" />} title="Time Guesser" description={`${rankedMode ? 'Ranked' : 'Casual'} · Hidden-clock guessing`} onClick={onTimeGuesser} />
        <GameMenuCard color="indigo" icon={<LadderIcon className="w-7 h-7" />} title="Time Ladder" description={`Climb from 1s to 20s · Best level ${bestLadderLevel}`} onClick={onTimeLadder} />
        <GameMenuCard color="red" icon={<Skull className="w-7 h-7" />} title="Hardcore Mode" description={`Three lives · Endless score · Best ${bestHardcoreScore}`} onClick={onHardcore} />
        <GameMenuCard color="rose" icon={<BarChart3 className="w-7 h-7" />} title="Stats" description="See your progress across TimeGames." onClick={onStats} />
        <GameMenuCard color="slate" icon={<Settings className="w-7 h-7" />} title="Settings" description="Sound, haptics and display." onClick={onSettings} />
      </div>
    </div>
  );
}

function GameMenuCard({ color, icon, title, description, onClick }: {
  color: 'teal' | 'indigo' | 'red' | 'rose' | 'slate';
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  const colorClasses = {
    teal: 'bg-teal-500 hover:bg-teal-600 shadow-teal-500/20',
    indigo: 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20',
    red: 'bg-red-700 hover:bg-red-800 shadow-red-700/20',
    rose: 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20',
    slate: 'bg-slate-700 hover:bg-slate-800 shadow-slate-700/20',
  }[color];
  return (
    <button onClick={onClick} className={`w-full ${colorClasses} text-white rounded-3xl p-4 grid grid-cols-[48px_1fr_48px] items-center text-center shadow-lg transition-all active:scale-[0.98]`}>
      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">{icon}</div>
      <div><p className="text-lg font-black">{title}</p><p className="text-sm text-white/80">{description}</p></div>
      <span className="w-12" aria-hidden="true" />
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
    <div className={`bg-white rounded-3xl shadow-xl p-6 text-center ${CARD_HEIGHT} flex flex-col justify-center gap-5`}>
      <div className="space-y-2">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center">
            <Clock className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          Time Guesser
        </h1>

        <p className="text-sm text-slate-500">
          Guess how long the hidden clock ran.
        </p>
      </div>

      <div className="h-[82px] bg-slate-50 border border-slate-200 rounded-2xl flex items-stretch overflow-hidden relative">
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

      <div className="space-y-2.5">
        <GameMenuCard color="teal" icon={<Clock className="w-6 h-6" />} title={`Single Player ${rankedMode ? 'Ranked' : 'Casual'}`} description={rankedMode ? 'Build your Clock Rating.' : 'Practice without rating pressure.'} onClick={onSinglePlayer} />
        <GameMenuCard
          color="indigo"
          icon={<CalendarDays className="w-6 h-6" />}
          title="Daily Challenge"
          description={todayResult
            ? `🔥 ${dailyStreak} day streak · Tomorrow's rating bonus +${nextDailyReward} · New in ${dailyCountdown}`
            : `${dailyStreak > 0 ? `🔥 ${dailyStreak} day streak · ` : ''}Clock Rating bonus +${nextDailyReward} · Next in ${dailyCountdown}`}
          onClick={onChallengeMode}
        />
        <GameMenuCard color="rose" icon={<Users className="w-6 h-6" />} title="Party Mode" description="Compete to be closest with friends." onClick={onPartyMode} />
      </div>

      <div>
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
  dailyStreak,
  nextDailyReward,
  dailyCountdown,
  onPlayToday,
  onPrevious,
  onBack,
}: {
  results: DailyResults;
  dailyStreak: number;
  nextDailyReward: number;
  dailyCountdown: string;
  onPlayToday: () => void;
  onPrevious: () => void;
  onBack: () => void;
}) {
  const today = getLocalDateKey();
  const todayResult = results[today];
  const standing = todayResult ? getSimulatedDailyStanding(todayResult.error, today) : null;

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-7 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="space-y-1.5 mb-3 shrink-0">
        <div className="w-14 h-14 mx-auto bg-indigo-500 rounded-2xl flex items-center justify-center">
          <CalendarDays className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-slate-800">Daily Challenge</h1>
        <p className="text-slate-500">{todayResult ? "Today's attempt is complete. Come back tomorrow!" : 'Play today from the Time Guesser menu.'}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions flex flex-col justify-center">
      {todayResult && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 mb-3">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-indigo-500">Today's score</p>
          <p className="text-4xl font-black text-indigo-700 mt-1">{todayResult.error.toFixed(2)}s off</p>
          <p className="text-sm text-slate-500 mt-1">
            Guessed {todayResult.guess.toFixed(2)}s · Target {todayResult.target.toFixed(2)}s
          </p>
          {standing && (
            <div className="mt-2 pt-2 border-t border-indigo-200">
              <p className="font-black text-indigo-700">Simulated global rank #{standing.rank.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Top {100 - standing.percentile + 1}% of {standing.players.toLocaleString()} players · Local preview</p>
            </div>
          )}
        </div>
      )}

      {!todayResult && (
        <button onClick={onPlayToday} className="w-full max-w-xs mx-auto bg-teal-500 hover:bg-teal-600 text-white font-black py-4 rounded-2xl mb-4 transition-colors shadow-lg shadow-teal-500/20">
          Play Today's Challenge
        </button>
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
        <button onClick={onBack} className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          Back
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
      </div>

      <div className="space-y-3 pt-4 shrink-0 bg-white relative z-10 app-bottom-actions">
        <button
          onClick={onBack}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98]"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <button
          onClick={() => setShowResetConfirmation(true)}
          className="w-full app-secondary-action font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200"
        >
          Reset Statistics
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
              This will erase Time Guesser accuracy statistics and Clock Rating. Daily, Time Ladder and Hardcore records are kept.
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
    { key: 'music', label: 'Music', description: 'Inquisitive ambient soundtrack', icon: Music },
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
            <div key={option.key} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
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

      <button onClick={onBack} className="mt-4 w-full shrink-0 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 relative z-10 app-bottom-actions">
        <ArrowLeft className="w-5 h-5" />
        Back
      </button>
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
  onNewPlayerNameChange,
  onAddPlayer,
  onRemovePlayer,
  onStartRound,
  onGoHome,
}: {
  players: PartyPlayer[];
  newPlayerName: string;
  onNewPlayerNameChange: (value: string) => void;
  onAddPlayer: () => void;
  onRemovePlayer: (id: string) => void;
  onStartRound: () => void;
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
          Add players, guess the time, rank the results.
        </p>
      </div>

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

function CountdownScreen({ value }: { value: number }) {
  const display = value === 0 ? '' : value.toString();

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex items-center justify-center`}>
      <div className="text-8xl font-black text-slate-800 transition-all duration-150">
        {display}
      </div>
    </div>
  );
}

function PlayingScreen() {
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

function StoppedScreen() {
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
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="space-y-2 mb-5">
        <h1 className="text-3xl font-black text-slate-800">
  Enter Guesses
</h1>

<p className="text-slate-500">
  Add guesses for whoever wants to play this round.
</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto card-scroll scroll-content-with-actions space-y-3 pr-1">
        {players.map((player, index) => (
          <div
            key={player.id}
            className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">
                {player.name}
              </span>

              <span className="text-sm text-slate-400">
                {player.score} pts
              </span>
            </div>

            <div className="relative">
              <input
                ref={(element) => { inputRefs.current[index] = element; }}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]{0,2}"
                value={player.guess}
                onChange={(e) => onGuessChange(player.id, sanitizeTimeInput(e.target.value))}
                onBlur={(e) => onGuessBlur(player.id, e.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || !isValidTimeInput(player.guess)) return;
                  event.preventDefault();
                  onGuessBlur(player.id, player.guess);
                  inputRefs.current[index + 1]?.focus();
                }}
                placeholder="Your guess"
                className="w-full text-center text-2xl font-semibold py-3 px-5 pr-12 bg-white border-2 border-slate-200 rounded-2xl focus:border-teal-500 focus:outline-none transition-colors placeholder:text-slate-300"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                s
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-4 shrink-0 app-bottom-actions">
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
  onNextRound,
  onGoHome,
}: {
  targetTime: number;
  players: PartyPlayer[];
  onNextRound: () => void;
  onGoHome: () => void;
}) {
  const [showScoreboard, setShowScoreboard] = useState(false);

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
          <div className="bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-[0.2em]">
              Secret Time
            </p>
            <p className="text-3xl font-black text-teal-600">
              {targetTime.toFixed(2)}s
            </p>
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
  onSubmitGuess: () => void;
  onPlayAgain: () => void;
  dailyStreak: number;
  nextDailyReward: number;
  dailyCountdown: string;
  onGoHome: () => void;
}) {
  const hasGuess = isValidTimeInput(playerGuess);
  const isChallenge = mode === 'challenge';
  const resultRankInfo = getRank(clockRating);
  const simulatedStanding = isChallenge && challengeDate && guessDistance !== null
    ? getSimulatedDailyStanding(guessDistance, challengeDate)
    : null;

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

                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]{0,2}"
                    value={playerGuess}
                    onChange={(e) => onGuessChange(sanitizeTimeInput(e.target.value))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && hasGuess) onSubmitGuess();
                    }}
                    onBlur={(e) => {
                      if (isValidTimeInput(e.target.value)) {
                        onGuessChange(Number(e.target.value).toFixed(2));
                      }
                    }}
                    placeholder="Your guess"
                    className="w-full text-center text-2xl sm:text-3xl font-semibold py-3.5 sm:py-4 px-6 pr-16 bg-white border-2 border-slate-200 rounded-2xl focus:border-teal-500 focus:outline-none transition-colors placeholder:text-slate-300"
                  />

                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xl">
                    s
                  </span>
                </div>

                <button
                  onClick={onSubmitGuess}
                  disabled={!hasGuess}
                  className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 shadow-lg shadow-teal-500/25 disabled:shadow-none"
                >
                  Submit Guess
                </button>
              </div>
            )}
          </div>

          <div className={`flip-face flip-back result-scroll absolute inset-0 bg-slate-50 border border-slate-200 rounded-3xl p-4 sm:p-6 flex flex-col justify-between overflow-y-auto ${resultTone === 'spoton' ? 'spoton-glow' : ''}`}>
            {(resultTone === 'spoton' || resultTone === 'elite') && (
              <div className="confetti">
                {Array.from({ length: 14 }).map((_, index) => (
                  <span key={index} className={`confetti-piece confetti-${index + 1}`} />
                ))}
              </div>
            )}

            <div className="space-y-3 sm:space-y-5 relative z-10">
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-[0.25em] mb-2">
                  {isChallenge ? 'Daily Target' : 'Secret Time'}
                </p>

                <div className="text-5xl sm:text-7xl font-black text-teal-600 tracking-tight leading-none">
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
                  <ResultRow label="Your Guess" value={`${parseFloat(playerGuess).toFixed(2)}s`} />
                  <ResultRow label="You were off by" value={`${guessDistance.toFixed(2)}s`} accent />
                  {simulatedStanding && dailyOfficial && (
                    <p className="text-xs font-bold text-indigo-600">Simulated global rank #{simulatedStanding.rank.toLocaleString()} of {simulatedStanding.players.toLocaleString()}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <p className="text-xs font-bold text-amber-700">Clock Rating bonus</p>
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

            <div className="space-y-3 pt-5 relative z-10">
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
                Back to Time Guesser
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

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Smartphone,
  Sparkles,
} from 'lucide-react';

type GameMode = 'home' | 'single' | 'party' | 'challenge';

type GamePhase =
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'challengePlaying'
  | 'stopped'
  | 'reveal'
  | 'stats'
  | 'settings'
  | 'rankings'
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
  challengeElapsed: number | null;
  ratingChange: number | null;
}

interface StatsState {
  gamesPlayed: number;
  bestAccuracy: number | null;
  averageError: number | null;
  spotOns: number;
  clockRating: number;
  challengeBestTime: number | null;
}

interface SettingsState {
  sounds: boolean;
  haptics: boolean;
  rankedMode: boolean;
  reducedMotion: boolean;
  countdownSeconds: 0 | 3 | 5;
  decimalPrecision: 2 | 3;
  partyTimerRange: 'short' | 'standard' | 'long';
  highContrast: boolean;
  largeUI: boolean;
}

type ToggleSettingKey =
  | 'sounds'
  | 'haptics'
  | 'reducedMotion'
  | 'highContrast'
  | 'largeUI';

interface PartyPlayer {
  id: string;
  name: string;
  score: number;
  guess: string;
}

const CARD_HEIGHT = 'h-[680px]';
const CHALLENGE_TARGET = 10;

const defaultStats: StatsState = {
  gamesPlayed: 0,
  bestAccuracy: null,
  averageError: null,
  spotOns: 0,
  clockRating: 0,
  challengeBestTime: null,
};

const defaultSettings: SettingsState = {
  sounds: true,
  haptics: true,
  rankedMode: true,
  reducedMotion: false,
  countdownSeconds: 3,
  decimalPrecision: 2,
  partyTimerRange: 'standard',
  highContrast: false,
  largeUI: false,
};

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
    challengeElapsed: null,
    ratingChange: null,
  });

  const [stats, setStats] = useState<StatsState>(() => {
    try {
      const saved = localStorage.getItem('timegames-stats');
      const parsed = saved ? JSON.parse(saved) : {};
      return {
        gamesPlayed: Number(parsed.gamesPlayed) || 0,
        bestAccuracy: typeof parsed.bestAccuracy === 'number' ? parsed.bestAccuracy : null,
        averageError: typeof parsed.averageError === 'number' ? parsed.averageError : null,
        spotOns: Number(parsed.spotOns) || 0,
        clockRating: Math.max(0, Number(parsed.clockRating) || 0),
        challengeBestTime: typeof parsed.challengeBestTime === 'number'
          ? parsed.challengeBestTime
          : null,
      };
    } catch {
      return defaultStats;
    }
  });

  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const saved = localStorage.getItem('timegames-settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [partyPlayers, setPartyPlayers] = useState<PartyPlayer[]>([]);

  const [newPlayerName, setNewPlayerName] = useState('');

  const timerRef = useRef<number | null>(null);
  const challengeStartRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('timegames-stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('timegames-settings', JSON.stringify(settings));
  }, [settings]);

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
    if (settings.haptics && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, [settings.haptics]);

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

  const startCountdown = useCallback((mode: GameMode) => {
    clearGameTimer();
    const countdownDisabled = settings.countdownSeconds === 0;

    if (countdownDisabled && mode === 'challenge') {
      challengeStartRef.current = performance.now();
    }

    setGame({
      mode,
      phase: countdownDisabled
        ? mode === 'challenge' ? 'challengePlaying' : 'playing'
        : 'countdown',
      targetTime: mode === 'challenge' ? CHALLENGE_TARGET : generateTargetTime(mode),
      playerGuess: '',
      countdownValue: settings.countdownSeconds,
      timeRevealed: false,
      challengeElapsed: null,
      ratingChange: null,
    });
  }, [clearGameTimer, generateTargetTime, settings.countdownSeconds]);

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

      if (game.mode === 'challenge') {
        challengeStartRef.current = performance.now();

        setGame(prev => ({
          ...prev,
          phase: 'challengePlaying',
        }));
      } else {
        setGame(prev => ({
          ...prev,
          phase: 'playing',
        }));
      }
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
      const previousTotal = (prev.averageError || 0) * prev.gamesPlayed;
      const newAverageError = (previousTotal + distance) / newGamesPlayed;

      return {
        gamesPlayed: newGamesPlayed,
        bestAccuracy: prev.bestAccuracy === null ? distance : Math.min(prev.bestAccuracy, distance),
        averageError: newAverageError,
        spotOns: distance < 0.005 ? prev.spotOns + 1 : prev.spotOns,
        clockRating: prev.clockRating,
        challengeBestTime: prev.challengeBestTime,
      };
    });
  }, []);

  const revealTime = useCallback(() => {
    playTone(520, 0.08);
    vibrate(30);

    setGame(prev => ({
      ...prev,
      timeRevealed: true,
    }));
  }, [playTone, vibrate]);

  const submitGuess = useCallback(() => {
    const distance = Math.abs(parseFloat(game.playerGuess) - game.targetTime);
    if (!Number.isFinite(distance)) return;

    const ratingChange = settings.rankedMode
      ? calculateRatingChange(distance, stats.clockRating)
      : null;

    updateStats(distance);
    if (ratingChange !== null) {
      setStats(prev => ({
        ...prev,
        clockRating: Math.max(0, prev.clockRating + ratingChange),
      }));
    }
    playTone(distance < 0.5 ? 880 : 520, 0.12);
    vibrate(distance < 0.5 ? [30, 40, 30] : 30);

    setGame(prev => ({
      ...prev,
      timeRevealed: true,
      ratingChange,
    }));
  }, [game.playerGuess, game.targetTime, settings.rankedMode, stats.clockRating, updateStats, playTone, vibrate]);

  const stopChallenge = useCallback(() => {
    if (!challengeStartRef.current) return;

    const precisionFactor = 10 ** settings.decimalPrecision;
    const elapsed = Math.round(
      ((performance.now() - challengeStartRef.current) / 1000) * precisionFactor
    ) / precisionFactor;
    const distance = Math.abs(elapsed - CHALLENGE_TARGET);

    updateStats(distance);
    setStats(prev => {
      const previousBestError = prev.challengeBestTime === null
        ? Number.POSITIVE_INFINITY
        : Math.abs(prev.challengeBestTime - CHALLENGE_TARGET);

      return {
        ...prev,
        challengeBestTime: distance < previousBestError
          ? elapsed
          : prev.challengeBestTime,
      };
    });
    playTone(distance < 0.5 ? 880 : 220, 0.12);
    vibrate(distance < 0.5 ? [30, 40, 30] : [40, 30, 40]);

    setGame(prev => ({
      ...prev,
      challengeElapsed: elapsed,
      timeRevealed: true,
      phase: 'reveal',
    }));
  }, [settings.decimalPrecision, updateStats, playTone, vibrate]);

  const playAgain = useCallback(() => {
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
      challengeElapsed: null,
      ratingChange: null,
    });
  }, [clearGameTimer]);

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

  const hideRankings = useCallback(() => {
    setGame(prev => ({ ...prev, mode: 'home', phase: 'ready' }));
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
    if (!guess) return;

    setPartyPlayers(prev =>
      prev.map(player =>
        player.id === id
          ? {
              ...player,
              guess: Number(guess).toFixed(settings.decimalPrecision),
            }
          : player
      )
    );
  }, [settings.decimalPrecision]);

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
    .filter(player => player.guess.trim() !== '')
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

  playTone(780, 0.12);
  vibrate([30, 40, 30]);

  setGame(prev => ({
    ...prev,
    phase: 'partyResults',
  }));
}, [partyPlayers, game.targetTime, playTone, vibrate]);

  const newPartyGame = useCallback(() => {
    setPartyPlayers(prev =>
      prev.map(player => ({
        ...player,
        score: 0,
        guess: '',
      }))
    );

    setGame(prev => ({
      ...prev,
      mode: 'party',
      phase: 'partySetup',
    }));
  }, []);

  const guessDistance = (() => {
    if (game.mode === 'challenge' && game.challengeElapsed !== null) {
      return Math.abs(game.challengeElapsed - CHALLENGE_TARGET);
    }

    if (game.playerGuess) {
      return Math.abs(parseFloat(game.playerGuess) - game.targetTime);
    }

    return null;
  })();

  return (
    <div className={`min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4 ${settings.reducedMotion ? '[&_*]:!animate-none [&_*]:!transition-none' : ''} ${settings.highContrast ? 'contrast-125' : ''} ${settings.largeUI ? '[&_button]:!text-lg [&_input]:!text-lg' : ''}`}>
      <div className="w-full max-w-md">
        {game.mode === 'home' && game.phase === 'ready' && (
          <HomeScreen
            stats={stats}
            rankedMode={settings.rankedMode}
            onRankedModeChange={(value) => updateSetting('rankedMode', value)}
            onSinglePlayer={() => startCountdown('single')}
            onPartyMode={openPartySetup}
            onChallengeMode={() => startCountdown('challenge')}
            onStats={showStats}
            onSettings={showSettings}
            onRankings={showRankings}
          />
        )}

        {game.phase === 'rankings' && (
          <RankingsScreen
            clockRating={stats.clockRating}
            onBack={hideRankings}
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
            decimalPrecision={settings.decimalPrecision}
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
            onGoHome={goHome}
          />
        )}

        {game.phase === 'countdown' && (
          <CountdownScreen value={game.countdownValue} />
        )}

        {game.phase === 'playing' && <PlayingScreen />}

        {game.phase === 'challengePlaying' && (
          <ChallengePlayingScreen onStop={stopChallenge} />
        )}

        {game.phase === 'stopped' && <StoppedScreen />}

        {game.phase === 'partyGuesses' && (
          <PartyGuessesScreen
            targetTime={game.targetTime}
            players={partyPlayers}
            onGuessChange={updatePartyGuess}
            onGuessBlur={formatPartyGuess}
            onShowResults={showPartyResults}
            onGoHome={goHome}
          />
        )}

        {game.phase === 'partyResults' && (
          <PartyResultsScreen
            targetTime={game.targetTime}
            players={partyPlayers}
            decimalPrecision={settings.decimalPrecision}
            onNextRound={startPartyRound}
            onNewGame={newPartyGame}
            onGoHome={goHome}
          />
        )}

        {game.phase === 'reveal' && game.mode !== 'home' && game.mode !== 'party' && (
          <RevealScreen
            mode={game.mode}
            targetTime={game.targetTime}
            challengeElapsed={game.challengeElapsed}
            timeRevealed={game.timeRevealed}
            playerGuess={game.playerGuess}
            guessDistance={guessDistance}
            ratingChange={game.ratingChange}
            clockRating={stats.clockRating}
            challengeBestTime={stats.challengeBestTime}
            decimalPrecision={settings.decimalPrecision}
            rankedMode={settings.rankedMode}
            onEnableRanked={() => updateSetting('rankedMode', true)}
            onRevealTime={revealTime}
            onGuessChange={(value) =>
              setGame(prev => ({
                ...prev,
                playerGuess: value,
              }))
            }
            onSubmitGuess={submitGuess}
            onPlayAgain={playAgain}
            onGoHome={goHome}
          />
        )}
      </div>
    </div>
  );
}

function HomeScreen({
  stats,
  rankedMode,
  onRankedModeChange,
  onSinglePlayer,
  onPartyMode,
  onChallengeMode,
  onStats,
  onSettings,
  onRankings,
}: {
  stats: StatsState;
  rankedMode: boolean;
  onRankedModeChange: (value: boolean) => void;
  onSinglePlayer: () => void;
  onPartyMode: () => void;
  onChallengeMode: () => void;
  onStats: () => void;
  onSettings: () => void;
  onRankings: () => void;
}) {
  const rankInfo = getRank(stats.clockRating);

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-6 text-center ${CARD_HEIGHT} flex flex-col justify-center gap-5`}>
      <div className="space-y-2">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center">
            <Clock className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          TimeGames
        </h1>

        <p className="text-sm text-slate-500">
          How good is your internal clock?
        </p>
      </div>

      <div className="h-[82px] bg-slate-50 border border-slate-200 rounded-2xl flex items-stretch overflow-hidden relative">
        <div className="flex-1 min-w-0">
          {rankedMode ? (
          <button
            type="button"
            onClick={onRankings}
            aria-label="View all Clock Ranks"
            className="w-full h-full hover:bg-slate-100 px-4 text-left transition-colors flex items-center gap-3"
          >
            <span className="text-3xl shrink-0" aria-hidden="true">{rankInfo.rank.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-800 truncate">{rankInfo.rank.name}</p>
              <p className="hidden">
                {stats.clockRating} rating
                {rankInfo.next ? ` · ${rankInfo.pointsNeeded} to next` : ' · Top rank'}
              </p>
              <p className="text-xs text-slate-500">
                {stats.clockRating} rating{' - '}
                {rankInfo.next ? `${rankInfo.pointsNeeded} to next` : 'Top rank'}
              </p>
            </div>
            <span className="hidden" aria-hidden="true">›</span>
            <span className="text-xl text-slate-300" aria-hidden="true">&gt;</span>
          </button>
          ) : (
          <div className="w-full h-full px-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-slate-500" />
            </div>
            <div className="text-left min-w-0">
              <p className="font-bold text-slate-800">Casual mode</p>
              <p className="text-xs text-slate-500">Clock Rating is paused</p>
            </div>
          </div>
          )}
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
            <div
              className="h-full bg-teal-500 transition-all duration-500"
              style={{ width: `${rankInfo.progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        <button
          onClick={onSinglePlayer}
          className="w-full bg-teal-500 hover:bg-teal-600 active:scale-[0.98] text-white font-semibold py-3.5 px-5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3"
        >
          <Clock className="w-5 h-5" />
          Single Player ({rankedMode ? 'Ranked' : 'Casual'})
        </button>

        <button onClick={onChallengeMode} className="w-full bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] text-white font-semibold py-3.5 px-5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3">
          <Target className="w-5 h-5" />
          10 Second Challenge
        </button>

        <button onClick={onPartyMode} className="w-full bg-rose-500 hover:bg-rose-600 active:scale-[0.98] text-white font-semibold py-3.5 px-5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-3">
          <Users className="w-5 h-5" />
          Party Mode
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onStats}
          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-3.5 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          <BarChart3 className="w-5 h-5" />
          <span>Stats</span>
        </button>

        <button
          onClick={onSettings}
          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-3.5 px-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}

function StatsScreen({
  stats,
  decimalPrecision,
  onBack,
  onResetStats,
}: {
  stats: StatsState;
  decimalPrecision: 2 | 3;
  onBack: () => void;
  onResetStats: () => void;
}) {
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  const confirmReset = () => {
    onResetStats();
    setShowResetConfirmation(false);
  };

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex flex-col relative overflow-hidden`}>
      <div className="space-y-2 mb-5">
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

      <div className="flex-1 overflow-y-auto space-y-3 text-left pr-1">
        <ResultRow label="Games Played" value={stats.gamesPlayed.toString()} />
        <ResultRow label="Best Accuracy" value={stats.bestAccuracy === null ? '-' : `${stats.bestAccuracy.toFixed(decimalPrecision)}s`} />
        <ResultRow label="Average Error" value={stats.averageError === null ? '-' : `${stats.averageError.toFixed(decimalPrecision)}s`} />
        <ResultRow label="Spot Ons" value={stats.spotOns.toString()} />
        <ResultRow label="Clock Rating" value={stats.clockRating.toString()} accent />
        <ResultRow
          label="10s Personal Best"
          value={stats.challengeBestTime === null ? '-' : `${stats.challengeBestTime.toFixed(decimalPrecision)}s`}
        />
      </div>

      <div className="space-y-3 pt-5">
        <button
          onClick={onBack}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98]"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <button
          onClick={() => setShowResetConfirmation(true)}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200"
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
              This will permanently erase your statistics, personal bests, and Clock Rating.
            </p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={confirmReset}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3.5 px-5 rounded-2xl transition-colors"
              >
                Yes, reset everything
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setShowResetConfirmation(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-5 rounded-2xl transition-colors"
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
    { key: 'haptics', label: 'Haptic Feedback', description: 'Vibration on supported devices', icon: Smartphone },
    { key: 'reducedMotion', label: 'Reduced Motion', description: 'Disable animations and transitions', icon: Sparkles },
    { key: 'highContrast', label: 'High Contrast', description: 'Strengthen colours and definition', icon: BarChart3 },
    { key: 'largeUI', label: 'Larger Controls', description: 'Increase button and input text', icon: Plus },
  ];

  const segmentClass = (active: boolean) =>
    `flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
      active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
    }`;

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 ${CARD_HEIGHT} flex flex-col`}>
      <div className="text-center space-y-2 mb-6">
        <div className="w-14 h-14 mx-auto bg-slate-800 rounded-2xl flex items-center justify-center">
          <Settings className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500">Make TimeGames feel right for you.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
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
                  <p className="font-bold text-slate-800">Countdown Length</p>
                  <p className="text-xs text-slate-500">Time before each round begins</p>
                </div>
                <Clock className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex gap-1 bg-slate-200/70 rounded-xl p-1">
                {([0, 3, 5] as const).map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange('countdownSeconds', value)}
                    className={segmentClass(settings.countdownSeconds === value)}
                  >
                    {value === 0 ? 'Off' : `${value}s`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-slate-800">Result Precision</p>
                  <p className="text-xs text-slate-500">Digits shown after the decimal</p>
                </div>
                <BarChart3 className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex gap-1 bg-slate-200/70 rounded-xl p-1">
                {([2, 3] as const).map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange('decimalPrecision', value)}
                    className={segmentClass(settings.decimalPrecision === value)}
                  >
                    {value} decimals
                  </button>
                ))}
              </div>
            </div>

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

      <button onClick={onBack} className="mt-5 w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2">
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

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
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
        className="mt-5 w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2"
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

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
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

      <div className="space-y-3 pt-5">
        <button
          onClick={onStartRound}
          disabled={players.length < 2}
          className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 shadow-lg shadow-teal-500/25 disabled:shadow-none"
        >
          Start Round
        </button>

        <button
          onClick={onGoHome}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Back to Home
        </button>
      </div>
    </div>
  );
}

function CountdownScreen({ value }: { value: number }) {
  const display = value === 0 ? 'GO' : value.toString();
  const scale = value === 0 ? 'scale-125' : 'scale-100';
  const color = value === 0 ? 'text-teal-500' : 'text-slate-800';

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex items-center justify-center`}>
      <div className={`text-8xl font-black ${color} transition-all duration-150 ${scale}`}>
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

function ChallengePlayingScreen({ onStop }: { onStop: () => void }) {
  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex flex-col items-center justify-center space-y-8`}>
      <div className="space-y-3">
        <p className="text-slate-400 text-sm font-semibold uppercase tracking-[0.25em]">
          Challenge Mode
        </p>

        <h2 className="text-3xl font-black text-slate-800">
          Stop at 10 seconds
        </h2>

        <p className="text-slate-500">
          No timer. Trust your instinct.
        </p>
      </div>

      <button
        onClick={onStop}
        className="w-40 h-40 bg-teal-500 hover:bg-teal-600 active:scale-95 text-white rounded-full text-3xl font-black shadow-2xl shadow-teal-500/30 transition-all duration-200"
      >
        STOP
      </button>
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
  targetTime,
  players,
  onGuessChange,
  onGuessBlur,
  onShowResults,
  onGoHome,
}: {
  targetTime: number;
  players: PartyPlayer[];
  onGuessChange: (id: string, guess: string) => void;
  onGuessBlur: (id: string, guess: string) => void;
  onShowResults: () => void;
  onGoHome: () => void;
}) {
  const atLeastOneGuessEntered = players.some(player => player.guess.trim() !== '');

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

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {players.map(player => (
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
                type="number"
                step="0.01"
                value={player.guess}
                onChange={(e) => onGuessChange(player.id, e.target.value)}
                onBlur={(e) => onGuessBlur(player.id, e.target.value)}
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

      <div className="space-y-2 pt-4">
        <button
          onClick={onShowResults}
          disabled={!atLeastOneGuessEntered}
          className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 shadow-lg shadow-teal-500/25 disabled:shadow-none"
        >
          Show Results
        </button>

        <button
          onClick={onGoHome}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Back to Home
        </button>
      </div>
    </div>
  );
}

function PartyResultsScreen({
  targetTime,
  players,
  decimalPrecision,
  onNextRound,
  onNewGame,
  onGoHome,
}: {
  targetTime: number;
  players: PartyPlayer[];
  decimalPrecision: 2 | 3;
  onNextRound: () => void;
  onNewGame: () => void;
  onGoHome: () => void;
}) {
  const [showScoreboard, setShowScoreboard] = useState(false);

  const rankedPlayers = [...players]
    .filter(player => player.guess.trim() !== '')
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

  const sortedScoreboard = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className={`bg-white rounded-3xl shadow-xl p-8 text-center ${CARD_HEIGHT} flex flex-col`}>
      <div className="space-y-2 mb-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-teal-500 rounded-2xl flex items-center justify-center">
            <Trophy className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-slate-800">
          {showScoreboard ? 'Scoreboard' : isTie ? "It's a tie!" : `${winners[0]?.name} wins!`}
        </h1>

        {!showScoreboard && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-[0.2em]">
              Secret Time
            </p>
            <p className="text-3xl font-black text-teal-600">
              {targetTime.toFixed(decimalPrecision)}s
            </p>
          </div>
        )}

        {showScoreboard && (
          <p className="text-slate-500">
            Current party standings
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {!showScoreboard &&
          rankedPlayers.map((player, index) => {
            const tiedWinner = Math.abs(player.distance - winningDistance) <= 0.005;

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
                    <p className="font-bold text-slate-800">
                      {player.name}
                    </p>

                    <p className="text-sm text-slate-400">
                      Guessed {parseFloat(player.guess).toFixed(decimalPrecision)}s
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`font-black ${tiedWinner ? 'text-teal-600' : 'text-slate-800'}`}>
                    {player.distance.toFixed(decimalPrecision)}s
                  </p>

                  <p className="text-xs text-slate-400">
                    off
                  </p>
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

      <div className="space-y-3 pt-5">
        <button
          onClick={onNextRound}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98]"
        >
          <RotateCcw className="w-5 h-5" />
          Next Round
        </button>

        <button
          onClick={() => setShowScoreboard(prev => !prev)}
          className="w-full bg-white hover:bg-slate-100 text-slate-700 font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 border border-slate-200 flex items-center justify-center gap-2"
        >
          <Trophy className="w-5 h-5" />
          {showScoreboard ? 'Round Results' : 'Scoreboard'}
        </button>

        <button
          onClick={onGoHome}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          Back to Home
        </button>
      </div>
    </div>
  );
}
function RevealScreen({
  mode,
  targetTime,
  challengeElapsed,
  timeRevealed,
  playerGuess,
  guessDistance,
  ratingChange,
  clockRating,
  challengeBestTime,
  decimalPrecision,
  rankedMode,
  onEnableRanked,
  onRevealTime,
  onGuessChange,
  onSubmitGuess,
  onPlayAgain,
  onGoHome,
}: {
  mode: GameMode;
  targetTime: number;
  challengeElapsed: number | null;
  timeRevealed: boolean;
  playerGuess: string;
  guessDistance: number | null;
  ratingChange: number | null;
  clockRating: number;
  challengeBestTime: number | null;
  decimalPrecision: 2 | 3;
  rankedMode: boolean;
  onEnableRanked: () => void;
  onRevealTime: () => void;
  onGuessChange: (value: string) => void;
  onSubmitGuess: () => void;
  onPlayAgain: () => void;
  onGoHome: () => void;
}) {
  const hasGuess = playerGuess.trim() !== '';
  const isChallenge = mode === 'challenge';
  const shownTime = isChallenge && challengeElapsed !== null ? challengeElapsed : targetTime;
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
    <div className={`bg-white rounded-3xl shadow-xl p-6 text-center ${CARD_HEIGHT}`}>
      <div className="flip-scene h-full">
        <div className={`flip-card relative h-full ${timeRevealed ? 'is-flipped' : ''}`}>
          <div className="flip-face absolute inset-0 bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col">
            <button
              onClick={() => !timeRevealed && onRevealTime()}
              className="h-[250px] flex flex-col items-center justify-center rounded-2xl transition-all duration-200 hover:bg-slate-100 active:scale-[0.98]"
            >
              <div className="text-7xl font-black text-slate-700 tracking-widest">
                ? ? ?
              </div>

              <p className="text-slate-400 text-sm mt-4">
                Tap to reveal
              </p>
            </button>

            {mode === 'single' && (
              <div className="space-y-4 pt-5 border-t border-slate-200">
                <p className="text-slate-600 font-medium">
                  Enter your guess to {decimalPrecision} decimal places
                </p>

                <div className="relative">
                  <input
                    type="number"
                    step={decimalPrecision === 3 ? '0.001' : '0.01'}
                    value={playerGuess}
                    onChange={(e) => onGuessChange(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value) onGuessChange(Number(e.target.value).toFixed(decimalPrecision));
                    }}
                    placeholder="Your guess"
                    className="w-full text-center text-3xl font-semibold py-4 px-6 pr-16 bg-white border-2 border-slate-200 rounded-2xl focus:border-teal-500 focus:outline-none transition-colors placeholder:text-slate-300"
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

          <div className={`flip-face flip-back absolute inset-0 bg-slate-50 border border-slate-200 rounded-3xl p-6 flex flex-col justify-between overflow-hidden ${resultTone === 'spoton' ? 'spoton-glow' : ''}`}>
            {(resultTone === 'spoton' || resultTone === 'elite') && (
              <div className="confetti">
                {Array.from({ length: 14 }).map((_, index) => (
                  <span key={index} className={`confetti-piece confetti-${index + 1}`} />
                ))}
              </div>
            )}

            <div className="space-y-5 relative z-10">
              <div>
                <p className="text-slate-400 text-sm font-semibold uppercase tracking-[0.25em] mb-2">
                  {isChallenge ? 'Your Time' : 'Secret Time'}
                </p>

                <div className="text-7xl font-black text-teal-600 tracking-tight">
                  {shownTime.toFixed(decimalPrecision)}s
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
                      <ResultRow label="Your Guess" value={`${parseFloat(playerGuess).toFixed(decimalPrecision)}s`} />
                      <ResultRow label="You were off by" value={`${guessDistance.toFixed(decimalPrecision)}s`} accent />
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
                            <p className="font-bold text-slate-800 text-sm">
                              Ready to climb the ranks?
                            </p>
                            <p className="text-xs text-slate-500">
                              Your next round can count toward a Clock Rank.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={onEnableRanked}
                            disabled={rankedMode}
                            className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-teal-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0"
                          >
                            {rankedMode ? 'Enabled' : 'Enable'}
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
                  <ResultRow label="Target" value={`${CHALLENGE_TARGET.toFixed(decimalPrecision)}s`} />
                  <ResultRow
                    label="Personal Best"
                    value={challengeBestTime === null ? '-' : `${challengeBestTime.toFixed(decimalPrecision)}s`}
                    accent
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 pt-5 relative z-10">
              <button
                onClick={onPlayAgain}
                className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98]"
              >
                <RotateCcw className="w-5 h-5" />
                Play Again
              </button>

              <button
                onClick={onGoHome}
                className="w-full bg-white hover:bg-slate-100 text-slate-700 font-semibold py-4 px-6 rounded-2xl text-lg transition-all duration-200 flex items-center justify-center gap-2 border border-slate-200"
              >
                <Home className="w-5 h-5" />
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
    <div className="bg-white rounded-2xl px-5 py-4 flex justify-between items-center border border-slate-200">
      <span className="font-medium text-slate-500">
        {label}
      </span>

      <span className={`font-bold text-lg ${accent ? 'text-amber-600' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );
}

export default App;


import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Clock, Crown, Maximize2, Minimize2, Radio, RefreshCw, Settings, ShieldAlert, Timer, Trophy, Zap } from 'lucide-react';
import { useStreamerSession } from '../hooks/useStreamerSession';
import { useTwitchAuth } from '../hooks/useTwitchAuth';
import type { Guess, Viewer } from '../types';
import { getStreamerRank, getStreamerRankDelta } from '../utils/streamerRanks';
import { getWeightedStandardTarget } from '../../../gameLogic';

type StreamerGameMode = 'standard' | 'elimination';
type StreamerGamePhase = 'link' | 'select' | 'lobby' | 'close-race' | 'countdown' | 'running' | 'stopped' | 'guessing' | 'streamer-guess' | 'closed' | 'revealed';
type RevealStage = 'seconds' | 'tenths' | 'final';
type StreamerBoardView = 'round' | 'overall';
type RegularRounds = number | 'unlimited';

const eliminationRoundMax = 10;
const regularRoundMax = 20;

type EliminationLogEntry = {
  viewerId: string;
  viewerName: string;
  roundNumber: number;
  time: number;
};

type EliminationParticipant = {
  id: string;
  name: string;
};

type PodiumEntry = {
  viewerId: string;
  viewerName: string;
  score: number;
  rankPoints: number;
};

function getPlacementLabel(position: number) {
  if (position === 1) return 'first';
  const suffix = position % 10 === 1 && position % 100 !== 11
    ? 'st'
    : position % 10 === 2 && position % 100 !== 12
      ? 'nd'
      : position % 10 === 3 && position % 100 !== 13
        ? 'rd'
        : 'th';
  return `${position}${suffix}`;
}

function getCloseRaceBattle(rows: PodiumEntry[], maxGap = 5) {
  if (rows.length < 2) return null;
  for (let index = 0; index < rows.length - 1; index += 1) {
    const gap = rows[index].score - rows[index + 1].score;
    if (gap <= maxGap) {
      return {
        gap,
        position: index + 1,
        players: [rows[index], rows[index + 1]] as const,
      };
    }
  }
  return null;
}

function formatStatus(status: string) {
  return status
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatSeconds(value: number) {
  return `${value.toFixed(2)}s`;
}

function generateStreamerTargetTime() {
  return getWeightedStandardTarget();
}

function makeStreamerGuess(value: number, roundId: string, streamerName: string): Guess {
  return {
    id: `streamer-guess-${roundId}`,
    viewerId: 'streamer',
    viewerName: streamerName,
    value,
    roundId,
    receivedAt: Date.now(),
    sourceMessage: 'Streamer guess',
  };
}

function getStageLabel(stage: RevealStage) {
  if (stage === 'seconds') return 'Reveal';
  if (stage === 'tenths') return 'Reveal';
  return 'Result';
}

function getRevealedTime(value: number | null, stage: RevealStage) {
  if (value === null) return '?.??s';
  if (stage === 'seconds') return `${Math.floor(value)}.??s`;
  if (stage === 'tenths') return `${(Math.floor(value * 10) / 10).toFixed(1)}?s`;
  return formatSeconds(value);
}

function getStageDistance(guess: Guess, target: number | null, stage: RevealStage) {
  if (target === null) return 0;
  if (stage === 'seconds') {
    const secondsDistance = Math.abs(Math.floor(guess.value) - Math.floor(target));
    return secondsDistance * 100 + Math.abs(guess.value - target);
  }
  if (stage === 'tenths') {
    const guessTenths = Math.floor(guess.value * 10) / 10;
    const targetTenths = Math.floor(target * 10) / 10;
    return Math.abs(guessTenths - targetTenths) * 100 + Math.abs(guess.value - target);
  }
  return Math.abs(guess.value - target);
}

function getRankedGuesses(guesses: Guess[], target: number | null, stage: RevealStage) {
  return [...guesses].sort((a, b) => {
    if (target === null) return b.receivedAt - a.receivedAt;
    const distance = getStageDistance(a, target, stage) - getStageDistance(b, target, stage);
    return distance === 0 ? a.receivedAt - b.receivedAt : distance;
  });
}

function getEliminationCut(activeCount: number, roundNumber: number, totalRounds: number) {
  const roundsRemaining = Math.max(1, totalRounds - roundNumber + 1);
  const survivors = roundNumber >= totalRounds
    ? Math.min(1, activeCount)
    : Math.max(2, Math.ceil(activeCount * ((roundsRemaining - 1) / roundsRemaining)));
  return {
    survivors: Math.min(activeCount, survivors),
    eliminated: Math.max(0, activeCount - survivors),
  };
}

function getScoringCount(playerCount: number) {
  return Math.max(1, Math.ceil(playerCount * 0.3));
}

function getPlacementScore(index: number, scoringCount: number) {
  return Math.max(0, scoringCount - index);
}

function getLastGuessForViewer(viewerId: string, guesses: Guess[]) {
  return guesses.find(guess => guess.viewerId === viewerId) ?? null;
}

function getAdvancingViewerIds(activeIds: string[], rankedGuesses: Guess[], target: number | null, survivorLimit: number) {
  if (target === null || activeIds.length <= 1) return activeIds;
  const playerGuesses = rankedGuesses.filter(guess => activeIds.includes(guess.viewerId));
  if (playerGuesses.length === 0) return activeIds;
  const safeLimit = Math.max(1, Math.min(survivorLimit, playerGuesses.length));
  const cutoffGuess = playerGuesses[safeLimit - 1];
  const cutoffError = Math.abs(cutoffGuess.value - target);
  return playerGuesses
    .filter(guess => Math.abs(Math.abs(guess.value - target) - cutoffError) < 0.005 || Math.abs(guess.value - target) < cutoffError)
    .map(guess => guess.viewerId);
}

function getViewerName(guess: Guess, viewers: Viewer[], streamerName: string) {
  if (guess.viewerId === 'streamer') return streamerName;
  return guess.viewerName || viewers.find(viewer => viewer.id === guess.viewerId)?.displayName || 'Viewer';
}

function getSignedError(guess: Guess, target: number | null) {
  if (target === null) return '';
  const difference = guess.value - target;
  if (Math.abs(difference) < 0.005) return 'Spot On';
  return `${difference >= 0 ? '+' : '-'}${Math.abs(difference).toFixed(2)}s`;
}

function getPodiumResult(entry: PodiumEntry, finalGuess: Guess | null, target: number | null, mode: StreamerGameMode) {
  if (mode !== 'elimination') return `${entry.score} pts`;
  if (!finalGuess || target === null) return entry.score > 0 ? 'Finalist' : 'Survivor';
  const error = Math.abs(finalGuess.value - target);
  if (error < 0.005) return 'Spot On';
  return `${error.toFixed(2)}s off`;
}

function playStreamerTone(frequency = 440, duration = 0.08, volume = 0.08) {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
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
    // Audio can fail silently until the browser receives a user gesture.
  }
}

interface StreamerModeScreenProps {
  backRequest?: number;
  onExit?: () => void;
  onTimingChange?: (active: boolean) => void;
}

export function StreamerModeScreen({ backRequest = 0, onExit, onTimingChange }: StreamerModeScreenProps) {
  const {
    provider,
    snapshot,
    error,
    connect,
    startRound,
    endRound,
    clearGuesses,
  } = useStreamerSession('twitch');
  const { session, viewers, guesses, currentRound } = snapshot;
  const twitchAuth = useTwitchAuth();
  const streamerDisplayName = twitchAuth.profile?.displayName || twitchAuth.profile?.login || 'Streamer';
  const [mode, setMode] = useState<StreamerGameMode>('standard');
  const [phase, setPhase] = useState<StreamerGamePhase>('link');
  const [boardView, setBoardView] = useState<StreamerBoardView>('round');
  const [revealStage, setRevealStage] = useState<RevealStage>('final');
  const [guessWindow, setGuessWindow] = useState(30);
  const [regularRounds, setRegularRounds] = useState<RegularRounds>(5);
  const [eliminationRounds, setEliminationRounds] = useState(5);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoRunEnabled, setAutoRunEnabled] = useState(false);
  const [leaderboardFullscreen, setLeaderboardFullscreen] = useState(false);
  const [roundLeaderboardSeen, setRoundLeaderboardSeen] = useState(false);
  const [podiumStage, setPodiumStage] = useState(0);
  const [eliminationRosterLocked, setEliminationRosterLocked] = useState(false);
  const [streamerEliminated, setStreamerEliminated] = useState(false);
  const [eliminationLog, setEliminationLog] = useState<EliminationLogEntry[]>([]);
  const [showEliminationBoard, setShowEliminationBoard] = useState(false);
  const [showPodiumIntro, setShowPodiumIntro] = useState(false);
  const lastGuessBeepRef = useRef<number | null>(null);
  const [countdownValue, setCountdownValue] = useState(3);
  const [guessSecondsLeft, setGuessSecondsLeft] = useState(30);
  const [roundNumber, setRoundNumber] = useState(1);
  const [activeViewerIds, setActiveViewerIds] = useState<string[]>([]);
  const [eliminatedViewerIds, setEliminatedViewerIds] = useState<string[]>([]);
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [streamerGuessInput, setStreamerGuessInput] = useState('');
  const [streamerGuessValue, setStreamerGuessValue] = useState<number | null>(null);
  const [streamerGuess, setStreamerGuess] = useState<Guess | null>(null);
  const [knownViewerNames, setKnownViewerNames] = useState<Record<string, string>>({});
  const [visibleGuessToastIds, setVisibleGuessToastIds] = useState<string[]>([]);
  const [viewerRankPoints, setViewerRankPoints] = useState<Record<string, number>>({ streamer: 0 });
  const [viewerScores, setViewerScores] = useState<Record<string, number>>({ streamer: 0 });
  const runTimeoutRef = useRef<number | null>(null);
  const stopTransitionRef = useRef<number | null>(null);
  const autoRunTimerRef = useRef<number | null>(null);
  const roundTimerTokenRef = useRef(0);
  const openedGuessTokenRef = useRef<number | null>(null);
  const lastBackRequestRef = useRef(backRequest);
  const cutoffRef = useRef<HTMLDivElement | null>(null);
  const guessToastTimersRef = useRef<Map<string, number>>(new Map());
  const seenGuessToastIdsRef = useRef<Set<string>>(new Set());
  const spotOnCelebratedRoundRef = useRef<string | null>(null);
  const connected = session.connectionStatus === 'connected';
  const connecting = session.connectionStatus === 'connecting';
  const viewerMap = useMemo(() => new Map(viewers.map(viewer => [viewer.id, viewer])), [viewers]);

  useEffect(() => {
    setKnownViewerNames(previous => {
      const next: Record<string, string> = { ...previous, streamer: streamerDisplayName };
      viewers.forEach(viewer => {
        next[viewer.id] = viewer.displayName;
      });
      guesses.forEach(guess => {
        next[guess.viewerId] = guess.viewerId === 'streamer' ? streamerDisplayName : guess.viewerName;
      });
      if (streamerGuess) {
        next.streamer = streamerGuess.viewerName;
      }
      const keys = Object.keys(next);
      const changed = keys.length !== Object.keys(previous).length || keys.some(key => previous[key] !== next[key]);
      return changed ? next : previous;
    });
  }, [guesses, streamerDisplayName, streamerGuess, viewers]);

  const clearRunTimeout = useCallback(() => {
    roundTimerTokenRef.current += 1;
    if (runTimeoutRef.current !== null) {
      window.clearTimeout(runTimeoutRef.current);
      runTimeoutRef.current = null;
    }
    if (stopTransitionRef.current !== null) {
      window.clearTimeout(stopTransitionRef.current);
      stopTransitionRef.current = null;
    }
  }, []);

  const activeViewers = useMemo(
    () => activeViewerIds.map(id => viewerMap.get(id)).filter((viewer): viewer is Viewer => Boolean(viewer)),
    [activeViewerIds, viewerMap]
  );
  const chatRoundGuesses = useMemo(() => {
    const active = new Set(activeViewerIds);
    return guesses.filter(guess => active.has(guess.viewerId) && (!currentRound || guess.roundId === currentRound.id));
  }, [activeViewerIds, currentRound, guesses]);
  const roundGuesses = useMemo(
    () => streamerGuess ? [...chatRoundGuesses, streamerGuess] : chatRoundGuesses,
    [chatRoundGuesses, streamerGuess]
  );
  const rankedGuesses = useMemo(
    () => getRankedGuesses(roundGuesses, finalTime, revealStage),
    [finalTime, revealStage, roundGuesses]
  );
  const finalRankedGuesses = useMemo(
    () => getRankedGuesses(roundGuesses, finalTime, 'final'),
    [finalTime, roundGuesses]
  );
  const guessToastFeed = useMemo(() => {
    const guessesById = new Map(roundGuesses.map(guess => [guess.id, guess]));
    return visibleGuessToastIds.map(id => guessesById.get(id)).filter((guess): guess is Guess => Boolean(guess));
  }, [roundGuesses, visibleGuessToastIds]);
  const revealMatchFeed = useMemo(() => {
    if (phase !== 'revealed' || finalTime === null || revealStage === 'final') return [];
    const matches = roundGuesses.filter(guess => {
      if (revealStage === 'seconds') return Math.floor(guess.value) === Math.floor(finalTime);
      return Math.floor(guess.value * 10) === Math.floor(finalTime * 10);
    });
    return matches.sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 5);
  }, [finalTime, phase, revealStage, roundGuesses]);
  const activeEliminationIds = mode === 'elimination' && !streamerEliminated ? [...activeViewerIds, 'streamer'] : activeViewerIds;
  const eliminationCut = getEliminationCut(activeEliminationIds.length, roundNumber, eliminationRounds);
  const advancingIds = mode === 'elimination' && finalTime !== null
    ? getAdvancingViewerIds(activeEliminationIds, finalRankedGuesses, finalTime, eliminationCut.survivors)
    : activeEliminationIds;
  const eliminatedThisRound = mode === 'elimination' && finalTime !== null
    ? activeViewers.filter(viewer => !advancingIds.includes(viewer.id))
    : [];
  const streamerEliminatedThisRound = mode === 'elimination' && finalTime !== null && !streamerEliminated && !advancingIds.includes('streamer');
  const eliminatedParticipants: EliminationParticipant[] = mode === 'elimination'
    ? [
        ...eliminatedThisRound.map(viewer => ({ id: viewer.id, name: viewer.displayName })),
        ...(streamerEliminatedThisRound ? [{ id: 'streamer', name: streamerDisplayName }] : []),
      ]
    : [];
  const eliminationDecisionRows = mode === 'elimination'
    ? finalRankedGuesses.filter(guess => activeEliminationIds.includes(guess.viewerId))
    : [];
  const winner = phase === 'revealed' && revealStage === 'final' ? finalRankedGuesses[0] : null;
  const winnerError = winner && finalTime !== null ? Math.abs(winner.value - finalTime) : null;
  const isSpotOn = winnerError !== null && winnerError < 0.005;
  const overallLeaderboard = useMemo(() => {
    const rows = new Map<string, { viewerId: string; viewerName: string; score: number; rankPoints: number }>();
    Object.entries(viewerScores).forEach(([viewerId, score]) => {
      const viewer = viewerMap.get(viewerId);
      rows.set(viewerId, {
        viewerId,
        viewerName: viewerId === 'streamer' ? streamerDisplayName : knownViewerNames[viewerId] ?? viewer?.displayName ?? 'Viewer',
        score,
        rankPoints: viewerRankPoints[viewerId] ?? 0,
      });
    });
    [...viewers, { id: 'streamer', displayName: streamerDisplayName, joinedAt: Date.now() }].forEach(viewer => {
      if (rows.has(viewer.id)) return;
      rows.set(viewer.id, {
        viewerId: viewer.id,
        viewerName: viewer.displayName,
        score: 0,
        rankPoints: viewerRankPoints[viewer.id] ?? 0,
      });
    });
    return [...rows.values()].sort((a, b) => b.score - a.score || b.rankPoints - a.rankPoints || a.viewerName.localeCompare(b.viewerName));
  }, [knownViewerNames, streamerDisplayName, viewerMap, viewerRankPoints, viewerScores, viewers]);
  const parsedStreamerGuess = Number(streamerGuessInput);
  const canSaveStreamerGuess = Number.isFinite(parsedStreamerGuess) && parsedStreamerGuess >= 0;
  const canReveal = Boolean(currentRound);
  const updateEliminationRounds = useCallback((value: string) => {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) return;
    setEliminationRounds(Math.max(2, Math.min(eliminationRoundMax, Math.round(nextValue))));
  }, []);
  const activeRoundLimit = mode === 'elimination' ? eliminationRounds : regularRounds;
  const activeRoundLabel = activeRoundLimit === 'unlimited' ? 'Unlimited' : String(activeRoundLimit);
  const roundSettingsLocked = phase !== 'lobby' || roundNumber > 1 || eliminationRosterLocked;
  const lobbyInstruction = mode === 'elimination'
    ? roundNumber === 1 && !eliminationRosterLocked
      ? `Round 1 of ${activeRoundLabel}. Players join by guessing after the clock stops.`
      : roundNumber >= eliminationRounds || activeEliminationIds.length <= 2
      ? 'Final showdown. Count cleanly. One player survives.'
      : `Round ${roundNumber} of ${activeRoundLabel}. Top ${eliminationCut.survivors} advance.`
    : `Round ${roundNumber} of ${activeRoundLabel}. Click Start to begin.`;
  const roundWillEndGame = mode === 'standard'
    ? regularRounds !== 'unlimited' && roundNumber >= regularRounds
    : advancingIds.length <= 1;
  const roundScoringCount = mode === 'standard' ? getScoringCount(activeViewerIds.length + 1) : 0;
  const closeRaceBattle = useMemo(() => getCloseRaceBattle(overallLeaderboard), [overallLeaderboard]);
  const isFinalRoundCloseRace = Boolean(mode === 'standard'
    && regularRounds !== 'unlimited'
    && roundNumber === regularRounds
    && closeRaceBattle);
  const roundNeedsTiebreaker = mode === 'elimination' && roundNumber >= eliminationRounds && advancingIds.length > 1;
  const advancingCountLabel = mode === 'elimination'
    ? Math.max(1, Math.min(eliminationCut.survivors, eliminationDecisionRows.length || activeEliminationIds.length))
    : 0;
  const safeDecisionRows = eliminationDecisionRows.slice(0, advancingCountLabel);
  const eliminatedDecisionRows = eliminationDecisionRows.slice(advancingCountLabel);
  const finalPodiumEntries = useMemo<PodiumEntry[]>(() => {
    if (mode === 'elimination') {
      const entriesById = new Map<string, PodiumEntry>();
      finalRankedGuesses.forEach(guess => {
        if (entriesById.has(guess.viewerId) || entriesById.size >= 3) return;
        entriesById.set(guess.viewerId, {
          viewerId: guess.viewerId,
          viewerName: getViewerName(guess, viewers, streamerDisplayName),
          score: viewerScores[guess.viewerId] ?? 0,
          rankPoints: viewerRankPoints[guess.viewerId] ?? 0,
        });
      });
      overallLeaderboard.forEach(entry => {
        if (entriesById.has(entry.viewerId) || entriesById.size >= 3) return;
        entriesById.set(entry.viewerId, entry);
      });
      return [...entriesById.values()].slice(0, 3);
    }
    return overallLeaderboard.slice(0, 3);
  }, [finalRankedGuesses, mode, overallLeaderboard, streamerDisplayName, viewerRankPoints, viewerScores, viewers]);
  const podiumEntries = finalPodiumEntries;
  const podiumSlots = [
    { place: 2, entry: podiumEntries[1] },
    { place: 1, entry: podiumEntries[0] },
    { place: 3, entry: podiumEntries[2] },
  ];
  const podiumRevealTransition = {
    type: 'spring' as const,
    stiffness: 132,
    damping: 21,
    mass: 0.95,
  };
  const eliminationChampion = mode === 'elimination'
    ? podiumEntries[0] ?? overallLeaderboard.find(entry => entry.viewerId === advancingIds[0])
    : podiumEntries[0];
  const podiumWinnerName = podiumEntries[0]?.viewerName ?? eliminationChampion?.viewerName ?? 'the winner';
  const eliminationFinalStandings = useMemo(() => {
    const rows = new Map<string, { viewerId: string; viewerName: string; status: string; detail: string; sort: number }>();
    const championId = eliminationChampion?.viewerId;
    if (championId) {
      rows.set(championId, {
        viewerId: championId,
        viewerName: eliminationChampion.viewerName,
        status: 'Winner',
        detail: 'Last player standing',
        sort: Number.MAX_SAFE_INTEGER,
      });
    }
    eliminationLog.forEach(entry => {
      rows.set(entry.viewerId, {
        viewerId: entry.viewerId,
        viewerName: entry.viewerName,
        status: `Eliminated round ${entry.roundNumber}`,
        detail: `Clock stopped at ${formatSeconds(entry.time)}`,
        sort: entry.roundNumber,
      });
    });
    finalRankedGuesses.forEach(guess => {
      if (rows.has(guess.viewerId)) return;
      rows.set(guess.viewerId, {
        viewerId: guess.viewerId,
        viewerName: getViewerName(guess, viewers, streamerDisplayName),
        status: guess.viewerId === championId ? 'Winner' : 'Final round',
        detail: guess.viewerId === championId ? 'Last player standing' : `Last guess ${formatSeconds(guess.value)}`,
        sort: guess.viewerId === championId ? Number.MAX_SAFE_INTEGER : roundNumber,
      });
    });
    if (!rows.has('streamer')) {
      rows.set('streamer', {
        viewerId: 'streamer',
        viewerName: streamerDisplayName,
        status: streamerEliminated ? 'Eliminated' : championId === 'streamer' ? 'Winner' : 'Streamer',
        detail: streamerEliminated ? 'Out of the lobby' : championId === 'streamer' ? 'Last player standing' : 'No elimination recorded',
        sort: championId === 'streamer' ? Number.MAX_SAFE_INTEGER : -1,
      });
    }
    return [...rows.values()].sort((a, b) => b.sort - a.sort || a.viewerName.localeCompare(b.viewerName));
  }, [eliminationChampion, eliminationLog, finalRankedGuesses, roundNumber, streamerDisplayName, streamerEliminated, viewers]);
  const eliminationCutOverlayActive = mode === 'elimination' && phase === 'revealed' && revealStage === 'final' && showEliminationBoard && eliminatedParticipants.length > 0 && !roundWillEndGame;
  const finalOverallLeaderboardOpen = phase === 'closed' && boardView === 'overall';
  const finaleOverlayActive = phase === 'closed' && !leaderboardFullscreen;
  const suppressStreamerSidePanels = eliminationCutOverlayActive || finaleOverlayActive || finalOverallLeaderboardOpen;
  const hideLiveRoundBoard = !['link', 'select'].includes(phase);
  const showStreamerRightPanel = false;
  const standardRoundResultsOpen = mode === 'standard' && phase === 'revealed' && boardView === 'round' && roundLeaderboardSeen;
  const podiumScoreGap = podiumEntries.length > 1 ? podiumEntries[0].score - podiumEntries[1].score : null;
  const podiumScoreSpread = podiumEntries.length > 2 ? podiumEntries[0].score - podiumEntries[2].score : podiumScoreGap;
  const podiumIntroLine = mode === 'elimination'
    ? podiumScoreGap !== null && podiumScoreGap <= 1
      ? 'The final cut was brutal'
      : 'One clock survived the chaos'
    : podiumScoreGap === null
      ? 'Let us find your winner'
      : podiumScoreGap === 0
        ? 'It is tied at the top'
        : podiumScoreGap <= 2
          ? 'This is a photo finish'
          : podiumScoreSpread !== null && podiumScoreSpread <= 4
            ? 'The podium is packed tight'
            : podiumScoreGap >= 8
              ? 'Someone ran away with it'
              : 'The crown is still up for grabs';
  const podiumPrompt = !showPodiumIntro
    ? 'Click or press Space to start the reveal'
    : podiumStage === 1
      ? 'Third place steps forward'
      : podiumStage === 2
        ? 'Second place is locked in'
        : `${podiumWinnerName} is the winner!`;

  useEffect(() => {
    if (phase !== 'guessing' || !currentRound) return;
    if (mode === 'elimination' && eliminationRosterLocked) return;
    const guesserIds = guesses
      .filter(guess => guess.roundId === currentRound.id && guess.viewerId !== 'streamer')
      .map(guess => guess.viewerId);
    if (guesserIds.length === 0) return;
    setActiveViewerIds(previous => {
      const next = new Set(previous);
      guesserIds.forEach(viewerId => {
        if (!eliminatedViewerIds.includes(viewerId)) next.add(viewerId);
      });
      return [...next];
    });
  }, [currentRound, eliminatedViewerIds, eliminationRosterLocked, guesses, mode, phase]);

  useEffect(() => {
    onTimingChange?.(['countdown', 'running', 'stopped'].includes(phase));
  }, [onTimingChange, phase]);

  useEffect(() => {
    if (phase === 'closed') return;
    setPodiumStage(0);
    setShowPodiumIntro(false);
  }, [phase]);

  useEffect(() => {
    if (!eliminationCutOverlayActive) return;
    window.setTimeout(() => {
      cutoffRef.current?.scrollIntoView({ block: 'center' });
    }, 50);
  }, [eliminationCutOverlayActive]);

  const openGuessWindow = useCallback(async (actualTime: number, token: number) => {
    if (roundTimerTokenRef.current !== token) return;
    if (openedGuessTokenRef.current === token) return;
    openedGuessTokenRef.current = token;
    setFinalTime(actualTime);
    setGuessSecondsLeft(guessWindow);
    playStreamerTone(220, 0.12, 0.08);
    await clearGuesses();
    if (roundTimerTokenRef.current !== token) return;
    setPhase('stopped');
    stopTransitionRef.current = window.setTimeout(() => {
      stopTransitionRef.current = null;
      if (roundTimerTokenRef.current !== token) return;
      void startRound({ targetTime: actualTime });
      setPhase('guessing');
    }, 1000);
  }, [clearGuesses, guessWindow, startRound]);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    let cancelled = false;
    let remaining = 3;
    setCountdownValue(remaining);
    const timer = window.setInterval(() => {
      if (cancelled) return;
      remaining -= 1;

      if (remaining <= 0) {
        window.clearInterval(timer);
        playStreamerTone(720, 0.1, 0.08);
        const nextTarget = generateStreamerTargetTime();
        const runToken = roundTimerTokenRef.current;
        setCountdownValue(0);
        setTargetTime(nextTarget);
        setFinalTime(null);
        setPhase('running');
        if (runTimeoutRef.current !== null) {
          window.clearTimeout(runTimeoutRef.current);
        }
        runTimeoutRef.current = window.setTimeout(() => {
          runTimeoutRef.current = null;
          if (roundTimerTokenRef.current !== runToken) return;
          void openGuessWindow(nextTarget, runToken);
        }, nextTarget * 1000);
        return;
      }

      playStreamerTone(420, 0.06, 0.08);
      setCountdownValue(remaining);
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [openGuessWindow, phase]);

  useEffect(() => {
    if (phase !== 'revealed') return undefined;
    spotOnCelebratedRoundRef.current = null;
    playStreamerTone(520, 0.08, 0.08);
    setRevealStage('seconds');
    const tenthsTimer = window.setTimeout(() => {
      playStreamerTone(640, 0.08, 0.08);
      setRevealStage('tenths');
    }, 2400);
    const finalTimer = window.setTimeout(() => {
      playStreamerTone(860, 0.12, 0.08);
      setRevealStage('final');
    }, 5600);
    return () => {
      window.clearTimeout(tenthsTimer);
      window.clearTimeout(finalTimer);
    };
  }, [currentRound?.id, phase]);

  useEffect(() => {
    if (phase !== 'revealed' || revealStage !== 'final') return;
    const activeRoundId = currentRound?.id ?? 'streamer-round';
    const finalWinner = finalRankedGuesses[0];
    if (
      finalWinner
      && finalTime !== null
      && Math.abs(finalWinner.value - finalTime) < 0.005
      && spotOnCelebratedRoundRef.current !== activeRoundId
    ) {
      spotOnCelebratedRoundRef.current = activeRoundId;
      window.setTimeout(() => playStreamerTone(880, 0.1, 0.08), 80);
      window.setTimeout(() => playStreamerTone(1100, 0.1, 0.08), 190);
      window.setTimeout(() => playStreamerTone(1320, 0.16, 0.08), 320);
    }
  }, [currentRound?.id, finalRankedGuesses, finalTime, phase, revealStage]);

  const linkProvider = async () => {
    playStreamerTone(620, 0.045, 0.06);
    if (twitchAuth.status !== 'authenticated') {
      await twitchAuth.login();
      return;
    }
    if (!connected) {
      const didConnect = await connect();
      if (!didConnect) return;
    }
    setPhase('select');
  };

  const openLobby = async (nextMode: StreamerGameMode = mode) => {
    playStreamerTone(620, 0.045, 0.06);
    const latestViewers = await provider.getViewers();
    setMode(nextMode);
    setRoundNumber(1);
    setFinalTime(null);
    setTargetTime(null);
    setCountdownValue(3);
    setGuessSecondsLeft(guessWindow);
    setRevealStage('final');
    setStreamerGuessInput('');
    setStreamerGuessValue(null);
    setStreamerGuess(null);
    setEliminatedViewerIds([]);
    setEliminationRosterLocked(false);
    setStreamerEliminated(false);
    setEliminationLog([]);
    setShowEliminationBoard(false);
    setRoundLeaderboardSeen(false);
    setActiveViewerIds(latestViewers.map(viewer => viewer.id));
    setViewerScores({ streamer: 0 });
    setViewerRankPoints({ streamer: 0 });
    await clearGuesses();
    setPhase('lobby');
    setSettingsOpen(true);
  };

  const beginRound = useCallback(async () => {
    playStreamerTone(620, 0.045, 0.06);
    setSettingsOpen(false);
    const startingPlayers = mode === 'elimination' && eliminationRosterLocked
      ? activeViewerIds
      : [];
    setActiveViewerIds(startingPlayers);
    setFinalTime(null);
    setTargetTime(null);
    setCountdownValue(3);
    setGuessSecondsLeft(guessWindow);
    setRevealStage('final');
    setStreamerGuessInput('');
    setStreamerGuessValue(null);
    setStreamerGuess(null);
    setRoundLeaderboardSeen(false);
    await clearGuesses();
    clearRunTimeout();
    roundTimerTokenRef.current += 1;
    openedGuessTokenRef.current = null;
    setPhase('countdown');
  }, [activeViewerIds, clearGuesses, clearRunTimeout, eliminationRosterLocked, guessWindow, mode]);

  const saveStreamerGuess = useCallback(() => {
    if (!canSaveStreamerGuess) return;
    const nextValue = Number(parsedStreamerGuess.toFixed(2));
    setStreamerGuessValue(nextValue);
    if (currentRound) {
      setStreamerGuess(makeStreamerGuess(nextValue, currentRound.id, streamerDisplayName));
    }
    playStreamerTone(540, 0.07, 0.06);
  }, [canSaveStreamerGuess, currentRound, parsedStreamerGuess, streamerDisplayName]);

  const revealResults = useCallback(async () => {
    if (!currentRound) {
      return;
    }
    clearRunTimeout();
    playStreamerTone(620, 0.045, 0.06);
    if (currentRound.status !== 'ended') {
      await endRound({ targetTime: finalTime ?? targetTime ?? undefined });
    }
    const nextStreamerValue = streamerGuessValue ?? (canSaveStreamerGuess ? Number(parsedStreamerGuess.toFixed(2)) : null);
    const nextStreamerGuess = streamerGuess ?? (nextStreamerValue === null ? null : makeStreamerGuess(nextStreamerValue, currentRound.id, streamerDisplayName));
    const nextGuesses = nextStreamerGuess ? [...chatRoundGuesses, nextStreamerGuess] : chatRoundGuesses;
    const nextRankedGuesses = getRankedGuesses(nextGuesses, finalTime, 'final');
    setStreamerGuessValue(nextStreamerValue);
    setStreamerGuess(nextStreamerGuess);
    setViewerRankPoints(previous => {
      const next = { ...previous };
      nextRankedGuesses.forEach((guess, index) => {
        const roundError = finalTime === null ? null : Math.abs(guess.value - finalTime);
        next[guess.viewerId] = Math.max(0, (next[guess.viewerId] ?? 0) + getStreamerRankDelta(roundError, index));
      });
      return next;
    });
    setViewerScores(previous => {
      const next = { ...previous };
      const scoringCount = getScoringCount(activeViewerIds.length + 1);
      nextRankedGuesses.slice(0, scoringCount).forEach((guess, index) => {
        next[guess.viewerId] = (next[guess.viewerId] ?? 0) + getPlacementScore(index, scoringCount);
      });
      return next;
    });
    setBoardView('round');
    setRoundLeaderboardSeen(false);
    setRevealStage('seconds');
    setShowEliminationBoard(false);
    setPhase('revealed');
  }, [activeViewerIds.length, canSaveStreamerGuess, chatRoundGuesses, clearRunTimeout, currentRound, endRound, finalTime, parsedStreamerGuess, streamerDisplayName, streamerGuess, streamerGuessValue, targetTime]);

  useEffect(() => {
    if (phase !== 'guessing') return undefined;
    if (guessSecondsLeft <= 0) {
      void revealResults();
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setGuessSecondsLeft(previous => Math.max(0, previous - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [guessSecondsLeft, phase, revealResults]);

  const nextRound = useCallback(async () => {
    playStreamerTone(620, 0.045, 0.06);
    if (mode === 'standard') {
      const isComplete = regularRounds !== 'unlimited' && roundNumber >= regularRounds;
      const nextRoundNumber = regularRounds === 'unlimited' ? roundNumber + 1 : Math.min(regularRounds, roundNumber + 1);
      const shouldShowCloseRaceScreen = regularRounds !== 'unlimited'
        && !isComplete
        && nextRoundNumber === regularRounds
        && Boolean(getCloseRaceBattle(overallLeaderboard));
      setRoundNumber(nextRoundNumber);
      setPhase(shouldShowCloseRaceScreen ? 'close-race' : 'lobby');
      setFinalTime(null);
      setTargetTime(null);
      setGuessSecondsLeft(guessWindow);
      setStreamerGuessInput('');
      setStreamerGuessValue(null);
      setStreamerGuess(null);
      setRoundLeaderboardSeen(false);
      await clearGuesses();
      if (isComplete) setPhase('closed');
      return;
    }

    const nextActiveIds = advancingIds.length ? advancingIds : activeViewerIds;
    const newlyEliminated = activeViewerIds.filter(id => !nextActiveIds.includes(id));
    setEliminatedViewerIds(previous => [...new Set([...previous, ...newlyEliminated])]);
    setEliminationRosterLocked(true);
    if (streamerEliminatedThisRound) {
      setStreamerEliminated(true);
    }
    const isEliminationComplete = nextActiveIds.length <= 1;
    if (finalTime !== null && (newlyEliminated.length || streamerEliminatedThisRound)) {
      setEliminationLog(previous => [
        ...previous,
        ...newlyEliminated.map(id => ({
          viewerId: id,
          viewerName: viewerMap.get(id)?.displayName ?? 'Viewer',
          roundNumber,
          time: finalTime,
        })),
        ...(streamerEliminatedThisRound ? [{
          viewerId: 'streamer',
          viewerName: streamerDisplayName,
          roundNumber,
          time: finalTime,
        }] : []),
      ]);
    }
    setActiveViewerIds(nextActiveIds.filter(id => id !== 'streamer'));
    if (isEliminationComplete) {
      setShowEliminationBoard(false);
      setPhase('closed');
      return;
    }
    setRoundNumber(previous => roundNeedsTiebreaker ? previous + 1 : Math.min(eliminationRounds, previous + 1));
    setFinalTime(null);
    setTargetTime(null);
    setGuessSecondsLeft(guessWindow);
    setStreamerGuessInput('');
    setStreamerGuessValue(null);
    setStreamerGuess(null);
    setRoundLeaderboardSeen(false);
    await clearGuesses();
    setShowEliminationBoard(false);
    setPhase(nextActiveIds.length <= 1 ? 'closed' : 'lobby');
  }, [activeViewerIds, advancingIds, clearGuesses, eliminationRounds, finalTime, guessWindow, mode, overallLeaderboard, regularRounds, roundNeedsTiebreaker, roundNumber, streamerDisplayName, streamerEliminatedThisRound, viewerMap]);

  const advanceFromRevealedRound = useCallback(() => {
    if (mode === 'standard' && !roundLeaderboardSeen) {
      playStreamerTone(620, 0.045, 0.06);
      setBoardView('round');
      setRoundLeaderboardSeen(true);
      setLeaderboardFullscreen(true);
      return;
    }
    if (mode === 'elimination' && eliminatedParticipants.length > 0 && !roundWillEndGame && !showEliminationBoard) {
      playStreamerTone(620, 0.045, 0.06);
      setShowEliminationBoard(true);
      return;
    }
    void nextRound();
  }, [eliminatedParticipants.length, mode, nextRound, roundLeaderboardSeen, roundWillEndGame, showEliminationBoard]);

  const resetGame = useCallback(async () => {
    playStreamerTone(620, 0.045, 0.06);
    setPhase('select');
    setSettingsOpen(false);
    setRoundNumber(1);
    setActiveViewerIds([]);
    setEliminatedViewerIds([]);
    setEliminationRosterLocked(false);
    setStreamerEliminated(false);
    setEliminationLog([]);
    setShowEliminationBoard(false);
    setFinalTime(null);
    setTargetTime(null);
    setCountdownValue(3);
    setGuessSecondsLeft(guessWindow);
    setStreamerGuessInput('');
    setStreamerGuessValue(null);
    setStreamerGuess(null);
    setRoundLeaderboardSeen(false);
    clearRunTimeout();
    await clearGuesses();
  }, [clearGuesses, clearRunTimeout, guessWindow]);

  const closeLeaderboard = useCallback(() => {
    playStreamerTone(420, 0.045, 0.05);
    if (standardRoundResultsOpen) {
      setLeaderboardFullscreen(false);
      void nextRound();
      return;
    }
    setLeaderboardFullscreen(false);
    if (finalOverallLeaderboardOpen) {
      void resetGame();
    }
  }, [finalOverallLeaderboardOpen, nextRound, resetGame, standardRoundResultsOpen]);

  const advancePodium = useCallback(() => {
    if (phase !== 'closed' || leaderboardFullscreen) return;
    if (!showPodiumIntro) {
      setShowPodiumIntro(true);
      setPodiumStage(1);
      playStreamerTone(360, 0.12, 0.08);
      return;
    }
    if (podiumStage >= 3) {
      if (mode === 'elimination' && activeViewerIds.length > 1) {
        void beginRound();
        return;
      }
      playStreamerTone(620, 0.045, 0.06);
      setBoardView('overall');
      setLeaderboardFullscreen(true);
      return;
    }
    setPodiumStage(previous => {
      const next = Math.min(3, previous + 1);
      if (next !== previous) {
        playStreamerTone(next === 3 ? 760 : 520, 0.12, 0.08);
        if (next === 3) {
          window.setTimeout(() => playStreamerTone(960, 0.12, 0.08), 140);
          window.setTimeout(() => playStreamerTone(1200, 0.18, 0.08), 280);
        }
      }
      return next;
    });
  }, [activeViewerIds.length, beginRound, leaderboardFullscreen, mode, phase, podiumStage, showPodiumIntro]);

  useEffect(() => {
    if (autoRunTimerRef.current !== null) {
      window.clearTimeout(autoRunTimerRef.current);
      autoRunTimerRef.current = null;
    }

    if (!autoRunEnabled || !connected || settingsOpen || finalOverallLeaderboardOpen) {
      return undefined;
    }

    const schedule = (callback: () => void, delay: number) => {
      autoRunTimerRef.current = window.setTimeout(() => {
        autoRunTimerRef.current = null;
        callback();
      }, delay);
    };

    if (standardRoundResultsOpen) {
      schedule(closeLeaderboard, 6500);
    } else if (leaderboardFullscreen) {
      return undefined;
    } else if (phase === 'lobby') {
      schedule(() => void beginRound(), 1400);
    } else if (phase === 'close-race') {
      schedule(() => {
        playStreamerTone(620, 0.045, 0.06);
        setPhase('lobby');
      }, 4500);
    } else if (phase === 'revealed' && revealStage === 'final') {
      schedule(advanceFromRevealedRound, showEliminationBoard || isSpotOn ? 6800 : 5200);
    } else if (phase === 'closed') {
      schedule(advancePodium, showPodiumIntro ? 3400 : 2600);
    }

    return () => {
      if (autoRunTimerRef.current !== null) {
        window.clearTimeout(autoRunTimerRef.current);
        autoRunTimerRef.current = null;
      }
    };
  }, [
    advanceFromRevealedRound,
    advancePodium,
    autoRunEnabled,
    beginRound,
    closeLeaderboard,
    connected,
    finalOverallLeaderboardOpen,
    isSpotOn,
    leaderboardFullscreen,
    phase,
    revealStage,
    settingsOpen,
    showEliminationBoard,
    showPodiumIntro,
    standardRoundResultsOpen,
  ]);

  useEffect(() => {
    if (phase !== 'guessing' || guessSecondsLeft > 5 || guessSecondsLeft <= 0) {
      if (phase !== 'guessing') lastGuessBeepRef.current = null;
      return;
    }
    if (lastGuessBeepRef.current === guessSecondsLeft) return;
    lastGuessBeepRef.current = guessSecondsLeft;
    playStreamerTone(guessSecondsLeft === 1 ? 880 : 560, 0.08, 0.08);
  }, [guessSecondsLeft, phase]);

  useEffect(() => {
    const feedActive = phase === 'guessing' || phase === 'streamer-guess';
    if (!feedActive) {
      guessToastTimersRef.current.forEach(timer => window.clearTimeout(timer));
      guessToastTimersRef.current.clear();
      seenGuessToastIdsRef.current.clear();
      setVisibleGuessToastIds([]);
      return;
    }

    roundGuesses.forEach(guess => {
      if (seenGuessToastIdsRef.current.has(guess.id)) return;
      seenGuessToastIdsRef.current.add(guess.id);
      setVisibleGuessToastIds(previous => [...previous.filter(id => id !== guess.id), guess.id].slice(-5));
      const timer = window.setTimeout(() => {
        guessToastTimersRef.current.delete(guess.id);
        setVisibleGuessToastIds(previous => previous.filter(id => id !== guess.id));
      }, 3200);
      guessToastTimersRef.current.set(guess.id, timer);
    });
  }, [phase, roundGuesses]);

  useEffect(() => () => {
    guessToastTimersRef.current.forEach(timer => window.clearTimeout(timer));
    guessToastTimersRef.current.clear();
    seenGuessToastIdsRef.current.clear();
  }, []);

  useEffect(() => {
    if (backRequest === lastBackRequestRef.current) return;
    lastBackRequestRef.current = backRequest;
    playStreamerTone(420, 0.045, 0.05);

    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }

    if (phase === 'link') {
      onExit?.();
      return;
    }

    if (phase === 'select') {
      setPhase('link');
      return;
    }

    void resetGame();
  }, [backRequest, onExit, phase, resetGame, settingsOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== 'Enter') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (settingsOpen) return;

      if (leaderboardFullscreen) {
        if (standardRoundResultsOpen || finalOverallLeaderboardOpen) {
          event.preventDefault();
          closeLeaderboard();
        }
        return;
      }

      if (phase === 'closed') {
        event.preventDefault();
        advancePodium();
        return;
      }

      if (phase === 'close-race') {
        event.preventDefault();
        playStreamerTone(620, 0.045, 0.06);
        setPhase('lobby');
        return;
      }

      if (phase === 'lobby') {
        event.preventDefault();
        if (connected) void beginRound();
        return;
      }

      if ((phase === 'guessing' || phase === 'streamer-guess') && streamerGuessValue !== null && canReveal) {
        event.preventDefault();
        void revealResults();
        return;
      }

      if (phase === 'revealed' && revealStage === 'final') {
        event.preventDefault();
        advanceFromRevealedRound();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [advanceFromRevealedRound, advancePodium, beginRound, canReveal, closeLeaderboard, connected, finalOverallLeaderboardOpen, leaderboardFullscreen, phase, revealResults, revealStage, settingsOpen, standardRoundResultsOpen, streamerGuessValue]);

  useEffect(() => {
    const handleGuessKeyDown = (event: KeyboardEvent) => {
      const guessEntryActive = (phase === 'guessing' || phase === 'streamer-guess')
        && !settingsOpen
        && !leaderboardFullscreen
        && !streamerEliminated
        && streamerGuessValue === null;
      if (!guessEntryActive) return;

      const target = event.target as HTMLElement | null;
      const isTypingTarget = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));
      if (isTypingTarget && !target?.closest('.streamer-guess-entry')) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        saveStreamerGuess();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        setStreamerGuessInput(previous => previous.slice(0, -1));
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        setStreamerGuessInput('');
        return;
      }

      const key = event.key === ',' ? '.' : event.key;
      if (!/^\d$/.test(key) && key !== '.') return;

      event.preventDefault();
      setStreamerGuessInput(previous => {
        if (key === '.' && previous.includes('.')) return previous;
        const next = previous === '' && key === '.' ? '0.' : `${previous}${key}`;
        return /^\d{0,2}(\.\d{0,2})?$/.test(next) ? next : previous;
      });
    };

    window.addEventListener('keydown', handleGuessKeyDown);
    return () => window.removeEventListener('keydown', handleGuessKeyDown);
  }, [leaderboardFullscreen, phase, saveStreamerGuess, settingsOpen, streamerEliminated, streamerGuessValue]);

  const displayTime = phase === 'revealed'
    ? getRevealedTime(finalTime, revealStage)
    : phase === 'countdown'
      ? String(countdownValue)
      : phase === 'running' || phase === 'guessing' || phase === 'streamer-guess'
        ? '?.??s'
        : formatSeconds(finalTime ?? 0);

  return (
    <section className="streamer-mode-card app-card bg-white rounded-3xl shadow-xl text-slate-900 flex flex-col overflow-hidden">
      <div className={`streamer-game-stage ${!['link', 'select'].includes(phase) ? 'streamer-live-stage' : ''} ${hideLiveRoundBoard ? 'streamer-live-stage-no-board' : ''}`}>
        {phase === 'link' && (
          <main className="streamer-setup-screen">
            <div className="streamer-setup-hero">
              <span className="streamer-setup-icon"><Radio className="w-9 h-9" /></span>
              <p className="streamer-eyebrow">Streamer Mode</p>
              <h1>Link your platform</h1>
              <p>Connect Twitch chat first, then choose the game and modifiers before going live.</p>
            </div>
            <div className="streamer-provider-cards">
              <button
                type="button"
                onClick={() => void linkProvider()}
                disabled={!twitchAuth.isConfigured || twitchAuth.status === 'loading' || connecting}
                className="streamer-twitch-connect-button"
              >
                {twitchAuth.profile ? (
                  <img src={twitchAuth.profile.profileImageUrl} alt="" className="streamer-twitch-avatar" />
                ) : (
                  <Zap className="w-6 h-6" />
                )}
                <span>
                  <strong>
                    {twitchAuth.status === 'loading'
                      ? 'Connecting Twitch'
                      : connecting
                        ? 'Connecting Twitch Chat'
                        : twitchAuth.status === 'authenticated'
                          ? connected
                            ? 'Continue with Twitch'
                            : 'Connect Twitch Chat'
                          : 'Connect Twitch'}
                  </strong>
                  {twitchAuth.profile ? (
                    <em>{twitchAuth.profile.displayName} - @{twitchAuth.profile.login}</em>
                  ) : (
                    <em>
                      {twitchAuth.isConfigured
                        ? 'Secure login with chat:read only. Viewers will guess with !guess.'
                        : twitchAuth.configMessage ?? 'Set VITE_TWITCH_CLIENT_ID and VITE_TWITCH_REDIRECT_URI.'}
                    </em>
                  )}
                </span>
              </button>
              {twitchAuth.status === 'authenticated' && twitchAuth.profile && (
                <div className="streamer-twitch-status">
                  <img src={twitchAuth.profile.profileImageUrl} alt="" />
                  <span>
                    <strong>{twitchAuth.profile.displayName}</strong>
                    <em>@{twitchAuth.profile.login}</em>
                  </span>
                  <b>{connected ? 'Chat Connected' : 'Twitch Connected'}</b>
                </div>
              )}
              {error && (
                <p className="streamer-twitch-error">{error}</p>
              )}
              {twitchAuth.status === 'error' && twitchAuth.error && (
                <p className="streamer-twitch-error">{twitchAuth.error}</p>
              )}
              {twitchAuth.isConfigured && twitchAuth.status !== 'authenticated' && (
                <p className="streamer-twitch-error">
                  If Twitch says invalid client, confirm the Client ID belongs to this Twitch app, the OAuth
                  Redirect URL exactly matches VITE_TWITCH_REDIRECT_URI, then restart the Vite dev server.
                </p>
              )}
            </div>
          </main>
        )}

        {phase === 'select' && (
          <main className="streamer-setup-screen streamer-select-screen">
            <div className="streamer-mini-status streamer-select-status">
              <span className={`streamer-status-light streamer-status-${session.connectionStatus}`} />
              <div>
                <p>{session.providerName} Provider</p>
                <strong>{formatStatus(session.connectionStatus)} - {viewers.length} viewers ready</strong>
              </div>
            </div>
            <div className="streamer-mode-grid">
              <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setMode('standard'); }} className={mode === 'standard' ? 'active' : ''} aria-pressed={mode === 'standard'}>
                <Timer className="w-8 h-8" />
                {mode === 'standard' && <em className="streamer-selected-badge">Selected</em>}
                <strong>Regular Guesses</strong>
                <span>Everyone guesses the hidden clock. Closest players climb the leaderboard.</span>
              </button>
              <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setMode('elimination'); }} className={mode === 'elimination' ? 'active' : ''} aria-pressed={mode === 'elimination'}>
                <ShieldAlert className="w-8 h-8" />
                {mode === 'elimination' && <em className="streamer-selected-badge">Selected</em>}
                <strong>Elimination</strong>
                <span>Each reveal cuts the bottom players until the final survivor remains.</span>
              </button>
            </div>
            <button type="button" className="streamer-launch-button" onClick={() => void openLobby(mode)}>
              Open {mode === 'elimination' ? 'Elimination' : 'Regular Guesses'}
            </button>
          </main>
        )}

        {!['link', 'select'].includes(phase) && (
          <>
            <main className="streamer-clock-arena">
              {!suppressStreamerSidePanels && (
                <div className="streamer-live-meta">
                  <button type="button" className="streamer-icon-button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setBoardView('overall'); setLeaderboardFullscreen(true); }} aria-label="Open overall leaderboard">
                    <BarChart3 className="w-5 h-5" />
                  </button>
                  <button type="button" className="streamer-icon-button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setSettingsOpen(previous => !previous); }} aria-label="Streamer mode settings">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              )}

              {!suppressStreamerSidePanels && (
                <div className="streamer-game-instruction">
                  {phase === 'lobby' && lobbyInstruction}
                  {phase === 'close-race' && 'Final round pressure check.'}
                  {phase === 'countdown' && 'Start counting in.'}
                  {phase === 'running' && 'Hidden clock running.'}
                  {phase === 'stopped' && ''}
                  {(phase === 'guessing' || phase === 'streamer-guess') && 'Clock stopped. Chat: type !guess with your time. Streamer: enter your guess below.'}
                </div>
              )}

              {!suppressStreamerSidePanels && (
              <div className={`streamer-timeguess-panel streamer-clock-${phase}`}>
                <div className="streamer-shimmer-layer" aria-hidden="true">
                  <div className="shimmer-blob shimmer-blob-1" />
                  <div className="shimmer-blob shimmer-blob-2" />
                  <div className="shimmer-blob shimmer-blob-3" />
                </div>

                <div className="streamer-timeguess-content">
                  {phase === 'lobby' && (
                    <>
                      <div className="streamer-ready-icon"><Clock className="w-10 h-10" /></div>
                      <p className="streamer-stage-title">Ready</p>
                    </>
                  )}
                  {phase === 'close-race' && closeRaceBattle && (
                    <motion.div
                      className="streamer-close-race-screen"
                      initial={{ opacity: 0, y: 18, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <span>Race for {getPlacementLabel(closeRaceBattle.position)}</span>
                      <strong>{closeRaceBattle.players[0].viewerName} vs {closeRaceBattle.players[1].viewerName}</strong>
                      <em>{closeRaceBattle.gap === 0 ? 'Dead level going into the final round' : `${closeRaceBattle.gap} pt gap going into the final round`}</em>
                    </motion.div>
                  )}
                  {phase === 'countdown' && (
                    <>
                      <p className="streamer-countdown-label">Start counting in</p>
                      <p className="streamer-countdown-number">{countdownValue}</p>
                      <p className="streamer-countdown-hint">Count in your head when the clock hides</p>
                    </>
                  )}
                  {phase === 'running' && (
                    <>
                      <p className="streamer-hidden-time streamer-format-hint">??:??</p>
                    </>
                  )}
                  {phase === 'stopped' && (
                    <p className="streamer-stage-title streamer-running-stop">STOP</p>
                  )}
                  {(phase === 'guessing' || phase === 'streamer-guess') && (
                    <div className="streamer-guessing-face">
                      <p className="streamer-hidden-time streamer-format-hint">??:??</p>
                    </div>
                  )}
                  {phase === 'revealed' && (
                    <div className="streamer-reveal-stage streamer-cinematic-reveal">
                      <motion.div
                        initial={{ scale: 1.02, opacity: 0 }}
                        animate={{ scale: 0.74, opacity: 1 }}
                        transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                        className="streamer-reveal-reference"
                      >
                        <p>Your Guess</p>
                        <strong>{streamerGuessValue !== null ? formatSeconds(streamerGuessValue) : '--.--s'}</strong>
                      </motion.div>
                      <div className="streamer-reveal-number-wrap">
                        <p>Actual Time</p>
                        <motion.strong
                          key={displayTime}
                          initial={{ opacity: 0.42, filter: 'blur(2px)' }}
                          animate={{ opacity: 1, filter: 'blur(0px)' }}
                          transition={{ duration: revealStage === 'final' ? 0.5 : 0.24, ease: 'easeOut' }}
                        >
                          {displayTime}
                        </motion.strong>
                      </div>
                    </div>
                  )}
                  {phase === 'closed' && !finaleOverlayActive && !finalOverallLeaderboardOpen && (
                    <div className="streamer-podium-screen">
                      <p className="streamer-eyebrow">{mode === 'elimination' ? 'Last Player Standing' : 'Final Standings'}</p>
                      {mode === 'elimination' && activeViewerIds.length > 1 && (
                        <div className="streamer-champion-card streamer-tiebreaker-card">
                          <strong>Tiebreaker Needed</strong>
                          <span>{activeViewerIds.length} survivors remain</span>
                        </div>
                      )}
                      {mode === 'elimination' && activeViewerIds.length <= 1 && eliminationChampion && (
                        <motion.div
                          className="streamer-champion-card"
                          initial={{ scale: 0.88, y: 18 }}
                          animate={{ scale: 1, y: 0 }}
                          transition={{ duration: 0.45, ease: 'easeOut' }}
                        >
                          <Crown className="w-8 h-8" />
                          <strong>{eliminationChampion.viewerName}</strong>
                          <span>Last player standing</span>
                        </motion.div>
                      )}
                      <div className="streamer-podium-lane" aria-live="polite">
                        {[podiumEntries[2], podiumEntries[1], podiumEntries[0]].map((entry, index) => {
                          if (!entry) return null;
                          const place = [3, 2, 1][index];
                          const visible = podiumStage >= index + 1;
                          const finalGuess = getLastGuessForViewer(entry.viewerId, finalRankedGuesses);
                          return (
                            <motion.div
                              key={entry.viewerId}
                              className={`streamer-podium-card place-${place}`}
                              initial={{ opacity: 0, y: 36, scale: 0.92 }}
                              animate={visible ? { opacity: 1, y: 0, scale: place === 1 ? 1.06 : 1 } : { opacity: 0, y: 36, scale: 0.92 }}
                              transition={{ duration: 0.45, ease: 'easeOut' }}
                            >
                              <span>#{place}</span>
                              <strong>{entry.viewerName}</strong>
                              <em>{getPodiumResult(entry, finalGuess, finalTime, mode)}</em>
                            </motion.div>
                          );
                        })}
                      </div>
                      {mode === 'elimination' && activeViewerIds.length > 1 && (
                        <p className="streamer-stage-subtitle">Tiebreaker: run another round to crown one survivor.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              )}

              {(phase === 'guessing' || phase === 'streamer-guess') && guessToastFeed.length > 0 && !suppressStreamerSidePanels && (
                <div className="streamer-elimination-guess-feed" aria-live="polite">
                  <AnimatePresence initial={false}>
                    {guessToastFeed.map(guess => (
                      <motion.div
                        layout="position"
                        key={guess.id}
                        className="streamer-elimination-guess-toast"
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -22, scale: 0.98 }}
                        transition={{
                          opacity: { duration: 0.26, ease: 'easeOut' },
                          y: { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
                          scale: { duration: 0.28, ease: 'easeOut' },
                          layout: { duration: 0.36, ease: [0.16, 1, 0.3, 1] },
                        }}
                      >
                        <span>{getViewerName(guess, viewers, streamerDisplayName)}</span>
                        <strong>{formatSeconds(guess.value)}</strong>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {phase === 'revealed' && revealStage !== 'final' && revealMatchFeed.length > 0 && !suppressStreamerSidePanels && (
                <div className="streamer-elimination-guess-feed streamer-reveal-match-feed" aria-live="polite">
                  <AnimatePresence initial={false}>
                    {revealMatchFeed.map(guess => (
                      <motion.div
                        layout="position"
                        key={`${revealStage}-${guess.id}`}
                        className="streamer-elimination-guess-toast streamer-reveal-match-toast"
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -22, scale: 0.98 }}
                        transition={{
                          opacity: { duration: 0.26, ease: 'easeOut' },
                          y: { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
                          scale: { duration: 0.28, ease: 'easeOut' },
                          layout: { duration: 0.36, ease: [0.16, 1, 0.3, 1] },
                        }}
                      >
                        <span>{getViewerName(guess, viewers, streamerDisplayName)}</span>
                        <strong>{revealStage === 'seconds' ? `${Math.floor(finalTime ?? 0)}.??s` : `${(Math.floor((finalTime ?? 0) * 10) / 10).toFixed(1)}?s`}</strong>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {!suppressStreamerSidePanels && (
              <div className="streamer-primary-controls">
                {phase === 'lobby' && (
                  <button type="button" onClick={() => void beginRound()} disabled={!connected}>
                    Start
                  </button>
                )}
                {phase === 'close-race' && (
                  <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setPhase('lobby'); }}>
                    Continue
                  </button>
                )}
                {phase === 'running' && (
                  <span className="streamer-waiting-pill">Hidden clock running</span>
                )}
                {(phase === 'guessing' || phase === 'streamer-guess') && !streamerEliminated && (
                  <div className="streamer-guess-control-stack">
                    <div className="streamer-chat-timer streamer-bottom-timer" aria-live="polite">
                      <span>{guessSecondsLeft}</span>
                      <em>seconds left</em>
                    </div>
                    <div className="streamer-guess-entry">
                      <label className="streamer-guess-field">
                        <span>Streamer guess</span>
                        <input
                          value={streamerGuessInput}
                          onChange={event => setStreamerGuessInput(event.target.value)}
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label="Streamer guess"
                          disabled={streamerGuessValue !== null}
                        />
                      </label>
                      <button type="button" onClick={saveStreamerGuess} disabled={!canSaveStreamerGuess || streamerGuessValue !== null}>
                        {streamerGuessValue === null ? 'Lock' : 'Locked'}
                      </button>
                      <button type="button" onClick={() => void revealResults()} disabled={!canReveal}>
                        Reveal
                      </button>
                    </div>
                  </div>
                )}
                {(phase === 'guessing' || phase === 'streamer-guess') && streamerEliminated && (
                  <span className="streamer-waiting-pill streamer-eliminated-streamer-pill">Streamer eliminated</span>
                )}
                {phase === 'revealed' && revealStage === 'final' && (
                  <button type="button" onClick={advanceFromRevealedRound}>
                    {mode === 'standard' && !roundLeaderboardSeen ? 'View Round Results' : roundWillEndGame ? 'View Podium' : roundNeedsTiebreaker ? 'Sudden Death' : mode === 'elimination' && eliminatedParticipants.length > 0 ? 'Show Cut' : mode === 'elimination' ? 'Next Round' : 'Next Round'}
                  </button>
                )}
                {phase === 'closed' && (
                  <div className="streamer-end-actions">
                    {mode === 'elimination' && activeViewerIds.length > 1 && (
                      <button type="button" onClick={() => void beginRound()}>
                        Sudden Death
                      </button>
                    )}
                    {mode !== 'elimination' && (
                      <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setBoardView('overall'); setLeaderboardFullscreen(true); }}>
                        Next
                      </button>
                    )}
                    <button type="button" onClick={() => void resetGame()}>
                      <RefreshCw className="w-5 h-5" />
                      Play Again
                    </button>
                  </div>
                )}
              </div>
              )}

              {phase === 'revealed' && revealStage === 'final' && isSpotOn && (
                <div className="confetti streamer-spot-on-confetti" aria-hidden="true">
                  {Array.from({ length: 14 }, (_, index) => <span key={index} className="confetti-piece" />)}
                </div>
              )}

              {winner && !suppressStreamerSidePanels && (
                <div className={`streamer-winner-callout ${isSpotOn ? 'streamer-spot-on-callout' : ''}`}>
                  <Crown className="w-5 h-5" />
                  <span>
                    {isSpotOn ? 'Spot On! ' : ''}
                    {getViewerName(winner, viewers, streamerDisplayName)} was closest
                    {winnerError !== null ? ` - ${winnerError.toFixed(2)}s away` : ''}
                  </span>
                </div>
              )}
              {error && <p className="streamer-error">{error}</p>}

              <AnimatePresence>
                {settingsOpen && (
                  <motion.div
                    className="streamer-settings-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="streamer-settings-panel"
                      initial={{ opacity: 0, y: 18, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 18, scale: 0.98 }}
                    >
                      <div className="streamer-settings-head">
                        <div>
                          <p className="streamer-eyebrow">Streamer Setup</p>
                          <h2>{mode === 'elimination' ? 'Elimination' : 'Regular Guesses'}</h2>
                        </div>
                        <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setSettingsOpen(false); }}>Done</button>
                      </div>

                      <div className="streamer-mini-status">
                        <span className={`streamer-status-light streamer-status-${session.connectionStatus}`} />
                        <div>
                          <p>{session.providerName} Provider</p>
                          <strong>{formatStatus(session.connectionStatus)} - {viewers.length} viewers</strong>
                        </div>
                      </div>

                      <div className="streamer-modifier-panel streamer-game-modifiers">
                        <div>
                          <div className="streamer-slider-head">
                            <div>
                              <p className="streamer-eyebrow">Auto Run</p>
                              <span>{autoRunEnabled ? 'Running automatically' : 'Manual control'}</span>
                            </div>
                            <button
                              type="button"
                              className={autoRunEnabled ? 'active' : ''}
                              onClick={() => {
                                playStreamerTone(620, 0.045, 0.06);
                                setAutoRunEnabled(previous => !previous);
                              }}
                              aria-pressed={autoRunEnabled}
                            >
                              {autoRunEnabled ? 'On' : 'Off'}
                            </button>
                          </div>
                          <p className="streamer-settings-note">
                            Starts rounds, waits for the guess window, and advances reveal screens so the game can run unattended.
                          </p>
                        </div>
                      </div>

                      <div className="streamer-modifier-panel streamer-game-modifiers">
                        <div>
                          <div className="streamer-slider-head">
                            <p className="streamer-eyebrow">Round Guess Window</p>
                            <strong>{guessWindow}s</strong>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={60}
                            step={1}
                            value={guessWindow}
                            onChange={event => setGuessWindow(Number(event.target.value))}
                            disabled={phase !== 'lobby'}
                            className="streamer-window-slider"
                            aria-label="Round guess window seconds"
                          />
                          <div className="streamer-slider-labels" aria-hidden="true">
                            <span>1s</span>
                            <span>60s</span>
                          </div>
                        </div>
                        <div>
                          <p className="streamer-eyebrow">Rounds</p>
                          {mode === 'elimination' && (
                            <div className="streamer-round-slider-block">
                              <div className="streamer-slider-head">
                                <span>{eliminationRounds} rounds</span>
                              </div>
                              <input
                                key="elimination-rounds-slider"
                                type="range"
                                min={2}
                                max={eliminationRoundMax}
                                step={1}
                                value={eliminationRounds}
                                onInput={event => updateEliminationRounds(event.currentTarget.value)}
                                onChange={event => updateEliminationRounds(event.currentTarget.value)}
                                disabled={roundSettingsLocked}
                                className="streamer-window-slider"
                                aria-label="Elimination mode rounds"
                              />
                              <div className="streamer-slider-labels" aria-hidden="true">
                                <span>2</span>
                                <span>{eliminationRoundMax}</span>
                              </div>
                            </div>
                          )}
                          {mode === 'standard' && (
                            <div className="streamer-round-slider-block">
                              <div className="streamer-slider-head">
                                <span>{regularRounds === 'unlimited' ? 'Unlimited rounds' : `${regularRounds} rounds`}</span>
                                <button
                                  type="button"
                                  onClick={() => { playStreamerTone(620, 0.045, 0.06); setRegularRounds(previous => previous === 'unlimited' ? 5 : 'unlimited'); }}
                                  disabled={roundSettingsLocked}
                                  className={regularRounds === 'unlimited' ? 'active' : ''}
                                >
                                  Unlimited
                                </button>
                              </div>
                              <input
                                type="range"
                                min={1}
                                max={regularRoundMax}
                                step={1}
                                value={regularRounds === 'unlimited' ? regularRoundMax : regularRounds}
                                onChange={event => setRegularRounds(Number(event.target.value))}
                                disabled={roundSettingsLocked || regularRounds === 'unlimited'}
                                className="streamer-window-slider"
                                aria-label="Regular mode rounds"
                              />
                              <div className="streamer-slider-labels" aria-hidden="true">
                                <span>1</span>
                                <span>{regularRoundMax}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {showStreamerRightPanel && (
            <aside className="streamer-game-side streamer-game-right">
              <div className="streamer-results-panel">
                <div className="streamer-panel-heading">
                  <div>
                    <p className="streamer-eyebrow">{boardView === 'overall' ? 'Overall Leaderboard' : phase === 'revealed' ? getStageLabel(revealStage) : 'Chat Guesses'}</p>
                    <h2>{boardView === 'overall' ? `${overallLeaderboard.length} players` : `${roundGuesses.length} guesses`}</h2>
                  </div>
                  <button type="button" className="streamer-panel-icon-button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setLeaderboardFullscreen(true); }} aria-label="Open fullscreen leaderboard">
                    <Maximize2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="streamer-board-toggle" role="tablist" aria-label="Streamer leaderboard view">
                  <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setBoardView('round'); }} className={boardView === 'round' ? 'active' : ''}>
                    Round
                  </button>
                  <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setBoardView('overall'); }} className={boardView === 'overall' ? 'active' : ''}>
                    Overall
                  </button>
                </div>
                <div className="streamer-list streamer-game-list">
                  {boardView === 'round' && (
                    <AnimatePresence mode="popLayout">
                      {(phase === 'revealed' ? rankedGuesses : roundGuesses).map((guess, index) => {
                        const guessError = finalTime === null ? null : Math.abs(guess.value - finalTime);
                        const podiumClass = phase === 'revealed' && revealStage === 'final' && index < 3 ? `podium-${index + 1}` : '';
                        return (
                          <motion.div
                            layout
                            key={guess.id}
                            className={`streamer-list-row ${winner?.id === guess.id ? 'winner' : ''} ${podiumClass}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.22 }}
                          >
                            <span>
                              <strong>{getViewerName(guess, viewers, streamerDisplayName)}</strong>
                              <em>
                                {phase === 'revealed' && guessError !== null
                                  ? `#${index + 1} - guessed ${formatSeconds(guess.value)}`
                                  : 'Guess locked'}
                              </em>
                            </span>
                            <b>{phase === 'revealed' ? getSignedError(guess, finalTime) : formatSeconds(guess.value)}</b>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                  {boardView === 'overall' && overallLeaderboard.map((entry, index) => {
                    const rank = getStreamerRank(entry.rankPoints);
                    return (
                      <div key={entry.viewerId} className={`streamer-list-row ${entry.score === 0 ? 'zero-score' : ''}`}>
                        <span>
                          <strong className={entry.viewerName.length > 16 ? 'needs-marquee' : ''}>#{index + 1} {entry.viewerName}</strong>
                          <em>{rank.icon} {rank.name}</em>
                        </span>
                        <b>{entry.score} pts</b>
                      </div>
                    );
                  })}
                  {boardView === 'round' && roundGuesses.length === 0 && (
                    <div className="streamer-empty-state">
                      {phase === 'guessing' ? 'Waiting for chat guesses...' : 'Start the round to collect guesses.'}
                    </div>
                  )}
                </div>
              </div>
            </aside>
            )}

            <AnimatePresence>
              {leaderboardFullscreen && (
                <motion.div
                  className={`streamer-fullscreen-overlay ${boardView === 'overall' ? 'streamer-overall-overlay' : ''} ${finalOverallLeaderboardOpen ? 'streamer-final-overall-overlay' : ''}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className={`streamer-fullscreen-board ${standardRoundResultsOpen ? 'streamer-round-results-board' : ''}`}
                    initial={{ y: 28, scale: 0.96, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    exit={{ y: 28, scale: 0.96, opacity: 0 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                  >
                    <div className="streamer-fullscreen-head">
                      <div>
                        <p className="streamer-eyebrow">{boardView === 'overall' ? 'Overall Leaderboard' : 'Round Leaderboard'}</p>
                        <h2>{finalOverallLeaderboardOpen ? `${podiumWinnerName} won!` : boardView === 'overall' ? `${overallLeaderboard.length} players` : `${roundGuesses.length} guesses`}</h2>
                        {isFinalRoundCloseRace && closeRaceBattle && boardView === 'overall' && !finalOverallLeaderboardOpen && (
                          <span className="streamer-close-race-note">
                            Race for {getPlacementLabel(closeRaceBattle.position)}: {closeRaceBattle.gap === 0
                              ? `${closeRaceBattle.players[0].viewerName} and ${closeRaceBattle.players[1].viewerName} are tied`
                              : `${closeRaceBattle.players[0].viewerName} leads ${closeRaceBattle.players[1].viewerName} by ${closeRaceBattle.gap} pts`}
                          </span>
                        )}
                      </div>
                      {!standardRoundResultsOpen && (
                        <button type="button" onClick={closeLeaderboard}>
                          <Minimize2 className="w-5 h-5" />
                          {phase === 'closed' && boardView === 'overall' ? 'Close' : 'Smaller'}
                        </button>
                      )}
                    </div>
                    {(phase === 'revealed' || isFinalRoundCloseRace || boardView !== 'overall') && !standardRoundResultsOpen && !finalOverallLeaderboardOpen && (
                      <div className="streamer-board-toggle" role="tablist" aria-label="Fullscreen leaderboard view">
                        <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setBoardView('round'); }} className={boardView === 'round' ? 'active' : ''}>
                          Round
                        </button>
                        <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setBoardView('overall'); }} className={boardView === 'overall' ? 'active' : ''}>
                          Overall
                        </button>
                      </div>
                    )}
                    <div className="streamer-list streamer-fullscreen-list">
                      {boardView === 'round' && (phase === 'revealed' ? rankedGuesses : roundGuesses).map((guess, index) => {
                        const guessError = finalTime === null ? null : Math.abs(guess.value - finalTime);
                        const pointsScored = phase === 'revealed' && mode === 'standard' && index < roundScoringCount
                          ? getPlacementScore(index, roundScoringCount)
                          : 0;
                        return (
                          <div key={guess.id} className={`streamer-list-row ${phase === 'revealed' && index < 3 ? `podium-${index + 1}` : ''} ${standardRoundResultsOpen ? 'streamer-round-result-row' : ''}`}>
                            <span>
                              <strong>
                                {phase === 'revealed' && (
                                  <i className={`streamer-placement-badge ${index < 3 ? `place-${index + 1}` : ''}`}>#{index + 1}</i>
                                )}
                                {getViewerName(guess, viewers, streamerDisplayName)}
                              </strong>
                              <em>
                                {phase === 'revealed' && guessError !== null
                                  ? `guessed ${formatSeconds(guess.value)}`
                                  : 'Guess locked'}
                              </em>
                            </span>
                            {phase === 'revealed' && mode === 'standard' ? (
                              <span className="streamer-round-result-metrics">
                                <b className="streamer-round-error">{getSignedError(guess, finalTime)}</b>
                                {pointsScored > 0 && <b className="streamer-round-points">+{pointsScored} pts</b>}
                              </span>
                            ) : (
                              <b>{phase === 'revealed' ? getSignedError(guess, finalTime) : formatSeconds(guess.value)}</b>
                            )}
                          </div>
                        );
                      })}
                      {boardView === 'overall' && finalOverallLeaderboardOpen && mode === 'elimination' && eliminationFinalStandings.map((entry, index) => (
                        <div key={entry.viewerId} className={`streamer-list-row streamer-elimination-final-row ${index === 0 ? 'podium-1' : ''}`}>
                          <span>
                            <strong className={entry.viewerName.length > 16 ? 'needs-marquee' : ''}>#{index + 1} {entry.viewerName}</strong>
                            <em>{entry.detail}</em>
                          </span>
                          <b>{entry.status}</b>
                        </div>
                      ))}
                      {boardView === 'overall' && !(finalOverallLeaderboardOpen && mode === 'elimination') && overallLeaderboard.map((entry, index) => {
                        const rank = getStreamerRank(entry.rankPoints);
                        return (
                          <div key={entry.viewerId} className={`streamer-list-row ${entry.score === 0 ? 'zero-score' : ''} ${isFinalRoundCloseRace && closeRaceBattle && index >= closeRaceBattle.position - 1 && index <= closeRaceBattle.position && !finalOverallLeaderboardOpen ? 'close-race' : ''} ${finalOverallLeaderboardOpen && index < 3 ? `podium-${index + 1}` : ''}`}>
                            <span>
                              <strong className={entry.viewerName.length > 16 ? 'needs-marquee' : ''}>#{index + 1} {entry.viewerName}</strong>
                              <em>{rank.icon} {rank.name}</em>
                            </span>
                            <b>{entry.score} pts</b>
                          </div>
                        );
                      })}
                    </div>
                    {standardRoundResultsOpen && (
                      <button type="button" className="streamer-round-results-continue" onClick={closeLeaderboard}>
                        {roundWillEndGame ? 'View Podium' : 'Next Round'}
                      </button>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {eliminationCutOverlayActive && (
                <motion.div
                  className="streamer-elimination-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="streamer-elimination-decision">
                    <div className="streamer-elimination-decision-head">
                      <span>Elimination Cut</span>
                      <strong>Top {advancingCountLabel} advance</strong>
                    </div>
                    <div className="streamer-elimination-decision-list">
                      <div className="streamer-elimination-row-stack streamer-elimination-safe-stack">
                        {safeDecisionRows.map((guess, index) => (
                          <div key={guess.id} className="streamer-elimination-decision-row is-safe">
                            <span>#{index + 1}</span>
                            <strong>{getViewerName(guess, viewers, streamerDisplayName)}</strong>
                            <em>Safe</em>
                            <b>{getSignedError(guess, finalTime)}</b>
                          </div>
                        ))}
                        <div className="streamer-elimination-cut-line" ref={cutoffRef}>
                          <span>Cutoff</span>
                        </div>
                        {eliminatedDecisionRows.map((guess, index) => (
                          <div key={guess.id} className="streamer-elimination-decision-row is-eliminated">
                            <span>#{safeDecisionRows.length + index + 1}</span>
                            <strong>{getViewerName(guess, viewers, streamerDisplayName)}</strong>
                            <em>Eliminated</em>
                            <b>{getSignedError(guess, finalTime)}</b>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button type="button" className="streamer-elimination-next" onClick={() => void nextRound()}>
                      {roundWillEndGame ? 'View Podium' : 'Next Round'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {finaleOverlayActive && (
                <motion.div
                  className={`streamer-finale-overlay ${mode === 'elimination' ? 'streamer-elimination-finale' : ''}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={event => {
                    if ((event.target as HTMLElement).closest('button')) return;
                    advancePodium();
                  }}
                >
                  <div className="streamer-finale-burst" aria-hidden="true">
                    {Array.from({ length: 18 }).map((_, index) => (
                      <span key={index} style={{ '--burst-index': index } as CSSProperties} />
                    ))}
                  </div>
                  <motion.div
                    className="streamer-finale-content"
                    initial={{ y: 36, scale: 0.94, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  >
                    <AnimatePresence mode="wait">
                      {!showPodiumIntro ? (
                        <motion.div
                          key="podium-intro"
                          className="streamer-finale-intro"
                          initial={{ opacity: 0, y: 28, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -16, scale: 0.985, transition: { duration: 0.16, ease: 'easeInOut' } }}
                          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <motion.span initial={{ opacity: 0, x: 160 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
                            Get ready...
                          </motion.span>
                          <motion.strong initial={{ opacity: 0, x: '38vw' }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.75, duration: 0.95, ease: [0.16, 1, 0.3, 1] }}>
                            {podiumIntroLine}
                          </motion.strong>
                          <motion.span initial={{ opacity: 0, x: 180 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.85, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
                            {podiumPrompt}
                          </motion.span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="podium-reveal"
                          className="streamer-finale-reveal"
                          initial={{ opacity: 0, y: 18 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -18 }}
                          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {mode === 'elimination' && activeViewerIds.length > 1 && (
                            <div className="streamer-finale-tiebreaker">
                              <strong>Tiebreaker needed</strong>
                              <span>{activeViewerIds.length} survivors remain.</span>
                            </div>
                          )}
                        <motion.div
                          className={`streamer-finale-cue ${podiumStage >= 3 ? 'streamer-finale-cue-winner' : ''}`}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, ease: 'easeOut' }}
                        >
                          {podiumPrompt}
                        </motion.div>
                        <div className="streamer-finale-podium" aria-live="polite">
                          {podiumSlots.map(({ place, entry }) => {
                            const visible = (place === 3 && podiumStage >= 1) || (place === 2 && podiumStage >= 2) || (place === 1 && podiumStage >= 3);
                            const finalGuess = entry ? getLastGuessForViewer(entry.viewerId, finalRankedGuesses) : null;
                            const cardScale = place === 1 ? 1.025 : 1;
                            return (
                              <motion.div
                                key={`podium-place-${place}`}
                                className={`streamer-finale-podium-card place-${place} ${entry ? '' : 'is-empty'}`}
                                aria-hidden={!visible || !entry}
                                initial={false}
                                animate={visible && entry
                                  ? { opacity: 1, y: 0, scale: cardScale, rotateX: 0 }
                                  : { opacity: 0, y: 26, scale: 0.95, rotateX: 5 }}
                                transition={podiumRevealTransition}
                              >
                                <Trophy className="w-9 h-9" />
                                <span>#{place}</span>
                                <strong><em className={entry && entry.viewerName.length > 16 ? 'needs-marquee' : ''}>{entry?.viewerName ?? 'Waiting'}</em></strong>
                                <b>{entry ? getPodiumResult(entry, finalGuess, finalTime, mode) : '--'}</b>
                              </motion.div>
                            );
                          })}
                        </div>
                        <motion.div
                          className="streamer-finale-actions"
                          initial={false}
                          animate={podiumStage >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                          transition={{ duration: 0.28, ease: 'easeOut' }}
                          aria-hidden={podiumStage < 3}
                        >
                          {podiumStage >= 3 && (
                            <>
                            {mode === 'elimination' && activeViewerIds.length > 1 && (
                              <button type="button" onClick={() => void beginRound()}>
                                Tiebreaker Round
                              </button>
                            )}
                            {mode !== 'elimination' && (
                              <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setBoardView('overall'); setLeaderboardFullscreen(true); }}>
                                Next
                              </button>
                            )}
                            {mode === 'elimination' && activeViewerIds.length <= 1 && (
                              <button type="button" onClick={() => { playStreamerTone(620, 0.045, 0.06); setBoardView('overall'); setLeaderboardFullscreen(true); }}>
                                Next
                              </button>
                            )}
                            </>
                          )}
                        </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </section>
  );
}

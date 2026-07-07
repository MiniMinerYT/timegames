import type { Guess, LeaderboardEntry, Round } from '../types/streamer';

export function buildLeaderboard(guesses: Guess[], round: Round | null): LeaderboardEntry[] {
  const target = round?.targetTime;
  const entries = new Map<string, LeaderboardEntry>();

  guesses.forEach(guess => {
    const bestError = typeof target === 'number' ? Math.abs(guess.value - target) : null;
    const current = entries.get(guess.viewerId);
    if (!current) {
      entries.set(guess.viewerId, {
        viewerId: guess.viewerId,
        viewerName: guess.viewerName,
        guesses: 1,
        bestGuess: guess.value,
        bestError,
        lastGuessAt: guess.receivedAt,
      });
      return;
    }

    const shouldReplaceBest = bestError !== null && (current.bestError === null || bestError < current.bestError);
    entries.set(guess.viewerId, {
      ...current,
      guesses: current.guesses + 1,
      bestGuess: shouldReplaceBest ? guess.value : current.bestGuess,
      bestError: shouldReplaceBest ? bestError : current.bestError,
      lastGuessAt: Math.max(current.lastGuessAt, guess.receivedAt),
    });
  });

  return [...entries.values()].sort((a, b) => {
    if (a.bestError !== null && b.bestError !== null) return a.bestError - b.bestError;
    if (a.bestError !== null) return -1;
    if (b.bestError !== null) return 1;
    return b.lastGuessAt - a.lastGuessAt;
  });
}

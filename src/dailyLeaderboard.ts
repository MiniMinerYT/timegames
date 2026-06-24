import { isSupabaseConfigured, supabase } from './supabaseClient';

export interface DailyLeaderboardEntry {
  id: string;
  challenge_date: string;
  player_id: string;
  display_name: string;
  error: number;
  guess: number;
  created_at: string;
}

export interface DailyLeaderboardSummary {
  playerRank: number | null;
  totalPlayers: number;
  bestScoreToday: number | null;
  topTen: DailyLeaderboardEntry[];
}

const DAILY_SUBMISSIONS_TABLE = 'daily_submissions';

function emptySummary(): DailyLeaderboardSummary {
  return {
    playerRank: null,
    totalPlayers: 0,
    bestScoreToday: null,
    topTen: [],
  };
}

function normalizeEntry(entry: DailyLeaderboardEntry): DailyLeaderboardEntry {
  return {
    ...entry,
    error: Number(entry.error),
    guess: Number(entry.guess),
  };
}

export async function fetchDailyLeaderboard(
  challengeDate: string,
  playerId?: string
): Promise<DailyLeaderboardSummary | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error, count } = await supabase
    .from(DAILY_SUBMISSIONS_TABLE)
    .select('id, challenge_date, player_id, display_name, error, guess, created_at', { count: 'exact' })
    .eq('challenge_date', challengeDate)
    .order('error', { ascending: true })
    .order('created_at', { ascending: true })
    .range(0, 9999);

  if (error) throw error;

  const entries = (data ?? []).map(entry => normalizeEntry(entry as DailyLeaderboardEntry));
  const playerIndex = playerId
    ? entries.findIndex(entry => entry.player_id === playerId)
    : -1;

  return {
    playerRank: playerIndex >= 0 ? playerIndex + 1 : null,
    totalPlayers: count ?? entries.length,
    bestScoreToday: entries[0]?.error ?? null,
    topTen: entries.slice(0, 10),
  };
}

export async function submitDailyLeaderboardScore({
  challengeDate,
  playerId,
  displayName,
  error,
  guess,
}: {
  challengeDate: string;
  playerId: string;
  displayName: string;
  error: number;
  guess: number;
}): Promise<DailyLeaderboardSummary | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const existing = await supabase
    .from(DAILY_SUBMISSIONS_TABLE)
    .select('id')
    .eq('challenge_date', challengeDate)
    .eq('player_id', playerId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (!existing.data) {
    const inserted = await supabase
      .from(DAILY_SUBMISSIONS_TABLE)
      .insert({
        challenge_date: challengeDate,
        player_id: playerId,
        display_name: displayName,
        error,
        guess,
      });

    if (inserted.error) {
      const fallback = await supabase
        .from(DAILY_SUBMISSIONS_TABLE)
        .select('id')
        .eq('challenge_date', challengeDate)
        .eq('player_id', playerId)
        .maybeSingle();

      if (fallback.error || !fallback.data) throw inserted.error;
    }
  }

  return fetchDailyLeaderboard(challengeDate, playerId);
}

export { emptySummary };

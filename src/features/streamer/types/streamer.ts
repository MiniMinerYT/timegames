export type StreamerConnectionStatus = 'not-connected' | 'connecting' | 'connected';

export type StreamerProviderId =
  | 'twitch'
  | 'youtube'
  | 'kick'
  | 'discord'
  | 'local-lan'
  | 'ai-bots';

export type StreamerRoundStatus = 'idle' | 'collecting' | 'ended';

export interface StreamerSession {
  id: string;
  providerId: StreamerProviderId;
  providerName: string;
  connectionStatus: StreamerConnectionStatus;
  viewerCount: number;
  activeRoundId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Viewer {
  id: string;
  displayName: string;
  joinedAt: number;
  badges?: string[];
}

export interface Guess {
  id: string;
  viewerId: string;
  viewerName: string;
  value: number;
  roundId: string;
  receivedAt: number;
  sourceMessage?: string;
}

export interface Round {
  id: string;
  status: StreamerRoundStatus;
  startedAt: number;
  endedAt: number | null;
  targetTime?: number;
}

export interface LeaderboardEntry {
  viewerId: string;
  viewerName: string;
  guesses: number;
  bestGuess: number;
  bestError: number | null;
  lastGuessAt: number;
}

export interface StreamerProviderSnapshot {
  session: StreamerSession;
  viewers: Viewer[];
  guesses: Guess[];
  currentRound: Round | null;
  leaderboard: LeaderboardEntry[];
}

export type StreamerProviderEvent =
  | { type: 'connection-change'; snapshot: StreamerProviderSnapshot }
  | { type: 'viewer-join'; viewer: Viewer; snapshot: StreamerProviderSnapshot }
  | { type: 'guess'; guess: Guess; snapshot: StreamerProviderSnapshot }
  | { type: 'round-start'; round: Round; snapshot: StreamerProviderSnapshot }
  | { type: 'round-end'; round: Round; snapshot: StreamerProviderSnapshot }
  | { type: 'guesses-cleared'; snapshot: StreamerProviderSnapshot };

export type StreamerProviderListener = (event: StreamerProviderEvent) => void;

export interface GuessProvider {
  readonly id: StreamerProviderId;
  readonly name: string;
  connect(): Promise<StreamerProviderSnapshot>;
  disconnect(): Promise<StreamerProviderSnapshot>;
  startRound(round?: Partial<Round>): Promise<StreamerProviderSnapshot>;
  endRound(round?: Partial<Round>): Promise<StreamerProviderSnapshot>;
  clearGuesses(): Promise<StreamerProviderSnapshot>;
  getViewers(): Promise<Viewer[]>;
  getGuesses(roundId?: string): Promise<Guess[]>;
  getSnapshot(): StreamerProviderSnapshot;
  subscribe(listener: StreamerProviderListener): () => void;
}

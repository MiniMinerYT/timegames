import { getTwitchAuthConfigStatus, readStoredTwitchAuth } from '../services/twitchAuthService';
import { buildLeaderboard } from '../utils/leaderboard';
import type {
  Guess,
  GuessProvider,
  LeaderboardEntry,
  Round,
  StreamerProviderEvent,
  StreamerProviderListener,
  StreamerProviderSnapshot,
  StreamerSession,
  Viewer,
} from '../types/streamer';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseIrcTags(rawTags: string) {
  return rawTags
    .split(';')
    .reduce<Record<string, string>>((tags, part) => {
      const [key, value = ''] = part.split('=');
      tags[key] = value.replace(/\\s/g, ' ');
      return tags;
    }, {});
}

function parseGuessValue(message: string) {
  const match = message.trim().match(/^!guess\s+(\d{1,2}(?:[.:,]\d{1,2})?)\b/i);
  if (!match) return null;

  const value = Number(match[1].replace(/[:,]/g, '.'));
  if (!Number.isFinite(value) || value < 0 || value > 99.99) return null;
  return Number(value.toFixed(2));
}

async function fetchTwitchViewerCount(accessToken: string, clientId: string, login: string) {
  try {
    const response = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
    });
    if (!response.ok) return null;
    const body = await response.json() as { data?: Array<{ viewer_count?: number }> };
    const viewerCount = body.data?.[0]?.viewer_count;
    return typeof viewerCount === 'number' && Number.isFinite(viewerCount) ? viewerCount : 0;
  } catch {
    return null;
  }
}

export class TwitchGuessProvider implements GuessProvider {
  readonly id = 'twitch' as const;
  readonly name = 'Twitch';

  private listeners = new Set<StreamerProviderListener>();
  private socket: WebSocket | null = null;
  private session: StreamerSession;
  private viewers: Viewer[] = [];
  private guesses: Guess[] = [];
  private currentRound: Round | null = null;
  private broadcaster: { id: string; login: string; displayName: string } | null = null;
  private auth: { accessToken: string; clientId: string; login: string } | null = null;
  private liveViewerCount: number | null = null;
  private viewerCountTimer: number | null = null;

  constructor() {
    const now = Date.now();
    this.session = {
      id: createId('twitch-session'),
      providerId: this.id,
      providerName: this.name,
      connectionStatus: 'not-connected',
      viewerCount: 0,
      activeRoundId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async connect() {
    if (this.session.connectionStatus === 'connected') return this.getSnapshot();

    const auth = readStoredTwitchAuth();
    if (!auth) {
      throw new Error('Connect Twitch before opening Streamer Mode.');
    }
    this.broadcaster = {
      id: auth.profile.id,
      login: auth.profile.login,
      displayName: auth.profile.displayName,
    };
    this.auth = {
      accessToken: auth.accessToken,
      clientId: getTwitchAuthConfigStatus().clientId ?? '',
      login: auth.profile.login,
    };
    if (this.auth.clientId) {
      void this.refreshLiveViewerCount();
      this.startViewerCountPolling();
    }

    this.setConnectionStatus('connecting');

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      let settled = false;
      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(connectionTimeout);
        callback();
      };
      const connectionTimeout = window.setTimeout(() => {
        socket.close();
        this.socket = null;
        this.setConnectionStatus('not-connected');
        settle(() => reject(new Error('Twitch chat connection timed out.')));
      }, 10000);

      socket.addEventListener('open', () => {
        socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        socket.send(`PASS oauth:${auth.accessToken}`);
        socket.send(`NICK ${auth.profile.login}`);
        socket.send(`JOIN #${auth.profile.login}`);
        this.socket = socket;
      });

      socket.addEventListener('message', event => {
        const payload = String(event.data);
        this.handleSocketMessage(payload);
        if (payload.includes(' 001 ')) {
          this.setConnectionStatus('connected');
          settle(resolve);
        }
        if (payload.includes('Login authentication failed') || payload.includes('Improperly formatted auth')) {
          socket.close();
          this.socket = null;
          this.setConnectionStatus('not-connected');
          settle(() => reject(new Error('Twitch rejected the saved login. Reconnect Twitch and try again.')));
        }
      });

      socket.addEventListener('error', () => {
        this.socket = null;
        this.setConnectionStatus('not-connected');
        settle(() => reject(new Error('Could not connect to Twitch chat.')));
      });

      socket.addEventListener('close', () => {
        if (this.socket === socket) {
          this.socket = null;
          this.setConnectionStatus('not-connected');
        }
      });
    });

    return this.getSnapshot();
  }

  async disconnect() {
    this.socket?.close();
    this.socket = null;
    this.broadcaster = null;
    this.auth = null;
    this.liveViewerCount = null;
    this.stopViewerCountPolling();
    this.currentRound = null;
    this.guesses = [];
    this.setConnectionStatus('not-connected');
    this.emit({ type: 'connection-change', snapshot: this.getSnapshot() });
    return this.getSnapshot();
  }

  async startRound(round: Partial<Round> = {}) {
    if (this.session.connectionStatus !== 'connected') {
      await this.connect();
    }

    const now = Date.now();
    this.currentRound = {
      id: round.id ?? createId('twitch-round'),
      status: 'collecting',
      startedAt: round.startedAt ?? now,
      endedAt: null,
      targetTime: round.targetTime,
    };
    this.guesses = [];
    this.session = {
      ...this.session,
      activeRoundId: this.currentRound.id,
      updatedAt: now,
    };
    this.emit({ type: 'round-start', round: this.currentRound, snapshot: this.getSnapshot() });
    return this.getSnapshot();
  }

  async endRound(round: Partial<Round> = {}) {
    if (!this.currentRound) return this.getSnapshot();

    this.currentRound = {
      ...this.currentRound,
      status: 'ended',
      targetTime: round.targetTime ?? this.currentRound.targetTime,
      endedAt: Date.now(),
    };
    this.session = {
      ...this.session,
      activeRoundId: null,
      updatedAt: Date.now(),
    };
    this.emit({ type: 'round-end', round: this.currentRound, snapshot: this.getSnapshot() });
    return this.getSnapshot();
  }

  async clearGuesses() {
    this.guesses = [];
    this.emit({ type: 'guesses-cleared', snapshot: this.getSnapshot() });
    return this.getSnapshot();
  }

  getViewers() {
    return Promise.resolve([...this.viewers]);
  }

  getGuesses(roundId?: string) {
    return Promise.resolve(roundId ? this.guesses.filter(guess => guess.roundId === roundId) : [...this.guesses]);
  }

  getSnapshot(): StreamerProviderSnapshot {
    return {
      session: { ...this.session, viewerCount: this.liveViewerCount ?? this.viewers.length },
      viewers: [...this.viewers],
      guesses: [...this.guesses],
      currentRound: this.currentRound ? { ...this.currentRound } : null,
      leaderboard: this.getLeaderboard(),
    };
  }

  subscribe(listener: StreamerProviderListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleSocketMessage(payload: string) {
    payload.split('\r\n').filter(Boolean).forEach(line => {
      if (line.startsWith('PING')) {
        this.socket?.send(line.replace('PING', 'PONG'));
        return;
      }

      if (!line.includes(' PRIVMSG ')) return;
      const tagMatch = line.match(/^@([^ ]+) /);
      const tags = tagMatch ? parseIrcTags(tagMatch[1]) : {};
      const prefixMatch = line.match(/:([^! ]+)!/);
      const messageIndex = line.indexOf(' :', line.indexOf(' PRIVMSG '));
      const message = messageIndex >= 0 ? line.slice(messageIndex + 2) : '';
      this.handleChatMessage({
        userId: tags['user-id'] || prefixMatch?.[1] || createId('viewer'),
        displayName: tags['display-name'] || prefixMatch?.[1] || 'Viewer',
        message,
      });
    });
  }

  private handleChatMessage({ userId, displayName, message }: { userId: string; displayName: string; message: string }) {
    if (!this.currentRound || this.currentRound.status !== 'collecting') return;

    const value = parseGuessValue(message);
    if (value === null) return;
    const broadcaster = this.broadcaster;
    const isBroadcaster = Boolean(
      broadcaster && (
        userId === broadcaster.id
        || displayName.toLowerCase() === broadcaster.displayName.toLowerCase()
        || displayName.toLowerCase() === broadcaster.login.toLowerCase()
      )
    );
    const guessViewerId = isBroadcaster ? 'streamer' : userId;
    const guessViewerName = isBroadcaster ? broadcaster?.displayName ?? displayName : displayName;

    if (!isBroadcaster) {
      const viewer: Viewer = {
        id: userId,
        displayName,
        joinedAt: Date.now(),
      };
      this.upsertViewer(viewer);
    }

    const guess: Guess = {
      id: createId('twitch-guess'),
      viewerId: guessViewerId,
      viewerName: guessViewerName,
      value,
      roundId: this.currentRound.id,
      receivedAt: Date.now(),
      sourceMessage: message,
    };

    this.guesses = [
      guess,
      ...this.guesses.filter(existing => !(existing.roundId === guess.roundId && existing.viewerId === guess.viewerId)),
    ].slice(0, 500);
    this.emit({ type: 'guess', guess, snapshot: this.getSnapshot() });
  }

  private upsertViewer(viewer: Viewer) {
    const existing = this.viewers.find(current => current.id === viewer.id);
    this.viewers = existing
      ? this.viewers.map(current => current.id === viewer.id ? { ...current, displayName: viewer.displayName } : current)
      : [...this.viewers, viewer];
    this.session = { ...this.session, viewerCount: this.viewers.length, updatedAt: Date.now() };
    if (!existing) {
      this.emit({ type: 'viewer-join', viewer, snapshot: this.getSnapshot() });
    }
  }

  private getLeaderboard(): LeaderboardEntry[] {
    return buildLeaderboard(this.guesses, this.currentRound);
  }

  private setConnectionStatus(connectionStatus: StreamerSession['connectionStatus']) {
    this.session = {
      ...this.session,
      connectionStatus,
      viewerCount: this.liveViewerCount ?? this.viewers.length,
      updatedAt: Date.now(),
    };
    this.emit({ type: 'connection-change', snapshot: this.getSnapshot() });
  }

  private async refreshLiveViewerCount() {
    const auth = this.auth;
    if (!auth?.clientId) return;
    const viewerCount = await fetchTwitchViewerCount(auth.accessToken, auth.clientId, auth.login);
    if (viewerCount === null) return;
    this.liveViewerCount = viewerCount;
    this.session = { ...this.session, viewerCount, updatedAt: Date.now() };
    this.emit({ type: 'connection-change', snapshot: this.getSnapshot() });
  }

  private startViewerCountPolling() {
    this.stopViewerCountPolling();
    this.viewerCountTimer = window.setInterval(() => {
      void this.refreshLiveViewerCount();
    }, 60000);
  }

  private stopViewerCountPolling() {
    if (this.viewerCountTimer === null) return;
    window.clearInterval(this.viewerCountTimer);
    this.viewerCountTimer = null;
  }

  private emit(event: StreamerProviderEvent) {
    this.listeners.forEach(listener => listener(event));
  }
}

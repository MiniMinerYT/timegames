import { useCallback, useEffect, useMemo, useState } from 'react';
import { createGuessProvider } from '../services/guessProviderRegistry';
import type { StreamerProviderId, StreamerProviderSnapshot } from '../types/streamer';

export function useStreamerSession(providerId: StreamerProviderId = 'twitch') {
  const provider = useMemo(() => createGuessProvider(providerId), [providerId]);
  const [snapshot, setSnapshot] = useState<StreamerProviderSnapshot>(() => provider.getSnapshot());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(provider.getSnapshot());
    const unsubscribe = provider.subscribe(event => {
      setSnapshot(event.snapshot);
    });
    return () => {
      unsubscribe();
    };
  }, [provider]);

  const runProviderAction = useCallback(async (action: () => Promise<StreamerProviderSnapshot>) => {
    setError(null);
    try {
      const next = await action();
      setSnapshot(next);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Streamer provider action failed.');
      return false;
    }
  }, []);

  const connect = useCallback(
    () => runProviderAction(() => provider.connect()),
    [provider, runProviderAction]
  );

  const disconnect = useCallback(
    () => runProviderAction(() => provider.disconnect()),
    [provider, runProviderAction]
  );

  const startRound = useCallback(
    (round?: Parameters<typeof provider.startRound>[0]) => runProviderAction(() => provider.startRound(round)),
    [provider, runProviderAction]
  );

  const endRound = useCallback(
    (round?: Parameters<typeof provider.endRound>[0]) => runProviderAction(() => provider.endRound(round)),
    [provider, runProviderAction]
  );

  const clearGuesses = useCallback(
    () => runProviderAction(() => provider.clearGuesses()),
    [provider, runProviderAction]
  );

  return {
    provider,
    snapshot,
    error,
    connect,
    disconnect,
    startRound,
    endRound,
    clearGuesses,
  };
}

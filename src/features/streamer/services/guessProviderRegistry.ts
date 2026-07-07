import { TwitchGuessProvider } from '../providers/TwitchGuessProvider';
import type { GuessProvider, StreamerProviderId } from '../types/streamer';

const providerInstances = new Map<StreamerProviderId, GuessProvider>();

export function createGuessProvider(providerId: StreamerProviderId = 'twitch'): GuessProvider {
  const existing = providerInstances.get(providerId);
  if (existing) return existing;

  let provider: GuessProvider;
  switch (providerId) {
    case 'twitch':
      provider = new TwitchGuessProvider();
      break;
    default:
      provider = new TwitchGuessProvider();
      break;
  }
  providerInstances.set(providerId, provider);
  return provider;
}

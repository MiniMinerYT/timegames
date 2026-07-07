import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Radio, XCircle } from 'lucide-react';
import { completeTwitchCallback } from '../services/twitchAuthService';
import type { TwitchUserProfile } from '../types/twitchAuth';

type CallbackState =
  | { status: 'loading'; profile: null; error: null }
  | { status: 'success'; profile: TwitchUserProfile; error: null }
  | { status: 'error'; profile: null; error: string };

export function TwitchCallbackScreen() {
  const [state, setState] = useState<CallbackState>({
    status: 'loading',
    profile: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    void completeTwitchCallback(new URL(window.location.href))
      .then(auth => {
        if (cancelled) return;
        window.history.replaceState({}, document.title, '/twitch/callback');
        setState({ status: 'success', profile: auth.profile, error: null });
      })
      .catch(error => {
        if (cancelled) return;
        setState({
          status: 'error',
          profile: null,
          error: error instanceof Error ? error.message : 'Could not complete Twitch login.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="twitch-callback-screen">
      <section className="twitch-callback-card">
        <span className="streamer-setup-icon">
          {state.status === 'loading' && <Loader2 className="w-9 h-9 animate-spin" />}
          {state.status === 'success' && <CheckCircle2 className="w-9 h-9" />}
          {state.status === 'error' && <XCircle className="w-9 h-9" />}
        </span>
        <p className="streamer-eyebrow">Twitch Login</p>
        {state.status === 'loading' && (
          <>
            <h1>Connecting Twitch</h1>
            <p>Finishing the secure PKCE login flow.</p>
          </>
        )}
        {state.status === 'success' && (
          <>
            <h1>Connected</h1>
            <div className="twitch-connected-profile">
              <img src={state.profile.profileImageUrl} alt="" />
              <span>
                <strong>{state.profile.displayName}</strong>
                <em>@{state.profile.login}</em>
              </span>
            </div>
            <a href="/">Return to TimeGames</a>
          </>
        )}
        {state.status === 'error' && (
          <>
            <h1>Could not connect</h1>
            <p>{state.error}</p>
            <a href="/">Return to TimeGames</a>
          </>
        )}
        <Radio className="twitch-callback-watermark" aria-hidden="true" />
      </section>
    </main>
  );
}

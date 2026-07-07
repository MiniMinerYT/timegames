import { useCallback, useEffect, useState } from 'react';
import {
  clearStoredTwitchAuth,
  getTwitchAuthConfigStatus,
  restoreTwitchAuth,
  startTwitchLogin,
} from '../services/twitchAuthService';
import type { TwitchAuthState } from '../types/twitchAuth';

export function useTwitchAuth() {
  const initialConfig = getTwitchAuthConfigStatus();
  const [state, setState] = useState<TwitchAuthState>({
    status: 'idle',
    profile: null,
    error: initialConfig.isConfigured ? null : initialConfig.message,
    isConfigured: initialConfig.isConfigured,
    configMessage: initialConfig.message,
  });

  useEffect(() => {
    let cancelled = false;
    const config = getTwitchAuthConfigStatus();
    if (!config.isConfigured) {
      setState(previous => ({
        ...previous,
        status: 'idle',
        error: config.message,
        isConfigured: false,
        configMessage: config.message,
      }));
      return undefined;
    }

    setState(previous => ({ ...previous, status: 'loading', error: null }));
    void restoreTwitchAuth()
      .then(auth => {
        if (cancelled) return;
        setState({
          status: auth ? 'authenticated' : 'idle',
          profile: auth?.profile ?? null,
          error: null,
          isConfigured: true,
          configMessage: null,
        });
      })
      .catch(error => {
        if (cancelled) return;
        setState({
          status: 'error',
          profile: null,
          error: error instanceof Error ? error.message : 'Could not restore Twitch login.',
          isConfigured: true,
          configMessage: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async () => {
    const config = getTwitchAuthConfigStatus();
    if (!config.isConfigured) {
      setState(previous => ({
        ...previous,
        status: 'error',
        error: config.message,
        isConfigured: false,
        configMessage: config.message,
      }));
      return;
    }

    setState(previous => ({ ...previous, status: 'loading', error: null, configMessage: null }));
    try {
      await startTwitchLogin();
    } catch (error) {
      setState(previous => ({
        ...previous,
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not start Twitch login.',
        configMessage: config.message,
      }));
    }
  }, []);

  const logout = useCallback(() => {
    const config = getTwitchAuthConfigStatus();
    clearStoredTwitchAuth();
    setState({
      status: 'idle',
      profile: null,
      error: config.isConfigured ? null : config.message,
      isConfigured: config.isConfigured,
      configMessage: config.message,
    });
  }, []);

  return {
    ...state,
    login,
    logout,
  };
}

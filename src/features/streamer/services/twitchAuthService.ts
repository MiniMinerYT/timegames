import type { TwitchAuthConfigStatus, TwitchStoredAuth, TwitchUserProfile } from '../types/twitchAuth';

const twitchAuthBaseUrl = 'https://id.twitch.tv/oauth2';
const twitchApiBaseUrl = 'https://api.twitch.tv/helix';
const twitchScope = 'chat:read';
const twitchAuthStorageKey = 'timegames-streamer-twitch-auth';
const twitchPkceStorageKey = 'timegames-streamer-twitch-pkce';
const defaultTwitchClientId = 'foqenqxlakgg9a2uibydiyg8m7i5qf';

interface TwitchLoginState {
  state: string;
  createdAt: number;
}

interface TwitchValidateResponse {
  client_id: string;
  login: string;
  scopes: string[];
  user_id: string;
  expires_in: number;
}

interface TwitchUsersResponse {
  data: Array<{
    id: string;
    login: string;
    display_name: string;
    profile_image_url: string;
  }>;
}

function normaliseEnvValue(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '').trim();
  const lowered = trimmed.toLowerCase();
  if (!trimmed || lowered === 'undefined' || lowered === 'null' || lowered.includes('your_')) {
    return null;
  }
  return trimmed;
}

function getDefaultRedirectUri() {
  if (typeof window === 'undefined') return null;
  return `${window.location.origin}/twitch/callback`;
}

export function getTwitchAuthConfigStatus(): TwitchAuthConfigStatus {
  const clientId = normaliseEnvValue(import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined) ?? defaultTwitchClientId;
  const redirectUri = normaliseEnvValue(import.meta.env.VITE_TWITCH_REDIRECT_URI as string | undefined) ?? getDefaultRedirectUri();

  if (!clientId) {
    return {
      isConfigured: false,
      clientId: null,
      redirectUri,
      message: 'Missing VITE_TWITCH_CLIENT_ID. Add the Twitch app Client ID, then restart Vite.',
    };
  }

  if (!/^[a-z0-9]+$/i.test(clientId)) {
    return {
      isConfigured: false,
      clientId,
      redirectUri,
      message: 'VITE_TWITCH_CLIENT_ID should be the Client ID only, with no quotes, URL, or client secret.',
    };
  }

  if (!redirectUri) {
    return {
      isConfigured: false,
      clientId,
      redirectUri: null,
      message: 'Missing VITE_TWITCH_REDIRECT_URI. It must exactly match the OAuth Redirect URL in Twitch.',
    };
  }

  return {
    isConfigured: true,
    clientId,
    redirectUri,
    message: null,
  };
}

function getClientId() {
  return getTwitchAuthConfigStatus().clientId;
}

function getRedirectUri() {
  return getTwitchAuthConfigStatus().redirectUri;
}

export function isTwitchAuthConfigured() {
  return getTwitchAuthConfigStatus().isConfigured;
}

function base64UrlEncode(bytes: Uint8Array) {
  let value = '';
  bytes.forEach(byte => {
    value += String.fromCharCode(byte);
  });
  return btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function saveLoginState(state: TwitchLoginState) {
  sessionStorage.setItem(twitchPkceStorageKey, JSON.stringify(state));
}

function readLoginState() {
  try {
    const saved = sessionStorage.getItem(twitchPkceStorageKey);
    return saved ? JSON.parse(saved) as TwitchLoginState : null;
  } catch {
    return null;
  }
}

function clearLoginState() {
  sessionStorage.removeItem(twitchPkceStorageKey);
}

export function saveTwitchAuth(auth: TwitchStoredAuth) {
  localStorage.setItem(twitchAuthStorageKey, JSON.stringify(auth));
}

export function readStoredTwitchAuth() {
  try {
    const saved = localStorage.getItem(twitchAuthStorageKey);
    return saved ? JSON.parse(saved) as TwitchStoredAuth : null;
  } catch {
    return null;
  }
}

export function clearStoredTwitchAuth() {
  localStorage.removeItem(twitchAuthStorageKey);
}

export async function startTwitchLogin() {
  const config = getTwitchAuthConfigStatus();
  const { clientId, redirectUri } = config;
  if (!config.isConfigured || !clientId || !redirectUri) {
    throw new Error(config.message ?? 'Twitch auth is not configured.');
  }

  const state = randomToken(24);
  saveLoginState({ state, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: twitchScope,
    state,
  });

  window.location.assign(`${twitchAuthBaseUrl}/authorize?${params.toString()}`);
}

async function fetchTwitchProfile(accessToken: string) {
  const clientId = getClientId();
  if (!clientId) throw new Error('Twitch client id is missing.');

  const response = await fetch(`${twitchApiBaseUrl}/users`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
    },
  });
  if (!response.ok) throw new Error('Could not fetch Twitch profile.');

  const body = await response.json() as TwitchUsersResponse;
  const user = body.data[0];
  if (!user) throw new Error('Twitch profile was empty.');

  return {
    id: user.id,
    login: user.login,
    displayName: user.display_name,
    profileImageUrl: user.profile_image_url,
  } satisfies TwitchUserProfile;
}

export async function completeTwitchCallback(url: URL) {
  const fragmentParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = fragmentParams.get('access_token');
  const expiresIn = Number(fragmentParams.get('expires_in') ?? '0');
  const returnedState = fragmentParams.get('state');
  const scope = fragmentParams.get('scope')?.split(' ').filter(Boolean) ?? [twitchScope];
  const error = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  const loginState = readLoginState();

  if (error) throw new Error(error);
  if (!accessToken) throw new Error('Twitch did not return an access token.');
  if (!returnedState || !loginState || loginState.state !== returnedState) {
    throw new Error('Twitch login state did not match. Please try connecting again.');
  }

  clearLoginState();

  const profile = await fetchTwitchProfile(accessToken);
  const auth: TwitchStoredAuth = {
    accessToken,
    expiresAt: Date.now() + Math.max(expiresIn, 0) * 1000,
    scope,
    profile,
  };
  saveTwitchAuth(auth);
  return auth;
}

export async function restoreTwitchAuth() {
  const saved = readStoredTwitchAuth();
  const clientId = getClientId();
  if (!saved || !clientId) return null;
  if (saved.expiresAt <= Date.now()) {
    clearStoredTwitchAuth();
    return null;
  }

  const response = await fetch(`${twitchAuthBaseUrl}/validate`, {
    headers: {
      Authorization: `OAuth ${saved.accessToken}`,
    },
  });
  if (!response.ok) {
    clearStoredTwitchAuth();
    return null;
  }

  const validation = await response.json() as TwitchValidateResponse;
  if (validation.client_id !== clientId || !validation.scopes.includes(twitchScope)) {
    clearStoredTwitchAuth();
    return null;
  }

  const profile = await fetchTwitchProfile(saved.accessToken);
  const restored: TwitchStoredAuth = {
    ...saved,
    expiresAt: Date.now() + validation.expires_in * 1000,
    scope: validation.scopes,
    profile,
  };
  saveTwitchAuth(restored);
  return restored;
}

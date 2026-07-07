export type TwitchAuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';

export interface TwitchUserProfile {
  id: string;
  login: string;
  displayName: string;
  profileImageUrl: string;
}

export interface TwitchStoredAuth {
  accessToken: string;
  expiresAt: number;
  scope: string[];
  profile: TwitchUserProfile;
}

export interface TwitchAuthState {
  status: TwitchAuthStatus;
  profile: TwitchUserProfile | null;
  error: string | null;
  isConfigured: boolean;
  configMessage: string | null;
}

export interface TwitchAuthConfigStatus {
  isConfigured: boolean;
  clientId: string | null;
  redirectUri: string | null;
  message: string | null;
}

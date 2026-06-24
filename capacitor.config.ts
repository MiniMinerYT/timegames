import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uk.miniminer.timegames',
  appName: 'TimeGames',
  webDir: 'dist',

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#071329',
    },
  },
};

export default config;
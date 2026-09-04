import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thaidy.forma',
  appName: 'Fitide',
  webDir: 'mobile-web',
  server: {
    url: 'https://forma-pessoal.thaidy-deguchi.chatgpt.site',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'forma-pessoal.thaidy-deguchi.chatgpt.site',
      '*.chatgpt.site',
    ],
  },
};

export default config;

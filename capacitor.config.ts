const config = {
  appId: 'io.opennews.app',
  appName: 'OpenNews',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Enable native HTTP for cross-origin news feeds and BYOK API calls in the Android WebView.
    CapacitorHttp: { enabled: true },
    LocalNotifications: {
      smallIcon: 'ic_stat_opennews',
      iconColor: '#3B82F6',
    },
  },
};

export default config;

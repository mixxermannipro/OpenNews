const config = {
  appId: 'io.opennews.app',
  appName: 'OpenNews',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_opennews',
      iconColor: '#3B82F6',
    },
  },
};

export default config;

try {
  const theme = localStorage.getItem('opennews-theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // The system preference still works when storage is unavailable.
}

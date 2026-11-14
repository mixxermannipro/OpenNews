(function () {
  try {
    var savedTheme = localStorage.getItem('opennews_theme');
    var mode = savedTheme ? JSON.parse(savedTheme) : 'system';
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var resolvedDark = mode === 'system' ? prefersDark : mode === 'dark';
    var root = document.documentElement;
    if (resolvedDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', resolvedDark ? '#111214' : '#f6f5f2');
    }
  } catch (e) {}
})();

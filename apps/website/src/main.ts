import './style.css';

const theme = document.querySelector<HTMLSelectElement>('#theme');
if (theme) {
  theme.value = document.documentElement.dataset.theme ?? 'system';
  theme.closest('label')?.removeAttribute('hidden');
  theme.addEventListener('change', () => {
    if (theme.value === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme.value;
    try {
      if (theme.value === 'system') localStorage.removeItem('opennews-theme');
      else localStorage.setItem('opennews-theme', theme.value);
    } catch {
      // The selected theme still applies for this page.
    }
  });
}

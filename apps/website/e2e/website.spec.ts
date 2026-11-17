import { expect, test } from '@playwright/test';

for (const width of [320, 768, 1440]) {
  test(`Seite und Navigation passen bei ${width} Pixeln`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
    await page.getByRole('link', { name: 'Verfügbarkeit' }).click();
    await expect(page).toHaveURL(/#download$/);
  });
}

test('App-Einblick und FAQ sind ohne JavaScript per Tastatur bedienbar', async ({ browser }) => {
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.goto('http://127.0.0.1:4321/');
  await expect(page.getByRole('heading', { name: 'Was heute wichtig ist.' })).toBeVisible();
  await page.getByRole('radio', { name: 'Heute' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Für dich' })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'Was dich interessiert.' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: 'Was gerade reinkommt.' })).toBeVisible();
  const faq = page.getByText('Benötige ich ein Konto?');
  await faq.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText(/Du kannst OpenNews ohne Anmeldung/)).toBeVisible();
  await page.close();
});

test('Darstellung folgt dem System, speichert die Auswahl und respektiert reduzierte Bewegung', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  const mode = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  expect(await mode()).toBe('light');
  const theme = page.getByLabel('Darstellung');
  await theme.selectOption('dark');
  await page.reload();
  expect(await mode()).toBe('dark');
  await expect(theme).toHaveValue('dark');
  await theme.selectOption('system');
  expect(await mode()).toBe('light');
  await expect(page.locator('.hero-stage .phone')).toHaveCSS('animation-name', 'none');
});

test('Kontakt, Datenschutz und Impressum sind eigene Seiten', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('navigation', { name: 'Weitere Links' });
  await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveCount(0);
  for (const [label, path] of [['Kontakt', 'kontakt'], ['Datenschutz', 'datenschutz'], ['Impressum', 'impressum']]) {
    await footer.getByRole('link', { name: label, exact: true }).click();
    expect(new URL(page.url()).pathname).toBe(`/${path}/`);
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
  }
});

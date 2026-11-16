const env = process.env;

function read(key: string): string {
  return (env[key] ?? '').trim();
}

function httpsUrl(key: string, host?: string): string | null {
  const value = read(key);
  if (!value) return null;

  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || (host && url.hostname !== host)) {
    throw new Error(`${key} braucht eine gültige HTTPS-Adresse`);
  }
  return url.href;
}

const operator = {
  name: read('VITE_OPERATOR_NAME'),
  street: read('VITE_OPERATOR_STREET'),
  postalCode: read('VITE_OPERATOR_POSTAL_CODE'),
  city: read('VITE_OPERATOR_CITY'),
  country: read('VITE_OPERATOR_COUNTRY'),
  email: read('VITE_CONTACT_EMAIL'),
  phone: read('VITE_OPERATOR_PHONE'),
  additionalDetails: read('VITE_IMPRINT_DETAILS'),
};

const publicUrl = httpsUrl('VITE_SITE_URL');
if (publicUrl && publicUrl !== new URL(publicUrl).origin + '/') {
  throw new Error('VITE_SITE_URL braucht die Basisadresse der Website ohne Unterpfad');
}

const privacyNotice = read('VITE_WEBSITE_PRIVACY_NOTICE');
const live = read('VITE_SITE_STATUS') === 'live';
if (live && !(publicUrl && operator.name && operator.street && operator.postalCode &&
  operator.city && operator.country && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operator.email) &&
  privacyNotice && read('VITE_RELEASE_APPROVED') === 'yes')) {
  throw new Error('Für den Live-Build fehlen die öffentliche URL, bestätigte Betreiberangaben, der Datenschutzhinweis oder die Freigabe. Siehe README.');
}

const playStoreUrl = httpsUrl('VITE_PLAY_STORE_URL', 'play.google.com');
if (playStoreUrl) {
  const playStore = new URL(playStoreUrl);
  if (playStore.pathname !== '/store/apps/details' || playStore.searchParams.get('id') !== 'io.opennews.app') {
    throw new Error('VITE_PLAY_STORE_URL muss zur OpenNews-App io.opennews.app führen');
  }
}

export const isPreview = !live;
export const site = {
  name: 'OpenNews',
  url: publicUrl?.slice(0, -1) ?? null,
  playStoreUrl,
  webAppUrl: httpsUrl('VITE_WEB_APP_URL'),
  operator,
  privacyNotice,
  contactEmail: operator.email || 'mixxermannipropvp@gmail.com',
  social: [] as Array<{ label: string; href: string }>,
};

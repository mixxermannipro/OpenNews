const trackingParameters = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|ref|referrer|s_cid)$/i;
const imageSizeParameters = /^(w|h|width|height|dpr|q|quality|crop|resize|fit|auto|format|fm|strip|imwidth|impolicy|fl|scale|zoom|sharpen|blur|bg)$/i;

export function safeHref(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function contentUrlKey(value: string, kind: 'article' | 'image' | 'media'): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return '';
  }
  if (!['http:', 'https:'].includes(url.protocol)) return '';
  for (const key of new Set(url.searchParams.keys())) {
    if (trackingParameters.test(key) || (kind === 'image' && imageSizeParameters.test(key))) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  if (kind === 'article') {
    const host = url.host.replace(/^www\./i, '');
    const path = url.pathname.replace(/\/+$/, '');
    if (!path && !url.search) return '';
    return host + path + url.search;
  }
  return url.host + url.pathname + url.search;
}

export function extractYouTubeId(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return undefined;
  let id: string | null | undefined;
  if (url.hostname === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)\/?$/)?.[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : undefined;
}

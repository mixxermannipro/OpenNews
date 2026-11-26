export const OPENNEWS_USER_AGENT = 'OpenNews/1.0 (+https://opennews-app.pages.dev; RSS Reader)';

/**
 * Default domain opt-out list for publishers who request exclusion from
 * server-side full-text extraction. Additional domains can be supplied via
 * the `OPENNEWS_OPTOUT_DOMAINS` environment variable (comma-separated).
 */
export const DEFAULT_OPTOUT_DOMAINS: ReadonlySet<string> = new Set([
  // Maintained empty by default; publishers can opt out via contact or PR,
  // or operators can configure OPENNEWS_OPTOUT_DOMAINS.
]);

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\.+|\.+$/g, '').replace(/^www\./, '');
}

function parseExtraDomains(extraCsv?: string): Set<string> {
  const result = new Set<string>(DEFAULT_OPTOUT_DOMAINS);
  if (!extraCsv) return result;
  for (const part of extraCsv.split(',')) {
    const clean = normalizeDomain(part);
    if (clean) result.add(clean);
  }
  return result;
}

/**
 * Checks whether a target URL's host (or any parent domain) matches the
 * publisher opt-out blocklist.
 */
export function isPublisherOptedOut(rawUrl: string, extraCsv?: string): boolean {
  let hostname: string;
  try {
    hostname = normalizeDomain(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
  if (!hostname) return false;
  const blocked = parseExtraDomains(extraCsv);
  if (blocked.size === 0) return false;

  const labels = hostname.split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join('.');
    if (blocked.has(candidate)) return true;
  }
  return false;
}

function readHeader(
  headers: Headers | Record<string, string | string[] | undefined> | null | undefined,
  name: string,
): string {
  if (!headers) return '';
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? '';
  }
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) {
      return Array.isArray(v) ? v.join(', ') : (v ?? '');
    }
  }
  return '';
}

const RESTRICTIVE_ROBOTS_DIRECTIVE = /\b(?:noarchive|noai|noimageai)\b/i;

/**
 * Checks HTTP `X-Robots-Tag` headers and HTML `<meta name="robots|...">` tags
 * for `noarchive`, `noai`, or `noimageai` directives.
 */
export function hasRobotsNoArchiveOrNoAi(
  headers: Headers | Record<string, string | string[] | undefined> | null | undefined,
  html: string,
): boolean {
  const headerVal = readHeader(headers, 'x-robots-tag');
  if (headerVal && RESTRICTIVE_ROBOTS_DIRECTIVE.test(headerVal)) {
    return true;
  }
  if (!html) return false;

  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const nameMatch = tag.match(/\bname\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const name = (nameMatch?.[1] ?? nameMatch?.[2] ?? nameMatch?.[3] ?? '').trim().toLowerCase();
    if (!['robots', 'googlebot', 'bingbot', 'gptbot', 'ccbot', 'anthropic-ai'].includes(name)) {
      continue;
    }
    const contentMatch = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const content = contentMatch?.[1] ?? contentMatch?.[2] ?? contentMatch?.[3] ?? '';
    if (RESTRICTIVE_ROBOTS_DIRECTIVE.test(content)) {
      return true;
    }
  }
  return false;
}

/**
 * Detects explicit paywall markup in raw HTML (JSON-LD `isAccessibleForFree: false`,
 * `itemprop="isAccessibleForFree"`, or `article:content_tier` locked/paid metadata)
 * so OpenNews never extracts behind paywalls.
 */
export function hasPaywallMarkup(html: string): boolean {
  if (!html) return false;
  if (/"isAccessibleForFree"\s*:\s*(?:false|"false")/i.test(html)) {
    return true;
  }
  if (/itemprop\s*=\s*["']isAccessibleForFree["'][^>]*content\s*=\s*["']false["']/i.test(html)) {
    return true;
  }
  if (/content\s*=\s*["']false["'][^>]*itemprop\s*=\s*["']isAccessibleForFree["']/i.test(html)) {
    return true;
  }
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const keyMatch = tag.match(/\b(?:name|property)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const key = (keyMatch?.[1] ?? keyMatch?.[2] ?? keyMatch?.[3] ?? '').trim().toLowerCase();
    if (key === 'article:content_tier' || key === 'piano:tier') {
      const contentMatch = tag.match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const val = (contentMatch?.[1] ?? contentMatch?.[2] ?? contentMatch?.[3] ?? '').trim().toLowerCase();
      if (val === 'locked' || val === 'paid' || val === 'subscriber' || val === 'subscriber-only') {
        return true;
      }
    }
  }
  if (/data-paywall-state\s*=\s*["'](?:locked|closed|active)["']/i.test(html)) {
    return true;
  }
  return false;
}

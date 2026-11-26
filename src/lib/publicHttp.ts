import { lookup } from 'node:dns';
import { Agent, fetch } from 'undici';

import { isPublicAddress, isSafeHttpUrl } from './publicHttpUrl.ts';

export { isPublicAddress, isSafeHttpUrl } from './publicHttpUrl.ts';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-goog-api-key',
  'xi-api-key',
  'cookie',
]);

const dispatcher = new Agent({
  headersTimeout: 10_000,
  bodyTimeout: 15_000,
  connectTimeout: 6_000,
  connect: {
    lookup(hostname, options, callback) {
      lookup(hostname, { all: true, family: options.family }, (error, addresses) => {
        if (error) return callback(error, '', 0);
        if (!addresses.length || !addresses.every(({ address }) => isPublicAddress(address))) {
          return callback(new Error('Hostname resolves to a non-public address'), '', 0);
        }
        if (options.all) return callback(null, addresses);
        callback(null, addresses[0].address, addresses[0].family);
      });
    },
  },
});

function sanitizeRedirectHeaders(
  headers: NonNullable<Parameters<typeof fetch>[1]>['headers'],
  fromUrl: string,
  toUrl: string,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  const from = new URL(fromUrl);
  const to = new URL(toUrl);
  const sameOrigin = from.origin === to.origin;
  const normalized = new Headers(headers as HeadersInit);
  if (!sameOrigin) {
    for (const key of SENSITIVE_HEADERS) {
      normalized.delete(key);
    }
  }
  return Object.fromEntries(normalized.entries());
}

export async function fetchPublic(rawUrl: string, options: NonNullable<Parameters<typeof fetch>[1]> = {}) {
  let url = rawUrl;
  let currentHeaders = options.headers;
  const signal = options.signal ?? AbortSignal.timeout(10_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!isSafeHttpUrl(url)) throw new Error('Invalid public URL');
    const response = await fetch(url, { ...options, headers: currentHeaders, dispatcher, redirect: 'manual', signal });
    const location = response.headers.get('location');
    if (options.method === 'POST' || !location || ![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    await response.body?.cancel();
    const nextUrl = new URL(location, url).href;
    currentHeaders = sanitizeRedirectHeaders(currentHeaders, url, nextUrl);
    url = nextUrl;
  }
  throw new Error('Too many redirects');
}

function detectCharset(bytes: Uint8Array, contentType?: string | null): string {
  const headerMatch = contentType?.match(/charset\s*=\s*["']?([^"'\s;]+)/i);
  if (headerMatch?.[1]) {
    return headerMatch[1].trim().toLowerCase();
  }
  // Sniff XML prolog or HTML <meta charset> from first 1024 ASCII bytes
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  const xmlMatch = head.match(/<\?xml[^>]+encoding\s*=\s*["']([^"']+)["']/i);
  if (xmlMatch?.[1]) return xmlMatch[1].trim().toLowerCase();
  const metaCharset = head.match(/<meta[^>]+charset\s*=\s*["']?([^"'\s/>;]+)/i);
  if (metaCharset?.[1]) return metaCharset[1].trim().toLowerCase();
  return 'utf-8';
}

export function decodeBytesWithCharset(bytes: Uint8Array, contentType?: string | null): string {
  const charset = detectCharset(bytes, contentType);
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch {
      // Fallback to UTF-8 if charset label is unsupported.
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export async function readPublicText(
  response: Awaited<ReturnType<typeof fetchPublic>>,
  maxBytes = 4 * 1024 * 1024,
  options: { truncateOnLimit?: boolean } = {},
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (bytes + value.byteLength > maxBytes) {
        if (options.truncateOnLimit) {
          const remaining = maxBytes - bytes;
          if (remaining > 0) {
            chunks.push(value.subarray(0, remaining));
            bytes += remaining;
          }
          break;
        }
        throw new Error('Response exceeds size limit');
      }
      bytes += value.byteLength;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return decodeBytesWithCharset(combined, response.headers.get('content-type'));
}

import { lookup } from 'node:dns';
import { Agent, fetch } from 'undici';

import { isPublicAddress, isSafeHttpUrl } from './publicHttpUrl.ts';

export { isPublicAddress, isSafeHttpUrl } from './publicHttpUrl.ts';

const dispatcher = new Agent({
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

export async function fetchPublic(rawUrl: string, options: NonNullable<Parameters<typeof fetch>[1]> = {}) {
  let url = rawUrl;
  const signal = options.signal ?? AbortSignal.timeout(10_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!isSafeHttpUrl(url)) throw new Error('Invalid public URL');
    const response = await fetch(url, { ...options, dispatcher, redirect: 'manual', signal });
    const location = response.headers.get('location');
    if (options.method === 'POST' || !location || ![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }
    await response.body?.cancel();
    url = new URL(location, url).href;
  }
  throw new Error('Too many redirects');
}

export async function readPublicText(response: Awaited<ReturnType<typeof fetchPublic>>, maxBytes = 4 * 1024 * 1024): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Response exceeds size limit');
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

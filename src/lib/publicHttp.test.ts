import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBytesWithCharset, isPublicAddress, isSafeHttpUrl } from './publicHttp.ts';

test('permits public addresses and excludes non-public address ranges', () => {
  for (const address of ['1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPublicAddress(address), true, address);
  }
  for (const address of ['10.0.0.1', '172.16.0.1', '100.64.0.1', '192.0.2.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test('allows public HTTP URLs and rejects credentials, internal domains, blocked ports and unsupported protocols', () => {
  assert.equal(isSafeHttpUrl('https://example.com/rss'), true);
  assert.equal(isSafeHttpUrl('ftp://example.com/rss'), false);
  assert.equal(isSafeHttpUrl('https://user:password@example.com/rss'), false);
  assert.equal(isSafeHttpUrl('https://localhost/rss'), false);
  assert.equal(isSafeHttpUrl('https://service.internal/rss'), false);
  assert.equal(isSafeHttpUrl('http://example.com:6379/'), false);
});

test('decodes ISO-8859-1 payloads via Content-Type header or XML encoding without mojibake', () => {
  // "Hi-Fi-Verstärker kostet vorübergehend" encoded as ISO-8859-1 (ä=0xe4, ü=0xfc)
  const latin1Bytes = Uint8Array.from([
    ...Buffer.from('Hi-Fi-Verst', 'ascii'),
    0xe4,
    ...Buffer.from('rker kostet vor', 'ascii'),
    0xfc,
    ...Buffer.from('bergehend', 'ascii'),
  ]);
  assert.equal(
    decodeBytesWithCharset(latin1Bytes, 'application/rss+xml; charset=ISO-8859-1'),
    'Hi-Fi-Verstärker kostet vorübergehend',
  );

  const xmlLatin1 = Uint8Array.from([
    ...Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><title>Stra', 'ascii'),
    0xdf,
    ...Buffer.from('e</title>', 'ascii'),
  ]);
  assert.equal(decodeBytesWithCharset(xmlLatin1, 'application/xml'), '<?xml version="1.0" encoding="ISO-8859-1"?><title>Straße</title>');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicAddress, isSafeHttpUrl } from './publicHttp.ts';

test('permits public addresses and excludes non-public address ranges', () => {
  for (const address of ['1.1.1.1', '2606:4700:4700::1111']) {
    assert.equal(isPublicAddress(address), true, address);
  }
  for (const address of ['10.0.0.1', '172.16.0.1', '100.64.0.1', '192.0.2.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test('allows public HTTP URLs and rejects credentials and unsupported protocols', () => {
  assert.equal(isSafeHttpUrl('https://example.com/rss'), true);
  assert.equal(isSafeHttpUrl('ftp://example.com/rss'), false);
  assert.equal(isSafeHttpUrl('https://user:password@example.com/rss'), false);
  assert.equal(isSafeHttpUrl('https://localhost/rss'), false);
});

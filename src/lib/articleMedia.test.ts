import assert from 'node:assert/strict';
import test from 'node:test';
import type { MediaAttachment } from '../types/news';
import { getArticleMedia, getReaderAttachments } from './articleMedia';

test('shows BILD size and portrait variants of the lead image only once', () => {
  const base = 'https://images.bild.de/6af74e727f8bbad09ea62b09/';
  const hero = base + '5e3d15a00bec8a0fe439156dab64f8f9,2b06c6ca?w=1280';
  const other: MediaAttachment = { type: 'image', url: 'https://images.bild.de/7af74e727f8bbad09ea62b09/fdd9ae08f7d7b309192965a01c5a3199,2b06c6ca?w=1280' };
  const audio: MediaAttachment = { type: 'audio', url: 'https://example.org/report.mp3' };

  assert.deepEqual(getReaderAttachments([
    { type: 'image', url: hero },
    { type: 'image', url: base + '5e3d15a00bec8a0fe439156dab64f8f9,2b06c6ca?w=120' },
    { type: 'image', url: base + '5e3d15a00bec8a0fe439156dab64f8f9-portrait,2b06c6ca?w=1280' },
    { type: 'image', url: base + '0805b48d1450f492385a040310f1b849,2b06c6ca?w=1280' },
    other,
    audio,
  ], hero), [other, audio]);
});

test('preserves image URLs distinguished by query parameters on other hosts', () => {
  const hero = 'https://example.org/image?id=1';
  const other: MediaAttachment = { type: 'image', url: 'https://example.org/image?id=2' };
  assert.deepEqual(getReaderAttachments([other], hero), [other]);
});

test('uses one playable WELT rendition per video and prefers MP4', () => {
  const base = 'https://welt.cdn.content-discovery.video/videos/';
  const stream: MediaAttachment = { type: 'video', url: base + 'clip1/rendition/a/master.m3u8' };
  const file: MediaAttachment = { type: 'video', url: base + 'clip1/rendition/b/file-v720p.mp4' };
  const second: MediaAttachment = { type: 'video', url: base + 'clip2/rendition/c/master.m3u8' };

  assert.deepEqual(getArticleMedia({ media: [stream, file, second] }), [file, second]);
  assert.deepEqual(getReaderAttachments([stream, file, second]), [file, second]);
});

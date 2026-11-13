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

test('deduplicates tracking links, image sizes and YouTube URL forms', () => {
  const image: MediaAttachment = { type: 'image', url: 'https://cdn.example.org/photo.jpg?w=200&utm_source=feed#preview' };
  const first: MediaAttachment = { type: 'youtube', url: 'https://youtu.be/abcdefghijk' };
  const second: MediaAttachment = { type: 'youtube', url: 'https://www.youtube-nocookie.com/embed/abcdefghijk', portrait: true };
  const video: MediaAttachment = { type: 'video', url: 'https://cdn.example.org/film.mp4' };
  assert.deepEqual(getReaderAttachments([image, first, second, video, {
    ...video, url: video.url + '?utm_medium=rss#t=2',
  }], 'https://cdn.example.org/photo.jpg?w=1280'), [second, video]);
});

test('keeps one version of a Tagesschau clip offered in multiple resolutions', () => {
  const stem = 'https://tagesschau-progressive.ard-mcdn.de/video/2026/1112/TV-20261112-2304-2500';
  const clip: MediaAttachment = { type: 'video', url: stem + '.webxl.h264.mp4' };
  const small: MediaAttachment = { type: 'video', url: stem + '.webs.h264.mp4' };
  assert.deepEqual(getArticleMedia({ media: [clip, small] }), [clip]);
});

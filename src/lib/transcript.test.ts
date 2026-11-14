import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTranscript, transcriptFormat, transcriptLimit } from './transcript';

test('transcripts keep spoken text and drop WebVTT metadata and cue timings', () => {
  const vtt = 'WEBVTT\n\nNOTE annotation\n\n00:00:00.000 --> 00:00:01.000\n<v Reader>Guten Tag!</v>\n\n00:00:01.000 --> 00:00:02.000\nGuten Tag!\n';
  assert.equal(parseTranscript(vtt, 'text/vtt'), 'Guten Tag!');
  assert.equal(parseTranscript('x'.repeat(transcriptLimit + 1), 'text/plain').length, transcriptLimit);
  assert.equal(transcriptFormat('', 'https://example.org/episode.vtt?lang=de'), 'text/vtt');
  assert.equal(transcriptFormat('text/html', 'https://example.org/episode'), undefined);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SOURCES } from './catalog.ts';
import {
  buildRadioAudioTrack,
  filterRadioStations,
  NEWS_UPDATE_AUDIO_SOURCE_IDS,
  RADIO_STATIONS,
} from './radioCatalog.ts';

test('radio catalog contains unique verified HTTPS stations', () => {
  assert.ok(RADIO_STATIONS.length >= 20);
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  for (const station of RADIO_STATIONS) {
    assert.ok(!seenIds.has(station.id), `Duplicate radio id: ${station.id}`);
    assert.ok(!seenUrls.has(station.streamUrl), `Duplicate stream URL: ${station.streamUrl}`);
    seenIds.add(station.id);
    seenUrls.add(station.streamUrl);

    assert.ok(station.streamUrl.startsWith('https://'), `Stream must be HTTPS: ${station.id}`);
    assert.ok(station.homepageUrl.startsWith('https://'), `Homepage must be HTTPS: ${station.id}`);
    assert.ok(station.name.trim().length > 0);
    assert.ok(station.subtitle.trim().length > 0);
    assert.ok(station.keywords.length >= 2);
  }
});

test('all news update audio source IDs exist in DEFAULT_SOURCES with HTTPS feeds', () => {
  const byId = new Map(DEFAULT_SOURCES.map((source) => [source.id, source]));
  for (const id of NEWS_UPDATE_AUDIO_SOURCE_IDS) {
    const source = byId.get(id);
    assert.ok(source, `Missing catalog source for audio update id: ${id}`);
    assert.equal(source.format, 'podcast');
    assert.ok(source.url.startsWith('https://'));
  }
});

test('filterRadioStations prioritizes favorites, matches umlauts/aliases, and filters groups', () => {
  const favoritesFirst = filterRadioStations(RADIO_STATIONS, {
    language: 'de',
    favoriteIds: ['bbc-world-service'],
  });
  assert.equal(favoritesFirst[0]?.id, 'bbc-world-service');

  const umlautMatch = filterRadioStations(RADIO_STATIONS, { query: 'oe1' });
  assert.ok(umlautMatch.some((station) => station.id === 'orf-oe1'));

  const dlfMatch = filterRadioStations(RADIO_STATIONS, { query: 'dlf' });
  assert.ok(dlfMatch.some((station) => station.id === 'dlf'));

  const dachOnly = filterRadioStations(RADIO_STATIONS, { group: 'dach' });
  assert.ok(dachOnly.length >= 10);
  assert.ok(dachOnly.every((station) => ['DE', 'AT', 'CH'].includes(station.region)));

  const intlOnly = filterRadioStations(RADIO_STATIONS, { group: 'international' });
  assert.ok(intlOnly.length >= 8);
  assert.ok(intlOnly.every((station) => !['DE', 'AT', 'CH'].includes(station.region)));

  const favOnly = filterRadioStations(RADIO_STATIONS, {
    group: 'favorites',
    favoriteIds: ['dlf', 'srf4-news'],
  });
  assert.deepEqual(favOnly.map((s) => s.id), ['dlf', 'srf4-news']);
});

test('buildRadioAudioTrack constructs a live track without podcast duration', () => {
  const station = RADIO_STATIONS[0];
  const track = buildRadioAudioTrack(station);
  assert.equal(track.isLive, true);
  assert.equal(track.media.type, 'audio');
  assert.equal(track.media.url, station.streamUrl);
  assert.equal(track.radioStation?.id, station.id);
  assert.equal(track.article.title, station.name);
});

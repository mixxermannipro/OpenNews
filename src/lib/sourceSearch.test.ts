import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SOURCES, STARTER_PACKS, pushSources } from './catalog';
import { searchAndFilterSources } from './sourceSearch';

test('all default catalog sources start unselected (subscribed: false) with unique IDs', () => {
  assert.ok(DEFAULT_SOURCES.length >= 160, `Expected 160+ international sources, got ${DEFAULT_SOURCES.length}`);
  assert.equal(DEFAULT_SOURCES.some(source => source.subscribed), false);
  const seen = new Set<string>();
  for (const source of DEFAULT_SOURCES) {
    assert.ok(!seen.has(source.id), `Duplicate catalog source ID: ${source.id}`);
    seen.add(source.id);
  }
  assert.ok(pushSources.length >= 10, 'Push sources remain configured explicitly');
});

test('starter packs reference only existing catalog source IDs', () => {
  const validIds = new Set(DEFAULT_SOURCES.map(source => source.id));
  for (const pack of STARTER_PACKS) {
    assert.ok(pack.sourceIds.length >= 4, `Pack ${pack.id} has too few sources`);
    for (const id of pack.sourceIds) {
      assert.ok(validIds.has(id), `Starter pack ${pack.id} references unknown source ${id}`);
    }
  }
});

test('source search handles umlauts, accents, domains, countries, and multilingual categories', () => {
  const sz = searchAndFilterSources(DEFAULT_SOURCES, { query: 'sueddeutsche' });
  assert.equal(sz[0]?.id, 'sueddeutsche');

  const elPais = searchAndFilterSources(DEFAULT_SOURCES, { query: 'pais' });
  assert.equal(elPais[0]?.id, 'elpais');

  const lesEchos = searchAndFilterSources(DEFAULT_SOURCES, { query: 'echos' });
  assert.equal(lesEchos[0]?.id, 'lesechos');

  const publico = searchAndFilterSources(DEFAULT_SOURCES, { query: 'publico' });
  assert.equal(publico[0]?.id, 'publico');

  const byCountry = searchAndFilterSources(DEFAULT_SOURCES, { query: 'schweiz' });
  assert.ok(byCountry.some(source => source.id === 'srf'));
  assert.ok(byCountry.some(source => source.id === 'nzz'));

  const byBrazil = searchAndFilterSources(DEFAULT_SOURCES, { query: 'brasil' });
  assert.ok(byBrazil.some(source => source.id === 'folha'));
  assert.ok(byBrazil.some(source => source.id === 'g1'));

  const byDomain = searchAndFilterSources(DEFAULT_SOURCES, { query: 'lemonde.fr' });
  assert.equal(byDomain[0]?.id, 'lemonde');
});

test('source filters narrow accurately by language, category, type, and subscription state', () => {
  const french = searchAndFilterSources(DEFAULT_SOURCES, { language: 'fr' });
  assert.ok(french.length >= 10);
  assert.ok(french.every(source => source.language === 'fr'));

  const englishTech = searchAndFilterSources(DEFAULT_SOURCES, { language: 'en', category: 'Technologie' });
  assert.ok(englishTech.length >= 5);
  assert.ok(englishTech.every(source => source.language === 'en' && source.category === 'Technologie'));

  const withTwoSelected = DEFAULT_SOURCES.map(source =>
    source.id === 'bbc' || source.id === 'lemonde' ? { ...source, subscribed: true } : source,
  );
  const onlyActive = searchAndFilterSources(withTwoSelected, { onlySubscribed: true });
  assert.deepEqual(onlyActive.map(s => s.id).sort(), ['bbc', 'lemonde']);
});

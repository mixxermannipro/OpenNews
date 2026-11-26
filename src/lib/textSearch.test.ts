import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { foldSearchText } from './textSearch.ts';

describe('foldSearchText', () => {
  it('folds German umlauts and eszett consistently', () => {
    assert.equal(foldSearchText('Bäckerstraße Österreich Übermorgen'), 'baeckerstrasse oesterreich uebermorgen');
    assert.equal(foldSearchText('Ärger Ökonomie Übung'), 'aerger oekonomie uebung');
  });

  it('strips combining diacritics from accented Latin characters', () => {
    assert.equal(foldSearchText('Café résumé mañana façade'), 'cafe resume manana facade');
  });

  it('handles empty strings', () => {
    assert.equal(foldSearchText(''), '');
  });
});

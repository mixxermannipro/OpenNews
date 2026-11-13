import assert from 'node:assert/strict';
import test from 'node:test';
import { trackNavigationScroll } from './scrollNavigation';

test('hides after sustained downward scrolling and shows on a small upward scroll', () => {
  const track = trackNavigationScroll(0);
  assert.equal(track(12, 500), false);
  assert.equal(track(30, 500), false);
  assert.equal(track(40, 500), true);
  assert.equal(track(37, 500), true);
  assert.equal(track(25, 500), false);
});

test('ignores jitter and resets at the top', () => {
  const track = trackNavigationScroll(0);
  for (const top of [20, 18, 35, 33, 49]) {
    assert.equal(track(top, 500), false);
  }
  assert.equal(track(71, 500), true);
  assert.equal(track(0, 500), false);
});

test('ignores overscroll at both ends and starts visible on an already scrolled page', () => {
  const track = trackNavigationScroll(250);
  assert.equal(track(250, 500), false);
  assert.equal(track(500, 500), true);
  assert.equal(track(530, 500), true);
  assert.equal(track(500, 500), true);
  assert.equal(track(484, 500), false);
  assert.equal(track(-40, 500), false);
  assert.equal(track(0, 500), false);
});

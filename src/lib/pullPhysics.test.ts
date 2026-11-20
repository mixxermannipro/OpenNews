import test from 'node:test';
import assert from 'node:assert/strict';
import { computePullState, computeReadingProgress, PULL_REFRESH_THRESHOLD } from './pullPhysics';

test('computePullState damps pull distance smoothly and triggers ready at threshold', () => {
  const zero = computePullState(0);
  assert.equal(zero.indicatorOffset, 0);
  assert.equal(zero.contentShift, 0);
  assert.equal(zero.progress, 0);
  assert.equal(zero.ready, false);

  const mid = computePullState(PULL_REFRESH_THRESHOLD / 2);
  assert.equal(mid.ready, false);
  assert.ok(mid.progress > 0.45 && mid.progress < 0.55);
  assert.ok(mid.indicatorOffset > 0 && mid.indicatorOffset < 40);
  assert.ok(mid.contentShift > 0 && mid.contentShift < mid.indicatorOffset);

  const ready = computePullState(PULL_REFRESH_THRESHOLD);
  assert.equal(ready.ready, true);
  assert.equal(ready.progress, 1);

  const far = computePullState(600);
  assert.equal(far.ready, true);
  assert.equal(far.progress, 1);
  assert.ok(far.indicatorOffset < 68);
  assert.ok(far.contentShift < 44);
});

test('computePullState handles negative and non-finite input safely', () => {
  assert.equal(computePullState(-50).distance, 0);
  assert.equal(computePullState(Number.NaN).distance, 0);
});

test('computeReadingProgress clamps smoothly between 0 and 1', () => {
  assert.equal(computeReadingProgress(0, 1000, 500), 0);
  assert.equal(computeReadingProgress(250, 1000, 500), 0.5);
  assert.equal(computeReadingProgress(500, 1000, 500), 1);
  assert.equal(computeReadingProgress(900, 1000, 500), 1);
  assert.equal(computeReadingProgress(-20, 1000, 500), 0);
  assert.equal(computeReadingProgress(100, 400, 500), 0);
});

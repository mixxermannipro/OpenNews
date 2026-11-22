import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSwipeMove, shouldCommitSwipe, swipeThreshold } from './swipePhysics';

test('evaluateSwipeMove locks vertical scrolling and ignores minor jitter', () => {
  const jitter = evaluateSwipeMove(6, 5, 360, 'none');
  assert.equal(jitter.axis, 'none');
  assert.equal(jitter.offsetX, 0);

  const vertical = evaluateSwipeMove(10, 22, 360, 'none');
  assert.equal(vertical.axis, 'vertical');
  assert.equal(vertical.offsetX, 0);
});

test('evaluateSwipeMove locks horizontal swipe left and right cleanly', () => {
  const left = evaluateSwipeMove(-48, 8, 360, 'none');
  assert.equal(left.axis, 'horizontal');
  assert.equal(left.direction, -1);
  assert.equal(left.offsetX, -48);
  assert.equal(left.pastThreshold, false);

  const rightPast = evaluateSwipeMove(140, 10, 360, 'horizontal');
  assert.equal(rightPast.axis, 'horizontal');
  assert.equal(rightPast.direction, 1);
  assert.equal(rightPast.pastThreshold, true);
  assert.ok(rightPast.offsetX < 140, 'applies rubber-band damping beyond threshold');
});

test('shouldCommitSwipe triggers on distance threshold or brisk flick', () => {
  const threshold = swipeThreshold(360);
  assert.equal(shouldCommitSwipe(threshold, 400, 360), true);
  assert.equal(shouldCommitSwipe(-threshold - 5, 500, 360), true);
  assert.equal(shouldCommitSwipe(40, 400, 360), false);
  // Brisk flick (>= 52px at >= 0.55 px/ms)
  assert.equal(shouldCommitSwipe(-65, 90, 360), true);
  assert.equal(shouldCommitSwipe(-65, 350, 360), false);
});

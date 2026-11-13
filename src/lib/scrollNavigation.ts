const HIDE_DISTANCE = 36;
const SHOW_DISTANCE = 12;

export function trackNavigationScroll(initialTop: number) {
  let previousTop = initialTop;
  let distance = 0;
  let hidden = false;

  return (scrollTop: number, maxScrollTop: number) => {
    const top = Math.max(0, Math.min(scrollTop, maxScrollTop));
    const delta = top - previousTop;
    previousTop = top;

    if (top === 0) {
      distance = 0;
      hidden = false;
    } else if (delta !== 0) {
      distance = Math.sign(delta) === Math.sign(distance) ? distance + delta : delta;
      if (distance >= HIDE_DISTANCE) hidden = true;
      if (distance <= -SHOW_DISTANCE) hidden = false;
    }

    return hidden;
  };
}

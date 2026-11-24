/** Screen-space label placement. No Three.js, no DOM. */

export function measureLabel(text) {
  let w = 18;
  const value = String(text || "");
  for (const ch of value) {
    w += ch.codePointAt(0) > 0xff ? 12.5 : 7;
  }
  return { w: Math.min(300, Math.ceil(w)), h: 26 };
}

function overlaps(a, b, pad) {
  return !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
}

function inside(box, bounds) {
  return box.x >= bounds.left
    && box.y >= bounds.top
    && box.x + box.w <= bounds.right
    && box.y + box.h <= bounds.bottom;
}

function clamp(box, bounds) {
  const next = { ...box };
  if (next.w > bounds.right - bounds.left) next.w = bounds.right - bounds.left;
  if (next.h > bounds.bottom - bounds.top) next.h = bounds.bottom - bounds.top;
  next.x = Math.max(bounds.left, Math.min(next.x, bounds.right - next.w));
  next.y = Math.max(bounds.top, Math.min(next.y, bounds.bottom - next.h));
  return next;
}

/**
 * Greedy priority placement.
 * items: { id, priority, x, y, w, h, text, red }
 * x/y is the roof anchor. The pill sits above it.
 * Priority 1 stays visible and is clamped into bounds.
 * Lower priorities are dropped when they overlap a kept pill, an obstacle, or the bounds.
 */
export function layoutLabelBoxes(items, bounds, obstacles) {
  const sorted = [...items].sort((a, b) => a.priority - b.priority || a.y - b.y || String(a.id).localeCompare(String(b.id)));
  const placed = [];
  const visible = [];
  const blocks = obstacles || [];
  for (const item of sorted) {
    let box = {
      id: item.id,
      priority: item.priority,
      text: item.text,
      red: !!item.red,
      x: item.x - item.w / 2,
      y: item.y - item.h - 8,
      w: item.w,
      h: item.h,
    };
    const forced = item.priority <= 1;
    if (!inside(box, bounds)) {
      if (!forced) continue;
      box = clamp(box, bounds);
    }
    const hit = placed.some((other) => overlaps(box, other, 4));
    const blocked = blocks.some((other) => other && other.w > 1 && other.h > 1 && overlaps(box, other, 2));
    if ((hit || blocked) && !forced) continue;
    placed.push(box);
    visible.push(box);
  }
  return visible;
}

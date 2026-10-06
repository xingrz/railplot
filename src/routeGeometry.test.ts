import { describe, expect, it } from 'vitest';
import { laneColors, routeSegment } from './routeGeometry';

describe('支线画法', () => {
  const main = { id: 'main', name: '主站', position: 0, lane: 0 };
  const branch = { id: 'branch', name: '支站', position: 20, lane: 1 };

  it('分岔在起站转出，汇合在终站转入，均保留支线颜色', () => {
    const split = routeSegment(main, branch, 100, 200);
    const merge = routeSegment(branch, main, 100, 200);
    expect(split.path).toBe('M44,100L78,126V200');
    expect(merge.path).toBe('M78,100V174L44,200');
    expect(split.color).toBe(laneColors[1]);
    expect(merge.color).toBe(laneColors[1]);
  });

  it('密集站位的转折保持在两站之间，不产生向上回折', () => {
    expect(routeSegment(main, branch, 100, 104).path).toBe(
      'M44,100L78,102V104',
    );
    expect(routeSegment(branch, main, 100, 104).path).toBe(
      'M78,100V102L44,104',
    );
  });
});

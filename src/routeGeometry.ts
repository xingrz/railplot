import type { Station } from './model';

export const laneColors = ['#337563', '#bd925c', '#6b8cae', '#a286ad'];
export const laneX = (lane: number) => 44 + lane * 34;

/** 分岔靠近起站转出，汇合靠近终站转入；中间保持支线平行。 */
export function routeSegment(
  from: Station,
  to: Station,
  fromY: number,
  toY: number,
) {
  const x1 = laneX(from.lane);
  const x2 = laneX(to.lane);
  return {
    path: railPath(x1, fromY, x2, toY),
    color: laneColors[Math.max(from.lane, to.lane)],
  };
}

export function railPath(
  x1: number,
  fromY: number,
  x2: number,
  toY: number,
  bendLimit = 26,
): string {
  if (fromY > toY) return railPath(x2, toY, x1, fromY, bendLimit);
  const bend = Math.min(bendLimit, Math.abs(toY - fromY) / 2);
  if (x1 === x2) return `M${x1},${fromY}V${toY}`;
  return x1 < x2
    ? `M${x1},${fromY}L${x2},${fromY + bend}V${toY}`
    : `M${x1},${fromY}V${toY - bend}L${x2},${toY}`;
}

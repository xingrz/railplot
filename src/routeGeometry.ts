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
  const bend = Math.min(26, (toY - fromY) / 2);
  let path: string;

  if (x1 === x2) {
    path = `M${x1},${fromY}V${toY}`;
  } else if (x1 < x2) {
    path = `M${x1},${fromY}L${x2},${fromY + bend}V${toY}`;
  } else {
    path = `M${x1},${fromY}V${toY - bend}L${x2},${toY}`;
  }

  return { path, color: laneColors[Math.max(from.lane, to.lane)] };
}

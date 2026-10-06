/** 编辑画布的坐标约定；工程中的站位保持原单位，不因显示网格而改写。 */
export const laneWidth = 180;
export const positionScale = 5;
export const gridStep = 5;
export const nodeWidth = 150;
export const nodeHeight = 28;
export const nodeCenter = 14;
export const snapGrid: [number, number] = [laneWidth, gridStep * positionScale];
export const nodeExtent: [[number, number], [number, number]] = [
  [0, 0],
  [3 * laneWidth + nodeWidth, 10000 * positionScale + nodeHeight],
];

export interface GridDrag {
  lane: number;
  position: number;
  fromPosition: number;
  blocked: boolean;
}

export function snapNetworkPoint(point: { x: number; y: number }) {
  return {
    lane: Math.max(0, Math.min(3, Math.round(point.x / laneWidth))),
    position: Math.max(
      0,
      Math.min(10000, Math.round(point.y / snapGrid[1]) * gridStep),
    ),
  };
}

import { describe, expect, it } from 'vitest';
import { snapNetworkPoint } from './networkGrid';

describe('编辑网格坐标', () => {
  it('超过格子和线路列中点才吸附到下一个落点', () => {
    expect(snapNetworkPoint({ x: 89, y: 212 })).toEqual({
      lane: 0,
      position: 40,
    });
    expect(snapNetworkPoint({ x: 91, y: 213 })).toEqual({
      lane: 1,
      position: 45,
    });
  });

  it('画布放站和拖动提交都限制在可用列与站位范围内', () => {
    expect(snapNetworkPoint({ x: -200, y: -90 })).toEqual({
      lane: 0,
      position: 0,
    });
    expect(snapNetworkPoint({ x: 999, y: 99999 })).toEqual({
      lane: 3,
      position: 10000,
    });
  });
});

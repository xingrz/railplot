import { describe, expect, it } from 'vitest';
import { demo } from './demo';
import {
  geometry,
  minutes,
  parseProject,
  shiftTrain,
  timeString,
  validate,
} from './model';
describe('工程文件与运行时刻', () => {
  it('演示工程可无损往返且包含支线', () => {
    const p = demo();
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    expect(p.stations.some((s) => s.lane === 1)).toBe(true);
  });

  it('支持跨日时间，不把午夜错误自动纠正', () => {
    expect(minutes('25:03')).toBe(1503);
    expect(timeString(1503)).toBe('25:03');
    expect(minutes('00:60')).toBeNaN();
    expect(minutes('72:00')).toBeNaN();
    const p = demo();
    p.trains[0].stops[1].arrival = '00:01';
    expect(validate(p).join()).toContain('递增');
  });

  it('停车线保持同一纵坐标，折返改变方向', () => {
    const p = demo();
    const g = geometry(p);
    const points = g.points(p.trains[0]);
    expect(points[0].y).toBe(points[1].y);
    expect(points[1].x).toBeGreaterThan(points[0].x);
    expect(points.some((v, i) => i > 0 && v.y < points[i - 1].y)).toBe(true);
  });

  it('整趟平移保持运行与停站时长，不修改原对象', () => {
    const t = demo().trains[0];
    const shifted = shiftTrain(t, 7);
    shifted.stops.forEach((s, i) => {
      expect(minutes(s.arrival) - minutes(t.stops[i].arrival)).toBe(7);
      expect(minutes(s.departure) - minutes(s.arrival)).toBe(
        minutes(t.stops[i].departure) - minutes(t.stops[i].arrival),
      );
    });
    expect(() => shiftTrain(t, -10)).toThrow();
  });

  it('无效导入被拒绝', () => {
    for (const v of [
      null,
      {},
      [],
      { format: 'railplot', version: 99 },
      'not json',
    ])
      expect(() => parseProject(JSON.stringify(v))).toThrow();
    const p = demo();
    p.trains[0].stops[0].station = 'missing';
    expect(() => parseProject(JSON.stringify(p))).toThrow(/站点/);
  });

  it('拒绝重复站位和无效颜色', () => {
    const p = demo();
    p.stations[1].position = 0;
    expect(validate(p).join()).toContain('站位不可重复');
    p.trains[0].color = 'url(https://example.com)';
    expect(validate(p).length).toBeGreaterThan(0);
  });

  it('时间视窗裁切不改变原始时刻', () => {
    const p = demo();
    p.time.start = '00:08';
    const g = geometry(p);
    expect(g.points(p.trains[0])[0].x).toBeLessThan(g.left);
    expect(p.trains[0].stops[0].arrival).toBe('00:05');
  });

  it('起终点与所有中间站的图表坐标对齐', () => {
    const p = demo();
    const g = geometry(p);
    expect(g.y('north')).toBe(g.top);
    expect(g.y('west')).toBe(g.bottom);
    for (const t of p.trains)
      for (const point of g.points(t)) expect(point.y).toBe(g.y(point.station));
  });
});

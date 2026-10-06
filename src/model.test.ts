import { describe, expect, it } from 'vitest';
import { demo } from './demo';
import {
  geometry,
  minutes,
  moveTimePoint,
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

describe('时间轴缩放与时间点编辑', () => {
  it('横向放大不改变站位、图高与底部留白', () => {
    const project = demo();
    const normal = geometry(project, 1300, 100);
    const zoomed = geometry(project, 1300, 200);

    expect(zoomed.minuteWidth).toBe(normal.minuteWidth * 2);
    expect(zoomed.height).toBe(normal.height);
    expect(zoomed.bottom).toBe(normal.bottom);
    for (const station of project.stations) {
      expect(zoomed.y(station.id)).toBe(normal.y(station.id));
    }
    expect(normal.height - 23 - (normal.bottom + 44)).toBeGreaterThanOrEqual(
      32,
    );
  });

  it('24 小时图保留分钟格下限，标签不相互挤压', () => {
    const project = demo();
    project.time.end = '24:00';
    project.time.grid = 1;
    const layout = geometry(project, 1300, 100);

    expect(layout.minuteWidth).toBeGreaterThanOrEqual(12);
    expect(layout.width).toBeGreaterThan(17000);
    expect(layout.x('00:01') - layout.x('00:00')).toBeGreaterThanOrEqual(12);
    expect(layout.labelEvery * layout.minuteWidth).toBeGreaterThanOrEqual(64);
  });
});

describe('拖动时刻约束', () => {
  it('出发点按分钟吸附且保留到达时间', () => {
    const original = demo().trains[0];
    const result = moveTimePoint(original, 0, 'departure', 7.6);

    expect(result.stops[0].arrival).toBe('00:05');
    expect(result.stops[0].departure).toBe('00:08');
    expect(original.stops[0].departure).toBe('00:06');
  });

  it('通过点同步移动到发，不越过前后站时刻', () => {
    const original = demo().trains[0];
    const result = moveTimePoint(original, 1, 'pass', 12);

    expect(result.stops[1]).toMatchObject({
      arrival: '00:12',
      departure: '00:12',
    });
    expect(moveTimePoint(original, 1, 'pass', 0).stops[1].arrival).toBe(
      '00:07',
    );
    expect(moveTimePoint(original, 1, 'pass', 30).stops[1].departure).toBe(
      '00:13',
    );
  });

  it('到达不能晚于发车，出发不能越过下一站到达', () => {
    const original = demo().trains[0];

    expect(moveTimePoint(original, 0, 'arrival', 20).stops[0].arrival).toBe(
      '00:06',
    );
    expect(moveTimePoint(original, 0, 'departure', 20).stops[0].departure).toBe(
      '00:09',
    );
    expect(moveTimePoint(original, 0, 'arrival', -10).stops[0].arrival).toBe(
      '00:00',
    );
  });
});

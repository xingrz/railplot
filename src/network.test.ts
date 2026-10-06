import { describe, expect, it } from 'vitest';
import { demo } from './demo';
import { clone, parseProject, validate } from './model';
import { planRoute } from './network';
import { laneColors, routeSegment } from './routeGeometry';

function blankTrains() {
  const project = demo();
  project.trains = [];
  return project;
}

describe('批量建线', () => {
  it('预览无副作用，换行和箭头都可建线，并保留工程其他数据', () => {
    const source = blankTrains();
    const before = clone(source);
    const plan = planRoute(source, ' 北站\r\n中站 → 南站 ', 0, true);
    expect(source).toEqual(before);
    expect(plan.route.map((station) => station.name)).toEqual([
      '北站',
      '中站',
      '南站',
    ]);
    expect(plan.project.stations).toHaveLength(3);
    expect(plan.addedLinkCount).toBe(2);
    expect(plan.project.time).toEqual(source.time);
    expect(parseProject(JSON.stringify(plan.project))).toEqual(plan.project);
  });

  it('重复提交已有站序不会复制车站或连接', () => {
    const source = demo();
    const plan = planRoute(source, '广州北 → 长岗 → 大田', 2);
    expect(plan.addedStationIds).toHaveLength(0);
    expect(plan.addedLinkCount).toBe(0);
    expect(plan.project).toEqual(source);
  });

  it('支持向下分岔和从上方汇合，已有接轨站保持原列', () => {
    const source = demo();
    const split = planRoute(source, '大田 → 支线甲 → 支线乙', 1);
    const merge = planRoute(source, '支线甲 → 支线乙 → 白云', 1);
    expect(split.route.map((station) => station.lane)).toEqual([0, 1, 1]);
    expect(merge.route.map((station) => station.lane)).toEqual([1, 1, 0]);
    for (const plan of [split, merge]) {
      expect(validate(plan.project)).toEqual([]);
      expect(plan.route[0].position).toBeLessThan(plan.route[1].position);
      expect(plan.route[1].position).toBeLessThan(plan.route[2].position);
      expect(plan.project.trains).toEqual(source.trains);
    }
  });

  it('两端接轨可形成平行支线，自动避开其他线路占用的站位', () => {
    const source = demo();
    const plan = planRoute(source, '大田 → 新站 → 白云', 1);
    const inserted = plan.route[1];
    expect(inserted.position).toBeGreaterThan(30);
    expect(inserted.position).toBeLessThan(50);
    expect(inserted.position).not.toBe(40);
    expect(
      plan.project.stations.filter(
        (station) => !plan.addedStationIds.includes(station.id),
      ),
    ).toEqual(source.stations);
    expect(validate(plan.project)).toEqual([]);
  });

  it('从最上方站点向上接入时平移站位，保持所有已有站间距', () => {
    const source = demo();
    const plan = planRoute(source, '上方支站 → 广州北', 1);
    expect(plan.shiftedPositions).toBe(true);
    expect(
      Math.min(...plan.project.stations.map((station) => station.position)),
    ).toBe(0);
    const offsets = source.stations.map(
      (station) =>
        plan.project.stations.find((item) => item.id === station.id)!.position -
        station.position,
    );
    expect(new Set(offsets).size).toBe(1);
    expect(validate(plan.project)).toEqual([]);
  });

  it('拒绝同名歧义、倒序接轨点和重复站点，不改动源工程', () => {
    const source = demo();
    const before = clone(source);
    expect(() => planRoute(source, '白云 → 新站 → 大田', 1)).toThrow(
      '从上到下',
    );
    expect(() => planRoute(source, '白云 → 白云', 1)).toThrow('重复');
    expect(source).toEqual(before);
    source.stations[0].name = '白云';
    expect(() => planRoute(source, '白云 → 新站', 1)).toThrow('多个已有车站');
  });

  it('保护正在使用的线路，检查站数和位置上限', () => {
    expect(() => planRoute(demo(), '甲 → 乙', 0, true)).toThrow('仍有列车');
    expect(() => planRoute(blankTrains(), '甲', 0)).toThrow('至少');
    expect(() => planRoute(blankTrains(), '甲 → 乙', 4)).toThrow('0–3');
    expect(() =>
      planRoute(
        blankTrains(),
        Array.from({ length: 61 }, (_, index) => `站 ${index}`).join('\n'),
        0,
        true,
      ),
    ).toThrow('60');
    const source = demo();
    source.stations.at(-1)!.position = 10000;
    expect(() => planRoute(source, '广州西 → 新站', 0)).toThrow('0–10000');
  });
});

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

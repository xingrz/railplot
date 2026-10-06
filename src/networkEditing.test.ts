import { describe, expect, it } from 'vitest';
import { demo } from './demo';
import { clone, validate } from './model';
import {
  addNeighbor,
  addStationAt,
  connectStations,
  insertStation,
  moveStation,
  removeLink,
  removeStation,
  renameStation,
} from './networkEditing';

describe('图形化线路编辑', () => {
  it('画布放站保持现有连接，拒绝重叠站位', () => {
    const source = demo();
    const { project, stationId } = addStationAt(source, 2, 55);
    expect(
      project.stations.find((station) => station.id === stationId),
    ).toMatchObject({ lane: 2, position: 55 });
    expect(project.links).toEqual(source.links);
    expect(() => addStationAt(source, 2, 50)).toThrow('已有车站');
    expect(source.stations).toHaveLength(6);
  });

  it('连线与鼠标先后方向无关，拒绝重复和自身连接', () => {
    const project = connectStations(demo(), 'baiyun', 'jianggao');
    expect(project.links).toContainEqual({ from: 'jianggao', to: 'baiyun' });
    expect(() => connectStations(project, 'baiyun', 'jianggao')).toThrow(
      '已经相连',
    );
    expect(() => connectStations(project, 'baiyun', 'baiyun')).toThrow(
      '另一座',
    );
    expect(demo().links).toHaveLength(5);
  });

  it('移动车站保留 ID 和列车时刻，越过其他站后连接按上下重新存储', () => {
    const source = demo();
    const moved = moveStation(source, 'jianggao', 2, 20);
    expect(
      moved.stations.find((station) => station.id === 'jianggao'),
    ).toMatchObject({ lane: 2, position: 20 });
    expect(moved.links).toContainEqual({ from: 'jianggao', to: 'datian' });
    expect(moved.trains).toEqual(source.trains);
    expect(validate(moved)).toEqual([]);
    expect(
      source.stations.find((station) => station.id === 'jianggao')!.position,
    ).toBe(40);
  });

  it('无效移动不修改原工程', () => {
    const source = demo();
    const before = clone(source);
    expect(() => moveStation(source, 'jianggao', 1, 30)).toThrow('已有车站');
    expect(() => moveStation(source, 'jianggao', 4, 45)).toThrow('0–3');
    expect(source).toEqual(before);
  });

  it('新增上下支线按 ID 接轨，不受重复站名影响', () => {
    const source = demo();
    source.stations[1].name = source.stations[0].name;
    const { project, stationId } = addNeighbor(source, 'north', 'up', true);
    expect(project.links).toContainEqual({ from: stationId, to: 'north' });
    const station = project.stations.find(
      (station) => station.id === stationId,
    )!;
    expect(station.lane).toBe(1);
    expect(station.position).toBeLessThan(
      project.stations.find((station) => station.id === 'north')!.position,
    );
    expect(project.trains).toEqual(source.trains);
    expect(validate(project)).toEqual([]);
  });

  it('插站只拆分选中的连接，列车不自动增加停站', () => {
    const source = demo();
    const link = { from: 'datian', to: 'baiyun' };
    const { project, stationId } = insertStation(source, link);
    expect(project.links).not.toContainEqual(link);
    expect(project.links).toContainEqual({ from: 'datian', to: stationId });
    expect(project.links).toContainEqual({ from: stationId, to: 'baiyun' });
    expect(project.links).toHaveLength(source.links.length + 1);
    expect(project.trains).toEqual(source.trains);
    expect(validate(project)).toEqual([]);
  });

  it('保护列车使用的车站，删除空站时清除相关连接', () => {
    expect(() => removeStation(demo(), 'north')).toThrow('仍有列车');
    const added = addNeighbor(demo(), 'baiyun', 'down', true);
    const removed = removeStation(added.project, added.stationId);
    expect(removed.stations).toEqual(demo().stations);
    expect(removed.links).toEqual(demo().links);
  });

  it('删除连接不删除站点，改名不改变列车的站点引用', () => {
    const source = demo();
    const unlinked = removeLink(source, source.links[0]);
    expect(unlinked.stations).toEqual(source.stations);
    expect(unlinked.links).toHaveLength(4);
    const renamed = renameStation(source, 'north', '新北站');
    expect(renamed.trains).toEqual(source.trains);
    expect(() => renameStation(source, 'north', '')).toThrow();
  });
});

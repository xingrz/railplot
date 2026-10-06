import { clone, validate } from './model';
import type { Link, Project, Station } from './model';

function checked(project: Project): Project {
  const errors = validate(project);
  if (errors.length) throw new Error(errors.join('\n'));
  return project;
}

function stationById(project: Project, id: string): Station {
  const station = project.stations.find((item) => item.id === id);
  if (!station) throw new Error('车站已不存在，请重新选择。');
  return station;
}

function orderedLink(project: Project, first: string, second: string): Link {
  if (first === second) throw new Error('请选择另一座车站。');
  const a = stationById(project, first);
  const b = stationById(project, second);
  return a.position < b.position
    ? { from: first, to: second }
    : { from: second, to: first };
}

export function connectStations(
  source: Project,
  first: string,
  second: string,
): Project {
  const project = clone(source);
  const link = orderedLink(project, first, second);
  if (
    project.links.some((item) => item.from === link.from && item.to === link.to)
  )
    throw new Error('这两座车站已经相连。');
  project.links.push(link);
  return checked(project);
}

export function moveStation(
  source: Project,
  id: string,
  lane: number,
  position: number,
): Project {
  const project = clone(source);
  if (
    project.stations.some(
      (station) => station.id !== id && station.position === position,
    )
  )
    throw new Error('这个站位已有车站，请稍微向上或向下移动。');
  Object.assign(stationById(project, id), { lane, position });
  // 连接是无向的物理线路，文件中始终按图上从上到下存储。
  project.links = project.links.map((link) =>
    orderedLink(project, link.from, link.to),
  );
  return checked(project);
}

export function renameStation(
  source: Project,
  id: string,
  name: string,
): Project {
  const project = clone(source);
  stationById(project, id).name = name;
  return checked(project);
}

export function removeStation(source: Project, id: string): Project {
  if (
    source.trains.some((train) =>
      train.stops.some((stop) => stop.station === id),
    )
  )
    throw new Error('这座车站仍有列车到发，请先修改相关列车。');
  if (source.stations.length <= 2) throw new Error('至少保留两个车站。');
  const project = clone(source);
  project.stations = project.stations.filter((station) => station.id !== id);
  project.links = project.links.filter(
    (link) => link.from !== id && link.to !== id,
  );
  return checked(project);
}

export function removeLink(source: Project, link: Link): Project {
  const project = clone(source);
  project.links = project.links.filter(
    (item) => item.from !== link.from || item.to !== link.to,
  );
  return checked(project);
}

function freePosition(
  project: Project,
  preferred: number,
  upper: number,
): number {
  let position = preferred;
  while (project.stations.some((station) => station.position === position)) {
    const next = (position + upper) / 2;
    if (next === position) throw new Error('站间距过小，请先移动车站。');
    position = next;
  }
  return position;
}

function newStation(project: Project, lane: number, position: number): Station {
  let number = 1;
  while (
    project.stations.some((station) => station.name === `新车站 ${number}`)
  )
    number++;
  const station = {
    id: crypto.randomUUID(),
    name: `新车站 ${number}`,
    lane,
    position,
  };
  project.stations.push(station);
  return station;
}

export function addNeighbor(
  source: Project,
  anchorId: string,
  direction: 'up' | 'down',
  branch: boolean,
): { project: Project; stationId: string } {
  const project = clone(source);
  const anchor = stationById(project, anchorId);
  const lane = anchor.lane + (branch ? 1 : 0);
  if (lane > 3) throw new Error('最多支持三列支线，请将接轨站移到左侧线路列。');
  const preferred = anchor.position + (direction === 'up' ? -15 : 15);
  const neighbors = project.stations.filter((station) =>
    direction === 'up'
      ? station.position < anchor.position
      : station.position > anchor.position,
  );
  const nearest =
    direction === 'up'
      ? Math.max(preferred, ...neighbors.map((station) => station.position))
      : Math.min(preferred, ...neighbors.map((station) => station.position));
  const position =
    nearest === preferred &&
    !project.stations.some((station) => station.position === preferred)
      ? preferred
      : (nearest + anchor.position) / 2;
  const added = newStation(project, lane, position);
  const offset = Math.max(0, -position);
  if (offset)
    project.stations.forEach((station) => {
      station.position += offset;
    });
  project.links.push(orderedLink(project, anchor.id, added.id));
  return { project: checked(project), stationId: added.id };
}

export function insertStation(
  source: Project,
  link: Link,
): { project: Project; stationId: string } {
  if (
    !source.links.some((item) => item.from === link.from && item.to === link.to)
  )
    throw new Error('连接已不存在，请重新选择。');
  const project = removeLink(source, link);
  const from = stationById(project, link.from);
  const to = stationById(project, link.to);
  const position = freePosition(
    project,
    (from.position + to.position) / 2,
    to.position,
  );
  const added = newStation(project, Math.max(from.lane, to.lane), position);
  project.links.push(
    { from: from.id, to: added.id },
    { from: added.id, to: to.id },
  );
  return { project: checked(project), stationId: added.id };
}

export function addStationAt(
  source: Project,
  lane: number,
  position: number,
): { project: Project; stationId: string } {
  const project = clone(source);
  if (project.stations.some((station) => station.position === position))
    throw new Error('这个站位已有车站，请在稍上或稍下的位置添加。');
  const station = newStation(project, lane, position);
  return { project: checked(project), stationId: station.id };
}

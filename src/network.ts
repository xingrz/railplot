import { clone, validate } from './model';
import type { Project, Station } from './model';

export interface RoutePlan {
  project: Project;
  route: Station[];
  addedStationIds: string[];
  addedLinkCount: number;
  shiftedPositions: boolean;
}

/** 输入按图上从上到下的顺序排列；已有站名作为固定接轨点。 */
export function planRoute(
  source: Project,
  input: string,
  lane: number,
  replaceNetwork = false,
): RoutePlan {
  const names = input
    .split(/\r?\n|→|->|>/)
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length < 2)
    throw new Error('至少输入两个站名，一行一个或用 → 分隔。');
  if (names.length > 60) throw new Error('一条线路最多包含 60 座车站。');
  if (names.some((name) => name.length > 100))
    throw new Error('站名最多 100 个字符。');
  if (new Set(names).size !== names.length)
    throw new Error(
      '同一线路不能重复列出一座车站；列车折返请在列车时刻中设置。',
    );
  if (!Number.isInteger(lane) || lane < 0 || lane > 3)
    throw new Error('线路列须为 0–3。');
  if (replaceNetwork && source.trains.length)
    throw new Error('工程仍有列车，不能替换线路。请先新建工程或使用追加方式。');

  const project = clone(source);
  if (replaceNetwork) {
    project.stations = [];
    project.links = [];
  }

  const addedStationIds = new Set<string>();
  const route = names.map((name): Station => {
    const matches = project.stations.filter((station) => station.name === name);
    if (matches.length > 1)
      throw new Error(`“${name}”对应多个已有车站，请先为它们设置不同名称。`);
    if (matches.length === 1) return matches[0];

    const station = { id: crypto.randomUUID(), name, position: NaN, lane };
    addedStationIds.add(station.id);
    project.stations.push(station);
    return station;
  });

  const anchors = route.filter((station) => !addedStationIds.has(station.id));
  for (let index = 1; index < anchors.length; index++) {
    if (anchors[index].position <= anchors[index - 1].position) {
      throw new Error(
        `请按图上从上到下排列：“${anchors[index].name}”应在“${anchors[index - 1].name}”之前。`,
      );
    }
  }

  // 在固定接轨点之间插入新站，保留已有站间距和线路列。
  // 起端没有接轨点时向上延伸，末端没有接轨点时向下延伸。
  const occupied = new Set(
    project.stations.map((station) => station.position).filter(Number.isFinite),
  );
  let start = 0;
  while (start < route.length) {
    if (!addedStationIds.has(route[start].id)) {
      start++;
      continue;
    }

    let end = start;
    while (end < route.length && addedStationIds.has(route[end].id)) end++;
    const count = end - start;
    const before = route[start - 1];
    const after = route[end];
    const lower =
      before?.position ??
      (after ? after.position - 15 * (count + 1) : Math.max(-15, ...occupied));
    const step = after ? (after.position - lower) / (count + 1) : 15;

    for (let index = 0; index < count; index++) {
      const target = lower + step * (index + 1);
      let position = target;
      // 其他线路可能占用同一站位；只在本次分配的小区间内避让。
      while (occupied.has(position)) {
        const next = (position + target + step / 2) / 2;
        if (next === position)
          throw new Error('接轨点之间没有足够的站位空间，请先调整站位。');
        position = next;
      }
      route[start + index].position = position;
      occupied.add(position);
    }
    start = end;
  }

  // 工程格式不使用负站位。整体平移不改变任何已有站间距。
  const offset = Math.max(
    0,
    -Math.min(...project.stations.map((station) => station.position)),
  );
  if (offset)
    project.stations.forEach((station) => {
      station.position += offset;
    });

  let addedLinkCount = 0;
  for (let index = 1; index < route.length; index++) {
    const from = route[index - 1].id;
    const to = route[index].id;
    if (!project.links.some((link) => link.from === from && link.to === to)) {
      project.links.push({ from, to });
      addedLinkCount++;
    }
  }

  const errors = validate(project);
  if (errors.length) throw new Error(errors.join('\n'));

  return {
    project,
    route,
    addedStationIds: [...addedStationIds],
    addedLinkCount,
    shiftedPositions: offset > 0,
  };
}

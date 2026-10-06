export interface Station {
  id: string;
  name: string;
  position: number;
  lane: number;
}

export interface Link {
  from: string;
  to: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface Stop {
  station: string;
  arrival: string;
  departure: string;
}

export interface Train {
  id: string;
  name: string;
  group?: string;
  color?: string;
  stops: Stop[];
}

export interface Project {
  format: 'railplot';
  version: 1;
  name: string;
  time: { start: string; end: string; grid: number };
  stations: Station[];
  links: Link[];
  groups: Group[];
  trains: Train[];
}

export function minutes(value: string): number {
  if (!/^\d{2}:[0-5]\d$/.test(value)) return NaN;
  const [h, m] = value.split(':').map(Number);
  return h <= 71 ? h * 60 + m : NaN;
}

export function timeString(value: number): string {
  return `${Math.floor(value / 60)
    .toString()
    .padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 100;

const color = (v: unknown) =>
  typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

export function validate(value: unknown): string[] {
  const errors: string[] = [];
  if (!record(value) || value.format !== 'railplot' || value.version !== 1)
    return ['仅支持 version: 1 的 Railplot 工程文件。'];
  if (!text(value.name)) errors.push('工程名称不能为空，最多 100 个字符。');
  const t = value.time;
  if (
    !record(t) ||
    typeof t.start !== 'string' ||
    typeof t.end !== 'string' ||
    !Number.isFinite(minutes(t.start)) ||
    !Number.isFinite(minutes(t.end)) ||
    minutes(t.end) <= minutes(t.start) ||
    minutes(t.end) - minutes(t.start) > 1440 ||
    !Number.isInteger(t.grid) ||
    Number(t.grid) < 1 ||
    Number(t.grid) > 60
  )
    errors.push(
      '时间范围须递增且不超过 24 小时，主网格为 1–60 分钟；跨日使用 24:00、25:00。',
    );
  if (
    !Array.isArray(value.stations) ||
    value.stations.length < 2 ||
    value.stations.length > 60 ||
    !value.stations.every(
      (s) =>
        record(s) &&
        text(s.id) &&
        text(s.name) &&
        typeof s.position === 'number' &&
        Number.isFinite(s.position) &&
        s.position >= 0 &&
        s.position <= 10000 &&
        typeof s.lane === 'number' &&
        Number.isInteger(s.lane) &&
        s.lane >= 0 &&
        s.lane <= 3,
    )
  )
    return [
      ...errors,
      '至少需要 2 个车站（最多 60 个），站位为 0–10000，支线列为 0–3。',
    ];
  const stations = value.stations as Station[];
  const ids = new Set(stations.map((s) => s.id));
  if (ids.size !== stations.length) errors.push('车站 ID 不可重复。');
  if (new Set(stations.map((s) => s.position)).size !== stations.length)
    errors.push('站位不可重复，以保持线路图与运行图逐站对齐。');
  if (
    !Array.isArray(value.links) ||
    value.links.length > 120 ||
    !value.links.every(
      (l) =>
        record(l) &&
        typeof l.from === 'string' &&
        typeof l.to === 'string' &&
        ids.has(l.from) &&
        ids.has(l.to) &&
        stations.find((s) => s.id === l.from)!.position <
          stations.find((s) => s.id === l.to)!.position,
    )
  )
    errors.push('线路连接须引用已有车站，并由上方车站连接到下方车站。');
  if (
    !Array.isArray(value.groups) ||
    value.groups.length > 20 ||
    !value.groups.every(
      (c) => record(c) && text(c.id) && text(c.name) && color(c.color),
    )
  )
    return [...errors, '最多支持 20 个列车分组，颜色须为 #RRGGBB。'];
  const groups = value.groups as Group[];
  const groupIds = new Set(groups.map((c) => c.id));
  if (groupIds.size !== groups.length) errors.push('分组 ID 不可重复。');
  if (!Array.isArray(value.trains) || value.trains.length > 300)
    return [...errors, '列车列表格式错误或超过 300 趟。'];
  const trainIds = new Set<string>();
  for (const train of value.trains) {
    if (
      !record(train) ||
      !text(train.id) ||
      !text(train.name) ||
      (train.group !== undefined &&
        train.group !== '' &&
        (typeof train.group !== 'string' || !groupIds.has(train.group))) ||
      (train.color !== undefined && !color(train.color)) ||
      !Array.isArray(train.stops) ||
      train.stops.length < 2 ||
      train.stops.length > 200
    ) {
      errors.push('每趟列车须有车次、可选分组和 2–200 个到发站点。');
      continue;
    }
    if (trainIds.has(train.id)) errors.push(`列车 ID 重复：${train.id}`);
    trainIds.add(train.id);
    let previous = -1;
    let previousStation = '';
    for (const stop of train.stops) {
      if (
        !record(stop) ||
        typeof stop.station !== 'string' ||
        !ids.has(stop.station) ||
        typeof stop.arrival !== 'string' ||
        typeof stop.departure !== 'string'
      ) {
        errors.push(`${train.name}：站点或到发时间字段缺失。`);
        continue;
      }
      const a = minutes(stop.arrival);
      const d = minutes(stop.departure);
      if (!Number.isFinite(a) || !Number.isFinite(d))
        errors.push(`${train.name}：时间格式为 HH:mm（00:00–71:59）。`);
      else if (
        d < a ||
        a < previous ||
        (a === previous && stop.station !== previousStation)
      )
        errors.push(`${train.name}：到发时刻须按行程递增，发车不能早于到达。`);
      previous = d;
      previousStation = stop.station;
    }
  }
  return [...new Set(errors)];
}

export function parseProject(source: string): Project {
  if (source.length > 5_000_000) throw new Error('工程文件不能超过 5 MB。');
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('文件不是有效的 JSON，请检查括号、逗号和引号。');
  }
  const errors = validate(value);
  if (errors.length) throw new Error(errors.join('\n'));
  return value as Project;
}

export function trainColor(project: Project, train: Train): string {
  return (
    train.color ??
    project.groups.find((c) => c.id === train.group)?.color ??
    '#527eb5'
  );
}

export interface TrainShift {
  trainId: string;
  delta: number;
}

export function trainShiftBounds(train: Train) {
  return {
    min: -minutes(train.stops[0].arrival),
    max: 4319 - minutes(train.stops.at(-1)!.departure),
  };
}

export function shiftTrain(train: Train, delta: number): Train {
  if (!Number.isInteger(delta)) throw new Error('平移分钟数必须是整数。');

  const result = clone(train);
  for (const s of result.stops) {
    const a = minutes(s.arrival) + delta;
    const d = minutes(s.departure) + delta;
    if (!Number.isFinite(a) || !Number.isFinite(d) || a < 0 || d > 4319)
      throw new Error('平移后的时间超出 00:00–71:59。');
    s.arrival = timeString(a);
    s.departure = timeString(d);
  }
  return result;
}

export type TimePointKind = 'arrival' | 'departure' | 'pass';

export interface TimePointEdit {
  trainId: string;
  stopIndex: number;
  kind: TimePointKind;
  minute: number;
}

export function timePointBounds(
  train: Train,
  stopIndex: number,
  kind: TimePointKind,
) {
  const stop = train.stops[stopIndex];
  const previous = train.stops[stopIndex - 1];
  const next = train.stops[stopIndex + 1];
  const earliest = previous
    ? minutes(previous.departure) + (previous.station === stop.station ? 0 : 1)
    : 0;
  const latest = next
    ? minutes(next.arrival) - (next.station === stop.station ? 0 : 1)
    : 4319;

  return {
    min: kind === 'departure' ? minutes(stop.arrival) : earliest,
    max: kind === 'arrival' ? minutes(stop.departure) : latest,
  };
}

export function moveTimePoint(
  train: Train,
  stopIndex: number,
  kind: TimePointKind,
  requested: number,
): Train {
  const bounds = timePointBounds(train, stopIndex, kind);
  const minute = Math.max(
    bounds.min,
    Math.min(bounds.max, Math.round(requested)),
  );
  const result = clone(train);
  const stop = result.stops[stopIndex];

  if (kind !== 'departure') stop.arrival = timeString(minute);
  if (kind !== 'arrival') stop.departure = timeString(minute);

  return result;
}

export interface Point {
  stopIndex: number;
  kind: TimePointKind;
  x: number;
  y: number;
  time: string;
  station: string;
}

export const MIN_MINUTE_WIDTH = 12;

export function geometry(project: Project, viewportWidth = 1460, zoom = 100) {
  const sorted = [...project.stations].sort((a, b) => a.position - b.position);
  const legendHeight =
    Math.max(0, Math.ceil(project.groups.length / 6) - 1) * 20;
  const height = Math.max(580, sorted.length * 66 + 160) + legendHeight + 24;
  const top = 106 + legendHeight;
  const bottom = height - 102;
  const left = 264;
  const start = minutes(project.time.start);
  const end = minutes(project.time.end);
  const duration = end - start;
  const fittedMinuteWidth = (viewportWidth - left - 32) / duration;
  const minuteWidth =
    Math.max(MIN_MINUTE_WIDTH, fittedMinuteWidth) * Math.max(1, zoom / 100);
  const right = left + duration * minuteWidth;
  const width = right + 32;
  const labelEvery =
    project.time.grid *
    Math.max(1, Math.ceil(64 / (project.time.grid * minuteWidth)));

  const min = sorted[0].position;
  const max = sorted.at(-1)!.position;
  const y = (id: string) =>
    top +
    ((project.stations.find((s) => s.id === id)!.position - min) /
      (max - min)) *
      (bottom - top);
  const x = (time: string) =>
    left + ((minutes(time) - start) / (end - start)) * (right - left);
  const points = (train: Train): Point[] =>
    train.stops.flatMap((s, stopIndex) => [
      {
        x: x(s.arrival),
        y: y(s.station),
        time: s.arrival,
        station: s.station,
        stopIndex,
        kind: s.arrival === s.departure ? 'pass' : 'arrival',
      },
      ...(s.arrival === s.departure
        ? []
        : [
            {
              x: x(s.departure),
              y: y(s.station),
              time: s.departure,
              station: s.station,
              stopIndex,
              kind: 'departure' as const,
            },
          ]),
    ]);
  return {
    sorted,
    width,
    height,
    top,
    bottom,
    left,
    right,
    start,
    end,
    minuteWidth,
    labelEvery,
    x,
    y,
    points,
  };
}

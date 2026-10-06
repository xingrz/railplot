import type { Project, Train } from './model';
import { timeString } from './model';

const train = (
  name: string,
  group: string,
  stops: [string, number, number?][],
): Train => ({
  id: `t${name}`,
  name,
  color: { regional: '#587eaf', local: '#997ca8', branch: '#77995d' }[group],
  stops: stops.map(([station, a, d]) => ({
    station,
    arrival: timeString(a),
    departure: timeString(d ?? a),
  })),
});

export function demo(): Project {
  return {
    format: 'railplot',
    version: 1,
    name: '广州 · 运行图习作',
    time: { start: '00:00', end: '01:12', grid: 8 },
    stations: [
      { id: 'north', name: '广州北', position: 0, lane: 0 },
      { id: 'changgang', name: '长岗', position: 15, lane: 0 },
      { id: 'datian', name: '大田', position: 30, lane: 0 },
      { id: 'jianggao', name: '江高', position: 40, lane: 1 },
      { id: 'baiyun', name: '白云', position: 50, lane: 0 },
      { id: 'west', name: '广州西', position: 70, lane: 0 },
    ],
    links: [
      { from: 'north', to: 'changgang' },
      { from: 'changgang', to: 'datian' },
      { from: 'datian', to: 'baiyun' },
      { from: 'baiyun', to: 'west' },
      { from: 'datian', to: 'jianggao' },
    ],
    groups: [],
    trains: [
      train('9702', 'regional', [
        ['north', 5, 6],
        ['changgang', 10],
        ['datian', 14, 15],
        ['baiyun', 21, 22],
        ['west', 29, 30],
        ['baiyun', 35, 36],
        ['datian', 40],
        ['changgang', 44],
        ['north', 48, 49],
      ]),
      train('9704', 'regional', [
        ['north', 11, 12],
        ['changgang', 16],
        ['datian', 20],
        ['baiyun', 26, 27],
        ['west', 35, 36],
        ['baiyun', 41, 42],
        ['datian', 46],
        ['changgang', 50],
        ['north', 56, 57],
      ]),
      train('742', 'regional', [
        ['north', 18, 19],
        ['changgang', 23],
        ['datian', 27],
        ['baiyun', 33, 34],
        ['west', 42, 43],
        ['baiyun', 48, 49],
        ['datian', 53],
        ['changgang', 57],
        ['north', 62, 63],
      ]),
      train('435', 'regional', [
        ['north', 36, 37],
        ['changgang', 41],
        ['datian', 45],
        ['baiyun', 51, 52],
        ['west', 60, 61],
      ]),
      train('9705', 'local', [
        ['datian', 4, 5],
        ['changgang', 9],
        ['north', 13, 14],
      ]),
      train('175', 'local', [
        ['datian', 1, 2],
        ['baiyun', 9, 10],
        ['datian', 19, 20],
      ]),
      train('747', 'local', [
        ['datian', 8, 9],
        ['baiyun', 15, 16],
        ['datian', 23, 24],
        ['changgang', 28],
        ['north', 33, 34],
      ]),
      train('475', 'local', [
        ['datian', 44, 45],
        ['baiyun', 51, 52],
        ['west', 58, 59],
        ['baiyun', 65, 66],
        ['datian', 70, 71],
      ]),
      train('748', 'branch', [
        ['changgang', 44, 45],
        ['datian', 50, 51],
        ['jianggao', 55, 57],
        ['datian', 61, 62],
        ['changgang', 67, 68],
      ]),
    ],
  };
}

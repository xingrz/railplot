import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { demo } from '../demo';
import { useProjectState } from './useProjectState';

const scopes: ReturnType<typeof effectScope>[] = [];

function setup(saved: string | null = null) {
  const storage = {
    getItem: vi.fn(() => saved),
    setItem: vi.fn((_key: string, _value: string) => {}),
  };
  const scope = effectScope();
  scopes.push(scope);
  const state = scope.run(() => useProjectState(storage))!;
  return { state, storage };
}

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
});

describe('工程状态与历史', () => {
  it('损坏的本地记录不会在初始化时被示例覆盖', () => {
    const { state, storage } = setup('{broken');
    expect(state.draft.value).toEqual(demo());
    expect(state.notice.value).toContain('原记录未被覆盖');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('无效编辑可撤销，但不覆盖最近有效图表和保存记录', async () => {
    const { state, storage } = setup();
    state.draft.value.name = '已保存工程';
    await nextTick();
    const saved = JSON.parse(storage.setItem.mock.calls.at(-1)![1]);

    state.draft.value.trains[0].stops[0].departure = 'xx:xx';
    await nextTick();
    expect(state.errors.value.length).toBeGreaterThan(0);
    expect(state.valid.value).toEqual(saved);
    expect(storage.setItem).toHaveBeenCalledTimes(1);

    await state.travel(-1);
    expect(state.errors.value).toEqual([]);
    expect(state.draft.value).toEqual(saved);
    await state.travel(1);
    expect(state.errors.value.length).toBeGreaterThan(0);
    expect(state.valid.value).toEqual(saved);
  });

  it('撤销后修改会丢弃旧的重做分支，重复字段提交不增加记录', async () => {
    const { state } = setup();
    state.draft.value.name = 'A';
    await nextTick();
    state.draft.value.name = 'B';
    await nextTick();
    await state.travel(-1);
    state.draft.value.name = 'C';
    await nextTick();
    state.draft.value.name = 'C';
    await nextTick();
    await state.travel(1);
    expect(state.draft.value.name).toBe('C');
    expect(state.history.value).toHaveLength(3);
  });

  it('历史上限为 100 个快照，越界操作不改变工程', async () => {
    const { state } = setup();
    for (let index = 0; index < 105; index++) {
      state.draft.value.name = `工程 ${index}`;
      await nextTick();
    }
    expect(state.history.value).toHaveLength(100);
    await state.travel(-99);
    expect(state.draft.value.name).toBe('工程 5');
    await state.travel(-1);
    expect(state.draft.value.name).toBe('工程 5');
  });

  it('存储写入失败仍保留编辑和历史，下次成功后恢复状态', async () => {
    const { state, storage } = setup();
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('quota');
    });
    state.draft.value.name = '离线编辑';
    await nextTick();
    expect(state.storageOK.value).toBe(false);
    expect(state.valid.value.name).toBe('离线编辑');
    await state.travel(-1);
    expect(state.storageOK.value).toBe(true);
    expect(state.draft.value.name).toBe(demo().name);
  });
});

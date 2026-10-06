import { computed, nextTick, ref, watch } from 'vue';
import { demo } from '../demo';
import { clone, parseProject, validate } from '../model';
import type { Project, Train } from '../model';

const storageKey = 'railplot.project.v1';
type ProjectStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function useProjectState(storage?: ProjectStorage) {
  const notice = ref('');
  const storageOK = ref(true);
  const accessStorage = () => storage ?? window.localStorage;

  function load(): Project {
    try {
      const saved = accessStorage().getItem(storageKey);
      return saved ? parseProject(saved) : demo();
    } catch {
      notice.value =
        '本地记录无法读取，已载入示例；原记录未被覆盖，首次编辑后才会保存。';
      return demo();
    }
  }

  const draft = ref<Project>(load());
  const valid = ref(clone(draft.value));
  const errors = computed(() => validate(draft.value));
  const selectedId = ref(draft.value.trains[0]?.id ?? '');
  const selected = computed({
    get: () =>
      draft.value.trains.find((train) => train.id === selectedId.value),
    set: (train: Train | undefined) => {
      if (!train) return;
      const index = draft.value.trains.findIndex(
        (item) => item.id === train.id,
      );
      if (index >= 0) draft.value.trains[index] = train;
    },
  });

  const history = ref<string[]>([JSON.stringify(draft.value)]);
  const historyIndex = ref(0);
  let navigating = false;

  function persist(snapshot: string) {
    try {
      accessStorage().setItem(storageKey, snapshot);
      storageOK.value = true;
    } catch {
      storageOK.value = false;
    }
  }

  watch(
    draft,
    () => {
      if (navigating) return;

      const snapshot = JSON.stringify(draft.value);
      if (snapshot === history.value[historyIndex.value]) return;

      history.value = history.value.slice(0, historyIndex.value + 1);
      history.value.push(snapshot);
      if (history.value.length > 100) history.value.shift();
      historyIndex.value = history.value.length - 1;

      if (!errors.value.length) {
        valid.value = clone(draft.value);
        persist(snapshot);
      }
    },
    { deep: true },
  );

  async function travel(delta: number) {
    const index = historyIndex.value + delta;
    if (index < 0 || index >= history.value.length) return;

    navigating = true;
    historyIndex.value = index;
    draft.value = JSON.parse(history.value[index]);

    if (!validate(draft.value).length) {
      valid.value = clone(draft.value);
      persist(history.value[index]);
    }

    await nextTick();
    navigating = false;
  }

  return {
    draft,
    valid,
    errors,
    selectedId,
    selected,
    notice,
    storageOK,
    history,
    historyIndex,
    travel,
  };
}

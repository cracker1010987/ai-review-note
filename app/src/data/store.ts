import { createCatalog, type Catalog } from '../ai/catalog.ts';
import { createAI, type AI } from '../ai/client.ts';
import { ymd } from '../domain/dates.ts';
import type { ProviderId, Settings } from '../domain/types.ts';
import type { Db } from './db.ts';
import type { ImageStore } from './images.types.ts';
import * as repo from './repo.ts';
import type { AppData, Meta } from './repo.ts';

export interface StoreDeps {
  db: Db;
  images: ImageStore;
  keys: Record<ProviderId, string>;
  saveKey: (p: ProviderId, key: string) => Promise<void>;
  fetchFn?: typeof fetch;
}

/**
 * 앱 전체 상태. 시작할 때 기기 DB를 한 번에 메모리로 올리고,
 * 바꿀 때는 메모리를 먼저 바꿔 화면을 그리고 DB에도 바로 쓴다.
 */
export function createStore(initial: AppData, deps: StoreDeps) {
  let data = initial;
  let keys = { ...deps.keys };
  let version = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    version++;
    listeners.forEach((f) => f());
  };
  const catalog: Catalog = createCatalog(deps.fetchFn);
  catalog.subscribe(emit);

  let monthCost = 0;
  const refreshMonthCost = async () => {
    const rows = await repo.usageSince(deps.db, ymd().slice(0, 7) + '-01');
    monthCost = rows.reduce((a, r) => a + (r.cost || 0), 0);
  };
  void refreshMonthCost();

  const ai: AI = createAI({
    getSettings: () => data.settings,
    getKey: (p) => keys[p] || '',
    catalog,
    fetchFn: deps.fetchFn,
    monthCost: () => monthCost,
    today: () => ymd(),
    onUsage: (u) => {
      monthCost += u.cost || 0;
      void repo.addUsage(deps.db, { ...u, tier: u.tier || 'other' });
    },
  });

  function set(next: AppData) {
    data = next;
    emit();
  }

  return {
    db: deps.db,
    images: deps.images,
    ai,
    catalog,
    get: () => data,
    getKeys: () => keys,
    getVersion: () => version,
    subscribe(f: () => void) {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },

    async updateSettings(patch: Partial<Settings>) {
      const settings = { ...data.settings, ...patch };
      set({ ...data, settings });
      await repo.saveSettings(deps.db, settings);
    },
    async updateMeta(patch: Partial<Meta>) {
      const meta = { ...data.meta, ...patch };
      set({ ...data, meta });
      await repo.saveMeta(deps.db, meta);
    },
    async setKey(p: ProviderId, key: string) {
      keys = { ...keys, [p]: key.trim() };
      emit();
      await deps.saveKey(p, key);
    },
    /** 백업을 불러온 뒤처럼 DB가 통째로 바뀌었을 때 */
    async reload() {
      set(await repo.loadAll(deps.db));
      await refreshMonthCost();
    },
    async usageSince(day: string) {
      return repo.usageSince(deps.db, day);
    },
  };
}
export type Store = ReturnType<typeof createStore>;

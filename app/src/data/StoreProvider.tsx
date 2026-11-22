import * as SQLite from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { DB_NAME, migrate, type Db } from './db';
import { createImageStore } from './images';
import { loadKeys, saveKey } from './keys';
import { loadAll } from './repo';
import { createStore, type Store } from './store';

const Ctx = createContext<Store | null>(null);

/** 기기 DB를 열고, 데이터·키를 불러온 뒤 앱을 그린다 */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sqlite = await SQLite.openDatabaseAsync(DB_NAME);
      const db = sqlite as unknown as Db;
      await db.execAsync("PRAGMA journal_mode = 'wal';");
      await migrate(db);
      const [data, keys] = await Promise.all([loadAll(db), loadKeys()]);
      const s = createStore(data, { db, images: createImageStore(db), keys, saveKey });
      void s.catalog.load();
      if (alive) setStore(s);
    })().catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (err)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 6 }}>데이터를 열지 못했어요</Text>
        <Text style={{ color: '#5F6B85', textAlign: 'center' }}>{err}</Text>
      </View>
    );
  if (!store)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider 밖에서 useStore를 썼어요');
  return s;
}

/** 데이터가 바뀌면 다시 그린다 */
export function useData() {
  const s = useStore();
  useSyncExternalStore(s.subscribe, s.getVersion);
  return s.get();
}

export function useKeys() {
  const s = useStore();
  useSyncExternalStore(s.subscribe, s.getVersion);
  return s.getKeys();
}

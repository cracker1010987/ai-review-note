import { arr } from '../lib/util.ts';
import type { Db, SqlParam } from './db.ts';
import type { ImageStore } from './images.types.ts';
import { dumpTables, TABLES } from './repo.ts';

export const BACKUP_APP = 'ai-review-note';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  /** 경로 → base64 JPEG */
  images: Record<string, string>;
}

/** 모든 데이터와 사진을 파일 하나(JSON)로. API 키는 기기 보안 저장소에 있어서 들어가지 않는다 */
export async function buildBackup(db: Db, images: ImageStore, now = new Date()): Promise<BackupFile> {
  const tables = await dumpTables(db);
  const imgs: Record<string, string> = {};
  for (const p of await images.list()) {
    const b = await images.get(p);
    if (b) imgs[p] = b;
  }
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), tables, images: imgs };
}

export interface BackupSummary {
  exportedAt: string;
  notes: number;
  subjects: number;
  images: number;
}

/** 파일 내용을 확인한다. 이 앱 백업이 아니거나 깨졌으면 알아듣기 쉬운 오류 */
export function parseBackup(text: string): { file: BackupFile; summary: BackupSummary } {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('백업 파일을 읽지 못했어요. 파일이 손상됐을 수 있어요.');
  }
  const f = j as Partial<BackupFile>;
  if (!f || f.app !== BACKUP_APP || typeof f.tables !== 'object' || !f.tables) throw new Error('AI 오답노트 백업 파일이 아니에요.');
  if (typeof f.version !== 'number' || f.version > BACKUP_VERSION) throw new Error('더 새 버전의 앱에서 만든 백업이에요. 앱을 업데이트한 뒤 불러와주세요.');
  const t = f.tables as Record<string, unknown>;
  for (const k of TABLES) if (t[k] !== undefined && !Array.isArray(t[k])) throw new Error('백업 파일 형식이 올바르지 않아요.');
  const images = f.images && typeof f.images === 'object' ? (f.images as Record<string, string>) : {};
  return {
    file: { app: f.app, version: f.version, exportedAt: String(f.exportedAt || ''), tables: f.tables as BackupFile['tables'], images },
    summary: { exportedAt: String(f.exportedAt || ''), notes: arr(t.notes).length, subjects: arr(t.subjects).length, images: Object.keys(images).length },
  };
}

const SAFE_PATH = /^notes\/[A-Za-z0-9_-]+\/(q|s|mine|fig)\.jpg$/;

/**
 * 지금 데이터를 백업 내용으로 통째로 바꾼다.
 * 열 이름은 실제 표 구조에 있는 것만 받아서, 조작된 파일이 SQL을 끼워 넣지 못하게 한다.
 */
export async function restoreBackup(db: Db, images: ImageStore, file: BackupFile): Promise<void> {
  const cols: Record<string, Set<string>> = {};
  for (const t of TABLES) cols[t] = new Set((await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((r) => r.name));
  await db.withTransactionAsync(async () => {
    for (const t of TABLES) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      for (const row of arr<Record<string, unknown>>(file.tables[t])) {
        if (!row || typeof row !== 'object') continue;
        const keys = Object.keys(row).filter((k) => cols[t].has(k));
        if (!keys.length) continue;
        const vals = keys.map((k): SqlParam => {
          const v = row[k];
          return v == null ? null : typeof v === 'number' || typeof v === 'string' ? v : JSON.stringify(v);
        });
        await db.runAsync(`INSERT OR REPLACE INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, vals);
      }
    }
  });
  await images.clear();
  for (const [p, b] of Object.entries(file.images)) if (SAFE_PATH.test(p) && typeof b === 'string') await images.put(p, b);
}

/** 백업 파일 이름 */
export const backupFileName = (now = new Date()) => {
  const z = (n: number) => String(n).padStart(2, '0');
  return `오답노트-백업-${now.getFullYear()}${z(now.getMonth() + 1)}${z(now.getDate())}.json`;
};

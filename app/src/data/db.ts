/** expo-sqlite의 SQLiteDatabase 중 우리가 쓰는 부분. 테스트에서는 node:sqlite로 같은 모양을 만든다 */
export type SqlParam = string | number | null;
export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParam[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}

export const DB_NAME = 'odap.db';
const VERSION = 1;

/** 테이블 만들기 / 버전 올리기 (PRAGMA user_version) */
export async function migrate(db: Db): Promise<void> {
  const r = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = r?.user_version ?? 0;
  if (v >= VERSION) return;
  if (v === 0) {
    await db.execAsync(`
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, kind TEXT NOT NULL, ai_note TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY NOT NULL, course_id TEXT NOT NULL, name TEXT NOT NULL, units TEXT NOT NULL DEFAULT '[]', sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS concepts (
  subject_id TEXT NOT NULL, leaf_id TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (subject_id, leaf_id));
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL, course_id TEXT NOT NULL, subject_id TEXT NOT NULL, leaf_id TEXT,
  type TEXT NOT NULL DEFAULT '', tags TEXT NOT NULL DEFAULT '[]', workbook TEXT NOT NULL DEFAULT '', page TEXT NOT NULL DEFAULT '', number TEXT NOT NULL DEFAULT '',
  problem TEXT NOT NULL DEFAULT '', choices TEXT NOT NULL DEFAULT '[]', answer TEXT NOT NULL DEFAULT '', answer_index INTEGER, mine TEXT NOT NULL DEFAULT '', mine_index INTEGER,
  steps TEXT NOT NULL DEFAULT '[]', key TEXT NOT NULL DEFAULT '', mistake TEXT NOT NULL DEFAULT '', advice TEXT NOT NULL DEFAULT '', concepts TEXT NOT NULL DEFAULT '[]',
  figure TEXT, show_photo INTEGER NOT NULL DEFAULT 0, images TEXT NOT NULL DEFAULT '{}', similar TEXT NOT NULL DEFAULT '[]',
  srs_step INTEGER NOT NULL DEFAULT 0, srs_due TEXT NOT NULL, srs_streak INTEGER NOT NULL DEFAULT 0, graduated TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS notes_subject ON notes (subject_id, leaf_id);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, note_id TEXT, subject_id TEXT, leaf_id TEXT, ok INTEGER NOT NULL, exam_id TEXT, day TEXT NOT NULL, q TEXT);
CREATE INDEX IF NOT EXISTS reviews_day ON reviews (day);
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, date TEXT NOT NULL, course_id TEXT NOT NULL, scope TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL, tier TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
  calls INTEGER NOT NULL DEFAULT 0, tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0, cost REAL NOT NULL DEFAULT 0, unk INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, tier, provider, model));
CREATE TABLE IF NOT EXISTS images (path TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL);
`);
    v = 1;
  }
  await db.execAsync(`PRAGMA user_version = ${VERSION}`);
}

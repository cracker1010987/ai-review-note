import { normalizeSettings } from '../domain/settings.ts';
import type { Concept, Course, Exam, Note, QuizLog, ReviewLog, Settings, Subject } from '../domain/types.ts';
import { arr } from '../lib/util.ts';
import type { Db, SqlParam } from './db.ts';

/** 앱 전체 데이터 (기기에 저장, 메모리에 한 번에 올려 쓴다) */
export interface AppData {
  settings: Settings;
  courses: Course[];
  subjects: Subject[];
  /** `${subjectId}|${leafId}` → 개념 정리 */
  concepts: Record<string, Concept & { at: number }>;
  notes: Note[];
  reviews: ReviewLog[];
  quizzes: QuizLog[];
  exams: Exam[];
  report: WeeklyReport | null;
  meta: Meta;
}

export interface WeeklyReport {
  from: string;
  to: string;
  at: number;
  headline: string;
  good: string[];
  weak: string[];
  plan: string[];
  cheer: string;
}

/** 설정 외의 작은 값들 */
export interface Meta {
  onboarded: boolean;
  lastBackup: string;
  backupSnooze: string;
  helpSeen: boolean;
}
export const defaultMeta = (): Meta => ({ onboarded: false, lastBackup: '', backupSnooze: '', helpSeen: false });

export const conceptKey = (sid: string, lid: string) => `${sid}|${lid}`;

const J = (v: unknown) => JSON.stringify(v ?? null);
const P = <T>(s: unknown, d: T): T => {
  if (typeof s !== 'string') return d;
  try {
    const v = JSON.parse(s);
    return v == null ? d : (v as T);
  } catch {
    return d;
  }
};

// ---------- 행 ↔ 객체
type Row = Record<string, any>;

export const noteToParams = (n: Note): SqlParam[] => [
  n.id, n.courseId, n.subjectId, n.leafId, n.type, J(n.tags), n.workbook, n.page, n.number,
  n.problem, J(n.choices), n.answer, n.answerIndex, n.mine, n.mineIndex,
  J(n.steps), n.key, n.mistake, n.advice || '', J(n.concepts),
  n.figure ? J(n.figure) : null, n.showPhoto ? 1 : 0, J(n.images), J(n.similar),
  n.srs.step, n.srs.due, n.srs.streak, n.graduated, n.createdAt,
];
const NOTE_COLS =
  'id, course_id, subject_id, leaf_id, type, tags, workbook, page, number, problem, choices, answer, answer_index, mine, mine_index, steps, key, mistake, advice, concepts, figure, show_photo, images, similar, srs_step, srs_due, srs_streak, graduated, created_at';

export function rowToNote(r: Row): Note {
  return {
    id: r.id, courseId: r.course_id, subjectId: r.subject_id, leafId: r.leaf_id ?? null,
    type: r.type, tags: P(r.tags, []), workbook: r.workbook, page: r.page, number: r.number,
    problem: r.problem, choices: P(r.choices, []), answer: r.answer, answerIndex: r.answer_index ?? null,
    mine: r.mine, mineIndex: r.mine_index ?? null, steps: P(r.steps, []), key: r.key, mistake: r.mistake,
    advice: r.advice || '', concepts: P(r.concepts, []), figure: P(r.figure, null), showPhoto: !!r.show_photo,
    images: P(r.images, {}), similar: P(r.similar, []),
    srs: { step: r.srs_step, due: r.srs_due, streak: r.srs_streak }, graduated: r.graduated ?? null,
    createdAt: r.created_at, history: [],
  };
}

// ---------- 불러오기
export async function loadAll(db: Db): Promise<AppData> {
  const kv = Object.fromEntries((await db.getAllAsync<Row>('SELECT key, value FROM kv')).map((r) => [r.key, r.value]));
  const courses = (await db.getAllAsync<Row>('SELECT * FROM courses ORDER BY sort, rowid')).map(
    (r): Course => ({ id: r.id, name: r.name, color: r.color, kind: r.kind, aiNote: r.ai_note, sort: r.sort }),
  );
  const subjects = (await db.getAllAsync<Row>('SELECT * FROM subjects ORDER BY sort, rowid')).map(
    (r): Subject => ({ id: r.id, courseId: r.course_id, name: r.name, units: P(r.units, []), sort: r.sort }),
  );
  const concepts: AppData['concepts'] = {};
  for (const r of await db.getAllAsync<Row>('SELECT * FROM concepts')) concepts[conceptKey(r.subject_id, r.leaf_id)] = { ...P(r.body, {} as Concept), at: r.at };
  const notes = (await db.getAllAsync<Row>('SELECT * FROM notes ORDER BY created_at DESC')).map(rowToNote);
  const reviews: ReviewLog[] = [];
  const quizzes: QuizLog[] = [];
  const byId = new Map(notes.map((n) => [n.id, n]));
  for (const r of await db.getAllAsync<Row>('SELECT * FROM reviews ORDER BY id')) {
    if (r.kind === 'note') {
      reviews.push({ d: r.day, ok: !!r.ok, nid: r.note_id ?? undefined, ex: r.exam_id ?? undefined });
      byId.get(r.note_id)?.history.push({ d: r.day, ok: !!r.ok });
    } else quizzes.push({ d: r.day, sid: r.subject_id, lid: r.leaf_id, ok: !!r.ok, q: r.q ?? undefined });
  }
  const exams = (await db.getAllAsync<Row>('SELECT * FROM exams ORDER BY date')).map(
    (r): Exam => ({ id: r.id, name: r.name, date: r.date, courseId: r.course_id, scope: P(r.scope, []) }),
  );
  return {
    settings: normalizeSettings(P(kv.settings, {})),
    meta: { ...defaultMeta(), ...P(kv.meta, {}) },
    report: P(kv.report, null),
    courses, subjects, concepts, notes, reviews, quizzes, exams,
  };
}

// ---------- 저장
export const setKV = (db: Db, key: string, value: unknown) =>
  db.runAsync('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, J(value)]);

export const saveSettings = (db: Db, s: Settings) => setKV(db, 'settings', s);
export const saveMeta = (db: Db, m: Meta) => setKV(db, 'meta', m);
export const saveReport = (db: Db, r: WeeklyReport | null) => setKV(db, 'report', r);

export const upsertCourse = (db: Db, c: Course) =>
  db.runAsync(
    `INSERT INTO courses (id, name, color, kind, ai_note, sort) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, kind=excluded.kind, ai_note=excluded.ai_note, sort=excluded.sort`,
    [c.id, c.name, c.color, c.kind, c.aiNote || '', c.sort ?? 0],
  );

export const upsertSubject = (db: Db, s: Subject) =>
  db.runAsync(
    `INSERT INTO subjects (id, course_id, name, units, sort) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET course_id=excluded.course_id, name=excluded.name, units=excluded.units, sort=excluded.sort`,
    [s.id, s.courseId, s.name, J(s.units), s.sort ?? 0],
  );

export const setConcept = (db: Db, sid: string, lid: string, c: Concept, at = Date.now()) =>
  db.runAsync(
    'INSERT INTO concepts (subject_id, leaf_id, body, at) VALUES (?, ?, ?, ?) ON CONFLICT(subject_id, leaf_id) DO UPDATE SET body=excluded.body, at=excluded.at',
    [sid, lid, J(c), at],
  );

export const upsertNote = (db: Db, n: Note) =>
  db.runAsync(
    `INSERT OR REPLACE INTO notes (${NOTE_COLS}) VALUES (${NOTE_COLS.split(',').map(() => '?').join(', ')})`,
    noteToParams(n),
  );

export async function deleteNote(db: Db, id: string) {
  await db.runAsync('DELETE FROM notes WHERE id = ?', [id]);
  await db.runAsync("DELETE FROM reviews WHERE kind = 'note' AND note_id = ?", [id]);
}

export async function deleteSubject(db: Db, sid: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM reviews WHERE note_id IN (SELECT id FROM notes WHERE subject_id = ?) OR (kind = 'concept' AND subject_id = ?)", [sid, sid]);
    await db.runAsync('DELETE FROM notes WHERE subject_id = ?', [sid]);
    await db.runAsync('DELETE FROM concepts WHERE subject_id = ?', [sid]);
    await db.runAsync('DELETE FROM subjects WHERE id = ?', [sid]);
  });
}

export async function deleteCourse(db: Db, cid: string) {
  const subs = await db.getAllAsync<{ id: string }>('SELECT id FROM subjects WHERE course_id = ?', [cid]);
  for (const s of subs) await deleteSubject(db, s.id);
  await db.runAsync('DELETE FROM notes WHERE course_id = ?', [cid]);
  await db.runAsync('DELETE FROM exams WHERE course_id = ?', [cid]);
  await db.runAsync('DELETE FROM courses WHERE id = ?', [cid]);
}

export const addReview = (db: Db, r: ReviewLog) =>
  db.runAsync("INSERT INTO reviews (kind, note_id, ok, exam_id, day) VALUES ('note', ?, ?, ?, ?)", [r.nid ?? null, r.ok ? 1 : 0, r.ex ?? null, r.d]);

export const addQuiz = (db: Db, q: QuizLog) =>
  db.runAsync("INSERT INTO reviews (kind, subject_id, leaf_id, ok, day, q) VALUES ('concept', ?, ?, ?, ?, ?)", [q.sid, q.lid, q.ok ? 1 : 0, q.d, q.q ?? null]);

export const upsertExam = (db: Db, e: Exam) =>
  db.runAsync(
    'INSERT INTO exams (id, name, date, course_id, scope) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, date=excluded.date, course_id=excluded.course_id, scope=excluded.scope',
    [e.id, e.name, e.date, e.courseId, J(e.scope)],
  );
export const deleteExam = (db: Db, id: string) => db.runAsync('DELETE FROM exams WHERE id = ?', [id]);

// ---------- AI 사용량
export interface UsageRow {
  day: string;
  tier: string;
  provider: string;
  model: string;
  calls: number;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  unk: number;
}
export const addUsage = (db: Db, u: { day: string; tier: string; provider: string; model: string; tokensIn: number; tokensOut: number; cost: number | null }) =>
  db.runAsync(
    `INSERT INTO usage (day, tier, provider, model, calls, tokens_in, tokens_out, cost, unk) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
     ON CONFLICT(day, tier, provider, model) DO UPDATE SET calls = calls + 1, tokens_in = tokens_in + excluded.tokens_in,
       tokens_out = tokens_out + excluded.tokens_out, cost = cost + excluded.cost, unk = unk + excluded.unk`,
    [u.day, u.tier, u.provider, u.model, u.tokensIn, u.tokensOut, u.cost ?? 0, u.cost == null ? 1 : 0],
  );
export const usageSince = (db: Db, fromDay: string) => db.getAllAsync<UsageRow>('SELECT * FROM usage WHERE day >= ?', [fromDay]);

/** 백업·초기화용: 모든 표 이름 (images는 따로 다룬다) */
export const TABLES = ['kv', 'courses', 'subjects', 'concepts', 'notes', 'reviews', 'exams', 'usage'] as const;

export async function dumpTables(db: Db): Promise<Record<string, Row[]>> {
  const out: Record<string, Row[]> = {};
  for (const t of TABLES) out[t] = await db.getAllAsync<Row>(`SELECT * FROM ${t}`);
  return out;
}

export function rowsLookValid(t: Record<string, unknown>): boolean {
  return TABLES.every((k) => k === 'usage' || Array.isArray(t[k])) && arr(t.notes).every((n) => n && typeof (n as Row).id === 'string');
}

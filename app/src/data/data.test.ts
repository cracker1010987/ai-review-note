/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { defaultSettings } from '../domain/settings.ts';
import type { Note } from '../domain/types.ts';
import { buildBackup, parseBackup, restoreBackup } from './backup.ts';
import { migrate, type Db, type SqlParam } from './db.ts';
import type { ImageStore } from './images.types.ts';
import * as repo from './repo.ts';

/** node:sqlite로 expo-sqlite와 같은 모양을 만든다 */
function memDb(): Db {
  const d = new DatabaseSync(':memory:');
  const p = (params?: SqlParam[]) => (params || []) as (string | number | null)[];
  return {
    async execAsync(sql) {
      d.exec(sql);
    },
    async runAsync(sql, params) {
      return d.prepare(sql).run(...p(params));
    },
    async getAllAsync(sql, params) {
      return d.prepare(sql).all(...p(params)) as never[];
    },
    async getFirstAsync(sql, params) {
      return (d.prepare(sql).get(...p(params)) ?? null) as never;
    },
    async withTransactionAsync(fn) {
      d.exec('BEGIN');
      try {
        await fn();
        d.exec('COMMIT');
      } catch (e) {
        d.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
function memImages(): ImageStore & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return {
    m,
    async put(p, b) { m.set(p, b); },
    async get(p) { return m.get(p) ?? null; },
    async displayUri(p) { return m.has(p) ? 'mem://' + p : null; },
    async del(p) { m.delete(p); },
    async list() { return [...m.keys()]; },
    async clear() { m.clear(); },
  };
}

const note = (o: Partial<Note> = {}): Note => ({
  id: 'n1', courseId: 'c1', subjectId: 's1', leafId: 'l1', type: '제한된 범위 최대최소', tags: ['조건 놓침'], workbook: '쎈', page: '58', number: '17',
  problem: '\\(f(x)=x^2\\)', choices: ['\\(1\\)', '\\(2\\)'], answer: '\\(2\\)', answerIndex: 1, mine: '', mineIndex: 0, steps: ['a', 'b'], key: 'k',
  mistake: 'm', advice: '', concepts: ['꼭짓점'], figure: { x: 1, y: 2, w: 30, h: 40 }, showPhoto: true, images: { q: 'notes/n1/q.jpg' },
  similar: [{ text: 's', choices: [], answer: '3', answer_index: null, solution: '', verified: true, level: 'hard' }],
  srs: { step: 1, due: '2026-11-25', streak: 1 }, graduated: null, createdAt: 1763700000000, history: [], ...o,
});

async function seeded() {
  const db = memDb();
  await migrate(db);
  await migrate(db); // 두 번 불러도 괜찮아야 한다
  await repo.saveSettings(db, { ...defaultSettings(), grade: '고2', provider: 'claude' });
  await repo.saveMeta(db, { ...repo.defaultMeta(), onboarded: true });
  await repo.upsertCourse(db, { id: 'c1', name: '수학', color: '#2747C9', kind: 'math', aiNote: '' });
  await repo.upsertSubject(db, { id: 's1', courseId: 'c1', name: '공통수학1', units: [{ id: 'u1', name: '다항식', subs: [{ id: 'l1', name: '나머지정리' }] }] });
  await repo.setConcept(db, 's1', 'l1', { summary: '요약', points: [], formulas: [], mistakes: [], check: [] }, 5);
  await repo.upsertNote(db, note());
  await repo.addReview(db, { d: '2026-11-22', ok: true, nid: 'n1' });
  await repo.addQuiz(db, { d: '2026-11-22', sid: 's1', lid: 'l1', ok: false, q: '질문' });
  await repo.upsertExam(db, { id: 'e1', name: '중간', date: '2026-12-10', courseId: 'c1', scope: [{ sid: 's1', lids: null }] });
  await repo.addUsage(db, { day: '2026-11-22', tier: 'read', provider: 'claude', model: 'claude-haiku-5-5', tokensIn: 1000, tokensOut: 200, cost: 0.0002 });
  await repo.addUsage(db, { day: '2026-11-22', tier: 'read', provider: 'claude', model: 'claude-haiku-5-5', tokensIn: 500, tokensOut: 100, cost: null });
  return db;
}

test('저장한 그대로 불러온다 (오답, 복습 기록, 개념, 시험, 설정)', async () => {
  const db = await seeded();
  const d = await repo.loadAll(db);
  assert.equal(d.settings.grade, '고2');
  assert.equal(d.settings.provider, 'claude');
  assert.equal(d.meta.onboarded, true);
  assert.equal(d.subjects[0].units[0].subs[0].name, '나머지정리');
  assert.equal(d.concepts['s1|l1'].summary, '요약');
  const n = d.notes[0];
  assert.deepEqual({ ...n, history: [] }, note());
  assert.deepEqual(n.history, [{ d: '2026-11-22', ok: true }]);
  assert.deepEqual(d.reviews, [{ d: '2026-11-22', ok: true, nid: 'n1', ex: undefined }]);
  assert.deepEqual(d.quizzes, [{ d: '2026-11-22', sid: 's1', lid: 'l1', ok: false, q: '질문' }]);
  assert.equal(d.exams[0].scope[0].lids, null);
  const u = await repo.usageSince(db, '2026-11-01');
  assert.equal(u[0].calls, 2);
  assert.equal(u[0].unk, 1);
  assert.ok(Math.abs(u[0].cost - 0.0002) < 1e-12);
});

test('과목을 지우면 그 오답·복습 기록·개념 정리도 지운다', async () => {
  const db = await seeded();
  await repo.deleteSubject(db, 's1');
  const d = await repo.loadAll(db);
  assert.equal(d.subjects.length + d.notes.length + d.reviews.length + d.quizzes.length + Object.keys(d.concepts).length, 0);
  assert.equal(d.courses.length, 1);
});

test('백업 → 다른 기기에서 불러오기 하면 데이터와 사진이 그대로', async () => {
  const db = await seeded();
  const imgs = memImages();
  await imgs.put('notes/n1/q.jpg', 'QUJD');
  const text = JSON.stringify(await buildBackup(db, imgs, new Date('2026-11-22T10:00:00Z')));
  const { file, summary } = parseBackup(text);
  assert.deepEqual(summary, { exportedAt: '2026-11-22T10:00:00.000Z', notes: 1, subjects: 1, images: 1 });

  const db2 = memDb();
  await migrate(db2);
  await repo.upsertNote(db2, note({ id: 'other' }));
  const imgs2 = memImages();
  await imgs2.put('notes/other/q.jpg', 'X');
  await restoreBackup(db2, imgs2, file);
  const a = await repo.loadAll(db);
  const b = await repo.loadAll(db2);
  assert.deepEqual(b, a, '기존 데이터는 사라지고 백업 내용으로 바뀐다');
  assert.deepEqual([...imgs2.m.entries()], [['notes/n1/q.jpg', 'QUJD']]);
});

test('잘못된 백업 파일은 알아듣기 쉬운 말로 거절하고, 조작된 열·경로는 무시한다', async () => {
  assert.throws(() => parseBackup('not json'), /손상/);
  assert.throws(() => parseBackup('{"app":"other","version":1,"tables":{}}'), /백업 파일이 아니에요/);
  assert.throws(() => parseBackup('{"app":"ai-review-note","version":99,"tables":{}}'), /새 버전/);

  const db = memDb();
  await migrate(db);
  const imgs = memImages();
  const evil = {
    app: 'ai-review-note', version: 1, exportedAt: '',
    tables: { courses: [{ id: 'c1', name: '수학', color: '#000', kind: 'math', 'name) VALUES (1); DROP TABLE notes; --': 'x' }] },
    images: { '../../evil.jpg': 'QQ==', 'notes/n1/q.jpg': 'QUJD' },
  };
  await restoreBackup(db, imgs, parseBackup(JSON.stringify(evil)).file);
  const d = await repo.loadAll(db);
  assert.equal(d.courses[0].name, '수학');
  assert.ok(await db.getFirstAsync('SELECT 1 FROM notes LIMIT 1') === null, 'notes 표가 남아 있다');
  assert.deepEqual([...imgs.m.keys()], ['notes/n1/q.jpg']);
});

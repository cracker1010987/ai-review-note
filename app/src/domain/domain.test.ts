/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayDiff, ddayLabel, dueLabel, ymd } from './dates.ts';
import { examPlan } from './exam.ts';
import { reviewQueue, streakDays, weakLeaves, weekData, type Snapshot } from './review.ts';
import { defaultSettings, normalizeSettings } from './settings.ts';
import { applySrs, isDue } from './srs.ts';
import { leaves } from './subject.ts';
import type { Exam, Note, Subject } from './types.ts';

const TODAY = new Date(2026, 10, 22, 15, 0); // 2026-11-22
const subject: Subject = {
  id: 's1',
  courseId: 'c1',
  name: '공통수학1',
  units: [
    { id: 'u1', name: '다항식', subs: [{ id: 'l1', name: '나머지정리' }, { id: 'l2', name: '인수분해' }] },
    { id: 'u2', name: '행렬', subs: [] },
  ],
};
let seq = 0;
function note(o: Partial<Note> = {}): Note {
  return {
    id: 'n' + ++seq, courseId: 'c1', subjectId: 's1', leafId: 'l1', type: '유형', tags: [], workbook: '', page: '', number: '',
    problem: 'p', choices: [], answer: '', answerIndex: null, mine: '', mineIndex: null, steps: [], key: '', mistake: '', concepts: [],
    figure: null, images: {}, similar: [], srs: { step: 0, due: ymd(TODAY), streak: 0 }, graduated: null, createdAt: TODAY.getTime(), history: [], ...o,
  };
}
const snap = (o: Partial<Snapshot> = {}): Snapshot => ({ subjects: [subject], notes: [], reviews: [], quizzes: [], settings: defaultSettings(), ...o });

test('날짜 도우미', () => {
  assert.equal(ymd(TODAY), '2026-11-22');
  assert.equal(addDays(10, TODAY), '2026-12-02');
  assert.equal(dayDiff('2026-11-25', TODAY), 3);
  assert.equal(dueLabel('2026-11-23', TODAY), '내일');
  assert.equal(ddayLabel('2026-11-22', TODAY), 'D-DAY');
  assert.equal(ddayLabel('2026-11-20', TODAY), 'D+2');
});

test('단원 목록: 소단원이 없으면 대단원이 단원', () => {
  assert.deepEqual(leaves(subject).map((l) => `${l.id}:${l.isUnit}`), ['l1:false', 'l2:false', 'u2:true']);
});

test('복습 간격: 맞히면 1→3→7일, 틀리면 다음 날, 연속 3번이면 졸업', () => {
  const s = defaultSettings();
  let n = note();
  const r1 = applySrs(n, true, s, TODAY);
  assert.equal(r1.srs.due, addDays(3, TODAY));
  n = { ...n, ...r1 };
  const r2 = applySrs(n, true, s, TODAY);
  assert.equal(r2.srs.due, addDays(7, TODAY));
  assert.equal(r2.justGraduated, false);
  n = { ...n, ...r2 };
  const r3 = applySrs(n, true, s, TODAY);
  assert.equal(r3.justGraduated, true);
  assert.equal(r3.graduated, '2026-11-22');
  const bad = applySrs({ ...n, ...r2 }, false, s, TODAY);
  assert.deepEqual(bad.srs, { step: 0, due: addDays(1, TODAY), streak: 0 });
  assert.equal(isDue({ ...n, ...r3 }, TODAY), false, '졸업한 오답은 복습에 안 나온다');
});

test('오늘 복습: 날짜 된 오답 오래된 순 + 약한 단원 개념 질문', () => {
  const s = { ...defaultSettings(), reviewPerDay: 2, conceptThreshold: 2 };
  const a = note({ srs: { step: 0, due: '2026-11-20', streak: 0 } });
  const b = note({ srs: { step: 0, due: '2026-11-21', streak: 0 } });
  const c = note({ srs: { step: 0, due: '2026-11-22', streak: 0 } });
  const later = note({ srs: { step: 0, due: '2026-11-30', streak: 0 } });
  const q = reviewQueue(snap({ notes: [c, later, b, a], settings: s }), TODAY);
  assert.deepEqual(q, [
    { kind: 'note', noteId: a.id },
    { kind: 'note', noteId: b.id },
    { kind: 'concept', sid: 's1', lid: 'l1' },
  ]);
  const q2 = reviewQueue(snap({ notes: [a, b, c], settings: s, quizzes: [{ d: '2026-11-22', sid: 's1', lid: 'l1', ok: true }] }), TODAY);
  assert.equal(q2.filter((x) => x.kind === 'concept').length, 0, '오늘 이미 받은 개념 질문은 빼기');
  assert.equal(weakLeaves([subject], [a, b, c, note({ leafId: 'l2', graduated: '2026-11-01' })], 1).length, 1);
});

test('연속 공부 일수: 오늘 안 했으면 어제까지 센다', () => {
  assert.equal(streakDays(new Set(['2026-11-22', '2026-11-21', '2026-11-19']), TODAY), 2);
  assert.equal(streakDays(new Set(['2026-11-21', '2026-11-20']), TODAY), 2);
  assert.equal(streakDays(new Set(['2026-11-19']), TODAY), 0);
});

test('시험 계획: 두 바퀴 돌 하루 몫(최소 3), 오늘 한 만큼 빼기', () => {
  const ns = Array.from({ length: 10 }, (_, i) => note({ leafId: i < 6 ? 'l1' : 'u2' }));
  ns.push(note({ leafId: 'l2', graduated: '2026-11-01' }));
  const e: Exam = { id: 'e1', name: '중간', date: addDays(4, TODAY), courseId: 'c1', scope: [{ sid: 's1', lids: ['l1', 'l2', 'u2'] }] };
  const s = { ...defaultSettings(), conceptThreshold: 5 };
  const p = examPlan(e, snap({ notes: ns, settings: s }), TODAY);
  assert.equal(p.active.length, 10);
  assert.equal(p.per, 5);
  assert.deepEqual(p.items.filter((x) => x.kind === 'concept'), [{ kind: 'concept', sid: 's1', lid: 'l1' }]);
  const p2 = examPlan(e, snap({ notes: ns, settings: s, reviews: [{ d: '2026-11-22', ok: true, nid: ns[0].id, ex: 'e1' }] }), TODAY);
  assert.equal(p2.done, 1);
  assert.equal(p2.items.filter((x) => x.kind === 'note').length, 4);
});

test('주간 기록 요약', () => {
  const ns = [note({ tags: ['계산 실수'] }), note({ tags: ['계산 실수', '조건 놓침'], createdAt: TODAY.getTime() - 10 * 864e5 })];
  const w = weekData(snap({ notes: ns, reviews: [{ d: '2026-11-21', ok: true }, { d: '2026-11-10', ok: false }] }), TODAY);
  assert.equal(w.added, 1);
  assert.deepEqual(w.tags, [['계산 실수', 1]]);
  assert.equal(w.rv, 1);
  assert.equal(w.days, 2);
});

test('설정 보정: 빠진 값 채우기, 작업별 설정 정리', () => {
  const s = normalizeSettings({ provider: 'claude', tiers: { read: { p: 'gemini', m: ' x ' } }, intervals: 'weird' });
  assert.equal(s.provider, 'claude');
  assert.deepEqual(s.tiers.read, { p: 'gemini', m: 'x' });
  assert.deepEqual(s.tiers.verify, { p: '', m: '' });
  assert.equal(s.intervals, 'normal');
  assert.equal(s.tagPresets.length, 6);
});

import { dayDiff, ymd } from './dates.ts';
import { leafActive, type Snapshot } from './review.ts';
import { leaves } from './subject.ts';
import type { Exam, Leaf, Note, QueueItem, Subject } from './types.ts';

export function inScope(e: Exam, n: Note): boolean {
  const sc = e.scope.find((x) => x.sid === n.subjectId);
  return !!sc && (!sc.lids || (n.leafId != null && sc.lids.includes(n.leafId)));
}

export const examPool = (e: Exam, notes: Note[]) => notes.filter((n) => inScope(e, n));

export const upcomingExams = (exams: Exam[], today: Date = new Date()) =>
  exams.filter((e) => e.date >= ymd(today)).sort((a, b) => a.date.localeCompare(b.date));

export function examLeaves(e: Exam, subjects: Subject[]): { s: Subject; l: Leaf }[] {
  const out: { s: Subject; l: Leaf }[] = [];
  for (const sc of e.scope) {
    const s = subjects.find((x) => x.id === sc.sid);
    if (!s) continue;
    for (const l of leaves(s)) if (!sc.lids || sc.lids.includes(l.id)) out.push({ s, l });
  }
  return out;
}

export function examScopeLabel(e: Exam, subjects: Subject[]): string {
  return e.scope
    .map((sc) => {
      const s = subjects.find((x) => x.id === sc.sid);
      if (!s) return '';
      const L = leaves(s);
      return sc.lids && sc.lids.length < L.length ? `${s.name} 일부(${sc.lids.length}단원)` : s.name;
    })
    .filter(Boolean)
    .join(', ');
}

export interface ExamPlan {
  pool: Note[];
  active: Note[];
  per: number;
  done: number;
  items: QueueItem[];
}

/** 시험까지 범위 오답을 두 바퀴 돌 수 있게 하루 몫을 나눈다 (최소 3문제). 약한 단원 개념 질문 최대 2개 */
export function examPlan(e: Exam, snap: Snapshot, today: Date = new Date()): ExamPlan {
  const t = ymd(today);
  const days = Math.max(1, dayDiff(e.date, today));
  const pool = examPool(e, snap.notes);
  const active = pool.filter((n) => !n.graduated);
  const doneIds = new Set(snap.reviews.filter((r) => r.d === t && r.ex === e.id).map((r) => r.nid));
  const per = Math.min(active.length, Math.max(3, Math.ceil((active.length * 2) / days)));
  const last = (n: Note) => (n.history.length ? n.history[n.history.length - 1].d : '');
  const order = active
    .filter((n) => !doneIds.has(n.id))
    .sort((a, b) => last(a).localeCompare(last(b)) || (a.srs.streak || 0) - (b.srs.streak || 0));
  const left = Math.max(0, per - doneIds.size);
  const th = snap.settings.conceptThreshold;
  const qd = new Set(snap.quizzes.filter((q) => q.d === t).map((q) => q.lid));
  const weak = examLeaves(e, snap.subjects)
    .map(({ s, l }) => ({ sid: s.id, lid: l.id, n: leafActive(snap.notes, s.id, l.id).length }))
    .filter((w) => w.n >= th && !qd.has(w.lid))
    .sort((a, b) => b.n - a.n)
    .slice(0, 2);
  return {
    pool,
    active,
    per,
    done: doneIds.size,
    items: [
      ...order.slice(0, left).map((n): QueueItem => ({ kind: 'note', noteId: n.id })),
      ...weak.map((w): QueueItem => ({ kind: 'concept', sid: w.sid, lid: w.lid })),
    ],
  };
}

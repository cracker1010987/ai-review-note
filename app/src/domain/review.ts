import { addDays, ymd } from './dates.ts';
import { isDue } from './srs.ts';
import { leafOf, leaves } from './subject.ts';
import type { Note, QueueItem, QuizLog, ReviewLog, Settings, Subject } from './types.ts';

/** 화면 계산에 필요한 데이터 묶음 */
export interface Snapshot {
  subjects: Subject[];
  notes: Note[];
  reviews: ReviewLog[];
  quizzes: QuizLog[];
  settings: Settings;
}

export const leafNotes = (notes: Note[], sid: string, lid: string) => notes.filter((n) => n.subjectId === sid && n.leafId === lid);
export const leafActive = (notes: Note[], sid: string, lid: string) => leafNotes(notes, sid, lid).filter((n) => !n.graduated);

export interface WeakLeaf {
  sid: string;
  lid: string;
  n: number;
  name: string;
  path: string;
}

/** 졸업 안 한 오답이 기준 이상 쌓인 단원, 많은 순 */
export function weakLeaves(subjects: Subject[], notes: Note[], threshold: number): WeakLeaf[] {
  const out: WeakLeaf[] = [];
  for (const s of subjects)
    for (const l of leaves(s)) {
      const n = leafActive(notes, s.id, l.id).length;
      if (n >= threshold) out.push({ sid: s.id, lid: l.id, n, name: l.name, path: `${s.name} › ${l.name}` });
    }
  return out.sort((a, b) => b.n - a.n);
}

/** 오늘 복습: 날짜가 된 오답(오래된 순, 하루 개수 제한) + 약한 단원 개념 질문 최대 2개 */
export function reviewQueue(snap: Snapshot, today: Date = new Date()): QueueItem[] {
  const t = ymd(today);
  const due: QueueItem[] = snap.notes
    .filter((n) => isDue(n, today))
    .sort((a, b) => a.srs.due.localeCompare(b.srs.due))
    .slice(0, snap.settings.reviewPerDay)
    .map((n) => ({ kind: 'note', noteId: n.id }));
  const done = new Set(snap.quizzes.filter((q) => q.d === t).map((q) => q.lid));
  const cq: QueueItem[] = weakLeaves(snap.subjects, snap.notes, snap.settings.conceptThreshold)
    .filter((w) => !done.has(w.lid))
    .slice(0, 2)
    .map((w) => ({ kind: 'concept', sid: w.sid, lid: w.lid }));
  return [...due, ...cq];
}

/** 무언가 한 날 (복습, 개념 질문, 오답 추가) */
export function activeDays(snap: Pick<Snapshot, 'reviews' | 'quizzes' | 'notes'>): Set<string> {
  return new Set([
    ...snap.reviews.map((r) => r.d),
    ...snap.quizzes.map((q) => q.d),
    ...snap.notes.map((n) => ymd(new Date(n.createdAt))),
  ]);
}

/** 연속 공부 일수. 오늘 아직 안 했으면 어제까지로 센다 */
export function streakDays(days: Set<string>, today: Date = new Date()): number {
  let d = days.has(ymd(today)) ? 0 : -1;
  let k = 0;
  while (days.has(addDays(d, today))) {
    k++;
    d--;
  }
  return k;
}

export interface WeekData {
  from: string;
  to: string;
  days: number;
  added: number;
  tags: [string, number][];
  leaves: [string, number][];
  types: string[];
  rv: number;
  rvOk: number;
  qz: number;
  qzOk: number;
  grad: number;
  due: number;
}

/** 최근 7일 기록 요약 (주간 리포트 재료) */
export function weekData(snap: Snapshot, today: Date = new Date()): WeekData {
  const from = addDays(-6, today);
  const to = ymd(today);
  const inW = (d: string) => d >= from && d <= to;
  const ns = snap.notes.filter((n) => inW(ymd(new Date(n.createdAt))));
  const cnt = (a: string[]): [string, number][] => {
    const m: Record<string, number> = {};
    a.forEach((x) => (m[x] = (m[x] || 0) + 1));
    return Object.entries(m).sort((x, y) => y[1] - x[1]);
  };
  const subj = new Map(snap.subjects.map((s) => [s.id, s]));
  const leafName = (n: Note) => leafOf(subj.get(n.subjectId), n.leafId)?.name || '단원 미지정';
  const rv = snap.reviews.filter((r) => inW(r.d));
  const qz = snap.quizzes.filter((q) => inW(q.d));
  const AD = activeDays(snap);
  return {
    from,
    to,
    days: [...Array(7)].filter((_, i) => AD.has(addDays(-i, today))).length,
    added: ns.length,
    tags: cnt(ns.flatMap((n) => n.tags)).slice(0, 6),
    leaves: cnt(ns.map(leafName)).slice(0, 6),
    types: [...new Set(ns.map((n) => n.type))],
    rv: rv.length,
    rvOk: rv.filter((r) => r.ok).length,
    qz: qz.length,
    qzOk: qz.filter((q) => q.ok).length,
    grad: snap.notes.filter((n) => n.graduated && inW(n.graduated)).length,
    due: reviewQueue(snap, today).length,
  };
}

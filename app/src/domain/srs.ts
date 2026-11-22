import { addDays, ymd } from './dates.ts';
import { INTERVALS } from './settings.ts';
import type { Note, Settings, Srs } from './types.ts';

export const isDue = (n: Pick<Note, 'graduated' | 'srs'>, today: Date = new Date()): boolean =>
  !n.graduated && n.srs.due <= ymd(today);

export const firstDue = (settings: Settings, today: Date = new Date()): string =>
  addDays((INTERVALS[settings.intervals] || INTERVALS.normal).d[0], today);

/**
 * 복습 결과를 반영한 새 복습 상태를 돌려준다.
 * 맞히면 간격이 늘고, 틀리면 다음 날. 연속 gradCount번 맞히면 졸업.
 */
export function applySrs(
  n: Pick<Note, 'srs' | 'graduated'>,
  ok: boolean,
  settings: Settings,
  today: Date = new Date(),
): { srs: Srs; graduated: string | null; justGraduated: boolean } {
  const d = (INTERVALS[settings.intervals] || INTERVALS.normal).d;
  const streak = ok ? (n.srs.streak || 0) + 1 : 0;
  let step: number;
  let due: string;
  if (ok) {
    step = Math.min((n.srs.step || 0) + 1, d.length - 1);
    due = addDays(d[step], today);
  } else {
    step = 0;
    due = addDays(1, today);
  }
  const justGraduated = ok && streak >= settings.gradCount && !n.graduated;
  return { srs: { step, due, streak }, graduated: justGraduated ? ymd(today) : n.graduated, justGraduated };
}

/** 졸업 취소: 내일부터 다시 복습 */
export const ungraduate = (today: Date = new Date()): { srs: Srs; graduated: null } => ({
  srs: { step: 0, due: addDays(1, today), streak: 0 },
  graduated: null,
});

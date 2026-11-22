import { arr, intOrNull } from '../lib/util.ts';
import type { Course, Note, SimLevel, Similar } from '../domain/types.ts';
import type { AI } from './client.ts';

/** 만든 문제의 답과 따로 다시 푼 답이 같은지 */
export function sameAnswer(p: Pick<Similar, 'choices' | 'answer' | 'answer_index'>, v: { answer?: unknown; answer_index?: unknown }): boolean {
  const norm = (s: unknown) =>
    String(s ?? '')
      .replace(/\\\(|\\\)|\$|\s|\\,|\\!/g, '')
      .toLowerCase();
  const vi = intOrNull(v.answer_index);
  if (p.choices.length && p.answer_index !== null && vi !== null) return p.answer_index === vi;
  return norm(p.answer) !== '' && norm(p.answer) === norm(v.answer);
}

/**
 * 유사문제를 만들고, 검산 모델이 따로 풀어 답이 같을 때만 돌려준다. 최대 두 번 시도.
 * 실패하면 빈 배열.
 */
export async function makeVerifiedSimilar(
  ai: AI,
  src: Pick<Note, 'problem' | 'choices' | 'answer' | 'steps'>,
  opts: { subjectName: string; level: SimLevel; course?: Pick<Course, 'name' | 'kind' | 'aiNote'> | null; onVerify?: () => void },
): Promise<Similar[]> {
  for (let t = 0; t < 2; t++) {
    const r = await ai.task('makeSimilar', { src, subjectName: opts.subjectName, level: opts.level }, { course: opts.course });
    const p: Similar = {
      text: String(r.text || ''),
      choices: arr(r.choices).map(String),
      answer: String(r.answer ?? ''),
      answer_index: intOrNull(r.answer_index),
      solution: String(r.solution || ''),
    };
    if (!p.text) continue;
    opts.onVerify?.();
    const v = await ai.task('verify', { p }, { course: opts.course });
    if (sameAnswer(p, v)) return [{ ...p, verified: true, level: opts.level }];
  }
  return [];
}

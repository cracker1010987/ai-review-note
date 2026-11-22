import { useSyncExternalStore } from 'react';
import { normalizeConcept } from '../ai/draft';
import type { Store } from '../data/store';
import { leaves } from '../domain/subject';
import type { Concept, Leaf, Subject } from '../domain/types';
import { tex } from '../ui/math/doc';

/** 단원 하나의 개념 정리를 AI로 만든다 */
export async function genConcept(store: Store, s: Subject, l: Leaf) {
  const course = store.get().courses.find((c) => c.id === s.courseId) || null;
  const r = await store.ai.task('summarizeConcepts', { s, l }, { course });
  const cp = normalizeConcept(r);
  if (!cp.summary && !cp.points.length) throw new Error('AI가 개념 정리를 비워서 보냈어요. 다시 시도해주세요.');
  await store.saveConcept(s.id, l.id, cp);
}

// ---------- 여러 단원 한꺼번에 (화면을 나가도 계속 진행)
export interface Bulk {
  sid: string;
  done: number;
  total: number;
  stop: boolean;
  err: string;
}
let bulk: Bulk | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export function useBulk(): Bulk | null {
  return useSyncExternalStore(subscribe, () => bulk);
}

export const stopBulk = () => {
  if (bulk) {
    bulk = { ...bulk, stop: true };
    emit();
  }
};

/** 개념 정리가 없는 단원만 차례로 만든다. 만든 개수를 돌려준다 */
export async function genAllConcepts(store: Store, sid: string): Promise<number> {
  if (bulk) throw new Error('이미 개념 정리를 만드는 중이에요.');
  const s = store.get().subjects.find((x) => x.id === sid);
  if (!s) return 0;
  const has = store.get().concepts;
  const todo = leaves(s).filter((l) => !has[`${sid}|${l.id}`]);
  if (!todo.length) return 0;
  bulk = { sid, done: 0, total: todo.length, stop: false, err: '' };
  emit();
  let n = 0;
  try {
    for (const l of todo) {
      if (bulk.stop) break;
      await genConcept(store, s, l);
      n++;
      bulk = { ...bulk, done: n };
      emit();
    }
  } finally {
    bulk = null;
    emit();
  }
  return n;
}

/** 개념 정리 → 수식 웹뷰에 넣을 HTML */
export function conceptHtml(cp: Concept): string {
  const list = (xs: string[], tag: 'ul' | 'ol', mark = false) =>
    `<${tag}>${xs.map((x) => `<li>${mark ? `<mark>${tex(x)}</mark>` : tex(x)}</li>`).join('')}</${tag}>`;
  return [
    cp.summary ? `<p class="lead">${tex(cp.summary)}</p>` : '',
    ...cp.points.map((p) => `<h4>${tex(p.title)}</h4><p>${tex(p.body)}</p>`),
    cp.formulas.length ? `<span class="lbl">꼭 외울 공식</span>${list(cp.formulas, 'ul')}` : '',
    cp.mistakes.length ? `<span class="lbl red">자주 하는 실수</span>${list(cp.mistakes, 'ul', true)}` : '',
    cp.check.length ? `<span class="lbl">스스로 점검</span>${list(cp.check, 'ol')}` : '',
  ].join('');
}

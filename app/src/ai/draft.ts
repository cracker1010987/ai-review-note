import { arr, escHtml, intOrNull } from '../lib/util.ts';
import { leafOf } from '../domain/subject.ts';
import type { Box, Concept, Subject } from '../domain/types.ts';

/** AI가 준 위치(퍼센트)를 사진 안쪽으로 맞춘다. 너무 작거나 이상하면 null */
export function validBox(f: unknown): Box | null {
  if (!f || typeof f !== 'object') return null;
  const o = f as Record<string, unknown>;
  const b = { x: +(o.x as number), y: +(o.y as number), w: +(o.w as number), h: +(o.h as number) };
  if (Object.values(b).some((v) => !isFinite(v)) || b.w < 3 || b.h < 3) return null;
  b.x = Math.max(0, Math.min(97, b.x));
  b.y = Math.max(0, Math.min(97, b.y));
  b.w = Math.min(b.w, 100 - b.x);
  b.h = Math.min(b.h, 100 - b.y);
  return b;
}

/** 사진 읽기 결과 */
export interface ReadResult {
  problem: string;
  choices: string[];
  figure: Box | null;
  mineIndex: number | null;
  uncertain: string[];
}

export function normalizeRead(r: Record<string, unknown>): ReadResult {
  const choices = arr(r.choices)
    .map((c) => String(c).trim())
    .filter(Boolean);
  const mi = intOrNull(r.mine_index);
  return {
    problem: String(r.problem || '').trim(),
    choices,
    figure: validBox(r.figure),
    mineIndex: mi !== null && mi < choices.length ? mi : null,
    uncertain: arr(r.uncertain)
      .map((x) => String(x).trim())
      .filter((x) => x && x.length <= 60)
      .slice(0, 6),
  };
}

/** 풀이 결과 + 확인된 문제 → 저장 전 초안 */
export interface Draft {
  problem: string;
  choices: string[];
  answer: string;
  answerIndex: number | null;
  mine: string;
  mineIndex: number | null;
  leafId: string | null;
  type: string;
  typeExisting: boolean;
  concepts: string[];
  steps: string[];
  key: string;
  mistake: string;
  figure: Box | null;
  /** AI가 추천한 오답 원인 (학생이 고른 것 제외) */
  suggest: string[];
}

export function draftFromAI(
  r: Record<string, unknown>,
  read: ReadResult,
  ctx: { subject: Subject | null; fallbackLeafId?: string | null; presets: string[]; picked: string[] },
): Draft {
  const choices = read.choices;
  const leafId = typeof r.leaf_id === 'string' && leafOf(ctx.subject, r.leaf_id) ? r.leaf_id : ctx.fallbackLeafId || null;
  const ai = intOrNull(r.answer_index);
  const mi = intOrNull(r.mine_index) ?? read.mineIndex;
  return {
    problem: read.problem,
    choices,
    answerIndex: ai !== null && ai < choices.length ? ai : null,
    answer: String(r.answer ?? (ai !== null ? choices[ai] : '') ?? ''),
    mineIndex: mi !== null && mi < choices.length ? mi : null,
    mine: r.mine == null ? '' : String(r.mine),
    leafId,
    type: String(r.type || '').trim(),
    typeExisting: !!r.type_is_existing,
    concepts: arr(r.concepts).map(String),
    steps: arr(r.steps).map(String),
    key: String(r.key || ''),
    mistake: String(r.mistake_point || ''),
    figure: read.figure,
    suggest: arr(r.suggested_tags)
      .map(String)
      .filter((t) => ctx.presets.includes(t) && !ctx.picked.includes(t)),
  };
}

export function normalizeConcept(r: Record<string, unknown>): Concept {
  return {
    summary: String(r.summary || ''),
    points: arr<Record<string, unknown>>(r.points)
      .map((p) => ({ title: String(p?.title || ''), body: String(p?.body || '') }))
      .filter((p) => p.title || p.body),
    formulas: arr(r.formulas).map(String),
    mistakes: arr(r.mistakes).map(String),
    check: arr(r.check).map(String),
  };
}

/** 목차 사진 결과 → 단원 트리 (id는 저장할 때 붙인다) */
export function normalizeToc(r: Record<string, unknown>): { subjectName: string; units: { name: string; subs: { name: string }[] }[] } {
  return {
    subjectName: String(r.subject_name || '').trim(),
    units: arr<Record<string, unknown>>(r.units)
      .map((u) => ({
        name: String(u?.name || '').trim(),
        subs: arr<Record<string, unknown>>(u?.subs)
          .map((x) => ({ name: String(x?.name || '').trim() }))
          .filter((x) => x.name),
      }))
      .filter((u) => u.name),
  };
}

/**
 * 자신 없는 조각을 표시한 HTML. 일반 글은 그 조각만, 수식 안이면 수식 전체를 감싼다.
 * 수식 렌더러(KaTeX)가 그 다음에 처리한다.
 */
export function markUnsureHTML(text: string, list: string[], cls = 'unsure'): string {
  const parts = String(text).split(/(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$]*\$)/);
  const marked = parts.map(() => false);
  const html = parts.map((x) => escHtml(x));
  for (const u of list || []) {
    const eu = escHtml(u);
    let done = false;
    for (let k = 0; k < parts.length && !done; k += 2) {
      if (html[k].includes(eu)) {
        html[k] = html[k].split(eu).join(`\u0001${eu}\u0002`);
        done = true;
      }
    }
    for (let k = 1; k < parts.length && !done; k += 2) {
      if (parts[k].includes(u)) {
        marked[k] = true;
        done = true;
      }
    }
  }
  return html
    .map((h, k) =>
      k % 2 ? (marked[k] ? `<mark class="${cls}">${h}</mark>` : h) : h.replace(/\u0001/g, `<mark class="${cls}">`).replace(/\u0002/g, '</mark>'),
    )
    .join('');
}

/** 수식 입력 도우미 버튼: [이름, 넣을 글, 넣은 뒤 커서 위치] */
export const SYMS: [string, string, number][] = [
  ['수식', '\\(  \\)', 3],
  ['분수', '\\frac{}{}', 6],
  ['제곱', '^{}', 2],
  ['아래첨자', '_{}', 2],
  ['√', '\\sqrt{}', 6],
  ['≤', '\\le ', 4],
  ['≥', '\\ge ', 4],
  ['≠', '\\ne ', 4],
  ['×', '\\times ', 7],
  ['÷', '\\div ', 5],
  ['π', '\\pi ', 4],
  ['±', '\\pm ', 4],
  ['°', '^{\\circ}', 8],
  ['θ', '\\theta ', 7],
];

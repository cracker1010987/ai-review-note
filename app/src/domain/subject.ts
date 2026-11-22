import type { Leaf, Note, Subject } from './types.ts';

/** 과목의 "가장 작은 단원" 목록. 소단원이 있으면 소단원, 없으면 대단원 자체 */
export function leaves(s: Subject | null | undefined): Leaf[] {
  const out: Leaf[] = [];
  if (!s) return out;
  for (const u of s.units) {
    if (u.subs.length) for (const sb of u.subs) out.push({ id: sb.id, name: sb.name, unitId: u.id, unitName: u.name, isUnit: false });
    else out.push({ id: u.id, name: u.name, unitId: u.id, unitName: u.name, isUnit: true });
  }
  return out;
}

export const leafOf = (s: Subject | null | undefined, lid: string | null | undefined): Leaf | null =>
  s && lid ? leaves(s).find((l) => l.id === lid) || null : null;

export const leafPath = (s: Subject, l: Leaf): string => `${s.name} > ${l.unitName}${l.isUnit ? '' : ' > ' + l.name}`;

export const metaLine = (n: Pick<Note, 'workbook' | 'page' | 'number'>): string =>
  [n.workbook, n.page ? `p.${n.page}` : '', n.number ? `${n.number}번` : ''].filter(Boolean).join(' ');

/** 오답 수 → 단원 지도 색 단계 (0~3) */
export const heatLevel = (n: number): 0 | 1 | 2 | 3 => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);

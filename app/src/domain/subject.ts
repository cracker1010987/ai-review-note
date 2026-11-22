import type { Leaf, Note, Subject, Unit } from './types.ts';

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

/** 목차 편집 화면에서 쓰는 단원 초안. id가 비어 있으면 새 단원 */
export interface DraftUnit {
  id: string;
  name: string;
  subs: { id: string; name: string }[];
}

/**
 * 편집한 목차 → 저장할 단원 트리.
 * 빈 이름은 버리고, 사진으로 다시 읽어 id가 없는 단원도 이름이 같으면 기존 id를 이어받아
 * 이미 모은 오답의 단원 연결이 끊기지 않게 한다.
 */
export function buildUnits(old: Subject | null | undefined, draft: DraftUnit[], newId: (prefix: string) => string): Unit[] {
  const byName = new Map<string, string>();
  if (old) {
    for (const l of leaves(old)) if (!byName.has('l:' + l.name)) byName.set('l:' + l.name, l.id);
    for (const u of old.units) if (!byName.has('u:' + u.name)) byName.set('u:' + u.name, u.id);
  }
  const used = new Set<string>();
  const pick = (id: string, key: string, prefix: string) => {
    let v = id || byName.get(key) || '';
    if (!v || used.has(v)) v = newId(prefix);
    used.add(v);
    return v;
  };
  return draft
    .filter((u) => u.name.trim())
    .map((u) => {
      const name = u.name.trim();
      const subs = u.subs
        .filter((x) => x.name.trim())
        .map((x) => ({ id: pick(x.id, 'l:' + x.name.trim(), 'l_'), name: x.name.trim() }));
      return { id: pick(u.id, 'u:' + name, 'u_'), name, subs };
    });
}

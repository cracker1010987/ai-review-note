import type { ProviderId, Settings, TierId } from '../domain/types.ts';
import type { Catalog } from './catalog.ts';
import { isProvider, PROVIDERS, TIER_IDS } from './providers.ts';

export const TASK_TIER: Record<string, TierId> = {
  readProblem: 'read',
  parseTOC: 'read',
  detectProblems: 'read',
  reviewMine: 'read',
  analyzeProblem: 'solve',
  makeSimilar: 'solve',
  conceptQuiz: 'solve',
  verify: 'verify',
  summarizeConcepts: 'write',
  gradeAnswer: 'write',
  weeklyReport: 'write',
};

export interface Route {
  p: ProviderId;
  m: string;
}

export const baseModel = (s: Settings, p: ProviderId) => (s.models[p] || '').trim() || PROVIDERS[p].model;
export const curModel = (s: Settings) => baseModel(s, s.provider);
const tierEmpty = (s: Settings, k: TierId) => !s.tiers[k]?.p && !(s.tiers[k]?.m || '').trim();

/**
 * 작업 → {회사, 모델}.
 * 비어 있으면 기본 회사·모델, 검산이 비어 있으면 수학 풀이 설정을 따른다.
 * 사진이 필요한데 OpenRouter 모델이 사진을 못 읽으면 사진 읽기 설정으로 돌린다.
 */
export function routeFor(s: Settings, tier: TierId, needImg = false, catalog?: Catalog): Route {
  const c = tier === 'verify' && tierEmpty(s, 'verify') ? s.tiers.solve : s.tiers[tier];
  const p = c && isProvider(c.p) ? c.p : s.provider;
  const m = (c?.m || '').trim() || baseModel(s, p);
  if (needImg && tier !== 'read' && p === 'openrouter' && catalog) {
    const i = catalog.orModel(m);
    if (i && !i.img) return routeFor(s, 'read', false, catalog);
  }
  return { p, m };
}

export const routeLabel = (r: Route) => `${PROVIDERS[r.p].short} · ${r.m}`;

/** 지금 설정에서 실제로 쓰이는 회사·모델 조합 (중복 제거) */
export function usedRoutes(s: Settings): Route[] {
  const seen = new Set<string>();
  const out: Route[] = [];
  for (const r of [{ p: s.provider, m: curModel(s) }, ...TIER_IDS.map((k) => routeFor(s, k))]) {
    const id = r.p + '|' + r.m;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(r);
    }
  }
  return out;
}

export const usedProviders = (s: Settings) => new Set(usedRoutes(s).map((r) => r.p));

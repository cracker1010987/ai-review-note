import type { Course, ProviderId, Settings, TierId } from '../domain/types.ts';
import type { Catalog } from './catalog.ts';
import { priceOf } from './catalog.ts';
import { fixLatex, parseJSON } from './json.ts';
import { PROVIDERS, TIERS } from './providers.ts';
import { baseModel, routeFor, TASK_TIER, usedRoutes, type Route } from './routing.ts';
import { systemPrompt, TASKS, type TaskArgs, type TaskName } from './tasks.ts';
import { callProvider, type CallOutput } from './transport.ts';

export interface UsageEvent {
  day: string;
  tier: TierId | null;
  provider: ProviderId;
  model: string;
  tokensIn: number;
  tokensOut: number;
  /** 비용(달러). 단가를 모르면 null */
  cost: number | null;
}

export interface AIDeps {
  getSettings: () => Settings;
  getKey: (p: ProviderId) => string;
  catalog?: Catalog;
  fetchFn?: typeof fetch;
  /** 호출마다 사용량을 기록한다 */
  onUsage?: (u: UsageEvent) => void;
  /** 이번 달 지금까지 쓴 비용(달러). 예산 확인용 */
  monthCost?: () => number;
  today?: () => string;
}

export interface JsonOpts {
  system: string;
  text: string;
  images?: string[];
  maxTokens?: number;
  tier?: TierId | null;
  provider?: ProviderId;
  model?: string;
}

export function createAI(deps: AIDeps) {
  const fetchFn = deps.fetchFn || fetch;

  async function raw(o: JsonOpts): Promise<string> {
    const s = deps.getSettings();
    const p = o.provider || s.provider;
    const model = o.model || baseModel(s, p);
    const key = (deps.getKey(p) || '').trim();
    if (!key)
      throw new Error(`${o.tier ? TIERS[o.tier].label + ' 작업에 쓰는 ' : ''}${PROVIDERS[p].short} API 키가 없어요. 설정 › API 키에서 넣어주세요.`);
    if (s.budget > 0 && deps.monthCost && deps.monthCost() >= s.budget)
      throw new Error(`이번 달 AI 예산($${s.budget})을 다 썼어요. 설정에서 예산을 늘리거나 다음 달에 써주세요.`);
    let jsonMode = false;
    if (p === 'openrouter' && deps.catalog) {
      const info = deps.catalog.orModel(model) || ((await deps.catalog.load()) && deps.catalog.orModel(model));
      if (info && !info.img && o.images?.length) throw new Error(`${model} 모델은 사진을 읽지 못해요. 설정에서 사진 입력을 지원하는 모델로 바꿔주세요.`);
      jsonMode = !!info?.json;
    }
    const res: CallOutput = await callProvider(
      { provider: p, key, model, system: o.system, text: o.text, images: o.images, maxTokens: o.maxTokens, jsonMode },
      fetchFn,
    );
    if (deps.onUsage) {
      const pr = priceOf(model, s, deps.catalog);
      const cost = typeof res.usage.cost === 'number' && isFinite(res.usage.cost) ? res.usage.cost : pr ? (res.usage.i * pr[0] + res.usage.o * pr[1]) / 1e6 : null;
      deps.onUsage({ day: deps.today ? deps.today() : new Date().toISOString().slice(0, 10), tier: o.tier || null, provider: p, model, tokensIn: res.usage.i, tokensOut: res.usage.o, cost });
    }
    return res.text;
  }

  /** JSON 응답을 받아 파싱한다. 형식이 깨지면 한 번 더 요청한다 */
  async function json<T = Record<string, unknown>>(o: JsonOpts): Promise<T> {
    for (let i = 0; ; i++) {
      const t = await raw(o);
      try {
        return fixLatex(parseJSON(t)) as T;
      } catch {
        if (i) throw new Error('AI 응답을 읽지 못했어요. 다시 시도해주세요.');
      }
    }
  }

  async function task<K extends TaskName, R = Record<string, any>>(
    name: K,
    args: TaskArgs[K],
    ctx?: { course?: Pick<Course, 'name' | 'kind' | 'aiNote'> | null },
  ): Promise<R> {
    const s = deps.getSettings();
    const b = TASKS[name](args);
    const tier = TASK_TIER[name] || 'solve';
    const r = routeFor(s, tier, (b.images || []).length > 0, deps.catalog);
    return json<R>({ system: systemPrompt(s.grade, ctx?.course), ...b, tier, provider: r.p, model: r.m });
  }

  /** 지금 설정에서 쓰이는 회사·모델을 하나씩 짧게 호출해 본다 */
  async function testRoutes(): Promise<{ route: Route; ok: boolean; msg: string }[]> {
    const out: { route: Route; ok: boolean; msg: string }[] = [];
    for (const r of usedRoutes(deps.getSettings())) {
      if (!(deps.getKey(r.p) || '').trim()) {
        out.push({ route: r, ok: false, msg: '키가 없어요' });
        continue;
      }
      try {
        await json({ system: '너는 연결 확인용 응답기다. JSON 객체 하나만 출력한다.', text: '{"ok":true} 를 그대로 출력해라.', maxTokens: 200, provider: r.p, model: r.m });
        out.push({ route: r, ok: true, msg: '' });
      } catch (e) {
        out.push({ route: r, ok: false, msg: (e as Error).message });
      }
    }
    return out;
  }

  /** 기본 회사 키가 있으면 AI를 쓸 수 있다 */
  const ready = () => !!(deps.getKey(deps.getSettings().provider) || '').trim();

  return { raw, json, task, testRoutes, ready };
}
export type AI = ReturnType<typeof createAI>;

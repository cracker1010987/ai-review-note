import { arr } from '../lib/util.ts';
import type { ProviderId, Settings } from '../domain/types.ts';
import { PRICE } from './providers.ts';

export interface CatalogModel {
  id: string;
  name: string;
  img: boolean;
  /** 100만 토큰당 달러 [입력, 출력] */
  price: [number, number];
  json?: boolean;
}

type FetchFn = typeof fetch;

const OR_URL = 'https://openrouter.ai/api/v1/models';
const OR_PREFIX: Partial<Record<ProviderId, string>> = { openai: 'openai/', claude: 'anthropic/', gemini: 'google/' };
const DIRECT_OK: Partial<Record<ProviderId, RegExp>> = { openai: /^(gpt-|o\d|chatgpt-)/, claude: /^claude-/, gemini: /^gemini-/ };

/** OpenRouter 이름 → 회사 직접 연결 이름 (Claude는 버전의 점을 하이픈으로: claude-haiku-5.5 → claude-haiku-5-5) */
export function toDirectId(p: ProviderId, orId: string): string {
  let x = orId.slice((OR_PREFIX[p] || '').length);
  if (p === 'claude') x = x.replace(/(\d+)\.(\d+)/g, '$1-$2');
  return x;
}

export function parseCatalog(j: unknown): CatalogModel[] {
  const data = arr<Record<string, unknown>>((j as { data?: unknown })?.data);
  return data
    .filter((m) => m && typeof m.id === 'string' && !/:batch$/.test(m.id as string))
    .map((m) => {
      const pr = (m.pricing || {}) as Record<string, string>;
      const arch = (m.architecture || {}) as { input_modalities?: unknown };
      return {
        id: m.id as string,
        name: String(m.name || m.id),
        img: arr(arch.input_modalities).includes('image'),
        price: [+(+pr.prompt * 1e6 || 0).toFixed(4), +(+pr.completion * 1e6 || 0).toFixed(4)] as [number, number],
        json: arr(m.supported_parameters).includes('response_format'),
      };
    });
}

/**
 * OpenRouter 공개 모델 목록(키 없이 받음) 하나로 모든 회사의 모델·가격·사진 지원 여부를 채운다.
 * 실패한 뒤에는 force 없이 다시 요청하지 않는다 (화면을 그릴 때마다 재요청하는 것을 막음).
 */
export function createCatalog(fetchFn: FetchFn = fetch) {
  const st = { list: null as CatalogModel[] | null, p: null as Promise<CatalogModel[] | null> | null, err: false, at: 0, tried: false };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((f) => f());

  function load(force = false): Promise<CatalogModel[] | null> {
    if (st.list && !force) return Promise.resolve(st.list);
    if (st.p) return st.p;
    if (st.tried && !force) return Promise.resolve(null);
    st.tried = true;
    const prev = st.list;
    st.p = fetchFn(OR_URL)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => {
        st.list = parseCatalog(j);
        st.err = false;
        st.at = Date.now();
        return st.list;
      })
      .catch(() => {
        st.err = true;
        st.list = prev;
        return null;
      })
      .finally(() => {
        st.p = null;
        emit();
      });
    emit();
    return st.p;
  }

  const orModel = (id: string) => (st.list && st.list.find((m) => m.id === id)) || null;

  function directList(p: ProviderId): CatalogModel[] | null {
    const pre = OR_PREFIX[p];
    const ok = DIRECT_OK[p];
    if (!st.list || !pre || !ok) return null;
    const seen = new Map<string, CatalogModel>();
    for (const m of st.list) {
      if (!m.id.startsWith(pre) || m.id.includes(':')) continue;
      const id = toDirectId(p, m.id);
      if (ok.test(id) && !seen.has(id)) seen.set(id, { ...m, id });
    }
    return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  const listOf = (p: ProviderId) => (p === 'openrouter' ? st.list : directList(p));

  /** 직접 연결 모델의 참고 단가: 목록에서 같은 모델을 찾는다 */
  function refPrice(m: string): [number, number] | null {
    if (!st.list || !m) return null;
    if (m.includes('/')) return orModel(m)?.price || null;
    const cands = [
      'openai/' + m,
      'google/' + m,
      'anthropic/' + m,
      'anthropic/' + m.replace(/-(\d+)-(\d+)(-\d{8})?$/, '-$1.$2'),
      'anthropic/' + m.replace(/-\d{8}$/, ''),
    ];
    for (const id of cands) {
      const i = orModel(id);
      if (i) return i.price;
    }
    return null;
  }

  return {
    state: st,
    load,
    orModel,
    directList,
    listOf,
    refPrice,
    subscribe(f: () => void) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
}
export type Catalog = ReturnType<typeof createCatalog>;

/** 사용자 단가 > 목록 단가 > 앱에 넣어둔 참고 단가 */
export const priceOf = (m: string, settings: Pick<Settings, 'prices'>, catalog?: Catalog): [number, number] | null =>
  settings.prices[m] || catalog?.refPrice(m) || PRICE[m] || null;

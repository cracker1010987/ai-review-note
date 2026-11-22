import type { ProviderId, TierId } from '../domain/types.ts';

export const PROVIDERS: Record<ProviderId, { label: string; short: string; model: string; hint: string; keyUrl: string }> = {
  openai: { label: 'OpenAI', short: 'GPT', model: 'gpt-5', hint: 'sk-로 시작하는 키', keyUrl: 'https://platform.openai.com/api-keys' },
  claude: { label: 'Anthropic', short: 'Claude', model: 'claude-sonnet-5-5', hint: 'sk-ant-로 시작하는 키', keyUrl: 'https://console.anthropic.com/settings/keys' },
  gemini: { label: 'Google', short: 'Gemini', model: 'gemini-2.5-flash', hint: 'AIza로 시작하는 키', keyUrl: 'https://aistudio.google.com/apikey' },
  openrouter: { label: 'OpenRouter', short: 'OpenRouter', model: 'openai/gpt-5', hint: 'sk-or-로 시작하는 키', keyUrl: 'https://openrouter.ai/keys' },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
export const isProvider = (p: unknown): p is ProviderId => typeof p === 'string' && p in PROVIDERS;

/** 모델 목록을 아직 못 받았을 때 보여줄 추천 */
export const MODEL_SUGGEST: Partial<Record<ProviderId, string[]>> = {
  openai: ['gpt-6.1-terra', 'gpt-6-luna', 'gpt-5'],
  claude: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'],
  gemini: ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.7-flash'],
};

/** 참고 단가 (100만 토큰당 달러, 2026-11 OpenRouter 목록 기준). 목록을 못 받았을 때만 쓴다 */
export const PRICE: Record<string, [number, number]> = {
  'gpt-5': [1.25, 10],
  'gpt-6-luna': [0.1, 0.5],
  'gpt-6.1-terra': [1.0, 5.0],
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2.0, 10.0],
  'claude-opus-5-5': [4.0, 20.0],
  'gemini-2.5-flash': [0.3, 2.5],
  'gemini-3.1-flash-lite': [0.25, 1.5],
  'gemini-3.7-flash': [0.75, 3.75],
};

export const TIERS: Record<TierId, { label: string; desc: string; img?: boolean }> = {
  read: { label: '사진 읽기', desc: '문제·목차 사진 옮기기, 한 페이지 문제 찾기, 내 풀이 첨삭', img: true },
  solve: { label: '수학 풀이', desc: '정답·풀이 만들기, 유사문제 만들기, 개념 질문' },
  verify: { label: '검산', desc: '유사문제를 따로 다시 풀어 확인해요. 만든 모델과 다른 회사 모델이면 더 믿을 만해요' },
  write: { label: '글쓰기', desc: '개념 정리, 서술형 채점, 주간 리포트' },
};
export const TIER_IDS = Object.keys(TIERS) as TierId[];

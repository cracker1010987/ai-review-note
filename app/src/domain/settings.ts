import type { IntervalId, KindId, Settings, TierId } from './types.ts';

export const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3', 'N수생'];

export const INTERVALS: Record<IntervalId, { label: string; d: number[] }> = {
  tight: { label: '촘촘하게 (1·2·4·7·14일)', d: [1, 2, 4, 7, 14] },
  normal: { label: '기본 (1·3·7·14·30일)', d: [1, 3, 7, 14, 30] },
  loose: { label: '느슨하게 (2·5·10·20·40일)', d: [2, 5, 10, 20, 40] },
};

/** 교과 종류별로 AI에게 주는 지시 */
export const KINDS: Record<KindId, { label: string; desc: string; guide: string }> = {
  math: {
    label: '수학형',
    desc: '수식 풀이와 계산이 중심',
    guide: '이 교과는 수학이다. 문제와 풀이의 모든 수식은 LaTeX로 쓴다. 풀이는 식 변형이 끊기지 않게 단계별로 쓰고, 계산 결과를 한 번 더 검산한다.',
  },
  science: {
    label: '과학형',
    desc: '그래프, 실험, 자료 해석이 중심',
    guide:
      "이 교과는 과학이다. 그래프, 표, 실험 장치 그림이 있으면 축 이름, 단위, 수치, 실험 조건을 먼저 읽고 문제 글 끝에 '자료:'로 시작하는 줄로 정리해 옮긴다. 보기(ㄱ, ㄴ, ㄷ)가 있으면 문제 글에 줄바꿈으로 함께 적는다. 풀이는 어떤 원리나 법칙을 근거로 판단했는지 밝히고, 단위와 부호를 확인한다. 물리량과 식은 LaTeX로 쓴다. 유사문제에 그림이 필요하면 자료를 표나 글로 바꿔 제시한다.",
  },
  general: {
    label: '일반형',
    desc: '개념 이해, 암기, 서술이 중심',
    guide: '이 교과는 개념 이해와 암기가 중심이다. 풀이는 정답의 근거가 되는 개념과, 학생이 고른 오답이 왜 틀렸는지를 짧게 정리한다. 수식이 없는 문제에는 LaTeX를 쓰지 않는다.',
  },
};

export const guessKind = (name: string): KindId =>
  /수학|산수|미적|기하|확률|대수/.test(name || '')
    ? 'math'
    : /과학|물리|화학|생명|생물|지구|천문/.test(name || '')
      ? 'science'
      : 'general';

const TIER_IDS: TierId[] = ['read', 'solve', 'verify', 'write'];

export function defaultSettings(): Settings {
  return {
    provider: 'openai',
    models: { openai: '', claude: '', gemini: '', openrouter: '' },
    tiers: { read: { p: '', m: '' }, solve: { p: '', m: '' }, verify: { p: '', m: '' }, write: { p: '', m: '' } },
    grade: '고1',
    reviewPerDay: 10,
    intervals: 'normal',
    conceptThreshold: 3,
    makeSimilar: true,
    simLevel: 'same',
    gradCount: 3,
    budget: 0,
    prices: {},
    krw: 1400,
    confirmRead: 'always',
    cover: false,
    tagPresets: ['계산 실수', '개념 부족', '문제 해석 실수', '조건 놓침', '시간 부족', '찍음'],
    workbooks: [],
  };
}

/** 서버에서 받은 설정(일부 빠졌거나 예전 형식일 수 있음)을 완전한 설정으로 만든다 */
export function normalizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const out: Settings = { ...d, ...s, models: { ...d.models, ...(s.models || {}) }, prices: { ...(s.prices || {}) } } as Settings;
  const tiers = (s.tiers && typeof s.tiers === 'object' ? s.tiers : {}) as Partial<Settings['tiers']>;
  out.tiers = {} as Settings['tiers'];
  for (const k of TIER_IDS) {
    const c = tiers[k];
    out.tiers[k] = { p: (c && c.p) || '', m: String((c && c.m) || '').trim() };
  }
  if (!INTERVALS[out.intervals]) out.intervals = 'normal';
  if (!Array.isArray(out.tagPresets)) out.tagPresets = d.tagPresets;
  if (!Array.isArray(out.workbooks)) out.workbooks = [];
  return out;
}

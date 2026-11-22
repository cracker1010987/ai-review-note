export type ProviderId = 'openai' | 'claude' | 'gemini' | 'openrouter';
export type TierId = 'read' | 'solve' | 'verify' | 'write';
export type KindId = 'math' | 'science' | 'general';
export type SimLevel = 'easy' | 'same' | 'hard';
export type IntervalId = 'tight' | 'normal' | 'loose';
export type ConfirmMode = 'always' | 'unsure' | 'never';

export interface TierCfg {
  /** 빈 문자열이면 기본 회사 */
  p: ProviderId | '';
  /** 빈 문자열이면 그 회사의 기본 모델 */
  m: string;
}

export interface Settings {
  provider: ProviderId;
  models: Record<ProviderId, string>;
  tiers: Record<TierId, TierCfg>;
  grade: string;
  reviewPerDay: number;
  intervals: IntervalId;
  conceptThreshold: number;
  makeSimilar: boolean;
  simLevel: SimLevel;
  gradCount: number;
  /** 월 예산(달러). 0이면 제한 없음 */
  budget: number;
  /** 사용자가 직접 넣은 단가 (100만 토큰당 달러, [입력, 출력]) */
  prices: Record<string, [number, number]>;
  krw: number;
  confirmRead: ConfirmMode;
  cover: boolean;
  tagPresets: string[];
  workbooks: string[];
}

export interface Course {
  id: string;
  name: string;
  color: string;
  kind: KindId;
  aiNote: string;
  sort?: number;
}

export interface UnitSub {
  id: string;
  name: string;
}
export interface Unit {
  id: string;
  name: string;
  subs: UnitSub[];
}
export interface Subject {
  id: string;
  courseId: string;
  name: string;
  units: Unit[];
  sort?: number;
}
export interface Leaf {
  id: string;
  name: string;
  unitId: string;
  unitName: string;
  isUnit: boolean;
}

export interface Concept {
  summary: string;
  points: { title: string; body: string }[];
  formulas: string[];
  mistakes: string[];
  check: string[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Srs {
  step: number;
  due: string;
  streak: number;
}

export interface Similar {
  text: string;
  choices: string[];
  answer: string;
  answer_index: number | null;
  solution: string;
  verified?: boolean;
  level?: SimLevel;
}

export interface HistoryItem {
  d: string;
  ok: boolean;
}

export interface Note {
  id: string;
  courseId: string;
  subjectId: string;
  leafId: string | null;
  type: string;
  tags: string[];
  workbook: string;
  page: string;
  number: string;
  problem: string;
  choices: string[];
  answer: string;
  answerIndex: number | null;
  mine: string;
  mineIndex: number | null;
  steps: string[];
  key: string;
  mistake: string;
  advice?: string;
  concepts: string[];
  figure: Box | null;
  showPhoto?: boolean;
  /** 스토리지 경로 */
  images: Partial<Record<'q' | 's' | 'mine' | 'fig', string>>;
  similar: Similar[];
  srs: Srs;
  graduated: string | null;
  createdAt: number;
  history: HistoryItem[];
}

export interface ReviewLog {
  d: string;
  ok: boolean;
  nid?: string;
  ex?: string;
}
export interface QuizLog {
  d: string;
  sid: string;
  lid: string;
  ok: boolean;
  q?: string;
}

export interface ExamScope {
  sid: string;
  /** null이면 과목 전체 */
  lids: string[] | null;
}
export interface Exam {
  id: string;
  name: string;
  date: string;
  courseId: string;
  scope: ExamScope[];
}

export type QueueItem =
  | { kind: 'note'; noteId: string; simIdx?: number }
  | { kind: 'concept'; sid: string; lid: string };

export const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const intOrNull = (v: unknown): number | null =>
  Number.isInteger(v) ? (v as number) : typeof v === 'string' && /^\d+$/.test(v) ? +v : null;

let uc = 0;
export const uid = (prefix = ''): string =>
  prefix + Date.now().toString(36) + (uc++).toString(36) + Math.random().toString(36).slice(2, 6);

export const lines = (v: unknown): string[] =>
  String(v ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 객관식 선지 번호 표시 */
export const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];

/** 교과 색 */
export const COLORS = ['#2747C9', '#D6303B', '#1E8C55', '#C27803', '#7B3FC4', '#0E7C86', '#5F6B85'];

export const escHtml = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** 날짜는 모두 기기 시간대 기준 'YYYY-MM-DD' 문자열로 다룬다 */
export function ymd(d: Date = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** s가 오늘로부터 며칠 뒤인지 (지난 날이면 음수) */
export function dayDiff(s: string, today: Date = new Date()): number {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  return Math.round((parseYmd(s).getTime() - t.getTime()) / 864e5);
}

export function dueLabel(s: string, today?: Date): string {
  const k = dayDiff(s, today);
  return k <= 0 ? '오늘' : k === 1 ? '내일' : `${k}일 뒤`;
}

export function agoLabel(ts: number, today?: Date): string {
  const k = -dayDiff(ymd(new Date(ts)), today);
  return k <= 0 ? '오늘' : k === 1 ? '어제' : `${k}일 전`;
}

export function ddayLabel(date: string, today?: Date): string {
  const k = dayDiff(date, today);
  return k === 0 ? 'D-DAY' : k > 0 ? `D-${k}` : `D+${-k}`;
}

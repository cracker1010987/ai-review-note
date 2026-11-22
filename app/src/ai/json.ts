/** AI 응답 글에서 JSON 객체 하나를 꺼낸다. 코드블록, 앞뒤 설명, 잘못 이스케이프된 백슬래시를 견딘다 */
export function parseJSON(text: string): unknown {
  let t = String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('no json');
  t = t.slice(a, b + 1);
  try {
    return JSON.parse(t);
  } catch {
    return JSON.parse(t.replace(/\\(?!["\\/bfnrtu])/g, '\\\\'));
  }
}

/** JSON 이스케이프를 빠뜨린 LaTeX(\frac → 폼피드 등)를 되살린다 */
export function fixLatex<T>(o: T): T {
  if (typeof o === 'string')
    return o
      .replace(/\f/g, '\\f')
      .replace(/\x08/g, '\\b')
      .replace(/\t(?=[a-zA-Z])/g, '\\t')
      .replace(/\r(?=[a-zA-Z])/g, '\\r')
      .replace(/\n(?=(?:eq|abla|ot|u|i|leq|geq|mid|exists|ewline|e)(?![a-zA-Z]))/g, '\\n') as T;
  if (Array.isArray(o)) return o.map(fixLatex) as T;
  if (o && typeof o === 'object') {
    for (const k in o) (o as Record<string, unknown>)[k] = fixLatex((o as Record<string, unknown>)[k]);
  }
  return o;
}

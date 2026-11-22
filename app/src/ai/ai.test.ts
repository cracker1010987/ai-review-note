/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../domain/settings.ts';
import type { ProviderId, Settings } from '../domain/types.ts';
import { createCatalog, parseCatalog, priceOf, toDirectId } from './catalog.ts';
import { createAI, type UsageEvent } from './client.ts';
import { draftFromAI, markUnsureHTML, normalizeRead, validBox } from './draft.ts';
import { fixLatex, parseJSON } from './json.ts';
import { routeFor, usedRoutes } from './routing.ts';
import { makeVerifiedSimilar, sameAnswer } from './similar.ts';
import { systemPrompt } from './tasks.ts';

// ---- 가짜 AI 서버: 회사별 응답 형식을 흉내 내고, 어떤 요청이 갔는지 기록한다
type Call = { prov: ProviderId; model: string; key: string; text: string; nimg: number; body: any };
function fakeServer(answer: (text: string, call: Call) => unknown, catalogData: unknown = { data: [] }) {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, opt: any = {}) => {
    url = String(url);
    if (url.includes('/api/v1/models')) return new Response(JSON.stringify(catalogData));
    const b = JSON.parse(opt.body);
    let c: Call;
    if (url.includes('api.openai.com') || url.includes('openrouter.ai')) {
      const content = b.messages[1].content;
      c = { prov: url.includes('openai.com') ? 'openai' : 'openrouter', model: b.model, key: opt.headers.Authorization, text: content[0].text, nimg: content.length - 1, body: b };
    } else if (url.includes('anthropic')) {
      const content = b.messages[0].content;
      c = { prov: 'claude', model: b.model, key: opt.headers['x-api-key'], text: content[content.length - 1].text, nimg: content.length - 1, body: b };
    } else {
      c = { prov: 'gemini', model: decodeURIComponent(url.split('/models/')[1].split(':')[0]), key: url.split('key=')[1], text: b.contents[0].parts[0].text, nimg: b.contents[0].parts.length - 1, body: b };
    }
    calls.push(c);
    const out = answer(c.text, c);
    const txt = typeof out === 'string' ? out : JSON.stringify(out);
    if (c.prov === 'claude') return new Response(JSON.stringify({ content: [{ type: 'text', text: txt }], usage: { input_tokens: 1000, output_tokens: 200 } }));
    if (c.prov === 'gemini') return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: txt }] } }], usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200 } }));
    return new Response(JSON.stringify({ choices: [{ message: { content: txt } }], usage: { prompt_tokens: 1000, completion_tokens: 200, ...(c.prov === 'openrouter' ? { cost: 0.0003 } : {}) } }));
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

const KEYS: Record<ProviderId, string> = { openai: 'sk-AAAA', claude: 'sk-ant-CCCC', gemini: 'AIzaGGGG', openrouter: 'sk-or-RRRR' };
const IMG = 'data:image/jpeg;base64,QUJD';

function setup(over: Partial<Settings> = {}, answer: (t: string) => unknown = () => ({ ok: true }), keys = KEYS, catalogData?: unknown) {
  const s: Settings = { ...defaultSettings(), ...over };
  const srv = fakeServer(answer, catalogData);
  const usage: UsageEvent[] = [];
  const catalog = createCatalog(srv.fetchFn);
  const ai = createAI({ getSettings: () => s, getKey: (p) => keys[p] || '', catalog, fetchFn: srv.fetchFn, onUsage: (u) => usage.push(u), today: () => '2026-11-22' });
  return { s, ai, usage, catalog, ...srv };
}

test('작업마다 정한 회사·모델·키로 요청한다', async () => {
  const { ai, calls, usage } = setup({
    provider: 'openai',
    tiers: { read: { p: 'claude', m: 'claude-haiku-5-5' }, solve: { p: 'openai', m: 'gpt-6-luna' }, verify: { p: 'gemini', m: '' }, write: { p: 'openrouter', m: 'openai/gpt-6-luna' } },
  });
  await ai.task('readProblem', { images: [IMG] });
  await ai.task('makeSimilar', { src: { problem: 'p', choices: [], answer: '1', steps: [] }, subjectName: '수학', level: 'same' });
  await ai.task('verify', { p: { text: 'q', choices: [] } });
  await ai.task('gradeAnswer', { q: 'q', model: 'm', student: 's' });
  assert.deepEqual(
    calls.map((c) => `${c.prov}:${c.model}:${c.key.slice(-4)}:${c.nimg}`),
    ['claude:claude-haiku-5-5:CCCC:1', 'openai:gpt-6-luna:AAAA:0', 'gemini:gemini-2.5-flash:GGGG:0', 'openrouter:openai/gpt-6-luna:RRRR:0'],
  );
  assert.deepEqual(usage.map((u) => u.tier), ['read', 'solve', 'verify', 'write']);
  assert.equal(usage[3].cost, 0.0003, 'OpenRouter는 응답의 실제 청구 금액을 쓴다');
  assert.ok(Math.abs((usage[0].cost as number) - (1000 * 0.1 + 200 * 0.5) / 1e6) < 1e-12, 'Claude는 참고 단가로 계산');
});

test('검산을 비워두면 수학 풀이 설정을 따른다, 사진을 못 읽는 OpenRouter 모델이면 사진 읽기로 돌린다', async () => {
  const s = { ...defaultSettings(), provider: 'openrouter' as const };
  s.tiers = { read: { p: '', m: 'anthropic/claude-haiku-5.5' }, solve: { p: '', m: 'deepseek/text-only' }, verify: { p: '', m: '' }, write: { p: '', m: '' } };
  const catalog = createCatalog((async () =>
    new Response(JSON.stringify({ data: [
      { id: 'deepseek/text-only', name: 'DS', architecture: { input_modalities: ['text'] }, pricing: { prompt: '0', completion: '0' } },
      { id: 'anthropic/claude-haiku-5.5', name: 'H', architecture: { input_modalities: ['text', 'image'] }, pricing: { prompt: '0.0000001', completion: '0.0000005' } },
    ] }))) as unknown as typeof fetch);
  await catalog.load();
  assert.deepEqual(routeFor(s, 'verify'), { p: 'openrouter', m: 'deepseek/text-only' });
  assert.deepEqual(routeFor(s, 'solve', true, catalog), { p: 'openrouter', m: 'anthropic/claude-haiku-5.5' });
  assert.equal(usedRoutes(s).length, 3);
});

test('키가 없으면 어느 작업인지 알려주고, 예산을 넘으면 막는다', async () => {
  const s = { ...defaultSettings(), tiers: { ...defaultSettings().tiers, verify: { p: 'gemini' as const, m: '' } } };
  const srv = fakeServer(() => ({ ok: true }));
  const ai = createAI({ getSettings: () => s, getKey: (p) => (p === 'gemini' ? '' : 'k'), fetchFn: srv.fetchFn });
  await assert.rejects(ai.task('verify', { p: { text: 'q', choices: [] } }), /검산 작업에 쓰는 Gemini API 키가 없어요/);
  const s2 = { ...defaultSettings(), budget: 5 };
  const ai2 = createAI({ getSettings: () => s2, getKey: () => 'k', fetchFn: srv.fetchFn, monthCost: () => 5.1 });
  await assert.rejects(ai2.task('gradeAnswer', { q: '', model: '', student: '' }), /예산/);
});

test('JSON이 깨지면 한 번 더 요청하고, 코드블록·잘못된 이스케이프를 견딘다', async () => {
  let n = 0;
  const { ai, calls } = setup({}, () => (n++ === 0 ? '설명만 있고 JSON 없음' : '```json\n{"a":"\\frac{1}{2}","b":[1]}\n```'));
  const r = await ai.task('gradeAnswer', { q: '', model: '', student: '' });
  assert.equal(calls.length, 2);
  assert.equal(r.a, '\\frac{1}{2}');
  assert.deepEqual(parseJSON('앞말 {"x":1} 뒷말'), { x: 1 });
  assert.equal(fixLatex('\frac{1}{2}'), '\\frac{1}{2}');
});

test('서버 오류를 알아듣기 쉬운 말로 바꾼다', async () => {
  const fetchFn = (async () => new Response(JSON.stringify({ error: { message: 'Incorrect API key' } }), { status: 401 })) as unknown as typeof fetch;
  const ai = createAI({ getSettings: defaultSettings, getKey: () => 'k', fetchFn });
  await assert.rejects(ai.task('gradeAnswer', { q: '', model: '', student: '' }), /API 키가 올바르지 않아요/);
});

test('OpenRouter 목록으로 회사별 모델·가격을 만든다', async () => {
  const data = { data: [
    { id: 'anthropic/claude-haiku-5.5', name: 'Haiku', architecture: { input_modalities: ['text', 'image'] }, pricing: { prompt: '0.0000001', completion: '0.0000005' } },
    { id: 'openai/gpt-6.1-terra', name: 'Terra', architecture: { input_modalities: ['text', 'image'] }, pricing: { prompt: '0.000001', completion: '0.000005' } },
    { id: 'openai/text-embedding-3', name: 'E', pricing: {} },
    { id: 'openai/gpt-6.1-terra:batch', name: 'B', pricing: {} },
  ] };
  assert.equal(toDirectId('claude', 'anthropic/claude-haiku-5.5'), 'claude-haiku-5-5');
  assert.equal(parseCatalog(data).length, 3, ':batch는 뺀다');
  const cat = createCatalog((async () => new Response(JSON.stringify(data))) as unknown as typeof fetch);
  await cat.load();
  assert.deepEqual(cat.directList('claude')?.map((m) => m.id), ['claude-haiku-5-5']);
  assert.deepEqual(cat.directList('openai')?.map((m) => m.id), ['gpt-6.1-terra'], '임베딩 모델은 뺀다');
  assert.deepEqual(priceOf('claude-haiku-5-5', { prices: {} }, cat), [0.1, 0.5]);
  assert.deepEqual(priceOf('gpt-6.1-terra', { prices: { 'gpt-6.1-terra': [9, 9] } }, cat), [9, 9], '사용자 단가가 우선');
});

test('목록 받기에 실패하면 예전 목록을 유지하고, 화면을 그릴 때마다 다시 요청하지 않는다', async () => {
  let n = 0;
  const cat = createCatalog((async () => {
    n++;
    if (n === 1) return new Response(JSON.stringify({ data: [{ id: 'openai/gpt-5', pricing: {} }] }));
    throw new Error('offline');
  }) as unknown as typeof fetch);
  await cat.load();
  assert.equal(await cat.load(true), null);
  assert.equal(cat.state.list?.length, 1);
  await cat.load();
  await cat.load();
  assert.equal(n, 2);
});

test('유사문제는 검산 답이 같을 때만 남기고, 다르면 한 번 더 만든다', async () => {
  let made = 0;
  const { ai, calls } = setup({}, (t) => {
    if (t.includes('새 문제')) return { text: `문제${++made}`, choices: ['1', '2', '3'], answer: '2', answer_index: 1, solution: 's' };
    return { answer: '2', answer_index: made === 1 ? 2 : 1 };
  });
  const sims = await makeVerifiedSimilar(ai, { problem: 'p', choices: ['1', '2', '3'], answer: '2', steps: [] }, { subjectName: '수학', level: 'hard' });
  assert.equal(calls.length, 4);
  assert.equal(sims.length, 1);
  assert.equal(sims[0].text, '문제2');
  assert.equal(sims[0].level, 'hard');
  assert.ok(sameAnswer({ choices: [], answer: '\\( 2x+3 \\)', answer_index: null }, { answer: '2x+3' }));
  assert.ok(!sameAnswer({ choices: [], answer: '', answer_index: null }, { answer: '' }));
});

test('사진 읽기 결과 정리와 초안 만들기', () => {
  const read = normalizeRead({ problem: ' 문제 ', choices: ['a', ' ', 'b'], mine_index: 5, uncertain: ['x', '', 'y'.repeat(70)], figure: { x: 99, y: 10, w: 50, h: 20 } });
  assert.deepEqual(read.choices, ['a', 'b']);
  assert.equal(read.mineIndex, null);
  assert.deepEqual(read.uncertain, ['x']);
  assert.deepEqual(read.figure, { x: 97, y: 10, w: 3, h: 20 });
  assert.equal(validBox({ x: 1, y: 1, w: 2, h: 50 }), null);
  const subject = { id: 's', courseId: 'c', name: '수학', units: [{ id: 'u1', name: '다항식', subs: [{ id: 'l1', name: '나머지정리' }] }] };
  const d = draftFromAI({ answer_index: '1', leaf_id: 'nope', steps: ['a'], suggested_tags: ['조건 놓침', '계산 실수', '없는 태그'] }, read, {
    subject,
    fallbackLeafId: 'l1',
    presets: ['조건 놓침', '계산 실수'],
    picked: ['계산 실수'],
  });
  assert.equal(d.answerIndex, 1);
  assert.equal(d.answer, 'b');
  assert.equal(d.leafId, 'l1', '목록에 없는 단원이면 원래 단원');
  assert.deepEqual(d.suggest, ['조건 놓침']);
});

test('자신 없는 부분 표시: 글은 조각만, 수식은 통째로', () => {
  assert.equal(markUnsureHTML('값이 \\(7\\)일 때 a<b', ['7', 'a<b']), '값이 <mark class="unsure">\\(7\\)</mark>일 때 <mark class="unsure">a&lt;b</mark>');
});

test('시스템 지시에 교과 성격과 학생 요청이 들어간다', () => {
  const t = systemPrompt('고2', { name: '물리', kind: 'science', aiNote: '단위 꼭 써줘' });
  assert.match(t, /고2 학생/);
  assert.match(t, /이 교과는 과학이다/);
  assert.match(t, /단위 꼭 써줘/);
  assert.match(t, /\\\( \\\)로 감싼다/);
});

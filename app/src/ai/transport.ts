import { arr } from '../lib/util.ts';
import type { ProviderId } from '../domain/types.ts';

export interface CallInput {
  provider: ProviderId;
  key: string;
  model: string;
  system: string;
  text: string;
  /** data:image/jpeg;base64,... */
  images?: string[];
  maxTokens?: number;
  /** OpenRouter: JSON 모드 지원 모델이면 true */
  jsonMode?: boolean;
}

export interface CallOutput {
  text: string;
  usage: { i: number; o: number; cost?: number };
}

/** 사람이 읽을 수 있는 오류 메시지 */
export function aiErr(status: number, j: unknown): string {
  const e = (j as { error?: { message?: string; status?: string } })?.error;
  const m = (e && (e.message || e.status)) || '';
  if (status === 401 || status === 403 || /api key/i.test(m)) return 'API 키가 올바르지 않아요. 설정에서 키를 확인해주세요.';
  if (status === 402) return '크레딧이 부족해요. 충전 상태를 확인해주세요.';
  if (/image/i.test(m) && /support|endpoint/i.test(m)) return '이 모델은 사진을 읽지 못해요. 설정에서 사진 입력을 지원하는 모델로 바꿔주세요.';
  if (status === 429) return '사용 한도를 넘었거나 크레딧이 부족해요. 잠시 뒤 다시 시도하거나 결제 상태를 확인해주세요.';
  if (status === 404 || (/model/i.test(m) && /not|exist|found/i.test(m))) return `모델 이름을 찾을 수 없어요. 설정에서 모델명을 확인해주세요. (${m})`;
  if (status >= 500) return 'AI 서버에 문제가 있어요. 잠시 뒤 다시 시도해주세요.';
  return `요청이 거절됐어요 (${status}). ${m}`;
}

const b64 = (d: string) => d.split(',')[1] || d;

/**
 * 각 AI 회사 API에 직접 요청한다 (사용자 키, BYOK).
 * 나중에 서버 대행 방식이 생기면 이 함수와 같은 모양의 다른 전송 함수를 쓰면 된다.
 */
export async function callProvider(input: CallInput, fetchFn: typeof fetch = fetch): Promise<CallOutput> {
  const { provider: p, key, model, system, text, images = [], maxTokens = 8000 } = input;
  let res: Response;
  try {
    if (p === 'openai' || p === 'openrouter') {
      const url = p === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [{ type: 'text', text }, ...images.map((d) => ({ type: 'image_url', image_url: { url: d } }))] },
        ],
      };
      if (p === 'openai') body.response_format = { type: 'json_object' };
      else {
        body.max_tokens = maxTokens;
        body.usage = { include: true };
        if (input.jsonMode) body.response_format = { type: 'json_object' };
      }
      res = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key, ...(p === 'openrouter' ? { 'X-Title': 'AI Odap Note' } : {}) },
        body: JSON.stringify(body),
      });
    } else if (p === 'claude') {
      res = await fetchFn('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: [...images.map((d) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64(d) } })), { type: 'text', text }] }],
        }),
      });
    } else {
      res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text }, ...images.map((d) => ({ inline_data: { mime_type: 'image/jpeg', data: b64(d) } }))] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
    }
  } catch {
    throw new Error('AI 서버에 연결하지 못했어요. 인터넷 연결을 확인해주세요.');
  }
  const j = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) throw new Error(aiErr(res.status, j));
  const U = j.usage || {};
  const G = j.usageMetadata || {};
  let usage: CallOutput['usage'];
  let out = '';
  if (p === 'openai' || p === 'openrouter') {
    usage = { i: U.prompt_tokens || 0, o: U.completion_tokens || 0, ...(p === 'openrouter' && typeof U.cost === 'number' ? { cost: U.cost } : {}) };
    out = j.choices?.[0]?.message?.content || '';
  } else if (p === 'claude') {
    usage = { i: (U.input_tokens || 0) + (U.cache_read_input_tokens || 0) + (U.cache_creation_input_tokens || 0), o: U.output_tokens || 0 };
    out = arr<{ type: string; text: string }>(j.content)
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
  } else {
    usage = { i: G.promptTokenCount || 0, o: (G.candidatesTokenCount || 0) + (G.thoughtsTokenCount || 0) };
    out = arr<{ text?: string }>(j.candidates?.[0]?.content?.parts)
      .map((x) => x.text || '')
      .join('');
  }
  if (!out) throw new Error('AI가 빈 응답을 보냈어요. 잠시 뒤 다시 시도해주세요.');
  return { text: out, usage };
}

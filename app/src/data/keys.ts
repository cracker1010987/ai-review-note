import * as SecureStore from 'expo-secure-store';
import type { ProviderId } from '../domain/types.ts';

/** API 키는 기기 보안 저장소에만 둔다 (백업 파일에도 들어가지 않음) */
const name = (p: ProviderId) => `apikey_${p}`;

export async function loadKeys(): Promise<Record<ProviderId, string>> {
  const out = { openai: '', claude: '', gemini: '', openrouter: '' } as Record<ProviderId, string>;
  for (const p of Object.keys(out) as ProviderId[]) out[p] = (await SecureStore.getItemAsync(name(p))) || '';
  return out;
}

export async function saveKey(p: ProviderId, key: string): Promise<void> {
  const v = key.trim();
  if (v) await SecureStore.setItemAsync(name(p), v);
  else await SecureStore.deleteItemAsync(name(p));
}

import * as Linking from 'expo-linking';
import { useState } from 'react';
import { View } from 'react-native';
import { PROVIDER_IDS, PROVIDERS } from '../ai/providers';
import { routeLabel } from '../ai/routing';
import { useData, useKeys, useStore } from '../data/StoreProvider';
import type { ProviderId } from '../domain/types';
import { Button, Field, Note, Seg, T } from '../ui/kit';

/** 기본 AI 회사 고르기 + 키 입력 + 연결 테스트 (온보딩과 설정에서 같이 씀) */
export function AiConnect({ onConnected }: { onConnected?: () => void }) {
  const store = useStore();
  const { settings } = useData();
  const keys = useKeys();
  const p = settings.provider;
  const P = PROVIDERS[p];
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [test, setTest] = useState<{ busy?: boolean; ok?: boolean; msg?: string } | null>(null);
  const value = draft[p] ?? keys[p] ?? '';

  async function runTest() {
    if (draft[p] !== undefined) await store.setKey(p, draft[p]);
    setTest({ busy: true });
    const res = await store.ai.testRoutes();
    const bad = res.filter((r) => !r.ok);
    setTest({
      ok: !bad.length,
      msg: bad.length ? bad.map((r) => `✕ ${routeLabel(r.route)}: ${r.msg}`).join('\n') : `연결됐어요. ${res.map((r) => routeLabel(r.route)).join(', ')}`,
    });
    if (!bad.length) onConnected?.();
  }

  return (
    <View>
      <T v="label" style={{ marginBottom: 6 }}>
        AI 회사
      </T>
      <Seg<ProviderId>
        items={PROVIDER_IDS.map((k) => [k, PROVIDERS[k].short + (keys[k] ? ' ✓' : '')])}
        value={p}
        onChange={(k) => {
          setTest(null);
          void store.updateSettings({ provider: k });
        }}
      />
      <View style={{ height: 12 }} />
      <Field
        label={`${P.label} API 키`}
        value={value}
        onChangeText={(t) => {
          setTest(null);
          setDraft({ ...draft, [p]: t });
        }}
        onEndEditing={() => draft[p] !== undefined && store.setKey(p, draft[p])}
        placeholder={P.hint}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        hint={
          <Button kind="link" title={`${P.label}에서 키 발급받기 ›`} onPress={() => Linking.openURL(P.keyUrl)} style={{ alignSelf: 'flex-start' }} />
        }
      />
      <Button kind="ghost" title={test?.busy ? '확인하는 중…' : '연결 테스트'} busy={test?.busy} disabled={!value.trim()} onPress={runTest} />
      {test && !test.busy && <Note kind={test.ok ? 'ok' : 'bad'}>{test.msg}</Note>}
      <T v="caption" muted style={{ marginTop: 8 }}>
        키는 이 기기의 보안 저장소에만 저장되고, 고른 AI 회사로만 보내져요. 백업 파일에는 들어가지 않아요.
      </T>
    </View>
  );
}

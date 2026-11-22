import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useData, useStore } from '../data/StoreProvider';
import { GRADES } from '../domain/settings';
import { AiConnect } from '../features/AiConnect';
import { Button, Card, Chip, Screen, T } from '../ui/kit';
import { useColors } from '../ui/theme';

/** 처음 실행: 소개 → 학년 → AI 연결 */
export default function Onboarding() {
  const store = useStore();
  const { settings } = useData();
  const c = useColors();
  const [step, setStep] = useState(0);
  const [connected, setConnected] = useState(false);

  async function finish() {
    await store.updateMeta({ onboarded: true });
    router.replace('/');
  }

  if (step === 0)
    return (
      <Screen footer={<Button title="시작하기" onPress={() => setStep(1)} />}>
        <View style={{ paddingTop: 40 }}>
          <T v="title">AI 오답노트</T>
          <T muted style={{ marginTop: 8 }}>
            틀린 문제를 찍으면 AI가 문제를 옮겨 적고, 풀이와 단원을 정리하고, 잊어버릴 때쯤 다시 풀게 해줘요.
          </T>
        </View>
        <View style={{ marginTop: 28, gap: 10 }}>
          {[
            ['1', '사진 찍기', '틀린 문제를 찍으면 AI가 문제와 수식을 옮겨 적어요. 잘못 읽은 곳은 바로 고칠 수 있어요.'],
            ['2', '정리', '정답, 풀이, 단원, 유형, 틀린 이유를 한 장으로 정리해요.'],
            ['3', '복습', '맞히면 복습 간격이 늘고, 틀리면 다음 날 다시 나와요. 비슷한 새 문제로도 풀어요.'],
          ].map(([n, t, d]) => (
            <Card key={n} style={{ flexDirection: 'row', gap: 12 }}>
              <T v="h2" color={c.blue}>
                {n}
              </T>
              <View style={{ flex: 1 }}>
                <T v="h3">{t}</T>
                <T v="small" muted>
                  {d}
                </T>
              </View>
            </Card>
          ))}
        </View>
        <T v="caption" muted style={{ marginTop: 12 }}>
          모든 데이터는 이 폰에만 저장돼요. 설정에서 백업 파일로 내보낼 수 있어요.
        </T>
      </Screen>
    );

  if (step === 1)
    return (
      <Screen title="학년" footer={<Button title="다음" onPress={() => setStep(2)} />}>
        <T muted style={{ marginBottom: 14 }}>
          설명 수준과 비슷한 문제 난이도를 학년에 맞춰요. 나중에 설정에서 바꿀 수 있어요.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GRADES.map((g) => (
            <Chip key={g} label={g} on={settings.grade === g} onPress={() => store.updateSettings({ grade: g })} />
          ))}
        </View>
      </Screen>
    );

  return (
    <Screen
      title="AI 연결"
      footer={
        <View style={{ gap: 6 }}>
          <Button title={connected ? '시작하기' : '연결하고 시작하기'} disabled={!connected} onPress={finish} />
          <Button kind="link" title="나중에 연결할게요" onPress={finish} />
        </View>
      }
    >
      <T muted style={{ marginBottom: 14 }}>
        이 앱은 내 API 키로 AI를 불러요. 쓰는 만큼만 AI 회사에 직접 요금이 나가요. GPT, Claude, Gemini, OpenRouter 중 하나만 있으면 돼요.
      </T>
      <Card>
        <AiConnect onConnected={() => setConnected(true)} />
      </Card>
    </Screen>
  );
}

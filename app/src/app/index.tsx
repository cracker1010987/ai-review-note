import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { useData } from '../data/StoreProvider';
import { Button, Card, Screen, T } from '../ui/kit';

export default function Home() {
  const { meta, notes, courses } = useData();
  if (!meta.onboarded) return <Redirect href="/onboarding" />;
  return (
    <Screen title="AI 오답노트">
      <Card>
        <T v="h3">화면을 만드는 중이에요</T>
        <T v="small" muted style={{ marginTop: 4 }}>
          교과 {courses.length}개 · 오답 {notes.length}개가 이 폰에 저장돼 있어요.
        </T>
      </Card>
      <View style={{ gap: 8 }}>
        <Button kind="ghost" title="설정" onPress={() => router.push('/settings')} />
      </View>
    </Screen>
  );
}

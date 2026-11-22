import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useData, useKeys, useStore } from '../data/StoreProvider';
import { exportBackup } from '../data/backup-io';
import { addDays, dayDiff, ymd } from '../domain/dates';
import { activeDays, streakDays } from '../domain/review';
import { isDue } from '../domain/srs';
import { CourseSheet } from '../features/CourseSheet';
import { Button, Card, Icon, IconBtn, Screen, T, toast } from '../ui/kit';
import { radius, useColors } from '../ui/theme';

/** 백업 안내: 오답이 5개 이상인데 백업한 지 14일이 넘었거나 한 번도 안 했을 때 */
function backupDue(lastBackup: string, snooze: string, notes: number) {
  if (notes < 5) return null;
  if (snooze && dayDiff(snooze) > 0) return null;
  if (!lastBackup) return { never: true, days: 0 };
  const days = -dayDiff(lastBackup);
  return days >= 14 ? { never: false, days } : null;
}

export default function Home() {
  const store = useStore();
  const d = useData();
  const keys = useKeys();
  const aiReady = !!(keys[d.settings.provider] || '').trim();
  const c = useColors();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!d.meta.onboarded) return <Redirect href="/onboarding" />;

  const streak = streakDays(activeDays(d));
  const bk = backupDue(d.meta.lastBackup, d.meta.backupSnooze, d.notes.length);

  async function backupNow() {
    setBusy(true);
    try {
      await exportBackup(store.db, store.images);
      await store.updateMeta({ lastBackup: ymd(), backupSnooze: '' });
    } catch (e) {
      toast((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <Screen title="AI 오답노트" right={<IconBtn name="settings" label="설정" onPress={() => router.push('/settings')} />}>
      {!aiReady && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: c.hl, borderRadius: radius.md, padding: 12, marginBottom: 14 }}>
          <Icon name="key" size={20} />
          <T v="small" style={{ flex: 1 }}>
            AI가 아직 연결되지 않았어요. 설정에서 API 키를 넣으면 사진 읽기와 풀이를 쓸 수 있어요.
          </T>
          <Icon name="chevron-right" size={20} />
        </Pressable>
      )}
      {bk && (
        <Card style={{ backgroundColor: c.blueSoft, borderColor: c.blueSoft }}>
          <T v="h3">{bk.never ? '아직 백업한 적이 없어요' : `백업한 지 ${bk.days}일 지났어요`}</T>
          <T v="small" muted style={{ marginTop: 4 }}>
            폰을 잃어버리거나 앱을 지우면 오답이 사라져요. 파일로 한 번 저장해둬요.
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button title="지금 백업" busy={busy} onPress={backupNow} style={{ flex: 1 }} />
            <Button kind="ghost" title="7일 뒤에" onPress={() => store.updateMeta({ backupSnooze: addDays(7) })} style={{ flex: 1 }} />
          </View>
        </Card>
      )}

      <T v="title" style={{ marginTop: 4 }}>
        어떤 교과를 볼까요?
      </T>
      <T v="small" muted style={{ marginTop: 2, marginBottom: 16 }}>
        교과를 누르면 과목과 오답이 나와요.
        {streak ? <T v="small" color={c.blue}>{` · 연속 ${streak}일째 공부 중`}</T> : null}
      </T>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {d.courses.map((co) => {
          const subs = d.subjects.filter((s) => s.courseId === co.id).length;
          const ns = d.notes.filter((n) => n.courseId === co.id);
          const due = ns.filter((n) => isDue(n)).length;
          return (
            <Pressable
              key={co.id}
              accessibilityRole="button"
              accessibilityLabel={`${co.name} 교과, 과목 ${subs}개, 오답 ${ns.length}개${due ? `, 복습 ${due}개` : ''}`}
              onPress={() => router.push({ pathname: '/course/[id]', params: { id: co.id } })}
              style={({ pressed }) => [
                { width: '48.5%', minHeight: 124, backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderTopWidth: 4, borderTopColor: co.color, borderRadius: radius.md, padding: 12, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: co.color, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <T v="h2" color="#fff">
                  {co.name.slice(0, 1)}
                </T>
              </View>
              <T v="h3" numberOfLines={2}>
                {co.name}
              </T>
              <T v="caption" muted>
                과목 {subs} · 오답 {ns.length}
              </T>
              {due ? (
                <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: c.redSoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}>
                  <T v="caption" color={c.red} style={{ fontWeight: '600' }}>
                    복습 {due}
                  </T>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSheet(true)}
          style={({ pressed }) => ({ width: '48.5%', minHeight: 124, borderColor: c.line, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon name="add" size={30} color={c.blue} />
          <T v="label" muted>
            교과 추가
          </T>
        </Pressable>
      </View>

      {!d.courses.length && (
        <T v="small" muted style={{ marginTop: 16 }}>
          먼저 수학, 과학처럼 교과를 만들어요. 교과 안에 과목(교과서·문제집)을 넣고, 틀린 문제를 모아요.
        </T>
      )}
      <CourseSheet open={sheet} onClose={() => setSheet(false)} />
    </Screen>
  );
}

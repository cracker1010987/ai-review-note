import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useData, useStore } from '../../data/StoreProvider';
import { heatLevel, leaves } from '../../domain/subject';
import { genAllConcepts, stopBulk, useBulk } from '../../features/concepts';
import { Button, Card, confirm, Empty, IconBtn, MenuItem, Screen, Sheet, Stats, T, toast } from '../../ui/kit';
import { radius, useColors } from '../../ui/theme';

export default function SubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const d = useData();
  const c = useColors();
  const bulk = useBulk();
  const [menu, setMenu] = useState(false);
  const s = d.subjects.find((x) => x.id === id);

  async function runAll(ask: boolean) {
    setMenu(false);
    const cur = store.get();
    const sub = cur.subjects.find((x) => x.id === id);
    if (!sub) return;
    const todo = leaves(sub).filter((l) => !cur.concepts[`${sub.id}|${l.id}`]).length;
    if (!todo) return toast('모든 단원에 개념 정리가 있어요');
    if (!store.ai.ready()) return toast('설정에서 AI를 먼저 연결해주세요');
    const go = async () => {
      try {
        const n = await genAllConcepts(store, sub.id);
        if (n) toast(`개념 정리 ${n}개를 만들었어요`);
      } catch (e) {
        Alert.alert('개념 정리를 다 만들지 못했어요', (e as Error).message);
      }
    };
    if (ask) Alert.alert('개념 정리 만들기', `개념 정리가 없는 단원 ${todo}개를 차례로 만들어요. AI를 ${todo}번 불러요.`, [{ text: '취소', style: 'cancel' }, { text: '만들기', onPress: go }]);
    else void go();
  }

  if (!s)
    return (
      <Screen title="과목" back>
        <Empty title="과목을 찾을 수 없어요" action="홈으로" onAction={() => router.dismissTo('/')} />
      </Screen>
    );

  const co = d.courses.find((x) => x.id === s.courseId);
  const L = leaves(s);
  const ns = d.notes.filter((n) => n.subjectId === s.id);
  const cnt = (lid: string) => ns.filter((n) => n.leafId === lid).length;
  const hasC = (lid: string) => !!d.concepts[`${s.id}|${lid}`];
  const th = d.settings.conceptThreshold;
  const withErr = L.filter((l) => cnt(l.id)).length;
  const withC = L.filter((l) => hasC(l.id)).length;
  const orphan = ns.filter((n) => !L.some((l) => l.id === n.leafId)).length;
  const weak = L.filter((l) => cnt(l.id) >= th).sort((a, b) => cnt(b.id) - cnt(a.id))[0];
  const myBulk = bulk && bulk.sid === s.id ? bulk : null;
  const editToc = () => {
    setMenu(false);
    router.push({ pathname: '/toc', params: { courseId: s.courseId, subjectId: s.id } });
  };
  const openLeaf = (lid: string) => router.push({ pathname: '/leaf', params: { sid: s.id, lid } });

  function remove() {
    setMenu(false);
    confirm('과목 삭제', `'${s!.name}' 과목과 오답 ${ns.length}개를 지울까요? 되돌릴 수 없어요.`, '삭제', async () => {
      router.back();
      await store.removeSubject(s!.id);
      toast('과목을 지웠어요');
    });
  }

  return (
    <Screen title={s.name} sub={co?.name} back right={<IconBtn name="more-vert" label="과목 메뉴" onPress={() => setMenu(true)} />}>
      {!L.length ? (
        <Empty
          title="단원 목차가 비어 있어요"
          body="목차 사진을 찍으면 AI가 대단원과 소단원을 채워줘요. 단원이 있어야 오답을 단원별로 모으고 개념 정리를 만들 수 있어요."
          action="단원 목차 채우기"
          onAction={editToc}
        />
      ) : (
        <>
          <Stats
            items={[
              [ns.length, '모은 오답'],
              [`${withErr}/${L.length}`, '오답 있는 단원'],
              [`${withC}/${L.length}`, '개념 정리'],
            ]}
          />
          {myBulk ? (
            <Card>
              <T v="h3">
                개념 정리 만드는 중 {myBulk.done}/{myBulk.total}
              </T>
              <View style={{ height: 6, backgroundColor: c.grid, borderRadius: 3, marginVertical: 10, overflow: 'hidden' }}>
                <View style={{ width: `${(myBulk.done / myBulk.total) * 100}%`, height: 6, backgroundColor: c.blue }} />
              </View>
              <Button
                kind="link"
                title={myBulk.stop ? '지금 단원까지 만들고 멈춰요' : '멈추기'}
                disabled={myBulk.stop}
                onPress={stopBulk}
                style={{ alignSelf: 'flex-start' }}
              />
            </Card>
          ) : withC < L.length ? (
            <Button kind="ghost" title={`남은 단원 ${L.length - withC}개 개념 정리 만들기`} onPress={() => runAll(true)} style={{ marginBottom: 12 }} />
          ) : null}
          {weak && (
            <Card style={{ backgroundColor: c.hl, borderColor: 'transparent' }}>
              <T v="label">개념부터 점검해볼 단원</T>
              <T v="small" style={{ marginTop: 2 }}>
                {weak.name}에서 {cnt(weak.id)}문제 틀렸어요.
              </T>
              <Button kind="link" title="개념 정리 보기" style={{ alignSelf: 'flex-start', marginTop: 4 }} onPress={() => openLeaf(weak.id)} />
            </Card>
          )}

          {s.units.map((u) => {
            const ul = u.subs.length ? u.subs : [u];
            const un = ul.reduce((a, l) => a + cnt(l.id), 0);
            return (
              <View key={u.id} style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
                  <T v="h3" style={{ flex: 1 }}>
                    {u.name}
                  </T>
                  <T v="caption" muted>
                    {un ? `${un}문제` : '오답 없음'}
                  </T>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {ul.map((l) => {
                    const n = cnt(l.id);
                    const lv = heatLevel(n);
                    return (
                      <Pressable
                        key={l.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${l.name} 오답 ${n}문제${hasC(l.id) ? ', 개념 정리 있음' : ''}`}
                        onPress={() => openLeaf(l.id)}
                        style={({ pressed }) => ({
                          width: '23.6%',
                          minHeight: 72,
                          borderRadius: radius.sm,
                          borderWidth: 1,
                          borderColor: lv ? 'transparent' : c.line,
                          backgroundColor: c.heat[lv],
                          padding: 6,
                          justifyContent: 'space-between',
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <T v="caption" color={c.heatInk[lv]} numberOfLines={3} style={{ fontSize: 11, lineHeight: 14 }}>
                          {l.name}
                        </T>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          {hasC(l.id) && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: lv === 3 ? c.heatInk[3] : c.blue }} />}
                          <T v="h3" color={c.heatInk[lv]}>
                            {n}
                          </T>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.blue }} />
            <T v="caption" muted>
              개념 정리 있음 · 오답 수
            </T>
            {(['0', '1', '2~3', '4+'] as const).map((t, i) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: c.heat[i], borderWidth: i ? 0 : 1, borderColor: c.line }} />
                <T v="caption" muted>
                  {t}
                </T>
              </View>
            ))}
          </View>
          {orphan > 0 && (
            <Card style={{ marginTop: 14 }}>
              <T v="small">단원이 지정되지 않은 오답이 {orphan}개 있어요. 오답을 열어 단원을 골라주세요.</T>
            </Card>
          )}
          <T v="caption" muted style={{ marginTop: 12 }}>
            단원을 누르면 개념 정리와 그 단원의 오답을 볼 수 있어요.
          </T>
        </>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={s.name}>
        <MenuItem icon="edit" title="목차 편집" sub="과목 이름과 단원을 고치거나 사진으로 다시 읽어요" onPress={editToc} />
        <MenuItem icon="auto-awesome" title="모든 단원 개념 정리 만들기" sub="아직 정리가 없는 단원만 만들어요" onPress={() => runAll(true)} />
        <MenuItem icon="delete-outline" title="과목 삭제" sub="이 과목의 오답도 함께 지워져요" danger onPress={remove} />
      </Sheet>
    </Screen>
  );
}

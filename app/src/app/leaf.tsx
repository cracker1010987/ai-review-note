import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useData, useStore } from '../data/StoreProvider';
import { agoLabel } from '../domain/dates';
import { leafNotes } from '../domain/review';
import { leafOf } from '../domain/subject';
import { conceptHtml, genConcept } from '../features/concepts';
import { NoteRow } from '../features/NoteRow';
import { Button, Card, Empty, Note, Screen, Seg, T, toast } from '../ui/kit';
import { MathView } from '../ui/math/MathView';
import { useColors } from '../ui/theme';

export default function LeafScreen() {
  const { sid, lid } = useLocalSearchParams<{ sid: string; lid: string }>();
  const store = useStore();
  const d = useData();
  const c = useColors();
  const [tab, setTab] = useState<'concept' | 'notes'>('concept');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const s = d.subjects.find((x) => x.id === sid);
  const lf = leafOf(s, lid);
  if (!s || !lf)
    return (
      <Screen title="단원" back>
        <Empty title="단원을 찾을 수 없어요" body="목차를 고치면서 단원이 빠졌을 수 있어요." action="홈으로" onAction={() => router.dismissTo('/')} />
      </Screen>
    );

  const co = d.courses.find((x) => x.id === s.courseId);
  const ns = leafNotes(d.notes, s.id, lf.id);
  const cp = d.concepts[`${s.id}|${lf.id}`];
  const th = d.settings.conceptThreshold;

  async function make() {
    if (!store.ai.ready()) return toast('설정에서 AI를 먼저 연결해주세요');
    setBusy(true);
    setErr('');
    try {
      await genConcept(store, s!, lf!);
      toast('개념 정리를 만들었어요');
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  const types = Object.entries(
    ns.reduce<Record<string, number>>((a, n) => {
      a[n.type || '기타'] = (a[n.type || '기타'] || 0) + 1;
      return a;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <Screen title={lf.name} sub={[co?.name, s.name, lf.isUnit ? '' : lf.unitName].filter(Boolean).join(' › ')} back>
      {ns.length >= th && (
        <Card style={{ backgroundColor: c.hl, borderColor: 'transparent' }}>
          <T v="label">오답이 {ns.length}개 쌓였어요</T>
          <T v="small" style={{ marginTop: 2 }}>
            문제만 다시 풀기보다 개념부터 점검해보세요.
          </T>
        </Card>
      )}
      <View style={{ marginBottom: 14 }}>
        <Seg
          items={[
            ['concept', '개념 정리'],
            ['notes', `오답 ${ns.length}`],
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'concept' ? (
        busy ? (
          <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
            <ActivityIndicator color={c.blue} />
            <T v="small" muted style={{ marginTop: 10 }}>
              개념을 정리하는 중이에요. 10~20초쯤 걸려요.
            </T>
          </Card>
        ) : cp ? (
          <>
            <Card>
              <MathView html={conceptHtml(cp)} />
            </Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <T v="caption" muted>
                {agoLabel(cp.at)} 만듦 ·
              </T>
              <Button kind="link" title="다시 만들기" onPress={make} />
            </View>
          </>
        ) : (
          <Empty title="아직 개념 정리가 없어요" body="AI가 이 단원의 핵심 개념, 공식, 자주 하는 실수를 한 장으로 정리해줘요." action="AI로 개념 정리하기" onAction={make} />
        )
      ) : ns.length ? (
        <>
          <Card>
            {types.map(([ty, k]) => (
              <View key={ty} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T v="small">{ty}</T>
                  <T v="label">{k}</T>
                </View>
                <View style={{ height: 6, backgroundColor: c.grid, borderRadius: 3, marginTop: 4, overflow: 'hidden' }}>
                  <View style={{ width: `${(k / types[0][1]) * 100}%`, height: 6, backgroundColor: c.red }} />
                </View>
              </View>
            ))}
          </Card>
          {ns.map((n) => (
            <NoteRow key={n.id} n={n} />
          ))}
        </>
      ) : (
        <Empty title="이 단원 오답이 없어요" body="공부한 단원이라면 지금은 탄탄하다는 뜻이고, 아직 안 배운 단원이라면 비어 있는 게 정상이에요." />
      )}
      {err ? (
        <Note kind="bad">
          개념 정리를 만들지 못했어요. {err}
        </Note>
      ) : null}
    </Screen>
  );
}

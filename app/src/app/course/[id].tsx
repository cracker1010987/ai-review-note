import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useData } from '../../data/StoreProvider';
import { leafActive, weakLeaves } from '../../domain/review';
import { isDue } from '../../domain/srs';
import { leaves } from '../../domain/subject';
import { CourseSheet } from '../../features/CourseSheet';
import { NoteRow } from '../../features/NoteRow';
import { Button, Card, Chip, Empty, IconBtn, Screen, SecHead, T } from '../../ui/kit';
import { radius, useColors } from '../../ui/theme';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useData();
  const c = useColors();
  const [sheet, setSheet] = useState(false);
  const [sel, setSel] = useState('');
  const co = d.courses.find((x) => x.id === id);
  if (!co)
    return (
      <Screen title="교과" back>
        <Empty title="교과를 찾을 수 없어요" action="홈으로" onAction={() => router.dismissTo('/')} />
      </Screen>
    );

  const subs = d.subjects.filter((s) => s.courseId === co.id);
  const all = d.notes.filter((n) => n.courseId === co.id);
  const subId = subs.some((s) => s.id === sel) ? sel : '';
  const shown = subId ? all.filter((n) => n.subjectId === subId) : all;
  const th = d.settings.conceptThreshold;
  const weak = weakLeaves(subs, d.notes, th)[0];
  const addSubject = () => router.push({ pathname: '/toc', params: { courseId: co.id } });

  return (
    <Screen title={co.name} back right={<IconBtn name="edit" label="교과 수정" onPress={() => setSheet(true)} />}>
      {!subs.length ? (
        <Empty
          title="아직 과목이 없어요"
          body="교과서나 문제집의 목차 사진을 찍으면 AI가 단원을 읽어서 과목을 만들어줘요."
          action="과목 추가하기"
          onAction={addSubject}
        />
      ) : (
        <>
          {weak && (
            <Card style={{ backgroundColor: c.hl, borderColor: 'transparent' }}>
              <T v="label">개념을 점검할 단원</T>
              <T v="small" style={{ marginTop: 2 }}>
                {weak.path}에서 {weak.n}문제 틀렸어요.
              </T>
              <Button
                kind="link"
                title="개념 정리 보기"
                style={{ alignSelf: 'flex-start', marginTop: 4 }}
                onPress={() => router.push({ pathname: '/leaf', params: { sid: weak.sid, lid: weak.lid } })}
              />
            </Card>
          )}
          <SecHead title={`과목 ${subs.length}`} action="+ 과목 추가" onAction={addSubject} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {subs.map((s) => {
              const L = leaves(s);
              const ns = all.filter((n) => n.subjectId === s.id);
              const due = ns.filter((n) => isDue(n)).length;
              const wk = L.filter((l) => leafActive(d.notes, s.id, l.id).length >= th).length;
              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.name} 단원 지도 열기`}
                  onPress={() => router.push({ pathname: '/subject/[id]', params: { id: s.id } })}
                  style={({ pressed }) => ({ width: '48.8%', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderLeftWidth: 4, borderLeftColor: co.color, borderRadius: radius.md, padding: 12, opacity: pressed ? 0.75 : 1 })}
                >
                  <T v="h3" numberOfLines={2}>
                    {s.name}
                  </T>
                  <T v="caption" muted>
                    {L.length ? `단원 ${L.length}` : '목차 없음'} · 오답 {ns.length}
                  </T>
                  {due || wk ? (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                      {due ? (
                        <T v="caption" color={c.red}>
                          복습 {due}
                        </T>
                      ) : null}
                      {wk ? (
                        <T v="caption" color={c.warn}>
                          약한 단원 {wk}
                        </T>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <SecHead title={`오답 ${shown.length}`} />
          {all.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 10 }}>
              <Chip label="전체" on={!subId} onPress={() => setSel('')} />
              {subs.map((s) => (
                <Chip key={s.id} label={`${s.name} ${all.filter((n) => n.subjectId === s.id).length}`} on={subId === s.id} onPress={() => setSel(s.id)} />
              ))}
            </ScrollView>
          )}
          {shown.length ? (
            shown.map((n) => <NoteRow key={n.id} n={n} />)
          ) : (
            <Empty
              title={all.length ? '이 과목엔 아직 오답이 없어요' : '아직 모은 오답이 없어요'}
              body="틀린 문제 사진을 찍으면 AI가 단원과 유형을 찾아 정리해줘요."
            />
          )}
        </>
      )}
      <CourseSheet open={sheet} id={co.id} onClose={() => setSheet(false)} />
    </Screen>
  );
}

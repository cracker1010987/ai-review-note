import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useData, useStore } from '../data/StoreProvider';
import { guessKind, KINDS } from '../domain/settings';
import type { Course, KindId } from '../domain/types';
import { COLORS, uid } from '../lib/util';
import { Button, confirm, Field, Seg, Sheet, T, toast } from '../ui/kit';
import { useColors } from '../ui/theme';

/** 교과 추가·수정 시트. id가 있으면 수정 */
export function CourseSheet({ open, id, onClose }: { open: boolean; id?: string; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={id ? '교과 수정' : '교과 추가'}>
      {/* 열 때마다 새로 그려서 입력칸을 지금 값으로 채운다 */}
      {open && <CourseForm id={id} onClose={onClose} />}
    </Sheet>
  );
}

function CourseForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const store = useStore();
  const { courses, subjects, notes } = useData();
  const c = useColors();
  const cur = id ? courses.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(cur?.name || '');
  const [color, setColor] = useState(cur?.color || COLORS[courses.length % COLORS.length]);
  const [kind, setKind] = useState<KindId>(cur?.kind || 'general');
  const [kindTouched, setKindTouched] = useState(!!cur);
  const [aiNote, setAiNote] = useState(cur?.aiNote || '');

  async function save() {
    const n = name.trim();
    if (!n) return toast('교과 이름을 입력해주세요');
    const course: Course = { id: cur?.id || uid('c_'), name: n, color, kind: kindTouched ? kind : guessKind(n), aiNote: aiNote.trim(), sort: cur?.sort };
    await store.saveCourse(course);
    onClose();
    if (cur) toast('교과를 수정했어요');
    else {
      toast(`'${n}' 교과를 추가했어요`);
      router.push({ pathname: '/course/[id]', params: { id: course.id } });
    }
  }

  function remove() {
    if (!cur) return;
    const sn = subjects.filter((s) => s.courseId === cur.id).length;
    const nn = notes.filter((x) => x.courseId === cur.id).length;
    confirm('교과 삭제', `'${cur.name}' 교과와 과목 ${sn}개, 오답 ${nn}개를 모두 지울까요? 되돌릴 수 없어요.`, '삭제', async () => {
      onClose();
      router.dismissTo('/');
      await store.removeCourse(cur.id);
      toast('교과를 지웠어요');
    });
  }

  return (
    <>
      <Field
        label="교과 이름"
        value={name}
        maxLength={20}
        placeholder="예: 수학, 과학, 영어"
        autoFocus={!cur}
        onChangeText={(v) => {
          setName(v);
          if (!kindTouched) setKind(guessKind(v));
        }}
        onSubmitEditing={save}
        returnKeyType="done"
      />
      <T v="label" style={{ marginBottom: 8 }}>
        색
      </T>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {COLORS.map((col) => (
          <Pressable
            key={col}
            accessibilityRole="button"
            accessibilityLabel="색 선택"
            accessibilityState={{ selected: col === color }}
            onPress={() => setColor(col)}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: col, borderWidth: 3, borderColor: col === color ? c.ink : 'transparent' }}
          />
        ))}
      </View>
      <T v="label" style={{ marginBottom: 8 }}>
        문제 성격
      </T>
      <Seg
        items={Object.entries(KINDS).map(([k, v]) => [k as KindId, v.label])}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setKindTouched(true);
        }}
      />
      <T v="caption" muted style={{ marginTop: 6, marginBottom: 14 }}>
        {KINDS[kind].desc}. AI가 문제를 읽고 푸는 방식이 달라져요.{kindTouched ? '' : ' (이름을 보고 골랐어요)'}
      </T>
      <Field
        label="AI에게 덧붙일 말 (선택)"
        value={aiNote}
        onChangeText={setAiNote}
        maxLength={300}
        multiline
        placeholder="예: 영어 지문은 해석도 같이 적어줘"
        style={{ minHeight: 70, textAlignVertical: 'top', paddingTop: 10 }}
      />
      {!cur && (
        <T v="caption" muted style={{ marginBottom: 12 }}>
          교과를 만든 다음 그 안에 과목을 추가해요. 과목은 목차 사진으로 만들 수 있어요.
        </T>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button kind="ghost" title="취소" onPress={onClose} style={{ flex: 1 }} />
        <Button title={cur ? '저장' : '추가'} onPress={save} style={{ flex: 1 }} />
      </View>
      {cur && <Button kind="link" title="이 교과 삭제" onPress={remove} style={{ marginTop: 12 }} />}
    </>
  );
}

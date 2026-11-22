import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Pressable, TextInput, View } from 'react-native';
import { normalizeToc } from '../ai/draft';
import { useData, useStore } from '../data/StoreProvider';
import { buildUnits } from '../domain/subject';
import { genAllConcepts } from '../features/concepts';
import { dataUrl, getPhotos, type Photo } from '../lib/photo';
import { uid } from '../lib/util';
import { Button, Card, Field, Icon, IconBtn, Note, Screen, SecHead, T, toast } from '../ui/kit';
import { radius, useColors } from '../ui/theme';

type Step = 'method' | 'photo' | 'parsing' | 'edit';
/** 화면 목록용 key를 붙인 초안 */
type Row = { id: string; name: string; k: string; subs: { id: string; name: string; k: string }[] };
const key = () => uid('k');
const toRows = (units: { id?: string; name: string; subs: { id?: string; name: string }[] }[]): Row[] =>
  units.map((u) => ({ id: u.id || '', name: u.name, k: key(), subs: u.subs.map((x) => ({ id: x.id || '', name: x.name, k: key() })) }));

/** 과목 추가 / 단원 목차 편집. 목차 사진을 AI로 읽거나 직접 입력한다 */
export default function TocScreen() {
  const { courseId, subjectId } = useLocalSearchParams<{ courseId: string; subjectId?: string }>();
  const store = useStore();
  const d = useData();
  const c = useColors();
  const co = d.courses.find((x) => x.id === courseId);
  const old = subjectId ? d.subjects.find((x) => x.id === subjectId) : undefined;
  const hadUnits = !!old?.units.length;

  const [step, setStep] = useState<Step>(hadUnits ? 'edit' : 'method');
  const [name, setName] = useState(old?.name || '');
  const [units, setUnits] = useState<Row[]>(() => toRows(old?.units || []));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [err, setErr] = useState('');
  const [fromAI, setFromAI] = useState(false);
  const [genAfter, setGenAfter] = useState(false);
  const [saving, setSaving] = useState(false);
  const run = useRef(0);
  const dirty = useRef(false);

  function goBack() {
    if (step === 'parsing') {
      run.current++;
      setStep('photo');
      return true;
    }
    if (step === 'edit' && !hadUnits) {
      const leave = () => {
        dirty.current = false;
        setStep('method');
      };
      if (dirty.current && units.some((u) => u.name.trim()))
        Alert.alert('입력한 목차를 버릴까요?', '', [{ text: '취소', style: 'cancel' }, { text: '버리기', style: 'destructive', onPress: leave }]);
      else leave();
      return true;
    }
    if (step === 'photo') {
      setStep(hadUnits ? 'edit' : 'method');
      return true;
    }
    if (dirty.current) {
      Alert.alert('저장하지 않고 나갈까요?', '고친 목차는 사라져요.', [
        { text: '취소', style: 'cancel' },
        { text: '나가기', style: 'destructive', onPress: () => router.back() },
      ]);
      return true;
    }
    router.back();
    return true;
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  });

  if (!co)
    return (
      <Screen title="과목 추가" back>
        <T muted>교과를 찾을 수 없어요.</T>
      </Screen>
    );

  const edit = (f: (u: Row[]) => Row[]) => {
    dirty.current = true;
    setUnits((u) => f(u.map((x) => ({ ...x, subs: [...x.subs] }))));
  };

  async function addPhotos(from: 'camera' | 'library') {
    try {
      const got = await getPhotos(from, { multiple: true, max: 4 - photos.length });
      if (got.length) setPhotos((p) => [...p, ...got].slice(0, 4));
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function read() {
    if (!store.ai.ready()) return toast('설정에서 AI를 먼저 연결해주세요');
    const my = ++run.current;
    setStep('parsing');
    setErr('');
    try {
      const r = await store.ai.task('parseTOC', { courseName: co!.name, images: photos.map((p) => dataUrl(p.base64)) }, { course: co });
      if (run.current !== my) return;
      const t = normalizeToc(r);
      if (!t.units.length) throw new Error('목차에서 단원을 찾지 못했어요. 목차가 잘 보이게 다시 찍어주세요.');
      dirty.current = true;
      setUnits(toRows(t.units));
      if (!name.trim()) setName(t.subjectName);
      setFromAI(true);
      setStep('edit');
    } catch (e) {
      if (run.current !== my) return;
      setErr((e as Error).message);
      setStep('photo');
    }
  }

  async function save() {
    const n = name.trim();
    if (!n) return toast('과목 이름을 입력해주세요');
    const built = buildUnits(old, units, uid);
    if (!built.length) return toast('단원을 하나 이상 입력해주세요');
    setSaving(true);
    const sid = old?.id || uid('s_');
    await store.saveSubject({ id: sid, courseId: co!.id, name: n, units: built, sort: old?.sort });
    dirty.current = false;
    toast(old ? '목차를 저장했어요' : `'${n}' 과목을 추가했어요`);
    // 개념 정리는 화면과 상관없이 이어서 만들고, 과목 화면에 진행 상황이 보인다
    if (genAfter) {
      if (!store.ai.ready()) toast('AI가 연결되지 않아 개념 정리는 만들지 않았어요');
      else
        genAllConcepts(store, sid)
          .then((k) => k && toast(`개념 정리 ${k}개를 만들었어요`))
          .catch((e: Error) => Alert.alert('개념 정리를 다 만들지 못했어요', e.message));
    }
    if (old) router.back();
    else router.replace({ pathname: '/subject/[id]', params: { id: sid } });
  }

  const title = old ? '단원 목차' : '과목 추가';
  const sub = [co.name, old?.name].filter(Boolean).join(' › ');

  if (step === 'method')
    return (
      <Screen title={title} sub={sub} back onBack={goBack}>
        <T muted style={{ marginBottom: 14 }}>
          과목의 단원 목록(목차)을 만들어요. 오답을 단원별로 모으고, 단원마다 개념 정리를 만들 때 써요.
        </T>
        <OptCard rec title="목차 사진으로 만들기" body="교과서나 문제집의 목차를 찍으면 AI가 대단원과 소단원을 읽어 정리해요." onPress={() => setStep('photo')} />
        <OptCard
          title="직접 입력하기"
          body="과목 이름과 단원을 손으로 입력해요."
          onPress={() => {
            if (!units.length) setUnits(toRows([{ name: '', subs: [] }]));
            setFromAI(false);
            setStep('edit');
          }}
        />
      </Screen>
    );

  if (step === 'parsing')
    return (
      <Screen title={title} sub={sub} back onBack={goBack} scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={c.blue} />
          <T v="h3">목차를 읽는 중이에요</T>
          <T v="small" muted>
            사진 장수에 따라 10~40초쯤 걸려요.
          </T>
        </View>
      </Screen>
    );

  if (step === 'photo')
    return (
      <Screen
        title={title}
        sub={sub}
        back
        onBack={goBack}
        footer={<Button title="목차 읽기" disabled={!photos.length} onPress={read} />}
      >
        <Card>
          <Field label="과목 이름 (비우면 목차에서 읽어요)" value={name} onChangeText={setName} placeholder="예: 미적분, 통합과학1" />
        </Card>
        <Card>
          <T v="h3">목차 사진</T>
          <T v="caption" muted style={{ marginBottom: 10 }}>
            최대 4장, 순서대로 넣어요. 목차 전체가 보이고 글자가 흐리지 않게 찍어주세요.
          </T>
          {photos.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {photos.map((p, i) => (
                <View key={p.uri} style={{ width: 72, height: 96 }}>
                  <Image source={{ uri: p.uri }} style={{ width: 72, height: 96, borderRadius: radius.sm, backgroundColor: c.grid }} accessibilityLabel={`목차 ${i + 1}쪽`} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${i + 1}번째 사진 빼기`}
                    onPress={() => setPhotos((x) => x.filter((_, j) => j !== i))}
                    hitSlop={8}
                    style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 12, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="close" size={16} color={c.paper} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {photos.length < 4 && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button kind="ghost" title="촬영" onPress={() => addPhotos('camera')} style={{ flex: 1 }} />
              <Button kind="ghost" title="앨범" onPress={() => addPhotos('library')} style={{ flex: 1 }} />
            </View>
          )}
        </Card>
        {err ? (
          <Card style={{ borderColor: c.red }}>
            <T v="h3" color={c.red}>
              목차를 읽지 못했어요
            </T>
            <T v="small" style={{ marginTop: 4 }}>
              {err}
            </T>
            <Button
              kind="link"
              title="직접 입력하기"
              style={{ alignSelf: 'flex-start', marginTop: 6 }}
              onPress={() => {
                if (!units.length) setUnits(toRows([{ name: '', subs: [] }]));
                setStep('edit');
              }}
            />
          </Card>
        ) : null}
      </Screen>
    );

  // edit
  const total = units.reduce((a, u) => a + Math.max(1, u.subs.length), 0);
  return (
    <Screen
      title={title}
      sub={sub}
      back
      onBack={goBack}
      footer={
        <View style={{ gap: 6 }}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: genAfter }}
            onPress={() => setGenAfter((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
          >
            <Icon name={genAfter ? 'check-box' : 'check-box-outline-blank'} color={genAfter ? c.blue : c.muted} />
            <T v="small">저장한 뒤 단원별 개념 정리도 바로 만들기</T>
          </Pressable>
          <Button title="저장" busy={saving} onPress={save} />
        </View>
      }
    >
      {fromAI && <Note kind="ok">AI가 읽은 목차예요. 틀린 글자나 빠진 단원이 있으면 고쳐주세요.</Note>}
      <Field
        label="과목 이름"
        value={name}
        onChangeText={(v) => {
          dirty.current = true;
          setName(v);
        }}
        placeholder="예: 미적분"
      />
      <SecHead
        title={`단원 ${total}개`}
        action={old ? '사진으로 다시 읽기' : undefined}
        onAction={() => {
          setPhotos([]);
          setStep('photo');
        }}
      />
      {units.map((u, i) => (
        <Card key={u.k} style={{ padding: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <T v="label" muted style={{ width: 20, textAlign: 'center' }}>
              {i + 1}
            </T>
            <TreeInput
              value={u.name}
              placeholder="대단원 이름"
              label={`${i + 1}번 대단원 이름`}
              onChange={(v) => edit((x) => ((x[i].name = v), x))}
            />
            <IconBtn
              name="arrow-upward"
              label="위로 옮기기"
              color={i ? c.ink : c.line}
              onPress={() => i && edit((x) => ([x[i - 1], x[i]] = [x[i], x[i - 1]]) && x)}
            />
            <IconBtn
              name="close"
              label="대단원 삭제"
              onPress={() => {
                const del = () => edit((x) => x.filter((_, j) => j !== i));
                if (u.subs.length || u.name.trim())
                  Alert.alert('대단원 빼기', `'${u.name || '이름 없음'}' 대단원${u.subs.length ? `과 소단원 ${u.subs.length}개` : ''}를 뺄까요?`, [
                    { text: '취소', style: 'cancel' },
                    { text: '빼기', style: 'destructive', onPress: del },
                  ]);
                else del();
              }}
            />
          </View>
          {u.subs.map((sb, j) => (
            <View key={sb.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingLeft: 24 }}>
              <T muted>–</T>
              <TreeInput value={sb.name} placeholder="소단원 이름" label="소단원 이름" onChange={(v) => edit((x) => ((x[i].subs[j].name = v), x))} />
              <IconBtn name="close" label="소단원 삭제" onPress={() => edit((x) => ((x[i].subs = x[i].subs.filter((_, q) => q !== j)), x))} />
            </View>
          ))}
          <Button
            kind="link"
            title="+ 소단원"
            style={{ alignSelf: 'flex-start', marginLeft: 24, marginTop: 4 }}
            onPress={() => edit((x) => (x[i].subs.push({ id: '', name: '', k: key() }), x))}
          />
        </Card>
      ))}
      <Button kind="ghost" title="+ 대단원 추가" onPress={() => edit((x) => [...x, { id: '', name: '', k: key(), subs: [] }])} />
    </Screen>
  );
}

function TreeInput({ value, placeholder, label, onChange }: { value: string; placeholder: string; label: string; onChange: (v: string) => void }) {
  const c = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      accessibilityLabel={label}
      style={{ flex: 1, minHeight: 42, borderWidth: 1, borderColor: c.line, borderRadius: 8, paddingHorizontal: 10, fontSize: 15, color: c.ink, backgroundColor: c.paper }}
    />
  );
}

function OptCard({ title, body, rec, onPress }: { title: string; body: string; rec?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: c.surface, borderColor: rec ? c.blue : c.line, borderWidth: rec ? 2 : 1, borderRadius: radius.lg, padding: 16, marginBottom: 10, opacity: pressed ? 0.75 : 1 })}
    >
      {rec && (
        <View style={{ alignSelf: 'flex-start', backgroundColor: c.blueSoft, borderRadius: 6, paddingHorizontal: 7, marginBottom: 6 }}>
          <T v="caption" color={c.blue} style={{ fontWeight: '700' }}>
            추천
          </T>
        </View>
      )}
      <T v="h3">{title}</T>
      <T v="small" muted style={{ marginTop: 2 }}>
        {body}
      </T>
    </Pressable>
  );
}

import { useState } from 'react';
import { Alert } from 'react-native';
import { applyBackup, exportBackup, pickBackup } from '../data/backup-io';
import { useData, useStore } from '../data/StoreProvider';
import { AiConnect } from '../features/AiConnect';
import { Button, Card, Note, Screen, T } from '../ui/kit';

export default function Settings() {
  const store = useStore();
  const { meta } = useData();
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function doExport() {
    setBusy('export');
    setMsg(null);
    try {
      await exportBackup(store.db, store.images);
      await store.updateMeta({ lastBackup: new Date().toISOString().slice(0, 10), backupSnooze: '' });
      setMsg({ ok: true, text: '백업 파일을 만들었어요. 드라이브나 파일 앱에 저장해두세요.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(null);
  }

  async function doImport() {
    setMsg(null);
    try {
      const picked = await pickBackup();
      if (!picked) return;
      const s = picked.summary;
      Alert.alert(
        '백업 불러오기',
        `${s.exportedAt.slice(0, 10) || '날짜 모름'} 백업 (오답 ${s.notes}개, 과목 ${s.subjects}개, 사진 ${s.images}장)으로 지금 데이터를 바꿀까요?\n지금 데이터는 사라져요. API 키는 그대로예요.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '바꾸기',
            style: 'destructive',
            onPress: async () => {
              setBusy('import');
              try {
                await applyBackup(store.db, store.images, picked.text);
                await store.reload();
                setMsg({ ok: true, text: '백업을 불러왔어요.' });
              } catch (e) {
                setMsg({ ok: false, text: (e as Error).message });
              }
              setBusy(null);
            },
          },
        ],
      );
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <Screen title="설정" back>
      <T v="label" muted style={{ marginBottom: 8 }}>
        AI 연결
      </T>
      <Card>
        <AiConnect />
      </Card>
      <T v="label" muted style={{ marginTop: 14, marginBottom: 8 }}>
        데이터
      </T>
      <Card>
        <T v="h3">백업</T>
        <T v="small" muted style={{ marginTop: 4, marginBottom: 12 }}>
          오답, 사진, 설정을 파일 하나로 저장해요. 폰을 바꾸거나 앱을 지웠다 다시 깔 때 불러오면 돼요. 마지막 백업: {meta.lastBackup || '없음'}
        </T>
        <Button title="백업 파일 만들기" busy={busy === 'export'} disabled={!!busy} onPress={doExport} />
        <Button kind="ghost" title="백업 불러오기" busy={busy === 'import'} disabled={!!busy} onPress={doImport} style={{ marginTop: 8 }} />
        {msg && <Note kind={msg.ok ? 'ok' : 'bad'}>{msg.text}</Note>}
      </Card>
    </Screen>
  );
}

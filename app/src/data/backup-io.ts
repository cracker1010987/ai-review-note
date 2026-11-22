import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backupFileName, buildBackup, parseBackup, restoreBackup, type BackupSummary } from './backup.ts';
import type { Db } from './db.ts';
import type { ImageStore } from './images.types.ts';

/** 백업 파일을 만들고 공유 창을 연다 (드라이브, 카톡 나에게 보내기, 파일 앱 등에 저장) */
export async function exportBackup(db: Db, images: ImageStore): Promise<void> {
  const data = await buildBackup(db, images);
  const f = new File(Paths.cache, backupFileName());
  if (f.exists) f.delete();
  f.create();
  f.write(JSON.stringify(data));
  if (!(await Sharing.isAvailableAsync())) throw new Error('이 기기에서는 공유 기능을 쓸 수 없어요.');
  await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: '백업 파일 저장' });
}

/** 백업 파일을 고른다. 취소하면 null */
export async function pickBackup(): Promise<{ text: string; summary: BackupSummary } | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.length) return null;
  const text = await new File(r.assets[0].uri).text();
  return { text, summary: parseBackup(text).summary };
}

/** 고른 백업으로 지금 데이터를 통째로 바꾼다 */
export async function applyBackup(db: Db, images: ImageStore, text: string): Promise<void> {
  await restoreBackup(db, images, parseBackup(text).file);
}

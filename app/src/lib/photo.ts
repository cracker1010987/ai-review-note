import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** 찍거나 고른 사진 (긴 변 1600px JPEG로 줄인 것) */
export interface Photo {
  uri: string;
  base64: string;
  width: number;
  height: number;
}

const LONG = 1600;

/** 사진을 줄이고(긴 변 1600px) 필요하면 돌려서 JPEG base64로 만든다 */
export async function prepPhoto(uri: string, w: number, h: number, rotate = 0): Promise<Photo> {
  const ctx = ImageManipulator.manipulate(uri);
  if (rotate) ctx.rotate(rotate);
  const rw = rotate % 180 ? h : w;
  const rh = rotate % 180 ? w : h;
  if (Math.max(rw, rh) > LONG) ctx.resize(rw >= rh ? { width: LONG } : { height: LONG });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.82, base64: true });
  if (!out.base64) throw new Error('사진을 처리하지 못했어요. 다시 찍어주세요.');
  return { uri: out.uri, base64: out.base64, width: out.width, height: out.height };
}

/** 카메라로 찍거나 앨범에서 고른다. 취소하면 빈 배열 */
export async function getPhotos(from: 'camera' | 'library', o: { multiple?: boolean; max?: number } = {}): Promise<Photo[]> {
  if (from === 'camera') {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) throw new Error('카메라 권한이 필요해요. 휴대폰 설정 › 앱 › AI 오답노트에서 카메라를 허용해주세요.');
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: from === 'library' && !!o.multiple,
    selectionLimit: o.max ?? 0,
  };
  const r = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled) return [];
  const out: Photo[] = [];
  for (const a of r.assets.slice(0, o.max || undefined)) out.push(await prepPhoto(a.uri, a.width, a.height));
  return out;
}

export const dataUrl = (b64: string) => `data:image/jpeg;base64,${b64}`;

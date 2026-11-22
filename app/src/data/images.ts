import { Directory, File, Paths } from 'expo-file-system';
import type { Db } from './db.ts';
import type { ImageStore } from './images.types.ts';

/** 안드로이드·iOS: 앱 문서 폴더의 images/ 아래에 파일로 저장 */
export function createImageStore(_db?: Db): ImageStore {
  const root = () => new Directory(Paths.document, 'images');
  const fileOf = (path: string) => new File(root(), ...path.split('/'));

  function walk(dir: Directory, prefix: string, out: string[]) {
    if (!dir.exists) return;
    for (const it of dir.list()) {
      if (it instanceof Directory) walk(it, `${prefix}${it.name}/`, out);
      else out.push(prefix + it.name);
    }
  }

  return {
    async put(path, base64) {
      const f = fileOf(path);
      const parent = new Directory(root(), ...path.split('/').slice(0, -1));
      parent.create({ intermediates: true, idempotent: true });
      if (f.exists) f.delete();
      f.create();
      f.write(base64, { encoding: 'base64' });
    },
    async get(path) {
      const f = fileOf(path);
      return f.exists ? f.base64() : null;
    },
    async displayUri(path) {
      const f = fileOf(path);
      return f.exists ? f.uri : null;
    },
    async del(path) {
      const f = fileOf(path);
      if (f.exists) f.delete();
    },
    async list() {
      const out: string[] = [];
      walk(root(), '', out);
      return out;
    },
    async clear() {
      const d = root();
      if (d.exists) d.delete();
    },
  };
}

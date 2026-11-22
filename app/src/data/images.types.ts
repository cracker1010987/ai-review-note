/** 오답 사진 저장소. 경로 예: notes/{noteId}/q.jpg */
export interface ImageStore {
  /** base64(JPEG)로 저장 */
  put(path: string, base64: string): Promise<void>;
  /** base64로 읽기. 없으면 null */
  get(path: string): Promise<string | null>;
  /** 화면에 보여줄 주소 (file://… 또는 data:…). 없으면 null */
  displayUri(path: string): Promise<string | null>;
  del(path: string): Promise<void>;
  /** 저장된 모든 경로 */
  list(): Promise<string[]>;
  clear(): Promise<void>;
}

export const notePhotoPath = (noteId: string, slot: 'q' | 's' | 'mine' | 'fig') => `notes/${noteId}/${slot}.jpg`;

import { createCatalog, type Catalog } from '../ai/catalog.ts';
import { createAI, type AI } from '../ai/client.ts';
import { ymd } from '../domain/dates.ts';
import type { Concept, Course, Exam, Note, ProviderId, ReviewLog, Settings, Subject } from '../domain/types.ts';
import type { Db } from './db.ts';
import type { ImageStore } from './images.types.ts';
import * as repo from './repo.ts';
import type { AppData, Meta } from './repo.ts';

export interface StoreDeps {
  db: Db;
  images: ImageStore;
  keys: Record<ProviderId, string>;
  saveKey: (p: ProviderId, key: string) => Promise<void>;
  fetchFn?: typeof fetch;
}

/**
 * 앱 전체 상태. 시작할 때 기기 DB를 한 번에 메모리로 올리고,
 * 바꿀 때는 메모리를 먼저 바꿔 화면을 그리고 DB에도 바로 쓴다.
 */
export function createStore(initial: AppData, deps: StoreDeps) {
  let data = initial;
  let keys = { ...deps.keys };
  let version = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    version++;
    listeners.forEach((f) => f());
  };
  const catalog: Catalog = createCatalog(deps.fetchFn);
  catalog.subscribe(emit);

  let monthCost = 0;
  const refreshMonthCost = async () => {
    const rows = await repo.usageSince(deps.db, ymd().slice(0, 7) + '-01');
    monthCost = rows.reduce((a, r) => a + (r.cost || 0), 0);
  };
  void refreshMonthCost();

  const ai: AI = createAI({
    getSettings: () => data.settings,
    getKey: (p) => keys[p] || '',
    catalog,
    fetchFn: deps.fetchFn,
    monthCost: () => monthCost,
    today: () => ymd(),
    onUsage: (u) => {
      monthCost += u.cost || 0;
      void repo.addUsage(deps.db, { ...u, tier: u.tier || 'other' });
    },
  });

  function set(next: AppData) {
    data = next;
    emit();
  }

  const dropConcepts = (cs: AppData['concepts'], sids: Set<string>) =>
    Object.fromEntries(Object.entries(cs).filter(([k]) => !sids.has(k.split('|')[0])));
  const dropReviews = (rs: ReviewLog[], gone: Note[]) => {
    const ids = new Set(gone.map((n) => n.id));
    return rs.filter((r) => !r.nid || !ids.has(r.nid));
  };
  async function dropPhotos(notes: Note[]) {
    for (const n of notes)
      for (const p of Object.values(n.images))
        if (p) await deps.images.del(p).catch(() => {});
  }

  return {
    db: deps.db,
    images: deps.images,
    ai,
    catalog,
    get: () => data,
    getKeys: () => keys,
    getVersion: () => version,
    subscribe(f: () => void) {
      listeners.add(f);
      return () => {
        listeners.delete(f);
      };
    },

    async updateSettings(patch: Partial<Settings>) {
      const settings = { ...data.settings, ...patch };
      set({ ...data, settings });
      await repo.saveSettings(deps.db, settings);
    },
    async updateMeta(patch: Partial<Meta>) {
      const meta = { ...data.meta, ...patch };
      set({ ...data, meta });
      await repo.saveMeta(deps.db, meta);
    },
    async setKey(p: ProviderId, key: string) {
      keys = { ...keys, [p]: key.trim() };
      emit();
      await deps.saveKey(p, key);
    },
    // ---------- 교과
    async saveCourse(c: Course) {
      const exists = data.courses.some((x) => x.id === c.id);
      const sort = c.sort ?? (exists ? data.courses.find((x) => x.id === c.id)!.sort : data.courses.length);
      const course = { ...c, sort };
      set({ ...data, courses: exists ? data.courses.map((x) => (x.id === c.id ? course : x)) : [...data.courses, course] });
      await repo.upsertCourse(deps.db, course);
    },
    async removeCourse(id: string) {
      const gone = data.notes.filter((n) => n.courseId === id);
      const sids = new Set(data.subjects.filter((s) => s.courseId === id).map((s) => s.id));
      set({
        ...data,
        courses: data.courses.filter((c) => c.id !== id),
        subjects: data.subjects.filter((s) => s.courseId !== id),
        notes: data.notes.filter((n) => n.courseId !== id),
        exams: data.exams.filter((e) => e.courseId !== id),
        concepts: dropConcepts(data.concepts, sids),
        quizzes: data.quizzes.filter((q) => !sids.has(q.sid)),
        reviews: dropReviews(data.reviews, gone),
      });
      await repo.deleteCourse(deps.db, id);
      await dropPhotos(gone);
    },

    // ---------- 과목
    async saveSubject(s: Subject) {
      const exists = data.subjects.some((x) => x.id === s.id);
      const sort = s.sort ?? (exists ? data.subjects.find((x) => x.id === s.id)!.sort : data.subjects.filter((x) => x.courseId === s.courseId).length);
      const subject = { ...s, sort };
      set({ ...data, subjects: exists ? data.subjects.map((x) => (x.id === s.id ? subject : x)) : [...data.subjects, subject] });
      await repo.upsertSubject(deps.db, subject);
    },
    async removeSubject(id: string) {
      const gone = data.notes.filter((n) => n.subjectId === id);
      // 시험 범위에서도 빼고, 범위가 비면 시험도 지운다
      const touched: Exam[] = [];
      const exams = data.exams
        .map((e) => {
          if (!e.scope.some((x) => x.sid === id)) return e;
          const ne = { ...e, scope: e.scope.filter((x) => x.sid !== id) };
          touched.push(ne);
          return ne;
        })
        .filter((e) => e.scope.length);
      set({
        ...data,
        subjects: data.subjects.filter((s) => s.id !== id),
        notes: data.notes.filter((n) => n.subjectId !== id),
        concepts: dropConcepts(data.concepts, new Set([id])),
        quizzes: data.quizzes.filter((q) => q.sid !== id),
        reviews: dropReviews(data.reviews, gone),
        exams,
      });
      await repo.deleteSubject(deps.db, id);
      for (const e of touched) {
        if (e.scope.length) await repo.upsertExam(deps.db, e);
        else await repo.deleteExam(deps.db, e.id);
      }
      await dropPhotos(gone);
    },

    // ---------- 개념 정리
    async saveConcept(sid: string, lid: string, c: Concept) {
      const at = Date.now();
      set({ ...data, concepts: { ...data.concepts, [repo.conceptKey(sid, lid)]: { ...c, at } } });
      await repo.setConcept(deps.db, sid, lid, c, at);
    },

    /** 백업을 불러온 뒤처럼 DB가 통째로 바뀌었을 때 */
    async reload() {
      set(await repo.loadAll(deps.db));
      await refreshMonthCost();
    },
    async usageSince(day: string) {
      return repo.usageSince(deps.db, day);
    },
  };
}
export type Store = ReturnType<typeof createStore>;

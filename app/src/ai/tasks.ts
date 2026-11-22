import { KINDS } from '../domain/settings.ts';
import type { Concept, Course, Leaf, Note, SimLevel, Subject } from '../domain/types.ts';
import type { WeekData } from '../domain/review.ts';

export interface BuiltTask {
  text: string;
  images?: string[];
  maxTokens?: number;
}

/** 모든 작업에 공통으로 붙는 시스템 지시 */
export function systemPrompt(grade: string, course?: Pick<Course, 'name' | 'kind' | 'aiNote'> | null): string {
  const K = course && KINDS[course.kind];
  return `너는 한국 ${grade} 학생의 오답노트를 돕는 선생님이다.
반드시 JSON 객체 하나만 출력한다. 설명 문장이나 코드블록은 쓰지 않는다.
수식은 LaTeX로 쓰고 인라인 수식은 \\( \\)로 감싼다. JSON 문자열 안의 백슬래시는 반드시 두 번 쓴다(예: "\\\\frac{1}{2}").
학생에게 보여줄 문장은 쉬운 한국어 존댓말 대신 간결한 평서문으로 쓴다.${K ? `\n${K.guide}` : ''}${
    course && course.aiNote ? `\n학생이 이 교과(${course.name})에 대해 덧붙인 요청: ${course.aiNote}` : ''
  }`;
}

export const SIM_LV: Record<SimLevel, string> = {
  easy: '원래 문제보다 한 단계 쉽게. 조건을 하나 줄이거나 숫자를 단순하게 해서 핵심 개념만 확인한다.',
  same: '원래 문제와 같은 난이도.',
  hard: '원래 문제보다 한 단계 어렵게. 조건을 하나 더하거나 개념을 한 번 더 연결한다. 그래도 고등학교 범위 안에서 풀 수 있어야 한다.',
};
export const SIM_LABEL: Record<SimLevel, string> = { easy: '쉽게', same: '비슷하게', hard: '어렵게' };

const leafLine = (l: Leaf) => `${l.id}: ${l.unitName}${l.isUnit ? '' : ' > ' + l.name}`;

export interface TaskArgs {
  parseTOC: { images: string[]; courseName: string };
  summarizeConcepts: { s: Pick<Subject, 'name'>; l: Leaf };
  readProblem: { images: string[]; number?: string };
  analyzeProblem: {
    images: string[];
    hasQ: boolean;
    hasS: boolean;
    hasMine: boolean;
    problem: string;
    choices: string[];
    mineIndex: number | null;
    subjectName: string;
    leaves: Leaf[];
    types: string[];
    tags: string[];
    presets: string[];
    number?: string;
  };
  detectProblems: { images: string[] };
  reviewMine: { n: Pick<Note, 'problem' | 'choices' | 'answer' | 'steps'>; image: string; presets: string[] };
  makeSimilar: { src: Pick<Note, 'problem' | 'choices' | 'answer' | 'steps'>; subjectName: string; level: SimLevel };
  verify: { p: { text: string; choices: string[] } };
  weeklyReport: WeekData & { grade: string };
  conceptQuiz: {
    path: string;
    notes: Pick<Note, 'type' | 'tags' | 'key'>[];
    concept: Concept | null;
    prev: string[];
  };
  gradeAnswer: { q: string; model: string; student: string };
}
export type TaskName = keyof TaskArgs;

export const TASKS: { [K in TaskName]: (a: TaskArgs[K]) => BuiltTask } = {
  parseTOC: (a) => ({
    images: a.images,
    text: `사진은 '${a.courseName}' 교과서나 문제집의 목차다. 목차 구조를 그대로 옮겨라.
- 페이지 번호, '단원 마무리', '실력 확인', '부록', '정답과 해설'처럼 학습 단원이 아닌 항목은 뺀다.
- 목차가 세 단계(대단원 > 중단원 > 소단원)면 대단원을 units, 중단원을 subs로 넣고 그 아래 단계는 버린다. 두 단계면 그대로 넣는다. 한 단계뿐이면 subs는 빈 배열이다.
- 이름 앞의 번호(Ⅰ., 1., 01, (1) 등)는 뺀다.
- 사진이 여러 장이면 순서대로 이어지는 목차다.
출력 형식: {"subject_name":"목차에 보이는 과목 이름, 없으면 빈 문자열","units":[{"name":"대단원 이름","subs":[{"name":"소단원 이름"}]}]}`,
  }),

  summarizeConcepts: ({ s, l }) => ({
    text: `과목: ${s.name}
단원: ${l.unitName}${l.isUnit ? '' : ' > ' + l.name}
이 단원의 개념을 학생이 시험 직전에 훑어볼 수 있게 정리하라. 교육과정 범위를 넘지 않는다.
출력 형식: {"summary":"이 단원에서 무엇을 배우는지 한두 문장","points":[{"title":"개념 이름","body":"설명 2~3문장"}],"formulas":["꼭 외울 공식이나 법칙"],"mistakes":["학생들이 자주 하는 실수"],"check":["스스로 점검할 질문"]}
points 3~6개, formulas 0~6개(공식이 없는 단원이면 빈 배열), mistakes 2~4개, check 2~3개.`,
  }),

  readProblem: (a) => ({
    images: a.images,
    maxTokens: 3000,
    text: `사진은 학생이 틀린 문제다. ${a.number ? `문제 번호 ${a.number}번만 옮긴다. 다른 문제가 같이 찍혀 있으면 무시한다.` : '사진에 문제가 여러 개면 가장 크고 가운데 있는 문제 하나만 옮긴다.'}
할 일:
- 문제 글을 사진에 보이는 그대로, 한 글자도 빠짐없이 옮겨 적는다. 문제를 풀거나 다듬어 쓰지 않는다. 문제 번호와 선지 번호는 뺀다.
- 객관식이면 choices에 선지를 순서대로 넣고, 주관식이면 빈 배열.
- 학생이 선지에 표시(체크, 동그라미 등)한 답이 보이면 mine_index에 그 위치(0부터), 없으면 null.
- 흐리거나 잘리거나 손글씨에 가려서 확실하지 않은 글자·수식이 있으면, problem이나 choices에 쓴 그대로의 짧은 조각을 uncertain에 넣는다(최대 5개). 짐작해서 채운 부분은 반드시 넣는다. 모두 확실하면 빈 배열.
- 문제 안에 그림, 그래프, 표가 있으면 figure에 사진 기준 위치를 퍼센트(0~100)로, 없으면 null. 그림 속 글자는 problem에 옮기지 않는다.
출력 형식: {"problem":"","choices":[],"mine_index":null,"uncertain":[],"figure":{"x":0,"y":0,"w":0,"h":0}}`,
  }),

  analyzeProblem: (a) => {
    const labels = ([] as string[])
      .concat(a.hasQ ? ['문제 사진(그림 참고용)'] : [])
      .concat(a.hasS ? ['해설'] : [])
      .concat(a.hasMine ? ['학생 풀이'] : []);
    return {
      images: a.images,
      text: `${labels.length ? `사진 순서: ${labels.map((l, i) => `${i + 1}) ${l}`).join(', ')}\n` : ''}과목: ${a.subjectName}
단원 목록 (이 중에서만 고르고 id로 답한다):
${a.leaves.length ? a.leaves.map(leafLine).join('\n') : '(단원 목록 없음, leaf_id는 빈 문자열)'}
이 과목에서 지금까지 저장한 유형: ${a.types.length ? a.types.join(' / ') : '(없음)'}
학생이 직접 단 오답 원인: ${a.tags.join(', ') || '(없음)'}
${a.number ? `문제 번호: ${a.number}. 해설 사진에 여러 문제가 있으면 이 번호의 해설만 본다.\n` : ''}
문제 (학생이 사진과 비교해 확인한 글이다. 글자는 그대로 믿는다):
${a.problem}
${a.choices.length ? '선지:\n' + a.choices.map((c, i) => `${i}) ${c}`).join('\n') : '(주관식)'}
${a.mineIndex != null && a.choices[a.mineIndex] != null ? `학생이 고른 답: ${a.mineIndex}) ${a.choices[a.mineIndex]}\n` : ''}
할 일:
- 해설 사진이 있으면 해설을 따르고, 없으면 직접 정확히 푼다.
- answer는 정답(문자열), 객관식이면 answer_index에 위 선지 번호(0부터).
- 학생 풀이 사진에 학생이 낸 답이 보이면 mine/mine_index, 모르면 null.
- leaf_id는 위 단원 목록의 id 중 하나.
- type은 '어떤 상황에서 무엇을 구하는 문제인지'를 20자 안팎으로 쓴 유형 이름. 저장된 유형과 같은 유형이면 그 이름을 그대로 쓰고 type_is_existing=true.
- steps는 풀이 단계 2~6개, 각 한두 문장.
- key는 다음에 같은 실수를 하지 않도록 기억할 한 문장.
- 학생 풀이 사진이 있으면 풀이를 한 줄씩 따라가 처음 틀린 곳을 mistake_point에 '무엇을 어떻게 잘못했는지' 한두 문장으로 쓴다. 풀이 사진이 없고 학생이 고른 답만 있으면 그 답이 나오는 흔한 실수를 짐작해 쓴다. 근거가 없으면 빈 문자열.
- suggested_tags: 학생 풀이나 고른 답을 근거로 다음 오답 원인 중 해당하는 것을 0~2개 고른다. 근거가 없으면 빈 배열. 원인 목록: ${a.presets.join(', ')}
출력 형식: {"answer":"","answer_index":null,"mine":null,"mine_index":null,"leaf_id":"","type":"","type_is_existing":false,"concepts":["관련 개념 1~3개"],"steps":[],"key":"","mistake_point":"","suggested_tags":[]}`,
    };
  },

  detectProblems: (a) => ({
    images: a.images,
    maxTokens: 3000,
    text: `사진은 문제집이나 시험지 한 페이지다. 페이지에 있는 문제를 하나씩 모두 찾는다.
- box는 사진 기준 퍼센트(0~100) 위치다. 문제 번호, 문제 글, 선지, 그림을 모두 포함하되 옆 문제와 겹치지 않게 잡는다.
- 학생이 틀렸다고 표시한 흔적(빗금, X, 빨간 표시, 별표 등)이 있으면 marked=true.
- 해설이나 정답표만 있는 영역은 넣지 않는다.
출력 형식: {"problems":[{"number":"문제 번호","box":{"x":0,"y":0,"w":0,"h":0},"marked":false}]}`,
  }),

  reviewMine: ({ n, image, presets }) => ({
    images: [image],
    maxTokens: 3000,
    text: `사진은 학생이 아래 문제를 직접 푼 풀이다.
문제: ${n.problem}
${n.choices.length ? '선지: ' + n.choices.map((c, i) => `${i + 1}) ${c}`).join('  ') : ''}
정답: ${n.answer}
모범 풀이: ${n.steps.join(' ')}

학생 풀이를 한 줄씩 따라가 처음 틀린 곳을 찾는다. 글씨를 읽을 수 없으면 읽을 수 있는 부분까지만 판단한다.
- mistake_point: 무엇을 어떻게 잘못했는지 한두 문장
- advice: 다음에 같은 실수를 막을 구체적인 방법 한 문장
- suggested_tags: 다음 오답 원인 중 해당하는 것 0~2개: ${presets.join(', ')}
출력 형식: {"mistake_point":"","advice":"","suggested_tags":[]}`,
  }),

  makeSimilar: ({ src, subjectName, level }) => ({
    text: `과목: ${subjectName}
원래 문제: ${src.problem}
${src.choices.length ? '선지: ' + src.choices.map((c, i) => `${i + 1}) ${c}`).join('  ') : '(주관식)'}
정답: ${src.answer}
풀이: ${src.steps.join(' ')}

원래 문제와 같은 개념, 같은 풀이 흐름을 쓰지만 숫자나 조건이 다른 새 문제 하나를 만든다.
난이도: ${SIM_LV[level] || SIM_LV.same}
원래 문제가 객관식이면 5지선다로 만들고 정답이 하나뿐인지 확인한다. 그림이 꼭 있어야 풀 수 있는 문제는 만들지 않는다.
출력 형식: {"text":"문제","choices":["선지"],"answer":"정답","answer_index":0,"solution":"풀이 2~4문장"}
주관식이면 choices는 빈 배열, answer_index는 null.`,
  }),

  verify: ({ p }) => ({
    maxTokens: 4000,
    text: `다음 문제를 처음부터 직접 정확히 풀어라.
문제: ${p.text}
${p.choices.length ? '선지: ' + p.choices.map((c, i) => `${i}) ${c}`).join('  ') : '(주관식)'}
출력 형식: {"answer":"정답","answer_index":${p.choices.length ? '정답 선지 번호(위 표기대로 0부터)' : 'null'},"work":"핵심 풀이 한두 문장"}`,
  }),

  weeklyReport: (w) => ({
    maxTokens: 2000,
    text: `학생(${w.grade})의 최근 7일(${w.from} ~ ${w.to}) 학습 기록이다.
- 공부한 날: ${w.days}일 / 7일
- 새로 모은 오답: ${w.added}개
- 오답 원인 태그: ${w.tags.map(([t, n]) => t + ' ' + n).join(', ') || '없음'}
- 오답이 나온 단원: ${w.leaves.map(([t, n]) => t + ' ' + n).join(', ') || '없음'}
- 오답 유형: ${w.types.slice(0, 8).join(' / ') || '없음'}
- 복습: ${w.rv}문제 중 ${w.rvOk}문제 맞힘
- 개념 질문: ${w.qz}개 중 ${w.qzOk}개 맞힘
- 이번 주 졸업한 오답: ${w.grad}개
- 오늘 기준 복습 밀린 문제: ${w.due}개
이 기록만 근거로 학생에게 주는 주간 리포트를 쓴다. 숫자를 근거로 들고, 기록에 없는 내용은 지어내지 않는다. 학생에게 말하듯 '~요'체로 짧게 쓴다.
출력 형식: {"headline":"이번 주를 한 문장으로","good":["잘한 점 1~2개"],"weak":["약점 1~3개, 숫자 근거 포함"],"plan":["다음 주에 할 일 3개, 무엇을 몇 번 할지 구체적으로"],"cheer":"응원 한 문장"}`,
  }),

  conceptQuiz: (c) => ({
    text: `단원: ${c.path}
학생이 이 단원에서 오답 ${c.notes.length}개를 모았다.
${c.notes
  .slice(0, 8)
  .map((n) => `- 유형: ${n.type} / 원인: ${n.tags.join(', ') || '미입력'} / 기억할 것: ${n.key}`)
  .join('\n')}
${c.concept ? `이 단원 개념 정리 요약: ${c.concept.summary} (핵심: ${c.concept.points.map((p) => p.title).join(', ')})` : ''}
${c.prev.length ? `최근에 이미 낸 질문(겹치지 않게): ${c.prev.join(' / ')}` : ''}
학생이 약한 부분의 개념을 제대로 이해했는지 확인하는 질문 하나를 만든다. 계산을 반복하는 문제가 아니라 '왜 그런지', '언제 쓰는지'를 묻는다.
kind는 "choice"(5지선다) 또는 "short"(한두 문장으로 답하는 서술형) 중 알맞은 것을 고른다. short면 choices는 빈 배열, answer_index는 null.
출력 형식: {"kind":"choice","question":"질문","choices":["선지"],"answer_index":0,"answer":"모범 답","explanation":"해설 2~3문장"}`,
  }),

  gradeAnswer: (g) => ({
    maxTokens: 1500,
    text: `질문: ${g.q}
모범 답: ${g.model}
학생 답: ${g.student}
학생 답이 핵심 개념을 맞게 설명했는지 채점한다. 표현이 달라도 개념이 맞으면 맞다고 본다.
출력 형식: {"correct":true,"score":0에서 100 사이 정수,"feedback":"학생에게 주는 말 1~2문장. 빠지거나 틀린 부분이 있으면 짚는다"}`,
  }),
};

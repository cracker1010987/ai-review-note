// KaTeX를 앱에 통째로 넣는다 (인터넷 없이 수식 표시).
// 글꼴은 CSS 안에 base64로 넣고, 결과를 src/ui/math/katex.gen.ts로 만든다.
// npm install 뒤에 자동으로 실행된다 (postinstall).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'node_modules', 'katex', 'dist');

let css = readFileSync(join(dist, 'katex.min.css'), 'utf8');
// woff2만 남기고 나머지 글꼴 형식은 뺀다 (안드로이드 웹뷰는 woff2를 읽는다)
css = css.replace(/src:([^;}]+)/g, (_, list) => {
  const m = /url\((fonts\/[^)]+\.woff2)\)/.exec(list);
  if (!m) return 'src:' + list;
  const b64 = readFileSync(join(dist, m[1])).toString('base64');
  return `src:url(data:font/woff2;base64,${b64}) format("woff2")`;
});

const js = ['katex.min.js', 'contrib/mhchem.min.js', 'contrib/auto-render.min.js']
  .map((f) => readFileSync(join(dist, f), 'utf8'))
  .join('\n;\n');

const out = join(root, 'src', 'ui', 'math', 'katex.gen.ts');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `// 자동 생성 파일 (scripts/build-katex.mjs). 고치지 마세요.\nexport const KATEX_CSS = ${JSON.stringify(css)};\nexport const KATEX_JS = ${JSON.stringify(js)};\n`,
);
console.log(`katex.gen.ts ${(Buffer.byteLength(css) + Buffer.byteLength(js)) >> 10}KB`);

import { escHtml } from '../../lib/util.ts';

export interface DocColors {
  ink: string;
  muted: string;
  blue: string;
  line: string;
  hl: string;
  red: string;
}

/** 글 한 덩어리 → HTML. 수식 기호(\( \), $ $)는 그대로 두고 KaTeX가 바꾼다 */
export const tex = (s: unknown): string => escHtml(s).replace(/\n/g, '<br>');

/**
 * 웹뷰에 넣을 문서. 내용(body)은 이미 escHtml을 거친 HTML이어야 한다.
 * 그린 뒤 높이를 앱에 알려서 웹뷰 높이를 맞춘다.
 */
export function mathDoc(body: string, c: DocColors, katex: { css: string; js: string }, fontSize = 15): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>${katex.css}
html,body{margin:0;padding:0;background:transparent;color:${c.ink};font-family:system-ui,sans-serif;font-size:${fontSize}px;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere;-webkit-text-size-adjust:100%}
p{margin:0 0 10px}
h4{font-size:${fontSize}px;margin:14px 0 4px}
ul,ol{margin:4px 0 10px;padding-left:22px}
li{margin:3px 0}
hr{border:0;border-top:1px solid ${c.line};margin:14px 0}
.muted{color:${c.muted}}
.lead{font-size:${fontSize + 1}px;font-weight:600}
.lbl{display:block;font-weight:700;color:${c.blue};margin:16px 0 4px}
.lbl.red{color:${c.red}}
mark{background:linear-gradient(transparent 55%,${c.hl} 55%);color:inherit}
.katex{font-size:1.05em}
.katex-display{margin:8px 0;overflow-x:auto;overflow-y:hidden;padding:2px 0}
</style></head><body><div id="root">${body}</div>
<script>${katex.js}</script>
<script>
(function(){
  var root=document.getElementById('root');
  try{renderMathInElement(root,{delimiters:[{left:'$$',right:'$$',display:true},{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false},{left:'$',right:'$',display:false}],throwOnError:false,strict:'ignore'});}catch(e){}
  var last=0;
  function send(){var h=Math.ceil(root.getBoundingClientRect().height);if(h!==last&&window.ReactNativeWebView){last=h;window.ReactNativeWebView.postMessage(String(h));}}
  send();
  if(window.ResizeObserver) new ResizeObserver(send).observe(root);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(send);
  setTimeout(send,300);
})();
</script></body></html>`;
}

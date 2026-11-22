import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useColors } from '../theme';
import { mathDoc, tex } from './doc';
import { KATEX_CSS, KATEX_JS } from './katex.gen';

const KATEX = { css: KATEX_CSS, js: KATEX_JS };

/**
 * 수식이 섞인 글을 보여준다 (KaTeX, 인터넷 없이 동작).
 * html은 tex()나 escHtml로 만든 안전한 HTML이어야 한다.
 */
export function MathView({ html, fontSize = 15 }: { html: string; fontSize?: number }) {
  const c = useColors();
  const [h, setH] = useState(fontSize * 1.6);
  const doc = useMemo(() => mathDoc(html, c, KATEX, fontSize), [html, c, fontSize]);
  return (
    <View style={{ height: h }}>
      <WebView
        originWhitelist={['*']}
        source={{ html: doc }}
        scrollEnabled={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        // 내용 안의 링크로 다른 페이지로 넘어가지 않게 한다
        onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('data:')}
        onMessage={(e) => {
          const v = Number(e.nativeEvent.data);
          if (v > 0 && Math.abs(v - h) > 1) setH(v);
        }}
        style={{ backgroundColor: 'transparent' }}
        containerStyle={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}

/** 글 한 덩어리를 수식과 함께 */
export function MathText({ children, fontSize }: { children: string; fontSize?: number }) {
  return <MathView html={tex(children)} fontSize={fontSize} />;
}

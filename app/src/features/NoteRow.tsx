import { Pressable, View } from 'react-native';
import { dueLabel } from '../domain/dates';
import { isDue } from '../domain/srs';
import { metaLine } from '../domain/subject';
import type { Note } from '../domain/types';
import { T } from '../ui/kit';
import { radius, useColors } from '../ui/theme';

/** 목록에서 수식 기호를 걷어내고 한 줄로 보여준다 */
export const plainPreview = (s: string) =>
  s
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, '')
    .replace(/\\(frac|dfrac)\{([^{}]*)\}\{([^{}]*)\}/g, '$2/$3')
    .replace(/\\(left|right|displaystyle|,|;|quad)/g, '')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function NoteRow({ n, onPress }: { n: Note; onPress?: () => void }) {
  const c = useColors();
  const due = isDue(n);
  const meta = metaLine(n);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <T v="caption" color={c.blue} style={{ flex: 1 }} numberOfLines={1}>
          {[n.type, meta].filter(Boolean).join(' · ')}
        </T>
        {n.graduated ? (
          <T v="caption" color={c.ok}>
            졸업
          </T>
        ) : (
          <T v="caption" color={due ? c.red : c.muted}>
            {due ? '오늘 복습' : dueLabel(n.srs.due)}
          </T>
        )}
      </View>
      <T v="small" numberOfLines={2}>
        {plainPreview(n.problem) || '(문제 글 없음)'}
      </T>
    </Pressable>
  );
}

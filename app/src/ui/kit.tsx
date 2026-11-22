import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, space, useColors } from './theme';

type TVariant = 'title' | 'h2' | 'h3' | 'body' | 'small' | 'caption' | 'label';
const T_STYLE: Record<TVariant, TextStyle> = {
  title: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  h2: { fontSize: 19, fontWeight: '700', lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 23 },
  small: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
};

export function T({ v = 'body', muted, color, style, children, ...rest }: { v?: TVariant; muted?: boolean; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number }) {
  const c = useColors();
  return (
    <Text style={[T_STYLE[v], { color: color || (muted ? c.muted : c.ink) }, style]} {...rest}>
      {children}
    </Text>
  );
}

/** 화면 틀: 안전 영역 + 위쪽 제목줄 + 스크롤 */
export function Screen({
  title,
  back,
  right,
  scroll = true,
  children,
  footer,
}: {
  title?: string;
  back?: boolean;
  right?: ReactNode;
  scroll?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const c = useColors();
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: space.lg }}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} edges={['top', 'bottom']}>
      {(title || back) && (
        <View style={[styles.bar, { borderBottomColor: c.line }]}>
          {back && (
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
              <Text style={{ fontSize: 22, color: c.ink }}>‹</Text>
            </Pressable>
          )}
          <T v="h2" style={{ flex: 1 }} numberOfLines={1}>
            {title || ''}
          </T>
          {right}
        </View>
      )}
      {body}
      {footer && <View style={{ padding: space.lg, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface }}>{footer}</View>}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: space.md }, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress?: () => void;
  kind?: 'primary' | 'ghost' | 'danger' | 'link';
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const off = disabled || busy;
  if (kind === 'link')
    return (
      <Pressable accessibilityRole="button" onPress={onPress} disabled={off} hitSlop={8} style={[{ paddingVertical: 6, alignSelf: 'center' }, style]}>
        <T v="label" color={c.blue}>
          {title}
        </T>
      </Pressable>
    );
  const bg = kind === 'primary' ? c.blue : c.surface;
  const fg = kind === 'primary' ? c.onBlue : kind === 'danger' ? c.red : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: kind === 'primary' ? bg : c.line, opacity: off ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: 15, fontWeight: '600' }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, hint, ...input }: { label: string; hint?: ReactNode } & TextInputProps) {
  const c = useColors();
  return (
    <View style={{ marginBottom: space.md }}>
      <T v="label" style={{ marginBottom: 6 }}>
        {label}
      </T>
      <TextInput
        placeholderTextColor={c.muted}
        {...input}
        style={[styles.input, { borderColor: c.line, backgroundColor: c.paper, color: c.ink }, input.style]}
      />
      {hint ? (
        typeof hint === 'string' ? (
          <T v="caption" muted style={{ marginTop: 5 }}>
            {hint}
          </T>
        ) : (
          hint
        )
      ) : null}
    </View>
  );
}

/** 여러 개 중 하나 고르기 */
export function Seg<K extends string>({ items, value, onChange }: { items: [K, string][]; value: K; onChange: (k: K) => void }) {
  const c = useColors();
  return (
    <View style={[styles.seg, { backgroundColor: c.grid }]}>
      {items.map(([k, label]) => {
        const on = k === value;
        return (
          <Pressable
            key={k}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(k)}
            style={[styles.segBtn, on && { backgroundColor: c.surface, elevation: 1 }]}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: on ? c.ink : c.muted }} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={[styles.chip, { borderColor: on ? c.ink : c.line, backgroundColor: on ? c.ink : c.surface }]}
    >
      <Text style={{ fontSize: 13, fontWeight: on ? '600' : '500', color: on ? c.paper : c.ink }}>{label}</Text>
    </Pressable>
  );
}

export function Note({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'bad' | 'warn'; children: ReactNode }) {
  const c = useColors();
  const bg = kind === 'ok' ? c.okSoft : kind === 'bad' ? c.redSoft : kind === 'warn' ? c.hl : c.blueSoft;
  const fg = kind === 'ok' ? c.ok : kind === 'bad' ? c.red : kind === 'warn' ? c.ink : c.blue;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.sm, padding: 10, marginVertical: 6 }}>
      <T v="small" color={fg}>
        {children}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 56, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  input: { minHeight: 46, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  seg: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  segBtn: { flex: 1, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 13, minHeight: 36, justifyContent: 'center' },
});

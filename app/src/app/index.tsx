import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>AI 오답노트</Text>
      <Text style={styles.sub}>앱을 만드는 중이에요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },
  title: { fontSize: 24, fontWeight: '700', color: '#1B2A4A' },
  sub: { marginTop: 6, fontSize: 14, color: '#5F6B85' },
});

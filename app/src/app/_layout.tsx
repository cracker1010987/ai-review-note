import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StoreProvider } from '../data/StoreProvider';
import { useColors } from '../ui/theme';

export default function RootLayout() {
  const c = useColors();
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper } }} />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

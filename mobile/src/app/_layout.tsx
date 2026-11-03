import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from '../components/AuthScreen';
import { ErrorState } from '../components/ErrorState';
import { Skeleton } from '../components/Skeleton';
import { SessionProvider, useSession } from '../lib/session';
import { colors, font } from '../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

/** Nothing works without a session, so connect first and explain clearly if that fails. */
function Gate() {
  const { status, error, retry } = useSession();
  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>loopa</Text>
        <Skeleton width={120} height={4} style={{ marginTop: 16 }} />
      </View>
    );
  }
  if (status === 'signedOut') return <AuthScreen />;
  if (status === 'error') {
    return (
      <View style={styles.full}>
        <ErrorState message={error ?? 'Не удалось подключиться'} onRetry={retry} />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="publish" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="record" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="interests" options={{ animation: 'fade_from_bottom' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  logo: { color: colors.accent, fontSize: font.xxl + 8, fontWeight: '800', letterSpacing: -1 },
});

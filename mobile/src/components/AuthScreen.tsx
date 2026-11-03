import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL, api, describeError } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, font, radius, space } from '../theme';

type Mode = 'login' | 'signup';

/** Log in or sign up with @handle + password. Shown instead of the app when signed out. */
export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [mode, setMode] = useState<Mode>('login');
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ token: string; user: import('../lib/types').Me }>) => {
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await fn();
      await signIn(token, user);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const cleanHandle = handle.trim().toLowerCase().replace(/^@/, '');
  const canSubmit = cleanHandle.length >= 2 && password.length >= 6 && !busy;

  const submit = () =>
    run(() => (mode === 'login' ? api.login(cleanHandle, password) : api.signup(cleanHandle, password, name.trim())));

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>loopa</Text>
        <Text style={styles.lead}>Короткие видео от людей рядом</Text>

        <View style={styles.switch}>
          {(['login', 'signup'] as Mode[]).map((m) => (
            <Pressable key={m} style={[styles.switchItem, mode === m && styles.switchOn]} onPress={() => setMode(m)}>
              <Text style={[styles.switchText, mode === m && { color: colors.text }]}>{m === 'login' ? 'Вход' : 'Регистрация'}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={styles.input}
          value={handle}
          onChangeText={setHandle}
          placeholder="Ник, например aru.moves"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={31}
        />
        {mode === 'signup' ? (
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Имя (можно позже)"
            placeholderTextColor={colors.textFaint}
            maxLength={60}
          />
        ) : null}
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Пароль, от 6 символов"
          placeholderTextColor={colors.textFaint}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'login' ? 'password' : 'new-password'}
          onSubmitEditing={() => canSubmit && submit()}
        />
        {mode === 'signup' ? (
          <Text style={styles.hint}>Ник: латиница, цифры, точка и _, от 2 до 30 символов.</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.primary, !canSubmit && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit}>
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</Text>}
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => run(() => api.devLogin('demo'))} disabled={busy}>
          <Text style={styles.secondaryText}>Войти как демо</Text>
        </Pressable>
        <Text style={styles.hint}>
          Демо-вход работает, пока на сервере включён режим разработки (DEV_AUTH). Сервер: {API_URL}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: space.xl, gap: space.md },
  logo: { color: colors.accent, fontSize: 44, fontWeight: '800', letterSpacing: -1.5, textAlign: 'center' },
  lead: { color: colors.textMuted, fontSize: font.md, textAlign: 'center', marginBottom: space.lg },
  switch: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3, marginBottom: space.sm },
  switchItem: { flex: 1, paddingVertical: space.sm + 2, alignItems: 'center', borderRadius: radius.md - 2 },
  switchOn: { backgroundColor: colors.surfaceRaised },
  switchText: { color: colors.textMuted, fontWeight: '600', fontSize: font.md },
  input: { backgroundColor: colors.surfaceRaised, color: colors.text, borderRadius: radius.md, padding: space.md + 2, fontSize: font.md },
  hint: { color: colors.textFaint, fontSize: font.sm, lineHeight: 18 },
  error: { color: colors.danger, fontSize: font.sm + 1 },
  primary: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: space.md + 2, alignItems: 'center', marginTop: space.sm },
  primaryText: { color: colors.onAccent, fontWeight: '800', fontSize: font.md + 1 },
  secondary: { borderRadius: radius.md, paddingVertical: space.md + 2, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontWeight: '600', fontSize: font.md },
});

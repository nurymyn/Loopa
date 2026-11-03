import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { api, describeError } from '../lib/api';
import { pickAvatar } from '../lib/pickVideo';
import { useSession } from '../lib/session';
import type { UserSummary } from '../lib/types';
import { colors, font, radius, space } from '../theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const { me, setMe, switchAccount, signOut } = useSession();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [name, setName] = useState(me?.displayName ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<UserSummary[]>([]);

  useEffect(() => {
    api.devAccounts().then((r) => setAccounts(r.items)).catch(() => {});
  }, []);

  const changeAvatar = async () => {
    const file = await pickAvatar();
    if (!file) return;
    setAvatarBusy(true);
    try {
      setMe(await api.uploadAvatar(file));
    } catch (err) {
      Alert.alert('Не удалось загрузить фото', describeError(err));
    } finally {
      setAvatarBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      setMe(await api.updateMe({ displayName: name.trim(), bio: bio.trim() }));
      router.back();
    } catch (err) {
      Alert.alert('Не сохранилось', describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <BackHeader
        title="Изменить профиль"
        right={
          <Pressable onPress={save} disabled={saving || !name.trim()} hitSlop={10}>
            <Text style={[styles.save, (saving || !name.trim()) && { opacity: 0.5 }]}>Готово</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {me ? (
          <Pressable style={styles.avatarRow} onPress={changeAvatar} disabled={avatarBusy}>
            <Avatar user={me} size={96} />
            {avatarBusy ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.avatarLink}>Сменить фото</Text>}
          </Pressable>
        ) : null}
        <Text style={styles.label}>Имя</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={60} placeholderTextColor={colors.textFaint} />
        <Text style={styles.label}>О себе</Text>
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          value={bio}
          onChangeText={setBio}
          maxLength={160}
          multiline
          placeholder="Пара слов о себе"
          placeholderTextColor={colors.textFaint}
        />
        <Text style={styles.counter}>{bio.length}/160</Text>

        <Pressable
          style={styles.logout}
          onPress={() =>
            Alert.alert('Выйти из аккаунта?', undefined, [
              { text: 'Отмена', style: 'cancel' },
              { text: 'Выйти', style: 'destructive', onPress: () => signOut() },
            ])
          }
        >
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>

        <Text style={[styles.label, { marginTop: space.xl }]}>Войти как демо-пользователь (режим разработки)</Text>
        <Text style={styles.hint}>
          Быстрый способ проверить приложение с двух телефонов без регистрации. Работает, пока на сервере DEV_AUTH=true.
        </Text>
        <View style={styles.accounts}>
          {accounts.map((a) => (
            <Pressable
              key={a.id}
              style={[styles.account, a.id === me?.id && styles.accountOn]}
              onPress={async () => {
                await switchAccount(a.handle);
                router.dismissTo('/');
              }}
            >
              <Avatar user={a} size={28} />
              <Text style={styles.accountText}>@{a.handle}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  save: { color: colors.accent, fontWeight: '700', fontSize: font.md },
  body: { padding: space.lg, gap: space.sm },
  label: { color: colors.textMuted, fontSize: font.sm, fontWeight: '600', marginTop: space.md },
  input: { color: colors.text, fontSize: font.md, backgroundColor: colors.surfaceRaised, borderRadius: radius.md, padding: space.md },
  counter: { color: colors.textFaint, fontSize: font.xs, alignSelf: 'flex-end' },
  avatarRow: { alignItems: 'center', gap: space.sm, marginBottom: space.md },
  avatarLink: { color: colors.accent, fontWeight: '600', fontSize: font.sm + 1 },
  logout: { marginTop: space.lg, paddingVertical: space.md, alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  logoutText: { color: colors.danger, fontWeight: '700', fontSize: font.md },
  hint: { color: colors.textFaint, fontSize: font.sm, lineHeight: 18 },
  accounts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  accountOn: { borderWidth: 1, borderColor: colors.accent },
  accountText: { color: colors.text, fontSize: font.sm },
});

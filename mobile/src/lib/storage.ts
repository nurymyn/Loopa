import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Small key-value storage. expo-secure-store on phones (Keychain / Keystore);
 * localStorage on web, where SecureStore is not available. Values must be small
 * (SecureStore warns above 2 KB).
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return globalThis.localStorage?.setItem(key, value);
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
};

export const KEYS = {
  token: 'loopa.token',
  recentSearches: 'loopa.recentSearches',
  muted: 'loopa.muted',
};

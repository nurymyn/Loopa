import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export const MAX_VIDEO_SECONDS = 60;

/** Pick a video from the gallery. Returns its local uri, or null if cancelled. */
export async function pickVideoFromLibrary(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках телефона.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: MAX_VIDEO_SECONDS,
    quality: 1,
  });
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0].uri;
}

/** Pick a square-cropped image for an avatar. */
export async function pickAvatar(): Promise<{ uri: string; name: string; type: string } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках телефона.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  const ext = (a.fileName?.split('.').pop() || a.uri.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
  return { uri: a.uri, name: `avatar.${safeExt}`, type: a.mimeType || `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}` };
}

/** Build the multipart file descriptor React Native's FormData expects. */
export function videoFile(uri: string): { uri: string; name: string; type: string } {
  const ext = (uri.split('?')[0].split('.').pop() || 'mp4').toLowerCase();
  const safe = ['mp4', 'mov', 'm4v', 'webm'].includes(ext) ? ext : 'mp4';
  return { uri, name: `video.${safe}`, type: safe === 'mov' ? 'video/quicktime' : `video/${safe === 'm4v' ? 'mp4' : safe}` };
}

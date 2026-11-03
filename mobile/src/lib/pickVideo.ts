import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export const MAX_VIDEO_SECONDS = 60;

/** Size of a local file in bytes, or null when it cannot be read. */
export function fileSizeBytes(uri: string): number | null {
  try {
    const size = new File(uri).size;
    return size > 0 ? size : null;
  } catch {
    return null;
  }
}

/** Russian message for a video that is over the server's upload limit. */
export function tooLargeMessage(maxUploadMb: number): string {
  return `Видео больше ${maxUploadMb} МБ — сервер его не примет. Снимите ролик короче или выберите видео поменьше.`;
}

/**
 * True when the video fits the server limit. Shows an alert and returns false
 * when it does not, so the caller can skip the upload entirely.
 */
export function checkVideoSize(uri: string, maxUploadMb: number): boolean {
  const size = fileSizeBytes(uri);
  if (size === null || size <= maxUploadMb * 1024 * 1024) return true;
  Alert.alert('Видео слишком большое', tooLargeMessage(maxUploadMb));
  return false;
}

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

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/** true while the current screen is focused (visible and on top). */
export function useFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}

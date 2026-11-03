import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** false while the app is in the background or behind the app switcher. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

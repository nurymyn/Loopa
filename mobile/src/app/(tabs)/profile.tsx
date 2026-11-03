import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileView } from '../../components/ProfileView';
import { useSession } from '../../lib/session';

export default function MyProfileScreen() {
  const insets = useSafeAreaInsets();
  const { me } = useSession();
  if (!me) return null;
  return <ProfileView key={me.handle} handle={me.handle} topInset={insets.top} />;
}

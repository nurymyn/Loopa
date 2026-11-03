import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { BackHeader } from '../../components/BackHeader';
import { ProfileView } from '../../components/ProfileView';
import { colors } from '../../theme';

export default function UserScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackHeader title={`@${handle}`} />
      <ProfileView handle={String(handle)} topInset={0} />
    </View>
  );
}

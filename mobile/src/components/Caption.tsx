import { Text, type TextStyle } from 'react-native';
import { colors } from '../theme';

/** Caption text with #hashtags in bold; tapping a hashtag calls onTag. */
export function Caption({
  text,
  style,
  numberOfLines,
  onTag,
}: {
  text: string;
  style?: TextStyle;
  numberOfLines?: number;
  onTag?: (tag: string) => void;
}) {
  const parts = text.split(/(#[^\s#.,!?;:()"«»]+)/u);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.startsWith('#') && p.length > 1 ? (
          <Text key={i} style={{ fontWeight: '700', color: colors.text }} onPress={onTag ? () => onTag(p.slice(1).toLowerCase()) : undefined}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../lib/session';
import { colors, font, TAB_BAR_HEIGHT } from '../theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = keyof typeof Ionicons.glyphMap;

const ITEMS: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  index: { label: 'Главная', icon: 'home-outline', iconActive: 'home' },
  friends: { label: 'Друзья', icon: 'people-outline', iconActive: 'people' },
  inbox: { label: 'Входящие', icon: 'chatbox-ellipses-outline', iconActive: 'chatbox-ellipses' },
  profile: { label: 'Профиль', icon: 'person-outline', iconActive: 'person' },
};

/**
 * Bottom menu: Главная, Друзья, big "+", Входящие, Профиль.
 * The "+" is not a tab: it opens the publish screen as a modal.
 */
export function TabBar({ state, emitter, navigateToTab, onCreate }: BottomTabBarProps & { onCreate: () => void }) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useSession();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: TAB_BAR_HEIGHT + insets.bottom }]}>
      {state.routes.map((route, i) => {
        if (route.name === 'create') {
          return (
            <Pressable key={route.key} style={styles.item} onPress={onCreate} accessibilityLabel="Опубликовать видео">
              <View style={styles.plus}>
                <Ionicons name="add" size={26} color={colors.onAccent} />
              </View>
            </Pressable>
          );
        }
        const meta = ITEMS[route.name];
        if (!meta) return null;
        const focused = state.index === i;
        return (
          <Pressable
            key={route.key}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
          >
            <View>
              <Ionicons name={focused ? meta.iconActive : meta.icon} size={24} color={focused ? colors.text : colors.textFaint} />
              {route.name === 'inbox' && unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color: focused ? colors.text : colors.textFaint }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: font.xs - 1, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    left: 14,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.like,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  plus: {
    width: 48,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

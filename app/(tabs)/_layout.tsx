import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors, font } from '@/src/ui/theme';

/**
 * The app's three places as iOS's tab bar (spec #22), each tab a stack of its own. Its icons are
 * Phosphor's Sun, PottedPlant and Gear (spec #57) as template PNGs in `assets/tabs`, rendered at
 * 26 pt from `@phosphor-icons/core`, since the native tab bar takes SF Symbols or images only.
 */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.tint} labelStyle={font.semibold}>
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Icon
          renderingMode="template"
          src={{
            default: require('@/assets/tabs/today.png'),
            selected: require('@/assets/tabs/today-selected.png'),
          }}
        />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="garden">
        <NativeTabs.Trigger.Icon
          renderingMode="template"
          src={{
            default: require('@/assets/tabs/garden.png'),
            selected: require('@/assets/tabs/garden-selected.png'),
          }}
        />
        <NativeTabs.Trigger.Label>Garden</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          renderingMode="template"
          src={{
            default: require('@/assets/tabs/settings.png'),
            selected: require('@/assets/tabs/settings-selected.png'),
          }}
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

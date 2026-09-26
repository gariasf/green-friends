import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors, font } from '@/src/ui/theme';

// PROTOTYPE (type and icons): Phosphor's Sun, PottedPlant and Gear as template PNGs
// (assets/tabs, rendered from @phosphor-icons/core at 26 pt), since the native tab bar takes
// SF Symbols or images only.
/** The app's three places as iOS's tab bar (spec #22), each tab a stack of its own. */
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

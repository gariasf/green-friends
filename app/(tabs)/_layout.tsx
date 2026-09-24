import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/src/ui/theme';

/**
 * PROTOTYPE (UI pass): the three places of the app as a native tab bar. Each tab keeps its own
 * stack; a plant, its sheets and New plant open above the tabs from the root stack.
 */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.tint}>
      <NativeTabs.Trigger name="(today)">
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.max', selected: 'sun.max.fill' }} />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="garden">
        <NativeTabs.Trigger.Icon sf={{ default: 'leaf', selected: 'leaf.fill' }} />
        <NativeTabs.Trigger.Label>Garden</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

import { Stack } from 'expo-router';

import { colors } from '@/src/ui/theme';

export default function SettingsStack() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
    </Stack>
  );
}

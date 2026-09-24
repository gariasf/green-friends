import { Stack } from 'expo-router';

import { colors } from '@/src/ui/theme';

export default function TodayStack() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Today' }} />
    </Stack>
  );
}

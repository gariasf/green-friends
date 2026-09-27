import { Stack } from 'expo-router';

import { colors, headerFonts } from '@/src/ui/theme';

export default function TodayStack() {
  return (
    <Stack
      screenOptions={{
        ...headerFonts,
        headerLargeTitleEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Today' }} />
    </Stack>
  );
}

import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/src/ui/Icon';
import { colors, headerFonts, pressedStyle, target } from '@/src/ui/theme';

export default function GardenStack() {
  return (
    <Stack
      screenOptions={{
        ...headerFonts,
        headerLargeTitleEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Garden',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add plant"
              onPress={() => router.push('/plants/new')}
              style={({ pressed }) => [target.icon, pressed && pressedStyle.button]}
            >
              <Icon name="add" size={22} color={colors.tint} weight="bold" />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}

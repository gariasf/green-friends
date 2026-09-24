import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';

import { colors, headerItem, pressedStyle } from '@/src/ui/theme';

export default function GardenStack() {
  return (
    <Stack
      screenOptions={{
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
              style={({ pressed }) => [headerItem.icon, pressed && pressedStyle.button]}
            >
              <SymbolView name="plus" size={22} weight="semibold" tintColor={colors.tint} />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}

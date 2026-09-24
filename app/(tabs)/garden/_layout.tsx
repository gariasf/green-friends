import { Link, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { colors } from '@/src/ui/theme';

export default function GardenStack() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitleEnabled: true,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Garden',
          headerRight: () => (
            <Link href="/plants/new" accessibilityLabel="Add plant">
              <SymbolView name="plus" size={22} weight="semibold" tintColor={colors.tint} />
            </Link>
          ),
        }}
      />
    </Stack>
  );
}

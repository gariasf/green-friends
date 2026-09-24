import { uuid } from 'expo-modules-core';
import { router, Stack, ThemeProvider } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import bundledSpecies from '@/assets/species.json';
import { seedSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { migrate } from '@/src/db/migrate';
import { TextButton } from '@/src/ui/Form';
import { colors, navigationTheme, space } from '@/src/ui/theme';
import { useDigests } from '@/src/ui/useDigests';

// Boot. src/core mints row ids with the standard crypto.randomUUID() so it stays portable
// (ADR-0001); Hermes has no WebCrypto, so it gets Expo's native generator here. Then bring the
// on-device schema to the current version and the Species catalog to the bundled dataset, before
// any screen renders.
// ponytail: randomUUID only; add getRandomValues (expo-crypto) if a dependency ever needs WebCrypto.
globalThis.crypto ??= {} as Crypto;
globalThis.crypto.randomUUID ??= uuid.v4 as Crypto['randomUUID'];
migrate(db);
seedSpecies(db, bundledSpecies);

/**
 * A native bottom sheet as tall as what it holds, for the plant sheet (prototype #6) and a Care
 * Event's edit sheet. Opaque: the iOS 26 glass default turns dark over the dimmed screen.
 */
const SHEET = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents',
  headerShown: false,
  contentStyle: { backgroundColor: colors.sheet },
} as const;

export default function RootLayout() {
  useDigests();
  return (
    <ThemeProvider value={navigationTheme(useColorScheme())}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen
          name="index"
          options={{
            title: 'Today',
            headerRight: () => (
              <View style={styles.headerButtons}>
                <TextButton label="Garden" onPress={() => router.push('/garden')} />
                <TextButton label="Settings" onPress={() => router.push('/settings')} />
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="garden"
          options={{
            title: 'Garden',
            headerRight: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add plant"
                hitSlop={12}
                onPress={() => router.push('/plants/new')}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <SymbolView name="plus" size={22} weight="semibold" tintColor={colors.tint} />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen
          name="plants/new"
          options={{
            title: 'New plant',
            presentation: 'modal',
            headerLeft: () => <TextButton label="Cancel" onPress={() => router.back()} />,
          }}
        />
        <Stack.Screen name="plants/[id]/index" options={SHEET} />
        <Stack.Screen name="care-events/[id]" options={SHEET} />
        <Stack.Screen name="archived" options={{ title: 'Archived' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: space.l },
  pressed: { opacity: 0.5 },
});

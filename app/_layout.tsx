import { uuid } from 'expo-modules-core';
import { router, Stack, ThemeProvider } from 'expo-router';
import { Pressable, Text, useColorScheme } from 'react-native';

import bundledSpecies from '@/assets/species.json';
import { seedSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { migrate } from '@/src/db/migrate';
import { colors, navigationTheme } from '@/src/ui/theme';
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
 * A native bottom sheet as tall as what it holds, for logging care and editing a Care Event, with
 * a grabber. Opaque: the iOS 26 glass default turns dark over the dimmed screen.
 */
const SHEET = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents',
  sheetGrabberVisible: true,
  headerShown: false,
  contentStyle: { backgroundColor: colors.sheet },
} as const;

export default function RootLayout() {
  useDigests();
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="plants/new"
          options={{
            title: 'New plant',
            presentation: 'modal',
            headerLeft: () => (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()}>
                <Text style={{ fontSize: 17, color: colors.tint }}>Cancel</Text>
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="plants/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="plants/[id]/log" options={SHEET} />
        <Stack.Screen name="plants/[id]/edit" options={{ title: 'Edit plant' }} />
        <Stack.Screen name="care-events/[id]" options={SHEET} />
        <Stack.Screen name="archived" options={{ title: 'Archived' }} />
      </Stack>
    </ThemeProvider>
  );
}

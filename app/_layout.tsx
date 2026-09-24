import { uuid } from 'expo-modules-core';
import { router, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import bundledSpecies from '@/assets/species.json';
import { seedSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { migrate } from '@/src/db/migrate';
import { TextButton } from '@/src/ui/Form';
import { colors, headerItem, navigationTheme } from '@/src/ui/theme';
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
 * A native bottom sheet as tall as what it holds, with a grabber, for logging care and editing a
 * Care Event. Opaque: the iOS 26 glass default turns dark over the dimmed screen.
 */
const SHEET = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents',
  sheetGrabberVisible: true,
  headerShown: false,
  contentStyle: { backgroundColor: colors.sheet },
} as const;

/**
 * The tabs, and above them what covers the tab bar: a Plant screen, its sheets, Edit plant,
 * Archived and New plant. Back buttons are chevrons only; a screen over the tabs would otherwise
 * be labelled "(tabs)".
 */
export default function RootLayout() {
  useDigests();
  return (
    <ThemeProvider value={navigationTheme(useColorScheme())}>
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
              <TextButton label="Cancel" onPress={() => router.back()} style={headerItem.text} />
            ),
          }}
        />
        {/* The plant's photo leads the screen and its name follows, so the header has no title. */}
        <Stack.Screen name="plants/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="plants/[id]/log" options={SHEET} />
        <Stack.Screen name="care-events/[id]" options={SHEET} />
        <Stack.Screen name="archived" options={{ title: 'Archived' }} />
      </Stack>
    </ThemeProvider>
  );
}

import { uuid } from 'expo-modules-core';
import { router, Stack, ThemeProvider } from 'expo-router';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import { useColorScheme } from 'react-native';

import bundledSpecies from '@/assets/species.json';
import { seedSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { migrate } from '@/src/db/migrate';
import { TextButton } from '@/src/ui/Form';
import { colors, navigationTheme, headerFonts } from '@/src/ui/theme';
import { useDigests } from '@/src/ui/useDigests';
import { useSync } from '@/src/ui/useSync';

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

/** Each tab's title, as the tabs' layout labels it, by its route. */
const TAB_TITLES: Record<string, string> = {
  '(today)': 'Today',
  garden: 'Garden',
  settings: 'Settings',
};

/**
 * The tabs, and above them what covers the tab bar: a Plant screen, its sheets, Edit plant,
 * Archived and New plant. Back buttons are chevrons only. Long-pressed, one lists the screens
 * beneath by title, where the tabs go by the tab showing rather than "(tabs)".
 */
export default function RootLayout() {
  useDigests();
  useSync();
  return (
    <ThemeProvider value={navigationTheme(useColorScheme())}>
      <Stack
        screenOptions={{
          ...headerFonts,
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={({ route }) => ({
            headerShown: false,
            title: TAB_TITLES[getFocusedRouteNameFromRoute(route) ?? '(today)'],
          })}
        />
        <Stack.Screen
          name="plants/new"
          options={{
            title: 'New plant',
            presentation: 'modal',
            headerLeft: () => <TextButton label="Cancel" header onPress={() => router.back()} />,
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

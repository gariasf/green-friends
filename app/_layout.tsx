import { uuid } from 'expo-modules-core';
import { router, Stack, ThemeProvider, type NativeStackNavigationOptions } from 'expo-router';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import { useColorScheme, useWindowDimensions } from 'react-native';

import bundledSpecies from '@/assets/species.json';
import { seedSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { migrate } from '@/src/db/migrate';
import { useFindMissingFocus } from '@/src/ui/Photo';
import { colors, font, headerFonts, navigationTheme } from '@/src/ui/theme';
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
 * Care Event. Opaque, on the warm raised surface: the iOS 26 glass default turns dark over the
 * dimmed screen.
 */
const SHEET = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents',
  sheetGrabberVisible: true,
  headerShown: false,
  contentStyle: { backgroundColor: colors.sheet },
} as const;

/**
 * A form in a modal, New plant and Edit plant (spec #92): Cancel is iOS's own bar button, so it
 * takes iOS 26's glass and padding, in ink like the back chevrons; the form's `useConfirmDiscard`
 * asks first when it has changes. The form adds its confirm (`confirmItem`, src/ui/Form.tsx).
 */
const MODAL_FORM: NativeStackNavigationOptions = {
  presentation: 'modal',
  unstable_headerLeftItems: () => [
    {
      type: 'button',
      label: 'Cancel',
      labelStyle: { ...font.regular, color: colors.label },
      onPress: () => router.back(),
    },
  ],
};

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
  useFindMissingFocus();
  // React Native never measures text again when the text size changes under a running app, so
  // cards keep the heights of the old size; drawing every screen anew at the new size fixes it.
  const { fontScale } = useWindowDimensions();
  return (
    <ThemeProvider value={navigationTheme(useColorScheme())}>
      <Stack
        key={fontScale}
        screenOptions={{
          ...headerFonts,
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
          // Pushed screens' bars on the ground, without iOS's hairline under them (spec #84).
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={({ route }) => ({
            headerShown: false,
            title: TAB_TITLES[getFocusedRouteNameFromRoute(route) ?? '(today)'],
          })}
        />
        <Stack.Screen name="plants/new" options={{ ...MODAL_FORM, title: 'New plant' }} />
        <Stack.Screen name="plants/[id]/edit" options={MODAL_FORM} />
        {/* The plant's photo leads the screen and its name follows, so the header has no title. */}
        <Stack.Screen name="plants/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="plants/[id]/log" options={SHEET} />
        <Stack.Screen name="care-events/[id]" options={SHEET} />
        <Stack.Screen name="archived" options={{ title: 'Archived' }} />
      </Stack>
    </ThemeProvider>
  );
}

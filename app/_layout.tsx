import { uuid } from 'expo-modules-core';
import { router, Stack, ThemeProvider } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import bundledSpecies from '@/assets/species.json';
import { seedSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { migrate } from '@/src/db/migrate';
import { TextButton } from '@/src/ui/Form';
import { colors, navigationTheme, pressedStyle, space } from '@/src/ui/theme';
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
                <TextButton
                  label="Garden"
                  onPress={() => router.push('/garden')}
                  style={styles.headerButton}
                />
                <TextButton
                  label="Settings"
                  onPress={() => router.push('/settings')}
                  style={styles.headerButton}
                />
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
                onPress={() => router.push('/plants/new')}
                style={({ pressed }) => [styles.headerIcon, pressed && pressedStyle.button]}
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
            headerLeft: () => (
              <TextButton
                label="Cancel"
                onPress={() => router.back()}
                style={styles.headerButton}
              />
            ),
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

// A header button is a 44 pt target by its own size: UIKit, not React Native, decides which touches
// reach a header item, so hitSlop past its edges can't be counted on.
const styles = StyleSheet.create({
  headerButtons: { flexDirection: 'row', gap: space.l },
  headerButton: { minHeight: 44, justifyContent: 'center' },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});

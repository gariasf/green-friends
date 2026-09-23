import { uuid } from 'expo-modules-core';
import { Link, router, Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import bundledSpecies from '@/assets/species.json';
import { seedSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { migrate } from '@/src/db/migrate';

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
 * A native bottom sheet as tall as what it holds (the prototype #6 plant sheet). Opaque: the iOS 26
 * glass default turns dark over the dimmed screen, under text drawn for a light background.
 */
const SHEET = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents',
  headerShown: false,
  contentStyle: { backgroundColor: '#fff' },
} as const;

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Today',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Link href="/garden" style={{ fontSize: 17 }}>
                Garden
              </Link>
              <Link href="/settings" style={{ fontSize: 17 }}>
                Settings
              </Link>
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="garden"
        options={{
          title: 'Garden',
          headerRight: () => (
            <Link href="/plants/new" accessibilityLabel="Add plant" style={{ fontSize: 28 }}>
              +
            </Link>
          ),
        }}
      />
      <Stack.Screen
        name="plants/new"
        options={{
          title: 'New plant',
          presentation: 'modal',
          headerLeft: () => (
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ fontSize: 17 }}>Cancel</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="plants/[id]/index" options={SHEET} />
      <Stack.Screen name="plants/[id]/log" options={{ title: 'Care Log' }} />
      <Stack.Screen name="care-events/[id]" options={SHEET} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}

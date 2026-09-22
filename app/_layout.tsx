import { Link, Stack } from 'expo-router';

import bundledSpecies from '@/assets/species.json';
import { seedSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { migrate } from '@/src/db/migrate';

// Boot: bring the on-device schema to the current version, then the Species catalog to the
// bundled dataset, before any screen renders.
migrate(db);
seedSpecies(db, bundledSpecies);

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Today',
          headerRight: () => (
            <Link href="/settings" accessibilityLabel="Settings" style={{ fontSize: 17 }}>
              Settings
            </Link>
          ),
        }}
      />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}

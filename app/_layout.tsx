import { Link, Stack } from 'expo-router';

import { db } from '@/src/db/client';
import { migrate } from '@/src/db/migrate';

// Boot: bring the on-device schema to the current version before any screen renders.
migrate(db);

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

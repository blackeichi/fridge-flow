import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { UserDatabaseGate } from '@/db/user/user-database-gate';

export default function RootLayout() {
  return (
    <>
      <UserDatabaseGate>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="dark" />
      </UserDatabaseGate>
    </>
  );
}

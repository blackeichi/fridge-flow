import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { UserDatabaseGate } from '@/db/user/user-database-gate';
import { AuthenticationGate } from '@/features/auth/authentication-gate';

export default function RootLayout() {
  return (
    <>
      <UserDatabaseGate>
        <AuthenticationGate>
          <Stack screenOptions={{ headerShown: false }} />
          <StatusBar style="dark" />
        </AuthenticationGate>
      </UserDatabaseGate>
    </>
  );
}

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/authContext';
import { usePushNotifications } from '../src/usePushNotifications';

function RootNavigation() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  usePushNotifications(isAuthenticated);

  useEffect(() => {
    if (isLoading) return;

    // Vérifie si on est dans le groupe d'authentification
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Pas connecté -> Direction Login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Connecté -> Direction App
      router.replace('/(app)/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D0D0D' } }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigation />
    </AuthProvider>
  );
}
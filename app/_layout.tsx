// app/_layout.tsx
import { AuthProvider } from "@/providers/AuthProviders";
import { useAuthStore } from "@/stores/auth";
import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import "../global.css";

function RootLayoutNav() {
  const { user, isLoading } = useAuthStore();
  const prevUserRef = useRef<typeof user | undefined>(undefined);

  useEffect(() => {
    if (isLoading) return;

    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    if (user) {
      // Logged in: go to tabs
      router.replace("/(tabs)");
    } else if (prevUser !== undefined && prevUser !== null && !user) {
      // User just logged OUT (had a user, now null) → go to login
      router.replace("/(auth)/login");
    } else if (prevUser === undefined && !user) {
      // App just started with no session → go to index (get started)
      router.replace("/");
    }
  }, [user, isLoading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="apply" options={{ headerShown: false }} />
      <Stack.Screen name="scan-id" options={{ headerShown: false }} />
      <Stack.Screen name="scan-id-success" options={{ headerShown: false }} />
      <Stack.Screen
        name="face-verification-web"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

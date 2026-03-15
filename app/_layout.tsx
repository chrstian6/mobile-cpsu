// app/_layout.tsx
import { AuthProvider } from "@/providers/AuthProviders";
import { useAuthStore } from "@/stores/auth";
import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import "../global.css";

function RootLayoutNav() {
  const { user, isLoading, sessionExpired } = useAuthStore();
  const prevUserRef = useRef<typeof user | undefined>(undefined);

  // Handle session expiration
  useEffect(() => {
    if (sessionExpired) {
      // Show alert for session expiration
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please log in again.",
        [{ text: "OK" }],
      );
      router.replace("/(auth)/login");
    }
  }, [sessionExpired]);

  // Original navigation logic - completely preserved
  useEffect(() => {
    if (isLoading) return;

    const prevUser = prevUserRef.current;
    prevUserRef.current = user;

    if (user) {
      router.replace("/(tabs)");
    } else if (prevUser !== undefined && prevUser !== null && !user) {
      // User just logged out → go to login
      router.replace("/(auth)/login");
    } else if (prevUser === undefined && !user) {
      // App started with no session → go to get started
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
      <Stack.Screen name="cash-assistance" options={{ headerShown: false }} />
      <Stack.Screen
        name="face-verification-web"
        options={{ headerShown: false }}
      />
      {/* Screens folder routes */}
      <Stack.Screen
        name="screens/application"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="screens/financial-assistance"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="screens/id-details"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="screens/request-device"
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

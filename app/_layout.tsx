import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

// ── Redirects unauthenticated users to login and vice versa ───────────────────
function RouteGuard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [isNavigationReady, setIsNavigationReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure navigation is ready
    const timer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isNavigationReady || isLoading) return;

    const currentSegment = (segments as string[])[0];
    const onAuthScreen = !currentSegment || currentSegment === "index";
    const onTabsScreen = currentSegment === "(tabs)";

    console.log("Route guard:", {
      user: !!user,
      onAuthScreen,
      onTabsScreen,
      currentSegment,
    });

    if (!user && !onAuthScreen) {
      // Not authenticated and not on auth screen -> go to auth
      console.log("Redirecting to auth");
      router.replace("/");
    } else if (user && onAuthScreen) {
      // Authenticated and on auth screen -> go to tabs
      console.log("Redirecting to tabs");
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments, isNavigationReady]);

  if (isLoading || !isNavigationReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#14532d" />
      </View>
    );
  }

  return null;
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RouteGuard />
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

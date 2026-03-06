// app/_layout.tsx
import { AuthProvider } from "@/context/AuthContext";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

// Simple loading screen
function LoadingScreen() {
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

// ── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure everything is loaded
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

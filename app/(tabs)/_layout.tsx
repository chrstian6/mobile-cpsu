// app/(tabs)/_layout.tsx
import { useAuthStore } from "@/stores/auth";
import { Tabs } from "expo-router";
import { Home, IdCard, LayoutGrid } from "lucide-react-native";
import { ActivityIndicator, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const { user, isLoading } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "white",
        }}
      >
        <ActivityIndicator size="large" color="#166534" />
      </View>
    );
  }

  // If no user after loading, don't render tabs
  // The root layout will handle the redirect
  if (!user) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#166534",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#f3f4f6",
          height: Platform.select({
            ios: 70 + (insets.bottom > 0 ? insets.bottom - 10 : 0),
            android: 70 + (insets.bottom > 0 ? insets.bottom : 0),
            default: 70,
          }),
          paddingBottom: Platform.select({
            ios: insets.bottom > 0 ? insets.bottom - 10 : 8,
            android: insets.bottom > 0 ? insets.bottom : 12,
            default: 8,
          }),
          paddingTop: 8,
          backgroundColor: "white",
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          marginBottom: 4,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="id"
        options={{
          title: "My ID",
          tabBarIcon: ({ color, size }) => <IdCard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="service"
        options={{
          title: "Services",
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

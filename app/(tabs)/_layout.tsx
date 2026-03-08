// app/(tabs)/_layout.tsx
import { useAuthStore } from "@/stores/auth";
import { Tabs } from "expo-router";
import { Home, IdCard, LayoutGrid } from "lucide-react-native";
import { ActivityIndicator, View } from "react-native";

export default function TabsLayout() {
  const { user, isLoading } = useAuthStore();

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
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
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

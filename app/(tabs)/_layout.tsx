import { Tabs } from "expo-router";
import { Bell, ClipboardList, Home, User } from "lucide-react-native";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

export default function TabsLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#166534" />
      <View className="flex-1 bg-green-900">
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: "#166534",
            tabBarInactiveTintColor: "#9ca3af",
            tabBarStyle: {
              backgroundColor: "white",
              borderTopWidth: 1,
              borderTopColor: "#e5e7eb",
              height: 60,
              paddingBottom: 8,
              paddingTop: 8,
            },
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
            name="services"
            options={{
              title: "Services",
              tabBarIcon: ({ color, size }) => (
                <ClipboardList size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="notifications"
            options={{
              title: "Alerts",
              tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profile",
              tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
            }}
          />
        </Tabs>
      </View>
    </>
  );
}
// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Bell, ClipboardList, Home, IdCard } from "lucide-react-native";
import { Text, View } from "react-native";

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
              height: 70,
              paddingBottom: 8,
              paddingTop: 8,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: ({ color, size }) => (
                <Home size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="id"
            options={{
              title: "My ID",
              tabBarIcon: ({ color, size, focused }) => (
                <View
                  className={`
                    items-center justify-center
                    bg-green-600 w-14 h-14 rounded-full -mt-8 border-2 border-white
                  `}
                  style={{
                    shadowColor: "#166534",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 8,
                    transform: [{ scale: focused ? 1.05 : 1 }],
                  }}
                >
                  <IdCard size={22} color="white" />
                </View>
              ),
              tabBarLabel: ({ focused }) => (
                <Text
                  style={{
                    color: focused ? "#166534" : "#9ca3af",
                    fontSize: 11,
                    fontWeight: focused ? "600" : "400",
                    marginTop: -4,
                  }}
                >
                  My ID
                </Text>
              ),
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
              tabBarIcon: ({ color, size }) => (
                <Bell size={size} color={color} />
              ),
            }}
          />
          {/* Profile is now a sheet — hide it from the tab bar */}
          <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
      </View>
    </>
  );
}

import { useAuth } from "@/context/AuthContext";
import { Href, router } from "expo-router";
import {
  Calendar,
  ChevronRight,
  HelpCircle,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Settings,
  Shield,
  User,
} from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  // Define menu items with proper typing
  const menuItems: { title: string; icon: any; screen: Href }[] = [
    {
      title: "Personal Information",
      icon: User,
      screen: "/profile/info" as Href,
    },
    {
      title: "Account Settings",
      icon: Settings,
      screen: "/profile/settings" as Href,
    },
    {
      title: "Privacy & Security",
      icon: Shield,
      screen: "/profile/privacy" as Href,
    },
    {
      title: "Help & Support",
      icon: HelpCircle,
      screen: "/profile/help" as Href,
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View className="bg-green-900 pt-8 pb-16 px-6">
          <View className="items-center">
            <View className="w-24 h-24 bg-white rounded-full items-center justify-center mb-4">
              <User size={48} color="#166534" />
            </View>
            <Text className="text-white text-2xl font-bold">
              {user?.first_name} {user?.last_name}
            </Text>
            <Text className="text-white/70 mt-1">{user?.email}</Text>
            <View className="flex-row mt-3">
              <View className="bg-white/20 px-4 py-2 rounded-full">
                <Text className="text-white font-semibold">PDAO Staff</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Profile Info Cards */}
        <View className="px-6 -mt-10">
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            <View className="flex-row items-center mb-4">
              <Mail size={18} color="#6b7280" />
              <Text className="text-gray-600 ml-3 flex-1">{user?.email}</Text>
            </View>
            <View className="flex-row items-center mb-4">
              <Phone size={18} color="#6b7280" />
              <Text className="text-gray-600 ml-3 flex-1">
                +63 912 345 6789
              </Text>
            </View>
            <View className="flex-row items-center mb-4">
              <MapPin size={18} color="#6b7280" />
              <Text className="text-gray-600 ml-3 flex-1">
                PDAO Office, City Hall
              </Text>
            </View>
            <View className="flex-row items-center">
              <Calendar size={18} color="#6b7280" />
              <Text className="text-gray-600 ml-3 flex-1">
                Joined March 2024
              </Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View className="px-6 mt-6">
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={index}
                  className={`flex-row items-center p-4 ${index !== menuItems.length - 1 ? "border-b border-gray-100" : ""}`}
                  onPress={() => router.push(item.screen)}
                >
                  <Icon size={20} color="#166534" />
                  <Text className="flex-1 ml-3 text-gray-900 font-semibold">
                    {item.title}
                  </Text>
                  <ChevronRight size={20} color="#9ca3af" />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Logout Button */}
        <View className="px-6 mt-6 mb-8">
          <Pressable
            className="bg-red-50 border border-red-200 rounded-2xl py-4 flex-row items-center justify-center"
            onPress={handleLogout}
          >
            <LogOut size={20} color="#dc2626" />
            <Text className="text-red-600 font-bold ml-2">Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

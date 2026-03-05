// app/(tabs)/profile.tsx
import { useAuth } from "@/context/AuthContext";
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { Href, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
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
  ShieldCheck,
  ShieldX,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const [hasCard, setHasCard] = useState(false);
  const [cardCheckDone, setCardCheckDone] = useState(false);

  const checkCard = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;
      const res = await fetch(`${EXPRESS_API_BASE}/api/cards/check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setHasCard(data.hasCard || data.is_verified);
    } catch {
      // silently fail
    } finally {
      setCardCheckDone(true);
    }
  }, []);

  useEffect(() => {
    checkCard();
  }, [checkCard]);

  // Also trust the auth context if already verified
  const isVerified = hasCard || user?.is_verified === true;

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

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
        {/* ── Profile Header ── */}
        <View className="bg-green-900 pt-8 pb-16 px-6">
          <View className="items-center">
            <View className="w-24 h-24 bg-white rounded-full items-center justify-center mb-4">
              <User size={48} color="#166534" />
            </View>
            <Text className="text-white text-2xl font-bold">
              {user?.first_name} {user?.last_name}
            </Text>
            <Text className="text-white/70 mt-1">{user?.email}</Text>

            {/* ── Verification Badge ── */}
            <View className="flex-row mt-3 gap-2 items-center">
              {/* Role pill */}
              <View className="bg-white/20 px-4 py-2 rounded-full">
                <Text className="text-white font-semibold">
                  {user?.role ?? "User"}
                </Text>
              </View>

              {/* Verified / Unverified pill */}
              {cardCheckDone &&
                (isVerified ? (
                  <View className="flex-row items-center gap-1.5 bg-green-500/30 border border-green-400/40 px-3 py-2 rounded-full">
                    <ShieldCheck size={13} color="#86efac" />
                    <Text className="text-green-200 text-[12px] font-semibold">
                      Verified
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1.5 bg-red-500/20 border border-red-400/30 px-3 py-2 rounded-full">
                    <ShieldX size={13} color="#fca5a5" />
                    <Text className="text-red-200 text-[12px] font-semibold">
                      Unverified
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        </View>

        {/* ── Verification notice strip (unverified only) ── */}
        {cardCheckDone && !isVerified && (
          <View className="mx-6 -mt-5 mb-1">
            <Pressable
              onPress={() => router.push("/scan-id")}
              className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex-row items-center gap-3"
            >
              <ShieldX size={18} color="#d97706" />
              <View className="flex-1">
                <Text className="text-amber-800 text-[12px] font-bold">
                  PWD ID not yet verified
                </Text>
                <Text className="text-amber-600 text-[11px] mt-0.5">
                  Tap to scan your PWD ID card
                </Text>
              </View>
              <ChevronRight size={16} color="#d97706" />
            </Pressable>
          </View>
        )}

        {/* ── Profile Info Card ── */}
        <View
          className={`px-6 ${cardCheckDone && !isVerified ? "mt-3" : "-mt-10"}`}
        >
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            <View className="flex-row items-center mb-4">
              <Mail size={18} color="#6b7280" />
              <Text className="text-gray-600 ml-3 flex-1">{user?.email}</Text>
            </View>
            <View className="flex-row items-center mb-4">
              <Phone size={18} color="#6b7280" />
              <Text className="text-gray-600 ml-3 flex-1">
                {user?.contact_number ?? "+63 912 345 6789"}
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
                {user?.created_at
                  ? `Joined ${new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
                  : "Joined March 2024"}
              </Text>
            </View>

            {/* PWD ID verified row */}
            {cardCheckDone && (
              <View className="flex-row items-center mt-4 pt-4 border-t border-gray-100">
                {isVerified ? (
                  <ShieldCheck size={18} color="#16a34a" />
                ) : (
                  <ShieldX size={18} color="#dc2626" />
                )}
                <Text
                  className={`ml-3 flex-1 font-semibold text-[13px] ${
                    isVerified ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {isVerified ? "PWD ID Verified" : "PWD ID Not Verified"}
                </Text>
                {!isVerified && (
                  <Pressable
                    onPress={() => router.push("/scan-id")}
                    className="bg-green-700 px-3 py-1.5 rounded-lg"
                  >
                    <Text className="text-white text-[11px] font-semibold">
                      Verify Now
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── Menu Items ── */}
        <View className="px-6 mt-6">
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={index}
                  className={`flex-row items-center p-4 ${
                    index !== menuItems.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  }`}
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

        {/* ── Logout ── */}
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

// app/index.tsx
import { useAuthStore } from "@/stores/auth";
import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ArrowRight,
  FileText,
  Fingerprint,
  Phone,
  Shield,
  ShieldCheck,
  Users,
} from "lucide-react-native";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GetStartedPage() {
  const { user, isLoading } = useAuthStore();

  // Redirect to tabs if already logged in
  if (!isLoading && user) {
    return <Redirect href="/(tabs)" />;
  }

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#14532d" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View className="bg-green-900 min-h-[400px] justify-end overflow-hidden">
          {/* Background decorative circles */}
          <View className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white opacity-5" />
          <View className="absolute top-8 right-10 w-28 h-28 rounded-full bg-white opacity-5" />
          <View className="absolute bottom-10 -left-10 w-40 h-40 rounded-full bg-green-600 opacity-40" />
          <View className="absolute top-20 left-10 w-20 h-20 rounded-full bg-green-500 opacity-30" />

          {/* Header */}
          <View className="absolute top-0 left-0 right-0 px-6 pt-5 pb-3 border-b border-white/10 flex-row items-center gap-2">
            <ShieldCheck
              size={13}
              color="rgba(255,255,255,0.65)"
              strokeWidth={2}
            />
            <Text className="text-white/65 text-xs font-semibold tracking-widest uppercase">
              Republic of the Philippines
            </Text>
          </View>

          {/* Main Hero Content */}
          <View className="px-7 pb-16 pt-10">
            <View className="flex-row items-center gap-4 mb-6">
              <View className="w-20 h-20 rounded-2xl bg-white items-center justify-center p-1.5">
                <Image
                  source={require("../assets/images/logo.png")}
                  className="w-16 h-16 rounded-xl"
                  resizeMode="contain"
                />
              </View>
              <View className="flex-1">
                <Text className="text-white/70 text-xs font-bold tracking-widest uppercase mb-1">
                  PDAO
                </Text>
                <Text className="text-white text-2xl font-extrabold leading-7 tracking-tight">
                  Persons with Disability{"\n"}Affairs Office
                </Text>
              </View>
            </View>

            <Text className="text-white/90 text-xl font-bold mt-4 mb-2">
              Registry & Assistance Management
            </Text>
            <Text className="text-white/70 text-base leading-6">
              Your gateway to PDAO services, benefits, and community support
            </Text>
          </View>

          {/* Curved bottom */}
          <View className="absolute bottom-0 left-0 right-0 h-8 bg-white rounded-t-3xl" />
        </View>

        {/* Features Section */}
        <View className="flex-1 bg-white px-6 pt-8 pb-10">
          {/* Welcome Message */}
          <View className="mb-8">
            <Text className="text-gray-900 text-2xl font-bold tracking-tight">
              Welcome to PDAO-RAM
            </Text>
            <Text className="text-gray-500 text-base mt-2 leading-5">
              Access PDAO services, apply for assistance, and manage your
              profile securely
            </Text>
          </View>

          {/* Features Grid */}
          <View className="flex-row flex-wrap gap-4 mb-8">
            <View className="w-[calc(50%-8px)] bg-green-50 rounded-2xl p-4 border border-green-100">
              <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center mb-3">
                <Users size={24} color="#166534" />
              </View>
              <Text className="text-gray-900 font-bold text-lg mb-1">
                PWD Registry
              </Text>
              <Text className="text-gray-500 text-sm leading-4">
                Official registry of Persons with Disability
              </Text>
            </View>

            <View className="w-[calc(50%-8px)] bg-green-50 rounded-2xl p-4 border border-green-100">
              <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center mb-3">
                <FileText size={24} color="#166534" />
              </View>
              <Text className="text-gray-900 font-bold text-lg mb-1">
                Assistance
              </Text>
              <Text className="text-gray-500 text-sm leading-4">
                Apply for financial and medical assistance
              </Text>
            </View>

            <View className="w-[calc(50%-8px)] bg-green-50 rounded-2xl p-4 border border-green-100">
              <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center mb-3">
                <Fingerprint size={24} color="#166534" />
              </View>
              <Text className="text-gray-900 font-bold text-lg mb-1">
                PhilSys ID
              </Text>
              <Text className="text-gray-500 text-sm leading-4">
                Verify identity with PhilSys integration
              </Text>
            </View>

            <View className="w-[calc(50%-8px)] bg-green-50 rounded-2xl p-4 border border-green-100">
              <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center mb-3">
                <Shield size={24} color="#166534" />
              </View>
              <Text className="text-gray-900 font-bold text-lg mb-1">
                Secure
              </Text>
              <Text className="text-gray-500 text-sm leading-4">
                Bank-level security for your data
              </Text>
            </View>
          </View>

          {/* Call to Action */}
          <Pressable
            className="bg-green-900 py-5 rounded-2xl flex-row items-center justify-center gap-2 active:bg-green-800 mb-6"
            onPress={() => router.push("/(auth)/login")}
          >
            <Text className="text-white text-lg font-extrabold tracking-wide">
              Get Started
            </Text>
            <ArrowRight size={22} color="#ffffff" strokeWidth={2.5} />
          </Pressable>

          {/* Quick Links */}
          <View className="flex-row justify-center gap-4 mb-6">
            <Pressable onPress={() => router.push("/(auth)/login")}>
              <Text className="text-green-800 font-semibold text-base">
                Sign In
              </Text>
            </Pressable>
            <Text className="text-gray-300 text-base">•</Text>
            <Pressable onPress={() => router.push("/(auth)/login")}>
              <Text className="text-green-800 font-semibold text-base">
                Register
              </Text>
            </Pressable>
          </View>

          {/* Help Line */}
          <View className="flex-row items-center justify-center bg-green-50 rounded-2xl py-4 px-5 border border-green-100 gap-2">
            <Phone size={16} color="#166534" strokeWidth={2} />
            <Text className="text-green-900 text-sm font-semibold">
              Need help? PDAO Hotline:{" "}
              <Text className="underline">(123) 456-7890</Text>
            </Text>
          </View>

          {/* Footer */}
          <Text className="text-center text-gray-300 text-xs mt-6 tracking-wide">
            PDAO-RAM v1.0 · Secured by PhilSys
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

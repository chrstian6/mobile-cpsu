// app/scan-id-success.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CheckCircle,
  ChevronLeft,
  CreditCard,
  Heart,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DataRow = ({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string;
  icon?: React.ReactNode;
}) => (
  <View className="flex-row items-center justify-between py-2.5 border-b border-gray-100">
    <View className="flex-row items-center gap-2">
      {icon}
      <Text className="text-xs text-gray-500">{label}</Text>
    </View>
    <Text className="text-xs font-semibold text-gray-900 max-w-[55%] text-right">
      {value || "—"}
    </Text>
  </View>
);

export default function ScanIdSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    card: string;
    matchScore: string;
  }>();

  const card = params.card ? JSON.parse(params.card) : null;
  const matchScore = parseFloat(params.matchScore ?? "0");

  // Animations
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
        <Pressable onPress={() => router.replace("/(tabs)")} className="p-2">
          <ChevronLeft size={20} color="#111827" />
        </Pressable>
        <Text className="flex-1 text-center font-bold text-base text-gray-900 mr-8">
          Verification Complete
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-6 pb-12"
        showsVerticalScrollIndicator={false}
      >
        {/* Success badge */}
        <View className="items-center mb-6">
          <Animated.View
            style={{ transform: [{ scale: scaleAnim }] }}
            className="w-24 h-24 rounded-full bg-green-100 items-center justify-center mb-4"
          >
            <CheckCircle size={52} color="#16A34A" />
          </Animated.View>

          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
            className="items-center"
          >
            <Text className="text-2xl font-extrabold text-gray-900 mb-1">
              Identity Verified!
            </Text>
            <Text className="text-sm text-gray-500 text-center px-8">
              The PWD card has been successfully verified and registered.
            </Text>
          </Animated.View>
        </View>

        {/* Match score card */}
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          className="bg-green-700 rounded-2xl p-4 mb-4"
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <ShieldCheck size={18} color="#fff" />
              <Text className="text-white font-bold text-sm">
                Face Match Result
              </Text>
            </View>
            <View className="bg-white/20 px-2.5 py-1 rounded-full">
              <Text className="text-white text-xs font-bold">APPROVED</Text>
            </View>
          </View>
          <Text className="text-white text-4xl font-extrabold mb-1">
            {(matchScore * 100).toFixed(1)}%
          </Text>
          <View className="h-2 bg-white/30 rounded-full overflow-hidden">
            <View
              className="h-2 bg-white rounded-full"
              style={{ width: `${Math.round(matchScore * 100)}%` }}
            />
          </View>
          <Text className="text-white/70 text-[10px] mt-1.5">
            Face match confidence score
          </Text>
        </Animated.View>

        {/* Card status */}
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          className="bg-white rounded-2xl p-4 mb-4 shadow-sm"
        >
          <View className="flex-row items-center gap-2 mb-3">
            <CreditCard size={16} color="#16A34A" />
            <Text className="font-bold text-sm text-gray-900">
              Card Details
            </Text>
            <View className="ml-auto bg-green-100 px-2.5 py-0.5 rounded-full">
              <Text className="text-[10px] font-bold text-green-700">
                {card?.status ?? "Active"}
              </Text>
            </View>
          </View>

          <DataRow label="Card ID" value={card?.card_id} />
          <DataRow label="Date Issued" value={formatDate(card?.date_issued)} />
          <DataRow
            label="Last Verified"
            value={formatDate(card?.last_verified_at)}
          />
        </Animated.View>

        {/* Personal info */}
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          className="bg-white rounded-2xl p-4 mb-4 shadow-sm"
        >
          <View className="flex-row items-center gap-2 mb-3">
            <User size={16} color="#2563EB" />
            <Text className="font-bold text-sm text-gray-900">
              Personal Information
            </Text>
          </View>

          <DataRow label="Full Name" value={card?.name} />
          <DataRow
            label="Date of Birth"
            value={formatDate(card?.date_of_birth)}
          />
          <DataRow label="Sex" value={card?.sex} />
          <DataRow label="Blood Type" value={card?.blood_type} />
          <DataRow label="Disability" value={card?.type_of_disability} />
        </Animated.View>

        {/* Address & contact */}
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
          className="bg-white rounded-2xl p-4 mb-6 shadow-sm"
        >
          <View className="flex-row items-center gap-2 mb-3">
            <MapPin size={16} color="#7C3AED" />
            <Text className="font-bold text-sm text-gray-900">
              Address & Emergency
            </Text>
          </View>

          <DataRow label="Barangay" value={card?.barangay} />
          <DataRow label="Address" value={card?.address} />
          <DataRow
            label="Emergency Contact"
            value={card?.emergency_contact_name}
          />
          <DataRow label="Contact No." value={card?.emergency_contact_number} />
        </Animated.View>

        {/* Done button */}
        <Pressable
          className="flex-row items-center justify-center gap-2 bg-green-700 py-4 rounded-2xl"
          onPress={() => router.replace("/(tabs)")}
        >
          <Heart size={16} color="#fff" />
          <Text className="text-white font-bold text-base">Done</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

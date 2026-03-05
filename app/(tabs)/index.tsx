// app/(tabs)/index.tsx
import { useAuth } from "@/context/AuthContext";
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Bell, ChevronRight } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";
const { width } = Dimensions.get("window");

const ads = [
  {
    id: 1,
    uri: "https://ncda.gov.ph/wp-content/uploads/2024/06/Tarpaulin-NDRW-final-1-scaled.jpg",
  },
  {
    id: 2,
    uri: "https://ncda.gov.ph/wp-content/uploads/2024/06/Tarpaulin-NDRW-final-1-scaled.jpg",
  },
  {
    id: 3,
    uri: "https://ncda.gov.ph/wp-content/uploads/2024/06/Tarpaulin-NDRW-final-1-scaled.jpg",
  },
];

const banners = [
  {
    id: 1,
    title: "Medical Mission",
    description: "Free check-up and medicines for all registered PWDs",
    date: "March 15, 2024",
    location: "PDAO Office",
    tag: "Health",
  },
  {
    id: 2,
    title: "Assistance Distribution",
    description: "Monthly financial assistance disbursement",
    date: "March 20, 2024",
    location: "Municipal Hall",
    tag: "Financial",
  },
  {
    id: 3,
    title: "PWD Registration",
    description: "New applicants welcome every Friday",
    date: "Every Friday",
    location: "PDAO Office",
    tag: "Registration",
  },
];

const recentActivities = [
  { id: 1, action: "New registration", name: "Maria Santos", time: "2h ago" },
  {
    id: 2,
    action: "Application approved",
    name: "Juan Dela Cruz",
    time: "5h ago",
  },
  { id: 3, action: "ID claimed", name: "Pedro Penduko", time: "1d ago" },
];

const announcements = [
  {
    id: 1,
    title: "Medical Mission",
    date: "March 15, 2024",
    location: "PDAO Office",
    description: "Free check-up and medicines for all registered PWDs.",
  },
  {
    id: 2,
    title: "Assistance Distribution",
    date: "March 20, 2024",
    location: "Municipal Hall",
    description: "Monthly financial assistance disbursement.",
  },
];

const services = [
  {
    id: 1,
    tag: "Financial Aid",
    title: "Cash\nAssistance",
    description: "Apply for financial support",
  },
  {
    id: 2,
    tag: "Equipment",
    title: "Request\nDevices",
    description: "Wheelchair, cane & more",
  },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const bannerRef = useRef<FlatList>(null);
  const adRef = useRef<FlatList>(null);

  // ── Card check state ──────────────────────────────────────────────────────
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
    } catch (err) {
      console.log("[card check error]", err);
    } finally {
      setCardCheckDone(true);
    }
  }, []);

  useEffect(() => {
    checkCard();
  }, [checkCard]);

  useEffect(() => {
    if (user?.is_verified) {
      setHasCard(true);
      setCardCheckDone(true);
    }
  }, [user?.is_verified]);

  // ── Carousels ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const next = (currentBannerIndex + 1) % banners.length;
      setCurrentBannerIndex(next);
      bannerRef.current?.scrollToIndex({ index: next, animated: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [currentBannerIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (currentAdIndex + 1) % ads.length;
      setCurrentAdIndex(next);
      adRef.current?.scrollToIndex({ index: next, animated: true });
    }, 3500);
    return () => clearInterval(interval);
  }, [currentAdIndex]);

  const renderAd = ({ item }: { item: (typeof ads)[0] }) => (
    <View style={{ width }} className="px-6">
      <Image
        source={{ uri: item.uri }}
        style={{ width: "100%", height: 110, borderRadius: 14 }}
        resizeMode="cover"
      />
    </View>
  );

  const renderBanner = ({ item }: { item: (typeof banners)[0] }) => (
    <View style={{ width: width - 48 }} className="mx-3">
      <View className="bg-green-800 rounded-2xl p-6">
        <Text className="text-green-300 text-[11px] font-medium tracking-widest uppercase mb-4">
          {item.tag}
        </Text>
        <Text className="text-white text-[22px] font-bold tracking-tight leading-tight mb-2">
          {item.title}
        </Text>
        <Text className="text-white/50 text-[13px] leading-[19px] mb-5">
          {item.description}
        </Text>
        <View className="flex-row gap-1">
          <Text className="text-white/35 text-[12px]">{item.date}</Text>
          <Text className="text-white/35 text-[12px]">·</Text>
          <Text className="text-white/35 text-[12px]">{item.location}</Text>
        </View>
      </View>
    </View>
  );

  const showRegistrationNotice = cardCheckDone && !hasCard;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View className="px-6 pt-5 pb-5">
          <View className="flex-row justify-between items-center">
            <Pressable className="justify-center gap-1.5 py-1">
              <View className="w-6 h-0.5 bg-gray-800 rounded-full" />
              <View className="w-4 h-0.5 bg-gray-800 rounded-full" />
            </Pressable>
            <Pressable className="relative">
              <View className="w-10 h-10 items-center justify-center">
                <Bell size={17} color="#374151" />
              </View>
              <View className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-green-600 border-2 border-white" />
            </Pressable>
          </View>

          {/* ── Registration notice ── */}
          {showRegistrationNotice && (
            <View className="mt-5 bg-gray-50 rounded-2xl p-4">
              <Text className="text-gray-800 text-[13px] font-semibold mb-1">
                Complete your registration
              </Text>
              <Text className="text-gray-400 text-[12px] leading-[18px] mb-4">
                Apply for a PWD ID or scan your existing card to link your
                record.
              </Text>
              <View className="flex-row gap-2">
                {/* ── Apply Now → /apply ── */}
                <Pressable
                  onPress={() => router.push("/apply")}
                  className="flex-1 bg-green-800 rounded-xl py-2.5 items-center"
                >
                  <Text className="text-white text-[13px] font-semibold">
                    Apply Now
                  </Text>
                  <Text className="text-green-300/80 text-[10px] mt-0.5">
                    New applicant
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/scan-id")}
                  className="flex-1 bg-white border border-gray-200 rounded-xl py-2.5 items-center"
                >
                  <Text className="text-gray-700 text-[13px] font-semibold">
                    Scan PWD ID
                  </Text>
                  <Text className="text-gray-400 text-[10px] mt-0.5">
                    Already have one?
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Verified badge ── */}
          {cardCheckDone && hasCard && (
            <View className="mt-5 bg-green-50 rounded-2xl p-4 border border-green-100">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
                  <Text className="text-green-700 text-base">✓</Text>
                </View>
                <View>
                  <Text className="text-green-800 text-[13px] font-bold">
                    PWD ID Verified
                  </Text>
                  <Text className="text-green-600 text-[11px] mt-0.5">
                    Your identity has been verified successfully.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Ads Carousel ── */}
        <View className="mb-1">
          <FlatList
            ref={adRef}
            data={ads}
            renderItem={renderAd}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            snapToInterval={width}
            snapToAlignment="start"
            decelerationRate="fast"
            onMomentumScrollEnd={(e) =>
              setCurrentAdIndex(
                Math.round(e.nativeEvent.contentOffset.x / width),
              )
            }
            keyExtractor={(item) => item.id.toString()}
          />
          <View className="flex-row justify-center mt-2.5 gap-1">
            {ads.map((_, i) => (
              <View
                key={i}
                className={`h-1 rounded-full ${i === currentAdIndex ? "w-4 bg-gray-300" : "w-1 bg-gray-200"}`}
              />
            ))}
          </View>
        </View>

        {/* ── Upcoming Events ── */}
        <View className="mt-7">
          <Text className="text-gray-900 text-[16px] font-bold tracking-tight px-6 mb-3">
            Upcoming Events
          </Text>
          <FlatList
            ref={bannerRef}
            data={banners}
            renderItem={renderBanner}
            horizontal
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            snapToInterval={width - 48}
            snapToAlignment="center"
            decelerationRate="fast"
            onMomentumScrollEnd={(e) =>
              setCurrentBannerIndex(
                Math.round(e.nativeEvent.contentOffset.x / (width - 48)),
              )
            }
            keyExtractor={(item) => item.id.toString()}
          />
          <View className="flex-row justify-center mt-3 gap-1">
            {banners.map((_, i) => (
              <View
                key={i}
                className={`h-1 rounded-full ${i === currentBannerIndex ? "w-5 bg-green-800" : "w-1 bg-gray-200"}`}
              />
            ))}
          </View>
        </View>

        {/* ── Services ── */}
        <View className="px-6 mt-8">
          <Text className="text-gray-900 text-[16px] font-bold tracking-tight mb-3">
            Services
          </Text>
          <View className="flex-row gap-3">
            {services.map((s) => (
              <Pressable
                key={s.id}
                className="flex-1 bg-gray-50 rounded-2xl p-5 border border-gray-100"
              >
                <View className="self-start bg-white border border-gray-200 rounded-lg px-2.5 py-1 mb-4">
                  <Text className="text-gray-500 text-[10px] font-medium tracking-wide">
                    {s.tag}
                  </Text>
                </View>
                <Text className="text-gray-900 text-[15px] font-bold leading-tight mb-1.5">
                  {s.title}
                </Text>
                <Text className="text-gray-400 text-[11px] leading-[15px]">
                  {s.description}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Recent Activities ── */}
        <View className="px-6 mt-8">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-gray-900 text-[16px] font-bold tracking-tight">
              Recent Activities
            </Text>
            <Pressable className="flex-row items-center gap-0.5">
              <Text className="text-green-800 text-[12px] font-medium">
                View All
              </Text>
              <ChevronRight size={13} color="#166534" />
            </Pressable>
          </View>
          <View className="rounded-2xl border border-gray-100 overflow-hidden">
            {recentActivities.map((activity, index) => (
              <View
                key={activity.id}
                className={`flex-row items-center px-4 py-3.5 bg-white ${index !== recentActivities.length - 1 ? "border-b border-gray-50" : ""}`}
              >
                <View className="w-0.5 h-8 bg-gray-200 rounded-full mr-4" />
                <View className="flex-1">
                  <Text className="text-gray-800 text-[13px] font-semibold">
                    {activity.action}
                  </Text>
                  <Text className="text-gray-400 text-[11px] mt-0.5">
                    {activity.name}
                  </Text>
                </View>
                <Text className="text-gray-300 text-[11px]">
                  {activity.time}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Announcements ── */}
        <View className="px-6 mt-8 mb-10">
          <Text className="text-gray-900 text-[16px] font-bold tracking-tight mb-3">
            Announcements
          </Text>
          {announcements.map((item, index) => (
            <Pressable
              key={item.id}
              className={`bg-white py-5 ${index !== announcements.length - 1 ? "border-b border-gray-100" : ""}`}
            >
              <View className="flex-row justify-between items-start mb-1.5">
                <Text className="text-gray-900 text-[14px] font-bold flex-1 mr-4">
                  {item.title}
                </Text>
                <Text className="text-green-800 text-[12px] font-medium">
                  Details →
                </Text>
              </View>
              <Text className="text-gray-400 text-[12px] mb-2.5">
                {item.date} · {item.location}
              </Text>
              <Text className="text-gray-500 text-[13px] leading-[19px]">
                {item.description}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

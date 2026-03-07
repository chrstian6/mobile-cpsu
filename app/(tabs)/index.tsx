// app/(tabs)/index.tsx
import { ProfileSheet } from "@/components/profile/ProfileSheet";
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  XCircle,
} from "lucide-react-native";
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

type UserStatus =
  | "loading"
  | "verified"
  | "pending_card"
  | "pending_application"
  | "approved_application"
  | "rejected_application"
  | "cancelled_application"
  | "new_user";

type StatusVariant =
  | "success"
  | "warning"
  | "info"
  | "error"
  | "neutral"
  | "muted";

const STATUS_PALETTE: Record<
  StatusVariant,
  {
    bg: string;
    border: string;
    iconBg: string;
    iconColor: string;
    labelColor: string;
    sublabelColor: string;
    badgeBg: string;
    badgeDot: string;
    badgeText: string;
    badgeTextColor: string;
    accentBar: string;
  }
> = {
  success: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "#059669",
    labelColor: "text-emerald-900",
    sublabelColor: "text-emerald-600",
    badgeBg: "bg-emerald-100",
    badgeDot: "bg-emerald-500",
    badgeText: "Active",
    badgeTextColor: "text-emerald-700",
    accentBar: "bg-emerald-400",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "#D97706",
    labelColor: "text-amber-900",
    sublabelColor: "text-amber-600",
    badgeBg: "bg-amber-100",
    badgeDot: "bg-amber-400",
    badgeText: "Pending",
    badgeTextColor: "text-amber-700",
    accentBar: "bg-amber-400",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "#2563EB",
    labelColor: "text-blue-900",
    sublabelColor: "text-blue-600",
    badgeBg: "bg-blue-100",
    badgeDot: "bg-blue-400",
    badgeText: "In Review",
    badgeTextColor: "text-blue-700",
    accentBar: "bg-blue-400",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    iconBg: "bg-red-100",
    iconColor: "#DC2626",
    labelColor: "text-red-900",
    sublabelColor: "text-red-600",
    badgeBg: "bg-red-100",
    badgeDot: "bg-red-400",
    badgeText: "Action Needed",
    badgeTextColor: "text-red-700",
    accentBar: "bg-red-400",
  },
  neutral: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    iconBg: "bg-gray-100",
    iconColor: "#6B7280",
    labelColor: "text-gray-900",
    sublabelColor: "text-gray-500",
    badgeBg: "bg-gray-100",
    badgeDot: "bg-gray-400",
    badgeText: "Inactive",
    badgeTextColor: "text-gray-600",
    accentBar: "bg-gray-300",
  },
  muted: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    iconBg: "bg-slate-100",
    iconColor: "#94A3B8",
    labelColor: "text-slate-700",
    sublabelColor: "text-slate-400",
    badgeBg: "bg-slate-100",
    badgeDot: "bg-slate-300",
    badgeText: "Loading",
    badgeTextColor: "text-slate-500",
    accentBar: "bg-slate-200",
  },
};

interface StatusConfig {
  variant: StatusVariant;
  icon: any;
  label: string;
  sublabel: string;
  showActions: boolean;
  primaryAction?: { label: string; screen: string };
  secondaryAction?: { label: string; screen: string };
}

const getStatusConfig = (s: UserStatus): StatusConfig => {
  switch (s) {
    case "verified":
      return {
        variant: "success",
        icon: CheckCircle2,
        label: "PWD ID Verified",
        sublabel: "Your identification is active and valid",
        showActions: false,
      };
    case "pending_card":
      return {
        variant: "warning",
        icon: Clock,
        label: "Card Under Verification",
        sublabel: "Your physical ID is being processed by the PDAO office",
        showActions: false,
      };
    case "approved_application":
      return {
        variant: "success",
        icon: CheckCircle2,
        label: "Application Approved",
        sublabel: "Your application has been approved — ID issuance is next",
        showActions: false,
      };
    case "pending_application":
      return {
        variant: "info",
        icon: FileText,
        label: "Application Under Review",
        sublabel: "Your application is being reviewed by the PDAO office",
        showActions: false,
      };
    case "rejected_application":
      return {
        variant: "error",
        icon: XCircle,
        label: "Application Rejected",
        sublabel:
          "Your application did not meet the requirements. You may reapply.",
        showActions: true,
        primaryAction: { label: "Reapply Now", screen: "/apply" },
      };
    case "cancelled_application":
      return {
        variant: "neutral",
        icon: AlertCircle,
        label: "Application Cancelled",
        sublabel:
          "This application was cancelled. Submit a new one to continue.",
        showActions: true,
        primaryAction: { label: "New Application", screen: "/apply" },
      };
    case "new_user":
      return {
        variant: "error",
        icon: AlertTriangle,
        label: "Registration Incomplete",
        sublabel:
          "Submit an application or scan your existing PWD ID to get started",
        showActions: true,
        primaryAction: { label: "Apply Now", screen: "/apply" },
        secondaryAction: { label: "Scan ID", screen: "/scan-id" },
      };
    default:
      return {
        variant: "muted",
        icon: Clock,
        label: "Checking Status…",
        sublabel: "Please wait while we retrieve your information",
        showActions: false,
      };
  }
};

function StatusCard({ userStatus }: { userStatus: UserStatus }) {
  const config = getStatusConfig(userStatus);
  const palette = STATUS_PALETTE[config.variant];
  const Icon = config.icon;

  return (
    <View
      className={`${palette.bg} border ${palette.border} rounded-2xl overflow-hidden`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View className={`h-[3px] w-full ${palette.accentBar}`} />
      <View className="p-4">
        <View className="flex-row items-start gap-3">
          <View
            className={`w-10 h-10 rounded-xl items-center justify-center ${palette.iconBg} mt-0.5`}
          >
            <Icon size={20} color={palette.iconColor} strokeWidth={2} />
          </View>
          <View className="flex-1">
            <Text
              className={`${palette.labelColor} text-[14px] font-bold tracking-tight`}
            >
              {config.label}
            </Text>
            <Text
              className={`${palette.sublabelColor} text-[12px] leading-[17px] mt-0.5`}
            >
              {config.sublabel}
            </Text>
          </View>
          <View
            className={`${palette.badgeBg} rounded-full px-2.5 py-1 flex-row items-center gap-1.5`}
          >
            <View className={`w-1.5 h-1.5 rounded-full ${palette.badgeDot}`} />
            <Text
              className={`${palette.badgeTextColor} text-[10px] font-semibold tracking-wide`}
            >
              {palette.badgeText}
            </Text>
          </View>
        </View>
        {config.showActions && (
          <>
            <View className="h-px bg-black/5 my-3.5 mx-1" />
            <View className="flex-row gap-2">
              {config.primaryAction && (
                <Pressable
                  onPress={() =>
                    router.push(config.primaryAction!.screen as any)
                  }
                  className={`flex-1 rounded-xl py-2.5 items-center justify-center ${config.variant === "error" ? "bg-red-600" : config.variant === "neutral" ? "bg-gray-700" : "bg-green-700"}`}
                  style={{
                    shadowColor:
                      config.variant === "error" ? "#DC2626" : "#166534",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Text className="text-white text-[13px] font-semibold tracking-tight">
                    {config.primaryAction.label}
                  </Text>
                </Pressable>
              )}
              {config.secondaryAction && (
                <Pressable
                  onPress={() =>
                    router.push(config.secondaryAction!.screen as any)
                  }
                  className="flex-1 rounded-xl py-2.5 items-center justify-center bg-white border border-gray-200"
                >
                  <Text className="text-gray-700 text-[13px] font-semibold tracking-tight">
                    {config.secondaryAction.label}
                  </Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { user, logout } = useAuthStore();
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const bannerRef = useRef<FlatList>(null);
  const adRef = useRef<FlatList>(null);
  const [userStatus, setUserStatus] = useState<UserStatus>("loading");
  const [statusCheckDone, setStatusCheckDone] = useState(false);
  const [profileSheetVisible, setProfileSheetVisible] = useState(false);

  // Close the sheet first, then call logout.
  // The store's logout() shows the Alert confirmation.
  // After confirm, user → null triggers _layout.tsx → router.replace("/(auth)/login")
  const handleLogout = () => {
    setProfileSheetVisible(false);
    setTimeout(() => {
      logout();
    }, 300);
  };

  const checkUserStatus = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;

      const cardRes = await fetch(`${EXPRESS_API_BASE}/api/cards/check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cardRes.ok) {
        const cardData = await cardRes.json();
        if (cardData.card) {
          setUserStatus(
            cardData.is_verified === true || user?.is_verified === true
              ? "verified"
              : "pending_card",
          );
          setStatusCheckDone(true);
          return;
        }
      }

      const appRes = await fetch(`${EXPRESS_API_BASE}/api/applications/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (appRes.ok) {
        const appData = await appRes.json();
        if (appData.applications?.length > 0) {
          const latestApp = appData.applications[0];
          const map: Record<string, UserStatus> = {
            Approved: "approved_application",
            Rejected: "rejected_application",
            Cancelled: "cancelled_application",
            Draft: "pending_application",
            Submitted: "pending_application",
            "Under Review": "pending_application",
          };
          setUserStatus(map[latestApp.status] ?? "pending_application");
          setStatusCheckDone(true);
          return;
        }
      }

      setUserStatus("new_user");
      setStatusCheckDone(true);
    } catch (err) {
      console.log("[home] Status check error:", err);
      setUserStatus("new_user");
      setStatusCheckDone(true);
    }
  }, [user?.is_verified]);

  useEffect(() => {
    checkUserStatus();
  }, [checkUserStatus]);

  useEffect(() => {
    if (user?.is_verified === true && userStatus !== "verified") {
      setUserStatus("verified");
    }
  }, [user?.is_verified, userStatus]);

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

  if (!user) return null;

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

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-2 pb-2">
          <View className="flex-row justify-between items-center">
            <Pressable
              onPress={() => setProfileSheetVisible(true)}
              className="justify-center gap-1.5 py-3 pr-3"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View className="w-6 h-0.5 bg-gray-800 rounded-full" />
              <View className="w-4 h-0.5 bg-gray-800 rounded-full" />
            </Pressable>
            <Pressable className="relative">
              <View className="w-10 h-10 items-center justify-center">
                <Bell size={17} color="#374151" />
              </View>
              <View className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-600 border-2 border-white" />
            </Pressable>
          </View>
        </View>

        {statusCheckDone && (
          <View className="px-6 mt-2 mb-4">
            <StatusCard userStatus={userStatus} />
          </View>
        )}

        {/* Ads Carousel */}
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

        {/* Upcoming Events */}
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

        {/* Services */}
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

        {/* Recent Activities */}
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

        {/* Announcements */}
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

      <ProfileSheet
        visible={profileSheetVisible}
        onClose={() => setProfileSheetVisible(false)}
        onLogout={handleLogout}
        userStatus={userStatus}
        user={user}
      />
    </SafeAreaView>
  );
}

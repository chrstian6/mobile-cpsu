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
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";
const { width } = Dimensions.get("window");

// ── Static data ───────────────────────────────────────────────────────────────

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

const services: {
  id: number;
  tag: string;
  title: string;
  description: string;
  route?: string;
}[] = [
  {
    id: 1,
    tag: "Financial Aid",
    title: "Cash\nAssistance",
    description: "Apply for financial support",
    route: "/cash-assistance",
  },
  {
    id: 2,
    tag: "Equipment",
    title: "Request\nDevices",
    description: "Wheelchair, cane, and other devices",
    route: "/screens/request-device",
  },
];

// ── Event type ────────────────────────────────────────────────────────────────

interface IEvent {
  _id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  description: string;
  year: string;
  isActive: boolean;
}

// ── Event banner color palette — cycles by index ──────────────────────────────

const EVENT_PALETTES = [
  { bg: "bg-green-800", tag: "text-green-300", meta: "text-white/40" },
  { bg: "bg-blue-800", tag: "text-blue-300", meta: "text-white/40" },
  { bg: "bg-purple-800", tag: "text-purple-300", meta: "text-white/40" },
  { bg: "bg-amber-700", tag: "text-amber-300", meta: "text-white/40" },
];

const formatEventDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

// ── Status config ─────────────────────────────────────────────────────────────

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

// ── StatusCard ────────────────────────────────────────────────────────────────

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

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, logout } = useAuthStore();
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const bannerRef = useRef<FlatList>(null);
  const adRef = useRef<FlatList>(null);
  const [userStatus, setUserStatus] = useState<UserStatus>("loading");
  const [statusCheckDone, setStatusCheckDone] = useState(false);
  const [profileSheetVisible, setProfileSheetVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Events state ──────────────────────────────────────────────────────
  const [events, setEvents] = useState<IEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const handleLogout = () => {
    setProfileSheetVisible(false);
    setTimeout(() => logout(), 300);
  };

  // ── Fetch active events ───────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;

      const res = await fetch(
        `${EXPRESS_API_BASE}/api/events?active=true&limit=10`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const list: IEvent[] = Array.isArray(data)
          ? data
          : (data.events ?? data.data ?? []);
        setEvents(list);
      }
    } catch (err) {
      console.log("[home] Events fetch error:", err);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  // ── Fetch unread count ────────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;
      const res = await fetch(
        `${EXPRESS_API_BASE}/api/notifications/unread-count`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const count =
          typeof data.count === "number"
            ? data.count
            : typeof data.data?.count === "number"
              ? data.data.count
              : 0;
        setUnreadCount(count);
      }
    } catch (err) {
      console.log("[home] Notification count fetch error:", err);
    }
  }, []);

  // ── Check user status ─────────────────────────────────────────────────
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([checkUserStatus(), fetchUnreadCount(), fetchEvents()]);
    setRefreshing(false);
  }, [checkUserStatus, fetchUnreadCount, fetchEvents]);

  // Initial load
  useEffect(() => {
    checkUserStatus();
    fetchUnreadCount();
    fetchEvents();
  }, [checkUserStatus, fetchUnreadCount, fetchEvents]);

  useEffect(() => {
    if (user?.is_verified === true && userStatus !== "verified")
      setUserStatus("verified");
  }, [user?.is_verified, userStatus]);

  // Auto-scroll ads
  useEffect(() => {
    const interval = setInterval(() => {
      const next = (currentAdIndex + 1) % ads.length;
      setCurrentAdIndex(next);
      adRef.current?.scrollToIndex({ index: next, animated: true });
    }, 3500);
    return () => clearInterval(interval);
  }, [currentAdIndex]);

  // Auto-scroll events banner — only when events are loaded
  useEffect(() => {
    if (events.length <= 1) return;
    const interval = setInterval(() => {
      const next = (currentBannerIndex + 1) % events.length;
      setCurrentBannerIndex(next);
      bannerRef.current?.scrollToIndex({ index: next, animated: true });
    }, 5000);
    return () => clearInterval(interval);
  }, [currentBannerIndex, events.length]);

  // Reset banner index on fresh event load
  useEffect(() => {
    setCurrentBannerIndex(0);
  }, [events.length]);

  if (!user) return null;

  // ── Render helpers ────────────────────────────────────────────────────

  const renderAd = ({ item }: { item: (typeof ads)[0] }) => (
    <View style={{ width }} className="px-6">
      <Image
        source={{ uri: item.uri }}
        style={{ width: "100%", height: 110, borderRadius: 14 }}
        resizeMode="cover"
      />
    </View>
  );

  const renderEventBanner = ({
    item,
    index,
  }: {
    item: IEvent;
    index: number;
  }) => {
    const palette = EVENT_PALETTES[index % EVENT_PALETTES.length];
    return (
      <View style={{ width: width - 48 }} className="mx-3">
        <View className={`${palette.bg} rounded-2xl p-6`}>
          {/* Date + time row */}
          <View className="flex-row items-center gap-2 mb-3">
            <View className="flex-row items-center gap-1.5">
              <Calendar size={11} color="rgba(255,255,255,0.55)" />
              <Text
                className={`${palette.tag} text-[11px] font-semibold tracking-widest uppercase`}
              >
                {formatEventDate(item.date)}
              </Text>
            </View>
            {!!item.time && (
              <>
                <Text className="text-white/30 text-[10px]">·</Text>
                <Text className={`${palette.tag} text-[11px] font-medium`}>
                  {item.time}
                </Text>
              </>
            )}
          </View>

          {/* Title */}
          <Text className="text-white text-[22px] font-bold tracking-tight leading-tight mb-2">
            {item.title}
          </Text>

          {/* Description */}
          <Text
            className="text-white/50 text-[13px] leading-[19px] mb-5"
            numberOfLines={2}
          >
            {item.description}
          </Text>

          {/* Location */}
          {!!item.location && (
            <View className="flex-row items-center gap-1.5">
              <MapPin size={12} color="rgba(255,255,255,0.4)" />
              <Text className={`${palette.meta} text-[12px]`}>
                {item.location}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderEventsSection = () => {
    if (eventsLoading) {
      return (
        <View className="items-center justify-center py-10">
          <ActivityIndicator size="small" color="#166534" />
          <Text className="text-gray-400 text-[12px] mt-2">
            Loading events...
          </Text>
        </View>
      );
    }

    if (events.length === 0) {
      return (
        <View className="mx-6 bg-gray-50 rounded-2xl p-6 items-center border border-gray-100">
          <View className="w-10 h-10 bg-gray-100 rounded-xl items-center justify-center mb-3">
            <Calendar size={20} color="#9CA3AF" />
          </View>
          <Text className="text-gray-500 text-[13px] font-medium text-center">
            No upcoming events at the moment
          </Text>
          <Text className="text-gray-400 text-[11px] text-center mt-1">
            Check back later for new events
          </Text>
        </View>
      );
    }

    return (
      <>
        <FlatList
          ref={bannerRef}
          data={events}
          renderItem={renderEventBanner}
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
          keyExtractor={(item) => item._id}
        />
        {events.length > 1 && (
          <View className="flex-row justify-center mt-3 gap-1">
            {events.map((_, i) => (
              <View
                key={i}
                className={`h-1 rounded-full ${
                  i === currentBannerIndex
                    ? "w-5 bg-green-800"
                    : "w-1 bg-gray-200"
                }`}
              />
            ))}
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#166534"
            colors={["#166534"]}
            title="Pull to refresh"
            titleColor="#166534"
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
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

            {/* Bell with unread dot */}
            <Pressable
              className="relative"
              onPress={() => router.push("/screens/notifications" as any)}
            >
              <View className="w-10 h-10 items-center justify-center">
                <Bell size={17} color="#374151" />
              </View>
              {unreadCount > 0 && (
                <View
                  className="absolute top-1 right-1 bg-red-500 border-2 border-white rounded-full items-center justify-center"
                  style={{
                    minWidth: unreadCount > 9 ? 18 : 14,
                    height: unreadCount > 9 ? 18 : 14,
                    paddingHorizontal: unreadCount > 9 ? 3 : 0,
                  }}
                >
                  {unreadCount > 9 ? (
                    <Text
                      style={{ fontSize: 9, lineHeight: 12 }}
                      className="text-white font-bold"
                    >
                      9+
                    </Text>
                  ) : null}
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── Status Card ────────────────────────────────────────────────── */}
        {statusCheckDone && (
          <View className="px-6 mt-2 mb-4">
            <StatusCard userStatus={userStatus} />
          </View>
        )}

        {/* ── Ads ────────────────────────────────────────────────────────── */}
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
                className={`h-1 rounded-full ${
                  i === currentAdIndex ? "w-4 bg-gray-300" : "w-1 bg-gray-200"
                }`}
              />
            ))}
          </View>
        </View>

        {/* ── Upcoming Events (dynamic) ───────────────────────────────────── */}
        <View className="mt-7">
          <View className="flex-row items-center justify-between px-6 mb-3">
            <Text className="text-gray-900 text-[16px] font-bold tracking-tight">
              Upcoming Events
            </Text>
            {!eventsLoading && events.length > 0 && (
              <View className="bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <Text className="text-green-700 text-[10px] font-semibold">
                  {`${events.length} event${events.length !== 1 ? "s" : ""}`}
                </Text>
              </View>
            )}
          </View>
          {renderEventsSection()}
        </View>

        {/* ── Services ───────────────────────────────────────────────────── */}
        <View className="px-6 mt-8">
          <Text className="text-gray-900 text-[16px] font-bold tracking-tight mb-3">
            Services
          </Text>
          <View className="flex-row gap-3">
            {services.map((s) => (
              <Pressable
                key={s.id}
                className="flex-1 bg-gray-50 rounded-2xl p-5 border border-gray-100 active:bg-gray-100"
                onPress={
                  s.route ? () => router.push(s.route as any) : undefined
                }
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
                {s.route && (
                  <View className="flex-row items-center mt-3 gap-1">
                    <Text className="text-green-700 text-[11px] font-semibold">
                      {s.id === 2 ? "Request Now" : "Apply Now"}
                    </Text>
                    <ChevronRight size={11} color="#15803d" strokeWidth={2.5} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── Recent Activities ───────────────────────────────────────────── */}
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
                className={`flex-row items-center px-4 py-3.5 bg-white ${
                  index !== recentActivities.length - 1
                    ? "border-b border-gray-50"
                    : ""
                }`}
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

        {/* ── Announcements ───────────────────────────────────────────────── */}
        <View className="px-6 mt-8 mb-10">
          <Text className="text-gray-900 text-[16px] font-bold tracking-tight mb-3">
            Announcements
          </Text>
          {announcements.map((item, index) => (
            <Pressable
              key={item.id}
              className={`bg-white py-5 ${
                index !== announcements.length - 1
                  ? "border-b border-gray-100"
                  : ""
              }`}
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
                {`${item.date} · ${item.location}`}
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

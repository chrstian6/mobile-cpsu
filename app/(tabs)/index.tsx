// app/(tabs)/index.tsx
import { useAuth } from "@/context/AuthContext";
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { Href, useRouter } from "expo-router";
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
  HelpCircle,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Settings,
  Shield,
  User,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";
const { width, height } = Dimensions.get("window");

// ─── Static data ───────────────────────────────────────────────────────────

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

// ─── Types ─────────────────────────────────────────────────────────────────

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

// ─── Status palette (home status card) ────────────────────────────────────

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

// ─── Home Status Card ──────────────────────────────────────────────────────

function StatusCard({
  userStatus,
  router,
}: {
  userStatus: UserStatus;
  router: any;
}) {
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
                  onPress={() => router.push(config.primaryAction!.screen)}
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
                  onPress={() => router.push(config.secondaryAction!.screen)}
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

// ─── Profile Sheet badge tokens ────────────────────────────────────────────

const BADGE_TOKENS: Record<
  UserStatus,
  {
    headerBg: string;
    headerBorder: string;
    headerDot: string;
    headerText: string;
    rowIconBg: string;
    rowIconColor: string;
    rowTextColor: string;
    rowDot: string;
    label: string;
  }
> = {
  loading: {
    headerBg: "bg-white/10",
    headerBorder: "border-white/20",
    headerDot: "bg-white/30",
    headerText: "text-white/50",
    rowIconBg: "bg-slate-100",
    rowIconColor: "#94A3B8",
    rowTextColor: "text-slate-500",
    rowDot: "bg-slate-300",
    label: "Loading…",
  },
  verified: {
    headerBg: "bg-emerald-500/30",
    headerBorder: "border-emerald-400/40",
    headerDot: "bg-emerald-400",
    headerText: "text-emerald-200",
    rowIconBg: "bg-emerald-100",
    rowIconColor: "#059669",
    rowTextColor: "text-emerald-700",
    rowDot: "bg-emerald-500",
    label: "PWD ID Verified",
  },
  pending_card: {
    headerBg: "bg-amber-500/30",
    headerBorder: "border-amber-400/40",
    headerDot: "bg-amber-400",
    headerText: "text-amber-200",
    rowIconBg: "bg-amber-100",
    rowIconColor: "#D97706",
    rowTextColor: "text-amber-700",
    rowDot: "bg-amber-400",
    label: "Card Pending",
  },
  pending_application: {
    headerBg: "bg-blue-500/30",
    headerBorder: "border-blue-400/40",
    headerDot: "bg-blue-400",
    headerText: "text-blue-200",
    rowIconBg: "bg-blue-100",
    rowIconColor: "#2563EB",
    rowTextColor: "text-blue-700",
    rowDot: "bg-blue-400",
    label: "Under Review",
  },
  approved_application: {
    headerBg: "bg-emerald-500/30",
    headerBorder: "border-emerald-400/40",
    headerDot: "bg-emerald-400",
    headerText: "text-emerald-200",
    rowIconBg: "bg-emerald-100",
    rowIconColor: "#059669",
    rowTextColor: "text-emerald-700",
    rowDot: "bg-emerald-500",
    label: "App. Approved",
  },
  rejected_application: {
    headerBg: "bg-red-500/20",
    headerBorder: "border-red-400/30",
    headerDot: "bg-red-400",
    headerText: "text-red-200",
    rowIconBg: "bg-red-100",
    rowIconColor: "#DC2626",
    rowTextColor: "text-red-700",
    rowDot: "bg-red-400",
    label: "Rejected",
  },
  cancelled_application: {
    headerBg: "bg-gray-500/20",
    headerBorder: "border-gray-400/30",
    headerDot: "bg-gray-400",
    headerText: "text-gray-300",
    rowIconBg: "bg-gray-100",
    rowIconColor: "#6B7280",
    rowTextColor: "text-gray-600",
    rowDot: "bg-gray-400",
    label: "Cancelled",
  },
  new_user: {
    headerBg: "bg-red-500/20",
    headerBorder: "border-red-400/30",
    headerDot: "bg-red-400",
    headerText: "text-red-200",
    rowIconBg: "bg-red-100",
    rowIconColor: "#DC2626",
    rowTextColor: "text-red-600",
    rowDot: "bg-red-400",
    label: "Not Registered",
  },
};

const STATUS_ICON: Record<UserStatus, any> = {
  loading: Clock,
  verified: CheckCircle2,
  pending_card: Clock,
  pending_application: FileText,
  approved_application: CheckCircle2,
  rejected_application: XCircle,
  cancelled_application: XCircle,
  new_user: AlertTriangle,
};

// ─── Profile Sheet ─────────────────────────────────────────────────────────

function ProfileSheet({
  visible,
  onClose,
  userStatus,
  router,
  user,
  logout,
}: {
  visible: boolean;
  onClose: () => void;
  userStatus: UserStatus;
  router: any;
  user: any;
  logout: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(-width)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Staggered content animations: header, info card, menu, logout
  const contentAnims = useRef(
    [0, 1, 2, 3].map(() => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(-24),
    })),
  ).current;

  useEffect(() => {
    if (visible) {
      // Reset content anims before opening
      contentAnims.forEach(({ opacity, translateX: tx }) => {
        opacity.setValue(0);
        tx.setValue(-24);
      });

      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 200,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Stagger content items in after drawer lands
        Animated.stagger(
          60,
          contentAnims.map(({ opacity, translateX: tx }) =>
            Animated.parallel([
              Animated.timing(opacity, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
              }),
              Animated.spring(tx, {
                toValue: 0,
                useNativeDriver: true,
                damping: 20,
                stiffness: 220,
              }),
            ]),
          ),
        ).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -width,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const t = BADGE_TOKENS[userStatus];
  const Icon = STATUS_ICON[userStatus];

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

  const infoRows: { icon: any; value: string }[] = [
    { icon: Mail, value: user?.email ?? "No email on file" },
    { icon: Phone, value: user?.contact_number ?? "+63 912 345 6789" },
    { icon: MapPin, value: "PDAO Office, City Hall" },
    {
      icon: Calendar,
      value: user?.created_at
        ? `Joined ${new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
        : "Joined March 2024",
    },
  ];

  const handleLogout = async () => {
    await logout();
    // Navigation will be handled by the HomeScreen useEffect
  };

  const handleMenuNav = (screen: Href) => {
    onClose();
    setTimeout(() => router.push(screen), 300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          opacity: backdropOpacity,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          transform: [{ translateX }],
          width: width * 0.82,
          backgroundColor: "#f9fafb",

          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          shadowColor: "#000",
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          elevation: 20,
        }}
      >
        {/* Drawer title bar */}
        <View className="px-5 pt-4 pb-3">
          <Text className="text-gray-900 text-[16px] font-bold tracking-tight">
            My Profile
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {/* [0] Profile header */}
          <Animated.View
            style={{
              opacity: contentAnims[0].opacity,
              transform: [{ translateX: contentAnims[0].translateX }],
            }}
          >
            <View className="bg-green-900 mx-4 mt-1 rounded-2xl px-5 pt-6 pb-5">
              <View className="flex-row items-center gap-4">
                <View
                  className="w-14 h-14 bg-white rounded-full items-center justify-center"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.12,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                >
                  <User size={28} color="#166534" />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-[17px] font-bold tracking-tight">
                    {user?.first_name} {user?.last_name}
                  </Text>
                  <Text className="text-white/50 text-[12px] mt-0.5">
                    {user?.email}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2 mt-4">
                <View className="bg-white/15 border border-white/20 px-3 py-1.5 rounded-full">
                  <Text className="text-white text-[11px] font-semibold tracking-wide">
                    {user?.role ?? "User"}
                  </Text>
                </View>
                <View
                  className={`flex-row items-center gap-1.5 ${t.headerBg} border ${t.headerBorder} px-3 py-1.5 rounded-full`}
                >
                  <View className={`w-1.5 h-1.5 rounded-full ${t.headerDot}`} />
                  <Text
                    className={`${t.headerText} text-[11px] font-semibold tracking-wide`}
                  >
                    {t.label}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* [1] Info card */}
          <Animated.View
            style={{
              opacity: contentAnims[1].opacity,
              transform: [{ translateX: contentAnims[1].translateX }],
            }}
            className="mx-4 mt-4"
          >
            <View
              className="bg-white rounded-2xl overflow-hidden"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              {infoRows.map((row, i) => {
                const RowIcon = row.icon;
                return (
                  <View
                    key={i}
                    className={`flex-row items-center px-4 py-3 ${i !== infoRows.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    <View className="w-7 h-7 bg-gray-50 rounded-lg items-center justify-center mr-3">
                      <RowIcon size={13} color="#9ca3af" />
                    </View>
                    <Text className="text-gray-600 text-[13px] flex-1">
                      {row.value}
                    </Text>
                  </View>
                );
              })}
              <View
                className={`flex-row items-center px-4 py-3 border-t border-gray-100 ${t.rowIconBg}`}
              >
                <View
                  className={`w-7 h-7 ${t.rowIconBg} rounded-lg items-center justify-center mr-3`}
                >
                  <Icon size={13} color={t.rowIconColor} strokeWidth={2} />
                </View>
                <Text
                  className={`${t.rowTextColor} text-[13px] font-semibold flex-1`}
                >
                  {t.label}
                </Text>
                <View className={`w-2 h-2 rounded-full ${t.rowDot}`} />
              </View>
            </View>
          </Animated.View>

          {/* [2] Menu */}
          <Animated.View
            style={{
              opacity: contentAnims[2].opacity,
              transform: [{ translateX: contentAnims[2].translateX }],
            }}
            className="mx-4 mt-4"
          >
            <View
              className="bg-white rounded-2xl overflow-hidden"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              {menuItems.map((item, index) => {
                const MenuIcon = item.icon;
                return (
                  <Pressable
                    key={index}
                    className={`flex-row items-center px-4 py-3.5 ${index !== menuItems.length - 1 ? "border-b border-gray-50" : ""}`}
                    onPress={() => handleMenuNav(item.screen)}
                  >
                    <View className="w-7 h-7 bg-green-50 rounded-lg items-center justify-center mr-3">
                      <MenuIcon size={13} color="#166534" />
                    </View>
                    <Text className="flex-1 text-gray-800 text-[14px] font-semibold">
                      {item.title}
                    </Text>
                    <ChevronRight size={15} color="#d1d5db" />
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* [3] Sign out */}
          <Animated.View
            style={{
              opacity: contentAnims[3].opacity,
              transform: [{ translateX: contentAnims[3].translateX }],
            }}
            className="mx-4 mt-4 mb-4"
          >
            <Pressable
              className="bg-red-50 border border-red-100 rounded-2xl py-3.5 flex-row items-center justify-center gap-2"
              onPress={handleLogout}
            >
              <LogOut size={16} color="#dc2626" />
              <Text className="text-red-600 text-[14px] font-bold tracking-tight">
                Sign Out
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const bannerRef = useRef<FlatList>(null);
  const adRef = useRef<FlatList>(null);

  const [userStatus, setUserStatus] = useState<UserStatus>("loading");
  const [statusCheckDone, setStatusCheckDone] = useState(false);
  const [profileSheetVisible, setProfileSheetVisible] = useState(false);

  // Check if user exists, if not redirect to auth - but only once
  useEffect(() => {
    console.log("HomeScreen - user check:", {
      user: !!user,
      hasRedirected: hasRedirected.current,
    });

    if (!user && !hasRedirected.current) {
      console.log("No user found in HomeScreen, redirecting to auth NOW");
      hasRedirected.current = true;

      // Use setTimeout to ensure navigation happens after state updates
      setTimeout(() => {
        router.replace("/");
      }, 50);
    }

    // Reset flag when user becomes available
    if (user) {
      console.log("User available in HomeScreen, resetting redirect flag");
      hasRedirected.current = false;
    }
  }, [user]);

  // Force a re-check when user becomes null
  useEffect(() => {
    if (!user) {
      console.log("HomeScreen - user is null, forcing redirect check");
      // This will trigger the first useEffect again
    }
  }, [user]);

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
    if (user) {
      checkUserStatus();
    }
  }, [user, checkUserStatus]);

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

  // Don't render anything if there's no user
  if (!user) {
    console.log("HomeScreen - rendering null because no user");
    return null;
  }

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
            {/* Hamburger → opens profile sheet */}
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

        {/* Status Card */}
        {statusCheckDone && (
          <View className="px-6 mt-2 mb-4">
            <StatusCard userStatus={userStatus} router={router} />
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
            onMomentumScrollEnd={(e) => {
              setCurrentAdIndex(
                Math.round(e.nativeEvent.contentOffset.x / width),
              );
            }}
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
            onMomentumScrollEnd={(e) => {
              setCurrentBannerIndex(
                Math.round(e.nativeEvent.contentOffset.x / (width - 48)),
              );
            }}
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

      {/* Profile Sheet */}
      <ProfileSheet
        visible={profileSheetVisible}
        onClose={() => setProfileSheetVisible(false)}
        userStatus={userStatus}
        router={router}
        user={user}
        logout={logout}
      />
    </SafeAreaView>
  );
}

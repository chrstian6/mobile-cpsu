// components/profile/ProfileContent.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Href, router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.254.100:3001";

type UserStatus =
  | "loading"
  | "verified"
  | "pending_card"
  | "pending_application"
  | "approved_application"
  | "rejected_application"
  | "cancelled_application"
  | "new_user";

interface BadgeTokens {
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

const BADGE_TOKENS: Record<UserStatus, BadgeTokens> = {
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

function HeaderStatusBadge({ status }: { status: UserStatus }) {
  const t = BADGE_TOKENS[status];
  return (
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
  );
}

function InfoRowStatus({ status }: { status: UserStatus }) {
  const t = BADGE_TOKENS[status];
  const Icon = STATUS_ICON[status];
  return (
    <View
      className={`flex-row items-center px-5 py-3.5 border-t border-gray-100 ${t.rowIconBg}`}
    >
      <View
        className={`w-8 h-8 ${t.rowIconBg} rounded-lg items-center justify-center mr-3`}
      >
        <Icon size={15} color={t.rowIconColor} strokeWidth={2} />
      </View>
      <Text className={`${t.rowTextColor} text-[13px] font-semibold flex-1`}>
        {t.label}
      </Text>
      <View className={`w-2 h-2 rounded-full ${t.rowDot}`} />
    </View>
  );
}

interface ProfileContentProps {
  onClose?: () => void;
  showHeader?: boolean;
  onLogout?: () => void;
}

export function ProfileContent({
  onClose,
  showHeader = true,
  onLogout,
}: ProfileContentProps) {
  const { user, logout } = useAuthStore();
  const [userStatus, setUserStatus] = useState<UserStatus>("loading");
  const [statusCheckDone, setStatusCheckDone] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      console.log("[profile] Status check error:", err);
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

  if (!user) return null;

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    if (onLogout) {
      if (onClose) onClose();
      onLogout();
      return;
    }
    if (onClose) {
      onClose();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await logout();
  };

  const handleMenuNav = (screen: Href) => {
    if (onClose) onClose();
    setTimeout(() => router.push(screen), 300);
  };

  // ── Menu items — Settings and Help & Support removed ─────────────────
  const menuItems: { title: string; icon: any; screen: Href }[] = [
    {
      title: "Personal Information",
      icon: User,
      screen: "/profile/info" as Href,
    },
    {
      title: "Privacy & Security",
      icon: Shield,
      screen: "/profile/privacy" as Href,
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

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* ── Header ── */}
      {showHeader && (
        <View className="bg-green-900 pt-10 pb-16 px-6">
          <View className="items-center">
            <View
              className="w-24 h-24 bg-white rounded-full items-center justify-center mb-4"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <User size={44} color="#166534" />
            </View>
            <Text className="text-white text-[22px] font-bold tracking-tight">
              {user?.first_name} {user?.last_name}
            </Text>
            <Text className="text-white/50 text-[13px] mt-1">
              {user?.email}
            </Text>
            <View className="flex-row mt-3.5 gap-2 items-center">
              <View className="bg-white/15 border border-white/20 px-3 py-1.5 rounded-full">
                <Text className="text-white text-[11px] font-semibold tracking-wide">
                  {user?.role ?? "User"}
                </Text>
              </View>
              <HeaderStatusBadge status={userStatus} />
            </View>
          </View>
        </View>
      )}

      {/* ── Profile Info Card ── */}
      <View className={`${showHeader ? "mx-5 -mt-6" : "mx-5 mt-5"} mb-5`}>
        <View
          className="bg-white rounded-2xl overflow-hidden"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          {infoRows.map((row, i) => {
            const Icon = row.icon;
            return (
              <View
                key={i}
                className={`flex-row items-center px-5 py-3.5 ${
                  i !== infoRows.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <View className="w-8 h-8 bg-gray-50 rounded-lg items-center justify-center mr-3">
                  <Icon size={15} color="#9ca3af" />
                </View>
                <Text className="text-gray-600 text-[13px] flex-1">
                  {row.value}
                </Text>
              </View>
            );
          })}
          <InfoRowStatus status={userStatus} />
        </View>
      </View>

      {/* ── Menu ── */}
      <View className="px-5">
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
            const Icon = item.icon;
            return (
              <Pressable
                key={index}
                className={`flex-row items-center px-5 py-4 ${
                  index !== menuItems.length - 1
                    ? "border-b border-gray-50"
                    : ""
                }`}
                onPress={() => handleMenuNav(item.screen)}
              >
                <View className="w-8 h-8 bg-green-50 rounded-lg items-center justify-center mr-3">
                  <Icon size={15} color="#166534" />
                </View>
                <Text className="flex-1 text-gray-800 text-[14px] font-semibold">
                  {item.title}
                </Text>
                <ChevronRight size={16} color="#d1d5db" />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Logout ── */}
      <View className="px-5 mt-5 mb-10">
        <Pressable
          className={`bg-red-50 border border-red-100 rounded-2xl py-4 flex-row items-center justify-center gap-2 ${
            isLoggingOut ? "opacity-50" : ""
          }`}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut size={17} color="#dc2626" />
          <Text className="text-red-600 text-[14px] font-bold tracking-tight">
            {isLoggingOut ? "Signing Out..." : "Sign Out"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

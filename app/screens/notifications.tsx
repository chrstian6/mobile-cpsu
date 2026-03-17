// app/screens/notifications.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

type NotificationType =
  | "application_submitted"
  | "application_approved"
  | "application_rejected"
  | "application_under_review"
  | "pwd_number_assigned"
  | "reminder"
  | "bulk_notification"
  | "custom_message";

type NotificationStatus = "unread" | "read" | "archived";
type NotificationPriority = "low" | "normal" | "high" | "urgent";

interface INotification {
  _id: string;
  notification_id: string;
  user_id: string;
  application_id?: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  read_at?: string;
  action_url?: string;
  action_text?: string;
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const getTypeConfig = (type: NotificationType) => {
  const configs: Record<
    NotificationType,
    { icon: any; iconColor: string; iconBg: string; accentColor: string }
  > = {
    application_submitted: {
      icon: FileText,
      iconColor: "#2563EB",
      iconBg: "#EFF6FF",
      accentColor: "#BFDBFE",
    },
    application_approved: {
      icon: CheckCircle2,
      iconColor: "#059669",
      iconBg: "#ECFDF5",
      accentColor: "#A7F3D0",
    },
    application_rejected: {
      icon: XCircle,
      iconColor: "#DC2626",
      iconBg: "#FEF2F2",
      accentColor: "#FECACA",
    },
    application_under_review: {
      icon: RefreshCw,
      iconColor: "#D97706",
      iconBg: "#FFFBEB",
      accentColor: "#FDE68A",
    },
    pwd_number_assigned: {
      icon: CheckCircle2,
      iconColor: "#7C3AED",
      iconBg: "#F5F3FF",
      accentColor: "#DDD6FE",
    },
    reminder: {
      icon: Clock,
      iconColor: "#0891B2",
      iconBg: "#ECFEFF",
      accentColor: "#A5F3FC",
    },
    bulk_notification: {
      icon: Bell,
      iconColor: "#374151",
      iconBg: "#F9FAFB",
      accentColor: "#E5E7EB",
    },
    custom_message: {
      icon: MessageSquare,
      iconColor: "#15803D",
      iconBg: "#F0FDF4",
      accentColor: "#BBF7D0",
    },
  };
  return configs[type] ?? configs.custom_message;
};

const getPriorityDot = (priority: NotificationPriority) => {
  const map: Record<NotificationPriority, string> = {
    urgent: "bg-red-500",
    high: "bg-orange-400",
    normal: "bg-blue-400",
    low: "bg-gray-300",
  };
  return map[priority] ?? "bg-gray-300";
};

const formatTimeAgo = (dateStr: string): string => {
  const now = Date.now();
  const diff = Math.floor((now - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
};

const groupByDate = (
  notifications: INotification[],
): { title: string; data: INotification[] }[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, INotification[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Earlier: [],
  };

  for (const n of notifications) {
    const d = new Date(n.created_at);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) groups["Today"].push(n);
    else if (d.getTime() === yesterday.getTime()) groups["Yesterday"].push(n);
    else if (d >= weekAgo) groups["This Week"].push(n);
    else groups["Earlier"].push(n);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([title, data]) => ({ title, data }));
};

// ── Notification Item ─────────────────────────────────────────────────────────

function NotificationItem({
  item,
  onMarkRead,
  onDelete,
}: {
  item: INotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const tc = getTypeConfig(item.type);
  const Icon = tc.icon;
  const isUnread = item.status === "unread";

  return (
    <Pressable
      onPress={() => {
        if (isUnread) onMarkRead(item.notification_id);
      }}
      className={`flex-row gap-3 px-5 py-4 active:opacity-70 ${isUnread ? "bg-white" : "bg-gray-50/60"}`}
      style={
        isUnread
          ? {
              borderLeftWidth: 3,
              borderLeftColor: tc.accentColor,
            }
          : { borderLeftWidth: 3, borderLeftColor: "transparent" }
      }
    >
      {/* Icon */}
      <View
        className="w-10 h-10 rounded-xl items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: tc.iconBg }}
      >
        <Icon size={18} color={tc.iconColor} strokeWidth={2} />
      </View>

      {/* Content */}
      <View className="flex-1 min-w-0">
        <View className="flex-row items-start justify-between gap-2 mb-0.5">
          <Text
            className={`flex-1 text-[13px] leading-[18px] ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-600"}`}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <View className="flex-row items-center gap-1.5 shrink-0">
            {isUnread && (
              <View
                className={`w-2 h-2 rounded-full ${getPriorityDot(item.priority)}`}
              />
            )}
            <Text className="text-gray-400 text-[10px]">
              {formatTimeAgo(item.created_at)}
            </Text>
          </View>
        </View>

        <Text
          className="text-gray-500 text-[12px] leading-[17px]"
          numberOfLines={2}
        >
          {item.message}
        </Text>

        {/* Action row */}
        <View className="flex-row items-center justify-between mt-2">
          {item.action_text ? (
            <Text
              className="text-[11px] font-semibold"
              style={{ color: tc.iconColor }}
            >
              {item.action_text} →
            </Text>
          ) : (
            <View />
          )}
          <Pressable
            onPress={() => onDelete(item.notification_id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="p-1"
          >
            <Trash2 size={13} color="#D1D5DB" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        setError("Not authenticated");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/notifications/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(
          d.error || `Failed to fetch notifications (${res.status})`,
        );
      }

      const data = await res.json();
      // Support both { notifications } and { data } response shapes
      const list: INotification[] =
        data.notifications ?? data.data ?? data ?? [];
      setNotifications(list);
      setError(null);
    } catch (err: any) {
      console.error("[notifications] fetch error:", err);
      if (!silent) setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(true);
  }, [fetchNotifications]);

  // ── Mark single as read ─────────────────────────────────────────────────
  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notificationId
            ? { ...n, status: "read", read_at: new Date().toISOString() }
            : n,
        ),
      );

      try {
        const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
        if (!token) return;
        await fetch(
          `${EXPRESS_API_BASE}/api/notifications/${notificationId}/read`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (err) {
        console.error("[notifications] mark read error:", err);
        // Revert on failure
        fetchNotifications(true);
      }
    },
    [fetchNotifications],
  );

  // ── Mark all as read ────────────────────────────────────────────────────
  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.status === "unread"
          ? { ...n, status: "read", read_at: new Date().toISOString() }
          : n,
      ),
    );

    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;
      await fetch(`${EXPRESS_API_BASE}/api/notifications/mark-all-read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("[notifications] mark all read error:", err);
      fetchNotifications(true);
    } finally {
      setMarkingAll(false);
    }
  }, [unreadCount, fetchNotifications]);

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = useCallback(
    (notificationId: string) => {
      Alert.alert("Delete Notification", "Remove this notification?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // Optimistic update
            setNotifications((prev) =>
              prev.filter((n) => n.notification_id !== notificationId),
            );
            try {
              const token =
                await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
              if (!token) return;
              await fetch(
                `${EXPRESS_API_BASE}/api/notifications/${notificationId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
            } catch (err) {
              console.error("[notifications] delete error:", err);
              fetchNotifications(true);
            }
          },
        },
      ]);
    },
    [fetchNotifications],
  );

  // ── Derived list ────────────────────────────────────────────────────────
  const filtered =
    filter === "unread"
      ? notifications.filter((n) => n.status === "unread")
      : notifications;

  const grouped = groupByDate(filtered);

  // Build flat list data: section headers + items interleaved
  type ListRow =
    | { kind: "header"; title: string; key: string }
    | { kind: "item"; item: INotification; key: string };

  const listData: ListRow[] = [];
  for (const group of grouped) {
    listData.push({
      kind: "header",
      title: group.title,
      key: `hdr-${group.title}`,
    });
    for (const n of group.data) {
      listData.push({ kind: "item", item: n, key: n._id });
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-400 text-[13px] mt-3">
            Loading notifications...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View className="bg-white border-b border-gray-100">
        <View className="flex-row items-center gap-3 px-5 pt-3 pb-3">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
          >
            <ArrowLeft size={18} color="#374151" strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
              Notifications
            </Text>
            {unreadCount > 0 && (
              <Text className="text-gray-400 text-[12px] mt-0.5">
                {`${unreadCount} unread`}
              </Text>
            )}
          </View>
          {unreadCount > 0 && (
            <Pressable
              onPress={handleMarkAllRead}
              disabled={markingAll}
              className="flex-row items-center gap-1.5 bg-green-50 border border-green-200 px-3 py-2 rounded-xl"
            >
              {markingAll ? (
                <ActivityIndicator size="small" color="#166534" />
              ) : (
                <CheckCheck size={14} color="#166534" />
              )}
              <Text className="text-green-700 text-[12px] font-semibold">
                Mark all read
              </Text>
            </Pressable>
          )}
        </View>

        {/* Filter tabs */}
        <View className="flex-row px-5 pb-3 gap-2">
          {(["all", "unread"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-full border ${
                filter === tab
                  ? "bg-green-900 border-green-900"
                  : "bg-white border-gray-200"
              }`}
            >
              <Text
                className={`text-[12px] font-semibold capitalize ${
                  filter === tab ? "text-white" : "text-gray-500"
                }`}
              >
                {tab === "unread"
                  ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`
                  : "All"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {error ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-14 h-14 bg-red-50 rounded-2xl items-center justify-center mb-4">
            <AlertCircle size={24} color="#DC2626" />
          </View>
          <Text className="text-gray-900 text-[15px] font-bold text-center mb-2">
            Something went wrong
          </Text>
          <Text className="text-gray-400 text-[13px] text-center mb-6">
            {error}
          </Text>
          <Pressable
            onPress={() => fetchNotifications()}
            className="bg-green-900 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>
        </View>
      ) : listData.length === 0 ? (
        /* ── Empty state ──────────────────────────────────────────────── */
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 bg-gray-100 rounded-3xl items-center justify-center mb-4">
            <BellOff size={32} color="#9CA3AF" />
          </View>
          <Text className="text-gray-900 text-[17px] font-bold text-center mb-2">
            {filter === "unread" ? "All caught up!" : "No notifications yet"}
          </Text>
          <Text className="text-gray-400 text-[13px] text-center leading-5">
            {filter === "unread"
              ? "You have no unread notifications."
              : "Notifications about your applications and requests will appear here."}
          </Text>
          {filter === "unread" && (
            <Pressable
              onPress={() => setFilter("all")}
              className="mt-5 bg-gray-100 px-5 py-2.5 rounded-xl"
            >
              <Text className="text-gray-600 text-[13px] font-medium">
                View all notifications
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        /* ── List ──────────────────────────────────────────────────────── */
        <FlatList
          data={listData}
          keyExtractor={(row) => row.key}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#166534"
              colors={["#166534"]}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item: row }) => {
            if (row.kind === "header") {
              return (
                <View className="px-5 pt-5 pb-2">
                  <Text className="text-gray-400 text-[11px] font-semibold uppercase tracking-widest">
                    {row.title}
                  </Text>
                </View>
              );
            }
            return (
              <View
                className="mx-4 mb-1.5 bg-white rounded-2xl overflow-hidden border border-gray-100"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <NotificationItem
                  item={row.item}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

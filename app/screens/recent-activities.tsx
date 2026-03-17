// app/screens/recent-activities.tsx
import {
  ActivityKind,
  RecentActivity,
  fetchAllActivities,
  formatTimeAgo,
  getDotColor,
} from "@/lib/activities";
import { router } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  CreditCard,
  FileText,
  Package,
  PhilippinePeso,
  SlidersHorizontal,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ── Icon map ──────────────────────────────────────────────────────────────────

const KIND_ICON: Record<
  ActivityKind,
  { icon: any; iconColor: string; iconBg: string }
> = {
  application: { icon: FileText, iconColor: "#2563EB", iconBg: "bg-blue-50" },
  cash_assistance: {
    icon: PhilippinePeso,
    iconColor: "#059669",
    iconBg: "bg-emerald-50",
  },
  card: { icon: CreditCard, iconColor: "#7C3AED", iconBg: "bg-purple-50" },
  device_request: {
    icon: Package,
    iconColor: "#EA580C",
    iconBg: "bg-orange-50",
  },
};

// ── Filter config ─────────────────────────────────────────────────────────────

type FilterKind = "all" | ActivityKind;

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "application", label: "Application" },
  { key: "cash_assistance", label: "Cash" },
  { key: "card", label: "ID Card" },
  { key: "device_request", label: "Devices" },
];

// ── Group by date ─────────────────────────────────────────────────────────────

const groupActivities = (
  items: RecentActivity[],
): { title: string; data: RecentActivity[] }[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, RecentActivity[]> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Earlier: [],
  };

  for (const item of items) {
    const d = new Date(item.date);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) groups["Today"].push(item);
    else if (d.getTime() === yesterday.getTime())
      groups["Yesterday"].push(item);
    else if (d >= weekAgo) groups["This Week"].push(item);
    else groups["Earlier"].push(item);
  }

  return Object.entries(groups)
    .filter(([, v]) => v.length > 0)
    .map(([title, data]) => ({ title, data }));
};

// ── Activity row ──────────────────────────────────────────────────────────────

function ActivityRow({
  item,
  isLast,
}: {
  item: RecentActivity;
  isLast: boolean;
}) {
  const kc = KIND_ICON[item.kind];
  const Icon = kc.icon;

  return (
    <Pressable
      onPress={() => item.route && router.push(item.route as any)}
      className={`flex-row items-center px-4 py-4 bg-white active:bg-gray-50 ${
        !isLast ? "border-b border-gray-50" : ""
      }`}
    >
      {/* Icon */}
      <View
        className={`w-10 h-10 rounded-xl items-center justify-center mr-3 shrink-0 ${kc.iconBg}`}
      >
        <Icon size={18} color={kc.iconColor} strokeWidth={2} />
      </View>

      {/* Text */}
      <View className="flex-1 min-w-0">
        <Text
          className="text-gray-900 text-[13px] font-semibold"
          numberOfLines={1}
        >
          {item.label}
        </Text>
        <Text className="text-gray-400 text-[11px] mt-0.5" numberOfLines={1}>
          {item.sublabel}
        </Text>
      </View>

      {/* Status + time */}
      <View className="items-end gap-1 ml-3 shrink-0">
        <View className="flex-row items-center gap-1.5">
          <View
            className={`w-1.5 h-1.5 rounded-full ${getDotColor(item.status)}`}
          />
          <Text className="text-gray-600 text-[11px] font-medium">
            {item.status}
          </Text>
        </View>
        <Text className="text-gray-300 text-[10px]">
          {formatTimeAgo(item.date)}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function RecentActivitiesScreen() {
  const [all, setAll] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>("all");

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const data = await fetchAllActivities(); // no limit — fetch all
      setAll(data);
      setError(null);
    } catch (err: any) {
      if (!silent) setError(err.message || "Failed to load activities");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  // ── Derived list ────────────────────────────────────────────────────────
  const filtered =
    filter === "all" ? all : all.filter((a) => a.kind === filter);

  const grouped = groupActivities(filtered);

  // Flat list data: interleave section headers + items
  type Row =
    | { kind: "header"; title: string; key: string }
    | { kind: "row"; item: RecentActivity; isLast: boolean; key: string };

  const listData: Row[] = [];
  for (const group of grouped) {
    listData.push({
      kind: "header",
      title: group.title,
      key: `hdr-${group.title}`,
    });
    group.data.forEach((item, idx) =>
      listData.push({
        kind: "row",
        item,
        isLast: idx === group.data.length - 1,
        key: item.id,
      }),
    );
  }

  // Filter counts
  const countFor = (k: FilterKind) =>
    k === "all" ? all.length : all.filter((a) => a.kind === k).length;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
        <View className="px-5 pt-3 pb-4 bg-white border-b border-gray-100 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
          >
            <ArrowLeft size={18} color="#374151" strokeWidth={2} />
          </Pressable>
          <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
            Recent Activities
          </Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-400 text-[13px] mt-3">
            Loading activities...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View className="bg-white border-b border-gray-100">
        <View className="px-5 pt-3 pb-3 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
          >
            <ArrowLeft size={18} color="#374151" strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
              Recent Activities
            </Text>
            {all.length > 0 && (
              <Text className="text-gray-400 text-[12px] mt-0.5">
                {`${all.length} total record${all.length !== 1 ? "s" : ""}`}
              </Text>
            )}
          </View>
          <View className="w-9 h-9 bg-gray-50 rounded-xl items-center justify-center border border-gray-100">
            <SlidersHorizontal size={16} color="#6B7280" />
          </View>
        </View>

        {/* Filter tabs */}
        <FlatList
          data={FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(f) => f.key}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 12,
            gap: 8,
          }}
          renderItem={({ item: f }) => {
            const count = countFor(f.key);
            const active = filter === f.key;
            return (
              <Pressable
                onPress={() => setFilter(f.key)}
                className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border ${
                  active
                    ? "bg-green-900 border-green-900"
                    : "bg-white border-gray-200"
                }`}
              >
                <Text
                  className={`text-[12px] font-semibold ${
                    active ? "text-white" : "text-gray-500"
                  }`}
                >
                  {f.label}
                </Text>
                {count > 0 && (
                  <View
                    className={`px-1.5 py-0.5 rounded-full ${
                      active ? "bg-white/20" : "bg-gray-100"
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        active ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>

      {/* ── Error ──────────────────────────────────────────────────────── */}
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
            onPress={() => load()}
            className="bg-green-900 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>
        </View>
      ) : listData.length === 0 ? (
        /* ── Empty state ─────────────────────────────────────────────── */
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 bg-gray-100 rounded-3xl items-center justify-center mb-4">
            <Clock size={32} color="#9CA3AF" />
          </View>
          <Text className="text-gray-900 text-[17px] font-bold text-center mb-2">
            {filter === "all"
              ? "No activities yet"
              : `No ${FILTERS.find((f) => f.key === filter)?.label} records`}
          </Text>
          <Text className="text-gray-400 text-[13px] text-center leading-5">
            {filter === "all"
              ? "Your applications, cash assistance requests, and device requests will appear here."
              : "Try switching to a different filter."}
          </Text>
          {filter !== "all" && (
            <Pressable
              onPress={() => setFilter("all")}
              className="mt-5 bg-gray-100 px-5 py-2.5 rounded-xl"
            >
              <Text className="text-gray-600 text-[13px] font-medium">
                View all activities
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        /* ── List ──────────────────────────────────────────────────────── */
        <FlatList
          data={listData}
          keyExtractor={(row) => row.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#166534"
              colors={["#166534"]}
            />
          }
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
                className="mx-4 mb-0 bg-white overflow-hidden"
                style={
                  row.isLast
                    ? {
                        borderRadius: 16,
                        marginBottom: 4,
                        borderWidth: 0.5,
                        borderColor: "#F3F4F6",
                      }
                    : {}
                }
              >
                {row.isLast ? (
                  // Last item in group gets rounded bottom corners
                  <ActivityRow item={row.item} isLast={true} />
                ) : (
                  <ActivityRow item={row.item} isLast={false} />
                )}
              </View>
            );
          }}
          // Group all items in a section into a card together
          ListHeaderComponent={null}
        />
      )}
    </SafeAreaView>
  );
}

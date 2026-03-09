// app/financial-assistance.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  RefreshCw,
  XCircle,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";

type CashAssistanceStatus =
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Cancelled";

interface CashAssistanceRequest {
  _id: string;
  form_id: string;
  purpose: string;
  medical_certificate_url: string;
  date_needed: string;
  status: CashAssistanceStatus;
  created_at: string;
  updated_at: string;
}

const getStatusConfig = (status: CashAssistanceStatus) => {
  switch (status) {
    case "Submitted":
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-700",
        icon: Clock,
        iconColor: "#2563EB",
        label: "Submitted",
        dot: "bg-blue-500",
      };
    case "Under Review":
      return {
        bg: "bg-amber-50",
        border: "border-amber-200",
        text: "text-amber-700",
        icon: RefreshCw,
        iconColor: "#D97706",
        label: "Under Review",
        dot: "bg-amber-500",
      };
    case "Approved":
      return {
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        text: "text-emerald-700",
        icon: CheckCircle2,
        iconColor: "#059669",
        label: "Approved",
        dot: "bg-emerald-500",
      };
    case "Rejected":
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-700",
        icon: XCircle,
        iconColor: "#DC2626",
        label: "Rejected",
        dot: "bg-red-500",
      };
    case "Cancelled":
      return {
        bg: "bg-gray-50",
        border: "border-gray-200",
        text: "text-gray-700",
        icon: XCircle,
        iconColor: "#6B7280",
        label: "Cancelled",
        dot: "bg-gray-500",
      };
    default:
      return {
        bg: "bg-gray-50",
        border: "border-gray-200",
        text: "text-gray-700",
        icon: Clock,
        iconColor: "#6B7280",
        label: status,
        dot: "bg-gray-500",
      };
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays <= 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-PH", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function FinancialAssistanceScreen() {
  const [requests, setRequests] = useState<CashAssistanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<CashAssistanceRequest | null>(null);

  const fetchRequests = async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        setError("Session expired. Please log in again.");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/cash-assistance/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch requests");
      }

      const data = await res.json();
      setRequests(data.cash_assistance || []);
      setError(null);
    } catch (err) {
      console.error("[financial-assistance] fetch error:", err);
      setError("Failed to load requests. Pull down to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;

      const res = await fetch(
        `${EXPRESS_API_BASE}/api/cash-assistance/${requestId}/cancel`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.ok) {
        // Refresh the list
        fetchRequests();
        setSelectedRequest(null);
      }
    } catch (err) {
      console.error("[financial-assistance] cancel error:", err);
    }
  };

  const renderRequest = ({ item }: { item: CashAssistanceRequest }) => {
    const statusConfig = getStatusConfig(item.status);
    const StatusIcon = statusConfig.icon;

    return (
      <Pressable
        onPress={() => setSelectedRequest(item)}
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3 active:opacity-70"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* Status Bar */}
        <View className={`h-1 w-full ${statusConfig.bg}`} />

        <View className="p-4">
          {/* Header with Form ID and Status */}
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-gray-900 font-bold text-[15px]">
                {item.form_id}
              </Text>
              <View className="flex-row items-center gap-1 mt-1">
                <Calendar size={12} color="#9ca3af" />
                <Text className="text-gray-400 text-[11px]">
                  {formatDate(item.created_at)}
                </Text>
              </View>
            </View>
            <View
              className={`flex-row items-center gap-1.5 ${statusConfig.bg} px-2.5 py-1.5 rounded-full border ${statusConfig.border}`}
            >
              <View
                className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}
              />
              <StatusIcon size={12} color={statusConfig.iconColor} />
              <Text
                className={`${statusConfig.text} text-[11px] font-semibold`}
              >
                {statusConfig.label}
              </Text>
            </View>
          </View>

          {/* Purpose Preview */}
          <Text
            className="text-gray-600 text-[13px] leading-5 mb-3"
            numberOfLines={2}
          >
            {item.purpose}
          </Text>

          {/* Date Needed */}
          <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
            <View className="flex-row items-center gap-2">
              <Clock size={14} color="#9ca3af" />
              <Text className="text-gray-500 text-[12px]">
                Needed by: {formatDateTime(item.date_needed).split(",")[0]}
              </Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
        </View>
      </Pressable>
    );
  };

  // Detail View Modal/Sheet
  if (selectedRequest) {
    const statusConfig = getStatusConfig(selectedRequest.status);
    const StatusIcon = statusConfig.icon;

    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <StatusBar style="dark" />

        {/* Header */}
        <View className="px-5 pt-3 pb-4 flex-row items-center gap-3 border-b border-gray-100">
          <Pressable
            onPress={() => setSelectedRequest(null)}
            className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
          >
            <ArrowLeft size={18} color="#374151" strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
              Request Details
            </Text>
            <Text className="text-gray-400 text-[12px] mt-0.5">
              {selectedRequest.form_id}
            </Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
        >
          {/* Status Card */}
          <View
            className={`${statusConfig.bg} border ${statusConfig.border} rounded-2xl p-4 mt-5`}
          >
            <View className="flex-row items-center gap-3">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center ${statusConfig.bg}`}
              >
                <StatusIcon size={24} color={statusConfig.iconColor} />
              </View>
              <View className="flex-1">
                <Text className={`${statusConfig.text} text-[15px] font-bold`}>
                  {statusConfig.label}
                </Text>
                <Text className="text-gray-500 text-[12px] mt-0.5">
                  Last updated: {formatDateTime(selectedRequest.updated_at)}
                </Text>
              </View>
            </View>
          </View>

          {/* Purpose */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Purpose
            </Text>
            <Text className="text-gray-800 text-[14px] leading-6 bg-gray-50 rounded-2xl p-4">
              {selectedRequest.purpose}
            </Text>
          </View>

          {/* Medical Certificate */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Medical Certificate
            </Text>
            <Pressable
              className="bg-gray-50 rounded-2xl p-4 flex-row items-center gap-3 border border-gray-200"
              onPress={() => {
                // Open image in viewer
                console.log(
                  "Open image:",
                  selectedRequest.medical_certificate_url,
                );
              }}
            >
              <View className="w-12 h-12 bg-gray-200 rounded-xl items-center justify-center">
                <FileText size={20} color="#6B7280" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-700 font-semibold text-[13px]">
                  View Certificate
                </Text>
                <Text className="text-gray-400 text-[11px] mt-0.5">
                  Tap to view document
                </Text>
              </View>
              <ChevronRight size={16} color="#9ca3af" />
            </Pressable>
          </View>

          {/* Important Dates */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Important Dates
            </Text>

            <View className="bg-gray-50 rounded-2xl p-4 gap-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-500 text-[13px]">Date Needed</Text>
                <Text className="text-gray-900 font-semibold text-[13px]">
                  {formatDateTime(selectedRequest.date_needed)}
                </Text>
              </View>

              <View className="h-px bg-gray-200" />

              <View className="flex-row justify-between items-center">
                <Text className="text-gray-500 text-[13px]">Submitted On</Text>
                <Text className="text-gray-900 text-[13px]">
                  {formatDateTime(selectedRequest.created_at)}
                </Text>
              </View>

              <View className="h-px bg-gray-200" />

              <View className="flex-row justify-between items-center">
                <Text className="text-gray-500 text-[13px]">Last Updated</Text>
                <Text className="text-gray-900 text-[13px]">
                  {formatDateTime(selectedRequest.updated_at)}
                </Text>
              </View>
            </View>
          </View>

          {/* Cancel Button (only for cancellable statuses) */}
          {(selectedRequest.status === "Submitted" ||
            selectedRequest.status === "Under Review") && (
            <View className="mt-8 mb-10">
              <Pressable
                onPress={() => {
                  // Show confirmation alert
                  // For now, just call cancel
                  handleCancelRequest(selectedRequest._id);
                }}
                className="bg-red-50 border border-red-200 rounded-2xl py-4 items-center"
              >
                <Text className="text-red-600 font-bold text-[14px]">
                  Cancel Request
                </Text>
              </Pressable>
              <Text className="text-gray-400 text-[11px] text-center mt-2">
                Once cancelled, this action cannot be undone
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main List View
  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View className="px-5 pt-3 pb-4 flex-row items-center gap-3 border-b border-gray-100 bg-white">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
        >
          <ArrowLeft size={18} color="#374151" strokeWidth={2} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
            Financial Assistance
          </Text>
          <Text className="text-gray-400 text-[12px] mt-0.5">
            Track your cash assistance requests
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/cash-assistance")}
          className="bg-green-900 px-4 py-2 rounded-xl"
        >
          <Text className="text-white text-[12px] font-semibold">New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-400 text-[13px] mt-3">
            Loading requests...
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-16 h-16 bg-red-50 rounded-2xl items-center justify-center mb-4">
            <AlertCircle size={28} color="#dc2626" />
          </View>
          <Text className="text-gray-900 text-[16px] font-bold text-center mb-2">
            Something went wrong
          </Text>
          <Text className="text-gray-400 text-[13px] text-center mb-6">
            {error}
          </Text>
          <Pressable
            onPress={onRefresh}
            className="bg-green-900 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>
        </View>
      ) : requests.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 bg-green-50 rounded-3xl items-center justify-center mb-4">
            <FileText size={32} color="#166534" />
          </View>
          <Text className="text-gray-900 text-[18px] font-bold text-center mb-2">
            No requests yet
          </Text>
          <Text className="text-gray-400 text-[14px] text-center leading-5 mb-8">
            You haven't submitted any cash assistance requests. Start by
            creating a new application.
          </Text>
          <Pressable
            onPress={() => router.push("/cash-assistance")}
            className="bg-green-900 px-8 py-4 rounded-2xl flex-row items-center gap-2"
            style={{
              shadowColor: "#166534",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-[15px]">
              Apply for Cash Assistance
            </Text>
            <ChevronRight size={18} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequest}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#166534"
              colors={["#166534"]}
            />
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="mb-4">
              <Text className="text-gray-400 text-[12px] font-medium">
                {requests.length}{" "}
                {requests.length === 1 ? "request" : "requests"} found
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

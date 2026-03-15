// app/screens/financial-assistance.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileCheck,
  FileText,
  HelpCircle,
  RefreshCw,
  XCircle,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
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
  status: CashAssistanceStatus;
  created_at: string;
  updated_at: string;
}

const getStatusConfig = (status: CashAssistanceStatus) => {
  switch (status) {
    case "Submitted":
      return {
        bg: "bg-blue-50",
        lightBg: "bg-blue-50/50",
        border: "border-blue-200",
        text: "text-blue-700",
        textLight: "text-blue-600",
        icon: Clock,
        iconColor: "#2563EB",
        iconBg: "bg-blue-100",
        label: "Submitted",
        dot: "bg-blue-500",
        gradient: ["#EFF6FF", "#DBEAFE"],
        description:
          "Your request has been received and is awaiting initial review",
        progress: 25,
      };
    case "Under Review":
      return {
        bg: "bg-amber-50",
        lightBg: "bg-amber-50/50",
        border: "border-amber-200",
        text: "text-amber-700",
        textLight: "text-amber-600",
        icon: RefreshCw,
        iconColor: "#D97706",
        iconBg: "bg-amber-100",
        label: "Under Review",
        dot: "bg-amber-500",
        gradient: ["#FFFBEB", "#FEF3C7"],
        description: "Your request is currently being evaluated by our team",
        progress: 50,
      };
    case "Approved":
      return {
        bg: "bg-emerald-50",
        lightBg: "bg-emerald-50/50",
        border: "border-emerald-200",
        text: "text-emerald-700",
        textLight: "text-emerald-600",
        icon: CheckCircle2,
        iconColor: "#059669",
        iconBg: "bg-emerald-100",
        label: "Approved",
        dot: "bg-emerald-500",
        gradient: ["#ECFDF5", "#D1FAE5"],
        description:
          "Your request has been approved! You will be contacted shortly",
        progress: 100,
      };
    case "Rejected":
      return {
        bg: "bg-red-50",
        lightBg: "bg-red-50/50",
        border: "border-red-200",
        text: "text-red-700",
        textLight: "text-red-600",
        icon: XCircle,
        iconColor: "#DC2626",
        iconBg: "bg-red-100",
        label: "Rejected",
        dot: "bg-red-500",
        gradient: ["#FEF2F2", "#FEE2E2"],
        description:
          "Your request was not approved. Please check details for more information",
        progress: 100,
      };
    case "Cancelled":
      return {
        bg: "bg-gray-50",
        lightBg: "bg-gray-50/50",
        border: "border-gray-200",
        text: "text-gray-700",
        textLight: "text-gray-600",
        icon: XCircle,
        iconColor: "#6B7280",
        iconBg: "bg-gray-100",
        label: "Cancelled",
        dot: "bg-gray-500",
        gradient: ["#F9FAFB", "#F3F4F6"],
        description: "This request has been cancelled as per your request",
        progress: 0,
      };
    default:
      return {
        bg: "bg-gray-50",
        lightBg: "bg-gray-50/50",
        border: "border-gray-200",
        text: "text-gray-700",
        textLight: "text-gray-600",
        icon: HelpCircle,
        iconColor: "#6B7280",
        iconBg: "bg-gray-100",
        label: status,
        dot: "bg-gray-500",
        gradient: ["#F9FAFB", "#F3F4F6"],
        description: "Status update pending",
        progress: 0,
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

const formatPurposePreview = (purpose: string, maxLength: number = 80) => {
  if (purpose.length <= maxLength) return purpose;
  return purpose.substring(0, maxLength) + "...";
};

export default function FinancialAssistanceScreen() {
  const [requests, setRequests] = useState<CashAssistanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<CashAssistanceRequest | null>(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  const fetchRequests = async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        setError("Session expired. Please log in again.");
        return;
      }

      console.log("[financial-assistance] Fetching requests...");
      const res = await fetch(`${EXPRESS_API_BASE}/api/cash-assistance/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("Your session has expired. Please log in again.");
        } else {
          throw new Error("Failed to fetch requests");
        }
      }

      const data = await res.json();
      console.log(
        `[financial-assistance] Fetched ${data.cash_assistance?.length || 0} requests`,
      );
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
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this request? This action cannot be undone.",
      [
        { text: "No, Keep It", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const token =
                await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
              if (!token) return;

              console.log(
                "[financial-assistance] Cancelling request:",
                requestId,
              );
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
                Alert.alert("Success", "Your request has been cancelled.");
              } else {
                const data = await res.json();
                Alert.alert(
                  "Error",
                  data.message || "Failed to cancel request.",
                );
              }
            } catch (err) {
              console.error("[financial-assistance] cancel error:", err);
              Alert.alert("Error", "Network error. Please try again.");
            }
          },
        },
      ],
    );
  };

  const renderRequest = ({
    item,
    index,
  }: {
    item: CashAssistanceRequest;
    index: number;
  }) => {
    const statusConfig = getStatusConfig(item.status);
    const StatusIcon = statusConfig.icon;
    const purposePreview = formatPurposePreview(item.purpose);

    // Calculate time ago
    const createdDate = new Date(item.created_at);
    const now = new Date();
    const diffHours = Math.floor(
      (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60),
    );

    let timeAgo = "";
    if (diffHours < 1) {
      timeAgo = "Just now";
    } else if (diffHours < 24) {
      timeAgo = `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      timeAgo = `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
    }

    return (
      <Pressable
        onPress={() => setSelectedRequest(item)}
        className="mb-4 active:opacity-90"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          {/* Status Header Bar */}
          <View
            className={`${statusConfig.bg} px-4 py-3 flex-row items-center justify-between`}
          >
            <View className="flex-row items-center gap-2">
              <View
                className={`w-8 h-8 ${statusConfig.iconBg} rounded-full items-center justify-center`}
              >
                <StatusIcon size={16} color={statusConfig.iconColor} />
              </View>
              <View>
                <Text className={`${statusConfig.text} font-bold text-[14px]`}>
                  {statusConfig.label}
                </Text>
                <Text className="text-gray-500 text-[10px] mt-0.5">
                  {timeAgo}
                </Text>
              </View>
            </View>
            <View className="bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/50">
              <Text className="text-gray-700 text-[11px] font-mono font-semibold">
                {item.form_id}
              </Text>
            </View>
          </View>

          {/* Content */}
          <View className="p-4">
            {/* Purpose Preview with Visual Enhancement */}
            <View className="mb-3">
              <Text className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                PURPOSE
              </Text>
              <Text className="text-gray-800 text-[14px] leading-5 font-medium">
                {purposePreview}
              </Text>
            </View>

            {/* Status Progress Bar */}
            <View className="mb-4">
              <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <View
                  className={`h-full ${statusConfig.bg}`}
                  style={{ width: `${statusConfig.progress}%` }}
                />
              </View>
              <View className="flex-row justify-between mt-1.5">
                <Text className="text-gray-400 text-[9px] font-medium">
                  Submitted
                </Text>
                <Text className="text-gray-400 text-[9px] font-medium">
                  Under Review
                </Text>
                <Text className="text-gray-400 text-[9px] font-medium">
                  Approved
                </Text>
              </View>
            </View>

            {/* Metadata Footer */}
            <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center gap-1">
                  <Calendar size={12} color="#9ca3af" />
                  <Text className="text-gray-400 text-[10px]">
                    {formatDate(item.created_at)}
                  </Text>
                </View>
                <View className="w-1 h-1 rounded-full bg-gray-300" />
                <View className="flex-row items-center gap-1">
                  <FileText size={12} color="#9ca3af" />
                  <Text className="text-gray-400 text-[10px]">
                    Certificate Attached
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center gap-1">
                <Text className="text-gray-400 text-[10px]">View Details</Text>
                <ChevronRight size={12} color="#d1d5db" />
              </View>
            </View>

            {/* Status Description */}
            <View className="mt-3 bg-gray-50 rounded-xl px-3 py-2">
              <Text className="text-gray-500 text-[11px] leading-4">
                {statusConfig.description}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  // Image Viewer Modal
  const ImageViewerModal = () => (
    <Modal
      visible={imageModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setImageModalVisible(false)}
    >
      <View className="flex-1 bg-black/95">
        <SafeAreaView className="flex-1">
          <View className="flex-row justify-between items-center p-4">
            <Text className="text-white font-semibold text-[15px]">
              Medical Certificate
            </Text>
            <Pressable
              onPress={() => setImageModalVisible(false)}
              className="w-10 h-10 bg-white/10 rounded-full items-center justify-center"
            >
              <XCircle size={20} color="#fff" />
            </Pressable>
          </View>
          {selectedRequest?.medical_certificate_url && (
            <View className="flex-1 items-center justify-center p-4">
              <Image
                source={{ uri: selectedRequest.medical_certificate_url }}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );

  // Detail View
  if (selectedRequest) {
    const statusConfig = getStatusConfig(selectedRequest.status);
    const StatusIcon = statusConfig.icon;

    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <StatusBar style="dark" />
        <ImageViewerModal />

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
            <Text className="text-gray-400 text-[12px] mt-0.5 font-mono">
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
            className={`${statusConfig.bg} border ${statusConfig.border} rounded-2xl p-5 mt-5`}
          >
            <View className="flex-row items-center gap-4">
              <View
                className={`w-16 h-16 rounded-2xl items-center justify-center ${statusConfig.iconBg}`}
              >
                <StatusIcon size={32} color={statusConfig.iconColor} />
              </View>
              <View className="flex-1">
                <Text
                  className={`${statusConfig.text} text-[18px] font-bold mb-1`}
                >
                  {statusConfig.label}
                </Text>
                <Text className="text-gray-500 text-[13px] leading-5">
                  {statusConfig.description}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className="mt-4">
              <View className="h-2 bg-white/60 rounded-full overflow-hidden">
                <View
                  className={`h-full ${statusConfig.bg}`}
                  style={{ width: `${statusConfig.progress}%` }}
                />
              </View>
              <View className="flex-row justify-between mt-2">
                <Text className="text-gray-500 text-[10px]">Submitted</Text>
                <Text className="text-gray-500 text-[10px]">Review</Text>
                <Text className="text-gray-500 text-[10px]">Decision</Text>
              </View>
            </View>
          </View>

          {/* Purpose */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Purpose of Request
            </Text>
            <View className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <Text className="text-gray-800 text-[14px] leading-6">
                {selectedRequest.purpose}
              </Text>
            </View>
          </View>

          {/* Medical Certificate */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Supporting Document
            </Text>
            <Pressable
              className="bg-gray-50 rounded-2xl p-4 flex-row items-center gap-4 border border-gray-200 active:bg-gray-100"
              onPress={() => setImageModalVisible(true)}
            >
              <View className="w-14 h-14 bg-white rounded-xl items-center justify-center border border-gray-200">
                <FileText size={24} color="#6B7280" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-700 font-semibold text-[14px]">
                  Medical Certificate
                </Text>
                <Text className="text-gray-400 text-[11px] mt-1">
                  Tap to view document • JPEG
                </Text>
              </View>
              <Eye size={20} color="#9ca3af" />
            </Pressable>
          </View>

          {/* Timeline */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Timeline
            </Text>
            <View className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <View className="flex-row items-center gap-3 mb-4">
                <View className="w-8 h-8 bg-blue-100 rounded-full items-center justify-center">
                  <Clock size={16} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-[11px]">
                    Submitted On
                  </Text>
                  <Text className="text-gray-800 font-medium text-[13px] mt-0.5">
                    {formatDateTime(selectedRequest.created_at)}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 bg-purple-100 rounded-full items-center justify-center">
                  <RefreshCw size={16} color="#7C3AED" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-[11px]">
                    Last Updated
                  </Text>
                  <Text className="text-gray-800 font-medium text-[13px] mt-0.5">
                    {formatDateTime(selectedRequest.updated_at)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          {(selectedRequest.status === "Submitted" ||
            selectedRequest.status === "Under Review") && (
            <View className="mt-8 mb-10">
              <Pressable
                onPress={() => handleCancelRequest(selectedRequest._id)}
                className="bg-red-50 border border-red-200 rounded-2xl py-4 items-center active:bg-red-100"
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
            Cash Assistance
          </Text>
          <Text className="text-gray-400 text-[12px] mt-0.5">
            Track your financial aid requests
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/cash-assistance")}
          className="bg-green-900 px-4 py-2 rounded-xl active:bg-green-800"
        >
          <Text className="text-white text-[12px] font-semibold">+ New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-400 text-[13px] mt-3">
            Loading your requests...
          </Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 bg-red-50 rounded-2xl items-center justify-center mb-4">
            <AlertTriangle size={32} color="#dc2626" />
          </View>
          <Text className="text-gray-900 text-[18px] font-bold text-center mb-2">
            Unable to Load
          </Text>
          <Text className="text-gray-400 text-[14px] text-center leading-5 mb-6">
            {error}
          </Text>
          <Pressable
            onPress={onRefresh}
            className="bg-green-900 px-6 py-3 rounded-xl active:bg-green-800"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </Pressable>
        </View>
      ) : requests.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-24 h-24 bg-green-50 rounded-3xl items-center justify-center mb-6">
            <FileCheck size={48} color="#166534" />
          </View>
          <Text className="text-gray-900 text-[20px] font-bold text-center mb-2">
            No Requests Yet
          </Text>
          <Text className="text-gray-400 text-[14px] text-center leading-5 mb-8">
            You haven't submitted any cash assistance requests. Start by
            creating a new application.
          </Text>
          <Pressable
            onPress={() => router.push("/cash-assistance")}
            className="bg-green-900 px-8 py-4 rounded-2xl flex-row items-center gap-2 active:bg-green-800"
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
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-gray-400 text-[12px] font-medium">
                Showing {requests.length}{" "}
                {requests.length === 1 ? "request" : "requests"}
              </Text>
              <View className="flex-row items-center gap-1">
                <View className={`w-2 h-2 rounded-full bg-blue-500`} />
                <Text className="text-gray-400 text-[10px]">Active</Text>
              </View>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

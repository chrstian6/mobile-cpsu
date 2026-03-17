// app/screens/device-request-status.tsx
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
  Package,
  XCircle,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

// Types
interface RequestItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  requires_prescription?: boolean;
  prescription_image_url?: string | null;
  prescription_verified?: boolean;
  notes?: string | null;
}

interface ApprovedItem {
  item_id: string;
  quantity_approved: number;
}

interface RejectedItem {
  item_id: string;
  reason: string;
}

interface DeviceRequest {
  _id: string;
  request_id: string;
  requester_id: string;
  requester_name: string;
  requester_barangay: string;
  items: RequestItem[];
  purpose: string;
  queue_number?: number;
  queue_position?: number;
  estimated_wait_time?: number;
  status:
    | "Pending"
    | "In Queue"
    | "Processing"
    | "Approved"
    | "Partially Approved"
    | "Rejected"
    | "Ready for Pickup"
    | "Completed"
    | "Cancelled";
  priority: "Emergency" | "High" | "Normal" | "Low";
  is_emergency: boolean;
  has_prescription: boolean;
  has_medical_cert: boolean;
  has_barangay_cert: boolean;
  approved_items?: ApprovedItem[];
  rejected_items?: RejectedItem[];
  rejection_reason?: string;
  processed_by?: string | null;
  processed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  distributed_by?: string | null;
  distributed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ── helper: returns the status description string (never a boolean) ─────────
const getStatusDescription = (request: DeviceRequest): string => {
  switch (request.status) {
    case "Pending":
      return "Your request is pending review.";
    case "In Queue":
      return "Your request is in queue for processing.";
    case "Processing":
      return "Your request is being processed.";
    case "Approved":
      return "Your request has been approved and is ready for pickup.";
    case "Partially Approved":
      return "Some items have been approved.";
    case "Rejected":
      return request.rejection_reason || "Your request has been rejected.";
    case "Ready for Pickup":
      return "Your items are ready for pickup at the center.";
    case "Completed":
      return "This request has been completed.";
    case "Cancelled":
      return "This request has been cancelled.";
    default:
      return "";
  }
};

// Status color mapping
const getStatusColor = (status: DeviceRequest["status"]) => {
  const colors: Record<
    DeviceRequest["status"],
    { bg: string; text: string; border: string; icon: any }
  > = {
    Pending: {
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
      icon: Clock,
    },
    "In Queue": {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
      icon: Clock,
    },
    Processing: {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
      icon: Clock,
    },
    Approved: {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
      icon: CheckCircle2,
    },
    "Partially Approved": {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: CheckCircle2,
    },
    Rejected: {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      icon: XCircle,
    },
    "Ready for Pickup": {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
      icon: CheckCircle2,
    },
    Completed: {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
      icon: CheckCircle2,
    },
    Cancelled: {
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
      icon: XCircle,
    },
  };
  return colors[status] || colors.Pending;
};

// Priority badge colors
const getPriorityColor = (priority: DeviceRequest["priority"]) => {
  const colors: Record<DeviceRequest["priority"], string> = {
    Emergency: "bg-red-50 border-red-200 text-red-700",
    High: "bg-orange-50 border-orange-200 text-orange-700",
    Normal: "bg-blue-50 border-blue-200 text-blue-700",
    Low: "bg-gray-50 border-gray-200 text-gray-600",
  };
  return colors[priority] || colors.Normal;
};

// ── helper: resolve text color string → hex for icon props ──────────────────
const textColorToHex = (textClass: string): string => {
  const map: Record<string, string> = {
    "text-gray-700": "#374151",
    "text-blue-700": "#1D4ED8",
    "text-yellow-700": "#B45309",
    "text-green-700": "#059669",
    "text-amber-700": "#D97706",
    "text-red-700": "#DC2626",
    "text-purple-700": "#7C3AED",
  };
  return map[textClass] ?? "#6B7280";
};

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Format wait time
const formatWaitTime = (minutes?: number) => {
  if (!minutes) return "N/A";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours} hr${hours > 1 ? "s" : ""} ${mins > 0 ? `${mins} min` : ""}`;
};

export default function DeviceRequestStatusScreen() {
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<DeviceRequest | null>(
    null,
  );
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [queueStats, setQueueStats] = useState<any>(null);

  useEffect(() => {
    fetchRequests();
    fetchQueueStats();
  }, []);

  const fetchRequests = async () => {
    try {
      setError(null);
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        setError("Not authenticated");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/requests/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch requests");
      }

      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      console.error("[device-request-status] fetch error:", err);
      setError(err.message || "Failed to load requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchQueueStats = async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;

      const res = await fetch(`${EXPRESS_API_BASE}/api/requests/queue`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setQueueStats(data.statistics);
      }
    } catch (err) {
      console.error("[device-request-status] queue stats error:", err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRequests(), fetchQueueStats()]);
    setRefreshing(false);
  }, []);

  const handleCancelRequest = async (request: DeviceRequest) => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this request? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => confirmCancelRequest(request),
        },
      ],
    );
  };

  const confirmCancelRequest = async (request: DeviceRequest) => {
    setCancelling(true);
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
      }

      const res = await fetch(
        `${EXPRESS_API_BASE}/api/requests/${request.request_id}/cancel`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: "Cancelled by user" }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || data.message || "Failed to cancel request",
        );
      }

      Alert.alert("Success", "Request cancelled successfully.");
      setDetailsModalVisible(false);
      fetchRequests();
    } catch (err: any) {
      console.error("[device-request-status] cancel error:", err);
      Alert.alert("Error", err.message || "Failed to cancel request");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: DeviceRequest["status"]) => {
    const colors = getStatusColor(status);
    const Icon = colors.icon;
    return (
      <View
        className={`flex-row items-center px-3 py-1.5 rounded-full border ${colors.bg} ${colors.border}`}
      >
        <Icon size={12} color={textColorToHex(colors.text)} />
        <Text className={`text-[11px] font-bold ml-1.5 ${colors.text}`}>
          {status}
        </Text>
      </View>
    );
  };

  const renderRequestItem = ({ item }: { item: DeviceRequest }) => {
    const priorityColors = getPriorityColor(item.priority);
    const totalItems = item.items.reduce((sum, i) => sum + i.quantity, 0);
    const approvedItems =
      item.approved_items?.reduce((sum, i) => sum + i.quantity_approved, 0) ||
      0;
    const isActive = [
      "Pending",
      "In Queue",
      "Processing",
      "Approved",
      "Partially Approved",
    ].includes(item.status);

    return (
      <Pressable
        onPress={() => {
          setSelectedRequest(item);
          setDetailsModalVisible(true);
        }}
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3 active:opacity-70"
      >
        <View className="p-4">
          {/* Header with Request ID and Status */}
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-gray-400 text-[11px]">Request ID</Text>
              <Text className="text-gray-900 font-bold text-[15px] tracking-wider">
                {item.request_id}
              </Text>
            </View>
            {getStatusBadge(item.status)}
          </View>

          {/* Items Summary */}
          <View className="bg-gray-50 rounded-xl p-3 mb-3">
            <View className="flex-row items-center gap-2">
              <Package size={14} color="#6B7280" />
              <Text className="text-gray-600 text-[12px] font-medium flex-1">
                {totalItems} item{totalItems !== 1 ? "s" : ""}
              </Text>
              <Text className="text-gray-400 text-[11px]">
                {item.items.length} type{item.items.length !== 1 ? "s" : ""}
              </Text>
            </View>

            {/* Item List Preview */}
            <View className="mt-2">
              {item.items.slice(0, 2).map((requestItem, idx) => (
                <View
                  key={idx}
                  className="flex-row items-center justify-between mt-1"
                >
                  <Text
                    className="text-gray-700 text-[12px] flex-1"
                    numberOfLines={1}
                  >
                    {`\u2022 ${requestItem.item_name}`}
                  </Text>
                  <Text className="text-gray-500 text-[11px] ml-2">
                    {requestItem.quantity} {requestItem.unit}
                  </Text>
                </View>
              ))}
              {item.items.length > 2 && (
                <Text className="text-gray-400 text-[11px] mt-1">
                  {`+${item.items.length - 2} more`}
                </Text>
              )}
            </View>
          </View>

          {/* Queue Info (if applicable) */}
          {isActive && !!item.queue_position && (
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-1">
                <Clock size={12} color="#6B7280" />
                <Text className="text-gray-600 text-[11px]">
                  {`Queue: #${item.queue_position}`}
                </Text>
              </View>
              {!!item.estimated_wait_time && (
                <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                  <Text className="text-blue-600 text-[10px] font-medium">
                    {`Est. wait: ${formatWaitTime(item.estimated_wait_time)}`}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Priority and Date */}
          <View className="flex-row items-center justify-between">
            <View
              className={`px-2 py-0.5 rounded-full border ${priorityColors}`}
            >
              <Text className="text-[9px] font-semibold">{item.priority}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Calendar size={10} color="#9CA3AF" />
              <Text className="text-gray-400 text-[10px]">
                {formatDate(item.created_at)}
              </Text>
            </View>
          </View>

          {/* Approval Status (if partially approved) */}
          {item.status === "Partially Approved" && approvedItems > 0 && (
            <View className="mt-3 pt-3 border-t border-gray-100 flex-row items-center gap-2">
              <CheckCircle2 size={12} color="#059669" />
              <Text className="text-green-600 text-[10px] font-medium">
                {`${approvedItems} item${approvedItems !== 1 ? "s" : ""} approved`}
              </Text>
              {item.rejected_items && item.rejected_items.length > 0 && (
                <>
                  <View className="w-1 h-1 rounded-full bg-gray-300" />
                  <Text className="text-red-500 text-[10px] font-medium">
                    {`${item.rejected_items.length} rejected`}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Chevron Indicator */}
          <View className="absolute right-4 top-1/2 -translate-y-1/2">
            <ChevronRight size={18} color="#D1D5DB" />
          </View>
        </View>
      </Pressable>
    );
  };

  // Details Modal
  const renderDetailsModal = () => {
    if (!selectedRequest) return null;

    const statusColors = getStatusColor(selectedRequest.status);
    const StatusIcon = statusColors.icon;
    const canCancel = ["Pending", "In Queue", "Processing"].includes(
      selectedRequest.status,
    );
    const totalItems = selectedRequest.items.reduce(
      (sum, i) => sum + i.quantity,
      0,
    );
    const approvedItems = selectedRequest.approved_items || [];
    const rejectedItems = selectedRequest.rejected_items || [];

    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailsModalVisible}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View className="flex-1 bg-black/50">
          <View className="flex-1 mt-16 bg-white rounded-t-3xl">
            {/* Header */}
            <View className="px-5 pt-5 pb-3 border-b border-gray-100 flex-row justify-between items-center">
              <View>
                <Text className="text-gray-400 text-[12px]">
                  Request Details
                </Text>
                <Text className="text-gray-900 text-[20px] font-bold tracking-wider">
                  {selectedRequest.request_id}
                </Text>
              </View>
              <Pressable
                onPress={() => setDetailsModalVisible(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <XCircle size={16} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="px-5 py-4">
                {/* Status Banner */}
                <View
                  className={`mb-5 p-4 rounded-2xl border ${statusColors.bg} ${statusColors.border}`}
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    <StatusIcon
                      size={20}
                      color={textColorToHex(statusColors.text)}
                    />
                    <Text
                      className={`text-[16px] font-bold ${statusColors.text}`}
                    >
                      {selectedRequest.status}
                    </Text>
                  </View>
                  {/* ── FIX: use helper function, never bare && string ── */}
                  <Text
                    className={`text-[13px] leading-5 ${statusColors.text} opacity-80`}
                  >
                    {getStatusDescription(selectedRequest)}
                  </Text>
                </View>

                {/* Queue Info (if applicable) */}
                {!!selectedRequest.queue_position && (
                  <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-blue-700 font-bold text-[14px]">
                        Queue Position
                      </Text>
                      <View className="bg-blue-100 px-3 py-1 rounded-full">
                        <Text className="text-blue-700 font-bold">
                          {`#${selectedRequest.queue_position}`}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row justify-between items-center">
                      <Text className="text-blue-600 text-[13px]">
                        Estimated Wait Time
                      </Text>
                      <Text className="text-blue-700 font-semibold">
                        {formatWaitTime(selectedRequest.estimated_wait_time)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Requester Info */}
                <View className="mb-5">
                  <Text className="text-gray-700 font-bold text-[15px] mb-3">
                    Requester Information
                  </Text>
                  <View className="bg-gray-50 rounded-xl p-4">
                    <Text className="text-gray-900 font-semibold text-[15px]">
                      {selectedRequest.requester_name}
                    </Text>
                    <Text className="text-gray-500 text-[13px] mt-1">
                      {`Barangay ${selectedRequest.requester_barangay}`}
                    </Text>
                  </View>
                </View>

                {/* Purpose */}
                <View className="mb-5">
                  <Text className="text-gray-700 font-bold text-[15px] mb-3">
                    Purpose
                  </Text>
                  <View className="bg-gray-50 rounded-xl p-4">
                    <Text className="text-gray-700 text-[14px] leading-6">
                      {selectedRequest.purpose}
                    </Text>
                  </View>
                </View>

                {/* Items */}
                <View className="mb-5">
                  <Text className="text-gray-700 font-bold text-[15px] mb-3">
                    {`Items Requested (${totalItems})`}
                  </Text>
                  {selectedRequest.items.map((item, index) => {
                    const approved = approvedItems.find(
                      (a) => a.item_id === item.item_id,
                    );
                    const rejected = rejectedItems.find(
                      (r) => r.item_id === item.item_id,
                    );

                    return (
                      <View
                        key={index}
                        className="bg-gray-50 rounded-xl p-4 mb-2"
                      >
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1 mr-3">
                            <Text className="text-gray-900 font-semibold text-[15px]">
                              {item.item_name}
                            </Text>
                            <View className="flex-row items-center mt-1 flex-wrap gap-1">
                              <Text className="text-gray-500 text-[13px]">
                                {`Quantity: ${item.quantity} ${item.unit}`}
                              </Text>
                              {!!approved && (
                                <View className="bg-green-100 px-2 py-0.5 rounded-full">
                                  <Text className="text-green-700 text-[10px] font-semibold">
                                    {`Approved: ${approved.quantity_approved}`}
                                  </Text>
                                </View>
                              )}
                              {!!rejected && (
                                <View className="bg-red-100 px-2 py-0.5 rounded-full">
                                  <Text className="text-red-700 text-[10px] font-semibold">
                                    Rejected
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                          {item.requires_prescription && (
                            <View className="bg-amber-50 px-2 py-1 rounded-full">
                              <Text className="text-amber-600 text-[9px] font-semibold">
                                Rx
                              </Text>
                            </View>
                          )}
                        </View>
                        {!!rejected && !!rejected.reason && (
                          <Text className="text-red-500 text-[11px] mt-2">
                            {`Reason: ${rejected.reason}`}
                          </Text>
                        )}
                        {!!item.notes && (
                          <Text className="text-gray-400 text-[11px] mt-2">
                            {`Note: ${item.notes}`}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Certificate Requirements */}
                {(selectedRequest.has_prescription ||
                  selectedRequest.has_medical_cert ||
                  selectedRequest.has_barangay_cert) && (
                  <View className="mb-5">
                    <Text className="text-gray-700 font-bold text-[15px] mb-3">
                      Requirements
                    </Text>
                    <View className="bg-gray-50 rounded-xl p-4">
                      {selectedRequest.has_prescription && (
                        <View className="flex-row items-center gap-2 mb-2">
                          <FileText size={14} color="#D97706" />
                          <Text className="text-gray-600 text-[13px]">
                            Prescription
                          </Text>
                          <View className="ml-auto bg-green-100 px-2 py-0.5 rounded-full">
                            <Text className="text-green-700 text-[10px]">
                              Submitted
                            </Text>
                          </View>
                        </View>
                      )}
                      {selectedRequest.has_medical_cert && (
                        <View className="flex-row items-center gap-2 mb-2">
                          <FileText size={14} color="#7C3AED" />
                          <Text className="text-gray-600 text-[13px]">
                            Medical Certificate
                          </Text>
                          <View className="ml-auto bg-green-100 px-2 py-0.5 rounded-full">
                            <Text className="text-green-700 text-[10px]">
                              Submitted
                            </Text>
                          </View>
                        </View>
                      )}
                      {selectedRequest.has_barangay_cert && (
                        <View className="flex-row items-center gap-2">
                          <FileText size={14} color="#2563EB" />
                          <Text className="text-gray-600 text-[13px]">
                            Barangay Certificate
                          </Text>
                          <View className="ml-auto bg-yellow-100 px-2 py-0.5 rounded-full">
                            <Text className="text-yellow-700 text-[10px]">
                              Required
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Timeline */}
                <View className="mb-5">
                  <Text className="text-gray-700 font-bold text-[15px] mb-3">
                    Timeline
                  </Text>
                  <View className="bg-gray-50 rounded-xl p-4">
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-gray-600 text-[13px]">
                        Requested
                      </Text>
                      <Text className="text-gray-900 text-[13px] font-medium">
                        {formatDate(selectedRequest.created_at)}
                      </Text>
                    </View>
                    {!!selectedRequest.processed_at && (
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-gray-600 text-[13px]">
                          Processed
                        </Text>
                        <Text className="text-gray-900 text-[13px] font-medium">
                          {formatDate(selectedRequest.processed_at)}
                        </Text>
                      </View>
                    )}
                    {!!selectedRequest.approved_at && (
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-gray-600 text-[13px]">
                          Approved
                        </Text>
                        <Text className="text-gray-900 text-[13px] font-medium">
                          {formatDate(selectedRequest.approved_at)}
                        </Text>
                      </View>
                    )}
                    {!!selectedRequest.distributed_at && (
                      <View className="flex-row justify-between items-center">
                        <Text className="text-gray-600 text-[13px]">
                          Completed
                        </Text>
                        <Text className="text-gray-900 text-[13px] font-medium">
                          {formatDate(selectedRequest.distributed_at)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Notes */}
                {!!selectedRequest.notes && (
                  <View className="mb-5">
                    <Text className="text-gray-700 font-bold text-[15px] mb-3">
                      Additional Notes
                    </Text>
                    <View className="bg-gray-50 rounded-xl p-4">
                      <Text className="text-gray-600 text-[13px] leading-5">
                        {selectedRequest.notes}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View className="flex-row gap-3 pb-6">
                  {canCancel && (
                    <Pressable
                      onPress={() => handleCancelRequest(selectedRequest)}
                      disabled={cancelling}
                      className="flex-1 bg-red-50 border border-red-200 rounded-xl py-4 items-center"
                    >
                      {cancelling ? (
                        <ActivityIndicator size="small" color="#DC2626" />
                      ) : (
                        <Text className="text-red-600 font-semibold text-[14px]">
                          Cancel Request
                        </Text>
                      )}
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => setDetailsModalVisible(false)}
                    className={`flex-1 ${canCancel ? "bg-gray-100" : "bg-green-900"} rounded-xl py-4 items-center`}
                  >
                    <Text
                      className={`font-semibold text-[14px] ${canCancel ? "text-gray-600" : "text-white"}`}
                    >
                      Close
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Queue Stats Card
  const renderQueueStats = () => {
    if (!queueStats || queueStats.totalInQueue === 0) return null;

    return (
      <View className="mx-5 mb-4">
        <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <View className="flex-row items-center gap-2 mb-2">
            <Clock size={16} color="#1D4ED8" />
            <Text className="text-blue-800 font-bold text-[14px]">
              Queue Statistics
            </Text>
          </View>
          <View className="flex-row justify-between">
            <View>
              <Text className="text-blue-600 text-[11px]">In Queue</Text>
              <Text className="text-blue-800 font-bold text-[18px]">
                {String(queueStats.totalInQueue)}
              </Text>
            </View>
            {queueStats.emergencyCount > 0 && (
              <View>
                <Text className="text-blue-600 text-[11px]">Emergency</Text>
                <Text className="text-red-600 font-bold text-[18px]">
                  {String(queueStats.emergencyCount)}
                </Text>
              </View>
            )}
            <View>
              <Text className="text-blue-600 text-[11px]">Avg. Wait</Text>
              <Text className="text-blue-800 font-bold text-[18px]">
                {formatWaitTime(queueStats.averageWaitTime)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

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
            Device Request Status
          </Text>
          <Text className="text-gray-400 text-[12px] mt-0.5">
            Track your device requests
          </Text>
        </View>
      </View>

      {/* Queue Stats */}
      {!loading && !error && renderQueueStats()}

      {/* Requests List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-400 text-[13px] mt-3">
            Loading your requests...
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
          <View className="w-20 h-20 bg-gray-50 rounded-3xl items-center justify-center mb-4">
            <Package size={32} color="#9ca3af" />
          </View>
          <Text className="text-gray-900 text-[18px] font-bold text-center mb-2">
            No Requests Yet
          </Text>
          <Text className="text-gray-400 text-[14px] text-center leading-5 mb-8">
            You haven't made any device requests. Visit the Request Device
            screen to get started.
          </Text>
          <Pressable
            onPress={() => router.push("/screens/request-device")}
            className="bg-green-900 px-6 py-3 rounded-xl"
          >
            <Text className="text-white font-semibold">Request a Device</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
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
            <View className="mb-3">
              <Text className="text-gray-400 text-[12px] font-medium">
                {`${requests.length} request${requests.length !== 1 ? "s" : ""} found`}
              </Text>
            </View>
          }
        />
      )}

      {/* Details Modal */}
      {renderDetailsModal()}
    </SafeAreaView>
  );
}

// app/screens/application.tsx
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
  Home,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  User,
  XCircle,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

type ApplicationStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Cancelled";

type ApplicationType = "New Applicant" | "Renewal";

interface Application {
  _id: string;
  application_id: string;
  status: ApplicationStatus;
  application_type: ApplicationType;
  date_applied: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  suffix?: string;
  date_of_birth: string;
  sex: "Male" | "Female" | "Other";
  civil_status: string;
  types_of_disability: string[];
  causes_of_disability: string[];
  residence_address: {
    house_no_and_street: string;
    barangay: string;
    municipality: string;
    province: string;
    region: string;
  };
  contact_details: {
    landline_no?: string;
    mobile_no?: string;
    email?: string;
  };
  educational_attainment?: string | null;
  employment_status?: string | null;
  occupation?: string | null;
  photo_1x1_url?: string | null;
  medical_certificate_url?: string | null;
  created_at: string;
  updated_at: string;
  age?: number;
}

const getStatusConfig = (status: ApplicationStatus) => {
  switch (status) {
    case "Draft":
      return {
        bg: "bg-gray-50",
        border: "border-gray-200",
        text: "text-gray-700",
        icon: FileText,
        iconColor: "#6B7280",
        label: "Draft",
        dot: "bg-gray-500",
        description: "Not yet submitted",
      };
    case "Submitted":
      return {
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-700",
        icon: Clock,
        iconColor: "#2563EB",
        label: "Submitted",
        dot: "bg-blue-500",
        description: "Waiting for review",
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
        description: "Being processed by PDAO",
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
        description: "Ready for ID issuance",
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
        description: "Application was rejected",
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
        description: "Cancelled by applicant",
      };
    default:
      return {
        bg: "bg-gray-50",
        border: "border-gray-200",
        text: "text-gray-700",
        icon: FileText,
        iconColor: "#6B7280",
        label: status,
        dot: "bg-gray-500",
        description: "",
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

const formatFullName = (app: Application) => {
  const parts = [
    app.first_name,
    app.middle_name !== "N/A" ? app.middle_name : null,
    app.last_name,
    app.suffix,
  ].filter(Boolean);
  return parts.join(" ");
};

export default function ApplicationScreen() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const fetchApplications = async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        setError("Session expired. Please log in again.");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/applications/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch applications");
      }

      const data = await res.json();
      setApplications(data.applications || []);
      setError(null);
    } catch (err) {
      console.error("[application] fetch error:", err);
      setError("Failed to load applications. Pull down to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchApplications();
  };

  const handleCancelApplication = async (applicationId: string) => {
    Alert.alert(
      "Cancel Application",
      "Are you sure you want to cancel this application? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const token =
                await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
              if (!token) return;

              const res = await fetch(
                `${EXPRESS_API_BASE}/api/applications/${applicationId}/cancel`,
                {
                  method: "PATCH",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              );

              if (res.ok) {
                fetchApplications();
                setSelectedApp(null);
                Alert.alert("Success", "Application has been cancelled.");
              } else {
                Alert.alert("Error", "Failed to cancel application.");
              }
            } catch (err) {
              console.error("[application] cancel error:", err);
              Alert.alert("Error", "Failed to cancel application.");
            }
          },
        },
      ],
    );
  };

  const handleContinueDraft = (draftId: string) => {
    router.push({
      pathname: "/apply",
      params: { draftId: draftId },
    });
  };

  const renderApplication = ({ item }: { item: Application }) => {
    const statusConfig = getStatusConfig(item.status);
    const StatusIcon = statusConfig.icon;

    return (
      <Pressable
        onPress={() => setSelectedApp(item)}
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
            <View className="flex-1 mr-2">
              <Text className="text-gray-900 font-bold text-[15px]">
                {item.application_id}
              </Text>
              <View className="flex-row items-center gap-1 mt-1">
                <User size={12} color="#9ca3af" />
                <Text
                  className="text-gray-400 text-[11px] flex-1"
                  numberOfLines={1}
                >
                  {formatFullName(item)}
                </Text>
              </View>
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

          {/* Type and Disability Preview */}
          <View className="flex-row gap-2 mb-3">
            <View className="bg-gray-100 px-2 py-1 rounded-full">
              <Text className="text-gray-600 text-[10px] font-medium">
                {item.application_type}
              </Text>
            </View>
            {item.types_of_disability.length > 0 && (
              <View className="bg-gray-100 px-2 py-1 rounded-full flex-1">
                <Text className="text-gray-600 text-[10px]" numberOfLines={1}>
                  {item.types_of_disability.join(", ")}
                </Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
            <View className="flex-row items-center gap-2">
              <MapPin size={14} color="#9ca3af" />
              <Text className="text-gray-500 text-[11px]" numberOfLines={1}>
                {item.residence_address.barangay},{" "}
                {item.residence_address.municipality}
              </Text>
            </View>
            <ChevronRight size={16} color="#d1d5db" />
          </View>
        </View>
      </Pressable>
    );
  };

  // Detail View
  if (selectedApp) {
    const statusConfig = getStatusConfig(selectedApp.status);
    const StatusIcon = statusConfig.icon;

    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <StatusBar style="dark" />

        {/* Header */}
        <View className="px-5 pt-3 pb-4 flex-row items-center gap-3 border-b border-gray-100">
          <Pressable
            onPress={() => setSelectedApp(null)}
            className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
          >
            <ArrowLeft size={18} color="#374151" strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
              Application Details
            </Text>
            <Text className="text-gray-400 text-[12px] mt-0.5">
              {selectedApp.application_id}
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
                  {statusConfig.description}
                </Text>
                <Text className="text-gray-400 text-[11px] mt-1">
                  Last updated: {formatDateTime(selectedApp.updated_at)}
                </Text>
              </View>
            </View>
          </View>

          {/* Personal Information */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Personal Information
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4">
              <View className="flex-row items-center gap-2 mb-3">
                <User size={16} color="#166534" />
                <Text className="text-gray-900 font-bold text-[16px]">
                  {formatFullName(selectedApp)}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-4">
                <View className="w-[48%]">
                  <Text className="text-gray-400 text-[10px]">
                    Date of Birth
                  </Text>
                  <Text className="text-gray-800 text-[13px] font-medium">
                    {new Date(selectedApp.date_of_birth).toLocaleDateString(
                      "en-PH",
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </Text>
                </View>
                <View className="w-[48%]">
                  <Text className="text-gray-400 text-[10px]">Age</Text>
                  <Text className="text-gray-800 text-[13px] font-medium">
                    {selectedApp.age || "N/A"} years old
                  </Text>
                </View>
                <View className="w-[48%]">
                  <Text className="text-gray-400 text-[10px]">Sex</Text>
                  <Text className="text-gray-800 text-[13px] font-medium">
                    {selectedApp.sex}
                  </Text>
                </View>
                <View className="w-[48%]">
                  <Text className="text-gray-400 text-[10px]">
                    Civil Status
                  </Text>
                  <Text className="text-gray-800 text-[13px] font-medium">
                    {selectedApp.civil_status}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Disability Information */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Disability Information
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4">
              <View className="mb-3">
                <Text className="text-gray-400 text-[10px] mb-1">
                  Type(s) of Disability
                </Text>
                {selectedApp.types_of_disability.map((type, index) => (
                  <View key={index} className="flex-row items-start gap-2 mb-1">
                    <View className="w-1 h-1 rounded-full bg-green-600 mt-2" />
                    <Text className="text-gray-800 text-[13px] flex-1">
                      {type}
                    </Text>
                  </View>
                ))}
              </View>

              {selectedApp.causes_of_disability.length > 0 && (
                <View>
                  <Text className="text-gray-400 text-[10px] mb-1">
                    Cause(s) of Disability
                  </Text>
                  {selectedApp.causes_of_disability.map((cause, index) => (
                    <View
                      key={index}
                      className="flex-row items-start gap-2 mb-1"
                    >
                      <View className="w-1 h-1 rounded-full bg-amber-600 mt-2" />
                      <Text className="text-gray-800 text-[13px] flex-1">
                        {cause}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Address */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Residence Address
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4">
              <View className="flex-row gap-3">
                <Home size={16} color="#166534" />
                <View className="flex-1">
                  <Text className="text-gray-800 text-[13px] leading-5">
                    {selectedApp.residence_address.house_no_and_street &&
                      `${selectedApp.residence_address.house_no_and_street}, `}
                    {selectedApp.residence_address.barangay},{"\n"}
                    {selectedApp.residence_address.municipality},{" "}
                    {selectedApp.residence_address.province}
                    {"\n"}
                    {selectedApp.residence_address.region}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contact Details */}
          {(selectedApp.contact_details.mobile_no ||
            selectedApp.contact_details.email ||
            selectedApp.contact_details.landline_no) && (
            <View className="mt-6">
              <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
                Contact Details
              </Text>
              <View className="bg-gray-50 rounded-2xl p-4">
                {selectedApp.contact_details.mobile_no && (
                  <View className="flex-row items-center gap-3 mb-2">
                    <Phone size={14} color="#166534" />
                    <Text className="text-gray-800 text-[13px]">
                      {selectedApp.contact_details.mobile_no}
                    </Text>
                  </View>
                )}
                {selectedApp.contact_details.email && (
                  <View className="flex-row items-center gap-3 mb-2">
                    <Mail size={14} color="#166534" />
                    <Text className="text-gray-800 text-[13px]">
                      {selectedApp.contact_details.email}
                    </Text>
                  </View>
                )}
                {selectedApp.contact_details.landline_no && (
                  <View className="flex-row items-center gap-3">
                    <Phone size={14} color="#166534" />
                    <Text className="text-gray-800 text-[13px]">
                      {selectedApp.contact_details.landline_no}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Employment & Education */}
          {(selectedApp.educational_attainment ||
            selectedApp.employment_status) && (
            <View className="mt-6">
              <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
                Employment & Education
              </Text>
              <View className="bg-gray-50 rounded-2xl p-4">
                {selectedApp.educational_attainment && (
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-gray-500 text-[12px]">Education</Text>
                    <Text className="text-gray-800 text-[13px] font-medium">
                      {selectedApp.educational_attainment}
                    </Text>
                  </View>
                )}
                {selectedApp.employment_status && (
                  <View className="flex-row justify-between items-center">
                    <Text className="text-gray-500 text-[12px]">
                      Employment
                    </Text>
                    <Text className="text-gray-800 text-[13px] font-medium">
                      {selectedApp.employment_status}
                      {selectedApp.occupation && ` - ${selectedApp.occupation}`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Documents */}
          {(selectedApp.medical_certificate_url ||
            selectedApp.photo_1x1_url) && (
            <View className="mt-6">
              <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
                Documents
              </Text>
              <View className="bg-gray-50 rounded-2xl p-4">
                {selectedApp.photo_1x1_url && (
                  <Pressable
                    className="flex-row items-center gap-3 mb-3"
                    onPress={() => console.log("View photo")}
                  >
                    <View className="w-8 h-8 bg-gray-200 rounded-lg items-center justify-center">
                      <FileText size={14} color="#6B7280" />
                    </View>
                    <Text className="text-gray-700 text-[13px] flex-1">
                      1x1 Photo
                    </Text>
                    <ChevronRight size={14} color="#9ca3af" />
                  </Pressable>
                )}
                {selectedApp.medical_certificate_url && (
                  <Pressable
                    className="flex-row items-center gap-3"
                    onPress={() => console.log("View medical certificate")}
                  >
                    <View className="w-8 h-8 bg-gray-200 rounded-lg items-center justify-center">
                      <FileText size={14} color="#6B7280" />
                    </View>
                    <Text className="text-gray-700 text-[13px] flex-1">
                      Medical Certificate
                    </Text>
                    <ChevronRight size={14} color="#9ca3af" />
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Timeline */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Timeline
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-500 text-[12px]">Submitted</Text>
                <Text className="text-gray-800 text-[12px]">
                  {formatDateTime(selectedApp.created_at)}
                </Text>
              </View>
              <View className="h-px bg-gray-200 my-2" />
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-500 text-[12px]">Last Updated</Text>
                <Text className="text-gray-800 text-[12px]">
                  {formatDateTime(selectedApp.updated_at)}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="mt-8 mb-10 gap-3">
            {/* Continue Draft Button */}
            {selectedApp.status === "Draft" && (
              <Pressable
                onPress={() => handleContinueDraft(selectedApp._id)}
                className="bg-green-900 rounded-2xl py-4 items-center"
              >
                <Text className="text-white font-bold text-[14px]">
                  Continue Application
                </Text>
              </Pressable>
            )}

            {/* Cancel Button (only for cancellable statuses) */}
            {(selectedApp.status === "Draft" ||
              selectedApp.status === "Submitted") && (
              <>
                {selectedApp.status === "Draft" && <View className="h-2" />}
                <Pressable
                  onPress={() => handleCancelApplication(selectedApp._id)}
                  className="bg-red-50 border border-red-200 rounded-2xl py-4 items-center"
                >
                  <Text className="text-red-600 font-bold text-[14px]">
                    Cancel Application
                  </Text>
                </Pressable>
                <Text className="text-gray-400 text-[11px] text-center mt-2">
                  Once cancelled, this action cannot be undone
                </Text>
              </>
            )}

            {/* New Application Button */}
            {selectedApp.status !== "Draft" && (
              <Pressable
                onPress={() => router.push("/apply")}
                className="bg-green-50 border border-green-200 rounded-2xl py-4 items-center mt-2"
              >
                <Text className="text-green-700 font-bold text-[14px]">
                  Start New Application
                </Text>
              </Pressable>
            )}
          </View>
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
            PWD Registration
          </Text>
          <Text className="text-gray-400 text-[12px] mt-0.5">
            Track your application status
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/apply")}
          className="bg-green-900 px-4 py-2 rounded-xl"
        >
          <Text className="text-white text-[12px] font-semibold">New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-400 text-[13px] mt-3">
            Loading applications...
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
      ) : applications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 bg-green-50 rounded-3xl items-center justify-center mb-4">
            <FileText size={32} color="#166534" />
          </View>
          <Text className="text-gray-900 text-[18px] font-bold text-center mb-2">
            No applications yet
          </Text>
          <Text className="text-gray-400 text-[14px] text-center leading-5 mb-8">
            You haven't submitted any PWD registration applications. Start by
            creating a new application.
          </Text>
          <Pressable
            onPress={() => router.push("/apply")}
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
              Start Application
            </Text>
            <ChevronRight size={18} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={applications}
          renderItem={renderApplication}
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
                {applications.length}{" "}
                {applications.length === 1 ? "application" : "applications"}{" "}
                found
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

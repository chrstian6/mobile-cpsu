// app/(tabs)/service.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  CreditCard,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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

type CashAssistanceStatus =
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Cancelled";

interface Application {
  _id: string;
  application_id: string;
  status: ApplicationStatus;
  application_type: string;
  created_at: string;
}

interface CashAssistanceRequest {
  _id: string;
  form_id: string;
  purpose: string;
  medical_certificate_url: string;
  status: CashAssistanceStatus;
  created_at: string;
  updated_at: string;
}

interface Card {
  _id: string;
  card_id: string;
  name: string;
  barangay: string;
  type_of_disability: string;
  address: string;
  date_of_birth: string;
  sex: string;
  blood_type: string;
  date_issued: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  status: "Active" | "Expired" | "Revoked" | "Pending";
  face_image_url: string | null;
  id_front_url: string | null;
  id_back_url: string | null;
  id_image_url: string | null;
  last_verified_at: string | null;
  verification_count: number;
  created_at: string;
}

const services = [
  {
    category: "Registration",
    items: [
      {
        title: "Application Status",
        icon: UserPlus,
        description: "Check your PWD application status",
        route: "pwd-application",
        requiresAuth: true,
        checkExisting: true,
      },
    ],
  },
  {
    category: "Assistance",
    items: [
      {
        title: "Cash Assistance Status",
        icon: FileText,
        description: "Apply for financial aid and track status",
        route: "/screens/financial-assistance",
      },
      {
        title: "Device Request Status",
        icon: RefreshCw,
        description: "Track your device requests",
        route: "/screens/device-request-status",
      },
    ],
  },
  {
    category: "Updates",
    items: [
      {
        title: "Renewal",
        icon: RefreshCw,
        description: "Renew PWD ID or benefits",
        route: "/apply?type=renewal",
      },
      {
        title: "Update Information",
        icon: FileText,
        description: "Update personal details",
        route: "/update-info",
      },
    ],
  },
];

export default function ServicesScreen() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {},
  );
  const [application, setApplication] = useState<Application | null>(null);
  const [cashRequests, setCashRequests] = useState<CashAssistanceRequest[]>([]);
  const [card, setCard] = useState<Card | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [checkingCashRequests, setCheckingCashRequests] = useState(false);
  const [checkingCard, setCheckingCard] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Check for existing application, cash requests, and card on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    await Promise.all([
      checkExistingApplication(),
      checkExistingCashRequests(),
      checkExistingCard(),
    ]);
  };

  const checkExistingApplication = async () => {
    try {
      setCheckingStatus(true);
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;

      const res = await fetch(`${EXPRESS_API_BASE}/api/applications/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const apps = data.applications || [];

        // Find the most recent non-cancelled/non-rejected application
        const activeApp = apps.find(
          (app: Application) => !["Cancelled", "Rejected"].includes(app.status),
        );

        setApplication(activeApp || null);
      }
    } catch (err) {
      console.error("[services] Error checking application:", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const checkExistingCashRequests = async () => {
    try {
      setCheckingCashRequests(true);
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;

      const res = await fetch(`${EXPRESS_API_BASE}/api/cash-assistance/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const requests = data.cash_assistance || [];

        // Sort by most recent first and get pending requests
        const sortedRequests = requests.sort(
          (a: CashAssistanceRequest, b: CashAssistanceRequest) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        setCashRequests(sortedRequests);
      }
    } catch (err) {
      console.error("[services] Error checking cash requests:", err);
    } finally {
      setCheckingCashRequests(false);
    }
  };

  const checkExistingCard = async () => {
    try {
      setCheckingCard(true);
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) return;

      const res = await fetch(`${EXPRESS_API_BASE}/api/cards/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const cards = data.cards || [];

        // Get the most recent card
        setCard(cards[0] || null);
      }
    } catch (err) {
      console.error("[services] Error checking card:", err);
    } finally {
      setCheckingCard(false);
    }
  };

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, []);

  const handlePWDApplicationPress = async () => {
    setLoadingStates((prev) => ({ ...prev, "pwd-application": true }));

    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        router.push("/(auth)/login");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/applications/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        router.push("/apply");
        return;
      }

      const data = await res.json();
      const applications = data.applications || [];

      if (applications.length === 0) {
        // No applications - prompt to create one
        Alert.alert(
          "No Applications Found",
          "You don't have any PWD applications yet. Would you like to create one?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Create Application",
              onPress: () => router.push("/apply"),
            },
          ],
        );
        return;
      }

      const app = applications[0];

      switch (app.status) {
        case "Draft":
          Alert.alert(
            "Continue Draft Application",
            "You have an unfinished application. Would you like to continue where you left off?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Continue Draft",
                onPress: () =>
                  router.push({
                    pathname: "/apply",
                    params: { draftId: app._id },
                  }),
              },
            ],
          );
          break;

        case "Submitted":
          Alert.alert(
            "Application Submitted",
            `Your application (${app.application_id}) has been submitted and is waiting for review.`,
            [
              {
                text: "View Details",
                onPress: () => router.push("/screens/application"),
              },
            ],
          );
          break;

        case "Under Review":
          Alert.alert(
            "Application Under Review",
            `Your application (${app.application_id}) is currently being reviewed by PDAO.`,
            [
              {
                text: "View Details",
                onPress: () => router.push("/screens/application"),
              },
            ],
          );
          break;

        case "Approved":
          Alert.alert(
            "Application Approved!",
            "Your application has been approved. You can now proceed with ID issuance.",
            [
              {
                text: "View Details",
                onPress: () => router.push("/screens/application"),
              },
            ],
          );
          break;

        case "Rejected":
          Alert.alert(
            "Application Rejected",
            "Your previous application was rejected. You may submit a new application.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "New Application", onPress: () => router.push("/apply") },
            ],
          );
          break;

        case "Cancelled":
          Alert.alert(
            "Application Cancelled",
            "Your previous application was cancelled. You may submit a new application.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "New Application", onPress: () => router.push("/apply") },
            ],
          );
          break;

        default:
          router.push("/screens/application");
      }
    } catch (err) {
      console.error("[services] Error handling PWD application:", err);
      router.push("/apply");
    } finally {
      setLoadingStates((prev) => ({ ...prev, "pwd-application": false }));
    }
  };

  const handleServicePress = async (
    service: (typeof services)[0]["items"][0],
  ) => {
    if (service.title === "Application Status") {
      await handlePWDApplicationPress();
    } else if (service.route) {
      router.push(service.route as any);
    }
  };

  const getCardStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "text-green-600 bg-green-50 border-green-200";
      case "Pending":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "Expired":
        return "text-red-600 bg-red-50 border-red-200";
      case "Revoked":
        return "text-gray-600 bg-gray-50 border-gray-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getCashStatusColor = (status: CashAssistanceStatus) => {
    switch (status) {
      case "Submitted":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "Under Review":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "Approved":
        return "text-green-600 bg-green-50 border-green-200";
      case "Rejected":
        return "text-red-600 bg-red-50 border-red-200";
      case "Cancelled":
        return "text-gray-600 bg-gray-50 border-gray-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getRecentCashRequests = () => {
    // Get only pending requests (Submitted and Under Review)
    return cashRequests
      .filter(
        (req) => req.status === "Submitted" || req.status === "Under Review",
      )
      .slice(0, 2); // Show only the 2 most recent
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#166534"]}
            tintColor="#166534"
          />
        }
        contentContainerStyle={{
          paddingBottom: Platform.OS === "ios" ? 100 : 120, // Add extra padding for tab bar
        }}
      >
        {/* Search Bar */}
        <View className="px-6 pt-4">
          <View className="bg-white rounded-2xl p-4 flex-row items-center shadow-sm">
            <Search size={20} color="#9ca3af" />
            <Text className="text-gray-400 ml-3 flex-1">
              Search services...
            </Text>
          </View>
        </View>

        {/* Application Status Banner */}
        {!checkingStatus && (
          <>
            {application ? (
              <View className="px-6 mt-4">
                <Pressable
                  onPress={() => router.push("/screens/application")}
                  className="bg-green-50 border border-green-200 rounded-2xl p-4 flex-row items-center gap-3"
                >
                  <View className="w-10 h-10 bg-green-100 rounded-xl items-center justify-center">
                    <FileText size={20} color="#166534" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-green-800 text-[13px] font-bold">
                      Your PWD Application
                    </Text>
                    <Text className="text-green-600 text-[11px] mt-0.5">
                      {application.application_id} • {application.status}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#166534" />
                </Pressable>
              </View>
            ) : (
              <View className="px-6 mt-4">
                <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <Text className="text-gray-500 text-[13px] text-center">
                    No PWD application yet. Tap "Application Status" to get
                    started.
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Cash Assistance Status Banner */}
        {!checkingCashRequests && cashRequests.length > 0 && (
          <View className="px-6 mt-4">
            {getRecentCashRequests().map((request, index) => (
              <Pressable
                key={request._id}
                onPress={() => router.push("/screens/financial-assistance")}
                className={`${getCashStatusColor(request.status)} rounded-2xl p-4 border mb-2 ${
                  index === getRecentCashRequests().length - 1 ? "" : "mb-2"
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View
                    className={`w-10 h-10 rounded-xl items-center justify-center ${
                      request.status === "Submitted"
                        ? "bg-blue-100"
                        : request.status === "Under Review"
                          ? "bg-yellow-100"
                          : request.status === "Approved"
                            ? "bg-green-100"
                            : request.status === "Rejected"
                              ? "bg-red-100"
                              : "bg-gray-100"
                    }`}
                  >
                    <FileText
                      size={20}
                      color={
                        request.status === "Submitted"
                          ? "#2563EB"
                          : request.status === "Under Review"
                            ? "#D97706"
                            : request.status === "Approved"
                              ? "#059669"
                              : request.status === "Rejected"
                                ? "#DC2626"
                                : "#6B7280"
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-bold text-[14px] text-gray-900">
                        Cash Assistance
                      </Text>
                      <View
                        className={`px-2 py-0.5 rounded-full ${
                          request.status === "Submitted"
                            ? "bg-blue-100"
                            : request.status === "Under Review"
                              ? "bg-yellow-100"
                              : request.status === "Approved"
                                ? "bg-green-100"
                                : request.status === "Rejected"
                                  ? "bg-red-100"
                                  : "bg-gray-100"
                        }`}
                      >
                        <Text
                          className={`text-[9px] font-semibold ${
                            request.status === "Submitted"
                              ? "text-blue-700"
                              : request.status === "Under Review"
                                ? "text-yellow-700"
                                : request.status === "Approved"
                                  ? "text-green-700"
                                  : request.status === "Rejected"
                                    ? "text-red-700"
                                    : "text-gray-700"
                          }`}
                        >
                          {request.status}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="text-gray-600 text-[12px] mt-0.5"
                      numberOfLines={1}
                    >
                      {request.purpose.substring(0, 40)}...
                    </Text>
                    <View className="flex-row items-center gap-2 mt-1">
                      <View className="flex-row items-center gap-1">
                        <FileText size={10} color="#9ca3af" />
                        <Text className="text-gray-400 text-[10px]">
                          {request.form_id}
                        </Text>
                      </View>
                      <View className="w-1 h-1 rounded-full bg-gray-300" />
                      <View className="flex-row items-center gap-1">
                        <Calendar size={10} color="#9ca3af" />
                        <Text className="text-gray-400 text-[10px]">
                          {formatDate(request.created_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#9ca3af" />
                </View>
              </Pressable>
            ))}
            {cashRequests.length > 2 && (
              <Pressable
                onPress={() => router.push("/screens/financial-assistance")}
                className="mt-1"
              >
                <Text className="text-green-600 text-[12px] font-semibold text-center">
                  View all {cashRequests.length} requests →
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Card Status Banner */}
        {!checkingCard && card && (
          <View className="px-6 mt-4">
            <Pressable
              onPress={() => router.push("/screens/id-details")}
              className={`rounded-2xl p-4 border ${getCardStatusColor(card.status)}`}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className={`w-10 h-10 rounded-xl items-center justify-center ${
                    card.status === "Active"
                      ? "bg-green-100"
                      : card.status === "Pending"
                        ? "bg-yellow-100"
                        : card.status === "Expired"
                          ? "bg-red-100"
                          : "bg-gray-100"
                  }`}
                >
                  <CreditCard
                    size={20}
                    color={
                      card.status === "Active"
                        ? "#059669"
                        : card.status === "Pending"
                          ? "#D97706"
                          : card.status === "Expired"
                            ? "#DC2626"
                            : "#6B7280"
                    }
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text
                      className="font-bold text-[14px]"
                      style={{
                        color:
                          card.status === "Active"
                            ? "#059669"
                            : card.status === "Pending"
                              ? "#D97706"
                              : card.status === "Expired"
                                ? "#DC2626"
                                : "#6B7280",
                      }}
                    >
                      PWD ID {card.status}
                    </Text>
                    <View
                      className={`px-2 py-0.5 rounded-full ${
                        card.status === "Active"
                          ? "bg-green-100"
                          : card.status === "Pending"
                            ? "bg-yellow-100"
                            : card.status === "Expired"
                              ? "bg-red-100"
                              : "bg-gray-100"
                      }`}
                    >
                      <Text
                        className={`text-[9px] font-semibold ${
                          card.status === "Active"
                            ? "text-green-700"
                            : card.status === "Pending"
                              ? "text-yellow-700"
                              : card.status === "Expired"
                                ? "text-red-700"
                                : "text-gray-700"
                        }`}
                      >
                        {card.status}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-600 text-[12px] font-medium mt-0.5">
                    {card.name}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    <View className="flex-row items-center gap-1">
                      <CreditCard size={10} color="#9ca3af" />
                      <Text className="text-gray-400 text-[10px]">
                        {card.card_id}
                      </Text>
                    </View>
                    <View className="w-1 h-1 rounded-full bg-gray-300" />
                    <View className="flex-row items-center gap-1">
                      <MapPin size={10} color="#9ca3af" />
                      <Text className="text-gray-400 text-[10px]">
                        {card.barangay}
                      </Text>
                    </View>
                  </View>
                  {card.last_verified_at && (
                    <View className="flex-row items-center gap-1 mt-1">
                      <Calendar size={10} color="#9ca3af" />
                      <Text className="text-gray-400 text-[9px]">
                        Last verified: {formatDate(card.last_verified_at)}
                      </Text>
                    </View>
                  )}
                </View>
                <ChevronRight size={18} color="#9ca3af" />
              </View>
            </Pressable>
          </View>
        )}

        {/* Loading states */}
        {(checkingStatus || checkingCashRequests || checkingCard) && (
          <View className="px-6 mt-4">
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 items-center">
              <ActivityIndicator size="small" color="#166534" />
              <Text className="text-gray-400 text-[12px] mt-2">
                Checking status...
              </Text>
            </View>
          </View>
        )}

        {/* Services List */}
        <View className="px-6 pt-6">
          {services.map((category, categoryIndex) => (
            <View key={categoryIndex} className="mb-6">
              <Text className="text-gray-900 text-lg font-bold mb-3">
                {category.category}
              </Text>
              <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {category.items.map((service, serviceIndex) => {
                  const Icon = service.icon;
                  const isLoading = loadingStates[service.title];

                  return (
                    <Pressable
                      key={serviceIndex}
                      onPress={() => handleServicePress(service)}
                      disabled={isLoading}
                      className={`p-4 flex-row items-center ${
                        serviceIndex !== category.items.length - 1
                          ? "border-b border-gray-100"
                          : ""
                      } ${isLoading ? "opacity-50" : ""}`}
                    >
                      <View className="bg-green-100 w-12 h-12 rounded-full items-center justify-center">
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#166534" />
                        ) : (
                          <Icon size={24} color="#166534" />
                        )}
                      </View>
                      <View className="flex-1 ml-3">
                        <Text className="text-gray-900 font-semibold">
                          {service.title}
                        </Text>
                        <Text className="text-gray-500 text-sm mt-0.5">
                          {service.description}
                        </Text>
                      </View>
                      <ChevronRight size={20} color="#9ca3af" />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Info Footer - Now with extra bottom padding */}
        <View className="px-6 pb-10">
          <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <View className="flex-row gap-2">
              <AlertCircle size={16} color="#2563EB" />
              <Text className="text-blue-700 text-[12px] leading-5 flex-1">
                <Text className="font-bold">Note: </Text>
                Only one PWD application is allowed per user. You can track your
                application status, ID details, and cash assistance requests
                here.
              </Text>
            </View>
          </View>
        </View>

        {/* Extra bottom spacing to ensure content isn't covered by tab bar */}
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}

// app/(tabs)/service.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  Award,
  ChevronRight,
  FileText,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
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

interface Application {
  _id: string;
  application_id: string;
  status: ApplicationStatus;
  application_type: string;
  created_at: string;
}

const services = [
  {
    category: "Registration",
    items: [
      {
        title: "New PWD Application",
        icon: UserPlus,
        description: "Apply for PWD registration and ID",
        route: "pwd-application", // Custom handler will be used
        requiresAuth: true,
        checkExisting: true, // Flag to check existing applications
      },
      {
        title: "ID Application",
        icon: Award,
        description: "Apply for PWD ID only",
        route: "/apply",
      },
    ],
  },
  {
    category: "Assistance",
    items: [
      {
        title: "Financial Assistance",
        icon: FileText,
        description: "Apply for financial aid",
        route: "/screens/financial-assistance",
      },
      {
        title: "Medical Assistance",
        icon: RefreshCw,
        description: "Request medical support",
        route: "/medical-assistance",
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
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Check for existing application on mount
  useEffect(() => {
    checkExistingApplication();
  }, []);

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
        // Only one application per user is allowed
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
        // No applications - show message
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

      // Find the application (should only be one)
      const app = applications[0];

      // Handle based on status
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
                text: "OK",
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
                text: "OK",
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
                text: "OK",
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
    if (service.title === "New PWD Application") {
      await handlePWDApplicationPress();
    } else if (service.route) {
      router.push(service.route as any);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View className="px-6 pt-4">
          <View className="bg-white rounded-2xl p-4 flex-row items-center shadow-sm">
            <Search size={20} color="#9ca3af" />
            <Text className="text-gray-400 ml-3 flex-1">
              Search services...
            </Text>
          </View>
        </View>

        {/* Application Status Banner - Show if there's an application */}
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
                      Your Application
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
                    No PWD application yet. Tap "New PWD Application" to get
                    started.
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Loading state for status check */}
        {checkingStatus && (
          <View className="px-6 mt-4">
            <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 items-center">
              <ActivityIndicator size="small" color="#166534" />
              <Text className="text-gray-400 text-[12px] mt-2">
                Checking application status...
              </Text>
            </View>
          </View>
        )}

        {/* Services List */}
        <View className="px-6 pt-6 pb-8">
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

        {/* Info Footer */}
        <View className="px-6 pb-6">
          <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <Text className="text-blue-700 text-[12px] leading-5">
              <Text className="font-bold">Note: </Text>
              Only one PWD application is allowed per user. If you have an
              existing application, you can track its status or continue where
              you left off.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

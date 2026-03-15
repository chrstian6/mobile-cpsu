// app/(tabs)/id.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  FileText,
  Heart,
  MapPin,
  Phone,
  QrCode,
  RotateCw,
  ScanLine,
  Share2,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";

// ─── Types ───────────────────────────────────────────────────────────────

interface CardData {
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
  face_image_url?: string | null;
  id_front_url?: string | null;
  id_back_url?: string | null;
  id_image_url?: string | null;
  status: "Active" | "Expired" | "Revoked" | "Pending";
  last_verified_at?: string | null;
  created_at: string;
}

interface Application {
  _id: string;
  application_id: string;
  status:
    | "Draft"
    | "Submitted"
    | "Under Review"
    | "Approved"
    | "Rejected"
    | "Cancelled";
  application_type: string;
  created_at: string;
}

// ─── Philippine Flag Component ───────────────────────────────────────────

function PhilippineFlag() {
  return (
    <View className="w-full h-full">
      {/* Blue top half */}
      <View className="absolute top-0 left-0 right-0 h-1/2 bg-blue-800" />
      {/* Red bottom half */}
      <View className="absolute bottom-0 left-0 right-0 h-1/2 bg-red-600" />
      {/* White triangle */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "50%",
          height: "100%",
          backgroundColor: "white",
          borderRightWidth: 0,
        }}
      />
      {/* Sun - simplified */}
      <View className="absolute top-1/2 left-[15%] -translate-y-1/2">
        <View className="w-6 h-6 bg-yellow-500 rounded-full" />
      </View>
      {/* Stars - simplified */}
      <View className="absolute top-[20%] left-[8%] w-2 h-2 bg-yellow-500 rounded-full" />
      <View className="absolute bottom-[20%] left-[8%] w-2 h-2 bg-yellow-500 rounded-full" />
      <View className="absolute top-1/2 left-[25%] w-2 h-2 bg-yellow-500 rounded-full" />
    </View>
  );
}

// ─── Field Component ─────────────────────────────────────────────────────

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <View className={`flex-col ${className}`}>
      <View className="border-b border-gray-700 pb-0.5">
        <Text
          className="text-center font-bold text-gray-900"
          style={{ fontSize: 13, fontFamily: "Georgia" }}
        >
          {value || " "}
        </Text>
      </View>
      <Text
        className="text-center text-red-600 font-bold mt-0.5"
        style={{ fontSize: 8, fontFamily: "Georgia" }}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Underline Row ───────────────────────────────────────────────────────

function UnderlineRow({
  label,
  value,
  labelLeft = false,
}: {
  label: string;
  value: string;
  labelLeft?: boolean;
}) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Text
        className="shrink-0 font-bold text-gray-800"
        style={{ fontSize: 9, fontFamily: "Georgia" }}
      >
        {label}
      </Text>
      <View className="flex-1 border-b border-gray-700">
        <Text
          className="text-center font-bold text-gray-900"
          style={{ fontSize: 10, fontFamily: "Georgia" }}
        >
          {value || " "}
        </Text>
      </View>
    </View>
  );
}

// ─── Card Front ───────────────────────────────────────────────────────────

function CardFront({ data }: { data: CardData }) {
  // Use id_image_url for the photo (1x1 photo)
  const photoUrl = data.id_image_url || data.face_image_url || null;

  return (
    <View
      className="w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{
        aspectRatio: 1.585,
        backgroundColor: "#fdfbe4",
        borderWidth: 1.5,
        borderColor: "#d4c87a",
      }}
    >
      {/* Subtle texture overlay */}
      <View
        className="absolute inset-0 opacity-10"
        style={{
          backgroundColor: "#c8b400",
        }}
      />

      {/* Content */}
      <View className="relative z-10 flex-1 px-[3%] pt-[2.5%] pb-[2%]">
        {/* Header */}
        <View className="flex-row items-start gap-[2%]">
          {/* Flag */}
          <View
            className="shrink-0"
            style={{ width: "8%", aspectRatio: 3 / 2 }}
          >
            <View className="w-full h-full rounded-sm overflow-hidden shadow-sm">
              <PhilippineFlag />
            </View>
          </View>

          {/* Center header text */}
          <View className="flex-1 items-center">
            <Text
              className="text-gray-700"
              style={{ fontSize: 9, fontFamily: "Georgia" }}
            >
              Republic of The Philippines
            </Text>
            <Text
              className="text-gray-700"
              style={{ fontSize: 9, fontFamily: "Georgia" }}
            >
              Region VI - Western Visayas
            </Text>
            <Text
              className="font-bold text-gray-800 uppercase tracking-wide"
              style={{ fontSize: 10, fontFamily: "Georgia" }}
            >
              Province of Negros Occidental
            </Text>
            <Text
              className="text-gray-700"
              style={{ fontSize: 9, fontFamily: "Georgia" }}
            >
              Municipality of Hinigaran
            </Text>
            <Text
              className="font-extrabold text-gray-900 uppercase tracking-wider mt-0.5"
              style={{ fontSize: 11, fontFamily: "Georgia" }}
            >
              PDAO Office
            </Text>
          </View>

          {/* Photo */}
          <View
            className="shrink-0 bg-gray-200 border border-gray-400 overflow-hidden rounded-sm shadow-md"
            style={{ width: "22%", aspectRatio: 1 }}
          >
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center bg-gray-100">
                <User size={24} color="#9ca3af" />
              </View>
            )}
          </View>
        </View>

        {/* Barangay row */}
        <View className="mt-[1.5%] flex-row items-baseline justify-center gap-1 px-[5%]">
          <Text
            className="text-gray-800 font-semibold"
            style={{ fontSize: 9, fontFamily: "Georgia" }}
          >
            Barangay:
          </Text>
          <View
            className="border-b border-gray-700"
            style={{ minWidth: 70, paddingHorizontal: 12 }}
          >
            <Text
              className="text-center font-bold text-gray-900"
              style={{ fontSize: 9, fontFamily: "Georgia" }}
            >
              {data.barangay || " "}
            </Text>
          </View>
        </View>

        {/* Main content area */}
        <View className="flex-1 flex-row mt-[2%] gap-[2%]">
          {/* Left: Name, Disability, Card ID */}
          <View className="flex-1 justify-between pr-[2%]">
            {/* Name */}
            <View className="flex-col">
              <View className="border-b border-gray-600 pb-0.5">
                <Text
                  className="text-center font-bold text-gray-900 uppercase tracking-widest"
                  style={{
                    fontSize: 16,
                    fontFamily: "Georgia",
                    letterSpacing: 1,
                  }}
                >
                  {data.name || " "}
                </Text>
              </View>
              <Text
                className="text-center text-red-600 font-bold mt-0.5"
                style={{ fontSize: 8, fontFamily: "Georgia" }}
              >
                Name
              </Text>
            </View>

            {/* Disability */}
            <View className="flex-col mt-[2%]">
              <View className="border-b border-gray-600 pb-0.5">
                <Text
                  className="text-center font-bold text-gray-900 tracking-wider"
                  style={{ fontSize: 12, fontFamily: "Georgia" }}
                >
                  {data.type_of_disability || " "}
                </Text>
              </View>
              <Text
                className="text-center text-red-600 font-bold mt-0.5"
                style={{ fontSize: 8, fontFamily: "Georgia" }}
              >
                Type of Disability
              </Text>
            </View>

            {/* Card ID (bottom right) */}
            <View className="mt-[2%] items-end">
              <Text
                className="font-extrabold text-gray-900 tracking-wider"
                style={{
                  fontSize: 12,
                  fontFamily: "Georgia",
                  letterSpacing: 0.5,
                }}
              >
                {data.card_id || " "}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="mt-[1%] items-center">
          <Text
            className="font-extrabold text-blue-700 uppercase tracking-widest"
            style={{ fontSize: 10, fontFamily: "Georgia" }}
          >
            Valid Anywhere in the Country
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Card Back ────────────────────────────────────────────────────────────

function CardBack({ data }: { data: CardData }) {
  // Calculate expiry and validity
  const getValidityInfo = () => {
    if (!data.date_issued)
      return { label: "", color: "text-gray-700", expiryStr: "" };

    const issued = new Date(data.date_issued);
    const expiry = new Date(issued);
    expiry.setFullYear(expiry.getFullYear() + 3);

    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);

    const expiryStr = expiry.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (today > expiry) {
      return { label: "EXPIRED", color: "text-red-600", expiryStr };
    } else if (diffDays <= 90) {
      return {
        label: `Expiring soon — ${diffDays} days left`,
        color: "text-amber-600",
        expiryStr,
      };
    } else {
      return {
        label: `Valid — ${diffDays} days left`,
        color: "text-green-700",
        expiryStr,
      };
    }
  };

  const validity = getValidityInfo();

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <View
      className="w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{
        aspectRatio: 1.585,
        backgroundColor: "#fdfbe4",
        borderWidth: 1.5,
        borderColor: "#d4c87a",
      }}
    >
      {/* Subtle texture overlay */}
      <View
        className="absolute inset-0 opacity-10"
        style={{
          backgroundColor: "#c8b400",
        }}
      />

      {/* Content */}
      <View className="relative z-10 flex-1 px-[4%] pt-[3%] pb-[2%]">
        {/* Address */}
        <View className="flex-row items-baseline gap-1 mb-1">
          <Text
            className="shrink-0 font-bold text-gray-800 uppercase"
            style={{ fontSize: 8, fontFamily: "Georgia" }}
          >
            Address:
          </Text>
          <View className="flex-1 border-b border-gray-700">
            <Text
              className="font-bold text-gray-900 text-center"
              style={{ fontSize: 9, fontFamily: "Georgia" }}
            >
              {data.address || " "}
            </Text>
          </View>
        </View>

        {/* DOB + Sex row */}
        <View className="flex-row gap-[3%] mb-1">
          <View className="flex-row items-baseline gap-1 flex-[2]">
            <Text
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: 7, fontFamily: "Georgia" }}
            >
              DOB:
            </Text>
            <View className="flex-1 border-b border-gray-700">
              <Text
                className="font-bold text-gray-900 text-center"
                style={{ fontSize: 8, fontFamily: "Georgia" }}
              >
                {formatDate(data.date_of_birth) || " "}
              </Text>
            </View>
          </View>
          <View className="flex-row items-baseline gap-1 flex-1">
            <Text
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: 7, fontFamily: "Georgia" }}
            >
              Sex:
            </Text>
            <View className="flex-1 border-b border-gray-700">
              <Text
                className="font-bold text-gray-900 text-center"
                style={{ fontSize: 8, fontFamily: "Georgia" }}
              >
                {data.sex || " "}
              </Text>
            </View>
          </View>
        </View>

        {/* Date Issued + Blood Type row */}
        <View className="flex-row gap-[3%] mb-1">
          <View className="flex-row items-baseline gap-1 flex-[2]">
            <Text
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: 7, fontFamily: "Georgia" }}
            >
              Issued:
            </Text>
            <View className="flex-1 border-b border-gray-700">
              <Text
                className="font-bold text-gray-900 text-center"
                style={{ fontSize: 8, fontFamily: "Georgia" }}
              >
                {formatDate(data.date_issued) || " "}
              </Text>
            </View>
          </View>
          <View className="flex-row items-baseline gap-1 flex-1">
            <Text
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: 7, fontFamily: "Georgia" }}
            >
              Blood:
            </Text>
            <View className="flex-1 border-b border-gray-700">
              <Text
                className="font-bold text-gray-900 text-center"
                style={{ fontSize: 8, fontFamily: "Georgia" }}
              >
                {data.blood_type || " "}
              </Text>
            </View>
          </View>
        </View>

        {/* Validity status */}
        {validity.label && (
          <View className="items-end mb-1">
            <Text
              className={`font-bold ${validity.color}`}
              style={{ fontSize: 8, fontFamily: "Georgia" }}
            >
              {validity.label}
            </Text>
          </View>
        )}

        {/* Emergency section */}
        <View className="mt-1">
          <Text
            className="text-center font-extrabold text-red-600 uppercase tracking-wider"
            style={{ fontSize: 10, fontFamily: "Georgia" }}
          >
            In Case of Emergency
          </Text>
        </View>

        <View className="flex-col gap-1 mt-1">
          <View className="flex-row items-baseline gap-1">
            <Text
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: 7, fontFamily: "Georgia" }}
            >
              Name:
            </Text>
            <View className="flex-1 border-b border-gray-700">
              <Text
                className="font-bold text-gray-900 text-center"
                style={{ fontSize: 8, fontFamily: "Georgia" }}
              >
                {data.emergency_contact_name || " "}
              </Text>
            </View>
          </View>
          <View className="flex-row items-baseline gap-1">
            <Text
              className="shrink-0 font-bold text-gray-800 uppercase"
              style={{ fontSize: 7, fontFamily: "Georgia" }}
            >
              Contact:
            </Text>
            <View style={{ width: "55%" }} className="border-b border-gray-700">
              <Text
                className="font-bold text-gray-900 text-center"
                style={{ fontSize: 8, fontFamily: "Georgia" }}
              >
                {data.emergency_contact_number || " "}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="mt-auto items-center">
          <Text
            className="font-bold italic text-red-600"
            style={{ fontSize: 8, fontFamily: "Georgia" }}
          >
            Valid for three (3) years upon issuance
          </Text>
          {validity.expiryStr && (
            <Text
              className="text-gray-500 mt-0.5"
              style={{ fontSize: 7, fontFamily: "Georgia" }}
            >
              Expires: {validity.expiryStr}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Flip Card Component ─────────────────────────────────────────────────

function FlipCard({ data }: { data: CardData }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;

  const flipToFront = () => {
    Animated.timing(flipAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setIsFlipped(false);
  };

  const flipToBack = () => {
    Animated.timing(flipAnimation, {
      toValue: 180,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setIsFlipped(true);
  };

  const toggleFlip = () => {
    if (isFlipped) {
      flipToFront();
    } else {
      flipToBack();
    }
  };

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "180deg"],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 180],
    outputRange: ["180deg", "360deg"],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  return (
    <View className="items-center">
      <Pressable onPress={toggleFlip}>
        <View style={{ width: width - 48 }}>
          {/* Front */}
          <Animated.View
            style={[
              frontAnimatedStyle,
              {
                backfaceVisibility: "hidden",
                position: "absolute",
                width: "100%",
              },
            ]}
          >
            <CardFront data={data} />
          </Animated.View>

          {/* Back */}
          <Animated.View
            style={[
              backAnimatedStyle,
              {
                backfaceVisibility: "hidden",
                width: "100%",
              },
            ]}
          >
            <CardBack data={data} />
          </Animated.View>
        </View>
      </Pressable>

      {/* Flip indicator */}
      <Pressable
        onPress={toggleFlip}
        className="mt-4 flex-row items-center gap-2 bg-gray-100 px-4 py-2 rounded-full"
      >
        <RotateCw size={16} color="#4b5563" />
        <Text className="text-gray-600 text-sm font-medium">
          Tap card to {isFlipped ? "see front" : "see back"}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────

export default function IDScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [card, setCard] = useState<CardData | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<
    "network" | "auth" | "server" | "unknown"
  >("unknown");

  const handleAuthError = useCallback(async () => {
    setErrorType("auth");
    setError("Your session has expired. Please log in again.");

    // Show alert and then logout
    Alert.alert(
      "Session Expired",
      "Your session has expired. Please log in again.",
      [
        {
          text: "OK",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ],
    );
  }, [logout, router]);

  const fetchData = useCallback(
    async (showLoadingIndicator = true) => {
      try {
        if (showLoadingIndicator) {
          setLoading(true);
        }
        setError(null);

        const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
        if (!token) {
          handleAuthError();
          return;
        }

        // Fetch applications to check if user has any application
        const appsRes = await fetch(`${EXPRESS_API_BASE}/api/applications/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Handle 401 Unauthorized (token expired)
        if (appsRes.status === 401) {
          const errorData = await appsRes.json().catch(() => ({}));
          if (
            errorData.message?.toLowerCase().includes("token expired") ||
            errorData.code === "REFRESH_TOKEN_EXPIRED" ||
            errorData.code === "INVALID_REFRESH_TOKEN"
          ) {
            handleAuthError();
            return;
          }
        }

        if (!appsRes.ok && appsRes.status !== 404) {
          setErrorType("server");
          throw new Error(`Failed to fetch applications: ${appsRes.status}`);
        }

        if (appsRes.ok) {
          const appsData = await appsRes.json();
          const applications = appsData.applications || [];

          // Find the most recent non-rejected/non-cancelled application
          const activeApp = applications.find(
            (app: Application) =>
              !["Cancelled", "Rejected", "Draft"].includes(app.status),
          );

          setApplication(activeApp || null);
        }

        // Check if user has a card
        const checkRes = await fetch(`${EXPRESS_API_BASE}/api/cards/check`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Handle 401 Unauthorized (token expired)
        if (checkRes.status === 401) {
          const errorData = await checkRes.json().catch(() => ({}));
          if (
            errorData.message?.toLowerCase().includes("token expired") ||
            errorData.code === "REFRESH_TOKEN_EXPIRED" ||
            errorData.code === "INVALID_REFRESH_TOKEN"
          ) {
            handleAuthError();
            return;
          }
        }

        if (!checkRes.ok) {
          setErrorType("server");
          throw new Error(`Failed to check card status: ${checkRes.status}`);
        }

        const checkData = await checkRes.json();

        if (!checkData.hasCard) {
          setCard(null);
          return;
        }

        // Get the user's cards
        const cardsRes = await fetch(`${EXPRESS_API_BASE}/api/cards/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cardsRes.status === 401) {
          const errorData = await cardsRes.json().catch(() => ({}));
          if (
            errorData.message?.toLowerCase().includes("token expired") ||
            errorData.code === "REFRESH_TOKEN_EXPIRED" ||
            errorData.code === "INVALID_REFRESH_TOKEN"
          ) {
            handleAuthError();
            return;
          }
        }

        if (!cardsRes.ok) {
          setErrorType("server");
          throw new Error(`Failed to fetch cards: ${cardsRes.status}`);
        }

        const cardsData = await cardsRes.json();

        if (cardsData.cards && cardsData.cards.length > 0) {
          // Get the most recent card
          const latestCard = cardsData.cards[0];

          // Fetch full card details if needed
          const cardDetailRes = await fetch(
            `${EXPRESS_API_BASE}/api/cards/${latestCard._id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (cardDetailRes.status === 401) {
            const errorData = await cardDetailRes.json().catch(() => ({}));
            if (
              errorData.message?.toLowerCase().includes("token expired") ||
              errorData.code === "REFRESH_TOKEN_EXPIRED" ||
              errorData.code === "INVALID_REFRESH_TOKEN"
            ) {
              handleAuthError();
              return;
            }
          }

          if (cardDetailRes.ok) {
            const detailData = await cardDetailRes.json();
            setCard(detailData.card);
          } else {
            setCard(latestCard);
          }
        } else {
          setCard(null);
        }

        // Reset error state on successful fetch
        setError(null);
        setErrorType("unknown");
      } catch (err: any) {
        console.error("[ID Screen] Error fetching data:", err);

        // Check if it's a network error
        if (
          err.message === "Network request failed" ||
          err.message?.includes("network")
        ) {
          setErrorType("network");
          setError(
            "Network connection error. Please check your internet connection.",
          );
        } else if (
          err.message?.includes("token") ||
          err.message?.includes("401")
        ) {
          setErrorType("auth");
          setError("Authentication error. Please log in again.");
        } else {
          setErrorType("server");
          setError(err.message || "Failed to load ID card");
        }
      } finally {
        if (showLoadingIndicator) {
          setLoading(false);
        }
        setRefreshing(false);
      }
    },
    [handleAuthError],
  );

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Pull to refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  const handleShare = () => {
    Alert.alert("Share", "Sharing feature coming soon!");
  };

  const handleScanID = () => {
    router.push("/scan-id");
  };

  const getStatusMessage = () => {
    if (application) {
      switch (application.status) {
        case "Submitted":
          return "Your application has been submitted and is waiting for review. Once approved, your ID will be issued.";
        case "Under Review":
          return "Your application is currently being reviewed by PDAO. You will receive your ID once approved.";
        case "Approved":
          return "Your application has been approved! Your ID is being prepared for issuance.";
        default:
          return "Your application is being processed.";
      }
    }
    return "";
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-600 mt-4">Checking your ID status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#166534"]}
              tintColor="#166534"
            />
          }
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View className="flex-1 items-center justify-center px-6">
            <View
              className={`p-4 rounded-full mb-4 ${
                errorType === "network"
                  ? "bg-amber-50"
                  : errorType === "auth"
                    ? "bg-red-50"
                    : "bg-gray-50"
              }`}
            >
              <AlertCircle
                size={32}
                color={
                  errorType === "network"
                    ? "#d97706"
                    : errorType === "auth"
                      ? "#dc2626"
                      : "#6b7280"
                }
              />
            </View>
            <Text className="text-lg font-bold text-gray-900 mb-2">
              {errorType === "network"
                ? "Connection Error"
                : errorType === "auth"
                  ? "Authentication Error"
                  : "Oops!"}
            </Text>
            <Text className="text-gray-600 text-center mb-6">{error}</Text>

            {errorType === "auth" ? (
              <Pressable
                onPress={() => {
                  logout();
                  router.replace("/(auth)/login");
                }}
                className="bg-green-700 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-semibold">Go to Login</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onRefresh}
                className="bg-green-700 px-6 py-3 rounded-xl"
              >
                <Text className="text-white font-semibold">Try Again</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Case 1: User has a card
  if (card) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#166534"]}
              tintColor="#166534"
            />
          }
        >
          {/* Header */}
          <View className="px-6 pt-4 pb-2">
            <Text className="text-2xl font-bold text-gray-900">My ID</Text>
            <Text className="text-gray-500 text-sm mt-1">
              {card.status === "Active"
                ? "Active PWD ID Card"
                : `${card.status} ID Card`}
            </Text>
          </View>

          {/* Flip Card */}
          <View className="px-6 mt-4">
            <FlipCard data={card} />
          </View>

          {/* Action Buttons */}
          <View className="px-6 mt-6">
            <View className="flex-row gap-3">
              <Pressable
                onPress={handleShare}
                className="flex-1 bg-white border border-green-200 py-4 rounded-xl flex-row items-center justify-center gap-2"
                style={{
                  shadowColor: "#166534",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Share2 size={18} color="#166534" />
                <Text className="text-green-700 font-semibold">Share</Text>
              </Pressable>
            </View>
          </View>

          {/* Card Details Summary */}
          <View className="px-6 mt-8 mb-10">
            <Text className="text-gray-900 text-lg font-bold mb-4">
              Card Details
            </Text>

            <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <View className="flex-row items-center px-4 py-3 border-b border-gray-50">
                <View className="w-8 h-8 bg-green-50 rounded-lg items-center justify-center mr-3">
                  <User size={14} color="#166534" />
                </View>
                <Text className="text-gray-500 text-sm flex-1">Full Name</Text>
                <Text className="text-gray-900 text-sm font-medium">
                  {card.name}
                </Text>
              </View>

              <View className="flex-row items-center px-4 py-3 border-b border-gray-50">
                <View className="w-8 h-8 bg-green-50 rounded-lg items-center justify-center mr-3">
                  <MapPin size={14} color="#166534" />
                </View>
                <Text className="text-gray-500 text-sm flex-1">Barangay</Text>
                <Text className="text-gray-900 text-sm font-medium">
                  {card.barangay}
                </Text>
              </View>

              <View className="flex-row items-center px-4 py-3 border-b border-gray-50">
                <View className="w-8 h-8 bg-green-50 rounded-lg items-center justify-center mr-3">
                  <Heart size={14} color="#166534" />
                </View>
                <Text className="text-gray-500 text-sm flex-1">
                  Disability Type
                </Text>
                <Text className="text-gray-900 text-sm font-medium">
                  {card.type_of_disability}
                </Text>
              </View>

              <View className="flex-row items-center px-4 py-3 border-b border-gray-50">
                <View className="w-8 h-8 bg-green-50 rounded-lg items-center justify-center mr-3">
                  <Calendar size={14} color="#166534" />
                </View>
                <Text className="text-gray-500 text-sm flex-1">
                  Date Issued
                </Text>
                <Text className="text-gray-900 text-sm font-medium">
                  {new Date(card.date_issued).toLocaleDateString()}
                </Text>
              </View>

              <View className="flex-row items-center px-4 py-3">
                <View className="w-8 h-8 bg-green-50 rounded-lg items-center justify-center mr-3">
                  <Phone size={14} color="#166534" />
                </View>
                <Text className="text-gray-500 text-sm flex-1">
                  Emergency Contact
                </Text>
                <Text className="text-gray-900 text-sm font-medium">
                  {card.emergency_contact_name}
                </Text>
              </View>
            </View>

            {/* Status Badge */}
            <View className="mt-4 flex-row items-center justify-between bg-green-50 p-4 rounded-xl border border-green-100">
              <View className="flex-row items-center gap-2">
                <View className="w-2 h-2 rounded-full bg-green-600" />
                <Text className="text-green-800 font-semibold">
                  Card Status
                </Text>
              </View>
              <View className="bg-white px-3 py-1 rounded-full border border-green-200">
                <Text className="text-green-700 text-sm font-medium">
                  {card.status}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Case 2: User has an active application but no card yet
  if (application) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#166534"]}
              tintColor="#166534"
            />
          }
        >
          <View className="flex-1 items-center justify-center px-6">
            <View className="bg-blue-50 p-4 rounded-full mb-4">
              <FileText size={32} color="#2563EB" />
            </View>
            <Text className="text-lg font-bold text-gray-900 mb-2">
              Application in Progress
            </Text>
            <Text className="text-gray-600 text-center mb-4">
              {getStatusMessage()}
            </Text>

            {/* Application Status Card */}
            <View className="bg-white rounded-2xl p-4 w-full border border-gray-100 mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-gray-500 text-sm">Application ID</Text>
                <Text className="text-gray-900 font-mono text-sm">
                  {application.application_id}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-500 text-sm">Status</Text>
                <View className="bg-blue-100 px-3 py-1 rounded-full">
                  <Text className="text-blue-700 text-xs font-semibold">
                    {application.status}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => router.push("/screens/application")}
              className="bg-green-700 px-6 py-3 rounded-xl w-full"
            >
              <Text className="text-white font-semibold text-center">
                Track Application
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Case 3: No application and no card - Show options
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#166534"]}
            tintColor="#166534"
          />
        }
      >
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-24 h-24 bg-amber-50 rounded-3xl items-center justify-center mb-6">
            <QrCode size={48} color="#d97706" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
            No ID Card Found
          </Text>
          <Text className="text-gray-500 text-center mb-8 leading-5">
            Choose an option below to get started with your PWD ID registration
            or verification.
          </Text>

          {/* Option 1: Scan Existing ID */}
          <Pressable
            onPress={handleScanID}
            className="w-full bg-white border-2 border-green-600 rounded-2xl p-6 mb-4 active:bg-green-50"
            style={{
              shadowColor: "#166534",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center gap-4">
              <View className="w-14 h-14 bg-green-100 rounded-xl items-center justify-center">
                <ScanLine size={28} color="#166534" />
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 text-lg font-bold mb-1">
                  Scan Existing ID
                </Text>
                <Text className="text-gray-500 text-sm">
                  If you already have a PWD ID, scan it to verify and link to
                  your account
                </Text>
              </View>
              <ChevronRight size={20} color="#166534" />
            </View>
          </Pressable>

          {/* Option 2: Apply for New ID */}
          <Pressable
            onPress={() => router.push("/apply")}
            className="w-full bg-green-700 rounded-2xl p-6 mb-4 active:bg-green-800"
            style={{
              shadowColor: "#166534",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center gap-4">
              <View className="w-14 h-14 bg-green-600 rounded-xl items-center justify-center">
                <FileText size={28} color="#ffffff" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-lg font-bold mb-1">
                  Apply for New ID
                </Text>
                <Text className="text-green-100 text-sm">
                  Don't have a PWD ID yet? Start your application here
                </Text>
              </View>
              <ChevronRight size={20} color="#ffffff" />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

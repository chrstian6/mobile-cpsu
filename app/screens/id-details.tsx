// app/screens/id-details.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import * as ImagePicker from "expo-image-picker";
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
  CreditCard,
  Home,
  MapPin,
  Phone,
  Upload,
  User,
  XCircle,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";

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
  updated_at: string;
}

const getStatusConfig = (status: Card["status"]) => {
  switch (status) {
    case "Active":
      return {
        bg: "bg-green-50",
        border: "border-green-200",
        text: "text-green-700",
        icon: CheckCircle2,
        iconColor: "#059669",
        label: "Active",
        dot: "bg-green-500",
        description: "Your PWD ID is active and verified",
      };
    case "Pending":
      return {
        bg: "bg-yellow-50",
        border: "border-yellow-200",
        text: "text-yellow-700",
        icon: Clock,
        iconColor: "#D97706",
        label: "Pending",
        dot: "bg-yellow-500",
        description: "Your ID is pending admin verification",
      };
    case "Expired":
      return {
        bg: "bg-red-50",
        border: "border-red-200",
        text: "text-red-700",
        icon: AlertCircle,
        iconColor: "#DC2626",
        label: "Expired",
        dot: "bg-red-500",
        description: "Your PWD ID has expired. Please renew.",
      };
    case "Revoked":
      return {
        bg: "bg-gray-50",
        border: "border-gray-200",
        text: "text-gray-700",
        icon: XCircle,
        iconColor: "#6B7280",
        label: "Revoked",
        dot: "bg-gray-500",
        description: "This ID has been revoked. Contact PDAO.",
      };
    default:
      return {
        bg: "bg-gray-50",
        border: "border-gray-200",
        text: "text-gray-700",
        icon: CreditCard,
        iconColor: "#6B7280",
        label: status,
        dot: "bg-gray-500",
        description: "",
      };
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatShortDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const calculateAge = (dateOfBirth: string) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export default function IDDetailsScreen() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchCards = async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        setError("Session expired. Please log in again.");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/cards/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch cards");
      }

      const data = await res.json();
      setCards(data.cards || []);

      // Auto-select the most recent card
      if (data.cards && data.cards.length > 0) {
        setSelectedCard(data.cards[0]);
      }

      setError(null);
    } catch (err) {
      console.error("[id-details] fetch error:", err);
      setError("Failed to load ID details. Pull down to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCards();
  };

  const handleViewImage = (url: string | null) => {
    if (!url) {
      Alert.alert("No Image", "Image not available.");
      return;
    }
    Linking.openURL(url);
  };

  const handleUploadPhoto = async () => {
    if (!selectedCard) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Photo library access is required to upload a photo.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const mime = asset.mimeType ?? "image/jpeg";
      const base64Image = `data:${mime};base64,${asset.base64}`;

      setUploading(true);

      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
      }

      const res = await fetch(
        `${EXPRESS_API_BASE}/api/cards/${selectedCard._id}/photo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            photo_base64: base64Image,
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to upload photo");
      }

      const data = await res.json();

      setSelectedCard((prev) =>
        prev ? { ...prev, id_image_url: data.photo_url } : null,
      );
      setCards((prev) =>
        prev.map((card) =>
          card._id === selectedCard._id
            ? { ...card, id_image_url: data.photo_url }
            : card,
        ),
      );

      Alert.alert("Success", "Photo uploaded successfully!");
    } catch (err) {
      console.error("[id-details] upload error:", err);
      Alert.alert("Error", "Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRenew = () => {
    router.push("/apply?type=renewal");
  };

  const handleContactPDAO = () => {
    Alert.alert(
      "Contact PDAO",
      "Please contact your local PDAO office for assistance.\n\nYou can also visit the main office at:\nMunicipal Hall, PDAO Office",
      [
        { text: "Call", onPress: () => Linking.openURL("tel:123456789") },
        { text: "OK" },
      ],
    );
  };

  // Detail View for Selected Card
  if (selectedCard) {
    const statusConfig = getStatusConfig(selectedCard.status);
    const StatusIcon = statusConfig.icon;
    const age = calculateAge(selectedCard.date_of_birth);

    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <StatusBar style="dark" />

        {/* Header */}
        <View className="px-5 pt-3 pb-4 flex-row items-center gap-3 border-b border-gray-100">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
          >
            <ArrowLeft size={18} color="#374151" strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
              PWD ID Details
            </Text>
            <Text className="text-gray-400 text-[12px] mt-0.5">
              {selectedCard.card_id}
            </Text>
          </View>
          {cards.length > 1 && (
            <Pressable
              onPress={() => setSelectedCard(null)}
              className="bg-gray-100 px-3 py-2 rounded-xl"
            >
              <Text className="text-gray-600 text-[12px] font-semibold">
                View All
              </Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#166534"
              colors={["#166534"]}
            />
          }
        >
          {/* Status Card */}
          <View
            className={`${statusConfig.bg} border ${statusConfig.border} rounded-2xl p-4 mt-5`}
          >
            <View className="flex-row items-center gap-3">
              <View
                className={`w-14 h-14 rounded-xl items-center justify-center ${statusConfig.bg}`}
              >
                <StatusIcon size={28} color={statusConfig.iconColor} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text
                    className={`${statusConfig.text} text-[18px] font-bold`}
                  >
                    {statusConfig.label}
                  </Text>
                  <View
                    className={`px-2 py-0.5 rounded-full ${statusConfig.bg} border ${statusConfig.border}`}
                  >
                    <Text
                      className={`${statusConfig.text} text-[10px] font-semibold`}
                    >
                      ID {statusConfig.label}
                    </Text>
                  </View>
                </View>
                <Text className="text-gray-500 text-[13px] mt-0.5">
                  {statusConfig.description}
                </Text>
              </View>
            </View>
          </View>

          {/* 1x1 Photo Section */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              1x1 Photo
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4">
              {selectedCard.id_image_url ? (
                <View>
                  <Pressable
                    onPress={() => handleViewImage(selectedCard.id_image_url)}
                    className="items-center"
                  >
                    <Image
                      source={{ uri: selectedCard.id_image_url }}
                      className="w-32 h-32 rounded-xl"
                      resizeMode="cover"
                    />
                    <Text className="text-gray-500 text-[11px] mt-2">
                      Tap to view full size
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleUploadPhoto}
                    disabled={uploading}
                    className="mt-3 bg-green-600 rounded-xl py-2 flex-row items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Upload size={16} color="#fff" />
                        <Text className="text-white font-semibold text-[12px]">
                          Replace Photo
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handleUploadPhoto}
                  disabled={uploading}
                  className="border-2 border-dashed border-gray-300 rounded-xl py-6 items-center justify-center gap-2"
                >
                  {uploading ? (
                    <ActivityIndicator size="large" color="#166534" />
                  ) : (
                    <>
                      <Upload size={24} color="#9ca3af" />
                      <Text className="text-gray-600 font-semibold text-[13px]">
                        Upload 1x1 Photo
                      </Text>
                      <Text className="text-gray-400 text-[11px] text-center px-4">
                        Tap to upload a 1x1 ID photo (JPEG, PNG)
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>

          {/* ID Card Images */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              ID Card Images
            </Text>
            <View className="flex-row gap-3">
              {selectedCard.id_front_url && (
                <Pressable
                  onPress={() => handleViewImage(selectedCard.id_front_url)}
                  className="flex-1"
                >
                  <View className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                    <Image
                      source={{ uri: selectedCard.id_front_url }}
                      className="w-full h-32"
                      resizeMode="cover"
                    />
                    <View className="bg-gray-900/50 absolute inset-0 items-center justify-center opacity-0 active:opacity-100">
                      <Text className="text-white text-[12px] font-semibold">
                        View Front
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-500 text-[10px] text-center mt-1">
                    Front
                  </Text>
                </Pressable>
              )}
              {selectedCard.id_back_url && (
                <Pressable
                  onPress={() => handleViewImage(selectedCard.id_back_url)}
                  className="flex-1"
                >
                  <View className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                    <Image
                      source={{ uri: selectedCard.id_back_url }}
                      className="w-full h-32"
                      resizeMode="cover"
                    />
                    <View className="bg-gray-900/50 absolute inset-0 items-center justify-center opacity-0 active:opacity-100">
                      <Text className="text-white text-[12px] font-semibold">
                        View Back
                      </Text>
                    </View>
                  </View>
                  <Text className="text-gray-500 text-[10px] text-center mt-1">
                    Back
                  </Text>
                </Pressable>
              )}
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
                  {selectedCard.name}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-4">
                <View className="w-[48%]">
                  <Text className="text-gray-400 text-[10px]">
                    Date of Birth
                  </Text>
                  <Text className="text-gray-800 text-[13px] font-medium">
                    {formatDate(selectedCard.date_of_birth)}
                  </Text>
                </View>
                <View className="w-[48%]">
                  <Text className="text-gray-400 text-[10px]">Age</Text>
                  <Text className="text-gray-800 text-[13px] font-medium">
                    {age} years old
                  </Text>
                </View>
                <View className="w-[48%]">
                  <Text className="text-gray-400 text-[10px]">Sex</Text>
                  <Text className="text-gray-800 text-[13px] font-medium">
                    {selectedCard.sex}
                  </Text>
                </View>
                <View className="w-[48%]">
                  <Text className="text-gray-400 text-[10px]">Blood Type</Text>
                  <Text className="text-gray-800 text-[13px] font-medium">
                    {selectedCard.blood_type}
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
              <View className="mb-2">
                <Text className="text-gray-400 text-[10px] mb-1">
                  Type of Disability
                </Text>
                <Text className="text-gray-800 text-[13px] font-medium">
                  {selectedCard.type_of_disability}
                </Text>
              </View>
            </View>
          </View>

          {/* Address */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Address
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4">
              <View className="flex-row gap-3">
                <Home size={16} color="#166534" />
                <View className="flex-1">
                  <Text className="text-gray-800 text-[13px] leading-5">
                    {selectedCard.address}
                  </Text>
                  <Text className="text-gray-500 text-[12px] mt-1">
                    Barangay {selectedCard.barangay}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Emergency Contact */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Emergency Contact
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4">
              <View className="flex-row items-center gap-3 mb-2">
                <User size={14} color="#166534" />
                <Text className="text-gray-800 text-[13px] flex-1">
                  {selectedCard.emergency_contact_name}
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Phone size={14} color="#166534" />
                <Text className="text-gray-800 text-[13px]">
                  {selectedCard.emergency_contact_number}
                </Text>
              </View>
            </View>
          </View>

          {/* Card Details */}
          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Card Details
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-500 text-[12px]">Card ID</Text>
                <Text className="text-gray-800 text-[12px] font-mono">
                  {selectedCard.card_id}
                </Text>
              </View>
              <View className="h-px bg-gray-200 my-2" />
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-500 text-[12px]">Date Issued</Text>
                <Text className="text-gray-800 text-[12px]">
                  {formatShortDate(selectedCard.date_issued)}
                </Text>
              </View>
              <View className="h-px bg-gray-200 my-2" />
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-500 text-[12px]">Last Verified</Text>
                <Text className="text-gray-800 text-[12px]">
                  {selectedCard.last_verified_at
                    ? formatShortDate(selectedCard.last_verified_at)
                    : "Never"}
                </Text>
              </View>
              <View className="h-px bg-gray-200 my-2" />
              <View className="flex-row justify-between items-center">
                <Text className="text-gray-500 text-[12px]">Registered On</Text>
                <Text className="text-gray-800 text-[12px]">
                  {formatShortDate(selectedCard.created_at)}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="mt-8 mb-10 gap-3">
            {selectedCard.status === "Expired" && (
              <Pressable
                onPress={handleRenew}
                className="bg-green-900 rounded-2xl py-4 items-center"
              >
                <Text className="text-white font-bold text-[14px]">
                  Renew ID Now
                </Text>
              </Pressable>
            )}

            {selectedCard.status === "Revoked" && (
              <Pressable
                onPress={handleContactPDAO}
                className="bg-blue-600 rounded-2xl py-4 items-center"
              >
                <Text className="text-white font-bold text-[14px]">
                  Contact PDAO
                </Text>
              </Pressable>
            )}

            {selectedCard.status === "Pending" && (
              <Pressable
                onPress={onRefresh}
                className="bg-yellow-600 rounded-2xl py-4 items-center"
              >
                <Text className="text-white font-bold text-[14px]">
                  Check Status
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main List View (when multiple cards)
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
            PWD ID Status
          </Text>
          <Text className="text-gray-400 text-[12px] mt-0.5">
            View your registered IDs
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-400 text-[13px] mt-3">
            Loading ID details...
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
      ) : cards.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 bg-green-50 rounded-3xl items-center justify-center mb-4">
            <CreditCard size={32} color="#166534" />
          </View>
          <Text className="text-gray-900 text-[18px] font-bold text-center mb-2">
            No ID Found
          </Text>
          <Text className="text-gray-400 text-[14px] text-center leading-5 mb-8">
            You haven't scanned any PWD ID yet. Go to ID Application to scan
            your ID.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="bg-green-900 px-8 py-4 rounded-2xl flex-row items-center gap-2"
            style={{
              shadowColor: "#166534",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-[15px]">Go Back</Text>
            <ChevronRight size={18} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#166534"
              colors={["#166534"]}
            />
          }
        >
          <View className="py-4">
            <Text className="text-gray-400 text-[12px] font-medium mb-3">
              {cards.length} {cards.length === 1 ? "ID" : "IDs"} found
            </Text>

            {cards.map((card) => {
              const statusConfig = getStatusConfig(card.status);
              const StatusIcon = statusConfig.icon;

              return (
                <Pressable
                  key={card._id}
                  onPress={() => setSelectedCard(card)}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3 active:opacity-70"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2,
                  }}
                >
                  <View className={`h-1 w-full ${statusConfig.bg}`} />

                  <View className="p-4">
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <Text className="text-gray-900 font-bold text-[15px]">
                          {card.name}
                        </Text>
                        <Text className="text-gray-400 text-[11px] mt-1">
                          {card.card_id}
                        </Text>
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

                    <View className="flex-row items-center gap-2 mt-2">
                      <View className="flex-row items-center gap-1">
                        <MapPin size={12} color="#9ca3af" />
                        <Text className="text-gray-500 text-[11px]">
                          {card.barangay}
                        </Text>
                      </View>
                      <View className="w-1 h-1 rounded-full bg-gray-300" />
                      <View className="flex-row items-center gap-1">
                        <Calendar size={12} color="#9ca3af" />
                        <Text className="text-gray-500 text-[11px]">
                          {formatShortDate(card.date_issued)}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <Text className="text-gray-400 text-[10px]">
                        Type: {card.type_of_disability}
                      </Text>
                      <ChevronRight size={16} color="#d1d5db" />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

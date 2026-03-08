// app/cash-assistance.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  FileText,
  ImagePlus,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";

type SubmitState = "idle" | "submitting" | "success";

export default function CashAssistanceScreen() {
  const [purpose, setPurpose] = useState("");
  const [dateNeeded, setDateNeeded] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [certificateUri, setCertificateUri] = useState<string | null>(null);
  const [certificateBase64, setCertificateBase64] = useState<string | null>(
    null,
  );
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submittedFormId, setSubmittedFormId] = useState<string | null>(null);

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-PH", {
      weekday: "short",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const handlePickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        useCamera
          ? "Camera access is required to take a photo."
          : "Photo library access is required to upload.",
      );
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
        });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCertificateUri(asset.uri);
      // Build proper base64 data URI
      const mime = asset.mimeType ?? "image/jpeg";
      setCertificateBase64(`data:${mime};base64,${asset.base64}`);
    }
  };

  const showImageOptions = () => {
    Alert.alert("Medical Certificate", "Choose an option", [
      { text: "Take Photo", onPress: () => handlePickImage(true) },
      { text: "Upload from Library", onPress: () => handlePickImage(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!purpose.trim()) {
      setError("Please describe the purpose of your request.");
      return;
    }
    if (!dateNeeded) {
      setError("Please select the date you need the assistance.");
      return;
    }
    if (dateNeeded <= new Date()) {
      setError("Date needed must be in the future.");
      return;
    }

    setSubmitState("submitting");

    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        setError("Session expired. Please log in again.");
        setSubmitState("idle");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/cash-assistance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          purpose: purpose.trim(),
          date_needed: dateNeeded.toISOString(),
          medical_certificate_base64: certificateBase64 ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Submission failed. Please try again.");
        setSubmitState("idle");
        return;
      }

      setSubmittedFormId(data.cash_assistance?.form_id ?? null);
      setSubmitState("success");
    } catch (err) {
      console.error("[cash-assistance] submit error:", err);
      setError("Network error. Please check your connection.");
      setSubmitState("idle");
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitState === "success") {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 bg-emerald-100 rounded-full items-center justify-center mb-6">
            <CheckCircle2 size={44} color="#059669" strokeWidth={2} />
          </View>
          <Text className="text-gray-900 text-2xl font-bold text-center mb-2">
            Request Submitted!
          </Text>
          <Text className="text-gray-500 text-base text-center leading-6 mb-4">
            Your cash assistance request has been received and is now under
            review.
          </Text>
          {submittedFormId && (
            <View className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 mb-8">
              <Text className="text-green-700 text-xs font-semibold text-center tracking-widest uppercase mb-1">
                Reference Number
              </Text>
              <Text className="text-green-900 text-lg font-bold text-center tracking-widest">
                {submittedFormId}
              </Text>
            </View>
          )}
          <Pressable
            className="w-full bg-green-900 rounded-2xl py-4 items-center active:bg-green-800"
            onPress={() => router.replace("/(tabs)")}
          >
            <Text className="text-white font-bold text-base">Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-5 pt-3 pb-4 flex-row items-center gap-3 border-b border-gray-100">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={18} color="#374151" strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
              Cash Assistance
            </Text>
            <Text className="text-gray-400 text-[12px] mt-0.5">
              Financial aid request form
            </Text>
          </View>
          <View className="bg-green-50 border border-green-100 rounded-xl px-3 py-1.5">
            <Text className="text-green-800 text-[11px] font-semibold tracking-wide">
              Financial Aid
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info Banner */}
          <View className="mx-5 mt-5 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex-row gap-3">
            <FileText size={18} color="#2563EB" strokeWidth={2} />
            <Text className="text-blue-700 text-[13px] leading-5 flex-1">
              Fill out the form below to submit a cash assistance request to the
              PDAO office. You will be notified once your request is reviewed.
            </Text>
          </View>

          <View className="px-5 mt-6 gap-y-5">
            {/* Error */}
            {error && (
              <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <AlertCircle size={16} color="#dc2626" strokeWidth={2} />
                <Text className="text-red-700 text-sm font-medium flex-1">
                  {error}
                </Text>
              </View>
            )}

            {/* Purpose */}
            <View>
              <Text className="text-gray-700 text-[13px] font-bold mb-2">
                Purpose <Text className="text-red-400 font-normal">*</Text>
              </Text>
              <TextInput
                className={`w-full px-4 text-[14px] text-gray-900 rounded-2xl border ${
                  focusedField === "purpose"
                    ? "bg-green-50 border-green-600"
                    : "bg-gray-50 border-gray-200"
                }`}
                style={{
                  paddingVertical: 14,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
                placeholder="Describe why you are requesting cash assistance (e.g. medical expenses, medicine purchase, hospital bills…)"
                placeholderTextColor="#d1d5db"
                value={purpose}
                onChangeText={setPurpose}
                onFocus={() => setFocusedField("purpose")}
                onBlur={() => setFocusedField(null)}
                multiline
                returnKeyType="default"
              />
            </View>

            {/* Medical Certificate */}
            <View>
              <Text className="text-gray-700 text-[13px] font-bold mb-2">
                Medical Certificate{" "}
                <Text className="text-gray-400 font-normal text-[12px]">
                  (optional)
                </Text>
              </Text>
              {certificateUri ? (
                <View className="rounded-2xl overflow-hidden border border-gray-200">
                  <Image
                    source={{ uri: certificateUri }}
                    style={{ width: "100%", height: 180 }}
                    resizeMode="cover"
                  />
                  <View className="flex-row">
                    <Pressable
                      onPress={showImageOptions}
                      className="flex-1 bg-gray-50 py-3 items-center border-t border-gray-200"
                    >
                      <Text className="text-gray-600 text-[13px] font-semibold">
                        Replace
                      </Text>
                    </Pressable>
                    <View className="w-px bg-gray-200" />
                    <Pressable
                      onPress={() => {
                        setCertificateUri(null);
                        setCertificateBase64(null);
                      }}
                      className="flex-1 bg-gray-50 py-3 items-center border-t border-gray-200"
                    >
                      <Text className="text-red-500 text-[13px] font-semibold">
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={showImageOptions}
                  className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl py-8 items-center gap-3"
                >
                  <View className="w-12 h-12 bg-gray-100 rounded-xl items-center justify-center">
                    <ImagePlus size={22} color="#9ca3af" strokeWidth={1.5} />
                  </View>
                  <View className="items-center">
                    <Text className="text-gray-700 text-[13px] font-semibold">
                      Upload Medical Certificate
                    </Text>
                    <Text className="text-gray-400 text-[12px] mt-1">
                      Take a photo or choose from library
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>

            {/* Date Needed */}
            <View>
              <Text className="text-gray-700 text-[13px] font-bold mb-2">
                Date Needed <Text className="text-red-400 font-normal">*</Text>
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className={`flex-row items-center px-4 rounded-2xl border gap-3 ${
                  showDatePicker
                    ? "bg-green-50 border-green-600"
                    : "bg-gray-50 border-gray-200"
                }`}
                style={{ paddingVertical: 14 }}
              >
                <Calendar
                  size={18}
                  color={dateNeeded ? "#166534" : "#9ca3af"}
                  strokeWidth={2}
                />
                <Text
                  className={`flex-1 text-[14px] ${
                    dateNeeded ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {dateNeeded ? formatDate(dateNeeded) : "Select date…"}
                </Text>
                <ChevronRight size={16} color="#d1d5db" />
              </Pressable>

              {showDatePicker && (
                <DateTimePicker
                  value={dateNeeded ?? new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={new Date(Date.now() + 86400000)} // tomorrow
                  onChange={(_, selected) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (selected) setDateNeeded(selected);
                  }}
                />
              )}

              {/* iOS confirm button */}
              {showDatePicker && Platform.OS === "ios" && (
                <Pressable
                  onPress={() => setShowDatePicker(false)}
                  className="mt-2 bg-green-900 rounded-xl py-2.5 items-center"
                >
                  <Text className="text-white text-[13px] font-bold">
                    Confirm Date
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Timestamp note */}
            <View className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
              <Text className="text-gray-400 text-[12px] leading-5">
                <Text className="font-semibold text-gray-500">Note: </Text>
                Submission timestamp is recorded automatically. The PDAO office
                will review your request and contact you within 3–5 business
                days.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View
          className="px-5 pt-3 pb-6 bg-white border-t border-gray-100"
          style={{ paddingBottom: Platform.OS === "ios" ? 24 : 16 }}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={submitState === "submitting"}
            className={`rounded-2xl py-4 flex-row items-center justify-center gap-2 ${
              submitState === "submitting"
                ? "bg-green-700 opacity-75"
                : "bg-green-900 active:bg-green-800"
            }`}
            style={{
              shadowColor: "#166534",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            {submitState === "submitting" ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-white text-[15px] font-bold ml-2">
                  Submitting…
                </Text>
              </>
            ) : (
              <>
                <Text className="text-white text-[15px] font-bold tracking-wide">
                  Submit Request
                </Text>
                <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

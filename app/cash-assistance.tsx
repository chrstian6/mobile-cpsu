// app/cash-assistance.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileText,
  ImagePlus,
  XCircle,
} from "lucide-react-native";
import { useEffect, useState } from "react";
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

type FieldErrors = {
  purpose?: string;
  medical_certificate?: string;
};

export default function CashAssistanceScreen() {
  const [purpose, setPurpose] = useState("");
  const [certificateUri, setCertificateUri] = useState<string | null>(null);
  const [certificateBase64, setCertificateBase64] = useState<string | null>(
    null,
  );
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [submittedFormId, setSubmittedFormId] = useState<string | null>(null);

  // Validation states
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isFormValid, setIsFormValid] = useState(false);

  // Validation functions
  const validatePurpose = (value: string): string | undefined => {
    if (!value.trim()) {
      return "Purpose is required.";
    }
    if (value.trim().length < 10) {
      return "Purpose must be at least 10 characters.";
    }
    if (value.trim().length > 1000) {
      return "Purpose must not exceed 1000 characters.";
    }
    return undefined;
  };

  const validateMedicalCertificate = (
    base64: string | null,
  ): string | undefined => {
    if (!base64) {
      return "Medical certificate is required.";
    }
    const isValid =
      /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(base64);
    if (!isValid) {
      return "Medical certificate must be a valid image (JPEG, PNG, or WEBP).";
    }
    return undefined;
  };

  // Run validation when fields change
  useEffect(() => {
    const errors: FieldErrors = {};

    errors.purpose = validatePurpose(purpose);
    errors.medical_certificate = validateMedicalCertificate(certificateBase64);

    // Remove undefined errors
    Object.keys(errors).forEach((key) => {
      if (errors[key as keyof FieldErrors] === undefined) {
        delete errors[key as keyof FieldErrors];
      }
    });

    setFieldErrors(errors);
    setIsFormValid(Object.keys(errors).length === 0);
  }, [purpose, certificateBase64]);

  const handleFieldBlur = (fieldName: string) => {
    setFocusedField(null);
    setTouchedFields((prev) => new Set(prev).add(fieldName));
  };

  const getFieldError = (fieldName: keyof FieldErrors): string | undefined => {
    return touchedFields.has(fieldName) ? fieldErrors[fieldName] : undefined;
  };

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
          allowsEditing: true,
          aspect: [4, 3],
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          base64: true,
          allowsEditing: true,
          aspect: [4, 3],
        });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCertificateUri(asset.uri);
      // Build proper base64 data URI
      const mime = asset.mimeType ?? "image/jpeg";
      setCertificateBase64(`data:${mime};base64,${asset.base64}`);
      setTouchedFields((prev) => new Set(prev).add("medical_certificate"));
    }
  };

  const showImageOptions = () => {
    Alert.alert("Medical Certificate", "Upload your medical certificate", [
      { text: "Take Photo", onPress: () => handlePickImage(true) },
      { text: "Upload from Library", onPress: () => handlePickImage(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleRemoveCertificate = () => {
    setCertificateUri(null);
    setCertificateBase64(null);
    setTouchedFields((prev) => new Set(prev).add("medical_certificate"));
  };

  const handleSubmit = async () => {
    // Mark all fields as touched to show all validation errors
    setTouchedFields(new Set(["purpose", "medical_certificate"]));

    // Final validation check
    const purposeError = validatePurpose(purpose);
    const certError = validateMedicalCertificate(certificateBase64);

    if (purposeError || certError) {
      setError("Please fix all errors before submitting.");
      return;
    }

    setError(null);
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
          medical_certificate_base64: certificateBase64,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle backend validation errors
        if (data.errors) {
          // If backend returns field-specific errors
          const backendErrors: FieldErrors = {};
          if (Array.isArray(data.errors)) {
            data.errors.forEach((err: any) => {
              if (err.field) {
                backendErrors[err.field as keyof FieldErrors] = err.message;
              }
            });
          }
          setFieldErrors(backendErrors);
          setError("Please check the form for errors.");
        } else {
          setError(data.message ?? "Submission failed. Please try again.");
        }
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
              Fill out the form below to submit a cash assistance request. A
              medical certificate is required for processing.
            </Text>
          </View>

          <View className="px-5 mt-6 gap-y-5">
            {/* General Error */}
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
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-700 text-[13px] font-bold">
                  Purpose <Text className="text-red-400">*</Text>
                </Text>
                {purpose.length > 0 && (
                  <Text
                    className={`text-[11px] ${purpose.length >= 10 ? "text-green-600" : "text-amber-500"}`}
                  >
                    {purpose.length}/10 min
                  </Text>
                )}
              </View>
              <TextInput
                className={`w-full px-4 text-[14px] text-gray-900 rounded-2xl border ${
                  focusedField === "purpose"
                    ? "bg-green-50 border-green-600"
                    : getFieldError("purpose")
                      ? "bg-red-50 border-red-300"
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
                onBlur={() => handleFieldBlur("purpose")}
                multiline
                textAlignVertical="top"
                returnKeyType="default"
              />
              {getFieldError("purpose") && (
                <View className="flex-row items-center gap-1 mt-1.5 ml-1">
                  <XCircle size={12} color="#dc2626" />
                  <Text className="text-red-600 text-[11px] flex-1">
                    {getFieldError("purpose")}
                  </Text>
                </View>
              )}
            </View>

            {/* Medical Certificate - NOW REQUIRED */}
            <View>
              <Text className="text-gray-700 text-[13px] font-bold mb-2">
                Medical Certificate <Text className="text-red-400">*</Text>
              </Text>

              {certificateUri ? (
                <View className="rounded-2xl overflow-hidden border border-gray-200">
                  <Image
                    source={{ uri: certificateUri }}
                    style={{ width: "100%", height: 200 }}
                    resizeMode="cover"
                  />
                  <View className="flex-row border-t border-gray-200">
                    <Pressable
                      onPress={showImageOptions}
                      className="flex-1 bg-gray-50 py-3 items-center active:bg-gray-100"
                    >
                      <Text className="text-gray-700 text-[13px] font-semibold">
                        Replace
                      </Text>
                    </Pressable>
                    <View className="w-px bg-gray-200" />
                    <Pressable
                      onPress={handleRemoveCertificate}
                      className="flex-1 bg-gray-50 py-3 items-center active:bg-gray-100"
                    >
                      <Text className="text-red-600 text-[13px] font-semibold">
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={showImageOptions}
                  className={`border-2 border-dashed rounded-2xl py-8 items-center gap-3 ${
                    getFieldError("medical_certificate")
                      ? "bg-red-50 border-red-300"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <View
                    className={`w-16 h-16 rounded-2xl items-center justify-center ${
                      getFieldError("medical_certificate")
                        ? "bg-red-100"
                        : "bg-white"
                    }`}
                  >
                    <ImagePlus
                      size={28}
                      color={
                        getFieldError("medical_certificate")
                          ? "#dc2626"
                          : "#9ca3af"
                      }
                      strokeWidth={1.5}
                    />
                  </View>
                  <View className="items-center px-4">
                    <Text
                      className={`text-[15px] font-semibold mb-1 ${
                        getFieldError("medical_certificate")
                          ? "text-red-600"
                          : "text-gray-700"
                      }`}
                    >
                      Upload Medical Certificate
                    </Text>
                    <Text
                      className={`text-[12px] text-center ${
                        getFieldError("medical_certificate")
                          ? "text-red-400"
                          : "text-gray-400"
                      }`}
                    >
                      Take a photo or choose from library{"\n"}
                      (JPEG, PNG, or WEBP)
                    </Text>
                  </View>
                </Pressable>
              )}

              {getFieldError("medical_certificate") && (
                <View className="flex-row items-center gap-1 mt-1.5 ml-1">
                  <XCircle size={12} color="#dc2626" />
                  <Text className="text-red-600 text-[11px] flex-1">
                    {getFieldError("medical_certificate")}
                  </Text>
                </View>
              )}
            </View>

            {/* Validation Summary */}
            {Object.keys(fieldErrors).length > 0 && touchedFields.size > 0 && (
              <View className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <Text className="text-amber-800 text-[12px] font-semibold mb-2">
                  Please fix the following:
                </Text>
                {Object.entries(fieldErrors).map(([field, message]) => (
                  <View key={field} className="flex-row items-start gap-2 mb-1">
                    <View className="w-1 h-1 rounded-full bg-amber-500 mt-2" />
                    <Text className="text-amber-700 text-[11px] flex-1">
                      {message}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Requirements note */}
            <View className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
              <Text className="text-gray-500 text-[12px] leading-5">
                <Text className="font-semibold text-gray-600">
                  Requirements:{" "}
                </Text>
                • Medical certificate (required){"\n"}• Valid purpose
                description (minimum 10 characters)
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
            disabled={submitState === "submitting" || !isFormValid}
            className={`rounded-2xl py-4 flex-row items-center justify-center gap-2 ${
              submitState === "submitting"
                ? "bg-green-700 opacity-75"
                : !isFormValid
                  ? "bg-gray-400"
                  : "bg-green-900 active:bg-green-800"
            }`}
            style={{
              shadowColor: !isFormValid ? "#9ca3af" : "#166534",
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
                  {isFormValid ? "Submit Request" : "Complete all fields"}
                </Text>
                {isFormValid && (
                  <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
                )}
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

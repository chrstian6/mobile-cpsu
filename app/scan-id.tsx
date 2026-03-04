// app/scan-id.tsx
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  CheckCircle,
  ChevronLeft,
  IdCard,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Upload,
  XCircle,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

// ── Config ────────────────────────────────────────────────────────────────────
const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.37:3001";

const { width } = Dimensions.get("window");
const CAMERA_HEIGHT = Math.round(width * 1.1);

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = "idle" | "processing-id" | "processing-face" | "verifying" | "done";

interface FrontData {
  card_id: string;
  name: string;
  barangay: string;
  type_of_disability: string;
  raw_text: string;
}

interface BackData {
  address: string;
  date_of_birth: string;
  sex: string;
  date_issued: string;
  blood_type: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  raw_text: string;
}

interface VerificationResult {
  isMatch: boolean;
  matchScore: number;
  distance: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const toBase64 = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${base64}`;
};

const pickImage = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission needed", "Allow access to your photo library.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.92,
    allowsEditing: false,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
};

const calculateExpiry = (dateIssuedStr: string) => {
  if (!dateIssuedStr || dateIssuedStr === "Not detected") return null;
  const cleaned = dateIssuedStr.replace(/\s/g, "");
  const parts = cleaned.split("/");
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map(Number);
  if (!month || !day || !year || year < 2000) return null;
  const expiry = new Date(year + 3, month - 1, day);
  const today = new Date();
  const isExpired = today > expiry;
  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return {
    expiryStr: expiry.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    isExpired,
    daysLeft: isExpired ? 0 : diffDays,
    daysOverdue: isExpired ? Math.abs(diffDays) : 0,
  };
};

// ── Sub-components ────────────────────────────────────────────────────────────
const StepBadge = ({
  num,
  active,
  done,
}: {
  num: number;
  active: boolean;
  done: boolean;
}) => {
  const bg = done ? "bg-green-600" : active ? "bg-green-700" : "bg-gray-200";
  return (
    <View className={`w-7 h-7 rounded-full items-center justify-center ${bg}`}>
      {done ? (
        <Text className="text-white text-xs font-bold">✓</Text>
      ) : (
        <Text
          className={`text-xs font-bold ${!active ? "text-gray-400" : "text-white"}`}
        >
          {num}
        </Text>
      )}
    </View>
  );
};

const SectionCard = ({ children }: { children: React.ReactNode }) => (
  <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">{children}</View>
);

const DataRow = ({ label, value }: { label: string; value?: string }) => (
  <View className="flex-row justify-between items-center py-1">
    <Text className="text-xs text-gray-500 flex-1">{label}</Text>
    <Text className="text-xs font-semibold text-gray-900 flex-[1.2] text-right">
      {value || "—"}
    </Text>
  </View>
);

// ── Live Camera Scanner ───────────────────────────────────────────────────────
function LiveFaceScanner({
  onFaceCaptured,
  onCancel,
  sendToWebView,
  modelsLoaded,
}: {
  onFaceCaptured: (uri: string, confidence: number) => void;
  onCancel: () => void;
  sendToWebView: (payload: object) => void;
  modelsLoaded: boolean;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [status, setStatus] = useState<"waiting" | "detected" | "capturing">(
    "waiting",
  );
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capturedRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  useEffect(() => {
    if (!modelsLoaded || !permission?.granted) return;
    scanIntervalRef.current = setInterval(async () => {
      if (capturedRef.current || !cameraRef.current) return;
      try {
        const picture = await cameraRef.current.takePictureAsync({
          quality: 0.4,
          shutterSound: false,
        } as any);
        const uri = (picture as any).uri ?? picture;
        if (uri) {
          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          sendToWebView({
            action: "processLiveFrame",
            base64: `data:image/jpeg;base64,${b64}`,
          });
        }
      } catch {
        // camera busy, skip frame
      }
    }, 600);
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, [modelsLoaded, permission?.granted]);

  const handleFrameResult = useCallback(
    async (confidence: number) => {
      setFaceConfidence(confidence);
      if (confidence > 0.75 && !capturedRef.current) {
        setStatus("detected");
        setTimeout(async () => {
          if (capturedRef.current || !cameraRef.current) return;
          capturedRef.current = true;
          setStatus("capturing");
          if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
          try {
            const picture = await cameraRef.current.takePictureAsync({
              quality: 0.85,
              shutterSound: false,
            } as any);
            const uri = (picture as any).uri ?? picture;
            if (uri) onFaceCaptured(uri, confidence);
          } catch {
            capturedRef.current = false;
            setStatus("waiting");
          }
        }, 400);
      } else if (confidence <= 0.3) {
        setStatus("waiting");
      }
    },
    [onFaceCaptured],
  );

  useEffect(() => {
    (LiveFaceScanner as any)._handleFrameResult = handleFrameResult;
  }, [handleFrameResult]);

  if (!permission) {
    return (
      <View className="h-64 items-center justify-center">
        <ActivityIndicator color="#166534" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="h-64 items-center justify-center gap-3 px-4">
        <Text className="text-sm text-gray-600 text-center">
          Camera permission is required for live face scanning.
        </Text>
        <Pressable
          className="bg-green-700 px-6 py-3 rounded-xl"
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const borderColor =
    status === "capturing"
      ? "#16A34A"
      : status === "detected"
        ? "#22C55E"
        : "#E5E7EB";
  const statusMsg =
    status === "capturing"
      ? "Capturing…"
      : status === "detected"
        ? "Face detected! Hold still…"
        : !modelsLoaded
          ? "Loading AI models…"
          : "Position your face in the oval";

  return (
    <View className="rounded-2xl overflow-hidden mb-3">
      <View
        style={{
          height: CAMERA_HEIGHT,
          borderWidth: 2,
          borderColor,
          borderRadius: 16,
        }}
        className="overflow-hidden relative"
      >
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
        <View className="absolute inset-0 items-center justify-center pointer-events-none">
          <View
            style={{
              width: width * 0.5,
              height: width * 0.65,
              borderRadius: 999,
              borderWidth: 2.5,
              borderColor:
                status === "detected" || status === "capturing"
                  ? "rgba(34,197,94,0.9)"
                  : "rgba(255,255,255,0.6)",
              borderStyle: "dashed",
            }}
          />
        </View>
        {modelsLoaded && faceConfidence > 0 && (
          <View className="absolute top-3 left-4 right-4">
            <View className="h-1.5 bg-white/30 rounded-full overflow-hidden">
              <View
                className="h-1.5 bg-green-400 rounded-full"
                style={{ width: `${Math.round(faceConfidence * 100)}%` }}
              />
            </View>
          </View>
        )}
        <View className="absolute bottom-4 self-center bg-black/50 px-4 py-1.5 rounded-full">
          <Text className="text-xs font-semibold text-white">{statusMsg}</Text>
        </View>
        {!modelsLoaded && (
          <View className="absolute inset-0 bg-black/40 items-center justify-center">
            <ActivityIndicator color="#fff" />
            <Text className="text-white text-xs mt-2">Loading AI…</Text>
          </View>
        )}
      </View>
      <Pressable
        className="mt-2 py-2.5 rounded-xl border border-gray-200 items-center"
        onPress={onCancel}
      >
        <Text className="text-sm text-gray-500 font-medium">Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ScanIdScreen() {
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);

  const [webviewReady, setWebviewReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [step, setStep] = useState<Step>("idle");

  // ID Front
  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idFrontData, setIdFrontData] = useState<Partial<FrontData> | null>(
    null,
  );
  const [idFaceCrop, setIdFaceCrop] = useState<string | null>(null);
  const [idFaceConfidence, setIdFaceConfidence] = useState<number | null>(null);
  const [idDescriptorReady, setIdDescriptorReady] = useState(false);

  // ID Back
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  const [idBackData, setIdBackData] = useState<Partial<BackData> | null>(null);

  // Live face
  const [liveUri, setLiveUri] = useState<string | null>(null);
  const [liveDescriptorReady, setLiveDescriptorReady] = useState(false);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const showLiveScannerRef = useRef(false);
  const [liveScanConfidence, setLiveScanConfidence] = useState(0);

  const _setShowLiveScanner = (val: boolean) => {
    showLiveScannerRef.current = val;
    setShowLiveScanner(val);
  };

  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const isProcessing =
    step === "processing-id" ||
    step === "processing-face" ||
    step === "verifying";

  // ── WebView communication ──────────────────────────────────────────────────
  const sendToWebView = useCallback((payload: object) => {
    webviewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
        JSON.stringify(payload),
      )} })); true;`,
    );
  }, []);

  const onWebViewMessage = useCallback(
    async (event: { nativeEvent: { data: string } }) => {
      let msg: any;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "webviewReady":
          setWebviewReady(true);
          sendToWebView({ action: "loadModels" });
          break;
        case "progress":
          setModelProgress(msg.value);
          break;
        case "modelsReady":
          setModelsLoaded(true);
          break;

        case "idFaceDone":
          setIdFaceCrop(msg.cropBase64);
          setIdFaceConfidence(msg.confidence ?? null);
          setIdDescriptorReady(true);
          setStep("idle");
          break;
        case "idFaceError":
          setErrors((p) => ({ ...p, idFront: msg.message }));
          setStep("idle");
          break;

        case "liveFrameFaceFound":
          setLiveScanConfidence(msg.confidence);
          (LiveFaceScanner as any)._handleFrameResult?.(msg.confidence);
          if (!showLiveScannerRef.current) {
            setLiveDescriptorReady(true);
            setStep("idle");
          }
          break;
        case "liveFrameNoFace":
          setLiveScanConfidence(0);
          (LiveFaceScanner as any)._handleFrameResult?.(0);
          if (!showLiveScannerRef.current && step === "processing-face") {
            setErrors((p) => ({
              ...p,
              live: "No face detected. Please try again.",
            }));
            setStep("idle");
          }
          break;

        case "liveFaceDone":
          setLiveDescriptorReady(true);
          setStep("idle");
          break;
        case "liveFaceError":
          setErrors((p) => ({ ...p, live: msg.message }));
          setStep("idle");
          break;

        case "verifyDone":
          setResult({
            isMatch: msg.isMatch,
            matchScore: msg.matchScore,
            distance: msg.distance,
          });
          setStep("done");
          break;
        case "verifyError":
          setErrors((p) => ({ ...p, verify: msg.message }));
          setStep("idle");
          break;

        case "debug":
          console.log("[WebView]", msg.message);
          setDebugLog((p) => [...p.slice(-4), msg.message]);
          break;
        case "error":
          setErrors((p) => ({ ...p, [msg.context ?? "general"]: msg.message }));
          setStep("idle");
          break;
      }
    },
    [sendToWebView],
  );

  // ── OCR ────────────────────────────────────────────────────────────────────
  const runOcr = async (uri: string, side: "front" | "back") => {
    const filename = uri.split("/").pop() ?? "image.jpg";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";
    const formData = new FormData();
    formData.append("image", { uri, name: filename, type: mime } as any);
    formData.append("side", side);
    const token = await SecureStore.getItemAsync("jwt_access_token");
    const res = await fetch(`${EXPRESS_API_BASE}/api/ocr`, {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`OCR error: ${res.status}`);
    return res.json();
  };

  // ── Handle ID Front ────────────────────────────────────────────────────────
  const handleIdFront = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setIdFrontUri(uri);
    setIdDescriptorReady(false);
    setIdFaceCrop(null);
    setIdFaceConfidence(null);
    setErrors((p) => ({ ...p, idFront: "" }));
    setStep("processing-id");
    try {
      // Run OCR and face detection in parallel
      const [ocrResult] = await Promise.all([runOcr(uri, "front")]);
      setIdFrontData({
        card_id: ocrResult.card_id || "Not detected",
        name: ocrResult.name || "Not detected",
        barangay: ocrResult.barangay || "Not detected",
        type_of_disability: ocrResult.type_of_disability || "Not detected",
        raw_text: ocrResult.raw_text || "",
      });
      // Send to WebView for face detection + crop
      const base64 = await toBase64(uri);
      sendToWebView({ action: "processIdFace", base64 });
      // Step stays as processing-id until WebView replies with idFaceDone
    } catch (err: any) {
      setErrors((p) => ({
        ...p,
        idFront: err?.message ?? "Failed to process ID front.",
      }));
      setStep("idle");
    }
  };

  // ── Handle ID Back ─────────────────────────────────────────────────────────
  const handleIdBack = async () => {
    const uri = await pickImage();
    if (!uri) return;
    setIdBackUri(uri);
    setErrors((p) => ({ ...p, idBack: "" }));
    setStep("processing-id");
    try {
      const ocrResult = await runOcr(uri, "back");
      setIdBackData({
        address: ocrResult.address || "Not detected",
        date_of_birth: ocrResult.date_of_birth || "Not detected",
        sex: ocrResult.sex || "Not detected",
        date_issued: ocrResult.date_issued || "Not detected",
        blood_type: ocrResult.blood_type || "Not detected",
        emergency_contact_name:
          ocrResult.emergency_contact_name || "Not detected",
        emergency_contact_number:
          ocrResult.emergency_contact_number || "Not detected",
        raw_text: ocrResult.raw_text || "",
      });
    } catch (err: any) {
      setErrors((p) => ({
        ...p,
        idBack: err?.message ?? "Failed to process ID back.",
      }));
    } finally {
      setStep("idle");
    }
  };

  // ── Live face captured from camera ─────────────────────────────────────────
  const handleLiveFaceCaptured = useCallback(
    async (uri: string, confidence: number) => {
      _setShowLiveScanner(false);
      setLiveUri(uri);
      setLiveDescriptorReady(false);
      setErrors((p) => ({ ...p, live: "" }));
      setStep("processing-face");
      try {
        const base64 = await toBase64(uri);
        sendToWebView({ action: "processLiveFrame", base64 });
      } catch (err: any) {
        setErrors((p) => ({
          ...p,
          live: err?.message ?? "Failed to process face.",
        }));
        setStep("idle");
      }
    },
    [sendToWebView],
  );

  useEffect(() => {
    if (liveDescriptorReady) setStep("idle");
  }, [liveDescriptorReady]);

  // ── Verify ─────────────────────────────────────────────────────────────────
  const handleVerify = () => {
    if (!idDescriptorReady || !liveDescriptorReady) {
      Alert.alert("Missing Data", "Complete all 3 steps first.");
      return;
    }
    setStep("verifying");
    setResult(null);
    sendToWebView({ action: "verify" });
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setIdFrontUri(null);
    setIdBackUri(null);
    setLiveUri(null);
    setIdFrontData(null);
    setIdBackData(null);
    setIdFaceCrop(null);
    setIdFaceConfidence(null);
    setIdDescriptorReady(false);
    setLiveDescriptorReady(false);
    setResult(null);
    setErrors({});
    setStep("idle");
    _setShowLiveScanner(false);
    setLiveScanConfidence(0);
    setDebugLog([]);
  };

  const expiry = calculateExpiry(idBackData?.date_issued ?? "");

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Hidden WebView — loads from Express backend so it works in Expo Go */}
      <View
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          top: -100,
          left: -100,
          opacity: 0,
        }}
      >
        <WebView
          ref={webviewRef}
          source={{ uri: `${EXPRESS_API_BASE}/faceapi-webview` }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onWebViewMessage}
          onError={(e) => {
            console.log("[WebView error]", e.nativeEvent.description);
            setErrors((p) => ({ ...p, webview: e.nativeEvent.description }));
          }}
        />
      </View>

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="p-2">
          <ChevronLeft size={20} color="#111827" />
        </Pressable>
        <Text className="flex-1 text-center font-bold text-base text-gray-900">
          PWD ID Verification
        </Text>
        <Pressable onPress={handleReset} className="p-2">
          <RefreshCw size={16} color="#6B7280" />
        </Pressable>
      </View>

      {/* Model loading bar */}
      {!modelsLoaded && (
        <View className="bg-blue-50 px-5 py-2.5 border-b border-blue-200">
          <View className="h-1 bg-blue-200 rounded-full overflow-hidden mb-1.5">
            <View
              className="h-1 bg-blue-600 rounded-full"
              style={{ width: `${modelProgress}%` }}
            />
          </View>
          <Text className="text-[11px] text-blue-700 font-medium">
            {webviewReady
              ? `Loading AI models… ${modelProgress}%`
              : "Initializing…"}
          </Text>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-10"
        showsVerticalScrollIndicator={false}
      >
        {/* Step progress */}
        <View className="flex-row items-center justify-center mb-5">
          {[1, 2, 3].map((n) => {
            const done =
              n === 1
                ? idDescriptorReady
                : n === 2
                  ? !!idBackData
                  : liveDescriptorReady;
            const active =
              n === 1
                ? !idDescriptorReady
                : n === 2
                  ? idDescriptorReady && !idBackData
                  : !!idBackData && !liveDescriptorReady;
            return (
              <View key={n} className="flex-row items-center">
                <StepBadge num={n} active={active} done={done} />
                <Text
                  className={`text-[11px] ml-1.5 font-medium ${done ? "text-green-600" : "text-gray-500"}`}
                >
                  {n === 1 ? "ID Front" : n === 2 ? "ID Back" : "Live Face"}
                </Text>
                {n < 3 && <View className="w-5 h-px bg-gray-200 mx-1.5" />}
              </View>
            );
          })}
        </View>

        {/* ── STEP 1: ID Front ── */}
        <SectionCard>
          <View className="flex-row items-start gap-2.5 mb-3.5">
            <View className="w-8 h-8 rounded-lg bg-green-100 items-center justify-center">
              <IdCard size={16} color="#16A34A" />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-sm text-gray-900 mb-0.5">
                Step 1 — ID Front
              </Text>
              <Text className="text-[11px] text-gray-500 leading-4">
                Upload the front of the PWD ID card.
              </Text>
            </View>
          </View>

          {/* ID image + face crop side by side — mirrors Next.js layout */}
          <View className="flex-row gap-3 mb-3">
            {/* ID front thumbnail */}
            <Pressable
              onPress={handleIdFront}
              className="flex-1 h-32 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden"
            >
              {idFrontUri ? (
                <Image
                  source={{ uri: idFrontUri }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              ) : (
                <View className="flex-1 items-center justify-center gap-1">
                  <IdCard size={28} color="#D1D5DB" />
                  <Text className="text-[10px] text-gray-400">ID Front</Text>
                  <View className="flex-row items-center gap-1 mt-1">
                    <Upload size={10} color="#9CA3AF" />
                    <Text className="text-[9px] text-gray-400">
                      Tap to upload
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>

            {/* Extracted face crop — shown once detected */}
            <View className="w-24 items-center justify-center">
              {idFaceCrop ? (
                <View className="items-center gap-1.5">
                  <View className="w-20 h-20 rounded-xl border-2 border-green-300 overflow-hidden bg-gray-100">
                    <Image
                      source={{ uri: idFaceCrop }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  </View>
                  <View className="bg-green-100 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                    <CheckCircle size={10} color="#16A34A" />
                    <Text className="text-[9px] text-green-700 font-semibold">
                      Face Extracted
                    </Text>
                  </View>
                  {idFaceConfidence !== null && (
                    <Text className="text-[9px] text-gray-400">
                      {(idFaceConfidence * 100).toFixed(0)}% conf.
                    </Text>
                  )}
                </View>
              ) : step === "processing-id" && idFrontUri ? (
                <View className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 items-center justify-center">
                  <ActivityIndicator size="small" color="#16A34A" />
                  <Text className="text-[8px] text-gray-400 mt-1 text-center">
                    Detecting{"\n"}face…
                  </Text>
                </View>
              ) : (
                <View className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 items-center justify-center">
                  <Text className="text-[9px] text-gray-400 text-center">
                    No face{"\n"}yet
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Pressable
            className={`flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg mb-2.5 bg-green-700 ${
              !modelsLoaded || isProcessing ? "opacity-40" : ""
            }`}
            onPress={handleIdFront}
            disabled={!modelsLoaded || isProcessing}
          >
            <Upload size={14} color="#fff" />
            <Text className="text-white font-semibold text-xs">
              {idFrontUri ? "Replace ID Front" : "Upload ID Front"}
            </Text>
          </Pressable>

          {errors.idFront ? (
            <Text className="text-xs text-red-600 mt-1 mb-1">
              ⚠ {errors.idFront}
            </Text>
          ) : null}

          {idFrontData && (
            <View className="bg-gray-50 rounded-lg p-3 border border-gray-100 mt-1">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Extracted Info
              </Text>
              <DataRow label="Card ID" value={idFrontData.card_id} />
              <DataRow label="Name" value={idFrontData.name} />
              <DataRow label="Barangay" value={idFrontData.barangay} />
              <DataRow
                label="Disability"
                value={idFrontData.type_of_disability}
              />
            </View>
          )}
        </SectionCard>

        {/* ── STEP 2: ID Back ── */}
        <SectionCard>
          <View className="flex-row items-start gap-2.5 mb-3.5">
            <View className="w-8 h-8 rounded-lg bg-blue-100 items-center justify-center">
              <ScanLine size={16} color="#2563EB" />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-sm text-gray-900 mb-0.5">
                Step 2 — ID Back
              </Text>
              <Text className="text-[11px] text-gray-500 leading-4">
                Upload the back of the PWD ID card.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleIdBack}
            className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden mb-3"
          >
            {idBackUri ? (
              <Image
                source={{ uri: idBackUri }}
                className="w-full h-full"
                resizeMode="contain"
              />
            ) : (
              <View className="flex-1 items-center justify-center gap-1">
                <ScanLine size={28} color="#D1D5DB" />
                <Text className="text-[10px] text-gray-400">ID Back</Text>
                <View className="flex-row items-center gap-1 mt-1">
                  <Upload size={10} color="#9CA3AF" />
                  <Text className="text-[9px] text-gray-400">
                    Tap to upload
                  </Text>
                </View>
              </View>
            )}
          </Pressable>

          <Pressable
            className={`flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg mb-2.5 bg-blue-600 ${
              isProcessing ? "opacity-40" : ""
            }`}
            onPress={handleIdBack}
            disabled={isProcessing}
          >
            <Upload size={14} color="#fff" />
            <Text className="text-white font-semibold text-xs">
              {idBackUri ? "Replace ID Back" : "Upload ID Back"}
            </Text>
          </Pressable>

          {errors.idBack ? (
            <Text className="text-xs text-red-600 mt-1 mb-1">
              ⚠ {errors.idBack}
            </Text>
          ) : null}

          {idBackData && (
            <View className="bg-gray-50 rounded-lg p-3 border border-gray-100 mt-1">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Extracted Info
              </Text>
              <DataRow label="Address" value={idBackData.address} />
              <DataRow label="Date of Birth" value={idBackData.date_of_birth} />
              <DataRow label="Sex" value={idBackData.sex} />
              <DataRow label="Blood Type" value={idBackData.blood_type} />
              <DataRow label="Date Issued" value={idBackData.date_issued} />
              {expiry && (
                <>
                  <DataRow label="Expiry" value={expiry.expiryStr} />
                  <View className="flex-row justify-between items-center py-1">
                    <Text className="text-xs text-gray-500 flex-1">
                      Validity
                    </Text>
                    <View
                      className={`px-2 py-0.5 rounded-md ${
                        expiry.isExpired
                          ? "bg-red-100"
                          : expiry.daysLeft <= 90
                            ? "bg-yellow-100"
                            : "bg-green-100"
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          expiry.isExpired
                            ? "text-red-700"
                            : expiry.daysLeft <= 90
                              ? "text-yellow-700"
                              : "text-green-700"
                        }`}
                      >
                        {expiry.isExpired
                          ? `EXPIRED (${expiry.daysOverdue}d ago)`
                          : expiry.daysLeft <= 90
                            ? `Expiring soon (${expiry.daysLeft}d)`
                            : `Valid (${expiry.daysLeft}d left)`}
                      </Text>
                    </View>
                  </View>
                </>
              )}
              <DataRow
                label="Emergency Name"
                value={idBackData.emergency_contact_name}
              />
              <DataRow
                label="Emergency No."
                value={idBackData.emergency_contact_number}
              />
            </View>
          )}
        </SectionCard>

        {/* ── STEP 3: Live Face ── */}
        <SectionCard>
          <View className="flex-row items-start gap-2.5 mb-3.5">
            <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center">
              <Zap size={16} color="#7C3AED" />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-sm text-gray-900 mb-0.5">
                Step 3 — Live Face Scan
              </Text>
              <Text className="text-[11px] text-gray-500 leading-4">
                Point the front camera at your face. It auto-captures when
                detected.
              </Text>
            </View>
          </View>

          {showLiveScanner ? (
            <LiveFaceScanner
              onFaceCaptured={handleLiveFaceCaptured}
              onCancel={() => _setShowLiveScanner(false)}
              sendToWebView={sendToWebView}
              modelsLoaded={modelsLoaded}
            />
          ) : liveUri ? (
            <View className="mb-3">
              <View className="relative w-full h-48 rounded-xl overflow-hidden border-2 border-green-300">
                <Image
                  source={{ uri: liveUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                <View className="absolute top-2 right-2 bg-green-600 px-2 py-1 rounded-lg">
                  <Text className="text-white text-[10px] font-bold">
                    ✓ Captured
                  </Text>
                </View>
              </View>
              <Pressable
                className="mt-2 py-2.5 rounded-xl border border-purple-200 bg-purple-50 items-center"
                onPress={() => {
                  setLiveUri(null);
                  setLiveDescriptorReady(false);
                  _setShowLiveScanner(true);
                }}
              >
                <Text className="text-purple-700 font-semibold text-xs">
                  Rescan Face
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              className={`flex-row items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50 mb-3 ${
                !modelsLoaded ? "opacity-50" : ""
              }`}
              onPress={() => _setShowLiveScanner(true)}
              disabled={!modelsLoaded}
            >
              <Zap size={20} color="#7C3AED" />
              <Text className="text-purple-700 font-semibold text-sm">
                {modelsLoaded ? "Start Live Face Scan" : "Loading AI models…"}
              </Text>
            </Pressable>
          )}

          {liveDescriptorReady && (
            <View className="bg-purple-100 px-3 py-2 rounded-lg items-center mb-1">
              <Text className="text-[11px] text-purple-700 font-semibold">
                ✓ Face descriptor ready
              </Text>
            </View>
          )}

          {errors.live ? (
            <Text className="text-xs text-red-600 mt-1">⚠ {errors.live}</Text>
          ) : null}
        </SectionCard>

        {/* Processing indicator */}
        {isProcessing && (
          <View className="flex-row items-center gap-2.5 bg-yellow-50 border border-yellow-200 rounded-xl p-3.5 mb-3.5">
            <ActivityIndicator size="small" color="#D97706" />
            <Text className="text-xs text-yellow-700 font-medium">
              {step === "processing-id" && "Scanning ID card…"}
              {step === "processing-face" && "Processing face…"}
              {step === "verifying" && "Comparing faces…"}
            </Text>
          </View>
        )}

        {/* Result */}
        {result && (
          <View
            className={`rounded-2xl p-4 mb-3.5 border-2 ${
              result.isMatch
                ? "border-green-300 bg-green-50"
                : "border-red-300 bg-red-50"
            }`}
          >
            <View className="flex-row items-center mb-3">
              {result.isMatch ? (
                <CheckCircle size={40} color="#16A34A" />
              ) : (
                <XCircle size={40} color="#DC2626" />
              )}
              <View className="flex-1 ml-3">
                <Text
                  className={`text-base font-bold mb-1 ${
                    result.isMatch ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {result.isMatch ? "Identity Verified" : "Verification Failed"}
                </Text>
                <Text className="text-2xl font-extrabold text-gray-900 mb-1.5">
                  {(result.matchScore * 100).toFixed(1)}% match
                </Text>
                <View className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                  <View
                    className={`h-2 rounded-full ${result.isMatch ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${Math.round(result.matchScore * 100)}%` }}
                  />
                </View>
                <Text className="text-[10px] text-gray-500">
                  Distance: {result.distance.toFixed(4)} (threshold: 0.55)
                </Text>
              </View>
            </View>

            {/* Side-by-side face comparison */}
            {idFaceCrop && liveUri && (
              <View className="flex-row items-center justify-center gap-4 mt-2 bg-white/60 rounded-xl p-3">
                <View className="items-center gap-1.5">
                  <View className="w-20 h-20 rounded-xl border-2 border-gray-200 overflow-hidden">
                    <Image
                      source={{ uri: idFaceCrop }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  </View>
                  <Text className="text-[10px] text-gray-500 font-medium">
                    ID Photo
                  </Text>
                </View>
                <Text
                  className={`text-3xl font-bold ${
                    result.isMatch ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {result.isMatch ? "≈" : "≠"}
                </Text>
                <View className="items-center gap-1.5">
                  <View className="w-20 h-20 rounded-xl border-2 border-gray-200 overflow-hidden">
                    <Image
                      source={{ uri: liveUri }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  </View>
                  <Text className="text-[10px] text-gray-500 font-medium">
                    Live Photo
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Verify button */}
        <Pressable
          className={`flex-row items-center justify-center gap-2 bg-green-700 py-3.5 rounded-xl mb-3 ${
            !idDescriptorReady ||
            !liveDescriptorReady ||
            isProcessing ||
            !modelsLoaded
              ? "opacity-50"
              : ""
          }`}
          onPress={handleVerify}
          disabled={
            !idDescriptorReady ||
            !liveDescriptorReady ||
            isProcessing ||
            !modelsLoaded
          }
        >
          {step === "verifying" ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ShieldCheck size={16} color="#fff" />
          )}
          <Text className="text-white font-bold text-base">
            {step === "verifying" ? "Verifying…" : "Verify Face Match"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

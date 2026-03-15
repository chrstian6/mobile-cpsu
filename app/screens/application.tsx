// app/screens/application.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Home,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  XCircle,
  Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";
const { width } = Dimensions.get("window");
const CAMERA_HEIGHT = Math.round(width * 1.1);

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
  contact_details: { landline_no?: string; mobile_no?: string; email?: string };
  educational_attainment?: string | null;
  employment_status?: string | null;
  occupation?: string | null;
  photo_1x1_url?: string | null;
  medical_certificate_url?: string | null;
  created_at: string;
  updated_at: string;
  age?: number;
}

interface CardDetails {
  blood_type: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
}
interface VerificationResult {
  isMatch: boolean;
  matchScore: number;
  distance: number;
}

const BLOOD_TYPES = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Unknown",
];

const formatPhoneNumber = (text: string): string => {
  const limited = text.replace(/\D/g, "").slice(0, 11);
  if (limited.length <= 4) return limited;
  if (limited.length <= 7) return `${limited.slice(0, 4)} ${limited.slice(4)}`;
  return `${limited.slice(0, 4)} ${limited.slice(4, 7)} ${limited.slice(7, 11)}`;
};
const unformatPhoneNumber = (f: string) => f.replace(/\D/g, "");

const toBase64 = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${base64}`;
};

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
        /* camera busy */
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

  if (!permission)
    return (
      <View className="h-64 items-center justify-center">
        <ActivityIndicator color="#166534" />
      </View>
    );
  if (!permission.granted)
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

const getStatusConfig = (status: ApplicationStatus) => {
  const configs: Record<ApplicationStatus, any> = {
    Draft: {
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-700",
      icon: FileText,
      iconColor: "#6B7280",
      label: "Draft",
      dot: "bg-gray-500",
      description: "Not yet submitted",
    },
    Submitted: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      icon: Clock,
      iconColor: "#2563EB",
      label: "Submitted",
      dot: "bg-blue-500",
      description: "Waiting for review",
    },
    "Under Review": {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: RefreshCw,
      iconColor: "#D97706",
      label: "Under Review",
      dot: "bg-amber-500",
      description: "Being processed by PDAO",
    },
    Approved: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      icon: CheckCircle2,
      iconColor: "#059669",
      label: "Approved",
      dot: "bg-emerald-500",
      description: "Ready for ID issuance",
    },
    Rejected: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: XCircle,
      iconColor: "#DC2626",
      label: "Rejected",
      dot: "bg-red-500",
      description: "Application was rejected",
    },
    Cancelled: {
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-700",
      icon: XCircle,
      iconColor: "#6B7280",
      label: "Cancelled",
      dot: "bg-gray-500",
      description: "Cancelled by applicant",
    },
  };
  return (
    configs[status] ?? {
      bg: "bg-gray-50",
      border: "border-gray-200",
      text: "text-gray-700",
      icon: FileText,
      iconColor: "#6B7280",
      label: status,
      dot: "bg-gray-500",
      description: "",
    }
  );
};

const formatDate = (d: string) => {
  const diff = Math.ceil(
    Math.abs(Date.now() - new Date(d).getTime()) / 86400000,
  );
  if (diff === 1) return "Yesterday";
  if (diff <= 7) return `${diff} days ago`;
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
const formatDateTime = (d: string) =>
  new Date(d).toLocaleDateString("en-PH", {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const formatFullName = (app: Application) =>
  [
    app.first_name,
    app.middle_name !== "N/A" ? app.middle_name : null,
    app.last_name,
    app.suffix,
  ]
    .filter(Boolean)
    .join(" ");

export default function ApplicationScreen() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const webviewRef = useRef<WebView>(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);

  // When models finish loading and the modal is open with a photo already
  // selected, kick off processIdFace (models weren't ready before).
  useEffect(() => {
    if (
      modelsLoaded &&
      showCardModal &&
      photoBase64Ref.current &&
      !uploadedDescriptorReadyRef.current
    ) {
      console.log("[modelsLoaded effect] sending processIdFace");
      sendToWebView({
        action: "processIdFace",
        base64: photoBase64Ref.current,
      });
    }
  }, [modelsLoaded]);

  const [showCardModal, setShowCardModal] = useState(false);
  const [submittingCard, setSubmittingCard] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardDetails>({
    blood_type: "Unknown",
    emergency_contact_name: "",
    emergency_contact_number: "",
  });
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // Ref keeps base64 current in closures without stale state
  const photoBase64Ref = useRef<string | null>(null);

  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [liveUri, setLiveUri] = useState<string | null>(null);
  const [liveDescriptorReady, setLiveDescriptorReady] = useState(false);
  const liveDescriptorReadyRef = useRef(false);
  const [uploadedDescriptorReady, setUploadedDescriptorReady] = useState(false);
  const uploadedDescriptorReadyRef = useRef(false);
  const verifyFiredRef = useRef(false); // prevents duplicate verify calls
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);
  // processing = extracting live descriptor
  // verifying  = comparing live descriptor vs uploaded photo
  const [faceStep, setFaceStep] = useState<
    "idle" | "processing" | "verifying" | "done"
  >("idle");
  const [faceErrors, setFaceErrors] = useState<Record<string, string>>({});

  const hasApprovedApplication = applications.some(
    (a) => a.status === "Approved",
  );

  const sendToWebView = useCallback((payload: object) => {
    // Serialize once into a JS object literal — avoids the double-stringify
    // bug where photoBase64 (300–800 KB string) gets double-escaped and
    // silently corrupted when eval'd by the WebView JS engine.
    const action = (payload as any).action ?? "unknown";
    const json = JSON.stringify(payload);
    console.log(`[sendToWebView] action=${action} bytes=${json.length}`);
    webviewRef.current?.injectJavaScript(
      `(function(){
        try {
          var p = ${json};
          window.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(p)}));
        } catch(e) { console.error('[WV inject]', e.message); }
      })(); true;`,
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
        case "liveFrameFaceFound":
          (LiveFaceScanner as any)._handleFrameResult?.(msg.confidence);
          break;
        case "liveFrameNoFace":
          (LiveFaceScanner as any)._handleFrameResult?.(0);
          break;

        // Live descriptor cached. Auto-verify if uploaded photo descriptor is ready.
        case "liveFinalDone":
          liveDescriptorReadyRef.current = true;
          setLiveDescriptorReady(true);
          setFaceStep("idle");
          if (uploadedDescriptorReadyRef.current && !verifyFiredRef.current) {
            verifyFiredRef.current = true;
            setFaceStep("verifying");
            setVerificationResult(null);
            sendToWebView({ action: "verify" });
          }
          break;

        case "idFaceDone":
          uploadedDescriptorReadyRef.current = true;
          setUploadedDescriptorReady(true);
          console.log(
            "[idFaceDone] uploaded photo descriptor ready, liveReady:",
            liveDescriptorReadyRef.current,
          );
          if (liveDescriptorReadyRef.current && !verifyFiredRef.current) {
            verifyFiredRef.current = true;
            setFaceStep("verifying");
            setVerificationResult(null);
            sendToWebView({ action: "verify" });
          }
          break;
        case "idFaceError":
          setFaceErrors((p) => ({ ...p, upload: msg.message }));
          break;

        case "liveFinalError":
          setFaceErrors((p) => ({ ...p, live: msg.message }));
          setFaceStep("idle");
          break;

        case "verifyDone":
          console.log(
            `[verifyDone] isMatch=${msg.isMatch} score=${msg.matchScore} distance=${msg.distance}`,
          );
          setVerificationResult({
            isMatch: msg.isMatch,
            matchScore: msg.matchScore,
            distance: msg.distance,
          });
          setFaceStep("done");
          break;

        case "verifyError":
          console.log(`[verifyError] ${msg.message}`);
          setFaceErrors((p) => ({ ...p, verify: msg.message }));
          setFaceStep("idle");
          break;

        case "debug":
          console.log("[WebView]", msg.message);
          break;
        case "error":
          setFaceErrors((p) => ({
            ...p,
            [msg.context ?? "general"]: msg.message,
          }));
          setFaceStep("idle");
          break;
      }
    },
    [sendToWebView],
  );

  const handleLiveFaceCaptured = useCallback(
    async (uri: string, _confidence: number) => {
      setShowLiveScanner(false);
      setLiveUri(uri);
      liveDescriptorReadyRef.current = false;
      setLiveDescriptorReady(false);
      verifyFiredRef.current = false;
      setVerificationResult(null);
      setFaceErrors((p) => ({ ...p, live: "", verify: "" }));
      setFaceStep("processing");
      try {
        const base64 = await toBase64(uri);
        // Step 1: extract live descriptor → on liveFinalDone, Step 2 fires automatically
        sendToWebView({ action: "processLiveFinal", base64 });
      } catch (err: any) {
        setFaceErrors((p) => ({
          ...p,
          live: err?.message ?? "Failed to process face.",
        }));
        setFaceStep("idle");
      }
    },
    [sendToWebView],
  );

  const handleRetryVerify = useCallback(() => {
    if (!liveDescriptorReady || !uploadedDescriptorReady) return;
    verifyFiredRef.current = true;
    setFaceStep("verifying");
    setVerificationResult(null);
    setFaceErrors((p) => ({ ...p, verify: "" }));
    sendToWebView({ action: "verify" });
  }, [liveDescriptorReady, uploadedDescriptorReady, sendToWebView]);

  const fetchApplications = async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        setError("Session expired. Please log in again.");
        return;
      }
      const res = await fetch(`${EXPRESS_API_BASE}/api/applications/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch applications");
      const data = await res.json();
      setApplications(data.applications || []);
      setError(null);
    } catch {
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
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (res.ok) {
                fetchApplications();
                setSelectedApp(null);
                Alert.alert("Success", "Application has been cancelled.");
              } else Alert.alert("Error", "Failed to cancel application.");
            } catch {
              Alert.alert("Error", "Failed to cancel application.");
            }
          },
        },
      ],
    );
  };

  const handleContinueDraft = (draftId: string) =>
    router.push({ pathname: "/apply", params: { draftId } });

  // Stores photo and resets face state. Sends processIdFace immediately
  // if the modal (and WebView) is already open; otherwise onShow handles it.
  const applyPhoto = (uri: string, base64: string) => {
    setPhotoUri(uri);
    photoBase64Ref.current = base64;
    setVerificationResult(null);
    liveDescriptorReadyRef.current = false;
    setLiveDescriptorReady(false);
    uploadedDescriptorReadyRef.current = false;
    setUploadedDescriptorReady(false);
    verifyFiredRef.current = false;
    setLiveUri(null);
    setFaceStep("idle");
    setFaceErrors({});
    // Modal already open → WebView is mounted → send immediately
    if (showCardModal && modelsLoaded) {
      console.log(
        "[applyPhoto] modal open, sending processIdFace immediately, bytes:",
        base64.length,
      );
      sendToWebView({ action: "processIdFace", base64 });
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        applyPhoto(
          asset.uri,
          asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : await toBase64(asset.uri),
        );
      }
    } catch {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera permission is needed to take a photo.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        applyPhoto(
          asset.uri,
          asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : await toBase64(asset.uri),
        );
      }
    } catch {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setCardDetails({ ...cardDetails, emergency_contact_number: formatted });
    const raw = unformatPhoneNumber(formatted);
    if (raw.length > 0 && raw.length < 11)
      setPhoneError("Phone number must be 11 digits");
    else if (raw.length === 11 && !raw.startsWith("09"))
      setPhoneError("Phone number must start with 09");
    else setPhoneError(null);
  };

  const handleSendCardDetails = async () => {
    if (!cardDetails.emergency_contact_name?.trim()) {
      Alert.alert("Error", "Emergency contact name is required");
      return;
    }
    if (!/^[A-Za-z\s-]+$/.test(cardDetails.emergency_contact_name.trim())) {
      Alert.alert(
        "Error",
        "Emergency contact name can only contain letters, spaces, and hyphens",
      );
      return;
    }
    if (!cardDetails.emergency_contact_number?.trim()) {
      Alert.alert("Error", "Emergency contact number is required");
      return;
    }
    const rawPhone = unformatPhoneNumber(cardDetails.emergency_contact_number);
    if (rawPhone.length !== 11) {
      Alert.alert("Error", "Emergency contact number must be 11 digits");
      return;
    }
    if (!rawPhone.startsWith("09")) {
      Alert.alert("Error", "Emergency contact number must start with 09");
      return;
    }
    if (!cardDetails.blood_type) {
      Alert.alert("Error", "Blood type is required");
      return;
    }
    if (!photoBase64Ref.current) {
      Alert.alert("Error", "1x1 photo is required");
      return;
    }
    if (!verificationResult?.isMatch) {
      Alert.alert(
        "Error",
        "Face verification is required. Please complete the face scan and verification.",
      );
      return;
    }

    setSubmittingCard(true);
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
      }
      if (!selectedApp) return;
      const res = await fetch(
        `${EXPRESS_API_BASE}/api/cards/request-from-application`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            blood_type: cardDetails.blood_type,
            emergency_contact_name: cardDetails.emergency_contact_name.trim(),
            emergency_contact_number: rawPhone,
            photo_base64: photoBase64Ref.current,
            face_verification_score: verificationResult.matchScore,
            face_verification_distance: verificationResult.distance,
          }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        Alert.alert(
          "Success",
          "Card request submitted successfully. The admin will review and issue your card.",
          [
            {
              text: "OK",
              onPress: () => {
                setShowCardModal(false);
                setCardDetails({
                  blood_type: "Unknown",
                  emergency_contact_name: "",
                  emergency_contact_number: "",
                });
                setPhotoUri(null);
                photoBase64Ref.current = null;
                setLiveUri(null);
                liveDescriptorReadyRef.current = false;
                setLiveDescriptorReady(false);
                uploadedDescriptorReadyRef.current = false;
                setUploadedDescriptorReady(false);
                setVerificationResult(null);
                setFaceStep("idle");
                setPhoneError(null);
              },
            },
          ],
        );
      } else {
        Alert.alert(
          "Error",
          data.error || data.message || "Failed to submit card request",
        );
      }
    } catch {
      Alert.alert("Error", "Failed to submit card request. Please try again.");
    } finally {
      setSubmittingCard(false);
    }
  };

  const renderApplication = ({ item }: { item: Application }) => {
    const sc = getStatusConfig(item.status);
    const Icon = sc.icon;
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
        <View className={`h-1 w-full ${sc.bg}`} />
        <View className="p-4">
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
              className={`flex-row items-center gap-1.5 ${sc.bg} px-2.5 py-1.5 rounded-full border ${sc.border}`}
            >
              <View className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              <Icon size={12} color={sc.iconColor} />
              <Text className={`${sc.text} text-[11px] font-semibold`}>
                {sc.label}
              </Text>
            </View>
          </View>
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

  if (selectedApp) {
    const sc = getStatusConfig(selectedApp.status);
    const StatusIcon = sc.icon;

    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <StatusBar style="dark" />

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
              setFaceErrors((p) => ({
                ...p,
                webview: e.nativeEvent.description,
              }));
            }}
          />
        </View>

        <Modal
          animationType="slide"
          transparent
          visible={showCardModal}
          onRequestClose={() => setShowCardModal(false)}
          onShow={() => {
            // Modal just became visible — WebView is now mounted and ready.
            // Send processIdFace if we have a photo but no descriptor yet.
            if (photoBase64Ref.current && !uploadedDescriptorReadyRef.current) {
              console.log(
                "[modal onShow] sending processIdFace, photo bytes:",
                photoBase64Ref.current.length,
              );
              sendToWebView({
                action: "processIdFace",
                base64: photoBase64Ref.current,
              });
            }
          }}
        >
          <View className="flex-1 bg-black/50">
            <View className="flex-1 mt-20 bg-white rounded-t-3xl">
              <View className="px-5 pt-5 pb-3 border-b border-gray-100">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-gray-900 text-lg font-bold">
                    Card Details
                  </Text>
                  <Pressable
                    onPress={() => setShowCardModal(false)}
                    className="p-2"
                  >
                    <Text className="text-green-700 font-semibold">Close</Text>
                  </Pressable>
                </View>
                <Text className="text-gray-500 text-xs">
                  Please provide emergency contact details, 1x1 photo, and
                  verify your face
                </Text>
              </View>

              <ScrollView
                className="flex-1 px-5"
                showsVerticalScrollIndicator={false}
              >
                <View className="py-4">
                  {!modelsLoaded && (
                    <View className="bg-blue-50 rounded-xl p-3 mb-4 border border-blue-200">
                      <View className="h-1.5 bg-blue-200 rounded-full overflow-hidden mb-1.5">
                        <View
                          className="h-1.5 bg-blue-600 rounded-full"
                          style={{ width: `${modelProgress}%` }}
                        />
                      </View>
                      <Text className="text-[11px] text-blue-700 font-medium">
                        {webviewReady
                          ? `Loading AI models… ${modelProgress}%`
                          : "Initializing face recognition…"}
                      </Text>
                    </View>
                  )}

                  {/* 1x1 Photo */}
                  <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-3">
                    1x1 Photo <Text className="text-red-400">*</Text>
                  </Text>
                  <View className="mb-6">
                    {photoUri ? (
                      <View className="items-center">
                        <Image
                          source={{ uri: photoUri }}
                          className="w-32 h-32 rounded-2xl border-2 border-green-600"
                          resizeMode="cover"
                        />
                        <View className="flex-row gap-2 mt-3">
                          <Pressable
                            onPress={takePhoto}
                            className="bg-green-50 px-4 py-2 rounded-xl border border-green-200 flex-row items-center gap-2"
                          >
                            <Camera size={16} color="#166534" />
                            <Text className="text-green-700 text-xs font-medium">
                              Retake
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={pickImage}
                            className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 flex-row items-center gap-2"
                          >
                            <ImageIcon size={16} color="#4b5563" />
                            <Text className="text-gray-600 text-xs font-medium">
                              Change
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row gap-3">
                        <Pressable
                          onPress={takePhoto}
                          className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 p-4 items-center"
                        >
                          <View className="w-12 h-12 bg-green-100 rounded-xl items-center justify-center mb-2">
                            <Camera size={24} color="#166534" />
                          </View>
                          <Text className="text-gray-900 font-semibold text-sm">
                            Take Photo
                          </Text>
                          <Text className="text-gray-400 text-xs mt-1 text-center">
                            Use camera to take 1x1 photo
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={pickImage}
                          className="flex-1 bg-gray-50 rounded-2xl border border-gray-200 p-4 items-center"
                        >
                          <View className="w-12 h-12 bg-gray-100 rounded-xl items-center justify-center mb-2">
                            <ImageIcon size={24} color="#4b5563" />
                          </View>
                          <Text className="text-gray-900 font-semibold text-sm">
                            Upload
                          </Text>
                          <Text className="text-gray-400 text-xs mt-1 text-center">
                            Choose from gallery
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* Face Verification */}
                  {photoUri && (
                    <>
                      <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-3">
                        Face Verification{" "}
                        <Text className="text-red-400">*</Text>
                      </Text>
                      <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                        <Text className="text-amber-800 text-xs">
                          <Text className="font-bold">How it works: </Text>
                          Scan your live face → it will automatically be
                          compared against your uploaded 1x1 photo to confirm
                          they match.
                        </Text>
                      </View>

                      {showLiveScanner ? (
                        <LiveFaceScanner
                          onFaceCaptured={handleLiveFaceCaptured}
                          onCancel={() => setShowLiveScanner(false)}
                          sendToWebView={sendToWebView}
                          modelsLoaded={modelsLoaded}
                        />
                      ) : liveUri ? (
                        <View className="mb-4">
                          {/* Side-by-side: uploaded vs live */}
                          <View className="flex-row gap-3 mb-3">
                            <View className="flex-1 items-center">
                              <Image
                                source={{ uri: photoUri }}
                                className="w-full h-32 rounded-xl border-2 border-green-200"
                                resizeMode="cover"
                              />
                              <Text className="text-gray-500 text-[10px] mt-1 font-medium">
                                Uploaded Photo
                              </Text>
                            </View>
                            <View className="flex-1 items-center">
                              <Image
                                source={{ uri: liveUri }}
                                className="w-full h-32 rounded-xl border-2 border-purple-200"
                                resizeMode="cover"
                              />
                              <Text className="text-gray-500 text-[10px] mt-1 font-medium">
                                Live Scan
                              </Text>
                            </View>
                          </View>

                          {/* Processing / verifying status */}
                          {(faceStep === "processing" ||
                            faceStep === "verifying") && (
                            <View className="bg-blue-50 rounded-xl p-3 border border-blue-100 flex-row items-center gap-3">
                              <ActivityIndicator size="small" color="#2563EB" />
                              <Text className="text-blue-700 text-xs font-medium flex-1">
                                {faceStep === "processing"
                                  ? "Extracting face from scan…"
                                  : "Comparing with uploaded photo…"}
                              </Text>
                            </View>
                          )}

                          {/* Result */}
                          {verificationResult && (
                            <View
                              className={`mt-3 rounded-xl p-3 ${verificationResult.isMatch ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
                            >
                              <View className="flex-row items-center gap-2 mb-1">
                                {verificationResult.isMatch ? (
                                  <CheckCircle2 size={20} color="#16A34A" />
                                ) : (
                                  <XCircle size={20} color="#DC2626" />
                                )}
                                <Text
                                  className={`font-bold text-sm ${verificationResult.isMatch ? "text-green-700" : "text-red-700"}`}
                                >
                                  {verificationResult.isMatch
                                    ? "Faces Match ✓"
                                    : "Faces Do Not Match"}
                                </Text>
                              </View>
                              <Text className="text-gray-500 text-xs">
                                Match score:{" "}
                                {(verificationResult.matchScore * 100).toFixed(
                                  1,
                                )}
                                %
                              </Text>
                              {!verificationResult.isMatch && (
                                <View className="flex-row gap-2 mt-3">
                                  <Pressable
                                    className="flex-1 bg-purple-100 py-2 rounded-lg items-center"
                                    onPress={handleRetryVerify}
                                  >
                                    <Text className="text-purple-700 text-xs font-semibold">
                                      Retry Compare
                                    </Text>
                                  </Pressable>
                                  <Pressable
                                    className="flex-1 bg-gray-100 py-2 rounded-lg items-center"
                                    onPress={() => {
                                      setVerificationResult(null);
                                      setLiveUri(null);
                                      setLiveDescriptorReady(false);
                                      setFaceStep("idle");
                                      setShowLiveScanner(true);
                                    }}
                                  >
                                    <Text className="text-gray-700 text-xs font-semibold">
                                      Rescan Face
                                    </Text>
                                  </Pressable>
                                </View>
                              )}
                            </View>
                          )}

                          {verificationResult?.isMatch && (
                            <Pressable
                              className="mt-2 py-2 rounded-xl border border-gray-200 items-center"
                              onPress={() => {
                                setLiveUri(null);
                                setLiveDescriptorReady(false);
                                setVerificationResult(null);
                                setFaceStep("idle");
                                setShowLiveScanner(true);
                              }}
                            >
                              <Text className="text-gray-500 text-xs font-medium">
                                Rescan Face
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      ) : (
                        <Pressable
                          className={`flex-row items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50 mb-4 ${!modelsLoaded ? "opacity-50" : ""}`}
                          onPress={() => setShowLiveScanner(true)}
                          disabled={!modelsLoaded}
                        >
                          <Zap size={20} color="#7C3AED" />
                          <Text className="text-purple-700 font-semibold text-sm">
                            {modelsLoaded
                              ? "Start Live Face Scan"
                              : "Loading AI models…"}
                          </Text>
                        </Pressable>
                      )}
                    </>
                  )}

                  {faceErrors.live ? (
                    <Text className="text-xs text-red-600 mb-3">
                      ⚠ {faceErrors.live}
                    </Text>
                  ) : null}
                  {faceErrors.verify ? (
                    <Text className="text-xs text-red-600 mb-3">
                      ⚠ {faceErrors.verify}
                    </Text>
                  ) : null}

                  {/* Emergency Contact */}
                  <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-3">
                    Emergency Contact Information
                  </Text>
                  <View className="mb-4">
                    <Text className="text-gray-700 text-sm font-bold mb-2">
                      Emergency Contact Name{" "}
                      <Text className="text-red-400">*</Text>
                    </Text>
                    <TextInput
                      className="w-full px-5 text-base text-gray-900 rounded-2xl border bg-gray-50 border-gray-200"
                      style={{ paddingVertical: 16 }}
                      placeholder="e.g. Maria Santos"
                      placeholderTextColor="#d1d5db"
                      value={cardDetails.emergency_contact_name}
                      onChangeText={(text) =>
                        setCardDetails({
                          ...cardDetails,
                          emergency_contact_name: text.replace(
                            /[^A-Za-z\s-]/g,
                            "",
                          ),
                        })
                      }
                      autoCapitalize="words"
                    />
                  </View>
                  <View className="mb-4">
                    <Text className="text-gray-700 text-sm font-bold mb-2">
                      Emergency Contact Number{" "}
                      <Text className="text-red-400">*</Text>
                    </Text>
                    <View className="relative">
                      <TextInput
                        className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${phoneError ? "border-red-300 bg-red-50" : "bg-gray-50 border-gray-200"}`}
                        style={{ paddingVertical: 16 }}
                        placeholder="09xx xxx xxxx"
                        placeholderTextColor="#d1d5db"
                        value={cardDetails.emergency_contact_number}
                        onChangeText={handlePhoneChange}
                        keyboardType="phone-pad"
                        maxLength={13}
                      />
                      <View className="absolute right-4 top-0 bottom-0 justify-center">
                        <Phone
                          size={20}
                          color={phoneError ? "#DC2626" : "#9CA3AF"}
                        />
                      </View>
                    </View>
                    {phoneError ? (
                      <Text className="text-red-500 text-xs mt-1">
                        {phoneError}
                      </Text>
                    ) : (
                      <Text className="text-gray-400 text-xs mt-1">
                        Format: 09xx xxx xxxx (11 digits)
                      </Text>
                    )}
                  </View>

                  {/* Blood Type */}
                  <View className="mb-4">
                    <Text className="text-gray-700 text-sm font-bold mb-2">
                      Blood Type <Text className="text-red-400">*</Text>
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {BLOOD_TYPES.map((type) => (
                        <Pressable
                          key={type}
                          onPress={() =>
                            setCardDetails({ ...cardDetails, blood_type: type })
                          }
                          className={`px-4 py-3 rounded-xl border ${cardDetails.blood_type === type ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                        >
                          <Text
                            className={`text-sm font-bold ${cardDetails.blood_type === type ? "text-green-700" : "text-gray-500"}`}
                          >
                            {type}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
                    <Text className="text-blue-700 text-xs">
                      <Text className="font-bold">Note:</Text> The PWD card ID
                      will be generated and issued by the PDAO office after
                      verification. You will be notified once your card is
                      ready.
                    </Text>
                  </View>

                  <Pressable
                    className={`w-full py-5 rounded-2xl mt-2 flex-row items-center justify-center gap-2 mb-10 ${submittingCard ? "bg-green-700 opacity-80" : "bg-green-900"}`}
                    onPress={handleSendCardDetails}
                    disabled={
                      submittingCard ||
                      !verificationResult?.isMatch ||
                      !!phoneError
                    }
                  >
                    {submittingCard ? (
                      <>
                        <ActivityIndicator size="small" color="#ffffff" />
                        <Text className="text-white text-base font-extrabold tracking-wide ml-2">
                          Submitting...
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text className="text-white text-base font-extrabold tracking-wide">
                          Submit Card Request
                        </Text>
                        <ChevronRight
                          size={20}
                          color="#ffffff"
                          strokeWidth={2.5}
                        />
                      </>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

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
          <View className={`${sc.bg} border ${sc.border} rounded-2xl p-4 mt-5`}>
            <View className="flex-row items-center gap-3">
              <View
                className={`w-12 h-12 rounded-xl items-center justify-center ${sc.bg}`}
              >
                <StatusIcon size={24} color={sc.iconColor} />
              </View>
              <View className="flex-1">
                <Text className={`${sc.text} text-[15px] font-bold`}>
                  {sc.label}
                </Text>
                <Text className="text-gray-500 text-[12px] mt-0.5">
                  {sc.description}
                </Text>
                <Text className="text-gray-400 text-[11px] mt-1">
                  Last updated: {formatDateTime(selectedApp.updated_at)}
                </Text>
              </View>
            </View>
          </View>

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
                      { month: "long", day: "numeric", year: "numeric" },
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

          <View className="mt-6">
            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-2">
              Disability Information
            </Text>
            <View className="bg-gray-50 rounded-2xl p-4">
              <View className="mb-3">
                <Text className="text-gray-400 text-[10px] mb-1">
                  Type(s) of Disability
                </Text>
                {selectedApp.types_of_disability.map((type, i) => (
                  <View key={i} className="flex-row items-start gap-2 mb-1">
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
                  {selectedApp.causes_of_disability.map((cause, i) => (
                    <View key={i} className="flex-row items-start gap-2 mb-1">
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
                    onPress={() => {}}
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
                    onPress={() => {}}
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

          <View className="mt-8 mb-10 gap-3">
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
            {selectedApp.status === "Approved" && (
              <Pressable
                onPress={() => setShowCardModal(true)}
                className="bg-green-900 rounded-2xl py-4 items-center flex-row justify-center gap-2"
              >
                <CreditCard size={20} color="#ffffff" />
                <Text className="text-white font-bold text-[14px]">
                  Request PWD ID Card
                </Text>
              </Pressable>
            )}
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
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      <StatusBar style="dark" />
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
        {!hasApprovedApplication && (
          <Pressable
            onPress={() => router.push("/apply")}
            className="bg-green-900 px-4 py-2 rounded-xl"
          >
            <Text className="text-white text-[12px] font-semibold">New</Text>
          </Pressable>
        )}
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

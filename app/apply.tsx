// app/apply.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  ChevronLeft,
  CreditCard,
  FileText,
  MapPin,
  Paperclip,
  Phone,
  Send,
  User,
  Users,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

// ── Types ─────────────────────────────────────────────────────────────────────

type ApplicationType = "New Applicant" | "Renewal";
type Sex = "Male" | "Female" | "Other";
type CivilStatus =
  | "Single"
  | "Married"
  | "Separated"
  | "Widow/er"
  | "Cohabitation";
type EducationalAttainment =
  | "None"
  | "Kindergarten"
  | "Elementary"
  | "Junior High School"
  | "Senior High School"
  | "College"
  | "Vocational"
  | "Post Graduate";
type EmploymentStatus = "Employed" | "Unemployed" | "Self-employed";
type EmploymentCategory = "Government" | "Private";
type EmploymentType =
  | "Permanent / Regular"
  | "Seasonal"
  | "Casual"
  | "Emergency";
type Occupation =
  | "Managers"
  | "Professionals"
  | "Technicians and Associate Professionals"
  | "Clerical Support Workers"
  | "Service and Sales Workers"
  | "Skilled Agricultural, Forestry and Fishery Workers"
  | "Craft and Related Trade Workers"
  | "Plant and Machine Operators and Assemblers"
  | "Elementary Occupations"
  | "Armed Forces Occupations"
  | "Others";
type AccomplishedBy = "Applicant" | "Guardian" | "Representative";
type TypeOfDisability =
  | "Deaf or Hard of Hearing"
  | "Intellectual Disability"
  | "Learning Disability"
  | "Mental Disability"
  | "Physical Disability (Orthopedic)"
  | "Psychosocial Disability"
  | "Speech and Language Impairment"
  | "Visual Disability"
  | "Cancer (RA11215)"
  | "Rare Disease (RA10747)";
type CauseOfDisability =
  | "Congenital / Inborn"
  | "Acquired"
  | "Autism"
  | "ADHD"
  | "Cerebral Palsy"
  | "Down Syndrome"
  | "Chronic Illness"
  | "Injury";

interface FormState {
  application_type: ApplicationType;
  last_name: string;
  first_name: string;
  middle_name: string;
  suffix: string;
  date_of_birth: Date | null;
  sex: Sex | "";
  civil_status: CivilStatus | "";
  types_of_disability: TypeOfDisability[];
  causes_of_disability: CauseOfDisability[];
  house_no_and_street: string;
  barangay: string;
  municipality: string;
  province: string;
  region: string;
  landline_no: string;
  mobile_no: string;
  contact_email: string;
  educational_attainment: EducationalAttainment | "";
  employment_status: EmploymentStatus | "";
  employment_category: EmploymentCategory | "";
  employment_type: EmploymentType | "";
  occupation: Occupation | "";
  occupation_others: string;
  organization_affiliated: string;
  org_contact_person: string;
  org_office_address: string;
  org_tel_nos: string;
  sss_no: string;
  gsis_no: string;
  pag_ibig_no: string;
  psn_no: string;
  philhealth_no: string;
  father_last_name: string;
  father_first_name: string;
  father_middle_name: string;
  mother_last_name: string;
  mother_first_name: string;
  mother_middle_name: string;
  guardian_last_name: string;
  guardian_first_name: string;
  guardian_middle_name: string;
  accomplished_by: AccomplishedBy;
  accom_last_name: string;
  accom_first_name: string;
  accom_middle_name: string;
  certifying_physician_name: string;
  certifying_physician_license_no: string;
  // ── Documents ───────────────────────────────────────────────────────────────
  medical_certificate_base64: string;
  birth_certificate_base64: string;
  supporting_docs_base64: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDisplayDate = (date: Date | null): string => {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
};

const maxDOB = new Date();
maxDOB.setFullYear(maxDOB.getFullYear() - 1);

// ── UI Components ─────────────────────────────────────────────────────────────

const SectionHeader = ({
  icon: Icon,
  number,
  title,
  subtitle,
}: {
  icon: any;
  number: string;
  title: string;
  subtitle?: string;
}) => (
  <View className="bg-gray-50 rounded-xl px-4 py-3 mb-4 flex-row items-center gap-3 border border-gray-100">
    <View className="bg-white w-8 h-8 rounded-lg items-center justify-center border border-gray-200">
      <Icon size={15} />
    </View>
    <View className="flex-1">
      <View className="flex-row items-center gap-2">
        <Text className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
          {number}
        </Text>
        <Text className="text-gray-900 text-[13px] font-bold">{title}</Text>
      </View>
      {subtitle && (
        <Text className="text-gray-400 text-[11px] mt-0.5">{subtitle}</Text>
      )}
    </View>
  </View>
);

const FieldLabel = ({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) => (
  <View className="flex-row items-center gap-1 mb-1.5">
    <Text className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
      {label}
    </Text>
    {required && <Text className="text-red-500 text-xs">*</Text>}
  </View>
);

const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  required,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  keyboardType?: any;
  multiline?: boolean;
}) => (
  <View className="mb-3">
    <FieldLabel label={label} required={required} />
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder ?? ""}
      placeholderTextColor="#9ca3af"
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-[13px] text-gray-900"
      style={multiline ? { minHeight: 70, textAlignVertical: "top" } : {}}
    />
  </View>
);

const ToggleChip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    className="flex-row items-center gap-2.5 py-2 pr-3"
    style={{ width: "50%" }}
  >
    <View
      className={`w-4 h-4 rounded border items-center justify-center ${selected ? "bg-gray-800 border-gray-800" : "border-gray-300 bg-white"}`}
    >
      {selected && <Text className="text-white text-[10px] font-bold">✓</Text>}
    </View>
    <Text
      className={`text-[12px] flex-1 ${selected ? "text-gray-900 font-semibold" : "text-gray-600"}`}
    >
      {label}
    </Text>
  </Pressable>
);

const RadioChip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    className="flex-row items-center gap-2.5 py-2 pr-3"
    style={{ width: "50%" }}
  >
    <View
      className={`w-4 h-4 rounded-full border-2 items-center justify-center ${selected ? "border-gray-800" : "border-gray-300"}`}
    >
      {selected && <View className="w-2 h-2 rounded-full bg-gray-800" />}
    </View>
    <Text
      className={`text-[12px] flex-1 ${selected ? "text-gray-900 font-semibold" : "text-gray-600"}`}
    >
      {label}
    </Text>
  </Pressable>
);

const Divider = () => <View className="h-px bg-gray-100 my-1" />;

const NameRow = ({
  lastValue,
  lastOnChange,
  firstValue,
  firstOnChange,
  middleValue,
  middleOnChange,
  label = "",
}: {
  lastValue: string;
  lastOnChange: (v: string) => void;
  firstValue: string;
  firstOnChange: (v: string) => void;
  middleValue: string;
  middleOnChange: (v: string) => void;
  label?: string;
}) => (
  <View className="mb-3">
    {label ? (
      <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </Text>
    ) : null}
    <View className="flex-row gap-2">
      <View className="flex-1">
        <FieldLabel label="Last Name" />
        <TextInput
          value={lastValue}
          onChangeText={lastOnChange}
          placeholder="Last"
          placeholderTextColor="#9ca3af"
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-[13px] text-gray-900"
        />
      </View>
      <View className="flex-1">
        <FieldLabel label="First Name" />
        <TextInput
          value={firstValue}
          onChangeText={firstOnChange}
          placeholder="First"
          placeholderTextColor="#9ca3af"
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-[13px] text-gray-900"
        />
      </View>
      <View style={{ width: 90 }}>
        <FieldLabel label="Middle" />
        <TextInput
          value={middleValue}
          onChangeText={middleOnChange}
          placeholder="Middle"
          placeholderTextColor="#9ca3af"
          className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-[13px] text-gray-900"
        />
      </View>
    </View>
  </View>
);

// ── Document Picker Row ───────────────────────────────────────────────────────

const DocPickerRow = ({
  label,
  fileName,
  onPress,
  required,
}: {
  label: string;
  fileName: string;
  onPress: () => void;
  required?: boolean;
}) => (
  <View className="mb-4">
    <FieldLabel label={label} required={required} />
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 border rounded-xl px-4 py-3.5 ${
        fileName ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <Paperclip size={17} color={fileName ? "#16a34a" : "#9ca3af"} />
      <Text
        className={`flex-1 text-[13px] ${fileName ? "text-green-700 font-medium" : "text-gray-400"}`}
        numberOfLines={1}
      >
        {fileName || "Tap to upload (PDF or image)"}
      </Text>
      {fileName ? (
        <Text className="text-[10px] text-green-600 font-bold tracking-wider">
          ATTACHED
        </Text>
      ) : null}
    </Pressable>
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ApplyScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDOBPicker, setShowDOBPicker] = useState(false);

  // Document display names (for UI only — actual data lives in form state)
  const [medCertName, setMedCertName] = useState("");
  const [birthCertName, setBirthCertName] = useState("");
  const [supportingNames, setSupportingNames] = useState<string[]>([]);

  const [form, setForm] = useState<FormState>({
    application_type: "New Applicant",
    last_name: user?.last_name ?? "",
    first_name: user?.first_name ?? "",
    middle_name: user?.middle_name ?? "",
    suffix: "",
    date_of_birth: user?.date_of_birth ? new Date(user.date_of_birth) : null,
    sex: (user?.sex as Sex) ?? "",
    civil_status: "",
    types_of_disability: [],
    causes_of_disability: [],
    house_no_and_street: user?.address?.street ?? "",
    barangay: user?.address?.barangay ?? "",
    municipality: user?.address?.city_municipality ?? "",
    province: user?.address?.province ?? "",
    region: user?.address?.region ?? "",
    landline_no: "",
    mobile_no: user?.contact_number ?? "",
    contact_email: user?.email ?? "",
    educational_attainment: "",
    employment_status: "",
    employment_category: "",
    employment_type: "",
    occupation: "",
    occupation_others: "",
    organization_affiliated: "",
    org_contact_person: "",
    org_office_address: "",
    org_tel_nos: "",
    sss_no: "",
    gsis_no: "",
    pag_ibig_no: "",
    psn_no: "",
    philhealth_no: "",
    father_last_name: "",
    father_first_name: "",
    father_middle_name: "",
    mother_last_name: "",
    mother_first_name: "",
    mother_middle_name: "",
    guardian_last_name: "",
    guardian_first_name: "",
    guardian_middle_name: "",
    accomplished_by: "Applicant",
    accom_last_name: user?.last_name ?? "",
    accom_first_name: user?.first_name ?? "",
    accom_middle_name: "",
    certifying_physician_name: "",
    certifying_physician_license_no: "",
    medical_certificate_base64: "",
    birth_certificate_base64: "",
    supporting_docs_base64: [],
  });

  const setField = (key: keyof FormState) => (val: any) =>
    setForm((p) => ({ ...p, [key]: val }));

  const toggleDisability = (val: TypeOfDisability) => {
    setForm((p) => ({
      ...p,
      types_of_disability: p.types_of_disability.includes(val)
        ? p.types_of_disability.filter((x) => x !== val)
        : [...p.types_of_disability, val],
    }));
  };

  const toggleCause = (val: CauseOfDisability) => {
    setForm((p) => ({
      ...p,
      causes_of_disability: p.causes_of_disability.includes(val)
        ? p.causes_of_disability.filter((x) => x !== val)
        : [...p.causes_of_disability, val],
    }));
  };

  // ── Document picker helpers ─────────────────────────────────────────────────

  // ── Mime type from file extension (fallback when mimeType is null) ──────────
  const getMimeFromExtension = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
      pdf: "application/pdf",
    };
    return map[ext] ?? "application/octet-stream";
  };

  /**
   * Reliable document picker that works with both images and PDFs
   * Uses multiple fallback strategies for maximum compatibility
   */
  const pickDoc = async (): Promise<{
    base64: string;
    name: string;
  } | null> => {
    try {
      // Show document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true, // This is important!
      });

      if (result.canceled) {
        console.log("[pickDoc] User cancelled document picker");
        return null;
      }

      if (!result.assets || result.assets.length === 0) {
        console.log("[pickDoc] No assets returned");
        return null;
      }

      const asset = result.assets[0];
      console.log(
        `[pickDoc] Selected file: ${asset.name}, URI: ${asset.uri}, Size: ${asset.size}`,
      );

      // Validate file size (10MB limit)
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert(
          "File Too Large",
          "Please select a file smaller than 10MB.",
        );
        return null;
      }

      // Determine mime type
      const mimeType =
        asset.mimeType && asset.mimeType !== "application/octet-stream"
          ? asset.mimeType
          : getMimeFromExtension(asset.name);

      console.log(`[pickDoc] Using mime type: ${mimeType}`);

      // Try multiple methods to read the file
      let base64String = "";

      // Method 1: Using FileSystem.readAsStringAsync (legacy but reliable)
      try {
        const LegacyFileSystem = require("expo-file-system/legacy");
        base64String = await LegacyFileSystem.readAsStringAsync(asset.uri, {
          encoding: LegacyFileSystem.EncodingType.Base64,
        });
        console.log(
          `[pickDoc] Method 1 (legacy) succeeded: ${base64String.length} chars`,
        );
      } catch (method1Error) {
        console.log("[pickDoc] Method 1 failed, trying Method 2...");

        // Method 2: Using fetch API
        try {
          const response = await fetch(asset.uri);
          const blob = await response.blob();

          base64String = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              // FileReader.readAsDataURL returns a complete data URL
              // We need to extract just the base64 part
              const base64Data = result.split(",")[1];
              resolve(base64Data);
            };
            reader.onerror = () => reject(new Error("FileReader failed"));
            reader.readAsDataURL(blob);
          });
          console.log(
            `[pickDoc] Method 2 (fetch) succeeded: ${base64String.length} chars`,
          );
        } catch (method2Error) {
          console.log("[pickDoc] Method 2 failed, trying Method 3...");

          // Method 3: Using the modern File class with base64() for images, arrayBuffer for PDFs
          try {
            const file = new FileSystem.File(asset.uri);

            if (mimeType === "application/pdf") {
              // For PDFs, use arrayBuffer and convert
              const arrayBuffer = await file.bytes();
              base64String = btoa(
                Array.from(new Uint8Array(arrayBuffer))
                  .map((b) => String.fromCharCode(b))
                  .join(""),
              );
            } else {
              // For images, use base64() method
              base64String = await file.base64();
            }
            console.log(
              `[pickDoc] Method 3 (modern File class) succeeded: ${base64String.length} chars`,
            );
          } catch (method3Error) {
            console.error("[pickDoc] All methods failed");
            throw new Error("Could not read file content with any method");
          }
        }
      }

      // Validate the base64 string
      if (!base64String || base64String.length < 100) {
        console.error("[pickDoc] Invalid base64 string - too short");
        Alert.alert(
          "Error",
          "The selected file appears to be invalid. Please try another file.",
        );
        return null;
      }

      // Create the complete data URL with mime type
      const dataUrl = `data:${mimeType};base64,${base64String}`;

      return {
        base64: dataUrl,
        name: asset.name,
      };
    } catch (err: any) {
      console.error("[pickDoc] Error:", err?.message || err);

      Alert.alert(
        "Upload Failed",
        "Could not read the selected file. Please make sure the file is not corrupted and try again.",
        [{ text: "OK" }],
      );
      return null;
    }
  };

  // Alternative method specifically for PDFs if the above doesn't work
  const pickPDF = async (): Promise<{
    base64: string;
    name: string;
  } | null> => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return null;

      const asset = result.assets[0];

      // Use react-native-fs if available, or fallback to fetch
      try {
        // Try using fetch first
        const response = await fetch(asset.uri);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              base64: reader.result as string,
              name: asset.name,
            });
          };
          reader.onerror = () => reject(new Error("Failed to read PDF"));
          reader.readAsDataURL(blob);
        });
      } catch (fetchError) {
        console.error("[pickPDF] Fetch failed:", fetchError);

        // Fallback to FileSystem
        const LegacyFileSystem = require("expo-file-system/legacy");
        const base64String = await LegacyFileSystem.readAsStringAsync(
          asset.uri,
          {
            encoding: LegacyFileSystem.EncodingType.Base64,
          },
        );

        const mimeType = "application/pdf";
        return {
          base64: `data:${mimeType};base64,${base64String}`,
          name: asset.name,
        };
      }
    } catch (err: any) {
      console.error("[pickPDF] Error:", err);
      Alert.alert("Error", "Could not read the PDF file.");
      return null;
    }
  };

  const pickMedCert = async () => {
    const doc = await pickDoc();
    if (!doc) return;

    setField("medical_certificate_base64")(doc.base64);
    setMedCertName(doc.name);

    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.medical_certificate;
      return newErrors;
    });
  };

  const pickBirthCert = async () => {
    const doc = await pickDoc();
    if (!doc) return;

    setField("birth_certificate_base64")(doc.base64);
    setBirthCertName(doc.name);
  };

  const addSupportingDoc = async () => {
    const doc = await pickDoc();
    if (!doc) return;

    setForm((p) => ({
      ...p,
      supporting_docs_base64: [...p.supporting_docs_base64, doc.base64],
    }));
    setSupportingNames((p) => [...p, doc.name]);
  };

  const removeSupportingDoc = (index: number) => {
    setForm((p) => ({
      ...p,
      supporting_docs_base64: p.supporting_docs_base64.filter(
        (_, i) => i !== index,
      ),
    }));
    setSupportingNames((p) => p.filter((_, i) => i !== index));
  };
  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.last_name.trim()) e.last_name = "Last name is required";
    if (!form.first_name.trim()) e.first_name = "First name is required";
    if (!form.date_of_birth) e.date_of_birth = "Date of birth is required";
    if (!form.sex) e.sex = "Sex is required";
    if (!form.civil_status) e.civil_status = "Civil status is required";
    if (form.types_of_disability.length === 0)
      e.types_of_disability = "Select at least one type of disability";
    if (!form.barangay.trim()) e.barangay = "Barangay is required";
    if (!form.municipality.trim()) e.municipality = "Municipality is required";
    if (!form.province.trim()) e.province = "Province is required";
    if (!form.region.trim()) e.region = "Region is required";
    if (!form.medical_certificate_base64)
      e.medical_certificate = "Medical certificate is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert("Incomplete Form", "Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);

      const payload = {
        application_type: form.application_type,
        last_name: form.last_name,
        first_name: form.first_name,
        middle_name: form.middle_name || "N/A",
        suffix: form.suffix,
        date_of_birth: form.date_of_birth?.toISOString(),
        sex: form.sex,
        civil_status: form.civil_status,
        types_of_disability: form.types_of_disability,
        causes_of_disability: form.causes_of_disability,
        residence_address: {
          house_no_and_street: form.house_no_and_street,
          barangay: form.barangay,
          municipality: form.municipality,
          province: form.province,
          region: form.region,
        },
        contact_details: {
          landline_no: form.landline_no,
          mobile_no: form.mobile_no,
          email: form.contact_email,
        },
        educational_attainment: form.educational_attainment || null,
        employment_status: form.employment_status || null,
        employment_category: form.employment_category || null,
        employment_type: form.employment_type || null,
        occupation: form.occupation || null,
        occupation_others: form.occupation_others,
        organization_info: {
          organization_affiliated: form.organization_affiliated,
          contact_person: form.org_contact_person,
          office_address: form.org_office_address,
          tel_nos: form.org_tel_nos,
        },
        id_references: {
          sss_no: form.sss_no,
          gsis_no: form.gsis_no,
          pag_ibig_no: form.pag_ibig_no,
          psn_no: form.psn_no,
          philhealth_no: form.philhealth_no,
        },
        family_background: {
          father: {
            last_name: form.father_last_name,
            first_name: form.father_first_name,
            middle_name: form.father_middle_name,
          },
          mother: {
            last_name: form.mother_last_name,
            first_name: form.mother_first_name,
            middle_name: form.mother_middle_name,
          },
          guardian: {
            last_name: form.guardian_last_name,
            first_name: form.guardian_first_name,
            middle_name: form.guardian_middle_name,
          },
        },
        accomplished_by: {
          type: form.accomplished_by,
          last_name: form.accom_last_name,
          first_name: form.accom_first_name,
          middle_name: form.accom_middle_name,
        },
        certifying_physician_name: form.certifying_physician_name,
        certifying_physician_license_no: form.certifying_physician_license_no,
        status: "Submitted",
        // ── Documents (base64) ──────────────────────────────────────────────
        medical_certificate_base64:
          form.medical_certificate_base64 || undefined,
        birth_certificate_base64: form.birth_certificate_base64 || undefined,
        supporting_docs_base64: form.supporting_docs_base64.length
          ? form.supporting_docs_base64
          : undefined,
      };

      const res = await fetch(`${EXPRESS_API_BASE}/api/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message ?? data.error ?? "Submission failed");

      Alert.alert(
        "Application Submitted!",
        `Your application (${data.application?.application_id}) has been submitted for review.`,
        [{ text: "OK", onPress: () => router.replace("/(tabs)") }],
      );
    } catch (err: any) {
      Alert.alert("Submission Failed", err?.message ?? "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const ErrorMsg = ({ field }: { field: string }) =>
    errors[field] ? (
      <View className="flex-row items-center gap-1 mt-1 mb-1">
        <AlertCircle size={11} color="#dc2626" />
        <Text className="text-red-600 text-[11px]">{errors[field]}</Text>
      </View>
    ) : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white border-b border-gray-100 px-4 py-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} className="p-1.5">
          <ChevronLeft size={20} color="#374151" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900">
            PWD Application Form
          </Text>
          <Text className="text-[11px] text-gray-400">
            Philippine Registry for Persons with Disabilities v4.0
          </Text>
        </View>
        <View className="bg-green-100 px-2.5 py-1 rounded-lg">
          <Text className="text-green-700 text-[10px] font-bold">
            DOH PRPWD
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Notice Banner */}
        <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5 flex-row gap-3">
          <FileText size={18} color="#2563EB" />
          <View className="flex-1">
            <Text className="text-blue-800 text-[12px] font-bold mb-0.5">
              Fields marked with * are required
            </Text>
            <Text className="text-blue-600 text-[11px] leading-[16px]">
              Some fields have been pre-filled from your account. Please review
              and complete all sections.
            </Text>
          </View>
        </View>

        {/* ── FIELD 1: Application Type ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={FileText}
            number="Field 1"
            title="Application Type"
          />
          <View className="flex-row flex-wrap">
            {(["New Applicant", "Renewal"] as ApplicationType[]).map((t) => (
              <RadioChip
                key={t}
                label={t}
                selected={form.application_type === t}
                onPress={() => setField("application_type")(t)}
              />
            ))}
          </View>
        </View>

        {/* ── FIELDS 4–6: Personal Information ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={User}
            number="Fields 4 – 6"
            title="Personal Information"
            subtitle="Name, date of birth and sex"
          />
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <FieldLabel label="Last Name" required />
              <TextInput
                value={form.last_name}
                onChangeText={setField("last_name")}
                placeholder="Last name"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-[13px] text-gray-900"
              />
              <ErrorMsg field="last_name" />
            </View>
            <View className="flex-1">
              <FieldLabel label="First Name" required />
              <TextInput
                value={form.first_name}
                onChangeText={setField("first_name")}
                placeholder="First name"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-[13px] text-gray-900"
              />
              <ErrorMsg field="first_name" />
            </View>
          </View>
          <View className="flex-row gap-2 mb-3">
            <View className="flex-1">
              <FieldLabel label="Middle Name" />
              <TextInput
                value={form.middle_name}
                onChangeText={setField("middle_name")}
                placeholder="Middle name"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-[13px] text-gray-900"
              />
            </View>
            <View style={{ width: 100 }}>
              <FieldLabel label="Suffix" />
              <TextInput
                value={form.suffix}
                onChangeText={setField("suffix")}
                placeholder="Jr./Sr."
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-[13px] text-gray-900"
              />
            </View>
          </View>
          <Divider />

          {/* Date of Birth */}
          <View className="mt-3 mb-3">
            <FieldLabel label="Date of Birth" required />
            <Pressable
              onPress={() => setShowDOBPicker(true)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 flex-row items-center justify-between"
            >
              <Text
                className={`text-[13px] ${form.date_of_birth ? "text-gray-900" : "text-gray-400"}`}
              >
                {form.date_of_birth
                  ? formatDisplayDate(form.date_of_birth)
                  : "Select date of birth"}
              </Text>
              <Calendar size={16} color="#9ca3af" />
            </Pressable>
            <ErrorMsg field="date_of_birth" />
            {showDOBPicker && (
              <DateTimePicker
                value={form.date_of_birth ?? maxDOB}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={maxDOB}
                minimumDate={new Date(1900, 0, 1)}
                onChange={(_, selectedDate) => {
                  if (Platform.OS === "android") setShowDOBPicker(false);
                  if (selectedDate) setField("date_of_birth")(selectedDate);
                }}
              />
            )}
            {showDOBPicker && Platform.OS === "ios" && (
              <Pressable
                onPress={() => setShowDOBPicker(false)}
                className="mt-2 self-end px-4 py-1.5 bg-gray-800 rounded-lg"
              >
                <Text className="text-white text-[12px] font-semibold">
                  Done
                </Text>
              </Pressable>
            )}
          </View>

          {/* Sex */}
          <View>
            <FieldLabel label="Sex" required />
            <View className="flex-row flex-wrap">
              {(["Female", "Male", "Other"] as Sex[]).map((s) => (
                <RadioChip
                  key={s}
                  label={s}
                  selected={form.sex === s}
                  onPress={() => setField("sex")(s)}
                />
              ))}
            </View>
            <ErrorMsg field="sex" />
          </View>
        </View>

        {/* ── FIELD 7: Civil Status ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader icon={User} number="Field 7" title="Civil Status" />
          <View className="flex-row flex-wrap">
            {(
              [
                "Single",
                "Married",
                "Separated",
                "Widow/er",
                "Cohabitation",
              ] as CivilStatus[]
            ).map((s) => (
              <RadioChip
                key={s}
                label={s}
                selected={form.civil_status === s}
                onPress={() => setField("civil_status")(s)}
              />
            ))}
          </View>
          <ErrorMsg field="civil_status" />
        </View>

        {/* ── FIELDS 8 & 9: Disability ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={FileText}
            number="Fields 8 – 9"
            title="Type & Cause of Disability"
            subtitle="Select all that apply"
          />
          <FieldLabel label="Type of Disability" required />
          <View className="flex-row flex-wrap mb-1">
            {(
              [
                "Deaf or Hard of Hearing",
                "Intellectual Disability",
                "Learning Disability",
                "Mental Disability",
                "Physical Disability (Orthopedic)",
                "Psychosocial Disability",
                "Speech and Language Impairment",
                "Visual Disability",
                "Cancer (RA11215)",
                "Rare Disease (RA10747)",
              ] as TypeOfDisability[]
            ).map((d) => (
              <ToggleChip
                key={d}
                label={d}
                selected={form.types_of_disability.includes(d)}
                onPress={() => toggleDisability(d)}
              />
            ))}
          </View>
          <ErrorMsg field="types_of_disability" />
          <Divider />
          <View className="mt-3">
            <FieldLabel label="Cause of Disability" />
            <View className="flex-row flex-wrap">
              {(
                [
                  "Congenital / Inborn",
                  "Acquired",
                  "Autism",
                  "ADHD",
                  "Cerebral Palsy",
                  "Down Syndrome",
                  "Chronic Illness",
                  "Injury",
                ] as CauseOfDisability[]
              ).map((c) => (
                <ToggleChip
                  key={c}
                  label={c}
                  selected={form.causes_of_disability.includes(c)}
                  onPress={() => toggleCause(c)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* ── FIELD 10: Residence Address ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={MapPin}
            number="Field 10"
            title="Residence Address"
            subtitle="Permanent address"
          />
          <InputField
            label="House No. and Street"
            value={form.house_no_and_street}
            onChange={setField("house_no_and_street")}
            placeholder="e.g. 123 Rizal St."
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <FieldLabel label="Barangay" required />
              <TextInput
                value={form.barangay}
                onChangeText={setField("barangay")}
                placeholder="Barangay"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-[13px] text-gray-900"
              />
              <ErrorMsg field="barangay" />
            </View>
            <View className="flex-1">
              <FieldLabel label="Municipality / City" required />
              <TextInput
                value={form.municipality}
                onChangeText={setField("municipality")}
                placeholder="Municipality"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-[13px] text-gray-900"
              />
              <ErrorMsg field="municipality" />
            </View>
          </View>
          <View className="flex-row gap-2 mt-2">
            <View className="flex-1">
              <FieldLabel label="Province" required />
              <TextInput
                value={form.province}
                onChangeText={setField("province")}
                placeholder="Province"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-[13px] text-gray-900"
              />
              <ErrorMsg field="province" />
            </View>
            <View className="flex-1">
              <FieldLabel label="Region" required />
              <TextInput
                value={form.region}
                onChangeText={setField("region")}
                placeholder="Region"
                placeholderTextColor="#9ca3af"
                className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-[13px] text-gray-900"
              />
              <ErrorMsg field="region" />
            </View>
          </View>
        </View>

        {/* ── FIELD 11: Contact Details ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={Phone}
            number="Field 11"
            title="Contact Details"
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <InputField
                label="Landline No."
                value={form.landline_no}
                onChange={setField("landline_no")}
                placeholder="(02) 1234-5678"
                keyboardType="phone-pad"
              />
            </View>
            <View className="flex-1">
              <InputField
                label="Mobile No."
                value={form.mobile_no}
                onChange={setField("mobile_no")}
                placeholder="09XXXXXXXXX"
                keyboardType="phone-pad"
              />
            </View>
          </View>
          <InputField
            label="Email Address"
            value={form.contact_email}
            onChange={setField("contact_email")}
            placeholder="email@example.com"
            keyboardType="email-address"
          />
        </View>

        {/* ── FIELD 12: Educational Attainment ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={BookOpen}
            number="Field 12"
            title="Educational Attainment"
          />
          <View className="flex-row flex-wrap">
            {(
              [
                "None",
                "Kindergarten",
                "Elementary",
                "Junior High School",
                "Senior High School",
                "College",
                "Vocational",
                "Post Graduate",
              ] as EducationalAttainment[]
            ).map((e) => (
              <RadioChip
                key={e}
                label={e}
                selected={form.educational_attainment === e}
                onPress={() =>
                  setField("educational_attainment")(
                    form.educational_attainment === e ? "" : e,
                  )
                }
              />
            ))}
          </View>
        </View>

        {/* ── FIELD 13: Employment ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={Briefcase}
            number="Field 13"
            title="Employment"
            subtitle="Status, category and type"
          />
          <FieldLabel label="Status of Employment" />
          <View className="flex-row flex-wrap mb-3">
            {(
              ["Employed", "Unemployed", "Self-employed"] as EmploymentStatus[]
            ).map((s) => (
              <RadioChip
                key={s}
                label={s}
                selected={form.employment_status === s}
                onPress={() => {
                  const next = form.employment_status === s ? "" : s;
                  setForm((p) => ({
                    ...p,
                    employment_status: next,
                    ...(next === "Unemployed"
                      ? {
                          occupation: "",
                          occupation_others: "",
                          organization_affiliated: "",
                          org_contact_person: "",
                          org_office_address: "",
                          org_tel_nos: "",
                          employment_category: "",
                          employment_type: "",
                        }
                      : {}),
                  }));
                }}
              />
            ))}
          </View>
          {form.employment_status === "Employed" && (
            <>
              <Divider />
              <View className="mt-3">
                <FieldLabel label="Category of Employment (13a)" />
                <View className="flex-row flex-wrap mb-3">
                  {(["Government", "Private"] as EmploymentCategory[]).map(
                    (c) => (
                      <RadioChip
                        key={c}
                        label={c}
                        selected={form.employment_category === c}
                        onPress={() =>
                          setField("employment_category")(
                            form.employment_category === c ? "" : c,
                          )
                        }
                      />
                    ),
                  )}
                </View>
                <FieldLabel label="Type of Employment (13b)" />
                <View className="flex-row flex-wrap">
                  {(
                    [
                      "Permanent / Regular",
                      "Seasonal",
                      "Casual",
                      "Emergency",
                    ] as EmploymentType[]
                  ).map((t) => (
                    <RadioChip
                      key={t}
                      label={t}
                      selected={form.employment_type === t}
                      onPress={() =>
                        setField("employment_type")(
                          form.employment_type === t ? "" : t,
                        )
                      }
                    />
                  ))}
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── FIELD 14: Occupation ── */}
        {form.employment_status !== "Unemployed" && (
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <SectionHeader
              icon={Briefcase}
              number="Field 14"
              title="Occupation"
            />
            <View className="flex-row flex-wrap">
              {(
                [
                  "Managers",
                  "Professionals",
                  "Technicians and Associate Professionals",
                  "Clerical Support Workers",
                  "Service and Sales Workers",
                  "Skilled Agricultural, Forestry and Fishery Workers",
                  "Craft and Related Trade Workers",
                  "Plant and Machine Operators and Assemblers",
                  "Elementary Occupations",
                  "Armed Forces Occupations",
                  "Others",
                ] as const
              ).map((o) => (
                <RadioChip
                  key={o}
                  label={o}
                  selected={form.occupation === o}
                  onPress={() =>
                    setField("occupation")(form.occupation === o ? "" : o)
                  }
                />
              ))}
            </View>
            {form.occupation === "Others" && (
              <View className="mt-2">
                <InputField
                  label="Please specify"
                  value={form.occupation_others}
                  onChange={setField("occupation_others")}
                  placeholder="Specify occupation"
                />
              </View>
            )}
          </View>
        )}

        {/* ── FIELD 15: Organization ── */}
        {form.employment_status !== "Unemployed" && (
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <SectionHeader
              icon={Building2}
              number="Field 15"
              title="Organization Information"
              subtitle="Optional — leave blank if not applicable"
            />
            <InputField
              label="Organization Affiliated"
              value={form.organization_affiliated}
              onChange={setField("organization_affiliated")}
              placeholder="Organization name"
            />
            <View className="flex-row gap-2">
              <View className="flex-1">
                <InputField
                  label="Contact Person"
                  value={form.org_contact_person}
                  onChange={setField("org_contact_person")}
                  placeholder="Contact person"
                />
              </View>
              <View className="flex-1">
                <InputField
                  label="Tel. Nos."
                  value={form.org_tel_nos}
                  onChange={setField("org_tel_nos")}
                  placeholder="Tel no."
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <InputField
              label="Office Address"
              value={form.org_office_address}
              onChange={setField("org_office_address")}
              placeholder="Office address"
            />
          </View>
        )}

        {/* ── FIELD 16: ID References ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={CreditCard}
            number="Field 16"
            title="ID Reference Numbers"
            subtitle="Fill in available government IDs"
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <InputField
                label="SSS No."
                value={form.sss_no}
                onChange={setField("sss_no")}
                placeholder="SSS No."
              />
            </View>
            <View className="flex-1">
              <InputField
                label="GSIS No."
                value={form.gsis_no}
                onChange={setField("gsis_no")}
                placeholder="GSIS No."
              />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <InputField
                label="PAG-IBIG No."
                value={form.pag_ibig_no}
                onChange={setField("pag_ibig_no")}
                placeholder="PAG-IBIG"
              />
            </View>
            <View className="flex-1">
              <InputField
                label="PSN No."
                value={form.psn_no}
                onChange={setField("psn_no")}
                placeholder="PSN No."
              />
            </View>
          </View>
          <InputField
            label="PhilHealth No."
            value={form.philhealth_no}
            onChange={setField("philhealth_no")}
            placeholder="PhilHealth No."
          />
        </View>

        {/* ── FIELD 17: Family Background ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={Users}
            number="Field 17"
            title="Family Background"
          />
          <NameRow
            label="Father's Name"
            lastValue={form.father_last_name}
            lastOnChange={setField("father_last_name")}
            firstValue={form.father_first_name}
            firstOnChange={setField("father_first_name")}
            middleValue={form.father_middle_name}
            middleOnChange={setField("father_middle_name")}
          />
          <Divider />
          <View className="mt-3">
            <NameRow
              label="Mother's Name"
              lastValue={form.mother_last_name}
              lastOnChange={setField("mother_last_name")}
              firstValue={form.mother_first_name}
              firstOnChange={setField("mother_first_name")}
              middleValue={form.mother_middle_name}
              middleOnChange={setField("mother_middle_name")}
            />
          </View>
          <Divider />
          <View className="mt-3">
            <NameRow
              label="Guardian"
              lastValue={form.guardian_last_name}
              lastOnChange={setField("guardian_last_name")}
              firstValue={form.guardian_first_name}
              firstOnChange={setField("guardian_first_name")}
              middleValue={form.guardian_middle_name}
              middleOnChange={setField("guardian_middle_name")}
            />
          </View>
        </View>

        {/* ── FIELD 18: Accomplished By ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={User}
            number="Field 18"
            title="Accomplished By"
          />
          <View className="flex-row flex-wrap mb-3">
            {(
              ["Applicant", "Guardian", "Representative"] as AccomplishedBy[]
            ).map((a) => (
              <RadioChip
                key={a}
                label={a}
                selected={form.accomplished_by === a}
                onPress={() => setField("accomplished_by")(a)}
              />
            ))}
          </View>
          <NameRow
            lastValue={form.accom_last_name}
            lastOnChange={setField("accom_last_name")}
            firstValue={form.accom_first_name}
            firstOnChange={setField("accom_first_name")}
            middleValue={form.accom_middle_name}
            middleOnChange={setField("accom_middle_name")}
          />
        </View>

        {/* ── FIELD 19: Certifying Physician ── */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <SectionHeader
            icon={FileText}
            number="Field 19"
            title="Certifying Physician"
          />
          <InputField
            label="Name of Certifying Physician"
            value={form.certifying_physician_name}
            onChange={setField("certifying_physician_name")}
            placeholder="Full name of physician"
          />
          <InputField
            label="License No."
            value={form.certifying_physician_license_no}
            onChange={setField("certifying_physician_license_no")}
            placeholder="License number"
          />
        </View>

        {/* ── FIELD 20: Upload Documents ── */}
        <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
          <SectionHeader
            icon={Paperclip}
            number="Field 20"
            title="Upload Documents"
            subtitle="Medical certificate required · other docs optional"
          />

          {/* Medical Certificate */}
          <DocPickerRow
            label="Medical Certificate"
            fileName={medCertName}
            onPress={pickMedCert}
            required
          />
          <ErrorMsg field="medical_certificate" />

          {/* Birth Certificate */}
          <DocPickerRow
            label="Birth Certificate"
            fileName={birthCertName}
            onPress={pickBirthCert}
          />

          {/* Supporting Documents */}
          <View>
            <FieldLabel label="Supporting Documents" />
            <Text className="text-[11px] text-gray-400 mb-2 -mt-1">
              Medical records, referral letters, or other relevant files
            </Text>

            {supportingNames.map((name, i) => (
              <View
                key={i}
                className="flex-row items-center gap-3 border border-green-300 bg-green-50 rounded-xl px-4 py-3 mb-2"
              >
                <Paperclip size={15} color="#16a34a" />
                <Text
                  className="flex-1 text-[12px] text-green-700 font-medium"
                  numberOfLines={1}
                >
                  {name}
                </Text>
                <Pressable
                  onPress={() => removeSupportingDoc(i)}
                  hitSlop={10}
                  className="p-1"
                >
                  <Text className="text-red-400 font-bold text-sm">✕</Text>
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={addSupportingDoc}
              className="flex-row items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3.5"
            >
              <Text className="text-gray-400 text-lg leading-none font-light">
                +
              </Text>
              <Text className="text-[13px] text-gray-400">Add document</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Submit ── */}
        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className={`bg-green-700 py-4 rounded-2xl flex-row items-center justify-center gap-2.5 ${submitting ? "opacity-60" : ""}`}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={18} color="#fff" />
          )}
          <Text className="text-white font-bold text-base">
            {submitting ? "Submitting…" : "Submit Application"}
          </Text>
        </Pressable>

        <Text className="text-center text-[11px] text-gray-400 mt-3">
          Your application will be reviewed by the PDAO office.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

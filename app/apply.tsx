// app/apply.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  date_of_birth: Date | null; // ← Date object, not string
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

// Max DOB: must be at least 1 year old
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

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ApplyScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDOBPicker, setShowDOBPicker] = useState(false);

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
    setErrors(e);
    return Object.keys(e).length === 0;
  };

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
        date_of_birth: form.date_of_birth?.toISOString(), // ← ISO string, reliable for backend
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

          {/* ── Date of Birth — DateTimePicker ── */}
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
                  // On Android the picker closes itself; on iOS keep it open
                  if (Platform.OS === "android") setShowDOBPicker(false);
                  if (selectedDate) setField("date_of_birth")(selectedDate);
                }}
              />
            )}

            {/* iOS needs an explicit Done button to dismiss the spinner */}
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
        <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
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

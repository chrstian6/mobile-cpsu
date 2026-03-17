// app/screens/update-information.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Save,
  User,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";

type ActiveTab = "account" | "password";

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatPhone = (text: string): string => {
  const digits = text.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
};

const unformatPhone = (text: string) => text.replace(/\D/g, "");

// ── Reusable input field ──────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "none",
  icon,
  error,
  required,
  maxLength,
  editable = true,
  secureTextEntry = false,
  rightElement,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: any;
  autoCapitalize?: any;
  icon: any;
  error?: string | null;
  required?: boolean;
  maxLength?: number;
  editable?: boolean;
  secureTextEntry?: boolean;
  rightElement?: React.ReactNode;
}) {
  const Icon = icon;
  return (
    <View className="mb-4">
      <Text className="text-gray-700 text-[13px] font-semibold mb-2">
        {label}
        {required && <Text className="text-red-400"> *</Text>}
      </Text>
      <View
        className={`flex-row items-center rounded-2xl border px-4 ${
          error
            ? "border-red-300 bg-red-50"
            : editable
              ? "border-gray-200 bg-gray-50"
              : "border-gray-100 bg-gray-100"
        }`}
      >
        <Icon
          size={18}
          color={error ? "#DC2626" : editable ? "#6B7280" : "#9CA3AF"}
        />
        <TextInput
          className="flex-1 text-[15px] text-gray-900 ml-3"
          style={{ paddingVertical: 14 }}
          placeholder={placeholder}
          placeholderTextColor="#D1D5DB"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          editable={editable}
          secureTextEntry={secureTextEntry}
          autoCorrect={false}
        />
        {rightElement}
      </View>
      {!!error && (
        <View className="flex-row items-center gap-1.5 mt-1.5">
          <AlertCircle size={12} color="#DC2626" />
          <Text className="text-red-500 text-[11px]">{error}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function UpdateInformationScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("account");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── Account fields ────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  // ── Account errors ────────────────────────────────────────────────────
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  // ── Password fields ───────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Password errors ───────────────────────────────────────────────────
  const [currentPasswordError, setCurrentPasswordError] = useState<
    string | null
  >(null);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);

  // ── Load profile from /api/auth/me ────────────────────────────────────
  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const profile = data.user ?? data;
        setFirstName(profile.first_name ?? "");
        setMiddleName(profile.middle_name ?? "");
        setLastName(profile.last_name ?? "");
        setSuffix(profile.suffix ?? "");
        setContactNumber(formatPhone(profile.contact_number ?? ""));
      } else {
        // Fall back to auth store
        if (user) {
          setFirstName((user as any).first_name ?? "");
          setMiddleName((user as any).middle_name ?? "");
          setLastName((user as any).last_name ?? "");
          setSuffix((user as any).suffix ?? "");
          setContactNumber(formatPhone((user as any).contact_number ?? ""));
        }
      }
    } catch {
      if (user) {
        setFirstName((user as any).first_name ?? "");
        setMiddleName((user as any).middle_name ?? "");
        setLastName((user as any).last_name ?? "");
        setSuffix((user as any).suffix ?? "");
        setContactNumber(formatPhone((user as any).contact_number ?? ""));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── Validate account form ─────────────────────────────────────────────
  const validateAccount = (): boolean => {
    let valid = true;

    if (!firstName.trim()) {
      setFirstNameError("First name is required");
      valid = false;
    } else {
      setFirstNameError(null);
    }

    if (!lastName.trim()) {
      setLastNameError("Last name is required");
      valid = false;
    } else {
      setLastNameError(null);
    }

    const rawPhone = unformatPhone(contactNumber);
    if (!rawPhone) {
      setContactError("Contact number is required");
      valid = false;
    } else if (rawPhone.length !== 11) {
      setContactError("Must be 11 digits");
      valid = false;
    } else if (!rawPhone.startsWith("09")) {
      setContactError("Must start with 09");
      valid = false;
    } else {
      setContactError(null);
    }

    return valid;
  };

  // ── Validate password form ────────────────────────────────────────────
  const validatePassword = (): boolean => {
    let valid = true;

    if (!currentPassword) {
      setCurrentPasswordError("Current password is required");
      valid = false;
    } else {
      setCurrentPasswordError(null);
    }

    if (!newPassword) {
      setNewPasswordError("New password is required");
      valid = false;
    } else if (newPassword.length < 8) {
      setNewPasswordError("Must be at least 8 characters");
      valid = false;
    } else {
      setNewPasswordError(null);
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your new password");
      valid = false;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match");
      valid = false;
    } else {
      setConfirmPasswordError(null);
    }

    return valid;
  };

  // ── Save account — calls PATCH /api/auth/update-profile ──────────────
  // Matches the existing route which accepts: first_name, middle_name,
  // last_name, suffix, sex, address, contact_number
  const handleSaveAccount = async () => {
    if (!validateAccount()) return;

    setSaving(true);
    setSuccessMessage(null);
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/auth/update-profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          middle_name: middleName.trim(),
          last_name: lastName.trim(),
          suffix: suffix.trim(),
          contact_number: unformatPhone(contactNumber),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMessage("Account information updated successfully.");
      } else {
        Alert.alert(
          "Error",
          data.message || data.error || "Failed to update account information.",
        );
      }
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Change password — calls POST /api/auth/change-password ───────────
  // Matches the existing route which accepts: current_password, new_password
  const handleChangePassword = async () => {
    if (!validatePassword()) return;

    setSaving(true);
    setSuccessMessage(null);
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (!token) {
        Alert.alert("Error", "Session expired. Please log in again.");
        return;
      }

      const res = await fetch(`${EXPRESS_API_BASE}/api/auth/change-password`, {
        method: "POST", // existing route uses POST, not PATCH
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSuccessMessage("Password changed successfully.");
      } else {
        const msg = data.message || data.error || "";
        if (
          msg.toLowerCase().includes("current") ||
          msg.toLowerCase().includes("incorrect")
        ) {
          setCurrentPasswordError("Current password is incorrect");
        } else {
          Alert.alert("Error", msg || "Failed to change password.");
        }
      }
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Password strength ─────────────────────────────────────────────────
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { label: "", color: "bg-gray-200", width: "w-0" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1)
      return { label: "Weak", color: "bg-red-400", width: "w-1/4" };
    if (score <= 2)
      return { label: "Fair", color: "bg-amber-400", width: "w-2/4" };
    if (score <= 3)
      return { label: "Good", color: "bg-blue-400", width: "w-3/4" };
    return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
  };

  const strength = getPasswordStrength(newPassword);

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="text-gray-400 text-[13px] mt-3">
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View className="bg-white border-b border-gray-100">
        <View className="px-5 pt-3 pb-3 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center"
          >
            <ArrowLeft size={18} color="#374151" strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-gray-900 text-[17px] font-bold tracking-tight">
              Update Information
            </Text>
            <Text className="text-gray-400 text-[12px] mt-0.5">
              Manage your account and password
            </Text>
          </View>
        </View>

        {/* Tab bar */}
        <View className="flex-row px-5 pb-0 gap-0">
          {(["account", "password"] as ActiveTab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                setActiveTab(tab);
                setSuccessMessage(null);
              }}
              className="flex-1 pb-3 items-center"
            >
              <View className="flex-row items-center gap-1.5">
                {tab === "account" ? (
                  <User
                    size={14}
                    color={activeTab === tab ? "#166534" : "#9CA3AF"}
                  />
                ) : (
                  <KeyRound
                    size={14}
                    color={activeTab === tab ? "#166534" : "#9CA3AF"}
                  />
                )}
                <Text
                  className={`text-[13px] font-semibold ${
                    activeTab === tab ? "text-green-800" : "text-gray-400"
                  }`}
                >
                  {tab === "account" ? "Account Info" : "Password"}
                </Text>
              </View>
              <View
                className={`h-[2px] w-full mt-2 rounded-full ${
                  activeTab === tab ? "bg-green-800" : "bg-transparent"
                }`}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Success banner ──────────────────────────────────────────── */}
        {!!successMessage && (
          <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 flex-row items-center gap-3">
            <CheckCircle2 size={18} color="#059669" />
            <Text className="text-emerald-700 text-[13px] font-medium flex-1">
              {successMessage}
            </Text>
          </View>
        )}

        {/* ── Account Info Tab ────────────────────────────────────────── */}
        {activeTab === "account" && (
          <View>
            <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5">
              <Text className="text-blue-700 text-[12px] leading-5">
                <Text className="font-bold">Note: </Text>
                Updates to your name and contact number will be reflected on
                your profile immediately. To update your email, contact the PDAO
                office.
              </Text>
            </View>

            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-3">
              Name
            </Text>

            <Field
              label="First Name"
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t.replace(/[^A-Za-z\s]/g, ""));
                setFirstNameError(null);
              }}
              placeholder="e.g. Juan"
              autoCapitalize="words"
              icon={User}
              error={firstNameError}
              required
            />
            <Field
              label="Middle Name"
              value={middleName}
              onChangeText={(t) => setMiddleName(t.replace(/[^A-Za-z\s]/g, ""))}
              placeholder="e.g. Santos (optional)"
              autoCapitalize="words"
              icon={User}
            />
            <Field
              label="Last Name"
              value={lastName}
              onChangeText={(t) => {
                setLastName(t.replace(/[^A-Za-z\s]/g, ""));
                setLastNameError(null);
              }}
              placeholder="e.g. Dela Cruz"
              autoCapitalize="words"
              icon={User}
              error={lastNameError}
              required
            />
            <Field
              label="Suffix"
              value={suffix}
              onChangeText={setSuffix}
              placeholder="e.g. Jr. (optional)"
              autoCapitalize="words"
              icon={User}
            />

            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-3 mt-2">
              Contact
            </Text>

            <Field
              label="Contact Number"
              value={contactNumber}
              onChangeText={(t) => {
                setContactNumber(formatPhone(t));
                setContactError(null);
              }}
              placeholder="09xx xxx xxxx"
              keyboardType="phone-pad"
              icon={Phone}
              error={contactError}
              required
              maxLength={13}
            />

            {/* Email is read-only — the existing route doesn't update it */}
            <Field
              label="Email Address"
              value={(user as any)?.email ?? ""}
              onChangeText={() => {}}
              placeholder=""
              icon={Mail}
              editable={false}
            />
            <Text className="text-gray-400 text-[11px] -mt-2 mb-4">
              Email cannot be changed. Contact PDAO office if needed.
            </Text>

            <Pressable
              onPress={handleSaveAccount}
              disabled={saving}
              className={`mt-2 rounded-2xl py-4 items-center justify-center flex-row gap-2 ${
                saving ? "bg-green-700 opacity-70" : "bg-green-900"
              }`}
              style={{
                shadowColor: "#166534",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {saving ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-white text-[15px] font-bold ml-2">
                    Saving...
                  </Text>
                </>
              ) : (
                <>
                  <Save size={18} color="#fff" />
                  <Text className="text-white text-[15px] font-bold">
                    Save Changes
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* ── Password Tab ────────────────────────────────────────────── */}
        {activeTab === "password" && (
          <View>
            <View className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5">
              <Text className="text-amber-700 text-[12px] leading-5">
                <Text className="font-bold">Security tip: </Text>
                Use a strong password with at least 8 characters, mixing
                letters, numbers, and special characters.
              </Text>
            </View>

            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-3">
              Current Password
            </Text>

            <Field
              label="Current Password"
              value={currentPassword}
              onChangeText={(t) => {
                setCurrentPassword(t);
                setCurrentPasswordError(null);
              }}
              placeholder="Enter your current password"
              icon={Lock}
              error={currentPasswordError}
              required
              secureTextEntry={!showCurrent}
              rightElement={
                <Pressable
                  onPress={() => setShowCurrent(!showCurrent)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showCurrent ? (
                    <EyeOff size={18} color="#9CA3AF" />
                  ) : (
                    <Eye size={18} color="#9CA3AF" />
                  )}
                </Pressable>
              }
            />

            <Text className="text-gray-400 text-[11px] font-semibold tracking-wider uppercase mb-3 mt-2">
              New Password
            </Text>

            <Field
              label="New Password"
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                setNewPasswordError(null);
                setConfirmPasswordError(null);
              }}
              placeholder="Enter your new password"
              icon={Lock}
              error={newPasswordError}
              required
              secureTextEntry={!showNew}
              rightElement={
                <Pressable
                  onPress={() => setShowNew(!showNew)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showNew ? (
                    <EyeOff size={18} color="#9CA3AF" />
                  ) : (
                    <Eye size={18} color="#9CA3AF" />
                  )}
                </Pressable>
              }
            />

            {/* Strength bar */}
            {newPassword.length > 0 && (
              <View className="mb-4 -mt-2">
                <View className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <View
                    className={`h-1.5 rounded-full ${strength.color} ${strength.width}`}
                  />
                </View>
                <Text
                  className={`text-[11px] font-medium mt-1 ${
                    strength.label === "Weak"
                      ? "text-red-500"
                      : strength.label === "Fair"
                        ? "text-amber-500"
                        : strength.label === "Good"
                          ? "text-blue-500"
                          : "text-emerald-600"
                  }`}
                >
                  {`Password strength: ${strength.label}`}
                </Text>
              </View>
            )}

            <Field
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setConfirmPasswordError(null);
              }}
              placeholder="Re-enter your new password"
              icon={Lock}
              error={confirmPasswordError}
              required
              secureTextEntry={!showConfirm}
              rightElement={
                <Pressable
                  onPress={() => setShowConfirm(!showConfirm)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {showConfirm ? (
                    <EyeOff size={18} color="#9CA3AF" />
                  ) : (
                    <Eye size={18} color="#9CA3AF" />
                  )}
                </Pressable>
              }
            />

            {/* Requirements checklist */}
            <View className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5">
              <Text className="text-gray-500 text-[11px] font-semibold mb-2">
                Password requirements:
              </Text>
              {[
                { rule: "At least 8 characters", met: newPassword.length >= 8 },
                {
                  rule: "Contains uppercase letter",
                  met: /[A-Z]/.test(newPassword),
                },
                { rule: "Contains a number", met: /[0-9]/.test(newPassword) },
                {
                  rule: "Contains a special character",
                  met: /[^A-Za-z0-9]/.test(newPassword),
                },
              ].map((r, i) => (
                <View key={i} className="flex-row items-center gap-2 mb-1">
                  <View
                    className={`w-4 h-4 rounded-full items-center justify-center ${r.met ? "bg-emerald-100" : "bg-gray-100"}`}
                  >
                    <CheckCircle2
                      size={10}
                      color={r.met ? "#059669" : "#D1D5DB"}
                    />
                  </View>
                  <Text
                    className={`text-[11px] ${r.met ? "text-emerald-700" : "text-gray-400"}`}
                  >
                    {r.rule}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={handleChangePassword}
              disabled={saving}
              className={`rounded-2xl py-4 items-center justify-center flex-row gap-2 ${
                saving ? "bg-green-700 opacity-70" : "bg-green-900"
              }`}
              style={{
                shadowColor: "#166534",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {saving ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-white text-[15px] font-bold ml-2">
                    Changing...
                  </Text>
                </>
              ) : (
                <>
                  <KeyRound size={18} color="#fff" />
                  <Text className="text-white text-[15px] font-bold">
                    Change Password
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

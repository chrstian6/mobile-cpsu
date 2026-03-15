// app/(auth)/login.tsx
import { useAuthStore } from "@/stores/auth";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Eye,
  EyeOff,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  barangays,
  cities,
  provinces,
  regions,
} from "select-philippines-address";

const TAB_SHADOW = {
  elevation: 2,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 2,
};

// Format raw digits into "09xx xxx xxxx" for display
const formatPhone = (digits: string): string => {
  const d = digits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
};

// Strip spaces/non-digits to get raw digits
const stripPhone = (formatted: string): string =>
  formatted.replace(/\D/g, "").slice(0, 11);

// Capitalize first letter of each word
const capitalizeWords = (text: string): string => {
  if (!text) return text;
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getFriendlyError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes("email already") || m.includes("email already in use"))
    return "An account with this email already exists.";
  if (
    m.includes("contact number already") ||
    m.includes("contact number already in use")
  )
    return "An account with this contact number already exists.";
  if (
    m.includes("duplicate field") ||
    m.includes("already exists") ||
    m.includes("already in use")
  )
    return "An account with this email or contact number already exists.";
  return msg;
};

// Type guard to check if an item is valid
const isValidAddressItem = (
  item: any,
): item is { name: string; code: string } => {
  return (
    item !== null &&
    item !== undefined &&
    typeof item.name === "string" &&
    item.name.trim() !== "" &&
    typeof item.code === "string"
  );
};

// Utility function to safely process address data
const processAddressData = <T extends Record<string, any>>(
  data: T[] | undefined,
  nameKey: keyof T,
  codeKey: keyof T,
): Array<{ name: string; code: string }> => {
  // Return empty array if data is invalid
  if (!data || !Array.isArray(data)) {
    return [];
  }

  // Process and filter the data
  const processed = data
    .map((item) => {
      // Skip if item is null or undefined
      if (!item) return null;

      const name = item[nameKey];
      const code = item[codeKey];

      // Only return if both name and code exist and name is not empty
      if (name && typeof name === "string" && name.trim() && code) {
        return {
          name: capitalizeWords(name),
          code: String(code),
        };
      }
      return null;
    })
    .filter(isValidAddressItem);

  // Sort by name
  return processed.sort((a, b) => a.name.localeCompare(b.name));
};

// Dropdown Modal Component
const DropdownModal = ({
  visible,
  onClose,
  title,
  data,
  onSelect,
  searchPlaceholder,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  data: Array<{ name: string; code: string }>;
  onSelect: (item: { name: string; code: string }) => void;
  searchPlaceholder?: string;
  loading?: boolean;
}) => {
  const [search, setSearch] = useState("");

  const filteredData = data.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50">
        <View className="flex-1 mt-20 bg-white rounded-t-3xl">
          <View className="px-5 pt-5 pb-3 border-b border-gray-100">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-900 text-lg font-bold">{title}</Text>
              <Pressable onPress={onClose} className="p-2">
                <Text className="text-green-700 font-semibold">Close</Text>
              </Pressable>
            </View>
            <View className="bg-gray-50 rounded-xl px-4 py-2 border border-gray-200">
              <TextInput
                className="text-base text-gray-900"
                placeholder={searchPlaceholder || "Search..."}
                placeholderTextColor="#9ca3af"
                value={search}
                onChangeText={setSearch}
              />
            </View>
          </View>

          {loading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#166534" />
              <Text className="text-gray-400 mt-2">Loading...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredData}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="px-5 py-4 border-b border-gray-100 active:bg-green-50"
                >
                  <Text className="text-gray-900 text-base">{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="py-8 items-center">
                  <Text className="text-gray-400">No results found</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

export default function LoginScreen() {
  const { login, register, isSubmitting, error, clearError, user, isLoading } =
    useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Registration fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState<"Male" | "Female" | "Other">("Other");

  // Address fields with dropdown
  const [street, setStreet] = useState("");
  const [barangay, setBarangay] = useState("");
  const [barangayCode, setBarangayCode] = useState("");
  const [city, setCity] = useState("");
  const [cityCode, setCityCode] = useState("");
  const [province, setProvince] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [region, setRegion] = useState("");
  const [regionCode, setRegionCode] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Dropdown data
  const [regionsList, setRegionsList] = useState<
    Array<{ name: string; code: string }>
  >([]);
  const [provincesList, setProvincesList] = useState<
    Array<{ name: string; code: string }>
  >([]);
  const [citiesList, setCitiesList] = useState<
    Array<{ name: string; code: string }>
  >([]);
  const [barangaysList, setBarangaysList] = useState<
    Array<{ name: string; code: string }>
  >([]);

  // Loading states
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  // Dropdown visibility
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showBarangayModal, setShowBarangayModal] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Pull to refresh states
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingAddress, setRefreshingAddress] = useState(false);

  // Load regions on mount
  useEffect(() => {
    if (!isLogin) {
      loadRegionsData();
    }
  }, [isLogin]);

  // Load provinces when region is selected
  useEffect(() => {
    if (regionCode && !isLogin) {
      loadProvincesData();
    } else {
      setProvincesList([]);
    }
  }, [regionCode, isLogin]);

  // Load cities when province is selected
  useEffect(() => {
    if (provinceCode && !isLogin) {
      loadCitiesData();
    } else {
      setCitiesList([]);
    }
  }, [provinceCode, isLogin]);

  // Load barangays when city is selected
  useEffect(() => {
    if (cityCode && !isLogin) {
      loadBarangaysData();
    } else {
      setBarangaysList([]);
    }
  }, [cityCode, isLogin]);

  // Reset dependent fields when parent changes
  useEffect(() => {
    setProvince("");
    setProvinceCode("");
    setCity("");
    setCityCode("");
    setBarangay("");
    setBarangayCode("");
  }, [regionCode]);

  useEffect(() => {
    setCity("");
    setCityCode("");
    setBarangay("");
    setBarangayCode("");
  }, [provinceCode]);

  useEffect(() => {
    setBarangay("");
    setBarangayCode("");
  }, [cityCode]);

  useEffect(() => {
    if (!isLogin && !contactNumber) {
      setContactNumber("09");
    }
  }, [isLogin]);

  // Data loading functions
  const loadRegionsData = async () => {
    setLoadingRegions(true);
    try {
      const regionsData = await regions();
      const formattedRegions = processAddressData(
        regionsData,
        "region_name",
        "region_code",
      );
      setRegionsList(formattedRegions);
    } catch (err) {
      console.error("Error loading regions:", err);
      setRegionsList([]);
    } finally {
      setLoadingRegions(false);
    }
  };

  const loadProvincesData = async () => {
    setLoadingProvinces(true);
    try {
      const provincesData = await provinces(regionCode);
      const formattedProvinces = processAddressData(
        provincesData,
        "province_name",
        "province_code",
      );
      setProvincesList(formattedProvinces);
    } catch (err) {
      console.error("Error loading provinces:", err);
      setProvincesList([]);
    } finally {
      setLoadingProvinces(false);
    }
  };

  const loadCitiesData = async () => {
    setLoadingCities(true);
    try {
      const citiesData = await cities(provinceCode);
      const formattedCities = processAddressData(
        citiesData,
        "city_name",
        "city_code",
      );
      setCitiesList(formattedCities);
    } catch (err) {
      console.error("Error loading cities:", err);
      setCitiesList([]);
    } finally {
      setLoadingCities(false);
    }
  };

  const loadBarangaysData = async () => {
    setLoadingBarangays(true);
    try {
      const barangaysData = await barangays(cityCode);

      if (!barangaysData || !Array.isArray(barangaysData)) {
        setBarangaysList([]);
        return;
      }

      const formattedBarangays: Array<{ name: string; code: string }> = [];

      for (const b of barangaysData) {
        if (!b) continue;

        const name = b.brgy_name;
        const code = b.brgy_code;

        if (name && typeof name === "string" && name.trim() && code) {
          formattedBarangays.push({
            name: capitalizeWords(name),
            code: String(code),
          });
        } else {
          console.warn("Invalid barangay data:", b);
        }
      }

      formattedBarangays.sort((a, b) => a.name.localeCompare(b.name));
      setBarangaysList(formattedBarangays);
    } catch (err) {
      console.error("Error loading barangays:", err);
      setBarangaysList([]);
    } finally {
      setLoadingBarangays(false);
    }
  };

  // Pull to refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    // Clear any local errors
    setLocalError(null);
    clearError();

    // If in registration mode, refresh address data based on current selections
    if (!isLogin) {
      setRefreshingAddress(true);

      // Refresh regions always
      await loadRegionsData();

      // Refresh provinces if region is selected
      if (regionCode) {
        await loadProvincesData();
      }

      // Refresh cities if province is selected
      if (provinceCode) {
        await loadCitiesData();
      }

      // Refresh barangays if city is selected
      if (cityCode) {
        await loadBarangaysData();
      }

      setRefreshingAddress(false);
    }

    setRefreshing(false);
  }, [isLogin, regionCode, provinceCode, cityCode, clearError]);

  if (!isLoading && user) {
    return <Redirect href="/(tabs)" />;
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#14532d" />
      </View>
    );
  }

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setSuffix("");
    setContactNumber("");
    setDateOfBirth("");
    setSex("Other");
    setStreet("");
    setBarangay("");
    setBarangayCode("");
    setCity("");
    setCityCode("");
    setProvince("");
    setProvinceCode("");
    setRegion("");
    setRegionCode("");
    setZipCode("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setLocalError(null);
    clearError();
    setSelectedDate(new Date());
  };

  const switchToLogin = () => {
    if (!isLogin) {
      setIsLogin(true);
      resetForm();
    }
  };

  const switchToRegister = () => {
    if (isLogin) {
      setIsLogin(false);
      resetForm();
      setContactNumber("09");
    }
  };

  const validatePhoneNumber = (phone: string) => {
    return phone.length === 11 && phone.startsWith("09");
  };

  const handlePhoneChange = (text: string) => {
    let digits = stripPhone(text);
    if (digits.length === 0) {
      setContactNumber("09");
      return;
    }
    if (!digits.startsWith("09")) {
      if (digits.startsWith("0")) {
        digits = "09" + digits.slice(1);
      } else {
        digits = "09" + digits;
      }
    }
    setContactNumber(digits.slice(0, 11));
  };

  const handleNameChange = (text: string, setter: (value: string) => void) => {
    // Allow only letters, spaces, and hyphens
    const cleaned = text.replace(/[^A-Za-z\s-]/g, "");
    setter(cleaned);
  };

  const validateDateOfBirth = (dob: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
    const [year, month, day] = dob.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date instanceof Date && !isNaN(date.getTime()) && date <= new Date();
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (date) {
      setSelectedDate(date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      setDateOfBirth(`${year}-${month}-${day}`);
    }
  };

  const handleSubmit = async () => {
    setLocalError(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError("Email and password are required.");
      return;
    }

    if (!isLogin) {
      if (!firstName.trim()) {
        setLocalError("First name is required.");
        return;
      }
      if (!lastName.trim()) {
        setLocalError("Last name is required.");
        return;
      }
      if (!contactNumber.trim()) {
        setLocalError("Contact number is required.");
        return;
      }
      if (!validatePhoneNumber(contactNumber)) {
        setLocalError("Contact number must start with 09 and be 11 digits.");
        return;
      }
      if (!dateOfBirth.trim()) {
        setLocalError("Date of birth is required.");
        return;
      }
      if (!validateDateOfBirth(dateOfBirth)) {
        setLocalError(
          "Date of birth must be in YYYY-MM-DD format and not in the future.",
        );
        return;
      }
      if (!region) {
        setLocalError("Region is required.");
        return;
      }
      if (!province) {
        setLocalError("Province is required.");
        return;
      }
      if (!city) {
        setLocalError("City/Municipality is required.");
        return;
      }
      if (!barangay) {
        setLocalError("Barangay is required.");
        return;
      }
      if (!street.trim()) {
        setLocalError("Street address is required.");
        return;
      }
      if (password.length < 8) {
        setLocalError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match.");
        return;
      }

      const address = {
        street: capitalizeWords(street.trim()),
        barangay: capitalizeWords(barangay),
        city_municipality: capitalizeWords(city),
        province: capitalizeWords(province),
        region: capitalizeWords(region),
        zip_code: zipCode || "",
        country: "Philippines",
        type: "Permanent" as const,
      };

      try {
        await register({
          first_name: capitalizeWords(firstName.trim()),
          middle_name: middleName.trim()
            ? capitalizeWords(middleName.trim())
            : undefined,
          last_name: capitalizeWords(lastName.trim()),
          suffix: suffix.trim() || undefined,
          sex,
          date_of_birth: dateOfBirth,
          contact_number: contactNumber,
          email: email.trim().toLowerCase(),
          password,
          address,
        });
      } catch (err: any) {
        const raw = err?.message || "Registration failed. Please try again.";
        setLocalError(getFriendlyError(raw));
      }
    } else {
      try {
        await login({ email: email.trim().toLowerCase(), password });
      } catch (err: any) {
        const raw = err?.message || "Login failed. Please try again.";
        setLocalError(getFriendlyError(raw));
      }
    }
  };

  const displayError = localError || error;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#166534"
              colors={["#166534"]}
              title="Pull to refresh"
              titleColor="#166534"
              progressBackgroundColor="#ffffff"
            />
          }
        >
          {/* Hero Section */}
          <View className="bg-green-900 h-72 justify-end overflow-hidden">
            <View className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white opacity-5" />
            <View className="absolute top-8 right-10 w-28 h-28 rounded-full bg-white opacity-5" />
            <View className="absolute bottom-10 -left-10 w-40 h-40 rounded-full bg-green-600 opacity-40" />
            <View className="absolute top-0 left-0 right-0 px-6 pt-5 pb-3 border-b border-white/10 flex-row items-center gap-2">
              <ShieldCheck
                size={13}
                color="rgba(255,255,255,0.65)"
                strokeWidth={2}
              />
              <Text className="text-white/65 text-xs font-semibold tracking-widest uppercase">
                Republic of the Philippines
              </Text>
            </View>
            <View className="px-7 pb-10 flex-row items-center gap-4">
              <View className="w-18 h-18 rounded-2xl bg-white items-center justify-center p-1.5">
                <Image
                  source={require("../../assets/images/logo.png")}
                  className="w-14 h-14 rounded-xl"
                  resizeMode="contain"
                />
              </View>
              <View className="flex-1">
                <Text className="text-white/70 text-xs font-bold tracking-widest uppercase mb-1">
                  PDAO
                </Text>
                <Text className="text-white text-lg font-extrabold leading-6 tracking-tight">
                  Registry & Assistance{"\n"}Management
                </Text>
              </View>
            </View>
            <View className="absolute bottom-0 left-0 right-0 h-7 bg-white rounded-t-3xl" />
          </View>

          {/* Form Section */}
          <View className="flex-1 bg-white px-6 pb-10">
            {/* Refresh indicator for address data */}
            {!isLogin && refreshingAddress && (
              <View className="flex-row items-center justify-center bg-blue-50 rounded-xl py-2 px-4 mb-4 border border-blue-100">
                <RefreshCw size={14} color="#2563EB" className="mr-2" />
                <Text className="text-blue-700 text-xs font-medium">
                  Refreshing address data...
                </Text>
              </View>
            )}

            <View className="mb-6">
              <Text className="text-gray-900 text-2xl font-bold tracking-tight">
                {isLogin ? "Welcome back" : "Create account"}
              </Text>
              <Text className="text-gray-400 text-sm mt-1 font-medium">
                {isLogin
                  ? "Sign in to access your PDAO account"
                  : "Register to access PDAO services"}
              </Text>
            </View>

            {/* Tab Switcher */}
            <View className="flex-row bg-gray-100 rounded-2xl p-1.5 mb-7">
              <Pressable
                className={`flex-1 py-3.5 rounded-xl items-center ${isLogin ? "bg-white" : ""}`}
                style={isLogin ? TAB_SHADOW : undefined}
                onPress={switchToLogin}
              >
                <Text
                  className={`text-sm font-bold ${isLogin ? "text-green-900" : "text-gray-400"}`}
                >
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 py-3.5 rounded-xl items-center ${!isLogin ? "bg-white" : ""}`}
                style={!isLogin ? TAB_SHADOW : undefined}
                onPress={switchToRegister}
              >
                <Text
                  className={`text-sm font-bold ${!isLogin ? "text-green-900" : "text-gray-400"}`}
                >
                  Register
                </Text>
              </Pressable>
            </View>

            {/* Error Message */}
            {displayError && (
              <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5">
                <AlertCircle size={16} color="#dc2626" strokeWidth={2} />
                <Text className="text-red-700 text-sm font-medium flex-1">
                  {displayError}
                </Text>
              </View>
            )}

            {/* Registration Fields */}
            {!isLogin && (
              <>
                <Text className="text-gray-700 text-base font-bold mt-2 mb-3">
                  Personal Information
                </Text>

                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    First Name <Text className="text-red-400">*</Text>
                  </Text>
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "firstName" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16 }}
                    placeholder="e.g. Juan"
                    placeholderTextColor="#d1d5db"
                    value={firstName}
                    onChangeText={(text) =>
                      handleNameChange(text, setFirstName)
                    }
                    onFocus={() => setFocusedField("firstName")}
                    onBlur={() => {
                      setFocusedField(null);
                      setFirstName(capitalizeWords(firstName));
                    }}
                    autoCapitalize="words"
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Middle Name{" "}
                    <Text className="text-gray-400">(Optional)</Text>
                  </Text>
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "middleName" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16 }}
                    placeholder="e.g. Santos"
                    placeholderTextColor="#d1d5db"
                    value={middleName}
                    onChangeText={(text) =>
                      handleNameChange(text, setMiddleName)
                    }
                    onFocus={() => setFocusedField("middleName")}
                    onBlur={() => {
                      setFocusedField(null);
                      setMiddleName(capitalizeWords(middleName));
                    }}
                    autoCapitalize="words"
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Last Name <Text className="text-red-400">*</Text>
                  </Text>
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "lastName" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16 }}
                    placeholder="e.g. Dela Cruz"
                    placeholderTextColor="#d1d5db"
                    value={lastName}
                    onChangeText={(text) => handleNameChange(text, setLastName)}
                    onFocus={() => setFocusedField("lastName")}
                    onBlur={() => {
                      setFocusedField(null);
                      setLastName(capitalizeWords(lastName));
                    }}
                    autoCapitalize="words"
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Suffix <Text className="text-gray-400">(Optional)</Text>
                  </Text>
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "suffix" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16 }}
                    placeholder="e.g. Jr., Sr., III"
                    placeholderTextColor="#d1d5db"
                    value={suffix}
                    onChangeText={setSuffix}
                    onFocus={() => setFocusedField("suffix")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                  />
                </View>

                <Text className="text-gray-700 text-base font-bold mt-4 mb-3">
                  Contact Information
                </Text>

                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Contact Number <Text className="text-red-400">*</Text>
                  </Text>
                  <View className="relative">
                    <TextInput
                      className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "contactNumber" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                      style={{ paddingVertical: 16 }}
                      placeholder="09xx xxx xxxx"
                      placeholderTextColor="#d1d5db"
                      value={formatPhone(contactNumber)}
                      onChangeText={handlePhoneChange}
                      onFocus={() => {
                        setFocusedField("contactNumber");
                        if (!contactNumber || contactNumber.length < 2) {
                          setContactNumber("09");
                        }
                      }}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="phone-pad"
                      maxLength={13}
                    />
                    <View className="absolute right-4 top-0 bottom-0 justify-center">
                      <Phone size={20} color="#9ca3af" />
                    </View>
                  </View>
                  <Text className="text-gray-400 text-xs mt-1">
                    Format: 09xx xxx xxxx (11 digits)
                  </Text>
                </View>

                {/* Date of Birth */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Date of Birth <Text className="text-red-400">*</Text>
                  </Text>
                  <Pressable
                    onPress={() => setShowDatePicker(true)}
                    className={`w-full px-5 flex-row items-center justify-between rounded-2xl border ${focusedField === "dob" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16 }}
                  >
                    <Text
                      className={`text-base ${dateOfBirth ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {dateOfBirth || "Select your birth date"}
                    </Text>
                    <Calendar size={20} color="#9ca3af" />
                  </Pressable>
                </View>

                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={onDateChange}
                    maximumDate={new Date()}
                  />
                )}

                {/* Sex Selection */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Sex <Text className="text-red-400">*</Text>
                  </Text>
                  <View className="flex-row gap-3">
                    {(["Male", "Female", "Other"] as const).map((option) => (
                      <Pressable
                        key={option}
                        onPress={() => setSex(option)}
                        className={`flex-1 py-4 rounded-2xl border ${sex === option ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                      >
                        <Text
                          className={`text-center text-sm font-bold ${sex === option ? "text-green-700" : "text-gray-500"}`}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Text className="text-gray-700 text-base font-bold mt-4 mb-3">
                  Address Information
                </Text>

                {/* Region Dropdown */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Region <Text className="text-red-400">*</Text>
                  </Text>
                  <Pressable
                    onPress={() => setShowRegionModal(true)}
                    className={`w-full px-5 flex-row items-center justify-between rounded-2xl border ${focusedField === "region" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16 }}
                  >
                    <Text
                      className={`text-base ${region ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {region || "Select region"}
                    </Text>
                    <MapPin size={20} color="#9ca3af" />
                  </Pressable>
                </View>

                {/* Province Dropdown */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Province <Text className="text-red-400">*</Text>
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (regionCode) {
                        setShowProvinceModal(true);
                      } else {
                        setLocalError("Please select a region first");
                      }
                    }}
                    className={`w-full px-5 flex-row items-center justify-between rounded-2xl border ${focusedField === "province" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"} ${!regionCode ? "opacity-50" : ""}`}
                    style={{ paddingVertical: 16 }}
                  >
                    <Text
                      className={`text-base ${province ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {province ||
                        (regionCode
                          ? "Select province"
                          : "Select region first")}
                    </Text>
                    <MapPin size={20} color="#9ca3af" />
                  </Pressable>
                </View>

                {/* City/Municipality Dropdown */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    City/Municipality <Text className="text-red-400">*</Text>
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (provinceCode) {
                        setShowCityModal(true);
                      } else {
                        setLocalError("Please select a province first");
                      }
                    }}
                    className={`w-full px-5 flex-row items-center justify-between rounded-2xl border ${focusedField === "city" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"} ${!provinceCode ? "opacity-50" : ""}`}
                    style={{ paddingVertical: 16 }}
                  >
                    <Text
                      className={`text-base ${city ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {city ||
                        (provinceCode
                          ? "Select city/municipality"
                          : "Select province first")}
                    </Text>
                    <MapPin size={20} color="#9ca3af" />
                  </Pressable>
                </View>

                {/* Barangay Dropdown */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Barangay <Text className="text-red-400">*</Text>
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (cityCode) {
                        setShowBarangayModal(true);
                      } else {
                        setLocalError(
                          "Please select a city/municipality first",
                        );
                      }
                    }}
                    className={`w-full px-5 flex-row items-center justify-between rounded-2xl border ${focusedField === "barangay" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"} ${!cityCode ? "opacity-50" : ""}`}
                    style={{ paddingVertical: 16 }}
                  >
                    <Text
                      className={`text-base ${barangay ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {barangay ||
                        (cityCode
                          ? "Select barangay"
                          : "Select city/municipality first")}
                    </Text>
                    <MapPin size={20} color="#9ca3af" />
                  </Pressable>
                </View>

                {/* Street Address */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Street <Text className="text-red-400">*</Text>
                  </Text>
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "street" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16 }}
                    placeholder="House number, street name"
                    placeholderTextColor="#d1d5db"
                    value={street}
                    onChangeText={setStreet}
                    onFocus={() => setFocusedField("street")}
                    onBlur={() => {
                      setFocusedField(null);
                      setStreet(capitalizeWords(street));
                    }}
                  />
                </View>

                {/* ZIP Code */}
                <View className="mb-4">
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    ZIP Code <Text className="text-gray-400">(Optional)</Text>
                  </Text>
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "zip" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16 }}
                    placeholder="ZIP Code"
                    placeholderTextColor="#d1d5db"
                    value={zipCode}
                    onChangeText={setZipCode}
                    onFocus={() => setFocusedField("zip")}
                    onBlur={() => setFocusedField(null)}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
              </>
            )}

            {/* Email Field */}
            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-bold mb-2">
                Email Address <Text className="text-red-400">*</Text>
              </Text>
              <TextInput
                className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "email" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                style={{ paddingVertical: 16 }}
                placeholder="juan@email.com"
                placeholderTextColor="#d1d5db"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Field */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-700 text-sm font-bold">
                  Password <Text className="text-red-400">*</Text>
                </Text>
                {isLogin && (
                  <Pressable>
                    <Text className="text-green-800 text-sm font-semibold">
                      Forgot password?
                    </Text>
                  </Pressable>
                )}
              </View>
              <View className="relative">
                <TextInput
                  className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "password" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                  style={{ paddingVertical: 16, paddingRight: 54 }}
                  placeholder="Enter your password"
                  placeholderTextColor="#d1d5db"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable
                  className="absolute right-4 top-0 bottom-0 justify-center items-center w-10"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color="#9ca3af" strokeWidth={2} />
                  ) : (
                    <Eye size={20} color="#9ca3af" strokeWidth={2} />
                  )}
                </Pressable>
              </View>
              {!isLogin && (
                <Text className="text-gray-400 text-xs mt-1">
                  Minimum 8 characters
                </Text>
              )}
            </View>

            {/* Confirm Password */}
            {!isLogin && (
              <View className="mb-4">
                <Text className="text-gray-700 text-sm font-bold mb-2">
                  Confirm Password <Text className="text-red-400">*</Text>
                </Text>
                <View className="relative">
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "confirm" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16, paddingRight: 54 }}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#d1d5db"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    onFocus={() => setFocusedField("confirm")}
                    onBlur={() => setFocusedField(null)}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <Pressable
                    className="absolute right-4 top-0 bottom-0 justify-center items-center w-10"
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color="#9ca3af" strokeWidth={2} />
                    ) : (
                      <Eye size={20} color="#9ca3af" strokeWidth={2} />
                    )}
                  </Pressable>
                </View>
              </View>
            )}

            {/* Submit Button */}
            <Pressable
              className={`w-full py-5 rounded-2xl mt-6 flex-row items-center justify-center gap-2 ${isSubmitting ? "bg-green-700 opacity-80" : "bg-green-900 active:bg-green-800"}`}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text className="text-white text-base font-extrabold tracking-wide ml-2">
                    {isLogin ? "Signing In…" : "Creating Account…"}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-white text-base font-extrabold tracking-wide">
                    {isLogin ? "Sign In" : "Create Account"}
                  </Text>
                  <ChevronRight size={20} color="#ffffff" strokeWidth={2.5} />
                </>
              )}
            </Pressable>

            {!isLogin && (
              <Text className="text-center text-gray-400 text-xs mt-5 leading-5">
                By registering, you agree to our{" "}
                <Text className="text-green-800 font-semibold">
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text className="text-green-800 font-semibold">
                  Privacy Policy
                </Text>
              </Text>
            )}

            <View className="flex-row items-center justify-center mt-6 bg-green-50 rounded-2xl py-4 px-5 border border-green-100 gap-2">
              <Phone size={16} color="#166534" strokeWidth={2} />
              <Text className="text-green-900 text-sm font-semibold">
                Need help? PDAO Hotline:{" "}
                <Text className="underline">(123) 456-7890</Text>
              </Text>
            </View>

            <Text className="text-center text-gray-300 text-xs mt-5 tracking-wide">
              PDAO-RAM v1.0 · Secured by PhilSys
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Region Modal */}
      <DropdownModal
        visible={showRegionModal}
        onClose={() => setShowRegionModal(false)}
        title="Select Region"
        data={regionsList}
        onSelect={(item) => {
          setRegion(item.name);
          setRegionCode(item.code);
          setShowRegionModal(false);
        }}
        searchPlaceholder="Search region..."
        loading={loadingRegions}
      />

      {/* Province Modal */}
      <DropdownModal
        visible={showProvinceModal}
        onClose={() => setShowProvinceModal(false)}
        title="Select Province"
        data={provincesList}
        onSelect={(item) => {
          setProvince(item.name);
          setProvinceCode(item.code);
          setShowProvinceModal(false);
        }}
        searchPlaceholder="Search province..."
        loading={loadingProvinces}
      />

      {/* City Modal */}
      <DropdownModal
        visible={showCityModal}
        onClose={() => setShowCityModal(false)}
        title="Select City/Municipality"
        data={citiesList}
        onSelect={(item) => {
          setCity(item.name);
          setCityCode(item.code);
          setShowCityModal(false);
        }}
        searchPlaceholder="Search city/municipality..."
        loading={loadingCities}
      />

      {/* Barangay Modal */}
      <DropdownModal
        visible={showBarangayModal}
        onClose={() => setShowBarangayModal(false)}
        title="Select Barangay"
        data={barangaysList}
        onSelect={(item) => {
          setBarangay(item.name);
          setBarangayCode(item.code);
          setShowBarangayModal(false);
        }}
        searchPlaceholder="Search barangay..."
        loading={loadingBarangays}
      />
    </SafeAreaView>
  );
}

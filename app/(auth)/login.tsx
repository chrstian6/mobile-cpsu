// app/(auth)/login.tsx
import { useAuthStore } from "@/stores/auth";
import { Redirect } from "expo-router"; // Change this import
import { StatusBar } from "expo-status-bar";
import {
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
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

const TAB_SHADOW = {
  elevation: 2,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 2,
};

export default function LoginScreen() {
  const { login, register, isSubmitting, error, clearError, user, isLoading } =
    useAuthStore();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Redirect to tabs if already logged in - using Redirect component
  if (!isLoading && user) {
    return <Redirect href="/(tabs)" />;
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#14532d" />
      </View>
    );
  }

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setLocalError(null);
    clearError();
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
      if (!name.trim()) {
        setLocalError("Full name is required.");
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
      const nameParts = name.trim().split(/\s+/);
      const first_name = nameParts[0] ?? "";
      const last_name =
        nameParts.length > 1 ? nameParts[nameParts.length - 1] : first_name;
      const middle_name =
        nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
      try {
        await register({
          first_name,
          middle_name,
          last_name,
          email: email.trim(),
          password,
        });
      } catch {
        // Error is handled in store
      }
    } else {
      try {
        await login({ email: email.trim(), password });
      } catch {
        // Error is handled in store
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

            {displayError ? (
              <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5">
                <AlertCircle size={16} color="#dc2626" strokeWidth={2} />
                <Text className="text-red-700 text-sm font-medium flex-1">
                  {displayError}
                </Text>
              </View>
            ) : null}

            <View className="gap-y-5">
              {!isLogin && (
                <View>
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Full Name
                  </Text>
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${focusedField === "name" ? "bg-green-50 border-green-600" : "bg-gray-50 border-gray-200"}`}
                    style={{ paddingVertical: 16 }}
                    placeholder="e.g. Juan dela Cruz"
                    placeholderTextColor="#d1d5db"
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              )}

              <View>
                <Text className="text-gray-700 text-sm font-bold mb-2">
                  Email Address
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
                  returnKeyType="next"
                />
              </View>

              <View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-700 text-sm font-bold">
                    Password
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
                    returnKeyType={isLogin ? "done" : "next"}
                    onSubmitEditing={isLogin ? handleSubmit : undefined}
                  />
                  <Pressable
                    className="absolute right-4 top-0 bottom-0 justify-center items-center w-10"
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#9ca3af" strokeWidth={2} />
                    ) : (
                      <Eye size={20} color="#9ca3af" strokeWidth={2} />
                    )}
                  </Pressable>
                </View>
              </View>

              {!isLogin && (
                <View>
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Confirm Password
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
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                    <Pressable
                      className="absolute right-4 top-0 bottom-0 justify-center items-center w-10"
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
            </View>

            <Pressable
              className={`w-full py-5 rounded-2xl mt-8 flex-row items-center justify-center gap-2 ${isSubmitting ? "bg-green-700 opacity-80" : "bg-green-900 active:bg-green-800"}`}
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
    </SafeAreaView>
  );
}

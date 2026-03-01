import { StatusBar } from "expo-status-bar";
import {
  ChevronRight,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
} from "lucide-react-native";
import { useState } from "react";
import {
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

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const switchToLogin = () => {
    if (!isLogin) {
      setIsLogin(true);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  };

  const switchToRegister = () => {
    if (isLogin) {
      setIsLogin(false);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  };

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
          {/* ── Hero ── */}
          <View className="bg-green-900 h-72 justify-end overflow-hidden">
            {/* Decorative circles */}
            <View className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white opacity-5" />
            <View className="absolute top-8 right-10 w-28 h-28 rounded-full bg-white opacity-5" />
            <View className="absolute bottom-10 -left-10 w-40 h-40 rounded-full bg-green-600 opacity-40" />

            {/* Republic bar */}
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

            {/* Logo + Title */}
            <View className="px-7 pb-10 flex-row items-center gap-4">
              <View className="w-18 h-18 rounded-2xl bg-white items-center justify-center p-1.5">
                <Image
                  source={require("../assets/images/logo.png")}
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

            {/* White notch */}
            <View className="absolute bottom-0 left-0 right-0 h-7 bg-white rounded-t-3xl" />
          </View>

          {/* ── Form ── */}
          <View className="flex-1 bg-white px-6 pb-10">
            {/* Welcome text */}
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

            {/* ── Tab switcher — NO shadow class, use style prop instead ── */}
            <View className="flex-row bg-gray-100 rounded-2xl p-1.5 mb-7">
              <Pressable
                className={`flex-1 py-3.5 rounded-xl items-center ${isLogin ? "bg-white" : ""}`}
                style={isLogin ? TAB_SHADOW : undefined}
                onPress={switchToLogin}
                accessibilityLabel="Switch to Sign In"
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
                accessibilityLabel="Switch to Register"
              >
                <Text
                  className={`text-sm font-bold ${!isLogin ? "text-green-900" : "text-gray-400"}`}
                >
                  Register
                </Text>
              </Pressable>
            </View>

            {/* Fields */}
            <View className="gap-y-5">
              {/* Full Name */}
              {!isLogin && (
                <View>
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Full Name
                  </Text>
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${
                      focusedField === "name"
                        ? "bg-green-50 border-green-600"
                        : "bg-gray-50 border-gray-200"
                    }`}
                    style={{ paddingVertical: 16 }}
                    placeholder="e.g. Juan dela Cruz"
                    placeholderTextColor="#d1d5db"
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    autoCapitalize="words"
                    returnKeyType="next"
                    accessibilityLabel="Full name"
                  />
                </View>
              )}

              {/* Email */}
              <View>
                <Text className="text-gray-700 text-sm font-bold mb-2">
                  Email Address
                </Text>
                <TextInput
                  className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${
                    focusedField === "email"
                      ? "bg-green-50 border-green-600"
                      : "bg-gray-50 border-gray-200"
                  }`}
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
                  accessibilityLabel="Email address"
                />
              </View>

              {/* Password */}
              <View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-gray-700 text-sm font-bold">
                    Password
                  </Text>
                  {isLogin && (
                    <Pressable accessibilityLabel="Forgot password">
                      <Text className="text-green-800 text-sm font-semibold">
                        Forgot password?
                      </Text>
                    </Pressable>
                  )}
                </View>
                <View className="relative">
                  <TextInput
                    className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${
                      focusedField === "password"
                        ? "bg-green-50 border-green-600"
                        : "bg-gray-50 border-gray-200"
                    }`}
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
                    accessibilityLabel="Password"
                  />
                  <Pressable
                    className="absolute right-4 top-0 bottom-0 justify-center items-center w-10"
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
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

              {/* Confirm Password */}
              {!isLogin && (
                <View>
                  <Text className="text-gray-700 text-sm font-bold mb-2">
                    Confirm Password
                  </Text>
                  <View className="relative">
                    <TextInput
                      className={`w-full px-5 text-base text-gray-900 rounded-2xl border ${
                        focusedField === "confirm"
                          ? "bg-green-50 border-green-600"
                          : "bg-gray-50 border-gray-200"
                      }`}
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
                      accessibilityLabel="Confirm password"
                    />
                    <Pressable
                      className="absolute right-4 top-0 bottom-0 justify-center items-center w-10"
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      accessibilityLabel={
                        showConfirmPassword ? "Hide password" : "Show password"
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

            {/* CTA Button */}
            <Pressable
              className="w-full bg-green-900 py-5 rounded-2xl mt-8 flex-row items-center justify-center gap-2 active:bg-green-800"
              onPress={() => {}}
              accessibilityLabel={isLogin ? "Sign in" : "Create account"}
            >
              <Text className="text-white text-base font-extrabold tracking-wide">
                {isLogin ? "Sign In" : "Create Account"}
              </Text>
              <ChevronRight size={20} color="#ffffff" strokeWidth={2.5} />
            </Pressable>

            {/* Terms */}
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

            {/* Help Banner */}
            <View className="flex-row items-center justify-center mt-6 bg-green-50 rounded-2xl py-4 px-5 border border-green-100 gap-2">
              <Phone size={16} color="#166534" strokeWidth={2} />
              <Text className="text-green-900 text-sm font-semibold">
                Need help? PDAO Hotline:{" "}
                <Text className="underline">(123) 456-7890</Text>
              </Text>
            </View>

            {/* Footer */}
            <Text className="text-center text-gray-300 text-xs mt-5 tracking-wide">
              PDAO-RAM v1.0 · Secured by PhilSys
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// app/face-verification-web.tsx
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ChevronLeft, RefreshCw } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const NEXTJS_URL =
  process.env.EXPO_PUBLIC_NEXTJS_URL || "http://192.168.1.248:3000";

export default function FaceVerificationWebScreen() {
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();
  const [jwtToken, setJwtToken] = useState<string | null>(null);

  // Get JWT token from secure storage
  useEffect(() => {
    const getToken = async () => {
      const token = await SecureStore.getItemAsync("jwt_access_token");
      setJwtToken(token);
    };
    getToken();
  }, []);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "VERIFICATION_COMPLETE") {
        // Navigate back with result
        router.push({
          pathname: "/scan-id",
          params: { verificationResult: JSON.stringify(data.result) },
        });
      }

      if (data.type === "ERROR") {
        Alert.alert("Verification Error", data.message);
      }

      if (data.type === "CLOSE") {
        router.back();
      }

      if (data.type === "WEBVIEW_READY") {
        console.log("WebView is ready");
      }
    } catch (error) {
      console.error("Failed to parse message:", error);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    webviewRef.current?.reload();
  };

  // Inject JWT token and user info into the webview
  const injectedJavaScript = `
    (function() {
      // Store user info in localStorage for Next.js to use
      if (${JSON.stringify(jwtToken)}) {
        localStorage.setItem('express_jwt_token', ${JSON.stringify(jwtToken)});
      }

      if (${JSON.stringify(user)}) {
        localStorage.setItem('express_user', ${JSON.stringify(user)});
      }

      // Notify React Native that webview is ready
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'WEBVIEW_READY',
        timestamp: new Date().toISOString()
      }));

      // Listen for verification results
      window.addEventListener('verificationComplete', function(event) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'VERIFICATION_COMPLETE',
          result: event.detail
        }));
      });

      window.addEventListener('verificationError', function(event) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ERROR',
          message: event.detail
        }));
      });

      // Override fetch to add JWT token to requests
      const originalFetch = window.fetch;
      window.fetch = function(url, options = {}) {
        if (typeof url === 'string' && url.includes('/api/')) {
          options.headers = options.headers || {};
          options.headers['Authorization'] = 'Bearer ' + ${JSON.stringify(jwtToken)};
        }
        return originalFetch(url, options);
      };
    })();
  `;

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
          <Pressable onPress={() => router.back()} className="p-2">
            <ChevronLeft size={24} color="#111827" />
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900">
            Face Verification
          </Text>
          <Pressable onPress={handleRetry} className="p-2">
            <RefreshCw size={20} color="#6B7280" />
          </Pressable>
        </View>

        <View className="flex-1 justify-center items-center px-5">
          <Text className="text-lg font-semibold text-red-600 mb-2">
            Failed to load verification page
          </Text>
          <Text className="text-sm text-gray-500 text-center mb-5">
            {error}
          </Text>
          <Pressable
            className="bg-green-700 px-6 py-3 rounded-lg"
            onPress={handleRetry}
          >
            <Text className="text-white font-semibold text-base">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <Pressable onPress={() => router.back()} className="p-2">
          <ChevronLeft size={24} color="#111827" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900">
          Face Verification
        </Text>
        <Pressable onPress={handleRetry} className="p-2">
          <RefreshCw size={20} color="#6B7280" />
        </Pressable>
      </View>

      {loading && (
        <View className="absolute inset-0 justify-center items-center bg-white z-10">
          <ActivityIndicator size="large" color="#166534" />
          <Text className="mt-3 text-sm text-gray-500">
            Loading verification system...
          </Text>
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ uri: `${NEXTJS_URL}/mobile-verify` }}
        onMessage={handleMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(nativeEvent.description);
          setLoading(false);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(`HTTP Error ${nativeEvent.statusCode}`);
          setLoading(false);
        }}
        injectedJavaScript={injectedJavaScript}
        injectedJavaScriptBeforeContentLoaded={`
          // Polyfill for React Native WebView
          window.ReactNativeWebView = window.ReactNativeWebView || {
            postMessage: function(message) {
              window.postMessage(message);
            }
          };
        `}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View className="absolute inset-0 justify-center items-center bg-white">
            <ActivityIndicator size="large" color="#166534" />
          </View>
        )}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        cacheEnabled={false}
        // iOS specific props
        allowsBackForwardNavigationGestures={true}
        // Android specific props
        mixedContentMode="always"
        geolocationEnabled={false}
      />
    </SafeAreaView>
  );
}

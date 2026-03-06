// stores/auth.ts
import api, {
  BASE_URL,
  JWT_ACCESS_TOKEN_KEY,
  JWT_REFRESH_TOKEN_KEY,
} from "@/lib/api";
import {
  AuthContextValue,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from "@/types/auth";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";

export function useAuthStore(): AuthContextValue {
  const userRef = useRef<AuthUser | null>(null);
  const [user, _setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const initialLoadDone = useRef(false);
  const isLoggingOut = useRef(false);
  const isInitializing = useRef(true);

  const setUser = (u: AuthUser | null) => {
    console.log("Setting user:", u ? u.email : null);
    userRef.current = u;
    _setUser(u);
  };

  const validateAndRefreshToken = useCallback(async (): Promise<boolean> => {
    // Don't validate if we're in the process of logging out
    if (isLoggingOut.current) {
      console.log("Skipping validation during logout");
      return false;
    }

    console.log("Validating token...");
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(
        JWT_REFRESH_TOKEN_KEY,
      );

      console.log("Token check:", {
        hasToken: !!token,
        hasRefreshToken: !!refreshToken,
      });

      if (!token || !refreshToken) {
        console.log("No tokens found");
        return false;
      }

      try {
        console.log("Making /auth/me request with token");
        const res = await api.get("/auth/me");
        console.log("/auth/me response:", res.data);

        if (res.data.user) {
          console.log("User data received:", res.data.user.email);
          setUser(res.data.user);
          return true;
        }
        console.log("No user data in response");
        return false;
      } catch (err: any) {
        console.log("Failed to get user data:", err.message);
        if (err.response) {
          console.log(
            "Error response:",
            err.response.status,
            err.response.data,
          );
        }
        return false;
      }
    } catch (err) {
      console.error("Error validating token:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      if (initialLoadDone.current) {
        console.log("Auth already initialized");
        return;
      }
      console.log("Initializing auth...");
      setIsLoading(true);
      isInitializing.current = true;
      try {
        const isValid = await validateAndRefreshToken();
        console.log("Token validation result:", isValid);
        if (!isValid) {
          console.log("No valid token, setting user to null");
          setUser(null);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        setUser(null);
      } finally {
        console.log("Auth initialization complete");
        setIsLoading(false);
        initialLoadDone.current = true;
        isInitializing.current = false;
      }
    };

    initializeAuth();

    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        console.log("App state changed:", {
          from: appState.current,
          to: nextAppState,
        });

        // Skip validation during initialization
        if (isInitializing.current) {
          console.log("Skipping validation during initialization");
          appState.current = nextAppState;
          return;
        }

        // Only validate when coming from background to active
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          console.log("App came to foreground, revalidating token");
          const isValid = await validateAndRefreshToken();
          if (!isValid && userRef.current) {
            console.log(
              "Token invalid after app resume, but user exists - not logging out automatically",
            );
            // Don't automatically set user to null here
            // Let the token refresh mechanism handle it
          }
        }
        appState.current = nextAppState;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [validateAndRefreshToken]);

  const login = useCallback(async (payload: LoginPayload) => {
    console.log("Login attempt for:", payload.email);
    setIsSubmitting(true);
    setError(null);
    isLoggingOut.current = false;
    try {
      const res = await api.post("/auth/login", payload);
      console.log("Login response:", res.data);

      if (!res.data.access_token || !res.data.refresh_token || !res.data.user) {
        console.error("Invalid login response structure");
        throw new Error("Invalid response from server");
      }

      console.log("Saving tokens to SecureStore");
      await SecureStore.setItemAsync(
        JWT_ACCESS_TOKEN_KEY,
        res.data.access_token,
      );
      await SecureStore.setItemAsync(
        JWT_REFRESH_TOKEN_KEY,
        res.data.refresh_token,
      );
      console.log("Tokens saved, setting user");
      setUser(res.data.user);
      console.log("Login successful for:", res.data.user.email);
    } catch (err: any) {
      console.error("Login error:", err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Login failed. Please check your credentials.";
      setError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    console.log("Register attempt for:", payload.email);
    setIsSubmitting(true);
    setError(null);
    isLoggingOut.current = false;
    try {
      const res = await api.post("/auth/register", payload);
      console.log("Register response:", res.data);

      if (!res.data.access_token || !res.data.refresh_token || !res.data.user) {
        console.error("Invalid register response structure");
        throw new Error("Invalid response from server");
      }

      console.log("Saving tokens to SecureStore");
      await SecureStore.setItemAsync(
        JWT_ACCESS_TOKEN_KEY,
        res.data.access_token,
      );
      await SecureStore.setItemAsync(
        JWT_REFRESH_TOKEN_KEY,
        res.data.refresh_token,
      );
      console.log("Tokens saved, setting user");
      setUser(res.data.user);
      console.log("Registration successful for:", res.data.user.email);
    } catch (err: any) {
      console.error("Registration error:", err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Registration failed. Please try again.";
      setError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const performLogout = async () => {
    console.log("Performing logout");
    isLoggingOut.current = true;
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      if (token) {
        console.log("Notifying server about logout");
        fetch(`${BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        })
          .then(() => console.log("Server logout successful"))
          .catch(() => {
            console.log("Server logout failed, continuing with local logout");
          });
      }
    } catch (err) {
      console.log("Logout request error:", err);
    } finally {
      console.log("Clearing tokens");
      await SecureStore.deleteItemAsync(JWT_ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(JWT_REFRESH_TOKEN_KEY);
      delete api.defaults.headers.common.Authorization;

      console.log("Setting user to null");
      setUser(null);
      setIsSubmitting(false);

      // Reset logout flag after a delay
      setTimeout(() => {
        isLoggingOut.current = false;
      }, 500);

      await new Promise((resolve) => setTimeout(resolve, 50));
      console.log("Logout complete");
    }
  };

  const logout = useCallback(async () => {
    console.log("LOGOUT FUNCTION CALLED");
    return new Promise<void>((resolve) => {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(),
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            console.log("User confirmed logout in alert");
            setIsSubmitting(true);
            await performLogout();
            resolve();
          },
        },
      ]);
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    user,
    isLoading,
    isSubmitting,
    error,
    login,
    register,
    logout,
    clearError,
  };
}

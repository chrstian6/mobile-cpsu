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
import axios from "axios";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

export function useAuthStore(): AuthContextValue {
  const userRef = useRef<AuthUser | null>(null);
  const [user, _setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const initialLoadDone = useRef(false);

  const setUser = (u: AuthUser | null) => {
    userRef.current = u;
    _setUser(u);
  };

  // Function to validate and refresh token if needed
  const validateAndRefreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      const refreshToken = await SecureStore.getItemAsync(
        JWT_REFRESH_TOKEN_KEY,
      );

      // If no tokens at all, user is not authenticated
      if (!token || !refreshToken) {
        return false;
      }

      // Try to get user data with current token
      try {
        const res = await api.get("/auth/me");
        if (res.data.user) {
          setUser(res.data.user);
          return true;
        }
        return false;
      } catch (error: any) {
        // If token is expired (401), try to refresh
        if (error.response?.status === 401) {
          try {
            const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
              refresh_token: refreshToken,
            });

            if (data.access_token) {
              // Store new tokens
              await SecureStore.setItemAsync(
                JWT_ACCESS_TOKEN_KEY,
                data.access_token,
              );
              if (data.refresh_token) {
                await SecureStore.setItemAsync(
                  JWT_REFRESH_TOKEN_KEY,
                  data.refresh_token,
                );
              }

              // Get user data with new token
              const userRes = await api.get("/auth/me");
              if (userRes.data.user) {
                setUser(userRes.data.user);
                return true;
              }
            }
          } catch (refreshError) {
            console.log("Token refresh failed:", refreshError);
            // If refresh fails, clear tokens
            await SecureStore.deleteItemAsync(JWT_ACCESS_TOKEN_KEY);
            await SecureStore.deleteItemAsync(JWT_REFRESH_TOKEN_KEY);
          }
        }
        return false;
      }
    } catch (error) {
      console.error("Error validating token:", error);
      return false;
    }
  }, []);

  // Load user on mount
  useEffect(() => {
    const initializeAuth = async () => {
      if (initialLoadDone.current) return;

      setIsLoading(true);
      try {
        const isValid = await validateAndRefreshToken();
        if (!isValid) {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
        initialLoadDone.current = true;
      }
    };

    initializeAuth();

    // Handle app state changes (background/foreground)
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          // App has come to the foreground, validate session silently
          const isValid = await validateAndRefreshToken();
          if (!isValid) {
            setUser(null);
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
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/auth/login", payload);

      if (!res.data.access_token || !res.data.refresh_token || !res.data.user) {
        throw new Error("Invalid response from server");
      }

      // Store tokens securely
      await SecureStore.setItemAsync(
        JWT_ACCESS_TOKEN_KEY,
        res.data.access_token,
      );
      await SecureStore.setItemAsync(
        JWT_REFRESH_TOKEN_KEY,
        res.data.refresh_token,
      );

      setUser(res.data.user);

      // Navigate to tabs after successful login
      // Use setTimeout to ensure state is updated
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 100);
    } catch (err: any) {
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
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/auth/register", payload);

      if (!res.data.access_token || !res.data.refresh_token || !res.data.user) {
        throw new Error("Invalid response from server");
      }

      // Store tokens securely
      await SecureStore.setItemAsync(
        JWT_ACCESS_TOKEN_KEY,
        res.data.access_token,
      );
      await SecureStore.setItemAsync(
        JWT_REFRESH_TOKEN_KEY,
        res.data.refresh_token,
      );

      setUser(res.data.user);

      // Navigate to tabs after successful registration
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 100);
    } catch (err: any) {
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

  const logout = useCallback(async () => {
    try {
      // Attempt to notify server (optional)
      await api.post("/auth/logout").catch(() => {});
    } finally {
      // Clear tokens regardless of server response
      await SecureStore.deleteItemAsync(JWT_ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(JWT_REFRESH_TOKEN_KEY);
      setUser(null);

      // Navigate to auth page
      router.replace("/");
    }
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

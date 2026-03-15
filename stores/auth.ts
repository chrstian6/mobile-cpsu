// stores/auth.ts
import api, {
  BASE_URL,
  JWT_ACCESS_TOKEN_KEY,
  JWT_REFRESH_TOKEN_KEY,
} from "@/lib/api";
import { AuthUser, LoginPayload, RegisterPayload } from "@/types/auth";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  sessionExpired: boolean;

  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  loadUser: () => Promise<void>;
  checkAppState: (nextState: AppStateStatus) => Promise<void>;
  refreshToken: () => Promise<boolean>;
  handleTokenExpired: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isSubmitting: false,
      error: null,
      sessionExpired: false,

      refreshToken: async () => {
        try {
          const refreshToken = await SecureStore.getItemAsync(
            JWT_REFRESH_TOKEN_KEY,
          );
          if (!refreshToken) {
            return false;
          }

          const response = await fetch(`${BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (!response.ok) {
            throw new Error("Failed to refresh token");
          }

          const data = await response.json();

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

          // Update api default header
          api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;

          return true;
        } catch (error) {
          console.error("Token refresh failed:", error);
          return false;
        }
      },

      handleTokenExpired: async () => {
        // Try to refresh token first
        const refreshed = await get().refreshToken();

        if (refreshed) {
          // Token refreshed successfully, reload user
          await get().loadUser();
        } else {
          // Refresh failed, log out
          await SecureStore.deleteItemAsync(JWT_ACCESS_TOKEN_KEY);
          await SecureStore.deleteItemAsync(JWT_REFRESH_TOKEN_KEY);
          delete api.defaults.headers.common.Authorization;
          set({ user: null, isLoading: false, sessionExpired: true });

          // Optional: Show alert that session expired
          Alert.alert(
            "Session Expired",
            "Your session has expired. Please log in again.",
            [{ text: "OK" }],
          );
        }
      },

      loadUser: async () => {
        try {
          const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
          if (!token) {
            set({ isLoading: false, sessionExpired: false });
            return;
          }

          // Set token in api headers
          api.defaults.headers.common.Authorization = `Bearer ${token}`;

          try {
            const res = await api.get("/auth/me");
            if (res.data.user) {
              set({
                user: res.data.user,
                isLoading: false,
                sessionExpired: false,
              });
            } else {
              set({ user: null, isLoading: false });
            }
          } catch (error: any) {
            // Check if it's a token expiration error
            if (error.response?.status === 401) {
              const errorMsg = error.response?.data?.message || "";
              if (errorMsg.toLowerCase().includes("token expired")) {
                await get().handleTokenExpired();
                return;
              }
            }
            throw error;
          }
        } catch (error) {
          console.error("Failed to load user:", error);
          set({ user: null, isLoading: false });
        }
      },

      checkAppState: async (nextState: AppStateStatus) => {
        const currentState = AppState.currentState;
        if (
          currentState.match(/inactive|background/) &&
          nextState === "active"
        ) {
          try {
            const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
            if (!token) {
              set({ user: null });
              return;
            }

            api.defaults.headers.common.Authorization = `Bearer ${token}`;

            try {
              const res = await api.get("/auth/me");
              if (res.data.user) {
                set({ user: res.data.user });
              } else {
                set({ user: null });
              }
            } catch (error: any) {
              if (error.response?.status === 401) {
                const errorMsg = error.response?.data?.message || "";
                if (errorMsg.toLowerCase().includes("token expired")) {
                  await get().handleTokenExpired();
                  return;
                }
              }
              set({ user: null });
            }
          } catch {
            set({ user: null });
          }
        }
      },

      login: async (payload: LoginPayload) => {
        set({ isSubmitting: true, error: null, sessionExpired: false });
        try {
          const res = await api.post("/auth/login", payload);
          await SecureStore.setItemAsync(
            JWT_ACCESS_TOKEN_KEY,
            res.data.access_token,
          );
          await SecureStore.setItemAsync(
            JWT_REFRESH_TOKEN_KEY,
            res.data.refresh_token,
          );

          // Set token in api headers
          api.defaults.headers.common.Authorization = `Bearer ${res.data.access_token}`;

          set({ user: res.data.user, isSubmitting: false });
        } catch (err: any) {
          const msg =
            err.response?.data?.message ||
            err.response?.data?.error ||
            "Login failed.";
          set({ error: msg, isSubmitting: false });
          throw new Error(msg);
        }
      },

      register: async (payload: RegisterPayload) => {
        set({ isSubmitting: true, error: null, sessionExpired: false });
        try {
          const res = await api.post("/auth/register", payload);
          await SecureStore.setItemAsync(
            JWT_ACCESS_TOKEN_KEY,
            res.data.access_token,
          );
          await SecureStore.setItemAsync(
            JWT_REFRESH_TOKEN_KEY,
            res.data.refresh_token,
          );

          // Set token in api headers
          api.defaults.headers.common.Authorization = `Bearer ${res.data.access_token}`;

          set({ user: res.data.user, isSubmitting: false });
        } catch (err: any) {
          const msg =
            err.response?.data?.message ||
            err.response?.data?.error ||
            "Registration failed.";
          set({ error: msg, isSubmitting: false });
          throw new Error(msg);
        }
      },

      logout: async () => {
        return new Promise((resolve) => {
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
                try {
                  await SecureStore.deleteItemAsync(JWT_ACCESS_TOKEN_KEY);
                  await SecureStore.deleteItemAsync(JWT_REFRESH_TOKEN_KEY);
                  delete api.defaults.headers.common.Authorization;

                  // Call logout endpoint (optional)
                  fetch(`${BASE_URL}/auth/logout`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  }).catch(() => {});

                  set({ user: null, isLoading: false, sessionExpired: false });
                } catch (error) {
                  console.error("Logout error:", error);
                  set({ user: null, isLoading: false, sessionExpired: false });
                } finally {
                  resolve();
                }
              },
            },
          ]);
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          const value = await SecureStore.getItemAsync(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await SecureStore.setItemAsync(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await SecureStore.deleteItemAsync(name);
        },
      })),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);

export function useAppStateListener() {
  const checkAppState = useAuthStore((state) => state.checkAppState);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", checkAppState);
    return () => subscription.remove();
  }, [checkAppState]);
}

export function useInitialLoad() {
  const loadUser = useAuthStore((state) => state.loadUser);
  useEffect(() => {
    loadUser();
  }, [loadUser]);
}

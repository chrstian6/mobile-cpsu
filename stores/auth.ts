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

  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  loadUser: () => Promise<void>;
  checkAppState: (nextState: AppStateStatus) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isSubmitting: false,
      error: null,

      loadUser: async () => {
        try {
          const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
          if (!token) {
            set({ isLoading: false });
            return;
          }
          const res = await api.get("/auth/me");
          if (res.data.user) {
            set({ user: res.data.user, isLoading: false });
          } else {
            set({ user: null, isLoading: false });
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
            const res = await api.get("/auth/me");
            if (res.data.user) {
              set({ user: res.data.user });
            } else {
              set({ user: null });
            }
          } catch {
            set({ user: null });
          }
        }
      },

      login: async (payload: LoginPayload) => {
        set({ isSubmitting: true, error: null });
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
          set({ user: res.data.user, isSubmitting: false });
        } catch (err: any) {
          const msg =
            err.response?.data?.message ||
            err.response?.data?.error ||
            "Login failed.";
          set({ error: msg, isSubmitting: false });
          throw err;
        }
      },

      register: async (payload: RegisterPayload) => {
        set({ isSubmitting: true, error: null });
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
          set({ user: res.data.user, isSubmitting: false });
        } catch (err: any) {
          const msg =
            err.response?.data?.message ||
            err.response?.data?.error ||
            "Registration failed.";
          set({ error: msg, isSubmitting: false });
          throw err;
        }
      },

      // Logout does NOT call router here.
      // Navigation is handled by the useEffect in _layout.tsx
      // reacting to user becoming null.
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

                  // Fire-and-forget server logout
                  fetch(`${BASE_URL}/auth/logout`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  }).catch(() => {});

                  // Setting user null triggers _layout.tsx useEffect → router.replace
                  set({ user: null, isLoading: false });
                } catch (error) {
                  console.error("Logout error:", error);
                  set({ user: null, isLoading: false });
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

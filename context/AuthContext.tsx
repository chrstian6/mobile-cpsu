// context/AuthContext.tsx
import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_verified: boolean;
  contact_number?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync("user");

      if (token && userJson) {
        setUser(JSON.parse(userJson));
      }
    } catch (error) {
      console.error("Failed to load user", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData: User, token: string) => {
    try {
      await SecureStore.setItemAsync(JWT_ACCESS_TOKEN_KEY, token);
      await SecureStore.setItemAsync("user", JSON.stringify(userData));
      setUser(userData);
      // Use setTimeout to ensure state is updated before navigation
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 100);
    } catch (error) {
      console.error("Failed to save user", error);
    }
  };

  const logout = async () => {
    try {
      // Clear secure storage first
      await SecureStore.deleteItemAsync(JWT_ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync("user");

      // Then clear user state
      setUser(null);

      // Finally navigate to login
      // Use setTimeout to ensure state is cleared before navigation
      setTimeout(() => {
        router.replace("/");
      }, 100);
    } catch (error) {
      console.error("Failed to logout", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

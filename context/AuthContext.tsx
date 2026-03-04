import { useAuthStore } from "@/stores/auth";
import { AuthContextValue } from "@/types/auth";
import React, { useContext } from "react";

const Ctx = React.createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const store = useAuthStore();
  return <Ctx.Provider value={store}>{props.children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

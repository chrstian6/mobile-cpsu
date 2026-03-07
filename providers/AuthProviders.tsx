// providers/AuthProviders.tsx
import { useAppStateListener, useInitialLoad } from "@/stores/auth";
import { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize app state listener
  useAppStateListener();

  // Load user on mount
  useInitialLoad();

  // Don't block rendering — _layout handles the loading spinner + redirect logic
  return <>{children}</>;
}

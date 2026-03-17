// lib/activities.ts
// Shared activity types, helpers, and fetcher used by both
// app/(tabs)/index.tsx and app/screens/recent-activities.tsx

import { JWT_ACCESS_TOKEN_KEY } from "@/lib/api";
import * as SecureStore from "expo-secure-store";

const EXPRESS_API_BASE =
  process.env.EXPO_PUBLIC_EXPRESS_URL || "http://192.168.1.194:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivityKind =
  | "application"
  | "cash_assistance"
  | "card"
  | "device_request";

export interface RecentActivity {
  id: string;
  kind: ActivityKind;
  label: string; // "PWD Application", "Cash Assistance", etc.
  sublabel: string; // form_id / request_id / card_id
  status: string;
  date: string; // ISO string — used for sorting
  route?: string; // navigation target on tap
}

// ── Status dot color map ──────────────────────────────────────────────────────

export const STATUS_DOT: Record<string, string> = {
  // green — success / active
  Active: "bg-emerald-500",
  Approved: "bg-emerald-500",
  Completed: "bg-emerald-500",
  Verified: "bg-emerald-500",
  // blue — in progress
  Submitted: "bg-blue-400",
  "In Queue": "bg-blue-400",
  "Under Review": "bg-blue-400",
  Processing: "bg-blue-400",
  "Ready for Pickup": "bg-blue-400",
  // amber — waiting / partial
  Pending: "bg-amber-400",
  "Partially Approved": "bg-amber-400",
  Draft: "bg-amber-400",
  // red — closed / failed
  Rejected: "bg-red-400",
  Cancelled: "bg-red-400",
  Expired: "bg-red-400",
  Revoked: "bg-red-400",
  Suspended: "bg-red-400",
};

export const getDotColor = (status: string) =>
  STATUS_DOT[status] ?? "bg-gray-300";

// ── Kind config ───────────────────────────────────────────────────────────────

export interface KindConfig {
  iconName: string; // we pass the icon component from the consumer
  iconColor: string;
  iconBg: string;
  label: string;
  sectionTitle: string;
}

export const KIND_META: Record<ActivityKind, KindConfig> = {
  application: {
    iconName: "FileText",
    iconColor: "#2563EB",
    iconBg: "bg-blue-50",
    label: "PWD Application",
    sectionTitle: "Applications",
  },
  cash_assistance: {
    iconName: "PhilippinePeso",
    iconColor: "#059669",
    iconBg: "bg-emerald-50",
    label: "Cash Assistance",
    sectionTitle: "Cash Assistance",
  },
  card: {
    iconName: "CreditCard",
    iconColor: "#7C3AED",
    iconBg: "bg-purple-50",
    label: "PWD ID Card",
    sectionTitle: "ID Card",
  },
  device_request: {
    iconName: "Package",
    iconColor: "#EA580C",
    iconBg: "bg-orange-50",
    label: "Device Request",
    sectionTitle: "Device Requests",
  },
};

// ── Time formatter ────────────────────────────────────────────────────────────

export const formatTimeAgo = (dateStr: string): string => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ── Core fetcher ──────────────────────────────────────────────────────────────
// Fetches all four data sources in parallel and returns a unified,
// date-sorted list. Pass `limit` to cap the result (undefined = all).

export const fetchAllActivities = async (
  limit?: number,
): Promise<RecentActivity[]> => {
  const token = await SecureStore.getItemAsync(JWT_ACCESS_TOKEN_KEY);
  if (!token) return [];

  const headers = { Authorization: `Bearer ${token}` };

  const [appsRes, cashRes, cardsRes, devicesRes] = await Promise.allSettled([
    fetch(`${EXPRESS_API_BASE}/api/applications/me`, { headers }),
    fetch(`${EXPRESS_API_BASE}/api/cash-assistance/me`, { headers }),
    fetch(`${EXPRESS_API_BASE}/api/cards/me`, { headers }),
    fetch(`${EXPRESS_API_BASE}/api/requests/me`, { headers }),
  ]);

  const combined: RecentActivity[] = [];

  // ── PWD Applications ──────────────────────────────────────────────────
  if (appsRes.status === "fulfilled" && appsRes.value.ok) {
    const data = await appsRes.value.json();
    const apps: any[] = data.applications ?? [];
    apps.forEach((a) =>
      combined.push({
        id: `app-${a._id}`,
        kind: "application",
        label: "PWD Application",
        sublabel: a.application_id,
        status: a.status,
        date: a.updated_at ?? a.created_at,
        route: "/screens/application",
      }),
    );
  }

  // ── Cash Assistance ───────────────────────────────────────────────────
  if (cashRes.status === "fulfilled" && cashRes.value.ok) {
    const data = await cashRes.value.json();
    const reqs: any[] = data.cash_assistance ?? [];
    reqs.forEach((r) =>
      combined.push({
        id: `cash-${r._id}`,
        kind: "cash_assistance",
        label: "Cash Assistance",
        sublabel: r.form_id,
        status: r.status,
        date: r.updated_at ?? r.created_at,
        route: "/screens/financial-assistance",
      }),
    );
  }

  // ── PWD ID Card ───────────────────────────────────────────────────────
  if (cardsRes.status === "fulfilled" && cardsRes.value.ok) {
    const data = await cardsRes.value.json();
    const cards: any[] = data.cards ?? [];
    cards.forEach((c) =>
      combined.push({
        id: `card-${c._id}`,
        kind: "card",
        label: "PWD ID Card",
        sublabel: c.card_id ?? "Pending issuance",
        status: c.status,
        date: c.updated_at ?? c.created_at,
        route: "/(tabs)/id",
      }),
    );
  }

  // ── Device Requests ───────────────────────────────────────────────────
  if (devicesRes.status === "fulfilled" && devicesRes.value.ok) {
    const data = await devicesRes.value.json();
    const requests: any[] = data.requests ?? [];
    requests.forEach((r) =>
      combined.push({
        id: `device-${r._id}`,
        kind: "device_request",
        label: "Device Request",
        sublabel: r.request_id,
        status: r.status,
        date: r.updated_at ?? r.created_at,
        route: "/screens/device-request-status",
      }),
    );
  }

  // Sort newest first
  combined.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return limit ? combined.slice(0, limit) : combined;
};

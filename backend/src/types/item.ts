// backend/src/types/item.ts
export interface IItem {
  item_id?: string;
  item_image_url?: string | null;
  item_name: string;
  item_description?: string;
  category: string;
  stock: number;
  pending_requests?: number;
  reserved_stock?: number;
  unit: string;
  status?: string;
  location?: string;
  expiry_date?: string | null;
  is_medical?: boolean;
  requires_prescription?: boolean;
  requires_med_cert?: boolean;
  requires_brgy_cert?: boolean;
  is_consumable?: boolean;
  needs_fitting?: boolean;
  size?: string | null;
  brand?: string | null;
  total_distributed?: number;
  last_distribution_date?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

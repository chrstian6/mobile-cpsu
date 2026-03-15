// backend/src/types/request.ts
export interface IRequestItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  requires_prescription?: boolean;
  prescription_image_url?: string | null;
  prescription_verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  notes?: string | null;
}

export interface IApprovedItem {
  item_id: string;
  quantity_approved: number;
}

export interface IRejectedItem {
  item_id: string;
  reason: string;
}

export interface IRequest {
  request_id?: string;
  requester_id: string;
  requester_name: string;
  requester_barangay: string;
  requester_contact?: string;
  items: IRequestItem[];
  purpose?: string;
  queue_number?: number;
  queue_position?: number;
  estimated_wait_time?: number;
  status: string;
  priority?: string;
  is_emergency?: boolean;
  emergency_notes?: string;
  has_prescription?: boolean;
  prescription_images?: string[];
  approved_items?: IApprovedItem[];
  rejected_items?: IRejectedItem[];
  rejection_reason?: string;
  processed_by?: string | null;
  processed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  distributed_by?: string | null;
  distributed_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

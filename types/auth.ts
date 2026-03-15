// types/auth.ts
export type AuthUser = {
  _id: string;
  user_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
  is_verified: boolean;
  is_email_verified: boolean;
  avatar_url: string | null;
  contact_number?: string;
  sex?: string;
  date_of_birth?: string;
  address?: {
    street?: string;
    barangay?: string;
    city_municipality?: string;
    province?: string;
    region?: string;
    zip_code?: string;
    country?: string;
    type?: string;
  };
  created_at?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  first_name: string;
  middle_name?: string; // Made optional
  last_name: string;
  suffix?: string; // Made optional
  sex: "Male" | "Female" | "Other";
  date_of_birth: string;
  contact_number: string;
  email: string;
  password: string;
  address?: {
    // Made optional
    street?: string;
    barangay?: string;
    city_municipality?: string;
    province?: string;
    region?: string;
    zip_code?: string;
    country?: string;
    type?: "Permanent" | "Temporary" | "Present";
  };
};

export type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

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
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  password: string;
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

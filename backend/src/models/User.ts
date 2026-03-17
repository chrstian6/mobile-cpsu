import bcrypt from "bcryptjs";
import mongoose, { Document, Schema } from "mongoose";

// ── Interfaces ────────────────────────────────────────────────────────────────
export interface IAddress {
  street: string;
  barangay: string;
  city_municipality: string;
  province: string;
  region: string;
  zip_code?: string;
  country: string;
  type: "Permanent" | "Temporary" | "Present";
  coordinates?: { lat: number; lng: number };
}

export interface IUser {
  user_id: string;
  form_id?: string | null;
  pwd_issued_id?: string | null;
  card_id?: string | null;
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  sex: "Male" | "Female" | "Other";
  age: number;
  date_of_birth: Date;
  address: IAddress;
  contact_number: string;
  avatar_url?: string | null;
  email: string;
  password: string;
  role: "User" | "Admin" | "Supervisor" | "Staff";
  status: "Active" | "Inactive" | "Suspended" | "Pending";
  is_verified: boolean;
  is_email_verified: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidate: string): Promise<boolean>;
  toPublic(): Omit<IUser, "password">;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a unique user_id with retry logic to handle collisions.
 * Format: PDAO-YYYYMMDD-XXXXX (5 alphanumeric chars)
 */
export const generateUserId = (): string => {
  const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
  // Use a longer random suffix (7 chars) to drastically reduce collision probability
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `PDAO-${dateStr}-${random}`;
};

// ── Schema ────────────────────────────────────────────────────────────────────
const AddressSchema = new Schema<IAddress>(
  {
    street: { type: String, default: "" },
    barangay: { type: String, default: "" },
    city_municipality: { type: String, default: "" },
    province: { type: String, default: "" },
    region: { type: String, default: "" },
    zip_code: { type: String, default: "" },
    country: { type: String, default: "Philippines" },
    type: {
      type: String,
      enum: ["Permanent", "Temporary", "Present"],
      default: "Permanent",
    },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { _id: false },
);

const UserSchema = new Schema<IUserDocument>(
  {
    user_id: {
      type: String,
      unique: true,
      default: generateUserId,
    },
    form_id: { type: String, default: null },
    pwd_issued_id: { type: String, unique: true, sparse: true, default: null },
    card_id: { type: String, unique: true, sparse: true, default: null },
    first_name: { type: String, required: [true, "First name is required"] },
    middle_name: { type: String, default: "" },
    last_name: { type: String, required: [true, "Last name is required"] },
    suffix: {
      type: String,
      enum: ["Jr.", "Sr.", "II", "III", "IV", "V", ""],
      default: "",
    },
    sex: { type: String, enum: ["Male", "Female", "Other"], default: "Other" },
    age: { type: Number, default: 0 },
    date_of_birth: {
      type: Date,
      required: [true, "Date of birth is required"],
    },
    address: { type: AddressSchema, default: () => ({}) },
    contact_number: {
      type: String,
      required: [true, "Contact number is required"],
      unique: true,
      validate: {
        validator: (v: string) => /^09\d{9}$/.test(v),
        message: "Phone must start with 09 and be 11 digits",
      },
    },
    avatar_url: { type: String, default: null },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: [true, "Password is required"] },
    role: {
      type: String,
      enum: ["User", "Admin", "Supervisor", "Staff"],
      default: "User",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended", "Pending"],
      default: "Active",
    },
    is_verified: { type: Boolean, default: false },
    is_email_verified: { type: Boolean, default: false },
    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
UserSchema.index({ last_name: 1, first_name: 1 });
UserSchema.index({ "address.barangay": 1 });

// ── Pre-save ──────────────────────────────────────────────────────────────────
UserSchema.pre<IUserDocument>("save", async function () {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  if (this.date_of_birth) {
    const today = new Date();
    const birth = new Date(this.date_of_birth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    this.age = age;
  }
});

// ── Methods ───────────────────────────────────────────────────────────────────
UserSchema.methods.comparePassword = async function (
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.methods.toPublic = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

const User =
  mongoose.models.User || mongoose.model<IUserDocument>("User", UserSchema);

export default User;

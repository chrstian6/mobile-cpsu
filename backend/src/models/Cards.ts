// backend/src/models/Cards.ts
import mongoose, { Document, Schema } from "mongoose";

// PWD ID card_id format assigned by admin: 00-0000-000-0000000
const CARD_ID_REGEX = /^\d{2}-\d{4}-\d{3}-\d{7}$/;

export interface ICard extends Document {
  card_id: string | null; // null until admin assigns the real PWD ID number
  user_id: string;
  name: string;
  barangay: string;
  type_of_disability: string;
  address: string;
  date_of_birth: Date;
  sex: string;
  blood_type: string;
  date_issued: Date;
  emergency_contact_name: string;
  emergency_contact_number: string;
  status: "Active" | "Expired" | "Revoked" | "Pending";
  face_image_url: string | null;
  face_descriptors: number[] | null;
  id_front_url: string | null;
  id_back_url: string | null;
  id_image_url: string | null;
  extracted_data: any | null;
  last_verified_at: Date | null;
  verification_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

const CardSchema = new Schema<ICard>(
  {
    // card_id is null on initial request.
    // Admin assigns the real PWD ID number in the format: 00-0000-000-0000000
    // sparse: true allows multiple null values without violating the unique constraint.
    card_id: {
      type: String,
      required: false,
      default: null,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
      validate: {
        validator: function (v: string | null) {
          // Allow null (pending admin assignment) or valid format
          if (v === null || v === undefined) return true;
          return CARD_ID_REGEX.test(v);
        },
        message:
          "Card ID must follow the format 00-0000-000-0000000 (assigned by admin)",
      },
    },
    user_id: {
      type: String,
      required: true,
      unique: true, // one card per user
      index: true,
    },
    name: { type: String, required: true, trim: true },
    barangay: { type: String, required: true, trim: true },
    type_of_disability: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    date_of_birth: { type: Date, required: true },
    sex: {
      type: String,
      required: true,
      enum: ["Male", "Female", "Other", "Not detected"],
    },
    blood_type: {
      type: String,
      required: true,
      enum: [
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
        "Unknown",
        "Not detected",
      ],
    },
    date_issued: { type: Date, required: true, default: Date.now },
    emergency_contact_name: { type: String, required: true, trim: true },
    emergency_contact_number: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Active", "Expired", "Revoked", "Pending"],
      default: "Pending",
      index: true,
    },
    face_image_url: { type: String, default: null },
    face_descriptors: { type: [Number], default: null },
    id_front_url: { type: String, default: null },
    id_back_url: { type: String, default: null },
    id_image_url: { type: String, default: null },
    extracted_data: { type: Schema.Types.Mixed, default: null },
    last_verified_at: { type: Date, default: null },
    verification_count: { type: Number, default: 0 },
    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

const Card = mongoose.models.Card || mongoose.model<ICard>("Card", CardSchema);

export default Card;

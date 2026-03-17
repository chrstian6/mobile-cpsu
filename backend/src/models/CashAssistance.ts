// backend/src/models/CashAssistance.ts
import mongoose, { Document, Schema } from "mongoose";
import { z } from "zod";

// ── Zod Schemas ───────────────────────────────────────────────────────────────

export const CashAssistanceStatusEnum = z.enum([
  "Submitted",
  "Under Review",
  "Approved",
  "Rejected",
  "Cancelled",
]);

export type CashAssistanceStatus = z.infer<typeof CashAssistanceStatusEnum>;

// Inbound POST body validation - MEDICAL CERTIFICATE IS REQUIRED, date_needed removed
export const CreateCashAssistanceSchema = z.object({
  purpose: z
    .string({ error: "Purpose is required." })
    .trim()
    .min(10, "Purpose must be at least 10 characters.")
    .max(1000, "Purpose must not exceed 1000 characters."),

  medical_certificate_base64: z
    .string({ error: "Medical certificate is required." })
    .min(1, "Medical certificate is required.")
    .refine(
      (val) => {
        return /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
          val,
        );
      },
      {
        message:
          "Medical certificate must be a valid base64 image (jpeg/jpg/png/webp).",
      },
    ),
});

export type CreateCashAssistanceInput = z.infer<
  typeof CreateCashAssistanceSchema
>;

// Admin status update validation
export const UpdateCashAssistanceStatusSchema = z.object({
  status: CashAssistanceStatusEnum,
});

export type UpdateCashAssistanceStatusInput = z.infer<
  typeof UpdateCashAssistanceStatusSchema
>;

// ── Mongoose Interface ────────────────────────────────────────────────────────

export interface ICashAssistance extends Document {
  form_id: string;
  user_id: string; // Store custom user_id (PDAO-...)
  purpose: string;
  medical_certificate_url: string;
  status: CashAssistanceStatus;
  created_at: Date;
  updated_at: Date;
}

// ── form_id generator ─────────────────────────────────────────────────────────

const generateFormId = (): string => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CA-${datePart}-${rand}`;
};

// ── Mongoose Schema ───────────────────────────────────────────────────────────

const CashAssistanceSchema = new Schema<ICashAssistance>(
  {
    form_id: {
      type: String,
      required: true,
      unique: true,
      default: generateFormId,
    },
    user_id: {
      type: String, // Store custom user_id as string
      required: true,
      index: true, // Add index for better query performance
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },
    medical_certificate_url: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Submitted", "Under Review", "Approved", "Rejected", "Cancelled"],
      default: "Submitted",
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

export const CashAssistance = mongoose.model<ICashAssistance>(
  "CashAssistance",
  CashAssistanceSchema,
);

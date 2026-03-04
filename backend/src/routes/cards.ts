// backend/src/routes/cards.ts
import { Response, Router } from "express";
import mongoose from "mongoose";
import { AuthRequest, requireAuth } from "../middleware/auth";

const router = Router();

// ── User model (minimal — just to look up user_id field) ──────────────────────
const UserSchema = new mongoose.Schema({ user_id: String }, { strict: false });
const User = mongoose.models.User || mongoose.model("User", UserSchema);

// ── Inline Card Schema ────────────────────────────────────────────────────────
const CardSchema = new mongoose.Schema(
  {
    card_id: {
      type: String,
      required: [true, "Card ID is required"],
      unique: true,
      index: true,
      match: [/^\d{2}-\d{4}-\d{3}-\d{7}$/, "Invalid Card ID format"],
    },
    user_id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    barangay: { type: String, required: true, trim: true },
    type_of_disability: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    date_of_birth: { type: Date, required: true },
    sex: { type: String, required: true, enum: ["Male", "Female", "Other"] },
    blood_type: {
      type: String,
      required: true,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
    },
    date_issued: { type: Date, required: true, default: Date.now },
    emergency_contact_name: { type: String, required: true, trim: true },
    emergency_contact_number: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Active", "Expired", "Revoked", "Pending"],
      default: "Active",
      index: true,
    },
    face_image_url: { type: String, default: null },
    face_descriptors: { type: [Number], default: null },
    id_image_url: { type: String, default: null },
    extracted_data: { type: mongoose.Schema.Types.Mixed, default: null },
    last_verified_at: { type: Date, default: null },
    verification_count: { type: Number, default: 0 },
    created_by: { type: String, default: null },
    updated_by: { type: String, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  },
);

const Card = mongoose.models.Card || mongoose.model("Card", CardSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────

const parseDate = (val: string | undefined): Date | null => {
  if (!val || val === "Not detected") return null;
  // MM/DD/YYYY
  const mmddyyyy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const normalizeDisability = (raw: string): string => {
  if (!raw || raw === "Not detected") return "Others";
  const r = raw.toLowerCase();
  if (r.includes("physical") || r.includes("orthopedic"))
    return "Physical Disability";
  if (r.includes("visual") || r.includes("blind")) return "Visual Impairment";
  if (r.includes("deaf") || r.includes("hearing")) return "Hearing Impairment";
  if (r.includes("speech") || r.includes("language"))
    return "Speech Impairment";
  if (r.includes("intellectual")) return "Intellectual Disability";
  if (r.includes("learning")) return "Learning Disability";
  if (r.includes("mental") || r.includes("psycho")) return "Mental Disability";
  if (r.includes("multiple")) return "Multiple Disabilities";
  return "Others";
};

const VALID_BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const normalizeBloodType = (raw: string): string => {
  if (!raw || raw === "Not detected") return "Unknown";
  const upper = raw.toUpperCase().trim();
  return VALID_BLOOD_TYPES.includes(upper) ? upper : "Unknown";
};

// ── POST /api/cards — Create a verified card ──────────────────────────────────
router.post(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const mongoId = req.userId;
      if (!mongoId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Resolve the custom user_id field (e.g. "PDAO-20260226-D069T")
      const userDoc = await User.findById(mongoId).select("user_id").lean();
      const userId = (userDoc as any)?.user_id || mongoId;

      const {
        card_id,
        name,
        barangay,
        type_of_disability,
        address,
        date_of_birth,
        sex,
        blood_type,
        date_issued,
        emergency_contact_name,
        emergency_contact_number,
        face_descriptors,
        match_score,
        distance,
        extracted_data,
      } = req.body;

      // ── Validate required fields ──────────────────────────────────────────────
      if (!card_id) {
        res.status(400).json({ error: "Card ID is required" });
        return;
      }
      if (!name || name === "Not detected") {
        res.status(400).json({ error: "Name could not be extracted from ID" });
        return;
      }

      // ── Check for duplicate ───────────────────────────────────────────────────
      const existing = await Card.findOne({ card_id });
      if (existing) {
        res.status(409).json({
          error: "Card already registered",
          message: `Card ID ${card_id} is already in the system.`,
        });
        return;
      }

      // ── Parse dates ───────────────────────────────────────────────────────────
      const parsedDob = parseDate(date_of_birth);
      const parsedDateIssued = parseDate(date_issued) ?? new Date();

      if (!parsedDob) {
        res.status(400).json({ error: "Invalid or missing date of birth" });
        return;
      }

      // ── Save card ─────────────────────────────────────────────────────────────
      const card = new Card({
        card_id,
        user_id: userId,
        name,
        barangay: barangay || "Not detected",
        type_of_disability: normalizeDisability(type_of_disability),
        address: address || "Not detected",
        date_of_birth: parsedDob,
        sex: sex || "Other",
        blood_type: normalizeBloodType(blood_type),
        date_issued: parsedDateIssued,
        emergency_contact_name: emergency_contact_name || "Not provided",
        emergency_contact_number: emergency_contact_number || "Not provided",
        status: "Active",
        face_descriptors: face_descriptors ?? null,
        extracted_data: extracted_data ?? null,
        last_verified_at: new Date(),
        verification_count: 1,
        created_by: userId,
      });

      await card.save();

      console.log(
        `✅ Card created: ${card_id} | user: ${userId} | match_score: ${match_score} | distance: ${distance}`,
      );

      res.status(201).json({
        success: true,
        message: "Card verified and registered successfully",
        card: {
          _id: card._id,
          card_id: card.card_id,
          name: card.name,
          barangay: card.barangay,
          type_of_disability: card.type_of_disability,
          address: card.address,
          date_of_birth: card.date_of_birth,
          sex: card.sex,
          blood_type: card.blood_type,
          date_issued: card.date_issued,
          emergency_contact_name: card.emergency_contact_name,
          emergency_contact_number: card.emergency_contact_number,
          status: card.status,
          last_verified_at: card.last_verified_at,
          created_at: card.created_at,
        },
      });
    } catch (err: any) {
      console.error("[POST /api/cards] Error:", err);
      if (err.code === 11000) {
        res.status(409).json({
          error: "Card already registered",
          message: "This Card ID already exists in the system.",
        });
        return;
      }
      res.status(500).json({
        error: err?.message ?? "Failed to create card",
        details:
          process.env.NODE_ENV === "development" ? err?.stack : undefined,
      });
    }
  },
);

// ── GET /api/cards/me — Current user's cards ──────────────────────────────────
router.get(
  "/me",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const mongoId = req.userId;
      if (!mongoId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const userDoc = await User.findById(mongoId).select("user_id").lean();
      const userId = (userDoc as any)?.user_id || mongoId;
      const cards = await Card.find({ user_id: userId }).sort({
        created_at: -1,
      });
      res.json({ success: true, cards });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "Failed to fetch cards" });
    }
  },
);

// ── GET /api/cards/:id — Single card ─────────────────────────────────────────
router.get(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const card = await Card.findById(req.params.id);
      if (!card) {
        res.status(404).json({ error: "Card not found" });
        return;
      }
      res.json({ success: true, card });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? "Failed to fetch card" });
    }
  },
);

export default router;

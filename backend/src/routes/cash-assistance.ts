// backend/src/routes/cashAssistance.ts
import { Response, Router } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { AuthRequest, requireAuth } from "../middleware/auth";
import {
  CashAssistance,
  CreateCashAssistanceSchema,
  UpdateCashAssistanceStatusSchema,
} from "../models/CashAssistance";
import { BUCKETS, uploadBase64ToSupabase } from "../utils/supabase";

const router = Router();

// ── Helper: format Zod errors into a clean array ──────────────────────────────
const formatZodErrors = (err: ZodError) =>
  err.issues.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));

// ── POST /api/cash-assistance ─────────────────────────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user_id = req.userId;
    if (!user_id || !mongoose.Types.ObjectId.isValid(user_id)) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    // ✅ Zod validation
    const parsed = CreateCashAssistanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed.",
        errors: formatZodErrors(parsed.error),
      });
    }

    const { purpose, date_needed, medical_certificate_base64 } = parsed.data;

    // Upload certificate to dedicated bucket
    let medical_certificate_url: string | null = null;
    if (medical_certificate_base64) {
      try {
        const filePath = `${user_id}/${Date.now()}_medical_cert`;
        medical_certificate_url = await uploadBase64ToSupabase(
          medical_certificate_base64,
          filePath,
          BUCKETS.MEDICAL_CERTIFICATES,
        );
        console.log(
          "[cash-assistance] Certificate uploaded:",
          medical_certificate_url,
        );
      } catch (uploadErr: any) {
        console.error(
          "[cash-assistance] Certificate upload failed:",
          uploadErr.message,
        );
      }
    }

    const record = new CashAssistance({
      user_id: new mongoose.Types.ObjectId(user_id),
      purpose: purpose.trim(),
      medical_certificate_url,
      date_needed: new Date(date_needed),
    });

    await record.save();
    console.log("[cash-assistance] Saved, form_id:", record.form_id);

    return res.status(201).json({
      message: "Cash assistance request submitted.",
      cash_assistance: record,
    });
  } catch (err: any) {
    console.error("[cash-assistance] POST error:", err.message);

    if (err.name === "ValidationError") {
      const fields = Object.keys(err.errors).map((key) => ({
        field: key,
        message: err.errors[key].message,
      }));
      return res
        .status(400)
        .json({ message: "Validation failed.", errors: fields });
    }

    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "Duplicate request. Please try again." });
    }

    return res.status(500).json({
      message: "Server error.",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// ── GET /api/cash-assistance/me ───────────────────────────────────────────────
router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user_id = req.userId;
    if (!user_id) return res.status(401).json({ message: "Unauthorized." });

    const records = await CashAssistance.find({ user_id })
      .sort({ created_at: -1 })
      .lean();

    return res.json({ cash_assistance: records });
  } catch (err: any) {
    console.error("[cash-assistance] GET /me error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/cash-assistance/:id ──────────────────────────────────────────────
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user_id = req.userId;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ID." });
    }

    const record = await CashAssistance.findOne({
      _id: req.params.id,
      user_id,
    }).lean();

    if (!record) return res.status(404).json({ message: "Not found." });

    return res.json({ cash_assistance: record });
  } catch (err: any) {
    console.error("[cash-assistance] GET /:id error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── PATCH /api/cash-assistance/:id/cancel ────────────────────────────────────
router.patch(
  "/:id/cancel",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const user_id = req.userId;

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid ID." });
      }

      const record = await CashAssistance.findOne({
        _id: req.params.id,
        user_id,
      });

      if (!record) return res.status(404).json({ message: "Not found." });

      if (record.status !== "Submitted") {
        return res.status(400).json({
          message: `Cannot cancel a request with status "${record.status}".`,
        });
      }

      record.status = "Cancelled";
      await record.save();

      return res.json({
        message: "Request cancelled.",
        cash_assistance: record,
      });
    } catch (err: any) {
      console.error("[cash-assistance] PATCH cancel error:", err.message);
      return res.status(500).json({ message: "Server error." });
    }
  },
);

// ── PATCH /api/cash-assistance/:id/status (admin) ────────────────────────────
router.patch(
  "/:id/status",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid ID." });
      }

      // ✅ Zod validation for status update
      const parsed = UpdateCashAssistanceStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Validation failed.",
          errors: formatZodErrors(parsed.error),
        });
      }

      const record = await CashAssistance.findByIdAndUpdate(
        req.params.id,
        { status: parsed.data.status },
        { new: true },
      );

      if (!record) return res.status(404).json({ message: "Not found." });

      return res.json({ message: "Status updated.", cash_assistance: record });
    } catch (err: any) {
      console.error("[cash-assistance] PATCH status error:", err.message);
      return res.status(500).json({ message: "Server error." });
    }
  },
);

export default router;

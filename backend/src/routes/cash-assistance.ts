// backend/src/routes/cash-assistance.ts
import { Response, Router } from "express";
import { ZodError } from "zod";
import { AuthRequest, requireAuth } from "../middleware/auth";
import {
  CashAssistance,
  CreateCashAssistanceSchema,
  UpdateCashAssistanceStatusSchema,
} from "../models/CashAssistance";
import User from "../models/User";
import { notifyAdmins } from "../utils/notificationHelper";
import { BUCKETS, uploadBase64ToSupabase } from "../utils/supabase";

const router = Router();

const formatZodErrors = (err: ZodError) =>
  err.issues.map((e) => ({
    field: e.path.join("."),
    message: e.message,
  }));

// ── POST /api/cash-assistance — Submit request
// 🔔 Notifies admins on success
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user_id = req.userId;
    if (!user_id) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const user = await User.findOne({ user_id });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const parsed = CreateCashAssistanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed.",
        errors: formatZodErrors(parsed.error),
      });
    }

    const { purpose, medical_certificate_base64 } = parsed.data;

    let medical_certificate_url: string;
    try {
      const filePath = `${user_id}/${Date.now()}_medical_cert`;
      const uploadedUrl = await uploadBase64ToSupabase(
        medical_certificate_base64,
        filePath,
        BUCKETS.MEDICAL_CERTIFICATES,
      );
      if (!uploadedUrl)
        throw new Error("Failed to upload certificate - no URL returned");
      medical_certificate_url = uploadedUrl;
    } catch (uploadErr: any) {
      return res.status(500).json({
        message: "Failed to upload medical certificate. Please try again.",
      });
    }

    const record = new CashAssistance({
      user_id,
      purpose: purpose.trim(),
      medical_certificate_url,
    });
    await record.save();

    // 🔔 Notify admins
    const applicantName =
      [user.first_name, user.last_name].filter(Boolean).join(" ") || user_id;

    await notifyAdmins({
      triggered_by: user_id,
      type: "application_submitted",
      title: "New Cash Assistance Request",
      message: `${applicantName} has submitted a cash assistance request (${record.form_id}).`,
      action_url: `/dashboard/cash-assistance/${record._id}`,
      action_text: "View Request",
      data: {
        form_id: record.form_id,
        applicant_name: applicantName,
        applicant_user_id: user_id,
        purpose: record.purpose,
      },
    });

    return res.status(201).json({
      message: "Cash assistance request submitted.",
      cash_assistance: {
        _id: record._id,
        form_id: record.form_id,
        purpose: record.purpose,
        medical_certificate_url: record.medical_certificate_url,
        status: record.status,
        created_at: record.created_at,
        updated_at: record.updated_at,
      },
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

    return res.json({
      cash_assistance: records.map((r) => ({
        _id: r._id,
        form_id: r.form_id,
        purpose: r.purpose,
        medical_certificate_url: r.medical_certificate_url,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (err: any) {
    console.error("[cash-assistance] GET /me error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/cash-assistance/:id ──────────────────────────────────────────────
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user_id = req.userId;
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      return res.status(400).json({ message: "Invalid request ID format." });
    }

    const record = await CashAssistance.findOne({
      _id: req.params.id,
      user_id,
    }).lean();
    if (!record) return res.status(404).json({ message: "Not found." });

    return res.json({
      cash_assistance: {
        _id: record._id,
        form_id: record.form_id,
        purpose: record.purpose,
        medical_certificate_url: record.medical_certificate_url,
        status: record.status,
        created_at: record.created_at,
        updated_at: record.updated_at,
      },
    });
  } catch (err: any) {
    console.error("[cash-assistance] GET /:id error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── PATCH /api/cash-assistance/:id/cancel
// 🔔 Notifies admins on success
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/:id/cancel",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const user_id = req.userId;
      if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return res.status(400).json({ message: "Invalid request ID format." });
      }

      const record = await CashAssistance.findOne({
        _id: req.params.id,
        user_id,
      });
      if (!record) return res.status(404).json({ message: "Not found." });

      if (record.status !== "Submitted" && record.status !== "Under Review") {
        return res.status(400).json({
          message: `Cannot cancel a request with status "${record.status}".`,
        });
      }

      record.status = "Cancelled";
      await record.save();

      // 🔔 Notify admins
      const user = (await User.findOne({ user_id }).lean()) as any;
      const applicantName =
        [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
        user_id!;

      await notifyAdmins({
        triggered_by: user_id!,
        type: "custom_message",
        title: "Cash Assistance Request Cancelled",
        message: `${applicantName} has cancelled their cash assistance request (${record.form_id}).`,
        action_url: `/dashboard/cash-assistance/${record._id}`,
        action_text: "View Request",
        data: {
          form_id: record.form_id,
          applicant_name: applicantName,
          applicant_user_id: user_id,
        },
      });

      return res.json({
        message: "Request cancelled.",
        cash_assistance: {
          _id: record._id,
          form_id: record.form_id,
          purpose: record.purpose,
          medical_certificate_url: record.medical_certificate_url,
          status: record.status,
          created_at: record.created_at,
          updated_at: record.updated_at,
        },
      });
    } catch (err: any) {
      console.error("[cash-assistance] PATCH cancel error:", err.message);
      return res.status(500).json({ message: "Server error." });
    }
  },
);

// ── PATCH /api/cash-assistance/:id/status (admin) — no notification ───────────
router.patch(
  "/:id/status",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return res.status(400).json({ message: "Invalid request ID format." });
      }

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

      return res.json({
        message: "Status updated.",
        cash_assistance: {
          _id: record._id,
          form_id: record.form_id,
          purpose: record.purpose,
          medical_certificate_url: record.medical_certificate_url,
          status: record.status,
          created_at: record.created_at,
          updated_at: record.updated_at,
        },
      });
    } catch (err: any) {
      console.error("[cash-assistance] PATCH status error:", err.message);
      return res.status(500).json({ message: "Server error." });
    }
  },
);

export default router;

// backend/src/routes/applications.ts
import { Response, Router } from "express";
import mongoose from "mongoose";
import { AuthRequest, requireAuth } from "../middleware/auth";
import Application, {
  ApplicationUpdateSchema,
  ApplicationZodSchema,
} from "../models/Application";
import User from "../models/User";

const router = Router();

// Helper to get the custom user_id from either MongoDB _id or custom user_id
const getCustomUserId = async (identifier: string): Promise<string> => {
  // Check if the identifier is a valid MongoDB ObjectId
  const isValidObjectId = mongoose.Types.ObjectId.isValid(identifier);

  if (isValidObjectId) {
    // If it's a valid ObjectId, find the user by _id and return their custom user_id
    const user = await User.findById(identifier).select("user_id").lean();
    if (user && (user as any).user_id) {
      return (user as any).user_id;
    }
  } else {
    // If it's not a valid ObjectId, assume it's already a custom user_id
    // But verify it exists in the database
    const user = await User.findOne({ user_id: identifier })
      .select("user_id")
      .lean();
    if (user && (user as any).user_id) {
      return (user as any).user_id;
    }
  }

  // If no user found, return the original identifier (though this shouldn't happen)
  console.warn(
    `[getCustomUserId] No user found for identifier: ${identifier}, returning as is`,
  );
  return identifier;
};

// Helper to get user details using custom user_id
const getUserDetailsByCustomId = async (customUserId: string): Promise<any> => {
  return await User.findOne({ user_id: customUserId }).lean();
};

// Helper to get MongoDB _id from custom user_id (for User.findById operations)
const getMongoIdFromCustomId = async (
  customUserId: string,
): Promise<string | null> => {
  const user = await User.findOne({ user_id: customUserId })
    .select("_id")
    .lean();
  return user ? (user as any)._id.toString() : null;
};

// ── Helper: format zod errors into a flat readable object ────────────────────
const formatZodErrors = (issues: any[]) =>
  issues.reduce((acc: Record<string, string>, issue: any) => {
    const key = issue.path?.join(".") || "general";
    acc[key] = issue.message;
    return acc;
  }, {});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications
// Submit a new application (status: Submitted)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const identifier = req.userId;
      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Get the custom user_id
      const customUserId = await getCustomUserId(identifier);

      // Get MongoDB _id for User.findById operations
      const mongoId =
        (await getMongoIdFromCustomId(customUserId)) || identifier;

      // Check if user already has a pending/submitted application
      const existing = await Application.findOne({
        user_id: customUserId,
        status: { $in: ["Draft", "Submitted", "Under Review"] },
      });

      if (existing) {
        res.status(409).json({
          error: "Duplicate application",
          message: `You already have an active application (${existing.application_id}) with status "${existing.status}".`,
          application_id: existing.application_id,
        });
        return;
      }

      // Validate with Zod
      const parsed = ApplicationZodSchema.safeParse({
        ...req.body,
        user_id: customUserId,
        status: "Submitted",
        date_applied: new Date(),
      });

      if (!parsed.success) {
        res.status(400).json({
          error: "Validation failed",
          fields: formatZodErrors(parsed.error.issues),
        });
        return;
      }

      const application = new Application({
        ...parsed.data,
        created_by: customUserId,
      });

      await application.save();

      // Link application_id to user.form_id
      await User.findByIdAndUpdate(mongoId, {
        form_id: application.application_id,
        updated_by: customUserId,
      });

      console.log(
        `✅ Application submitted: ${application.application_id} | user: ${customUserId}`,
      );

      res.status(201).json({
        success: true,
        message: "Application submitted successfully",
        application: {
          _id: application._id,
          application_id: application.application_id,
          status: application.status,
          application_type: application.application_type,
          date_applied: application.date_applied,
          last_name: application.last_name,
          first_name: application.first_name,
          middle_name: application.middle_name,
          types_of_disability: application.types_of_disability,
          created_at: application.created_at,
        },
      });
    } catch (err: any) {
      console.error("[POST /api/applications]", err);
      if (err.code === 11000) {
        res
          .status(409)
          .json({ error: "Duplicate application ID. Please try again." });
        return;
      }
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to submit application" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications/draft
// Save a draft (status: Draft) — no required field validation
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/draft",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const identifier = req.userId;
      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const customUserId = await getCustomUserId(identifier);
      const mongoId =
        (await getMongoIdFromCustomId(customUserId)) || identifier;

      // If draft already exists, update it instead
      const existingDraft = await Application.findOne({
        user_id: customUserId,
        status: "Draft",
      });

      if (existingDraft) {
        const parsed = ApplicationUpdateSchema.safeParse({
          ...req.body,
          user_id: customUserId,
        });
        if (!parsed.success) {
          res.status(400).json({
            error: "Validation failed",
            fields: formatZodErrors(parsed.error.issues),
          });
          return;
        }
        Object.assign(existingDraft, {
          ...parsed.data,
          updated_by: customUserId,
        });
        await existingDraft.save();
        res.json({
          success: true,
          message: "Draft updated",
          application: {
            _id: existingDraft._id,
            application_id: existingDraft.application_id,
            status: existingDraft.status,
            updated_at: existingDraft.updated_at,
          },
        });
        return;
      }

      // Create new draft — use partial schema, only user_id required
      const parsed = ApplicationUpdateSchema.safeParse({
        ...req.body,
        user_id: customUserId,
        status: "Draft",
      });

      if (!parsed.success) {
        res.status(400).json({
          error: "Validation failed",
          fields: formatZodErrors(parsed.error.issues),
        });
        return;
      }

      const application = new Application({
        ...parsed.data,
        created_by: customUserId,
      });

      await application.save();

      await User.findByIdAndUpdate(mongoId, {
        form_id: application.application_id,
        updated_by: customUserId,
      });

      res.status(201).json({
        success: true,
        message: "Draft saved",
        application: {
          _id: application._id,
          application_id: application.application_id,
          status: application.status,
          created_at: application.created_at,
        },
      });
    } catch (err: any) {
      console.error("[POST /api/applications/draft]", err);
      res.status(500).json({ error: err?.message ?? "Failed to save draft" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applications/me
// Get the current user's application(s)
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/me",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const identifier = req.userId;
      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const customUserId = await getCustomUserId(identifier);

      const applications = await Application.find({ user_id: customUserId })
        .sort({ created_at: -1 })
        .select("-__v");

      res.json({ success: true, applications });
    } catch (err: any) {
      console.error("[GET /api/applications/me]", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to fetch applications" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applications/me/active
// Get the single active (non-cancelled/rejected) application
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/me/active",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const identifier = req.userId;
      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const customUserId = await getCustomUserId(identifier);

      const application = await Application.findOne({
        user_id: customUserId,
        status: { $nin: ["Cancelled", "Rejected"] },
      })
        .sort({ created_at: -1 })
        .select("-__v");

      res.json({ success: true, application: application ?? null });
    } catch (err: any) {
      console.error("[GET /api/applications/me/active]", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to fetch application" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/applications/:id
// Get a single application by _id or application_id
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const identifier = req.userId;
      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const customUserId = await getCustomUserId(identifier);

      const application = await Application.findOne({
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
          { application_id: id },
        ],
      }).select("-__v");

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      // Get user to check role
      const user = await getUserDetailsByCustomId(customUserId);
      const isOwner = application.user_id === customUserId;
      const isStaff = ["Admin", "Supervisor", "Staff"].includes(user?.role);

      if (!isOwner && !isStaff) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      res.json({ success: true, application });
    } catch (err: any) {
      console.error("[GET /api/applications/:id]", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to fetch application" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applications/:id
// Update a Draft application (user can only edit their own Draft)
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const identifier = req.userId;
      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const customUserId = await getCustomUserId(identifier);

      const application = await Application.findOne({
        $or: [
          {
            _id: mongoose.Types.ObjectId.isValid(req.params.id)
              ? req.params.id
              : null,
          },
          { application_id: req.params.id },
        ],
      });

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      if (application.user_id !== customUserId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      if (application.status !== "Draft") {
        res.status(400).json({
          error: "Cannot edit application",
          message: `Only Draft applications can be edited. Current status: "${application.status}".`,
        });
        return;
      }

      const parsed = ApplicationUpdateSchema.safeParse({
        ...req.body,
        user_id: customUserId,
      });

      if (!parsed.success) {
        res.status(400).json({
          error: "Validation failed",
          fields: formatZodErrors(parsed.error.issues),
        });
        return;
      }

      Object.assign(application, { ...parsed.data, updated_by: customUserId });
      await application.save();

      res.json({
        success: true,
        message: "Application updated",
        application: {
          _id: application._id,
          application_id: application.application_id,
          status: application.status,
          updated_at: application.updated_at,
        },
      });
    } catch (err: any) {
      console.error("[PATCH /api/applications/:id]", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to update application" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applications/:id/submit
// Submit a Draft application → status: Submitted
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/:id/submit",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const identifier = req.userId;
      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const customUserId = await getCustomUserId(identifier);

      const application = await Application.findOne({
        $or: [
          {
            _id: mongoose.Types.ObjectId.isValid(req.params.id)
              ? req.params.id
              : null,
          },
          { application_id: req.params.id },
        ],
      });

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      if (application.user_id !== customUserId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      if (application.status !== "Draft") {
        res.status(400).json({
          error: "Only Draft applications can be submitted",
          message: `Current status: "${application.status}"`,
        });
        return;
      }

      // Full validation before submitting
      const parsed = ApplicationZodSchema.safeParse({
        ...application.toObject(),
        user_id: customUserId,
        status: "Submitted",
      });

      if (!parsed.success) {
        res.status(400).json({
          error: "Application is incomplete",
          message: "Please fill in all required fields before submitting.",
          fields: formatZodErrors(parsed.error.issues),
        });
        return;
      }

      application.status = "Submitted";
      application.date_applied = new Date();
      (application as any).updated_by = customUserId;
      await application.save();

      res.json({
        success: true,
        message: "Application submitted successfully",
        application: {
          _id: application._id,
          application_id: application.application_id,
          status: application.status,
          date_applied: application.date_applied,
        },
      });
    } catch (err: any) {
      console.error("[PATCH /api/applications/:id/submit]", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to submit application" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/applications/:id/cancel
// Cancel a Draft or Submitted application
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/:id/cancel",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const identifier = req.userId;
      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const customUserId = await getCustomUserId(identifier);

      const application = await Application.findOne({
        $or: [
          {
            _id: mongoose.Types.ObjectId.isValid(req.params.id)
              ? req.params.id
              : null,
          },
          { application_id: req.params.id },
        ],
      });

      if (!application) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      if (application.user_id !== customUserId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      if (!["Draft", "Submitted"].includes(application.status as string)) {
        res.status(400).json({
          error: "Cannot cancel application",
          message: `Applications with status "${application.status}" cannot be cancelled.`,
        });
        return;
      }

      application.status = "Cancelled";
      (application as any).updated_by = customUserId;
      await application.save();

      res.json({
        success: true,
        message: "Application cancelled",
        application_id: application.application_id,
      });
    } catch (err: any) {
      console.error("[PATCH /api/applications/:id/cancel]", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to cancel application" });
    }
  },
);

export default router;

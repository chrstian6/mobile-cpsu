// backend/src/routes/applications.ts
import { Response, Router } from "express";
import mongoose from "mongoose";
import { AuthRequest, requireAuth } from "../middleware/auth";
import Application, {
  ApplicationUpdateSchema,
  ApplicationZodSchema,
} from "../models/Application";
import User from "../models/User";
import { BUCKETS, uploadBase64ToSupabase } from "../utils/supabase";

const router = Router();

// ── User ID helpers ───────────────────────────────────────────────────────────

const getCustomUserId = async (identifier: string): Promise<string> => {
  const isValidObjectId = mongoose.Types.ObjectId.isValid(identifier);
  if (isValidObjectId) {
    const user = await User.findById(identifier).select("user_id").lean();
    if (user && (user as any).user_id) return (user as any).user_id;
  } else {
    const user = await User.findOne({ user_id: identifier })
      .select("user_id")
      .lean();
    if (user && (user as any).user_id) return (user as any).user_id;
  }
  console.warn(
    `[getCustomUserId] No user found for identifier: ${identifier}, returning as is`,
  );
  return identifier;
};

const getUserDetailsByCustomId = async (customUserId: string): Promise<any> =>
  await User.findOne({ user_id: customUserId }).lean();

const getMongoIdFromCustomId = async (
  customUserId: string,
): Promise<string | null> => {
  const user = await User.findOne({ user_id: customUserId })
    .select("_id")
    .lean();
  return user ? (user as any)._id.toString() : null;
};

// ── Zod error formatter ───────────────────────────────────────────────────────

const formatZodErrors = (issues: any[]) =>
  issues.reduce((acc: Record<string, string>, issue: any) => {
    const key = issue.path?.join(".") || "general";
    acc[key] = issue.message;
    return acc;
  }, {});

// ── Document upload helper ────────────────────────────────────────────────────
// Accepts base64 strings (same pattern as cash-assistance).
// Returns the uploaded URL or throws.

interface UploadedDoc {
  medical_certificate_url?: string;
  birth_certificate_url?: string;
  supporting_docs_urls?: string[];
}

async function uploadApplicationDocs(
  userId: string,
  body: {
    medical_certificate_base64?: string;
    birth_certificate_base64?: string;
    supporting_docs_base64?: string[]; // array of base64 strings
  },
): Promise<UploadedDoc> {
  const result: UploadedDoc = {};

  // Medical certificate
  if (body.medical_certificate_base64) {
    const path = `${userId}/${Date.now()}_medical_cert`;
    const url = await uploadBase64ToSupabase(
      body.medical_certificate_base64,
      path,
      BUCKETS.MEDICAL_CERTIFICATES,
    );
    if (!url) throw new Error("Failed to upload medical certificate.");
    result.medical_certificate_url = url;
    console.log(`[applications] Medical cert uploaded: ${url}`);
  }

  // Birth certificate
  if (body.birth_certificate_base64) {
    const path = `${userId}/${Date.now()}_birth_cert`;
    const url = await uploadBase64ToSupabase(
      body.birth_certificate_base64,
      path,
      BUCKETS.SUPPORTING_DOCUMENTS, // reuse supporting docs bucket or add BIRTH_CERTIFICATES bucket
    );
    if (!url) throw new Error("Failed to upload birth certificate.");
    result.birth_certificate_url = url;
    console.log(`[applications] Birth cert uploaded: ${url}`);
  }

  // Supporting documents (array)
  if (body.supporting_docs_base64?.length) {
    const urls: string[] = [];
    for (let i = 0; i < body.supporting_docs_base64.length; i++) {
      const path = `${userId}/${Date.now()}_supporting_${i}`;
      const url = await uploadBase64ToSupabase(
        body.supporting_docs_base64[i],
        path,
        BUCKETS.SUPPORTING_DOCUMENTS,
      );
      if (!url)
        throw new Error(`Failed to upload supporting document ${i + 1}.`);
      urls.push(url);
    }
    result.supporting_docs_urls = urls;
    console.log(
      `[applications] Supporting docs uploaded: ${urls.length} file(s)`,
    );
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/applications
// Submit a new application (status: Submitted)
// Body may include:
//   medical_certificate_base64  — base64 string
//   birth_certificate_base64    — base64 string
//   supporting_docs_base64      — string[]
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

      const customUserId = await getCustomUserId(identifier);
      const mongoId =
        (await getMongoIdFromCustomId(customUserId)) || identifier;

      // Duplicate check
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

      // Upload documents first (fail fast before DB write)
      let uploadedDocs: UploadedDoc = {};
      try {
        uploadedDocs = await uploadApplicationDocs(customUserId, req.body);
      } catch (uploadErr: any) {
        res
          .status(500)
          .json({ error: uploadErr.message ?? "Document upload failed." });
        return;
      }

      // Validate with Zod
      const parsed = ApplicationZodSchema.safeParse({
        ...req.body,
        user_id: customUserId,
        status: "Submitted",
        date_applied: new Date(),
        ...uploadedDocs, // merge uploaded URLs into validated payload
        // Merge supporting_docs_urls arrays (existing + newly uploaded)
        supporting_docs_urls: [
          ...(req.body.supporting_docs_urls ?? []),
          ...(uploadedDocs.supporting_docs_urls ?? []),
        ],
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
          medical_certificate_url: application.medical_certificate_url,
          birth_certificate_url: (application as any).birth_certificate_url,
          supporting_docs_urls: application.supporting_docs_urls,
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
// Save a draft — same file upload support
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

      // Upload any provided documents
      let uploadedDocs: UploadedDoc = {};
      try {
        uploadedDocs = await uploadApplicationDocs(customUserId, req.body);
      } catch (uploadErr: any) {
        res
          .status(500)
          .json({ error: uploadErr.message ?? "Document upload failed." });
        return;
      }

      const bodyWithDocs = {
        ...req.body,
        user_id: customUserId,
        ...uploadedDocs,
        supporting_docs_urls: [
          ...(req.body.supporting_docs_urls ?? []),
          ...(uploadedDocs.supporting_docs_urls ?? []),
        ],
      };

      // Update existing draft if present
      const existingDraft = await Application.findOne({
        user_id: customUserId,
        status: "Draft",
      });
      if (existingDraft) {
        const parsed = ApplicationUpdateSchema.safeParse(bodyWithDocs);
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
            medical_certificate_url: existingDraft.medical_certificate_url,
            birth_certificate_url: (existingDraft as any).birth_certificate_url,
            supporting_docs_urls: existingDraft.supporting_docs_urls,
            updated_at: existingDraft.updated_at,
          },
        });
        return;
      }

      // New draft
      const parsed = ApplicationUpdateSchema.safeParse({
        ...bodyWithDocs,
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
          medical_certificate_url: application.medical_certificate_url,
          birth_certificate_url: (application as any).birth_certificate_url,
          supporting_docs_urls: application.supporting_docs_urls,
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
// Update a Draft — including document uploads
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

      // Upload any new documents
      let uploadedDocs: UploadedDoc = {};
      try {
        uploadedDocs = await uploadApplicationDocs(customUserId, req.body);
      } catch (uploadErr: any) {
        res
          .status(500)
          .json({ error: uploadErr.message ?? "Document upload failed." });
        return;
      }

      const parsed = ApplicationUpdateSchema.safeParse({
        ...req.body,
        user_id: customUserId,
        ...uploadedDocs,
        // Append newly uploaded supporting docs to existing ones
        supporting_docs_urls: [
          ...((application as any).supporting_docs_urls ?? []),
          ...(req.body.supporting_docs_urls ?? []),
          ...(uploadedDocs.supporting_docs_urls ?? []),
        ],
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
          medical_certificate_url: application.medical_certificate_url,
          birth_certificate_url: (application as any).birth_certificate_url,
          supporting_docs_urls: application.supporting_docs_urls,
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
// Submit a Draft → Submitted (full validation)
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

      // Upload any documents sent with submit request
      let uploadedDocs: UploadedDoc = {};
      try {
        uploadedDocs = await uploadApplicationDocs(customUserId, req.body);
      } catch (uploadErr: any) {
        res
          .status(500)
          .json({ error: uploadErr.message ?? "Document upload failed." });
        return;
      }

      const parsed = ApplicationZodSchema.safeParse({
        ...application.toObject(),
        user_id: customUserId,
        status: "Submitted",
        ...uploadedDocs,
        supporting_docs_urls: [
          ...(application.supporting_docs_urls ?? []),
          ...(uploadedDocs.supporting_docs_urls ?? []),
        ],
      });
      if (!parsed.success) {
        res.status(400).json({
          error: "Application is incomplete",
          message: "Please fill in all required fields before submitting.",
          fields: formatZodErrors(parsed.error.issues),
        });
        return;
      }

      Object.assign(application, {
        ...uploadedDocs,
        supporting_docs_urls: parsed.data.supporting_docs_urls,
        status: "Submitted",
        date_applied: new Date(),
        updated_by: customUserId,
      });
      await application.save();

      res.json({
        success: true,
        message: "Application submitted successfully",
        application: {
          _id: application._id,
          application_id: application.application_id,
          status: application.status,
          date_applied: application.date_applied,
          medical_certificate_url: application.medical_certificate_url,
          birth_certificate_url: (application as any).birth_certificate_url,
          supporting_docs_urls: application.supporting_docs_urls,
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

// backend/src/routes/cards.ts
import { Response, Router } from "express";
import multer from "multer";
import { AuthRequest, requireAuth } from "../middleware/auth";
import Application from "../models/Application";
import Card from "../models/Cards";
import User from "../models/User";
import {
  uploadBase64ToSupabase,
  uploadBufferToSupabase,
} from "../utils/supabase";

const router = Router();

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

// Simple date parser
const parseDate = (val: string | undefined): Date | null => {
  if (!val || val === "Not detected") return null;
  const mmddyyyy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, m, d, y] = mmddyyyy;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

// Simple sex mapper
const mapSex = (sex: string | undefined): string => {
  if (!sex || sex === "Not detected") return "Not detected";
  const upperSex = sex.toUpperCase().trim();
  if (upperSex === "M") return "Male";
  if (upperSex === "F") return "Female";
  if (sex === "Male" || sex === "Female" || sex === "Other") return sex;
  return sex;
};

// ── POST /api/cards/request-from-application ──────────────────────────────────
// Called from application.tsx after a user's application is Approved.
// Pulls personal data from the approved application, uploads the 1x1 photo,
// and creates a Card record pending admin review.
router.post(
  "/request-from-application",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customUserId = req.userId;
      if (!customUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      console.log("[cards/request-from-application] user:", customUserId);

      const {
        blood_type,
        emergency_contact_name,
        emergency_contact_number,
        photo_base64,
        face_verification_score,
        face_verification_distance,
      } = req.body;

      // ── Validate required fields ────────────────────────────────────────────
      if (!blood_type) {
        res.status(400).json({ error: "Blood type is required" });
        return;
      }
      if (!emergency_contact_name?.trim()) {
        res.status(400).json({ error: "Emergency contact name is required" });
        return;
      }
      if (!emergency_contact_number?.trim()) {
        res.status(400).json({ error: "Emergency contact number is required" });
        return;
      }
      if (!photo_base64) {
        res.status(400).json({ error: "1x1 photo is required" });
        return;
      }
      if (!photo_base64.startsWith("data:image/")) {
        res
          .status(400)
          .json({ error: "Invalid photo format — must be a base64 data URI" });
        return;
      }

      // ── Find the user's approved application ───────────────────────────────
      const application = await Application.findOne({
        user_id: customUserId,
        status: "Approved",
      }).sort({ created_at: -1 });

      if (!application) {
        res.status(404).json({
          error: "No approved application found",
          message:
            "You must have an approved application before requesting a PWD ID card.",
        });
        return;
      }

      console.log(
        "[cards/request-from-application] found application:",
        application.application_id,
      );

      // ── Check if a card already exists for this user ────────────────────────
      const existingCard = await Card.findOne({ user_id: customUserId });
      if (existingCard) {
        res.status(409).json({
          error: "Card already requested",
          message: "You already have a PWD ID card request in the system.",
        });
        return;
      }

      // ── Upload 1x1 photo to Supabase ────────────────────────────────────────
      const sanitizedUserId = customUserId.replace(/[^a-zA-Z0-9\-]/g, "_");
      const timestamp = Date.now();
      const photoPath = `${sanitizedUserId}/1x1_photo_${timestamp}.jpg`;

      console.log(
        "[cards/request-from-application] uploading photo to:",
        photoPath,
      );

      const photoUrl = await uploadBase64ToSupabase(photo_base64, photoPath);

      if (!photoUrl) {
        console.error("[cards/request-from-application] photo upload failed");
        res
          .status(500)
          .json({ error: "Failed to upload photo. Please try again." });
        return;
      }

      console.log("[cards/request-from-application] photo uploaded:", photoUrl);

      // ── Build full name from application ────────────────────────────────────
      const nameParts = [
        application.first_name,
        application.middle_name && application.middle_name !== "N/A"
          ? application.middle_name
          : null,
        application.last_name,
        application.suffix || null,
      ].filter(Boolean);
      const fullName = nameParts.join(" ");

      // ── Build address from application residence_address ───────────────────
      const addr = application.residence_address;
      const addressStr = [
        addr?.house_no_and_street,
        addr?.barangay,
        addr?.municipality,
        addr?.province,
        addr?.region,
      ]
        .filter(Boolean)
        .join(", ");

      // ── Generate a card_id placeholder (admin will assign the real one) ─────
      // Format: PDAO-APP-{application_id}-{timestamp}
      const generatedCardId = `PDAO-APP-${application.application_id}-${timestamp}`;

      // ── Create the card ─────────────────────────────────────────────────────
      const card = new Card({
        card_id: generatedCardId,
        user_id: customUserId,
        name: fullName,
        barangay: addr?.barangay || "Not detected",
        type_of_disability:
          application.types_of_disability?.join(", ") || "Not detected",
        address: addressStr || "Not detected",
        date_of_birth: application.date_of_birth,
        sex: mapSex(application.sex),
        blood_type,
        date_issued: new Date(),
        emergency_contact_name: emergency_contact_name.trim(),
        emergency_contact_number: emergency_contact_number.trim(),
        status: "Pending",
        face_descriptors: null,
        extracted_data: {
          source: "application",
          application_id: application.application_id,
          face_verification_score: face_verification_score ?? null,
          face_verification_distance: face_verification_distance ?? null,
        },
        id_front_url: null,
        id_back_url: null,
        id_image_url: photoUrl,
        last_verified_at: new Date(),
        verification_count: 1,
        created_by: customUserId,
      });

      await card.save();
      console.log("[cards/request-from-application] card saved:", card._id);

      // ── Link card_id on the user record ────────────────────────────────────
      await User.findOneAndUpdate(
        { user_id: customUserId },
        { card_id: generatedCardId, updated_by: customUserId },
      );

      console.log("[cards/request-from-application] user updated with card_id");

      res.status(201).json({
        success: true,
        message:
          "Card request submitted successfully. The admin will review and issue your card.",
        card: {
          _id: card._id,
          card_id: card.card_id,
          name: card.name,
          status: card.status,
          blood_type: card.blood_type,
          emergency_contact_name: card.emergency_contact_name,
          emergency_contact_number: card.emergency_contact_number,
          id_image_url: card.id_image_url,
          created_at: card.created_at,
        },
      });
    } catch (err: any) {
      console.error("[POST /api/cards/request-from-application] Error:", err);

      if (err.code === 11000) {
        res.status(409).json({
          error: "Card already requested",
          message: "You already have a card request in the system.",
        });
        return;
      }

      res.status(500).json({
        error: err?.message ?? "Failed to create card request",
        details:
          process.env.NODE_ENV === "development" ? err?.stack : undefined,
      });
    }
  },
);

// ── POST /api/cards ───────────────────────────────────────────────────────────
router.post(
  "/",
  requireAuth,
  upload.fields([
    { name: "id_front", maxCount: 1 },
    { name: "id_back", maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customUserId = req.userId;
      if (!customUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      console.log("=".repeat(50));
      console.log("[cards] Processing card submission for user:", customUserId);
      console.log("=".repeat(50));

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
        match_score,
        distance,
      } = req.body;

      // Parse stringified JSON fields from FormData
      let face_descriptors: number[] = [];
      let extracted_data: any = null;
      try {
        face_descriptors = JSON.parse(req.body.face_descriptors || "[]");
        console.log(
          "[cards] Parsed face_descriptors length:",
          face_descriptors.length,
        );
      } catch {
        face_descriptors = [];
      }
      try {
        extracted_data = JSON.parse(req.body.extracted_data || "null");
        console.log(
          "[cards] Parsed extracted_data:",
          extracted_data ? "yes" : "no",
        );
      } catch {
        extracted_data = null;
      }

      if (!card_id) {
        res.status(400).json({ error: "Card ID is required" });
        return;
      }
      if (!name || name === "Not detected") {
        res.status(400).json({ error: "Name could not be extracted from ID" });
        return;
      }

      const existing = await Card.findOne({ card_id });
      if (existing) {
        res.status(409).json({
          error: "Card already registered",
          message: `Card ID ${card_id} is already in the system.`,
        });
        return;
      }

      const parsedDob = parseDate(date_of_birth);
      const parsedDateIssued = parseDate(date_issued) ?? new Date();
      if (!parsedDob) {
        res.status(400).json({ error: "Invalid or missing date of birth" });
        return;
      }

      const files = req.files as
        | Record<string, Express.Multer.File[]>
        | undefined;
      const sanitizedCardId = card_id.replace(/[^a-zA-Z0-9\-]/g, "_");
      const sanitizedUserId = customUserId.replace(/[^a-zA-Z0-9\-]/g, "_");

      console.log("\n[cards] ========== IMAGE UPLOAD DEBUG ==========");
      console.log("[cards] Content-Type:", req.headers["content-type"]);
      console.log(
        "[cards] Files received:",
        files ? Object.keys(files) : "none",
      );

      let idFrontUrl: string | null = null;
      let idBackUrl: string | null = null;

      const frontPath = `${sanitizedUserId}/${sanitizedCardId}/id_front.jpg`;
      console.log("\n[cards] Uploading front image to:", frontPath);

      if (files?.id_front?.[0] && files.id_front[0].size > 0) {
        const f = files.id_front[0];
        console.log("[cards] Attempting multipart upload for front image...");
        idFrontUrl = await uploadBufferToSupabase(
          f.buffer,
          f.mimetype,
          frontPath,
        );
        console.log(
          "[cards] Multipart upload result - front URL:",
          idFrontUrl || "FAILED",
        );
      } else if (req.body.id_front_base64) {
        console.log("[cards] Attempting base64 upload for front image...");
        idFrontUrl = await uploadBase64ToSupabase(
          req.body.id_front_base64,
          frontPath,
        );
        console.log(
          "[cards] Base64 upload result - front URL:",
          idFrontUrl || "FAILED",
        );
      } else {
        console.warn(
          "[cards] No front image received at all - skipping upload",
        );
      }

      const backPath = `${sanitizedUserId}/${sanitizedCardId}/id_back.jpg`;
      console.log("\n[cards] Uploading back image to:", backPath);

      if (files?.id_back?.[0] && files.id_back[0].size > 0) {
        const f = files.id_back[0];
        console.log("[cards] Attempting multipart upload for back image...");
        idBackUrl = await uploadBufferToSupabase(
          f.buffer,
          f.mimetype,
          backPath,
        );
        console.log(
          "[cards] Multipart upload result - back URL:",
          idBackUrl || "FAILED",
        );
      } else if (req.body.id_back_base64) {
        console.log("[cards] Attempting base64 upload for back image...");
        idBackUrl = await uploadBase64ToSupabase(
          req.body.id_back_base64,
          backPath,
        );
        console.log(
          "[cards] Base64 upload result - back URL:",
          idBackUrl || "FAILED",
        );
      } else {
        console.warn("[cards] No back image received at all - skipping upload");
      }

      console.log("\n[cards] ========== UPLOAD SUMMARY ==========");
      console.log("[cards] Front upload:", idFrontUrl ? "SUCCESS" : "FAILED");
      console.log("[cards] Back upload:", idBackUrl ? "SUCCESS" : "FAILED");
      console.log("[cards] ====================================\n");

      const card = new Card({
        card_id,
        user_id: customUserId,
        name,
        barangay: barangay || "Not detected",
        type_of_disability: type_of_disability || "Not detected",
        address: address || "Not detected",
        date_of_birth: parsedDob,
        sex: mapSex(sex),
        blood_type: blood_type || "Not detected",
        date_issued: parsedDateIssued,
        emergency_contact_name: emergency_contact_name || "Not provided",
        emergency_contact_number: emergency_contact_number || "Not provided",
        status: "Pending",
        face_descriptors: face_descriptors.length > 0 ? face_descriptors : null,
        extracted_data: extracted_data ?? null,
        id_front_url: idFrontUrl,
        id_back_url: idBackUrl,
        id_image_url: null,
        last_verified_at: new Date(),
        verification_count: 1,
        created_by: customUserId,
      });

      await card.save();
      console.log("[cards] Card saved to database with ID:", card._id);

      await User.findOneAndUpdate(
        { user_id: customUserId },
        { card_id: card_id, updated_by: customUserId },
      );
      console.log("[cards] User updated with card_id");

      console.log(
        `Card saved: ${card_id} | front=${idFrontUrl ? "yes" : "no"} | back=${idBackUrl ? "yes" : "no"}`,
      );
      console.log("=".repeat(50));

      res.status(201).json({
        success: true,
        message: "Card submitted for admin review",
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
          id_front_url: card.id_front_url,
          id_back_url: card.id_back_url,
          id_image_url: card.id_image_url,
          last_verified_at: card.last_verified_at,
          created_at: card.created_at,
        },
      });
    } catch (err: any) {
      console.error("[POST /api/cards] Error:", err);

      if (err.code === 11000) {
        res.status(409).json({
          error: "Card already registered",
          message: "This Card ID already exists.",
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

// ── POST /api/cards/:id/photo ─────────────────────────────────────────────────
router.post(
  "/:id/photo",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customUserId = req.userId;
      if (!customUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { id } = req.params;
      const { photo_base64 } = req.body;

      if (!photo_base64) {
        res.status(400).json({ error: "Photo is required" });
        return;
      }
      if (!photo_base64.startsWith("data:image/")) {
        res
          .status(400)
          .json({ error: "Invalid photo format. Must be a base64 data URI." });
        return;
      }

      const card = await Card.findById(id);
      if (!card) {
        res.status(404).json({ error: "Card not found" });
        return;
      }

      const user = await User.findOne({ user_id: customUserId }).lean<{
        role?: string;
        user_id: string;
      }>();
      const isAdmin = user?.role === "MSWD-CSWDO-PDAO";

      if (card.user_id !== customUserId && !isAdmin) {
        res.status(403).json({ error: "Forbidden: You don't own this card" });
        return;
      }

      const sanitizedCardId = card.card_id.replace(/[^a-zA-Z0-9\-]/g, "_");
      const sanitizedUserId = customUserId.replace(/[^a-zA-Z0-9\-]/g, "_");
      const photoPath = `${sanitizedUserId}/${sanitizedCardId}/1x1_photo.jpg`;

      console.log("[cards] Uploading 1x1 photo to:", photoPath);

      const photoUrl = await uploadBase64ToSupabase(photo_base64, photoPath);
      if (!photoUrl) throw new Error("Failed to upload photo");

      card.id_image_url = photoUrl;
      card.updated_by = customUserId;
      await card.save();

      console.log("[cards] 1x1 photo uploaded for card:", card.card_id);

      res.json({
        success: true,
        message: "Photo uploaded successfully",
        photo_url: photoUrl,
      });
    } catch (err: any) {
      console.error("[POST /api/cards/:id/photo] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to upload photo" });
    }
  },
);

// ── GET /api/cards/me ─────────────────────────────────────────────────────────
router.get(
  "/me",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customUserId = req.userId;
      if (!customUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      console.log("[cards] Fetching cards for user:", customUserId);
      const cards = await Card.find({ user_id: customUserId }).sort({
        created_at: -1,
      });
      console.log(
        `[cards] Found ${cards.length} cards for user ${customUserId}`,
      );

      res.json({ success: true, cards, count: cards.length });
    } catch (err: any) {
      console.error("[GET /api/cards/me] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to fetch cards" });
    }
  },
);

// ── GET /api/cards/check ──────────────────────────────────────────────────────
router.get(
  "/check",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customUserId = req.userId;
      if (!customUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      console.log("[cards] Checking card status for user:", customUserId);

      const user = await User.findOne({ user_id: customUserId })
        .select("user_id card_id is_verified")
        .lean<{ user_id: string; card_id?: string; is_verified?: boolean }>();

      const card = await Card.findOne({ user_id: customUserId })
        .select("_id card_id status")
        .lean<{ _id: string; card_id: string; status: string }>();

      console.log("[cards] Check result:", {
        hasCard: !!card,
        is_verified: user?.is_verified ?? false,
        cardId: card?.card_id,
      });

      res.json({
        success: true,
        hasCard: !!card,
        is_verified: user?.is_verified ?? false,
        card: card ?? null,
      });
    } catch (err: any) {
      console.error("[GET /api/cards/check] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to check card" });
    }
  },
);

// ── GET /api/cards/:id ────────────────────────────────────────────────────────
router.get(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const customUserId = req.userId;
      if (!customUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const card = await Card.findById(req.params.id);
      if (!card) {
        res.status(404).json({ error: "Card not found" });
        return;
      }

      const user = await User.findOne({ user_id: customUserId })
        .select("role")
        .lean<{ role?: string }>();

      const isAdmin = user?.role === "MSWD-CSWDO-PDAO";
      const isOwner = card.user_id === customUserId;

      if (!isAdmin && !isOwner) {
        res
          .status(403)
          .json({ error: "Forbidden: You don't have access to this card" });
        return;
      }

      res.json({ success: true, card });
    } catch (err: any) {
      console.error("[GET /api/cards/:id] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to fetch card" });
    }
  },
);

export default router;

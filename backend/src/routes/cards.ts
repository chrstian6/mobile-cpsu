// backend/src/routes/cards.ts
import { Response, Router } from "express";
import multer from "multer";
import { AuthRequest, requireAuth } from "../middleware/auth";
import Card from "../models/Cards";
import User from "../models/User";
import {
  uploadBase64ToSupabase,
  uploadBufferToSupabase,
} from "../utils/supabase";

const router = Router();

// ── Multer — memory storage ───────────────────────────────────────────────────
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
      const mongoId = req.userId;
      if (!mongoId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const userDoc = (await User.findById(mongoId).lean()) as any;
      if (!userDoc) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const userId: string = userDoc.user_id || mongoId;

      console.log("=".repeat(50));
      console.log("[cards] Processing card submission for user:", userId);
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

      // Validate
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

      // ── Upload images to Supabase ─────────────────────────────────────────────
      const files = req.files as
        | Record<string, Express.Multer.File[]>
        | undefined;

      const sanitizedCardId = card_id.replace(/[^a-zA-Z0-9\-]/g, "_");
      const sanitizedUserId = userId.replace(/[^a-zA-Z0-9\-]/g, "_");

      console.log("\n[cards] ========== IMAGE UPLOAD DEBUG ==========");
      console.log("[cards] Content-Type:", req.headers["content-type"]);
      console.log(
        "[cards] Files received:",
        files ? Object.keys(files) : "none",
      );
      console.log(
        "[cards] Body fields present:",
        Object.keys(req.body).filter((k) => !k.includes("base64")),
      );

      // Debug front image
      console.log("\n[cards] 📸 FRONT IMAGE DETAILS:");
      if (files?.id_front?.[0]) {
        const f = files.id_front[0];
        console.log("  ✅ From multipart: YES");
        console.log("  - Size:", f.size, "bytes");
        console.log("  - Mimetype:", f.mimetype);
        console.log("  - Originalname:", f.originalname);
        console.log("  - Buffer exists:", !!f.buffer);
        console.log("  - Buffer length:", f.buffer?.length || 0);
      } else {
        console.log("  ❌ From multipart: NO");
      }

      if (req.body.id_front_base64) {
        console.log("  ✅ From base64: YES");
        console.log("  - Base64 length:", req.body.id_front_base64.length);
        console.log(
          "  - Base64 prefix:",
          req.body.id_front_base64.substring(0, 50) + "...",
        );

        // Validate base64 format
        const hasDataUri = req.body.id_front_base64.startsWith("data:image");
        console.log("  - Has data URI prefix:", hasDataUri);
      } else {
        console.log("  ❌ From base64: NO");
      }

      // Debug back image
      console.log("\n[cards] 📸 BACK IMAGE DETAILS:");
      if (files?.id_back?.[0]) {
        const f = files.id_back[0];
        console.log("  ✅ From multipart: YES");
        console.log("  - Size:", f.size, "bytes");
        console.log("  - Mimetype:", f.mimetype);
        console.log("  - Originalname:", f.originalname);
        console.log("  - Buffer exists:", !!f.buffer);
        console.log("  - Buffer length:", f.buffer?.length || 0);
      } else {
        console.log("  ❌ From multipart: NO");
      }

      if (req.body.id_back_base64) {
        console.log("  ✅ From base64: YES");
        console.log("  - Base64 length:", req.body.id_back_base64.length);

        const hasDataUri = req.body.id_back_base64.startsWith("data:image");
        console.log("  - Has data URI prefix:", hasDataUri);
      } else {
        console.log("  ❌ From base64: NO");
      }

      let idFrontUrl: string | null = null;
      let idBackUrl: string | null = null;

      // Upload front image
      const frontPath = `${sanitizedUserId}/${sanitizedCardId}/id_front.jpg`;
      console.log("\n[cards] 📤 Uploading front image to:", frontPath);

      if (files?.id_front?.[0] && files.id_front[0].size > 0) {
        const f = files.id_front[0];
        console.log("[cards] Attempting multipart upload for front image...");
        console.log("[cards] File size for upload:", f.size, "bytes");

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
        console.log(
          "[cards] Base64 length for upload:",
          req.body.id_front_base64.length,
        );

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
          "[cards] ⚠️ No front image received at all - skipping upload",
        );
      }

      // Upload back image
      const backPath = `${sanitizedUserId}/${sanitizedCardId}/id_back.jpg`;
      console.log("\n[cards] 📤 Uploading back image to:", backPath);

      if (files?.id_back?.[0] && files.id_back[0].size > 0) {
        const f = files.id_back[0];
        console.log("[cards] Attempting multipart upload for back image...");
        console.log("[cards] File size for upload:", f.size, "bytes");

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
        console.log(
          "[cards] Base64 length for upload:",
          req.body.id_back_base64.length,
        );

        idBackUrl = await uploadBase64ToSupabase(
          req.body.id_back_base64,
          backPath,
        );

        console.log(
          "[cards] Base64 upload result - back URL:",
          idBackUrl || "FAILED",
        );
      } else {
        console.warn(
          "[cards] ⚠️ No back image received at all - skipping upload",
        );
      }

      console.log("\n[cards] ========== UPLOAD SUMMARY ==========");
      console.log(
        "[cards] Front upload:",
        idFrontUrl ? "✅ SUCCESS" : "❌ FAILED",
      );
      console.log(
        "[cards] Back upload:",
        idBackUrl ? "✅ SUCCESS" : "❌ FAILED",
      );
      if (idFrontUrl) console.log("[cards] Front URL:", idFrontUrl);
      if (idBackUrl) console.log("[cards] Back URL:", idBackUrl);
      console.log("[cards] ====================================\n");

      // ── Save card with raw values ─────────────────────────────────────────────
      const card = new Card({
        card_id,
        user_id: userId,
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
        id_image_url: idFrontUrl,
        last_verified_at: new Date(),
        verification_count: 1,
        created_by: userId,
      });

      await card.save();
      console.log("[cards] ✅ Card saved to database with ID:", card._id);

      await User.findByIdAndUpdate(mongoId, {
        card_id: card_id,
        updated_by: userId,
      });
      console.log("[cards] ✅ User updated with card_id");

      console.log(
        `✅ Card saved: ${card_id} | front=${idFrontUrl ? "✓" : "✗"} | back=${idBackUrl ? "✓" : "✗"}`,
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
          last_verified_at: card.last_verified_at,
          created_at: card.created_at,
        },
      });
    } catch (err: any) {
      console.error("[POST /api/cards] ❌ Error:", err);
      console.error("Error details:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
        code: err.code,
      });

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

// ── GET /api/cards/me ─────────────────────────────────────────────────────────
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

      const userDoc = (await User.findById(mongoId)
        .select("user_id")
        .lean()) as any;
      const userId = userDoc?.user_id || mongoId;

      const cards = await Card.find({ user_id: userId }).sort({
        created_at: -1,
      });

      res.json({
        success: true,
        cards,
        count: cards.length,
      });
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
      const mongoId = req.userId;
      if (!mongoId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const userDoc = (await User.findById(mongoId)
        .select("user_id card_id is_verified")
        .lean()) as any;
      const userId = userDoc?.user_id || mongoId;

      const card = await Card.findOne({ user_id: userId }).lean();

      res.json({
        success: true,
        hasCard: !!card,
        is_verified: userDoc?.is_verified ?? false,
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
      const card = await Card.findById(req.params.id);

      if (!card) {
        res.status(404).json({ error: "Card not found" });
        return;
      }

      // Check if user has access to this card
      const mongoId = req.userId;
      const userDoc = (await User.findById(mongoId).lean()) as any;
      const userId = userDoc?.user_id || mongoId;

      // Allow access if user is admin or owns the card
      const isAdmin = userDoc?.role === "MSWD-CSWDO-PDAO";
      const isOwner = card.user_id === userId;

      if (!isAdmin && !isOwner) {
        res
          .status(403)
          .json({ error: "Forbidden: You don't have access to this card" });
        return;
      }

      res.json({
        success: true,
        card,
      });
    } catch (err: any) {
      console.error("[GET /api/cards/:id] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to fetch card" });
    }
  },
);

export default router;

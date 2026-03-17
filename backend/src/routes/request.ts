// backend/src/routes/request.ts
import { Response, Router } from "express";
import mongoose from "mongoose";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { ItemModel } from "../models/Item";
import { RequestModel } from "../models/Request";
import User from "../models/User";
import { BUCKETS, uploadBase64ToSupabase } from "../utils/supabase";

const router = Router();

// Helper to get the custom user_id from either MongoDB _id or custom user_id
const getCustomUserId = async (identifier: string): Promise<string> => {
  // Check if the identifier is a valid MongoDB ObjectId
  const isValidObjectId = mongoose.Types.ObjectId.isValid(identifier);

  if (isValidObjectId) {
    // If it's a valid ObjectId, find the user by _id and return their custom user_id
    const user = (await User.findById(identifier)
      .select("user_id")
      .lean()) as any;
    if (user && user.user_id) {
      return user.user_id;
    }
  } else {
    // If it's not a valid ObjectId, assume it's already a custom user_id
    // But verify it exists in the database
    const user = (await User.findOne({ user_id: identifier })
      .select("user_id")
      .lean()) as any;
    if (user) {
      return user.user_id;
    }
  }

  // If no user found, return the original identifier (though this shouldn't happen)
  return identifier;
};

// Helper to get user details using custom user_id
const getUserDetailsByCustomId = async (customUserId: string): Promise<any> => {
  return await User.findOne({ user_id: customUserId }).lean();
};

// POST /api/requests - Create a new request
router.post(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const identifier = req.userId;
      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Always get the custom user_id
      const customUserId = await getCustomUserId(identifier);

      // Get user details using custom user_id
      const user = await getUserDetailsByCustomId(customUserId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const {
        items,
        purpose,
        priority = "Normal",
        is_emergency = false,
      } = req.body;

      // Validate items array
      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "At least one item is required" });
        return;
      }

      // Validate each item and check availability
      const validatedItems = [];
      let hasPrescription = false;
      let hasMedicalCert = false;
      let hasBarangayCert = false;

      for (const item of items) {
        const dbItem = await ItemModel.findOne({
          item_id: item.item_id,
        }).session(session);

        if (!dbItem) {
          await session.abortTransaction();
          res.status(404).json({ error: `Item ${item.item_id} not found` });
          return;
        }

        if (dbItem.getAvailableStock() < item.quantity) {
          await session.abortTransaction();
          res.status(400).json({
            error: "Insufficient stock",
            message: `Only ${dbItem.getAvailableStock()} ${dbItem.unit}(s) of ${dbItem.item_name} available.`,
          });
          return;
        }

        // Handle prescription upload if any
        let prescriptionUrl = null;
        if (item.prescription_image && dbItem.requires_prescription) {
          try {
            const filePath = `${customUserId}/${Date.now()}_prescription.jpg`;
            prescriptionUrl = await uploadBase64ToSupabase(
              item.prescription_image,
              filePath,
              BUCKETS.PRESCRIPTIONS,
            );
            if (!prescriptionUrl) {
              console.warn("Prescription upload failed but continuing");
            }
          } catch (uploadErr) {
            console.error("Failed to upload prescription:", uploadErr);
          }
        }

        // Handle medical certificate upload if any
        let medicalCertUrl = null;
        if (item.medical_certificate && dbItem.requires_med_cert) {
          try {
            const filePath = `${customUserId}/${Date.now()}_medical_certificate.jpg`;
            medicalCertUrl = await uploadBase64ToSupabase(
              item.medical_certificate,
              filePath,
              BUCKETS.MEDICAL_CERTIFICATES,
            );
            if (!medicalCertUrl) {
              console.warn("Medical certificate upload failed but continuing");
            }
          } catch (uploadErr) {
            console.error("Failed to upload medical certificate:", uploadErr);
          }
        }

        validatedItems.push({
          item_id: dbItem.item_id,
          item_name: dbItem.item_name,
          quantity: item.quantity,
          unit: dbItem.unit,
          requires_prescription: dbItem.requires_prescription,
          prescription_image_url: prescriptionUrl,
          notes: item.notes || null,
        });

        if (dbItem.requires_prescription) {
          hasPrescription = true;
        }
        if (dbItem.requires_med_cert) {
          hasMedicalCert = true;
        }
        if (dbItem.requires_brgy_cert) {
          hasBarangayCert = true;
        }
      }

      // Create request using custom user_id
      const request = new RequestModel({
        requester_id: customUserId, // Always use custom user_id
        requester_name:
          `${user.last_name || ""}${user.last_name && user.first_name ? ", " : ""}${user.first_name || ""}`.trim() ||
          "Unknown",
        requester_barangay: user.address?.barangay || "Unknown",
        requester_contact: user.contact_number || "",
        items: validatedItems,
        purpose: purpose || "",
        priority,
        is_emergency,
        has_prescription: hasPrescription,
        has_medical_cert: hasMedicalCert,
        has_barangay_cert: hasBarangayCert,
        status: "Pending",
        created_by: customUserId, // Always use custom user_id
      });

      await request.save({ session });

      // Update pending_requests count for items
      for (const item of validatedItems) {
        await ItemModel.updateOne(
          { item_id: item.item_id },
          { $inc: { pending_requests: 1 } },
        ).session(session);
      }

      await session.commitTransaction();

      res.status(201).json({
        success: true,
        message: "Request submitted successfully",
        request: {
          request_id: request.request_id,
          status: request.status,
          queue_number: request.queue_number,
          estimated_wait_time: request.estimated_wait_time,
          created_at: request.created_at,
        },
      });
    } catch (err: any) {
      await session.abortTransaction();
      console.error("[POST /api/requests] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to create request" });
    } finally {
      session.endSession();
    }
  },
);

// GET /api/requests/me - Get current user's requests
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

      // Always get the custom user_id
      const customUserId = await getCustomUserId(identifier);

      // Find requests using custom user_id
      const requests = await RequestModel.find({ requester_id: customUserId })
        .sort({ created_at: -1 })
        .lean();

      res.json({
        success: true,
        requests: requests || [],
        count: requests?.length || 0,
      });
    } catch (err: any) {
      console.error("[GET /api/requests/me] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to fetch requests" });
    }
  },
);

// GET /api/requests/queue - Get queue information
router.get(
  "/queue",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const stats = await (RequestModel as any).getQueueStatistics();

      // Get user's position in queue if they have a pending request
      const identifier = req.userId;
      let userRequest = null;

      if (identifier) {
        const customUserId = await getCustomUserId(identifier);

        userRequest = await RequestModel.findOne({
          requester_id: customUserId,
          status: { $in: ["In Queue", "Processing"] },
        }).lean();
      }

      res.json({
        success: true,
        statistics: stats || {
          totalInQueue: 0,
          emergencyCount: 0,
          highPriorityCount: 0,
          averageWaitTime: 0,
          byBarangay: [],
        },
        user_request: userRequest
          ? {
              request_id: (userRequest as any).request_id,
              queue_position: (userRequest as any).queue_position,
              estimated_wait_time: (userRequest as any).estimated_wait_time,
              status: (userRequest as any).status,
            }
          : null,
      });
    } catch (err: any) {
      console.error("[GET /api/requests/queue] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to fetch queue info" });
    }
  },
);

// GET /api/requests/:id - Get single request
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

      const request = await RequestModel.findOne({
        $or: [{ _id: id }, { request_id: id }],
      }).lean();

      if (!request) {
        res.status(404).json({ error: "Request not found" });
        return;
      }

      // Get user to check if admin
      const user = await getUserDetailsByCustomId(customUserId);
      const isAdmin = user?.role === "MSWD-CSWDO-PDAO";

      // Check if user owns this request (using custom user_id)
      if (!isAdmin && (request as any).requester_id !== customUserId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      res.json({
        success: true,
        request,
      });
    } catch (err: any) {
      console.error("[GET /api/requests/:id] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to fetch request" });
    }
  },
);

// PATCH /api/requests/:id/cancel - Cancel a request
router.patch(
  "/:id/cancel",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const identifier = req.userId;

      if (!identifier) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const customUserId = await getCustomUserId(identifier);

      const request = await RequestModel.findOne({
        $or: [{ _id: id }, { request_id: id }],
      });

      if (!request) {
        res.status(404).json({ error: "Request not found" });
        return;
      }

      // Check if user owns this request (using custom user_id)
      if ((request as any).requester_id !== customUserId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      // Check if request can be cancelled
      if (!["Pending", "In Queue"].includes((request as any).status)) {
        res.status(400).json({
          error: "Cannot cancel request",
          message: `Requests with status "${(request as any).status}" cannot be cancelled.`,
        });
        return;
      }

      await (request as any).cancel(customUserId, reason);

      res.json({
        success: true,
        message: "Request cancelled successfully",
        request_id: (request as any).request_id,
      });
    } catch (err: any) {
      console.error("[PATCH /api/requests/:id/cancel] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to cancel request" });
    }
  },
);

export default router;

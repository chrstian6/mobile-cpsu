// backend/src/routes/notifications.ts
import { Response, Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { NotificationModel, createNotification } from "../models/Notification";
import User from "../models/User";

const router = Router();

// ── Helper: get user role from DB ─────────────────────────────────────────────
const getUserRole = async (userId: string): Promise<string | undefined> => {
  const user = await User.findOne({ user_id: userId })
    .select("role")
    .lean<{ role?: string }>();
  return user?.role;
};

// ── GET /api/notifications/me ─────────────────────────────────────────────────
// Returns notifications where:
//   - user_id matches (direct/personal notifications), OR
//   - target_roles includes the user's role (role-broadcast notifications)
router.get(
  "/me",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const status = req.query.status as string | undefined;
      const userRole = await getUserRole(userId);

      // Match direct notifications OR role-targeted notifications
      const visibilityConditions: any[] = [{ user_id: userId }];
      if (userRole) {
        visibilityConditions.push({ target_roles: userRole });
      }

      const query: Record<string, any> = {
        $or: visibilityConditions,
      };

      if (status && ["unread", "read", "archived"].includes(status)) {
        query.status = status;
      }

      const notifications = await NotificationModel.find(query)
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();

      res.json({
        success: true,
        notifications,
        count: notifications.length,
      });
    } catch (err: any) {
      console.error("[GET /api/notifications/me] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to fetch notifications" });
    }
  },
);

// ── GET /api/notifications/unread-count ───────────────────────────────────────
router.get(
  "/unread-count",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const userRole = await getUserRole(userId);

      const visibilityConditions: any[] = [{ user_id: userId }];
      if (userRole) {
        visibilityConditions.push({ target_roles: userRole });
      }

      const count = await NotificationModel.countDocuments({
        $or: visibilityConditions,
        status: "unread",
      });

      res.json({ success: true, count });
    } catch (err: any) {
      console.error("[GET /api/notifications/unread-count] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to get unread count" });
    }
  },
);

// ── PATCH /api/notifications/mark-all-read ────────────────────────────────────
router.patch(
  "/mark-all-read",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const userRole = await getUserRole(userId);

      const visibilityConditions: any[] = [{ user_id: userId }];
      if (userRole) {
        visibilityConditions.push({ target_roles: userRole });
      }

      await NotificationModel.updateMany(
        { $or: visibilityConditions, status: "unread" },
        { $set: { status: "read", read_at: new Date() } },
      );

      res.json({ success: true, message: "All notifications marked as read" });
    } catch (err: any) {
      console.error("[PATCH /api/notifications/mark-all-read] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to mark all as read" });
    }
  },
);

// ── PATCH /api/notifications/:notificationId/read ─────────────────────────────
router.patch(
  "/:notificationId/read",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { notificationId } = req.params;
      const userRole = await getUserRole(userId);

      // Allow marking as read if it's a direct notification OR role-targeted
      const visibilityConditions: any[] = [{ user_id: userId }];
      if (userRole) {
        visibilityConditions.push({ target_roles: userRole });
      }

      const notification = await NotificationModel.findOne({
        notification_id: notificationId,
        $or: visibilityConditions,
      });

      if (!notification) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }

      if (notification.status !== "read") {
        notification.status = "read";
        notification.read_at = new Date();
        await notification.save();
      }

      res.json({ success: true, message: "Notification marked as read" });
    } catch (err: any) {
      console.error("[PATCH /api/notifications/:id/read] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to mark as read" });
    }
  },
);

// ── PATCH /api/notifications/:notificationId/archive ─────────────────────────
router.patch(
  "/:notificationId/archive",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { notificationId } = req.params;
      const userRole = await getUserRole(userId);

      const visibilityConditions: any[] = [{ user_id: userId }];
      if (userRole) {
        visibilityConditions.push({ target_roles: userRole });
      }

      const notification = await NotificationModel.findOne({
        notification_id: notificationId,
        $or: visibilityConditions,
      });

      if (!notification) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }

      notification.status = "archived";
      notification.archived_at = new Date();
      await notification.save();

      res.json({ success: true, message: "Notification archived" });
    } catch (err: any) {
      console.error("[PATCH /api/notifications/:id/archive] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to archive notification" });
    }
  },
);

// ── DELETE /api/notifications/:notificationId ─────────────────────────────────
router.delete(
  "/:notificationId",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { notificationId } = req.params;
      const userRole = await getUserRole(userId);

      const visibilityConditions: any[] = [{ user_id: userId }];
      if (userRole) {
        visibilityConditions.push({ target_roles: userRole });
      }

      const result = await NotificationModel.deleteOne({
        notification_id: notificationId,
        $or: visibilityConditions,
      });

      if (result.deletedCount === 0) {
        res.status(404).json({ error: "Notification not found" });
        return;
      }

      res.json({ success: true, message: "Notification deleted" });
    } catch (err: any) {
      console.error("[DELETE /api/notifications/:id] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to delete notification" });
    }
  },
);

// ── POST /api/notifications ───────────────────────────────────────────────────
// Admin/Staff only: create a notification for a specific user.
router.post(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const creatorId = req.userId;
      if (!creatorId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const creatorRole = await getUserRole(creatorId);
      const allowedRoles = ["Admin", "Supervisor", "Staff", "MSWD-CSWDO-PDAO"];
      if (!creatorRole || !allowedRoles.includes(creatorRole)) {
        res.status(403).json({ error: "Forbidden: Insufficient permissions" });
        return;
      }

      const {
        user_id,
        type,
        title,
        message,
        application_id,
        priority,
        data,
        action_url,
        action_text,
        target_roles,
        is_public,
      } = req.body;

      if (!user_id || !type || !title || !message) {
        res.status(400).json({
          error: "user_id, type, title, and message are required",
        });
        return;
      }

      const result = await createNotification({
        user_id,
        type,
        title,
        message,
        application_id,
        priority: priority ?? "normal",
        data,
        action_url,
        action_text,
        created_by: creatorId,
        target_roles,
        is_public: is_public ?? false,
      });

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      res.status(201).json({ success: true, notification: result.data });
    } catch (err: any) {
      console.error("[POST /api/notifications] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to create notification" });
    }
  },
);

export default router;

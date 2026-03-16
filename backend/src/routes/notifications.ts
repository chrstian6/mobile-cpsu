// backend/src/routes/notifications.ts
import { Response, Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import {
  NotificationModel,
  createNotification,
  getUnreadCount,
  markAllAsRead,  
} from "../models/Notification";
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
// Returns all notifications for the current user (most recent first).
// Respects role-based visibility: Staff only see Staff-targeted or public notifs.
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

      const query: Record<string, any> = { user_id: userId };

      if (userRole === "Staff") {
        query.$or = [{ is_public: true }, { target_roles: "Staff" }];
      }

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
// Returns only the unread count for the current user.
// Used by the home screen bell icon to show/hide the red dot.
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
      const result = await getUnreadCount(userId, userRole);

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

      res.json({ success: true, count: result.count });
    } catch (err: any) {
      console.error("[GET /api/notifications/unread-count] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to get unread count" });
    }
  },
);

// ── PATCH /api/notifications/mark-all-read ────────────────────────────────────
// Marks all unread notifications as read for the current user.
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
      const result = await markAllAsRead(userId, userRole);

      if (!result.success) {
        res.status(500).json({ error: result.error });
        return;
      }

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
// Marks a single notification as read.
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

      const notification = await NotificationModel.findOne({
        notification_id: notificationId,
        user_id: userId,
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
// Archives a notification (hides it from the default list without deleting).
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

      const notification = await NotificationModel.findOne({
        notification_id: notificationId,
        user_id: userId,
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
// Hard-deletes a notification. Users can only delete their own.
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

      const result = await NotificationModel.deleteOne({
        notification_id: notificationId,
        user_id: userId,
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

      // Only Admin / Supervisor / Staff may create notifications
      const creatorRole = await getUserRole(creatorId);
      const allowedRoles = ["Admin", "Supervisor", "Staff"];
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

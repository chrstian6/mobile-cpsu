// backend/src/utils/notificationHelper.ts
import {
  NotificationModel,
  NotificationPriority,
  NotificationType,
} from "../models/Notification";

interface NotifyAdminsPayload {
  triggered_by: string; // user_id of the person who performed the action
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  application_id?: string;
  action_url?: string;
  action_text?: string;
  data?: Record<string, any>;
}

const generateNotificationId = (): string => {
  const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `NOTIF-${dateStr}-${random}`;
};

/**
 * Creates a single notification document visible to ALL admins with
 * role "MSWD-CSWDO-PDAO" — no specific admin ID needed.
 *
 * How it works:
 *   - user_id      = the submitting user's ID (required by schema, identifies who triggered it)
 *   - target_roles = ["MSWD-CSWDO-PDAO"] (every admin querying by role will see this)
 *
 * The admin frontend fetches via:
 *   { $or: [{ user_id: adminId }, { target_roles: "MSWD-CSWDO-PDAO" }] }
 * so every admin sees it without duplicating documents per admin.
 *
 * Errors are swallowed so a notification failure never breaks the calling route.
 */
export async function notifyAdmins(
  payload: NotifyAdminsPayload,
): Promise<void> {
  try {
    await NotificationModel.create({
      notification_id: generateNotificationId(),
      user_id: payload.triggered_by,
      ...(payload.application_id && { application_id: payload.application_id }),
      type: payload.type,
      title: payload.title,
      message: payload.message,
      priority: payload.priority ?? "normal",
      status: "unread",
      data: payload.data ?? {},
      ...(payload.action_url && { action_url: payload.action_url }),
      ...(payload.action_text && { action_text: payload.action_text }),
      email_sent: false,
      created_by: payload.triggered_by,
      target_roles: ["MSWD-CSWDO-PDAO"],
      is_public: false,
    });

    console.log(
      `[notifyAdmins] ✅ Notification created — "${payload.title}" triggered by ${payload.triggered_by}`,
    );
  } catch (err) {
    console.error("[notifyAdmins] ❌ Failed to create notification:", err);
  }
}

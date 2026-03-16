// backend/src/routes/events.ts
import { Response, Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import Event from "../models/Events";

const router = Router();

// ── GET /api/events ───────────────────────────────────────────────────────────
// Public-ish: fetches active events for the mobile home screen.
// Query params:
//   active=true   → only isActive: true events (default for mobile)
//   year=2026     → filter by year string
//   limit=N       → max results (default 10, max 50)
router.get(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { active, year, limit: limitParam } = req.query;

      const query: Record<string, any> = {};

      if (active === "true") {
        query.isActive = true;
      }

      if (year && typeof year === "string") {
        query.year = year;
      }

      // Only return events that haven't expired (expiresAt null or in the future)
      query.$or = [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }];

      const limit = Math.min(Number(limitParam) || 10, 50);

      const events = await Event.find(query)
        .sort({ date: 1 }) // nearest upcoming events first
        .limit(limit)
        .lean();

      res.json({
        success: true,
        events,
        count: events.length,
      });
    } catch (err: any) {
      console.error("[GET /api/events] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to fetch events" });
    }
  },
);

// ── GET /api/events/:id ───────────────────────────────────────────────────────
router.get(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        res.status(400).json({ error: "Invalid event ID format" });
        return;
      }

      const event = await Event.findById(req.params.id).lean();
      if (!event) {
        res.status(404).json({ error: "Event not found" });
        return;
      }

      res.json({ success: true, event });
    } catch (err: any) {
      console.error("[GET /api/events/:id] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to fetch event" });
    }
  },
);

export default router;
